import { Command, CommandRunner } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ConfigService } from '@/config/config.service';

@Command({
  name: 'init-db',
  description: 'Initialize database with topic configurations',
})
export class InitDbCommand extends CommandRunner {
  private readonly logger = new Logger(InitDbCommand.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async run(): Promise<void> {
    try {
      this.logger.log('Initializing database with topic configurations...');
      
      const topics = this.configService.getAllTopics();
      
      for (const topicConfig of topics) {
        this.logger.log(`Creating/updating topic: ${topicConfig.slug}`);
        
        // Create or update topic
        const topic = await this.prisma.topic.upsert({
          where: { slug: topicConfig.slug },
          update: {
            name: topicConfig.name,
            enabled: topicConfig.enabled,
            assistantId: topicConfig.assistantId ?? null,
            config: topicConfig as any,
            lookbackDays: topicConfig.lookbackDays || this.configService.global.lookbackDays,
          },
          create: {
            slug: topicConfig.slug,
            name: topicConfig.name,
            enabled: topicConfig.enabled,
            assistantId: topicConfig.assistantId ?? null,
            config: topicConfig as any,
            lookbackDays: topicConfig.lookbackDays || this.configService.global.lookbackDays,
          },
        });

        // Create or update sources
        for (const sourceConfig of topicConfig.sources) {
          await this.prisma.source.upsert({
            where: {
              topicId_name: {
                topicId: topic.id,
                name: sourceConfig.name,
              },
            },
            update: {
              url: sourceConfig.url,
              type: sourceConfig.type,
              enabled: sourceConfig.enabled,
              meta: sourceConfig.meta as any,
            },
            create: {
              topicId: topic.id,
              name: sourceConfig.name,
              type: sourceConfig.type,
              url: sourceConfig.url,
              enabled: sourceConfig.enabled,
              meta: sourceConfig.meta as any,
            },
          });
        }

        this.logger.log(`Topic ${topicConfig.slug} initialized with ${topicConfig.sources.length} sources`);
      }
      
      this.logger.log(`Database initialization completed. Processed ${topics.length} topics.`);
    } catch (error) {
      this.logger.error('Database initialization failed:', error);
      process.exit(1);
    }
  }
}