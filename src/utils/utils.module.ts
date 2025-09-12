import { Module } from '@nestjs/common';
import { DeduplicationService } from './deduplication.service';
import { PGLockService } from './pg-lock.service';

@Module({
  providers: [DeduplicationService, PGLockService],
  exports: [DeduplicationService, PGLockService],
})
export class UtilsModule {}