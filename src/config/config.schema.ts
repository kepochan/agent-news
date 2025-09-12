import { z } from 'zod';

export const ScheduleSchema = z.object({
  cron: z.string(),
  timezone: z.string().default('Europe/Paris'),
});

export const OpenAIConfigSchema = z.object({
  maxItemsPerRun: z.number().default(60),
  maxCharsPerItem: z.number().default(2000),
  timeoutSeconds: z.number().default(120),
  retryAttempts: z.number().default(3),
});

export const SlackConfigSchema = z.object({
  defaultChannel: z.string().default('#news-alerts'),
  postAsFileOver: z.number().default(4000),
  retryAttempts: z.number().default(3),
});

export const DeduplicationConfigSchema = z.object({
  simHashThreshold: z.number().default(0.92),
  lookbackDays: z.number().default(30),
});

export const FetchingConfigSchema = z.object({
  maxLookbackDays: z.number().default(7),
});

export const GlobalConfigSchema = z.object({
  lookbackDays: z.number().default(7),
  defaultSchedule: ScheduleSchema.optional(),
  openai: OpenAIConfigSchema,
  slack: SlackConfigSchema,
  deduplication: DeduplicationConfigSchema,
  fetching: FetchingConfigSchema.optional(),
});

export const SourceMetaSchema = z.object({
  monitorSelector: z.string().optional(),
  itemSelector: z.string().optional(),
}).passthrough();

export const SourceConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['rss', 'github', 'discord', 'content_monitor']),
  url: z.string().url(),
  enabled: z.boolean().default(true),
  meta: SourceMetaSchema.optional(),
});

export const ChannelConfigSchema = z.object({
  slack: z.object({
    channels: z.array(z.string()),
  }).optional(),
});

export const TopicConfigSchema = z.object({
  name: z.string(),
  slug: z.string(),
  enabled: z.boolean().default(true),
  assistantId: z.string().nullable().optional(),
  schedule: ScheduleSchema.optional(),
  lookbackDays: z.number().optional(),
  includeKeywords: z.array(z.string()).optional(),
  excludeKeywords: z.array(z.string()).optional(),
  sources: z.array(SourceConfigSchema),
  channels: ChannelConfigSchema,
});

export const EnvConfigSchema = z.object({
  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_ASSISTANT_ID: z.string().optional(),

  // Slack
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_APP_ID: z.string().min(1),

  // Database
  DATABASE_URL: z.string().url(),

  // Authentication
  JWT_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  BASE_URL: z.string().url().default('http://localhost:8000'),

  // Optional services
  DISCORD_BOT_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),

  // API Security
  API_KEY: z.string().min(32),
  API_RATE_LIMIT: z.coerce.number().default(100),

  // App config
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug']).default('info'),
  TZ: z.string().default('Europe/Paris'),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
});

export type ScheduleConfig = z.infer<typeof ScheduleSchema>;
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type SlackConfig = z.infer<typeof SlackConfigSchema>;
export type DeduplicationConfig = z.infer<typeof DeduplicationConfigSchema>;
export type FetchingConfig = z.infer<typeof FetchingConfigSchema>;
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type SourceMeta = z.infer<typeof SourceMetaSchema>;
export type SourceConfig = z.infer<typeof SourceConfigSchema>;
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;
export type TopicConfig = z.infer<typeof TopicConfigSchema>;
export type EnvConfig = z.infer<typeof EnvConfigSchema>;