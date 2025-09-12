import { Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { DatabaseModule } from '@/database/database.module';
import { ApiModule } from '@/api/api.module';
import { SchedulerModule } from '@/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ApiModule,
    SchedulerModule,
  ],
})
export class AppModule {}