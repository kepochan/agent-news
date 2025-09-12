import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigService } from '@/config/config.service';
import { AuthModule } from '@/auth/auth.module';
import { SchedulerModule } from '@/scheduler/scheduler.module';
import { RootController } from './root.controller';
import { HealthController } from './health.controller';
import { TopicsController } from './topics.controller';
import { RunsController } from './runs.controller';
import { TasksController } from './tasks.controller';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ([{
        ttl: 60000, // 1 minute in milliseconds
        limit: configService.apiRateLimit, // requests per minute
      }]),
    }),
    AuthModule,
    SchedulerModule,
  ],
  controllers: [
    RootController,
    HealthController,
    TopicsController,
    RunsController,
    TasksController,
  ],
})
export class ApiModule {}