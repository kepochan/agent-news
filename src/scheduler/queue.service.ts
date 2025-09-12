import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { TaskService } from './task.service';
import { TaskType } from '@/shared/types';

export interface NewsProcessingJob {
  taskId: string;
  taskType: TaskType;
  topicSlug?: string;
  params: Record<string, any>;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('news-processing') private readonly newsQueue: Queue,
    private readonly taskService: TaskService,
  ) {}

  async onModuleInit() {
    this.logger.log('Queue service initialized');
  }

  async onModuleDestroy() {
    await this.newsQueue.close();
    this.logger.log('Queue service destroyed');
  }

  async addProcessTopicJob(
    taskId: string,
    topicSlug: string,
    force = false,
  ): Promise<Job<NewsProcessingJob>> {
    const jobData: NewsProcessingJob = {
      taskId,
      taskType: 'process',
      topicSlug,
      params: { topic_slug: topicSlug, force },
    };

    // Check if there's already a job for this topic
    const existingJobs = await this.newsQueue.getJobs(['waiting', 'active'], 0, 100);
    const duplicateJob = existingJobs.find(
      job => job.data.topicSlug === topicSlug && job.data.taskType === 'process'
    );

    if (duplicateJob && !force) {
      this.logger.warn(`Job already exists for topic ${topicSlug}, skipping`);
      throw new Error(`Processing job for topic "${topicSlug}" is already queued`);
    }

    const job = await this.newsQueue.add('process-topic', jobData, {
      delay: 0,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    });

    this.logger.log(`Added process job for topic ${topicSlug}: ${job.id}`);
    return job;
  }

  async addRevertTopicJob(
    taskId: string,
    topicSlug: string,
    period: string,
  ): Promise<Job<NewsProcessingJob>> {
    const jobData: NewsProcessingJob = {
      taskId,
      taskType: 'revert',
      topicSlug,
      params: { topic_slug: topicSlug, period },
    };

    const job = await this.newsQueue.add('revert-topic', jobData, {
      delay: 0,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    });

    this.logger.log(`Added revert job for topic ${topicSlug}: ${job.id}`);
    return job;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.newsQueue.getWaiting(),
      this.newsQueue.getActive(),
      this.newsQueue.getCompleted(),
      this.newsQueue.getFailed(),
      this.newsQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async getJob(jobId: string): Promise<Job<NewsProcessingJob> | null> {
    return await this.newsQueue.getJob(jobId);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled job: ${jobId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  async pauseQueue(): Promise<void> {
    await this.newsQueue.pause();
    this.logger.log('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.newsQueue.resume();
    this.logger.log('Queue resumed');
  }

  async cleanQueue(): Promise<void> {
    await this.newsQueue.clean(5000, 'completed');
    await this.newsQueue.clean(5000, 'failed');
    this.logger.log('Queue cleaned');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const stats = await this.getQueueStats();
      // Consider queue healthy if we can get stats and there are not too many failed jobs
      return stats.failed < 100;
    } catch {
      return false;
    }
  }
}