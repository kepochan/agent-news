import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class SSEService {
  private connections = new Set<Response>();

  constructor(private readonly prisma: PrismaService) {}

  // Add a connection to the pool
  addConnection(res: Response) {
    this.connections.add(res);
    
    res.on('close', () => {
      this.connections.delete(res);
    });
  }

  // Broadcast events to all connected clients
  broadcast(event: string, data: any, topicSlug?: string) {
    const message = `event: ${event}\ndata: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}\n\n`;
    
    this.connections.forEach(res => {
      try {
        // If topicSlug is specified, only send to connections interested in this topic
        // For now, we'll send to all connections and let the client filter
        res.write(message);
      } catch (error) {
        // Remove broken connections
        this.connections.delete(res);
      }
    });
  }

  // Send topic stats updates
  async broadcastTopicStats(topicSlug?: string) {
    try {
      const whereClause = topicSlug ? { slug: topicSlug } : {};
      
      const topics = await this.prisma.topic.findMany({
        where: whereClause,
        include: {
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              runs: true,
            },
          },
        },
      });

      const topicsWithCounts = [];
      for (const topic of topics) {
        // Get items count separately
        const itemsCount = await this.prisma.item.count({
          where: {
            topicId: topic.id,
          },
        });

        topicsWithCounts.push({
          slug: topic.slug,
          name: topic.name,
          enabled: topic.enabled,
          items_count: itemsCount,
          runs_count: topic._count.runs,
          last_run: topic.runs[0]?.createdAt,
          last_run_status: topic.runs[0]?.status
        });
      }

      this.broadcast('topic-stats', {
        type: 'topic-stats',
        topics: topicsWithCounts
      });
    } catch (error) {
      console.error('Error broadcasting topic stats:', error);
    }
  }

  // Send run status updates
  broadcastRunUpdate(runId: string, status: string, topicSlug: string, data: any = {}) {
    this.broadcast('run-update', {
      type: 'run-update',
      runId,
      status,
      topicSlug,
      ...data
    });
  }

  // Send new run notifications
  broadcastNewRun(run: any) {
    this.broadcast('new-run', {
      type: 'new-run',
      run: {
        id: run.id,
        topicSlug: run.topic.slug,
        topicName: run.topic.name,
        status: run.status,
        createdAt: run.createdAt
      }
    });
  }
}