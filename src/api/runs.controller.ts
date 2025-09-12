import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '@/database/prisma.service';

@ApiTags('Runs')
@Controller('runs')
export class RunsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List runs with optional filtering' })
  @ApiQuery({ name: 'topic_slug', required: false, description: 'Filter by topic slug' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by run status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of runs to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of runs to skip (default: 0)' })
  @ApiResponse({
    status: 200,
    description: 'Runs retrieved successfully',
    type: [Object],
  })
  async getRuns(
    @Query('topic_slug') topicSlug?: string,
    @Query('status') status?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const where: any = {};

    if (topicSlug) {
      where.topic = {
        slug: topicSlug,
      };
    }

    if (status) {
      where.status = status;
    }

    const runs = await this.prisma.run.findMany({
      where,
      include: {
        topic: {
          select: {
            slug: true,
            name: true,
          },
        },
        _count: {
          select: {
            runItems: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    });

    return runs.map(run => ({
      id: run.id,
      topic_slug: run.topic.slug,
      topic_name: run.topic.name,
      status: run.status,
      items_count: run._count.runItems,
      created_at: run.createdAt,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      error: run.error,
      metadata: run.metadata,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific run details' })
  @ApiParam({ name: 'id', description: 'Run ID' })
  @ApiResponse({
    status: 200,
    description: 'Run details retrieved successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Run not found' })
  async getRun(@Param('id') id: string) {
    const run = await this.prisma.run.findUnique({
      where: { id },
      include: {
        topic: {
          select: {
            slug: true,
            name: true,
          },
        },
        runItems: {
          include: {
            item: {
              select: {
                id: true,
                title: true,
                url: true,
                publishedAt: true,
                source: {
                  select: {
                    name: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new Error(`Run not found: ${id}`);
    }

    return {
      id: run.id,
      topic_slug: run.topic.slug,
      topic_name: run.topic.name,
      status: run.status,
      created_at: run.createdAt,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      error: run.error,
      metadata: run.metadata,
      items: run.runItems.map(runItem => ({
        id: runItem.item.id,
        title: runItem.item.title,
        url: runItem.item.url,
        published_at: runItem.item.publishedAt,
        source_name: runItem.item.source.name,
        source_type: runItem.item.source.type,
        processed: runItem.processed,
        summary: runItem.summary,
        slack_message_id: runItem.slackMessageId,
        error: runItem.error,
      })),
      openai_prompt: run.metadata && typeof run.metadata === 'object' && 'openaiPrompt' in run.metadata 
        ? (run.metadata as any).openaiPrompt 
        : (run.openaiPrompt || null),
      openai_response: run.openaiResponse,
      logs: run.logs,
      openai_summary: run.metadata && typeof run.metadata === 'object' && 'openaiSummary' in run.metadata 
        ? (run.metadata as any).openaiSummary 
        : null,
    };
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get OpenAI summary for a specific run' })
  @ApiParam({ name: 'id', description: 'Run ID' })
  @ApiResponse({
    status: 200,
    description: 'OpenAI summary retrieved successfully',
    schema: {
      properties: {
        summary: { type: 'string', description: 'The OpenAI generated summary' },
        run_id: { type: 'string', description: 'The run ID' },
        topic: { type: 'string', description: 'Topic name' },
        created_at: { type: 'string', description: 'Summary creation date' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Run or summary not found' })
  async getRunSummary(@Param('id') id: string) {
    const run = await this.prisma.run.findUnique({
      where: { id },
      include: {
        topic: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!run) {
      throw new Error(`Run not found: ${id}`);
    }

    const openaiSummary = run.metadata && typeof run.metadata === 'object' && 'openaiSummary' in run.metadata 
      ? (run.metadata as any).openaiSummary 
      : null;

    if (!openaiSummary) {
      throw new Error(`No OpenAI summary found for run: ${id}`);
    }

    return {
      summary: openaiSummary,
      run_id: run.id,
      topic: run.topic.name,
      created_at: run.completedAt || run.createdAt,
    };
  }
}