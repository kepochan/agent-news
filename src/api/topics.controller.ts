import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Delete,
  Param, 
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@/config/config.service';
import { PrismaService } from '@/database/prisma.service';
import { TaskService } from '@/scheduler/task.service';
import { QueueService } from '@/scheduler/queue.service';
import { NewsService } from '@/scheduler/news.service';
import { ApiKeyGuard } from '@/auth/api-key.guard';
import { ProcessTopicDto, RevertTopicDto, CleanTopicDto } from '@/shared/dtos';
import { TopicStatusResponse } from '@/shared/types';

@ApiTags('Topics')
@Controller('topics')
export class TopicsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly queueService: QueueService,
    private readonly newsService: NewsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all topics' })
  @ApiResponse({
    status: 200,
    description: 'Topics retrieved successfully',
    type: [Object],
  })
  async getTopics(): Promise<TopicStatusResponse[]> {
    const topics = this.configService.getAllTopics();
    const topicStatuses: TopicStatusResponse[] = [];

    for (const topicConfig of topics) {
      const dbTopic = await this.prisma.topic.findUnique({
        where: { slug: topicConfig.slug },
        include: {
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              sources: { where: { enabled: true } },
              runs: true,
            },
          },
        },
      });

      const lastRun = dbTopic?.runs[0];
      
      topicStatuses.push({
        slug: topicConfig.slug,
        name: topicConfig.name,
        enabled: topicConfig.enabled,
        last_run: lastRun?.completedAt || undefined,
        next_run: this.getNextRunTime(topicConfig), // This would need scheduler integration
        items_count: await this.getItemsCount(topicConfig.slug),
        runs_count: dbTopic?._count.runs || 0,
      });
    }

    return topicStatuses;
  }

  @Post()
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new topic' })
  @ApiBody({
    description: 'Topic configuration',
    schema: {
      type: 'object',
      required: ['name', 'slug', 'sources'],
      properties: {
        name: { type: 'string', description: 'Topic name' },
        slug: { type: 'string', pattern: '^[a-z0-9-]+$', description: 'Topic slug' },
        enabled: { type: 'boolean', default: true },
        assistantId: { type: 'string', nullable: true, description: 'OpenAI Assistant ID' },
        lookbackDays: { type: 'number', default: 7 },
        includeKeywords: { type: 'array', items: { type: 'string' } },
        excludeKeywords: { type: 'array', items: { type: 'string' } },
        schedule: {
          type: 'object',
          properties: {
            cron: { type: 'string' },
            timezone: { type: 'string', default: 'Europe/Paris' }
          }
        },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'type', 'url'],
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['rss', 'github', 'discord', 'content_monitor'] },
              url: { type: 'string' },
              enabled: { type: 'boolean', default: true },
              meta: { type: 'object' }
            }
          }
        },
        channels: {
          type: 'object',
          properties: {
            slack: {
              type: 'object',
              properties: {
                channels: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Topic created successfully',
    type: Object,
  })
  @ApiResponse({ status: 400, description: 'Invalid topic configuration' })
  @ApiResponse({ status: 409, description: 'Topic with this slug already exists' })
  async createTopic(@Body() body: any) {
    const fs = require('fs/promises');
    const path = require('path');

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      throw new BadRequestException('Slug must contain only lowercase letters, numbers, and hyphens');
    }

    // Check if topic already exists
    const topicConfig = this.configService.getTopic(body.slug);
    if (topicConfig) {
      throw new BadRequestException(`Topic with slug '${body.slug}' already exists`);
    }

    // Build topic configuration
    const newTopicConfig = {
      name: body.name,
      slug: body.slug,
      enabled: body.enabled !== undefined ? body.enabled : true,
      ...(body.assistantId && { assistant_id: body.assistantId }),
      ...(body.schedule && { schedule: body.schedule }),
      ...(body.lookbackDays && { lookback_days: body.lookbackDays }),
      ...(body.includeKeywords && { include_keywords: body.includeKeywords }),
      ...(body.excludeKeywords && { exclude_keywords: body.excludeKeywords }),
      sources: body.sources || [],
      channels: body.channels || { slack: { channels: [] } }
    };

    // Save to file
    const topicsDir = path.join(process.cwd(), 'config', 'topics');
    const filePath = path.join(topicsDir, `${body.slug}.json`);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(newTopicConfig, null, 2));
      
      // Reload configurations
      await this.configService.reloadConfigurations();
      
      // Create database record
      const dbTopic = await this.prisma.topic.create({
        data: {
          name: body.name,
          slug: body.slug,
          enabled: body.enabled !== undefined ? body.enabled : true,
          assistantId: body.assistantId || null,
          config: newTopicConfig,
          lookbackDays: body.lookbackDays || 7,
        },
      });

      // Create sources
      if (body.sources && body.sources.length > 0) {
        await this.prisma.source.createMany({
          data: body.sources.map((source: any) => ({
            topicId: dbTopic.id,
            name: source.name,
            type: source.type,
            url: source.url,
            enabled: source.enabled !== undefined ? source.enabled : true,
            meta: source.meta || {},
          })),
        });
      }

      return {
        message: `Topic '${body.name}' created successfully`,
        slug: body.slug,
        id: dbTopic.id,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create topic: ${error.message}`);
    }
  }

  @Put(':slug')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update existing topic' })
  @ApiParam({ name: 'slug', description: 'Topic slug' })
  @ApiResponse({
    status: 200,
    description: 'Topic updated successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  @ApiResponse({ status: 400, description: 'Invalid topic configuration' })
  async updateTopic(@Param('slug') slug: string, @Body() body: any) {
    const fs = require('fs/promises');
    const path = require('path');

    // Check if topic exists
    const topicConfig = this.configService.getTopic(slug);
    if (!topicConfig) {
      throw new NotFoundException(`Topic not found: ${slug}`);
    }

    // Build updated topic configuration
    const updatedTopicConfig = {
      name: body.name,
      slug: body.slug,
      enabled: body.enabled !== undefined ? body.enabled : true,
      ...(body.assistantId && { assistantId: body.assistantId }),
      ...(body.schedule && { schedule: body.schedule }),
      ...(body.lookbackDays && { lookbackDays: body.lookbackDays }),
      ...(body.includeKeywords && { includeKeywords: body.includeKeywords }),
      ...(body.excludeKeywords && { excludeKeywords: body.excludeKeywords }),
      sources: body.sources || [],
      channels: body.channels || { slack: { channels: [] } }
    };

    // Save to file
    const topicsDir = path.join(process.cwd(), 'config', 'topics');
    const filePath = path.join(topicsDir, `${slug}.json`);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(updatedTopicConfig, null, 2));
      
      // Reload configurations
      await this.configService.reloadConfigurations();
      
      // Update database record
      const dbTopic = await this.prisma.topic.update({
        where: { slug },
        data: {
          name: body.name,
          enabled: body.enabled !== undefined ? body.enabled : true,
          assistantId: body.assistantId || null,
          config: updatedTopicConfig,
          lookbackDays: body.lookbackDays || 7,
        },
      });

      // Update sources - delete existing and create new ones
      await this.prisma.source.deleteMany({
        where: { topicId: dbTopic.id }
      });

      if (body.sources && body.sources.length > 0) {
        await this.prisma.source.createMany({
          data: body.sources.map((source: any) => ({
            topicId: dbTopic.id,
            name: source.name,
            type: source.type,
            url: source.url,
            enabled: source.enabled !== undefined ? source.enabled : true,
            meta: source.meta || {},
          })),
        });
      }

      return {
        message: `Topic '${body.name}' updated successfully`,
        slug: body.slug,
        id: dbTopic.id,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update topic: ${error.message}`);
    }
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get specific topic details' })
  @ApiParam({ name: 'slug', description: 'Topic slug' })
  @ApiResponse({
    status: 200,
    description: 'Topic details retrieved successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopic(@Param('slug') slug: string): Promise<TopicStatusResponse> {
    const topicConfig = this.configService.getTopic(slug);
    if (!topicConfig) {
      throw new NotFoundException(`Topic not found: ${slug}`);
    }

    const dbTopic = await this.prisma.topic.findUnique({
      where: { slug },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        sources: true,
        _count: {
          select: {
            sources: { where: { enabled: true } },
            runs: true,
          },
        },
      },
    });

    const lastRun = dbTopic?.runs[0];

    // Return the complete topic configuration for editing
    return {
      ...topicConfig,
      last_run: lastRun?.completedAt || undefined,
      next_run: this.getNextRunTime(topicConfig),
      items_count: await this.getItemsCount(slug),
      runs_count: dbTopic?._count.runs || 0,
      sources: topicConfig.sources || [],
      channels: topicConfig.channels || { slack: { channels: [] } },
      assistantId: topicConfig.assistantId || undefined,
    };
  }

  @Delete(':slug')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete topic' })
  @ApiParam({ name: 'slug', description: 'Topic slug' })
  @ApiResponse({
    status: 200,
    description: 'Topic deleted successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async deleteTopic(@Param('slug') slug: string) {
    const fs = require('fs/promises');
    const path = require('path');

    // Check if topic exists
    const topicConfig = this.configService.getTopic(slug);
    if (!topicConfig) {
      throw new NotFoundException(`Topic not found: ${slug}`);
    }

    try {
      // Delete the configuration file
      const topicsDir = path.join(process.cwd(), 'config', 'topics');
      const filePath = path.join(topicsDir, `${slug}.json`);
      await fs.unlink(filePath);
      
      // Reload configurations
      await this.configService.reloadConfigurations();
      
      // Delete from database (this will cascade delete runs, sources, etc.)
      const dbTopic = await this.prisma.topic.findUnique({
        where: { slug },
      });

      if (dbTopic) {
        await this.prisma.topic.delete({
          where: { slug },
        });
      }

      return {
        message: `Topic '${slug}' deleted successfully`,
        slug: slug,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to delete topic: ${error.message}`);
    }
  }

  @Post(':slug/process')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger topic processing' })
  @ApiParam({ name: 'slug', description: 'Topic slug' })
  @ApiBody({ 
    description: 'Processing options',
    schema: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: 'Force processing even if recently processed',
          default: false
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Processing job queued successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async processTopic(
    @Param('slug') slug: string,
    @Body() body: ProcessTopicDto,
  ) {
    const topicConfig = this.configService.getTopic(slug);
    if (!topicConfig) {
      throw new NotFoundException(`Topic not found: ${slug}`);
    }

    if (!topicConfig.enabled) {
      throw new BadRequestException(`Topic is disabled: ${slug}`);
    }

    // Create task
    const task = await this.taskService.createTask(
      'process',
      { topic_slug: slug, force: body.force || false },
      'api',
      undefined, // topicId will be resolved in the processor
    );

    // Queue job
    try {
      const job = await this.queueService.addProcessTopicJob(
        task.id,
        slug,
        body.force || false,
      );

      return {
        task_id: task.id,
        job_id: job.id,
        message: `Processing queued for topic: ${slug}`,
      };
    } catch (error) {
      // Update task as failed if we can't queue it
      await this.taskService.updateTaskStatus(
        task.id,
        'failed',
        null,
        error instanceof Error ? error.message : 'Failed to queue job',
      );
      throw error;
    }
  }

  @Post(':slug/revert')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revert topic data for a specific period' })
  @ApiParam({ name: 'slug', description: 'Topic slug' })
  @ApiResponse({
    status: 200,
    description: 'Revert job queued successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async revertTopic(
    @Param('slug') slug: string,
    @Body() body: RevertTopicDto,
  ) {
    const topicConfig = this.configService.getTopic(slug);
    if (!topicConfig) {
      throw new NotFoundException(`Topic not found: ${slug}`);
    }

    // Create task
    const task = await this.taskService.createTask(
      'revert',
      { topic_slug: slug, period: body.period },
      'api',
      undefined,
    );

    // Queue job
    try {
      const job = await this.queueService.addRevertTopicJob(
        task.id,
        slug,
        body.period,
      );

      return {
        task_id: task.id,
        job_id: job.id,
        message: `Revert queued for topic: ${slug} (period: ${body.period})`,
      };
    } catch (error) {
      await this.taskService.updateTaskStatus(
        task.id,
        'failed',
        null,
        error instanceof Error ? error.message : 'Failed to queue job',
      );
      throw error;
    }
  }

  @Post(':slug/clean')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Completely clean a topic',
    description: 'WARNING: This will permanently delete ALL data related to the topic including runs, items, sources, watermarks, and the topic record itself. This action cannot be undone.'
  })
  @ApiParam({ name: 'slug', description: 'Topic slug' })
  @ApiBody({ 
    description: 'Clean confirmation',
    schema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be set to true to confirm the destructive operation',
          default: false
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Topic cleaned successfully',
    schema: {
      type: 'object',
      properties: {
        deleted: {
          type: 'object',
          properties: {
            runs: { type: 'number' },
            items: { type: 'number' },
            sources: { type: 'number' },
            watermarks: { type: 'number' },
            topic: { type: 'boolean' }
          }
        },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Confirmation required or topic not found' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async cleanTopic(
    @Param('slug') slug: string,
    @Body() body: CleanTopicDto,
  ) {
    if (!body.confirm) {
      throw new BadRequestException(
        'This operation will permanently delete ALL data for this topic. Set "confirm" to true to proceed.'
      );
    }

    const topicConfig = this.configService.getTopic(slug);
    if (!topicConfig) {
      throw new NotFoundException(`Topic not found: ${slug}`);
    }

    try {
      const result = await this.newsService.cleanTopic(slug);
      return result;
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  private async getItemsCount(slug: string): Promise<number> {
    const dbTopic = await this.prisma.topic.findUnique({
      where: { slug },
      select: {
        id: true,
        _count: {
          select: {
            sources: {
              where: { enabled: true },
            },
          },
        },
      },
    });

    if (!dbTopic) return 0;

    // Get total items across all sources for this topic
    const result = await this.prisma.item.count({
      where: {
        topicId: dbTopic.id,
      },
    });

    return result;
  }

  private getNextRunTime(_topicConfig: any): Date | undefined {
    // This would need integration with the scheduler to get the actual next run time
    // For now, return undefined
    return undefined;
  }
}