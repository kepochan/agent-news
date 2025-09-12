import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@/config/config.service';
import { FetchersModule } from '@/fetchers/fetchers.module';
import { ProcessorsModule } from '@/processors/processors.module';
import { UtilsModule } from '@/utils/utils.module';
import { TaskService } from './task.service';
import { QueueService } from './queue.service';
import { NewsService } from './news.service';
import { SchedulerService } from './scheduler.service';
import { NewsProcessingProcessor } from './news-processing.processor';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: new URL(configService.redisUrl).hostname,
          port: parseInt(new URL(configService.redisUrl).port) || 6379,
          password: new URL(configService.redisUrl).password || undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'news-processing',
    }),
    FetchersModule,
    ProcessorsModule,
    UtilsModule,
  ],
  providers: [
    TaskService,
    QueueService,
    NewsService,
    SchedulerService,
    NewsProcessingProcessor,
  ],
  exports: [
    TaskService,
    QueueService,
    NewsService,
    SchedulerService,
  ],
})
export class SchedulerModule {}