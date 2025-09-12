import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ConfigService } from '@/config/config.service';
import { GlobalConfig } from '@/config/config.schema';
import { DeduplicationResult, ProcessedItem, FetchedItem } from '@/shared/types';
import * as crypto from 'crypto';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async checkForDuplicates(
    item: ProcessedItem,
    topicId: string,
  ): Promise<DeduplicationResult> {
    try {
      // Simple deduplication: check if same title exists for this topic
      const duplicate = await this.findTitleDuplicate(item.title, topicId);
      if (duplicate) {
        this.logger.debug(`Duplicate title found for item: ${item.title}`);
        return {
          isDuplicate: true,
          similarity: 1.0,
          duplicateId: duplicate.id,
        };
      }

      return {
        isDuplicate: false,
      };
    } catch (error) {
      this.logger.error('Error during deduplication check:', error);
      // In case of error, don't mark as duplicate to be safe
      return {
        isDuplicate: false,
      };
    }
  }

  generateContentHash(item: FetchedItem): string {
    // Simple hash based on title + url for uniqueness  
    const content = `${item.title || ''}|${item.url || ''}`;
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  generateSimHash(item: FetchedItem): string {
    // Simplified: just return the content hash since we don't use similarity anymore
    return this.generateContentHash(item);
  }

  private async findTitleDuplicate(title: string, topicId: string) {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - (this.configService.global?.deduplication?.lookbackDays || 30));

    return await this.prisma.item.findFirst({
      where: {
        topicId,
        title: title.trim(),
        createdAt: {
          gte: lookbackDate,
        },
      },
      select: {
        id: true,
        title: true,
      },
    });
  }

  async cleanupOldHashes(topicId?: string): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ((this.configService.global?.deduplication?.lookbackDays || 30) * 2));

    try {
      const where: any = {
        createdAt: {
          lt: cutoffDate,
        },
      };

      if (topicId) {
        where.topicId = topicId;
      }

      const result = await this.prisma.item.deleteMany({
        where,
      });

      this.logger.log(`Cleaned up ${result.count} old items for deduplication`);
    } catch (error) {
      this.logger.error('Error cleaning up old hashes:', error);
    }
  }
}