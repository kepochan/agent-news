import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class PGLockService {
  private readonly logger = new Logger(PGLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async withLock<T>(
    lockName: string,
    fn: () => Promise<T>,
    timeoutMs = 30000,
  ): Promise<T> {
    const lockId = this.generateLockId(lockName);
    const acquired = await this.acquireLock(lockId, timeoutMs);
    
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockName}`);
    }

    try {
      this.logger.debug(`Acquired lock: ${lockName} (${lockId})`);
      return await fn();
    } finally {
      await this.releaseLock(lockId);
      this.logger.debug(`Released lock: ${lockName} (${lockId})`);
    }
  }

  async acquireLock(lockId: number, timeoutMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try to acquire advisory lock (non-blocking)
        const result = await this.prisma.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
          SELECT pg_try_advisory_lock(${lockId}) as pg_try_advisory_lock
        `;
        
        if (result[0]?.pg_try_advisory_lock) {
          return true;
        }
        
        // Wait before retrying
        await this.sleep(100);
      } catch (error) {
        this.logger.warn(`Error attempting to acquire lock ${lockId}:`, error);
        await this.sleep(100);
      }
    }
    
    return false;
  }

  async releaseLock(lockId: number): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(${lockId})
      `;
    } catch (error) {
      this.logger.warn(`Error releasing lock ${lockId}:`, error);
    }
  }

  async releaseAllLocks(): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock_all()
      `;
      this.logger.debug('Released all advisory locks');
    } catch (error) {
      this.logger.warn('Error releasing all locks:', error);
    }
  }

  private generateLockId(lockName: string): number {
    // Generate a numeric lock ID from string name
    // Using a simple hash function to convert string to number
    let hash = 0;
    if (lockName.length === 0) return hash;
    
    for (let i = 0; i < lockName.length; i++) {
      const char = lockName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Ensure positive number
    return Math.abs(hash);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async isLocked(lockName: string): Promise<boolean> {
    const lockId = this.generateLockId(lockName);
    
    try {
      const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count 
        FROM pg_locks 
        WHERE locktype = 'advisory' AND objid = ${lockId}
      `;
      
      return Number(result[0]?.count) > 0;
    } catch (error) {
      this.logger.warn(`Error checking lock status for ${lockName}:`, error);
      return false;
    }
  }

  async getActiveLocks(): Promise<Array<{ lockId: number; pid: number }>> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ objid: number; pid: number }>>`
        SELECT objid, pid 
        FROM pg_locks 
        WHERE locktype = 'advisory'
        ORDER BY objid
      `;
      
      return result.map(row => ({
        lockId: row.objid,
        pid: row.pid,
      }));
    } catch (error) {
      this.logger.warn('Error getting active locks:', error);
      return [];
    }
  }
}