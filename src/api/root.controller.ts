import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { ServiceInfoResponse } from '@/shared/types';

@ApiTags('Service Info')
@Controller()
export class RootController {
  @Get()
  @ApiOperation({ summary: 'Get service information and available endpoints' })
  @ApiResponse({
    status: 200,
    description: 'Service information retrieved successfully',
    type: Object,
  })
  async getServiceInfo(@Req() request: Request): Promise<ServiceInfoResponse> {
    const baseUrl = `${request.protocol}://${request.get('host')}`;

    return {
      service: 'News Agent TypeScript',
      version: '1.0.0',
      description: 'Automated news monitoring and processing service built with NestJS',
      links: {
        health: `${baseUrl}/health`,
        docs: `${baseUrl}/api`,
        topics: `${baseUrl}/topics`,
        runs: `${baseUrl}/runs`,
        tasks: `${baseUrl}/tasks`,
      },
    };
  }
}