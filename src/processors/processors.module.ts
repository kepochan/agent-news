import { Module } from '@nestjs/common';
import { OpenAIProcessor } from './openai.processor';
import { SlackProcessor } from './slack.processor';

@Module({
  providers: [OpenAIProcessor, SlackProcessor],
  exports: [OpenAIProcessor, SlackProcessor],
})
export class ProcessorsModule {}