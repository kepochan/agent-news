import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { BaseFetcher } from './base.fetcher';
import { FetchedItem, SourceConfig } from '@/shared/types';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';

interface MonitoredContent {
  selector: string;
  content: string;
  hash: string;
}

@Injectable()
export class ContentMonitorFetcher extends BaseFetcher {
  constructor(sourceConfig: SourceConfig) {
    super(sourceConfig);
  }

  async fetchItems(source: Source, watermark?: string): Promise<{
    items: FetchedItem[];
    nextWatermark?: string;
  }> {
    try {
      this.logger.log(`Monitoring content changes for: ${source.url}`);

      const meta = source.meta as any;
      const monitorSelector = meta?.monitor_selector || meta?.monitorSelector;
      const itemSelector = meta?.item_selector || meta?.itemSelector;

      if (!monitorSelector) {
        throw new Error('monitor_selector is required for content_monitor sources');
      }

      const html = await this.fetchHtml(source.url);
      const $ = cheerio.load(html);
      
      // Get the monitored content
      const monitoredElement = $(monitorSelector);
      if (monitoredElement.length === 0) {
        this.logger.warn(`Monitor selector "${monitorSelector}" not found on ${source.url}`);
        return { items: [] };
      }

      const currentContent = monitoredElement.html() || '';
      const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

      // Check if content has changed
      if (watermark && watermark === currentHash) {
        this.logger.debug(`No content changes detected for ${source.url}`);
        return { items: [], nextWatermark: currentHash };
      }

      const items: FetchedItem[] = [];

      if (itemSelector) {
        // Extract individual items from the monitored content
        items.push(...this.extractItems($, monitoredElement, itemSelector, source.url));
      } else {
        // Treat the entire monitored content as a single item
        const title = this.extractTitle($, source.url);
        const content = this.extractTextContent(monitoredElement);

        if (content.trim()) {
          items.push({
            title,
            content: this.sanitizeContent(content),
            url: source.url,
            publishedAt: new Date(),
            metadata: {
              type: 'content_monitor',
              content_hash: currentHash,
              selector: monitorSelector,
            },
          });
        }
      }

      this.logger.log(`Detected ${items.length} content changes for ${source.url}`);

      return {
        items,
        nextWatermark: currentHash,
      };
    } catch (error) {
      this.logger.error(`Failed to monitor content for ${source.url}:`, error);
      throw error;
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    return await this.retryWithBackoff(async () => {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'News-Agent-TS/1.0 (Content Monitor)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.text();
    });
  }

  private extractItems(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<any>,
    itemSelector: string,
    sourceUrl: string,
  ): FetchedItem[] {
    const items: FetchedItem[] = [];
    
    container.find(itemSelector).each((index, element) => {
      const $element = $(element);
      
      // Extract title from the element
      const title = this.extractItemTitle($element, sourceUrl, index);
      const content = this.extractTextContent($element);
      
      // Try to extract a URL for this specific item
      const itemUrl = this.extractItemUrl($element, sourceUrl);

      if (content.trim()) {
        items.push({
          title,
          content: this.sanitizeContent(content),
          url: itemUrl,
          publishedAt: new Date(),
          metadata: {
            type: 'content_monitor_item',
            item_index: index,
            selector: itemSelector,
          },
        });
      }
    });

    return items;
  }

  private extractTitle($: cheerio.CheerioAPI, url: string): string {
    // Try various title sources
    const title = $('title').text().trim() ||
                 $('h1').first().text().trim() ||
                 $('meta[property="og:title"]').attr('content') ||
                 this.extractDomain(url);

    return title || `Content from ${this.extractDomain(url)}`;
  }

  private extractItemTitle(
    $element: cheerio.Cheerio<any>,
    sourceUrl: string,
    index: number,
  ): string {
    // Try to find a title within this item
    const title = $element.find('h1, h2, h3, h4, h5, h6').first().text().trim() ||
                 $element.find('.title, .name, .header').first().text().trim() ||
                 $element.find('a').first().text().trim();

    if (title) {
      return title;
    }

    // Fallback to content preview
    const content = this.extractTextContent($element);
    if (content.length > 50) {
      return content.substring(0, 50) + '...';
    }

    return `Item ${index + 1} from ${this.extractDomain(sourceUrl)}`;
  }

  private extractItemUrl(
    $element: cheerio.Cheerio<any>,
    sourceUrl: string,
  ): string {
    // Try to find a link within the item
    const link = $element.find('a').first().attr('href');
    
    if (link) {
      // Convert relative URLs to absolute
      try {
        return new URL(link, sourceUrl).href;
      } catch {
        return sourceUrl; // Fallback to source URL
      }
    }

    return sourceUrl;
  }

  private extractTextContent($element: cheerio.Cheerio<any>): string {
    // Remove script and style elements
    $element.find('script, style, noscript').remove();
    
    // Get text content and normalize whitespace
    return $element.text()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }
}