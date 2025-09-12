import { Logger } from '@nestjs/common';
import { Source } from '@prisma/client';
import { FetchedItem, SourceConfig } from '@/shared/types';

export abstract class BaseFetcher {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly sourceConfig: SourceConfig) {}

  abstract fetchItems(source: Source, watermark?: string): Promise<{
    items: FetchedItem[];
    nextWatermark?: string;
  }>;

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  protected sanitizeContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .slice(0, 10000); // Limit content length
  }

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }
}