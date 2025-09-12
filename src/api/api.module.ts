import { Module, OnModuleInit } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@/config/config.service';
import { DatabaseModule } from '@/database/database.module';
import { AuthModule } from '@/auth/auth.module';
import { SchedulerModule } from '@/scheduler/scheduler.module';
import { setGlobalSSEBroadcast } from '@/scheduler/news-processing.processor';
import { RootController } from './root.controller';
import { HealthController } from './health.controller';
import { TopicsController } from './topics.controller';
import { RunsController } from './runs.controller';
import { TasksController } from './tasks.controller';
import { EventsController } from './events.controller';
import { SSEService } from './sse.service';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ([{
        ttl: 60000, // 1 minute in milliseconds
        limit: configService.apiRateLimit, // requests per minute
      }]),
    }),
    DatabaseModule,
    AuthModule,
    SchedulerModule,
  ],
  providers: [SSEService],
  controllers: [
    RootController,
    HealthController,
    TopicsController,
    RunsController,
    TasksController,
    EventsController,
  ],
})
export class ApiModule implements OnModuleInit {
  constructor(
    private readonly sseService: SSEService,
  ) {}

  onModuleInit() {
    // Configure global SSE broadcast callback
    setGlobalSSEBroadcast((event: string, data: any) => {
      this.sseService.broadcast(event, data);
    });
  }
}