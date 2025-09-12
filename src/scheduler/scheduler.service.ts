import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@/config/config.service';
import { TopicConfig } from '@/config/config.schema';
import { QueueService } from './queue.service';
import { TaskService } from './task.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly scheduledJobs = new Map<string, CronJob>();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly taskService: TaskService,
  ) {}

  async onModuleInit() {
    await this.initializeSchedules();
    this.logger.log('Scheduler service initialized');
  }

  async onModuleDestroy() {
    this.stopAllSchedules();
    this.logger.log('Scheduler service destroyed');
  }

  private async initializeSchedules() {
    const enabledTopics = this.configService.getEnabledTopics();
    
    for (const topic of enabledTopics) {
      try {
        this.scheduleTopicProcessing(topic);
      } catch (error) {
        this.logger.error(`Failed to schedule topic ${topic.slug}:`, error);
      }
    }

    // Schedule cleanup tasks
    this.scheduleCleanupTasks();
  }

  private scheduleTopicProcessing(topicConfig: TopicConfig) {
    const schedule = topicConfig.schedule || this.configService.global.defaultSchedule;
    
    if (!schedule?.cron) {
      this.logger.warn(`No schedule configured for topic: ${topicConfig.slug}`);
      return;
    }

    const timezone = schedule.timezone || this.configService.timezone;
    const jobName = `topic-${topicConfig.slug}`;

    try {
      const job = new CronJob(
        schedule.cron,
        async () => {
          await this.executeScheduledTopicProcessing(topicConfig.slug);
        },
        null,
        false, // Don't start immediately
        timezone,
      );

      this.schedulerRegistry.addCronJob(jobName, job);
      this.scheduledJobs.set(jobName, job);
      
      job.start();
      
      this.logger.log(
        `Scheduled topic ${topicConfig.slug} with cron "${schedule.cron}" in timezone ${timezone}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create schedule for topic ${topicConfig.slug}:`, error);
    }
  }

  private async executeScheduledTopicProcessing(topicSlug: string) {
    try {
      this.logger.log(`Executing scheduled processing for topic: ${topicSlug}`);
      
      // Create a task for this scheduled execution
      const task = await this.taskService.createTask(
        'process',
        { topic_slug: topicSlug, force: false },
        'scheduler',
      );

      // Add job to queue
      await this.queueService.addProcessTopicJob(task.id, topicSlug, false);
      
      this.logger.log(`Queued scheduled processing for topic: ${topicSlug}`);
    } catch (error) {
      this.logger.error(`Failed to execute scheduled processing for topic ${topicSlug}:`, error);
    }
  }

  private scheduleCleanupTasks() {
    // Schedule daily cleanup at 2 AM
    const cleanupJob = new CronJob(
      '0 2 * * *', // Daily at 2 AM
      async () => {
        await this.executeCleanupTasks();
      },
      null,
      false,
      this.configService.timezone,
    );

    this.schedulerRegistry.addCronJob('cleanup-tasks', cleanupJob);
    this.scheduledJobs.set('cleanup-tasks', cleanupJob);
    cleanupJob.start();

    this.logger.log('Scheduled daily cleanup tasks');
  }

  private async executeCleanupTasks() {
    try {
      this.logger.log('Executing cleanup tasks');

      // Clean up old tasks
      await this.taskService.cleanupOldTasks(7);

      // Clean up old queue jobs
      await this.queueService.cleanQueue();

      // Clean up old deduplication hashes
      const topics = this.configService.getAllTopics();
      for (const topic of topics) {
        // This would need to be implemented in DeduplicationService
        // await this.deduplicationService.cleanupOldHashes(topic.slug);
      }

      this.logger.log('Completed cleanup tasks');
    } catch (error) {
      this.logger.error('Failed to execute cleanup tasks:', error);
    }
  }

  async refreshSchedules(): Promise<void> {
    this.logger.log('Refreshing all schedules...');
    
    this.stopAllSchedules();
    await this.initializeSchedules();
    
    this.logger.log('All schedules refreshed');
  }

  private stopAllSchedules() {
    for (const [jobName, job] of this.scheduledJobs) {
      try {
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.debug(`Stopped schedule: ${jobName}`);
      } catch (error) {
        this.logger.warn(`Failed to stop schedule ${jobName}:`, error);
      }
    }
    this.scheduledJobs.clear();
  }

  getScheduleInfo(): Array<{
    name: string;
    cron: string;
    running: boolean;
    lastDate?: Date | null;
    nextDate?: Date;
  }> {
    const schedules = [];

    for (const [jobName, job] of this.scheduledJobs) {
      schedules.push({
        name: jobName,
        cron: typeof job.cronTime.source === 'string' ? job.cronTime.source : job.cronTime.source.toString(),
        running: job.running,
        lastDate: job.lastDate(),
        nextDate: job.nextDate()?.toJSDate(),
      });
    }

    return schedules;
  }

  isRunning(): boolean {
    return this.scheduledJobs.size > 0;
  }
}