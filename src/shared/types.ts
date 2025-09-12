export interface ProcessTopicRequest {
  topic_slug: string;
  force?: boolean;
}

export interface RevertTopicRequest {
  period: string; // Pattern: /^\d+[dhm]$/
}

export interface TopicStatusResponse {
  slug: string;
  name: string;
  enabled: boolean;
  last_run?: Date | undefined;
  next_run?: Date | undefined;
  items_count: number;
  runs_count: number;
  sources?: SourceConfig[];
  channels?: {
    slack?: {
      channels: string[];
    };
  };
  assistantId?: string;
  lookbackDays?: number;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  schedule?: {
    cron?: string;
    timezone?: string;
  };
}

export interface HealthResponse {
  status: string;
  scheduler_running: boolean;
  database_connected: boolean;
  topics_count: number;
  timestamp: Date;
}

export interface TaskResponse {
  id: string;
  topic_slug?: string;
  task_type: 'process' | 'revert';
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: Record<string, any>;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  result?: any;
  error?: string;
  requester: string;
}

export interface ServiceInfoResponse {
  service: string;
  version: string;
  description: string;
  links: {
    health: string;
    docs: string;
    topics: string;
    runs: string;
    tasks: string;
  };
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskType = 'process' | 'revert';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SourceType = 'rss' | 'github' | 'discord' | 'content_monitor';

export interface SourceConfig {
  name: string;
  type: SourceType;
  url: string;
  enabled: boolean;
  meta?: Record<string, any>;
}

export interface FetchedItem {
  title: string;
  content?: string;
  url?: string;
  publishedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ProcessedItem extends FetchedItem {
  contentHash: string;
  simHash: string;
  sourceName?: string;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  similarity?: number;
  duplicateId?: string;
}

export interface OpenAIProcessResult {
  summary: string;
  prompt: string;
  success: boolean;
  error?: string;
}

export interface SlackMessageResult {
  messageId?: string;
  success: boolean;
  error?: string;
}