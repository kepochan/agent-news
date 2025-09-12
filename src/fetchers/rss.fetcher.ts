import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
const Parser = require('rss-parser');
import { BaseFetcher } from './base.fetcher';
import { FetchedItem, SourceConfig } from '@/shared/types';

interface RSSItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  pubDate?: string;
  isoDate?: string;
  [key: string]: any;
}

@Injectable()
export class RSSFetcher extends BaseFetcher {
  private readonly parser: any;

  constructor(sourceConfig: SourceConfig) {
    super(sourceConfig);
    
    this.parser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'News-Agent-TS/1.0 (News Aggregation Service)',
      },
      customFields: {
        item: [
          ['content:encoded', 'contentEncoded'],
          ['description', 'description'],
        ],
      },
    });
  }

  async fetchItems(source: Source, watermark?: string): Promise<{
    items: FetchedItem[];
    nextWatermark?: string;
  }> {
    try {
      this.logger.log(`Fetching RSS feed: ${source.url}`);

      const feed = await this.retryWithBackoff(async () => {
        return await this.parser.parseURL(source.url);
      });

      if (!feed.items || feed.items.length === 0) {
        this.logger.warn(`No items found in RSS feed: ${source.url}`);
        return { items: [] };
      }

      const cutoffDate = watermark ? new Date(watermark) : null;
      const items: FetchedItem[] = [];

      let latestDate: Date | null = null;

      for (const item of feed.items) {
        const publishedAt = this.parseDate(item);
        
        // Skip items older than watermark
        if (cutoffDate && publishedAt && publishedAt <= cutoffDate) {
          continue;
        }

        if (!latestDate || (publishedAt && publishedAt > latestDate)) {
          latestDate = publishedAt;
        }

        const content = this.extractContent(item);
        const title = item.title?.trim();
        
        if (!title) {
          this.logger.warn(`Skipping item without title from ${source.url}`);
          continue;
        }

        items.push({
          title,
          content: content ? this.sanitizeContent(content) : undefined,
          url: item.link,
          publishedAt: publishedAt || undefined,
          metadata: {
            guid: item.guid,
            author: item.creator || item.author,
            categories: item.categories,
            source: feed.title,
          },
        });
      }

      this.logger.log(`Fetched ${items.length} items from RSS feed: ${source.url}`);

      return {
        items,
        nextWatermark: latestDate?.toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch RSS feed ${source.url}:`, error);
      throw error;
    }
  }

  private parseDate(item: RSSItem): Date | null {
    // Try isoDate first (most reliable)
    if (item.isoDate) {
      const date = new Date(item.isoDate);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try pubDate
    if (item.pubDate) {
      const date = new Date(item.pubDate);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try other date fields
    for (const key of Object.keys(item)) {
      if (key.toLowerCase().includes('date') && typeof item[key] === 'string') {
        const date = new Date(item[key]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }

  private extractContent(item: RSSItem): string | undefined {
    // Priority order for content extraction
    const contentFields = [
      'contentEncoded',
      'content',
      'description',
      'contentSnippet',
      'summary',
    ];

    for (const field of contentFields) {
      const content = item[field];
      if (content && typeof content === 'string' && content.trim()) {
        // Strip HTML tags
        return content.replace(/<[^>]*>/g, '').trim();
      }
    }

    return undefined;
  }
}