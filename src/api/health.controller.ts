import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '@/database/prisma.service';
import { ConfigService } from '@/config/config.service';
import { SchedulerService } from '@/scheduler/scheduler.service';
import { HealthResponse } from '@/shared/types';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly schedulerService: SchedulerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get service health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
    type: Object,
  })
  async getHealth(): Promise<HealthResponse> {
    const databaseConnected = await this.prisma.healthCheck();
    const topicsCount = this.configService.getAllTopics().length;
    const schedulerRunning = this.schedulerService.isRunning();

    return {
      status: databaseConnected ? 'healthy' : 'unhealthy',
      scheduler_running: schedulerRunning,
      database_connected: databaseConnected,
      topics_count: topicsCount,
      timestamp: new Date(),
    };
  }
}