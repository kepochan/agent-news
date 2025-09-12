import { Module } from '@nestjs/common';
import { FetcherFactory } from './fetcher.factory';

@Module({
  providers: [FetcherFactory],
  exports: [FetcherFactory],
})
export class FetchersModule {}