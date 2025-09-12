import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NewsProcessingJob } from './queue.service';
import { TaskService } from './task.service';
import { NewsService } from './news.service';

// Global variable to store SSE callback
let globalSSEBroadcast: ((event: string, data: any) => void) | null = null;

export function setGlobalSSEBroadcast(callback: (event: string, data: any) => void) {
  globalSSEBroadcast = callback;
}

@Processor('news-processing')
export class NewsProcessingProcessor {
  private readonly logger = new Logger(NewsProcessingProcessor.name);

  constructor(
    private readonly taskService: TaskService,
    private readonly newsService: NewsService,
  ) {}

  @Process('process-topic')
  async handleProcessTopic(job: Job<NewsProcessingJob>) {
    const { taskId, topicSlug, params } = job.data;
    
    this.logger.log(`Processing topic: ${topicSlug} (task: ${taskId})`);
    
    try {
      await this.taskService.updateTaskStatus(taskId, 'running');
      
      // Emit SSE event for run started
      if (globalSSEBroadcast && topicSlug) {
        globalSSEBroadcast('run-update', {
          type: 'run-update',
          runId: taskId,
          status: 'running',
          topicSlug,
          startedAt: new Date().toISOString()
        });
      }
      
      const result = await this.newsService.processTopic(
        topicSlug!,
        params.force || false,
      );
      
      await this.taskService.updateTaskStatus(taskId, 'completed', result);
      
      // Emit SSE event for run completed
      if (globalSSEBroadcast && topicSlug) {
        globalSSEBroadcast('run-update', {
          type: 'run-update',
          runId: taskId,
          status: 'completed',
          topicSlug,
          completedAt: new Date().toISOString(),
          result
        });
      }
      
      this.logger.log(`Completed processing topic: ${topicSlug}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process topic ${topicSlug}:`, error);
      
      await this.taskService.updateTaskStatus(taskId, 'failed', null, errorMessage);
      
      // Emit SSE event for run failed
      if (globalSSEBroadcast && topicSlug) {
        globalSSEBroadcast('run-update', {
          type: 'run-update',
          runId: taskId,
          status: 'failed',
          topicSlug,
          completedAt: new Date().toISOString(),
          error: errorMessage
        });
      }
      
      throw error;
    }
  }

  @Process('revert-topic')
  async handleRevertTopic(job: Job<NewsProcessingJob>) {
    const { taskId, topicSlug, params } = job.data;
    
    this.logger.log(`Reverting topic: ${topicSlug} for period: ${params.period} (task: ${taskId})`);
    
    try {
      await this.taskService.updateTaskStatus(taskId, 'running');
      
      const result = await this.newsService.revertTopic(
        topicSlug!,
        params.period,
      );
      
      await this.taskService.updateTaskStatus(taskId, 'completed', result);
      
      this.logger.log(`Completed reverting topic: ${topicSlug}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to revert topic ${topicSlug}:`, error);
      
      await this.taskService.updateTaskStatus(taskId, 'failed', null, errorMessage);
      throw error;
    }
  }
}