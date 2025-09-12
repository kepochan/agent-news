import { Injectable } from '@nestjs/common';
import { Source } from '@prisma/client';
import { BaseFetcher } from './base.fetcher';
import { FetchedItem, SourceConfig } from '@/shared/types';
import { ConfigService } from '@/config/config.service';

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  author: {
    login: string;
  };
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

@Injectable()
export class GitHubFetcher extends BaseFetcher {
  private readonly baseUrl = 'https://api.github.com';
  private readonly headers: Record<string, string>;

  constructor(
    sourceConfig: SourceConfig,
    private readonly configService: ConfigService,
  ) {
    super(sourceConfig);

    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'News-Agent-TS/1.0',
    };

    const githubToken = this.configService.githubToken;
    if (githubToken) {
      this.headers['Authorization'] = `token ${githubToken}`;
    } else {
      this.logger.warn('No GitHub token configured - API requests will be limited to 60/hour');
    }
  }

  async fetchItems(source: Source, watermark?: string): Promise<{
    items: FetchedItem[];
    nextWatermark?: string;
  }> {
    try {
      const { owner, repo } = this.parseGitHubUrl(source.url);
      this.logger.log(`Fetching GitHub data for ${owner}/${repo}`);

      const fetchType = (source.meta as any)?.type || 'releases';
      
      switch (fetchType) {
        case 'releases':
          return await this.fetchReleases(owner, repo, watermark);
        case 'commits':
          return await this.fetchCommits(owner, repo, watermark);
        default:
          return await this.fetchReleases(owner, repo, watermark);
      }
    } catch (error) {
      this.logger.error(`Failed to fetch GitHub data from ${source.url}:`, error);
      throw error;
    }
  }

  private async fetchReleases(owner: string, repo: string, watermark?: string): Promise<{
    items: FetchedItem[];
    nextWatermark?: string;
  }> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/releases`;
    
    const response = await this.retryWithBackoff(async () => {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }
      return res.json() as Promise<GitHubRelease[]>;
    });

    const cutoffDate = watermark ? new Date(watermark) : null;
    const items: FetchedItem[] = [];
    let latestDate: Date | null = null;

    for (const release of response) {
      if (release.draft) continue; // Skip draft releases

      const publishedAt = new Date(release.published_at);

      if (cutoffDate && publishedAt <= cutoffDate) {
        continue;
      }

      if (!latestDate || publishedAt > latestDate) {
        latestDate = publishedAt;
      }

      items.push({
        title: `${repo} ${release.name || release.tag_name}`,
        content: this.sanitizeContent(release.body || 'No description provided'),
        url: release.html_url,
        publishedAt,
        metadata: {
          type: 'github_release',
          tag_name: release.tag_name,
          prerelease: release.prerelease,
          author: release.author?.login,
          repository: `${owner}/${repo}`,
        },
      });
    }

    this.logger.log(`Fetched ${items.length} releases from ${owner}/${repo}`);

    return {
      items,
      nextWatermark: latestDate?.toISOString(),
    };
  }

  private async fetchCommits(owner: string, repo: string, watermark?: string): Promise<{
    items: FetchedItem[];
    nextWatermark?: string;
  }> {
    let url = `${this.baseUrl}/repos/${owner}/${repo}/commits`;
    
    if (watermark) {
      url += `?since=${watermark}`;
    }

    const response = await this.retryWithBackoff(async () => {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }
      return res.json() as Promise<GitHubCommit[]>;
    });

    const items: FetchedItem[] = [];
    let latestDate: Date | null = null;

    for (const commit of response) {
      const publishedAt = new Date(commit.commit.author.date);

      if (!latestDate || publishedAt > latestDate) {
        latestDate = publishedAt;
      }

      // Skip merge commits and very short messages
      if (commit.commit.message.startsWith('Merge ') || commit.commit.message.length < 10) {
        continue;
      }

      items.push({
        title: `${repo}: ${commit.commit.message.split('\n')[0]}`,
        content: this.sanitizeContent(commit.commit.message),
        url: commit.html_url,
        publishedAt,
        metadata: {
          type: 'github_commit',
          sha: commit.sha,
          author: commit.commit.author.name,
          repository: `${owner}/${repo}`,
        },
      });
    }

    this.logger.log(`Fetched ${items.length} commits from ${owner}/${repo}`);

    return {
      items,
      nextWatermark: latestDate?.toISOString(),
    };
  }

  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(githubRegex);

    if (!match) {
      throw new Error(`Invalid GitHub URL: ${url}`);
    }

    return {
      owner: match[1],
      repo: match[2],
    };
  }
}