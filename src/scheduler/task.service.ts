import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { TaskResponse, TaskStatus, TaskType } from '@/shared/types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTask(
    taskType: TaskType,
    params: Record<string, any>,
    requester: string,
    topicId?: string,
  ): Promise<TaskResponse> {
    const task = await this.prisma.task.create({
      data: {
        id: uuidv4(),
        topicId,
        taskType,
        params,
        requester,
        status: 'pending',
      },
    });

    this.logger.log(`Created task: ${task.id} (${taskType})`);
    return this.mapTaskToResponse(task);
  }

  async getTask(taskId: string): Promise<TaskResponse | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    return task ? this.mapTaskToResponse(task) : null;
  }

  async getTasks(
    topicSlug?: string,
    status?: TaskStatus,
    limit = 50,
  ): Promise<TaskResponse[]> {
    const where: any = {};

    if (topicSlug) {
      // First find the topic to get its ID
      const topic = await this.prisma.topic.findUnique({
        where: { slug: topicSlug },
        select: { id: true },
      });

      if (topic) {
        where.topicId = topic.id;
      } else {
        return []; // Topic not found
      }
    }

    if (status) {
      where.status = status;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return tasks.map(task => this.mapTaskToResponse(task));
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: any,
    error?: string,
  ): Promise<void> {
    const updateData: any = { status };

    if (status === 'running') {
      updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
      if (result !== undefined) {
        updateData.result = result;
      }
      if (error) {
        updateData.error = error;
      }
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    this.logger.log(`Updated task ${taskId} status: ${status}`);
  }

  async deleteTask(taskId: string): Promise<boolean> {
    try {
      await this.prisma.task.delete({
        where: { id: taskId },
      });
      
      this.logger.log(`Deleted task: ${taskId}`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to delete task ${taskId}:`, error);
      return false;
    }
  }

  async cleanupOldTasks(olderThanDays = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.task.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: {
          in: ['completed', 'failed'],
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old tasks`);
  }

  async getTaskStats(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const [pending, running, completed, failed, total] = await Promise.all([
      this.prisma.task.count({ where: { status: 'pending' } }),
      this.prisma.task.count({ where: { status: 'running' } }),
      this.prisma.task.count({ where: { status: 'completed' } }),
      this.prisma.task.count({ where: { status: 'failed' } }),
      this.prisma.task.count(),
    ]);

    return { pending, running, completed, failed, total };
  }

  private mapTaskToResponse(task: any): TaskResponse {
    return {
      id: task.id,
      topic_slug: task.topic?.slug,
      task_type: task.taskType,
      status: task.status,
      params: task.params,
      created_at: task.createdAt,
      started_at: task.startedAt,
      completed_at: task.completedAt,
      result: task.result,
      error: task.error,
      requester: task.requester,
    };
  }
}