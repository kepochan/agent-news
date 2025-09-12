import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { BaseFetcher } from './base.fetcher';
import { FetchedItem, SourceConfig } from '@/shared/types';
import { ConfigService } from '@/config/config.service';
import * as cheerio from 'cheerio';

interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
  };
  content: string;
  timestamp: string;
  embeds: any[];
  attachments: any[];
  reactions?: any[];
}

@Injectable()
export class DiscordFetcher extends BaseFetcher {
  private readonly baseUrl = 'https://discord.com/api/v10';
  private readonly headers: Record<string, string>;

  constructor(
    sourceConfig: SourceConfig,
    private readonly configService: ConfigService,
  ) {
    super(sourceConfig);

    const botToken = this.configService.discordBotToken;
    if (!botToken) {
      throw new Error('Discord bot token is required for Discord fetching');
    }

    this.headers = {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'News-Agent-TS/1.0',
    };
  }

  async fetchItems(source: Source, watermark?: string): Promise<{
    items: FetchedItem[];
    nextWatermark?: string;
  }> {
    try {
      const channelId = this.extractChannelId(source.url);
      this.logger.log(`Fetching Discord messages from channel: ${channelId}`);

      const messages = await this.fetchMessages(channelId, watermark);
      const items: FetchedItem[] = [];
      let latestId: string | null = null;

      for (const message of messages) {
        // Skip messages without content or from bots
        if (!message.content.trim() || message.author.discriminator === '0000') {
          continue;
        }

        const publishedAt = new Date(message.timestamp);
        
        if (!latestId || this.compareSnowflakes(message.id, latestId) > 0) {
          latestId = message.id;
        }

        // Enrich content with link previews if needed
        const enrichedContent = await this.enrichContent(message.content);

        items.push({
          title: `Discord: ${message.author.username}`,
          content: this.sanitizeContent(enrichedContent),
          url: `https://discord.com/channels/${channelId}/${message.id}`,
          publishedAt,
          metadata: {
            type: 'discord_message',
            channel_id: message.channel_id,
            author: {
              id: message.author.id,
              username: message.author.username,
            },
            message_id: message.id,
            has_embeds: message.embeds.length > 0,
            has_attachments: message.attachments.length > 0,
            reaction_count: message.reactions?.length || 0,
          },
        });
      }

      this.logger.log(`Fetched ${items.length} messages from Discord channel: ${channelId}`);

      return {
        items,
        nextWatermark: latestId || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Discord messages from ${source.url}:`, error);
      throw error;
    }
  }

  private async fetchMessages(channelId: string, after?: string): Promise<DiscordMessage[]> {
    let url = `${this.baseUrl}/channels/${channelId}/messages?limit=100`;
    
    if (after) {
      url += `&after=${after}`;
    }

    return await this.retryWithBackoff(async () => {
      const response = await fetch(url, { headers: this.headers });
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            await this.sleep(parseInt(retryAfter, 10) * 1000);
            return this.fetchMessages(channelId, after);
          }
        }
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<DiscordMessage[]>;
    });
  }

  private extractChannelId(url: string): string {
    // Extract channel ID from Discord URL
    const match = url.match(/channels\/\d+\/(\d+)/);
    if (match) {
      return match[1];
    }

    // If it's just a channel ID
    if (/^\d+$/.test(url)) {
      return url;
    }

    throw new Error(`Invalid Discord URL or channel ID: ${url}`);
  }

  private compareSnowflakes(a: string, b: string): number {
    // Discord snowflakes are sortable by timestamp
    return BigInt(a) > BigInt(b) ? 1 : BigInt(a) < BigInt(b) ? -1 : 0;
  }

  private async enrichContent(content: string): Promise<string> {
    // Find URLs in the message
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    
    if (!urls || urls.length === 0) {
      return content;
    }

    let enrichedContent = content;

    // Limit to 3 URLs to avoid making too many requests
    for (const url of urls.slice(0, 3)) {
      try {
        const preview = await this.fetchUrlPreview(url);
        if (preview) {
          enrichedContent += `\n\n[${url}]\n${preview}`;
        }
      } catch (error) {
        this.logger.debug(`Failed to fetch preview for ${url}:`, error.message);
      }
    }

    return enrichedContent;
  }

  private async fetchUrlPreview(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'News-Agent-TS/1.0 (URL Preview)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract title and description
      const title = $('meta[property="og:title"]').attr('content') || 
                   $('meta[name="twitter:title"]').attr('content') || 
                   $('title').text().trim();

      const description = $('meta[property="og:description"]').attr('content') || 
                         $('meta[name="twitter:description"]').attr('content') || 
                         $('meta[name="description"]').attr('content');

      if (title) {
        const preview = description ? `${title}\n${description}` : title;
        return preview.slice(0, 500); // Limit preview length
      }

      return null;
    } catch {
      return null;
    }
  }
}