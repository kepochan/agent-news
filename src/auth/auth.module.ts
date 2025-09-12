import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { SlackSignatureGuard } from './slack-signature.guard';

@Module({
  providers: [ApiKeyGuard, SlackSignatureGuard],
  exports: [ApiKeyGuard, SlackSignatureGuard],
})
export class AuthModule {}