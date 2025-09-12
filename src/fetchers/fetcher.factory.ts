import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { ConfigService } from '@/config/config.service';
import { BaseFetcher } from './base.fetcher';
import { RSSFetcher } from './rss.fetcher';
import { GitHubFetcher } from './github.fetcher';
import { DiscordFetcher } from './discord.fetcher';
import { ContentMonitorFetcher } from './content-monitor.fetcher';
import { SourceConfig } from '@/shared/types';

@Injectable()
export class FetcherFactory {
  constructor(private readonly configService: ConfigService) {}

  createFetcher(source: Source): BaseFetcher {
    // Convert source to SourceConfig format
    const sourceConfig: SourceConfig = {
      name: source.name,
      type: source.type as any,
      url: source.url,
      enabled: source.enabled,
      meta: source.meta as any,
    };

    switch (source.type) {
      case 'rss':
        return new RSSFetcher(sourceConfig);
      
      case 'github':
        return new GitHubFetcher(sourceConfig, this.configService);
      
      case 'discord':
        return new DiscordFetcher(sourceConfig, this.configService);
      
      case 'content_monitor':
        return new ContentMonitorFetcher(sourceConfig);
      
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  getSupportedTypes(): string[] {
    return ['rss', 'github', 'discord', 'content_monitor'];
  }
}