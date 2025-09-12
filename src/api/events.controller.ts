import { Controller, Get, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { SSEService } from './sse.service';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly sseService: SSEService) {}

  @Get('stream')
  @ApiOperation({ summary: 'Server-Sent Events stream for real-time updates' })
  @ApiQuery({ name: 'topic_slug', required: false, description: 'Filter events by topic slug' })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established',
  })
  async stream(@Res() res: Response, @Query('topic_slug') topicSlug?: string) {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    // Add connection to service
    this.sseService.addConnection(res);

    // Send initial data
    res.write('event: connected\n');
    res.write('data: {"type": "connected", "timestamp": "' + new Date().toISOString() + '"}\n\n');

    // Handle client disconnect
    res.on('close', () => {
      clearInterval(keepAlive);
    });

    // Send current topic stats if specified
    if (topicSlug) {
      await this.sseService.broadcastTopicStats(topicSlug);
    }
  }

  // Delegate methods to SSEService
  async broadcastTopicStats(topicSlug?: string) {
    return this.sseService.broadcastTopicStats(topicSlug);
  }

  broadcastRunUpdate(runId: string, status: string, topicSlug: string, data: any = {}) {
    return this.sseService.broadcastRunUpdate(runId, status, topicSlug, data);
  }

  broadcastNewRun(run: any) {
    return this.sseService.broadcastNewRun(run);
  }
}