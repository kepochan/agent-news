import { Injectable, Logger } from '@nestjs/common';
import { WebClient } from '@slack/web-api';
import { ConfigService } from '@/config/config.service';
import { GlobalConfig } from '@/config/config.schema';
import { SlackMessageResult } from '@/shared/types';
import * as fs from 'fs/promises';

interface BlockKitSection {
  type: 'section';
  text: {
    type: 'mrkdwn';
    text: string;
  };
}

interface BlockKitDivider {
  type: 'divider';
}

interface BlockKitHeader {
  type: 'header';
  text: {
    type: 'plain_text';
    text: string;
  };
}

type BlockKitElement = BlockKitSection | BlockKitDivider | BlockKitHeader;

@Injectable()
export class SlackProcessor {
  private readonly logger = new Logger(SlackProcessor.name);
  private readonly client: WebClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new WebClient(this.configService.slackBotToken);
  }

  private get config(): GlobalConfig {
    return this.configService.global;
  }

  async postSummary(
    topicName: string,
    summary: string,
    channels: string[],
    metadata?: Record<string, any>,
  ): Promise<SlackMessageResult> {
    try {
      const messageLength = summary.length;
      const shouldPostAsFile = messageLength > this.config.slack.postAsFileOver;

      this.logger.log(
        `Posting ${shouldPostAsFile ? 'file' : 'message'} (${messageLength} chars) to ${channels.length} channel(s)`,
      );

      let messageId: string | undefined;

      for (const channel of channels) {
        try {
          const channelName = this.normalizeChannelName(channel);
          
          if (shouldPostAsFile) {
            const result = await this.postAsFile(topicName, summary, channelName, metadata);
            messageId = result.messageId;
          } else {
            const result = await this.postAsBlockKit(topicName, summary, channelName, metadata);
            messageId = result.messageId;
          }
        } catch (error) {
          this.logger.error(`Failed to post to channel ${channel}:`, error);
          throw error;
        }
      }

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to post summary to Slack:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async postAsBlockKit(
    topicName: string,
    summary: string,
    channel: string,
    metadata?: Record<string, any>,
  ): Promise<{ messageId?: string }> {
    const blocks = this.buildBlockKitMessage(topicName, summary, metadata);

    return await this.retryWithBackoff(async () => {
      const result = await this.client.chat.postMessage({
        channel,
        blocks,
        text: `News summary: ${topicName}`, // Fallback text for notifications
        username: 'News Agent',
        icon_emoji: ':newspaper:',
      });

      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`);
      }

      return {
        messageId: result.ts,
      };
    });
  }

  private async postAsFile(
    topicName: string,
    summary: string,
    channel: string,
    metadata?: Record<string, any>,
  ): Promise<{ messageId?: string }> {
    // Create a temporary file
    const fileName = `news-summary-${topicName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
    const tempFilePath = `/tmp/${fileName}`;
    
    const fileContent = this.formatSummaryAsMarkdown(topicName, summary, metadata);
    
    try {
      await fs.writeFile(tempFilePath, fileContent, 'utf8');

      const result = await this.retryWithBackoff(async () => {
        const uploadResult = await this.client.files.uploadV2({
          channels: channel,
          file: tempFilePath,
          filename: fileName,
          title: `News Summary: ${topicName}`,
          initial_comment: this.buildFileComment(topicName, metadata),
        });

        if (!uploadResult.ok) {
          throw new Error(`Slack file upload error: ${uploadResult.error}`);
        }

        return uploadResult;
      });

      return {
        messageId: (result as any).file?.id,
      };
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        this.logger.warn(`Failed to clean up temp file ${tempFilePath}:`, error);
      }
    }
  }

  private buildBlockKitMessage(
    topicName: string,
    summary: string,
    metadata?: Record<string, any>,
  ): BlockKitElement[] {
    const blocks: BlockKitElement[] = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📰 ${topicName} News Summary`,
      },
    });

    // Add metadata if available
    if (metadata) {
      const metadataText = this.formatMetadata(metadata);
      if (metadataText) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: metadataText,
          },
        });
      }
    }

    blocks.push({ type: 'divider' });

    // Split summary into chunks that fit Slack's block limits
    const chunks = this.splitTextForBlocks(summary);
    
    for (const chunk of chunks) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: chunk,
        },
      });
    }

    // Footer with timestamp
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `_Generated at ${new Date().toISOString()}_`,
      },
    });

    return blocks;
  }

  private formatSummaryAsMarkdown(
    topicName: string,
    summary: string,
    metadata?: Record<string, any>,
  ): string {
    let content = `# 📰 ${topicName} News Summary\n\n`;
    
    if (metadata) {
      const metadataText = this.formatMetadataForMarkdown(metadata);
      if (metadataText) {
        content += `${metadataText}\n\n---\n\n`;
      }
    }
    
    content += `${summary}\n\n`;
    content += `---\n_Generated at ${new Date().toISOString()}_`;
    
    return content;
  }

  private buildFileComment(topicName: string, metadata?: Record<string, any>): string {
    let comment = `📰 News summary for **${topicName}**`;
    
    if (metadata?.itemCount) {
      comment += ` (${metadata.itemCount} items processed)`;
    }
    
    return comment;
  }

  private formatMetadata(metadata: Record<string, any>): string {
    const parts: string[] = [];
    
    if (metadata.itemCount) {
      parts.push(`*Items processed:* ${metadata.itemCount}`);
    }
    
    if (metadata.timeRange) {
      parts.push(`*Time range:* ${metadata.timeRange}`);
    }
    
    if (metadata.sources) {
      const sourceCount = Array.isArray(metadata.sources) ? metadata.sources.length : metadata.sources;
      parts.push(`*Sources:* ${sourceCount}`);
    }
    
    return parts.join(' • ');
  }

  private formatMetadataForMarkdown(metadata: Record<string, any>): string {
    const parts: string[] = [];
    
    if (metadata.itemCount) {
      parts.push(`**Items processed:** ${metadata.itemCount}`);
    }
    
    if (metadata.timeRange) {
      parts.push(`**Time range:** ${metadata.timeRange}`);
    }
    
    if (metadata.sources) {
      const sourceCount = Array.isArray(metadata.sources) ? metadata.sources.length : metadata.sources;
      parts.push(`**Sources:** ${sourceCount}`);
    }
    
    return parts.join('  \n');
  }

  private splitTextForBlocks(text: string): string[] {
    const maxBlockSize = 3000; // Slack's block text limit
    const chunks: string[] = [];
    
    if (text.length <= maxBlockSize) {
      return [text];
    }
    
    // Split by paragraphs first
    const paragraphs = text.split('\n\n');
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const potentialChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      
      if (potentialChunk.length <= maxBlockSize) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = paragraph;
        } else {
          // Single paragraph is too long, split by sentences
          const sentences = paragraph.split('. ');
          let sentenceChunk = '';
          
          for (const sentence of sentences) {
            const potentialSentenceChunk = sentenceChunk ? `${sentenceChunk}. ${sentence}` : sentence;
            
            if (potentialSentenceChunk.length <= maxBlockSize) {
              sentenceChunk = potentialSentenceChunk;
            } else {
              if (sentenceChunk) {
                chunks.push(sentenceChunk);
                sentenceChunk = sentence;
              } else {
                // Single sentence is too long, hard split
                chunks.push(sentence.substring(0, maxBlockSize - 3) + '...');
              }
            }
          }
          
          if (sentenceChunk) {
            currentChunk = sentenceChunk;
          }
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  private normalizeChannelName(channel: string): string {
    // Remove # if present and ensure proper format
    return channel.startsWith('#') ? channel.slice(1) : channel;
  }

  private async retryWithBackoff<T>(
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
          `Slack attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.client.auth.test();
      return result.ok === true;
    } catch {
      return false;
    }
  }
}