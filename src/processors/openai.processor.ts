import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@/config/config.service';
import { GlobalConfig } from '@/config/config.schema';
import { OpenAIProcessResult, ProcessedItem } from '@/shared/types';

interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class OpenAIProcessor {
  private readonly logger = new Logger(OpenAIProcessor.name);
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.openaiApiKey,
    });
  }

  private get config(): GlobalConfig {
    return this.configService.global;
  }

  async processItems(
    items: ProcessedItem[],
    assistantId?: string,
  ): Promise<OpenAIProcessResult> {
    try {
      if (!assistantId && !this.configService.openaiAssistantId) {
        throw new Error('No OpenAI assistant ID configured');
      }

      const finalAssistantId = assistantId || this.configService.openaiAssistantId!;
      
      this.logger.log(`Processing ${items.length} items with assistant ${finalAssistantId}`);

      // Limit items and content size
      const limitedItems = items
        .slice(0, this.config.openai.maxItemsPerRun)
        .map(item => this.limitItemContent(item));

      if (limitedItems.length === 0) {
        return {
          summary: 'No items to process',
          prompt: '',
          success: true,
        };
      }

      // Create content for the assistant
      const content = this.formatItemsForProcessing(limitedItems);
      
      // Process with OpenAI Assistant API
      const summary = await this.processWithAssistant(finalAssistantId, content);

      return {
        summary,
        prompt: content,
        success: true,
      };
    } catch (error) {
      this.logger.error('Failed to process items with OpenAI:', error);
      return {
        summary: '',
        prompt: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async processWithAssistant(assistantId: string, content: string): Promise<string> {
    return await this.retryWithBackoff(async () => {
      // Create a new thread
      const thread = await this.client.beta.threads.create();

      // Add the message to the thread
      await this.client.beta.threads.messages.create(thread.id, {
        role: 'user',
        content,
      });

      // Run the assistant
      const run = await this.client.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId,
      });

      // Wait for completion with polling
      const completedRun = await this.waitForRunCompletion(thread.id, run.id);

      if (completedRun.status === 'failed') {
        throw new Error(`Assistant run failed: ${completedRun.last_error?.message || 'Unknown error'}`);
      }

      if (completedRun.status === 'cancelled' || completedRun.status === 'expired') {
        throw new Error(`Assistant run ${completedRun.status}`);
      }

      // Get the assistant's response
      const messages = await this.client.beta.threads.messages.list(thread.id, {
        order: 'desc',
        limit: 1,
      });

      const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
      
      if (!assistantMessage?.content[0] || assistantMessage.content[0].type !== 'text') {
        throw new Error('No valid response from assistant');
      }

      // Clean up the thread
      try {
        await this.client.beta.threads.del(thread.id);
      } catch (error) {
        this.logger.warn(`Failed to delete thread ${thread.id}:`, error);
      }

      return assistantMessage.content[0].text.value;
    }, this.config.openai.retryAttempts);
  }

  private async waitForRunCompletion(threadId: string, runId: string): Promise<OpenAI.Beta.Threads.Runs.Run> {
    const maxWaitTime = this.config.openai.timeoutSeconds * 1000;
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const run = await this.client.beta.threads.runs.retrieve(threadId, runId);

      if (run.status === 'completed' || run.status === 'failed' || 
          run.status === 'cancelled' || run.status === 'expired') {
        return run;
      }

      if (run.status === 'requires_action') {
        this.logger.warn(`Run requires action, but this is not supported: ${run.id}`);
        // For now, we don't support tool calls
        break;
      }

      await this.sleep(pollInterval);
    }

    // Cancel the run if it's still running
    try {
      await this.client.beta.threads.runs.cancel(threadId, runId);
    } catch (error) {
      this.logger.warn(`Failed to cancel run ${runId}:`, error);
    }

    throw new Error('Assistant run timed out');
  }

  private limitItemContent(item: ProcessedItem): ProcessedItem {
    if (!item.content) return item;

    const maxChars = this.config.openai.maxCharsPerItem;
    if (item.content.length <= maxChars) return item;

    return {
      ...item,
      content: item.content.substring(0, maxChars) + '...',
    };
  }

  private formatItemsForProcessing(items: ProcessedItem[]): string {
    const header = `Analyze the following ${items.length} developer news items and create a comprehensive summary for developers.

STRUCTURE REQUIRED:
🔥 TOP 5 CRITICAL UPDATES
- List the 5 most important items (breaking changes, major releases, critical features)
- Each point should be 1-2 lines maximum
- Use technical language appropriate for developers

📋 ADDITIONAL UPDATES
- List all other relevant items
- Include minor updates, improvements, and notable changes
- Keep each point concise but informative

NEWS ITEMS:

`;
    
    const itemsText = items.map((item, index) => {
      const publishedAt = item.publishedAt ? 
        ` (${item.publishedAt.toISOString().split('T')[0]})` : '';
      
      let itemText = `${index + 1}. **${item.title}**${publishedAt}\n`;
      
      if (item.url) {
        itemText += `   Source: ${item.url}\n`;
      }
      
      if (item.content) {
        itemText += `   ${item.content}\n`;
      }
      
      return itemText;
    }).join('\n');

    const footer = '\n---\nProvide the structured summary with the exact headers shown above (no markdown formatting):';
    
    return header + itemsText + footer;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
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
          `OpenAI attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple test to verify API key works
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}