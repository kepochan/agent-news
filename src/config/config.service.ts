import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  EnvConfig,
  EnvConfigSchema,
  GlobalConfig,
  GlobalConfigSchema,
  TopicConfig,
  TopicConfigSchema,
} from './config.schema';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private envConfig: EnvConfig;
  private globalConfig!: GlobalConfig;
  private topicConfigs: Map<string, TopicConfig> = new Map();

  constructor(private readonly _nestConfigService: NestConfigService) {
    // Load environment config synchronously since it's needed immediately
    this.envConfig = EnvConfigSchema.parse(process.env);
  }

  async onModuleInit() {
    await this.loadConfigurations();
  }

  private async loadConfigurations() {
    this.logger.log('Environment configuration loaded and validated');

    // Load global configuration
    await this.loadGlobalConfig();

    // Load topic configurations
    await this.loadTopicConfigs();
  }

  private async loadGlobalConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'global.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const rawConfig = JSON.parse(configData);
      this.globalConfig = GlobalConfigSchema.parse(rawConfig);
      this.logger.log('Global configuration loaded and validated');
    } catch (error) {
      this.logger.error('Failed to load global configuration:', error);
      // Use default configuration
      this.globalConfig = GlobalConfigSchema.parse({
        lookbackDays: 7,
        openai: {},
        slack: {},
        deduplication: {},
      });
      this.logger.warn('Using default global configuration');
    }
  }

  private async loadTopicConfigs() {
    try {
      const topicsDir = path.join(process.cwd(), 'config', 'topics');
      const files = await fs.readdir(topicsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(topicsDir, file);
            const configData = await fs.readFile(filePath, 'utf-8');
            const rawConfig = JSON.parse(configData);
            const topicConfig = TopicConfigSchema.parse(rawConfig);
            
            this.topicConfigs.set(topicConfig.slug, topicConfig);
            this.logger.log(`Topic configuration loaded: ${topicConfig.slug}`);
          } catch (error) {
            this.logger.error(`Failed to load topic configuration from ${file}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load topic configurations directory:', error);
    }
  }

  // Environment configuration getters
  get env(): EnvConfig {
    return this.envConfig;
  }

  get nodeEnv(): string {
    return this.envConfig.NODE_ENV;
  }

  get port(): number {
    return this.envConfig.PORT;
  }

  get databaseUrl(): string {
    return this.envConfig.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.envConfig.REDIS_URL;
  }

  get openaiApiKey(): string {
    return this.envConfig.OPENAI_API_KEY;
  }

  get openaiAssistantId(): string | undefined {
    return this.envConfig.OPENAI_ASSISTANT_ID;
  }

  get slackBotToken(): string {
    return this.envConfig.SLACK_BOT_TOKEN;
  }

  get slackSigningSecret(): string {
    return this.envConfig.SLACK_SIGNING_SECRET;
  }

  get slackAppId(): string {
    return this.envConfig.SLACK_APP_ID;
  }

  get discordBotToken(): string | undefined {
    return this.envConfig.DISCORD_BOT_TOKEN;
  }

  get githubToken(): string | undefined {
    return this.envConfig.GITHUB_TOKEN;
  }

  get apiKey(): string {
    return this.envConfig.API_KEY;
  }

  get apiRateLimit(): number {
    return this.envConfig.API_RATE_LIMIT;
  }

  get logLevel(): string {
    return this.envConfig.LOG_LEVEL;
  }

  get timezone(): string {
    return this.envConfig.TZ;
  }

  get jwtSecret(): string {
    return this.envConfig.JWT_SECRET;
  }

  get googleClientId(): string {
    return this.envConfig.GOOGLE_CLIENT_ID;
  }

  get googleClientSecret(): string {
    return this.envConfig.GOOGLE_CLIENT_SECRET;
  }

  get baseUrl(): string {
    return this.envConfig.BASE_URL;
  }

  // Global configuration getters
  get global(): GlobalConfig {
    return this.globalConfig;
  }

  // Topic configuration methods
  getTopic(slug: string): TopicConfig | undefined {
    return this.topicConfigs.get(slug);
  }

  getAllTopics(): TopicConfig[] {
    return Array.from(this.topicConfigs.values());
  }

  getEnabledTopics(): TopicConfig[] {
    return Array.from(this.topicConfigs.values()).filter(topic => topic.enabled);
  }

  hasTopicConfig(slug: string): boolean {
    return this.topicConfigs.has(slug);
  }

  // Reload configurations (useful for development or runtime updates)
  async reloadConfigurations() {
    this.logger.log('Reloading configurations...');
    this.topicConfigs.clear();
    await this.loadGlobalConfig();
    await this.loadTopicConfigs();
    this.logger.log('Configurations reloaded successfully');
  }
}