import { Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';
import { DatabaseModule } from '@/database/database.module';
import { SchedulerModule } from '@/scheduler/scheduler.module';
import { NewsCommand } from './commands/news.command';
import { MigrateCommand } from './commands/migrate.command';
import { InitDbCommand } from './commands/init-db.command';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    SchedulerModule,
  ],
  providers: [
    NewsCommand,
    MigrateCommand,
    InitDbCommand,
  ],
})
export class CliModule {}