import { Command, CommandRunner, Option } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@/config/config.service';
import { NewsService } from '@/scheduler/news.service';

interface NewsCommandOptions {
  run?: string;
  revert?: string;
  period?: string;
  force?: boolean;
  api?: boolean;
}

@Command({
  name: 'news',
  description: 'News Agent CLI - Process topics or start API server',
})
export class NewsCommand extends CommandRunner {
  private readonly logger = new Logger(NewsCommand.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly newsService: NewsService,
  ) {
    super();
  }

  async run(
    _passedParams: string[],
    options: NewsCommandOptions,
  ): Promise<void> {
    try {
      if (options.api) {
        this.logger.log('Starting API server mode...');
        // Import and start the main application
        const { NestFactory } = await import('@nestjs/core');
        const { AppModule } = await import('../app.module');
        
        const app = await NestFactory.create(AppModule);
        const port = this.configService.port;
        await app.listen(port);
        this.logger.log(`API server running on port ${port}`);
        return;
      }

      if (options.run) {
        await this.runTopic(options.run, options.force || false);
        return;
      }

      if (options.revert && options.period) {
        await this.revertTopic(options.revert, options.period);
        return;
      }

      // Default behavior: show help
      this.logger.log('News Agent CLI');
      this.logger.log('Available options:');
      this.logger.log('  --run <topic>       Run specific topic');
      this.logger.log('  --revert <topic>    Revert topic data');
      this.logger.log('  --period <period>   Period for revert (e.g., 1d, 2h, 30m)');
      this.logger.log('  --force             Force processing even if recently run');
      this.logger.log('  --api               Start API server mode');
      this.logger.log('');
      this.logger.log('Examples:');
      this.logger.log('  npm run start:cli -- --run stellar');
      this.logger.log('  npm run start:cli -- --revert stellar --period 1d');
      this.logger.log('  npm run start:cli -- --api');

    } catch (error) {
      this.logger.error('Command failed:', error);
      process.exit(1);
    }
  }

  private async runTopic(topicSlug: string, force: boolean): Promise<void> {
    this.logger.log(`Running topic: ${topicSlug}${force ? ' (forced)' : ''}`);
    
    const topicConfig = this.configService.getTopic(topicSlug);
    if (!topicConfig) {
      throw new Error(`Topic not found: ${topicSlug}`);
    }

    const result = await this.newsService.processTopic(topicSlug, force);
    
    this.logger.log(`Topic processing completed: ${topicSlug}`);
    this.logger.log(`Items processed: ${result.processed}`);
    
    if (result.summary) {
      this.logger.log('Summary generated successfully');
    }
  }

  private async revertTopic(topicSlug: string, period: string): Promise<void> {
    this.logger.log(`Reverting topic: ${topicSlug} for period: ${period}`);
    
    const topicConfig = this.configService.getTopic(topicSlug);
    if (!topicConfig) {
      throw new Error(`Topic not found: ${topicSlug}`);
    }

    const result = await this.newsService.revertTopic(topicSlug, period);
    
    this.logger.log(`Topic revert completed: ${topicSlug}`);
    this.logger.log(`Runs deleted: ${result.deleted}`);
    this.logger.log(`Items deleted: ${result.itemsDeleted}`);
  }

  @Option({
    flags: '--run <topic>',
    description: 'Run processing for specific topic',
  })
  parseRun(val: string): string {
    return val;
  }

  @Option({
    flags: '--revert <topic>',
    description: 'Revert topic data',
  })
  parseRevert(val: string): string {
    return val;
  }

  @Option({
    flags: '--period <period>',
    description: 'Time period for revert (e.g., 1d, 2h, 30m)',
  })
  parsePeriod(val: string): string {
    if (!/^\d+[dhm]$/.test(val)) {
      throw new Error('Invalid period format. Use format: <number><d|h|m> (e.g., 1d, 2h, 30m)');
    }
    return val;
  }

  @Option({
    flags: '--force',
    description: 'Force processing even if recently run',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '--api',
    description: 'Start API server mode',
  })
  parseApi(): boolean {
    return true;
  }
}