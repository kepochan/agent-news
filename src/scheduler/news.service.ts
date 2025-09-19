import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ConfigService } from '@/config/config.service';
import { TopicConfig, SourceConfig } from '@/config/config.schema';
import { FetcherFactory } from '@/fetchers/fetcher.factory';
import { OpenAIProcessor } from '@/processors/openai.processor';
import { SlackProcessor } from '@/processors/slack.processor';
import { DeduplicationService } from '@/utils/deduplication.service';
import { PGLockService } from '@/utils/pg-lock.service';
import { ProcessedItem } from '@/shared/types';
import * as crypto from 'crypto';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly fetcherFactory: FetcherFactory,
    private readonly openaiProcessor: OpenAIProcessor,
    private readonly slackProcessor: SlackProcessor,
    private readonly deduplicationService: DeduplicationService,
    private readonly pgLockService: PGLockService,
  ) {}

  async processTopic(topicSlug: string, force = false): Promise<{ processed: number; summary: string | null }> {
    return await this.pgLockService.withLock(
      `process-topic-${topicSlug}`,
      async () => {
        const topicConfig = this.configService.getTopic(topicSlug);
        if (!topicConfig) {
          throw new Error(`Topic configuration not found: ${topicSlug}`);
        }

        if (!topicConfig.enabled) {
          throw new Error(`Topic is disabled: ${topicSlug}`);
        }

        this.logger.log(`Starting processing for topic: ${topicSlug}`);

        // Get or create topic in database
        const topic = await this.getOrCreateTopic(topicConfig);

        // Create a new run
        const run = await this.prisma.run.create({
          data: {
            topicId: topic.id,
            status: 'running',
            startedAt: new Date(),
          },
        });

        try {
          // Fetch items from all sources
          const allItems: ProcessedItem[] = [];
          
          for (const sourceConfig of topicConfig.sources) {
            if (!sourceConfig.enabled) {
              this.logger.debug(`Skipping disabled source: ${sourceConfig.name}`);
              continue;
            }

            try {
              const items = await this.fetchFromSource(topic.id, sourceConfig, topicConfig, force);
              allItems.push(...items);
            } catch (error) {
              this.logger.error(`Failed to fetch from source ${sourceConfig.name}:`, error);
            }
          }

          this.logger.log(`Fetched ${allItems.length} total items for topic: ${topicSlug}`);

          // Filter duplicates (unless force mode)
          const uniqueItems = force ? allItems : await this.filterDuplicates(allItems, topic.id);
          this.logger.log(`${uniqueItems.length} ${force ? 'items (force mode - no deduplication)' : 'unique items after deduplication'}`);

          if (uniqueItems.length === 0) {
            await this.prisma.run.update({
              where: { id: run.id },
              data: {
                status: 'completed',
                completedAt: new Date(),
                metadata: { message: 'No new items to process' },
              },
            });
            return { processed: 0, summary: null };
          }

          // Save items to database
          const savedItems = await this.saveItems(uniqueItems, topic.id);

          // Create run items
          await this.createRunItems(run.id, savedItems);

          // Process with OpenAI if assistant is configured (topic-specific or global default)
          let summary = '';
          let openaiPrompt = '';
          if (topicConfig.assistantId || this.configService.openaiAssistantId) {
            const processResult = await this.openaiProcessor.processItems(
              uniqueItems,
              topicConfig.assistantId,
            );

            if (processResult.success) {
              summary = processResult.summary;
              openaiPrompt = processResult.prompt;
            } else {
              this.logger.error(`OpenAI processing failed: ${processResult.error}`);
            }
          }

          // Post to Slack if configured and we have a summary
          if (summary && topicConfig.channels.slack?.channels?.length) {
            const metadata = {
              itemCount: uniqueItems.length,
              timeRange: this.getTimeRange(uniqueItems),
              sources: topicConfig.sources.length,
            };

            await this.slackProcessor.postSummary(
              topicConfig.name,
              summary,
              topicConfig.channels.slack.channels,
              metadata,
            );
          }

          // Update run as completed
          await this.prisma.run.update({
            where: { id: run.id },
            data: {
              status: 'completed',
              completedAt: new Date(),
              metadata: {
                itemsProcessed: uniqueItems.length,
                sourcesProcessed: topicConfig.sources.filter(s => s.enabled).length,
                hasSummary: !!summary,
                openaiSummary: summary || null,
                openaiPrompt: openaiPrompt || null,
              },
            },
          });

          this.logger.log(`Completed processing for topic: ${topicSlug}`);

          return {
            processed: uniqueItems.length,
            summary: summary || null,
          };

        } catch (error) {
          // Mark run as failed
          await this.prisma.run.update({
            where: { id: run.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          throw error;
        }
      },
    );
  }

  async cleanTopic(topicSlug: string): Promise<{ deleted: { runs: number; items: number; sources: number; watermarks: number; topic: boolean }; message: string }> {
    return await this.pgLockService.withLock(
      `clean-topic-${topicSlug}`,
      async () => {
        const topicConfig = this.configService.getTopic(topicSlug);
        if (!topicConfig) {
          throw new Error(`Topic configuration not found: ${topicSlug}`);
        }

        const topic = await this.prisma.topic.findUnique({
          where: { slug: topicSlug },
        });

        if (!topic) {
          throw new Error(`Topic not found in database: ${topicSlug}`);
        }

        this.logger.log(`Cleaning all data for topic ${topicSlug}`);

        const deleteCounts = {
          runs: 0,
          items: 0,
          sources: 0,
          watermarks: 0,
          topic: false,
        };

        // 1. Delete run items first (foreign key constraint)
        await this.prisma.runItem.deleteMany({
          where: {
            run: {
              topicId: topic.id,
            },
          },
        });

        // 2. Delete runs
        const deletedRuns = await this.prisma.run.deleteMany({
          where: {
            topicId: topic.id,
          },
        });
        deleteCounts.runs = deletedRuns.count;

        // 3. Delete items
        const deletedItems = await this.prisma.item.deleteMany({
          where: {
            topicId: topic.id,
          },
        });
        deleteCounts.items = deletedItems.count;

        // 4. Get sources and delete their watermarks
        const sources = await this.prisma.source.findMany({
          where: {
            topicId: topic.id,
          },
          select: { id: true },
        });

        if (sources.length > 0) {
          const deletedWatermarks = await this.prisma.watermark.deleteMany({
            where: {
              sourceId: { in: sources.map(s => s.id) },
            },
          });
          deleteCounts.watermarks = deletedWatermarks.count;
        }

        // 5. Delete sources
        const deletedSources = await this.prisma.source.deleteMany({
          where: {
            topicId: topic.id,
          },
        });
        deleteCounts.sources = deletedSources.count;

        // 6. Delete the topic itself
        await this.prisma.topic.delete({
          where: { id: topic.id },
        });
        deleteCounts.topic = true;

        this.logger.log(`Cleaned topic ${topicSlug}: deleted ${deleteCounts.runs} runs, ${deleteCounts.items} items, ${deleteCounts.sources} sources, ${deleteCounts.watermarks} watermarks, and topic record`);

        return {
          deleted: deleteCounts,
          message: `Topic ${topicSlug} has been completely cleaned from the database`,
        };
      },
    );
  }

  async revertTopic(topicSlug: string, period: string): Promise<{ deleted: number; itemsDeleted?: number; message?: string }> {
    return await this.pgLockService.withLock(
      `revert-topic-${topicSlug}`,
      async () => {
        const topicConfig = this.configService.getTopic(topicSlug);
        if (!topicConfig) {
          throw new Error(`Topic configuration not found: ${topicSlug}`);
        }

        const topic = await this.prisma.topic.findUnique({
          where: { slug: topicSlug },
        });

        if (!topic) {
          throw new Error(`Topic not found in database: ${topicSlug}`);
        }

        // Parse period (e.g., "1d", "2h", "30m")
        const cutoffDate = this.parsePeriod(period);

        this.logger.log(`Reverting topic ${topicSlug} for period ${period} (since ${cutoffDate.toISOString()})`);

        // Delete runs and their items
        const runsToDelete = await this.prisma.run.findMany({
          where: {
            topicId: topic.id,
            createdAt: { gte: cutoffDate },
          },
          select: { id: true },
        });

        if (runsToDelete.length === 0) {
          return { deleted: 0, message: 'No runs found in the specified period' };
        }

        // Delete run items first (foreign key constraint)
        await this.prisma.runItem.deleteMany({
          where: {
            runId: { in: runsToDelete.map(r => r.id) },
          },
        });

        // Delete runs
        const deletedRuns = await this.prisma.run.deleteMany({
          where: {
            id: { in: runsToDelete.map(r => r.id) },
          },
        });

        // Delete items that were created in this period and are not referenced by other runs
        const deletedItems = await this.prisma.item.deleteMany({
          where: {
            topicId: topic.id,
            createdAt: { gte: cutoffDate },
            runItems: { none: {} }, // No run items reference this item
          },
        });

        // Reset watermarks so items can be refetched after revert
        const sources = await this.prisma.source.findMany({
          where: { topicId: topic.id },
          select: { id: true },
        });

        if (sources.length > 0) {
          await this.prisma.watermark.deleteMany({
            where: {
              sourceId: { in: sources.map(s => s.id) },
            },
          });
          this.logger.log(`Reset ${sources.length} source watermarks for topic ${topicSlug}`);
        }

        this.logger.log(`Reverted topic ${topicSlug}: deleted ${deletedRuns.count} runs and ${deletedItems.count} items`);

        return {
          deleted: deletedRuns.count,
          itemsDeleted: deletedItems.count,
        };
      },
    );
  }

  private async fetchFromSource(topicId: string, sourceConfig: SourceConfig, topicConfig: TopicConfig, force = false): Promise<ProcessedItem[]> {
    // Get or create source in database
    const source = await this.prisma.source.upsert({
      where: {
        topicId_name: {
          topicId,
          name: sourceConfig.name,
        },
      },
      update: {
        url: sourceConfig.url,
        type: sourceConfig.type,
        enabled: sourceConfig.enabled,
        meta: sourceConfig.meta as any,
      },
      create: {
        topicId,
        name: sourceConfig.name,
        type: sourceConfig.type,
        url: sourceConfig.url,
        enabled: sourceConfig.enabled,
        meta: sourceConfig.meta as any,
      },
    });

    // Get watermark for this source
    const watermark = await this.prisma.watermark.findUnique({
      where: {
        sourceId_type: {
          sourceId: source.id,
          type: 'timestamp',
        },
      },
    });

    // Create fetcher and fetch items
    const fetcher = this.fetcherFactory.createFetcher(source);
    let watermarkValue = force ? undefined : watermark?.value;
    
    // If no watermark exists (first run) or force is true, use lookback_days from topic config
    if (!watermarkValue || force) {
      const lookbackDays = topicConfig.lookbackDays || this.configService.global?.lookbackDays || 7;
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
      watermarkValue = lookbackDate.toISOString();
    }
    
    const result = await fetcher.fetchItems(source, watermarkValue);

    // Update watermark if we got one
    if (result.nextWatermark) {
      await this.prisma.watermark.upsert({
        where: {
          sourceId_type: {
            sourceId: source.id,
            type: 'timestamp',
          },
        },
        update: {
          value: result.nextWatermark,
        },
        create: {
          sourceId: source.id,
          type: 'timestamp',
          value: result.nextWatermark,
        },
      });
    }

    // Convert to ProcessedItem format
    return result.items.map(item => ({
      ...item,
      contentHash: this.deduplicationService.generateContentHash(item),
      simHash: this.deduplicationService.generateSimHash(item),
      sourceName: sourceConfig.name,
    }));
  }

  private async filterDuplicates(items: ProcessedItem[], topicId: string): Promise<ProcessedItem[]> {
    const uniqueItems: ProcessedItem[] = [];

    for (const item of items) {
      const duplicationResult = await this.deduplicationService.checkForDuplicates(item, topicId);
      if (!duplicationResult.isDuplicate) {
        uniqueItems.push(item);
      } else {
        this.logger.debug(`Filtered duplicate item: ${item.title}`);
      }
    }

    return uniqueItems;
  }

  private async saveItems(items: ProcessedItem[], topicId: string) {
    const savedItems = [];

    for (const item of items) {
      if (!item.sourceName) {
        this.logger.warn(`Item without source name skipped: ${item.title}`);
        continue;
      }

      // Find the source for this item using the source name
      const source = await this.prisma.source.findUnique({
        where: {
          topicId_name: {
            topicId,
            name: item.sourceName,
          },
        },
      });

      if (!source) {
        this.logger.warn(`Source not found: ${item.sourceName} for topic ${topicId}`);
        continue;
      }

      try {
        const savedItem = await this.prisma.item.upsert({
          where: {
            sourceId_contentHash: {
              sourceId: source.id,
              contentHash: item.contentHash,
            },
          },
          update: {
            title: item.title,
            content: item.content,
            url: item.url,
            publishedAt: item.publishedAt,
            simHash: item.simHash,
            metadata: item.metadata,
          },
          create: {
            sourceId: source.id,
            topicId,
            title: item.title,
            content: item.content,
            url: item.url,
            publishedAt: item.publishedAt,
            contentHash: item.contentHash,
            simHash: item.simHash,
            metadata: item.metadata,
          },
        });
        savedItems.push(savedItem);
      } catch (error) {
        if (error.code === 'P2002') {
          // Handle unique constraint violation gracefully
          this.logger.debug(`Duplicate item skipped (unique constraint): ${item.title}`);
          // Try to find the existing item
          const existingItem = await this.prisma.item.findFirst({
            where: {
              topicId,
              title: item.title,
            },
          });
          if (existingItem) {
            savedItems.push(existingItem);
          }
        } else {
          throw error;
        }
      }
    }

    return savedItems;
  }

  private async createRunItems(runId: string, items: { id: string }[]) {
    if (items.length === 0) return;

    // Remove duplicate items by ID
    const uniqueItems = items.filter((item, index, arr) => 
      arr.findIndex(i => i.id === item.id) === index
    );

    this.logger.debug(`Creating run items: ${uniqueItems.length} unique items out of ${items.length} total`);

    // Use createMany with skipDuplicates to handle any remaining duplicates
    await this.prisma.runItem.createMany({
      data: uniqueItems.map(item => ({
        runId,
        itemId: item.id,
      })),
      skipDuplicates: true,
    });
  }

  private async getOrCreateTopic(topicConfig: TopicConfig) {
    return await this.prisma.topic.upsert({
      where: { slug: topicConfig.slug },
      update: {
        name: topicConfig.name,
        enabled: topicConfig.enabled,
        assistantId: topicConfig.assistantId,
        config: topicConfig as any,
        lookbackDays: topicConfig.lookbackDays || this.configService.global.lookbackDays,
      },
      create: {
        slug: topicConfig.slug,
        name: topicConfig.name,
        enabled: topicConfig.enabled,
        assistantId: topicConfig.assistantId,
        config: topicConfig as any,
        lookbackDays: topicConfig.lookbackDays || this.configService.global.lookbackDays,
      },
    });
  }

  private parsePeriod(period: string): Date {
    const match = period.match(/^(\d+)([dhm])$/);
    if (!match) {
      throw new Error(`Invalid period format: ${period}. Expected format: number followed by d/h/m`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case 'd':
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'h':
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() - value * 60 * 1000);
      default:
        throw new Error(`Invalid period unit: ${unit}`);
    }
  }

  private getTimeRange(items: ProcessedItem[]): string {
    if (items.length === 0) return 'No items';

    const dates = items
      .map(item => item.publishedAt)
      .filter(date => date !== null && date !== undefined)
      .sort((a, b) => a!.getTime() - b!.getTime());

    if (dates.length === 0) return 'No dates available';

    const oldest = dates[0]!;
    const newest = dates[dates.length - 1]!;

    if (oldest.toDateString() === newest.toDateString()) {
      return oldest.toDateString();
    }

    return `${oldest.toDateString()} - ${newest.toDateString()}`;
  }
}