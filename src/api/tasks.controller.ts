import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TaskService } from '@/scheduler/task.service';
import { QueueService } from '@/scheduler/queue.service';
import { ApiKeyGuard } from '@/auth/api-key.guard';
import { TaskResponse } from '@/shared/types';

@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly taskService: TaskService,
    private readonly queueService: QueueService,
  ) {}

  @Get()
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List tasks with optional filtering' })
  @ApiQuery({ name: 'topic_slug', required: false, description: 'Filter by topic slug' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by task status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of tasks to return (default: 50)' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
    type: [Object],
  })
  async getTasks(
    @Query('topic_slug') topicSlug?: string,
    @Query('status') status?: any,
    @Query('limit') limit = '50',
  ): Promise<TaskResponse[]> {
    return await this.taskService.getTasks(
      topicSlug,
      status,
      parseInt(limit, 10),
    );
  }

  @Get('stats')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({
    status: 200,
    description: 'Task statistics retrieved successfully',
    type: Object,
  })
  async getTaskStats() {
    const [taskStats, queueStats] = await Promise.all([
      this.taskService.getTaskStats(),
      this.queueService.getQueueStats(),
    ]);

    return {
      tasks: taskStats,
      queue: queueStats,
    };
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get specific task details' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task details retrieved successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTask(@Param('id') id: string): Promise<TaskResponse> {
    const task = await this.taskService.getTask(id);
    if (!task) {
      throw new NotFoundException(`Task not found: ${id}`);
    }
    return task;
  }

  @Delete(':id')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel/delete a task' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task cancelled successfully',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async cancelTask(@Param('id') id: string) {
    const task = await this.taskService.getTask(id);
    if (!task) {
      throw new NotFoundException(`Task not found: ${id}`);
    }

    // If task is still pending, try to cancel it from the queue
    if (task.status === 'pending') {
      // We don't have a direct way to find the job ID from task ID
      // This would need to be tracked differently in a production system
      // For now, we'll just mark the task as cancelled
    }

    const success = await this.taskService.deleteTask(id);
    
    return {
      success,
      message: success ? 'Task cancelled successfully' : 'Failed to cancel task',
    };
  }
}