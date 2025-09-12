# News Agent TypeScript

A modern, scalable news monitoring and processing service built with NestJS. This TypeScript implementation provides automated news aggregation from multiple sources (RSS, GitHub, Discord, web scraping), AI-powered content processing, and intelligent distribution via Slack.

## Features

- 🔄 **Multi-Source Content Fetching**: RSS feeds, GitHub releases, Discord channels, web content monitoring
- 🤖 **AI-Powered Processing**: OpenAI Assistant API integration for intelligent content summarization
- 📧 **Smart Distribution**: Slack integration with Block Kit formatting and file uploads
- 🔍 **Content Deduplication**: SimHash-based duplicate detection with configurable similarity thresholds
- ⏰ **Flexible Scheduling**: Cron-based scheduling with timezone support
- 🔐 **Secure API**: Bearer token authentication with rate limiting
- 🏗️ **Scalable Architecture**: Bull queue system with Redis for task processing
- 📊 **Database Persistence**: PostgreSQL with Prisma ORM
- 🐳 **Docker Ready**: Complete containerization with Docker Compose

## Architecture

The application follows a modular NestJS architecture:

```
src/
├── api/                    # REST API controllers
├── auth/                   # Authentication guards
├── config/                 # Configuration management
├── database/               # Database service and models
├── fetchers/               # Content fetching services
├── processors/             # OpenAI and Slack processors
├── scheduler/              # Task queue and scheduling
├── utils/                  # Utilities (deduplication, locking)
├── shared/                 # Shared types and DTOs
├── commands/               # CLI commands
└── main.ts                 # Application entry point
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd news-agent-ts
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```bash
# Required
DATABASE_URL=postgresql://newsagent:password@localhost:5432/newsagent
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-your-openai-api-key
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_APP_ID=your-slack-app-id
API_KEY=your-secure-api-key-minimum-32-chars

# Optional
OPENAI_ASSISTANT_ID=asst_your-assistant-id
DISCORD_BOT_TOKEN=your-discord-bot-token
GITHUB_TOKEN=your-github-token
```

### Database Setup

1. Start PostgreSQL and Redis (or use Docker Compose):
```bash
docker-compose up -d postgres redis
```

2. Run database migrations:
```bash
npm run prisma:migrate
```

3. Initialize database with topic configurations:
```bash
npm run start:cli -- init-db
```

### Development

Start the development server:
```bash
npm run start:dev
```

The API will be available at:
- **API**: http://localhost:3000
- **Swagger Documentation**: http://localhost:3000/api

## Configuration

### Global Configuration

Edit `config/global.json` to configure global settings:

```json
{
  "lookback_days": 7,
  "default_schedule": {
    "cron": "0 9 * * 1,3",
    "timezone": "Europe/Paris"
  },
  "openai": {
    "max_items_per_run": 60,
    "max_chars_per_item": 2000,
    "timeout_seconds": 120,
    "retry_attempts": 3
  },
  "slack": {
    "default_channel": "#news-alerts",
    "post_as_file_over": 4000,
    "retry_attempts": 3
  },
  "deduplication": {
    "simhash_threshold": 0.92,
    "lookback_days": 30
  }
}
```

### Topic Configuration

Create topic configurations in `config/topics/`. Each topic defines:
- **Sources**: RSS feeds, GitHub repositories, Discord channels, web content
- **Processing**: OpenAI assistant configuration
- **Distribution**: Slack channels
- **Scheduling**: Custom cron schedules

Example topic configuration (`config/topics/stellar.json`):

```json
{
  "name": "Stellar Development",
  "slug": "stellar",
  "enabled": true,
  "assistant_id": "asst_your-assistant-id",
  "schedule": {
    "cron": "0 10 * * *",
    "timezone": "Europe/Paris"
  },
  "sources": [
    {
      "name": "Stellar Core GitHub",
      "type": "github",
      "url": "https://github.com/stellar/stellar-core",
      "enabled": true
    },
    {
      "name": "Stellar Blog",
      "type": "rss",
      "url": "https://stellar.org/blog/developers/rss.xml",
      "enabled": true
    }
  ],
  "channels": {
    "slack": {
      "channels": ["#stellar-updates"]
    }
  }
}
```

## API Usage

### Authentication

All protected endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/topics
```

### Key Endpoints

- `GET /health` - Health check
- `GET /topics` - List all topics
- `GET /topics/{slug}` - Get topic details
- `POST /topics/{slug}/process` - Trigger topic processing
- `POST /topics/{slug}/revert` - Revert topic data
- `GET /runs` - List processing runs
- `GET /tasks` - List background tasks

### Example API Calls

```bash
# Get all topics
curl http://localhost:3000/topics

# Process a topic
curl -X POST \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"force": false}' \
  http://localhost:3000/topics/stellar/process

# Revert topic data
curl -X POST \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"period": "1d"}' \
  http://localhost:3000/topics/stellar/revert
```

## CLI Usage

The CLI provides direct access to core functionality:

```bash
# Process a specific topic
npm run start:cli -- --run stellar

# Revert topic data for 1 day
npm run start:cli -- --revert stellar --period 1d

# Force processing (ignore recent runs)
npm run start:cli -- --run stellar --force

# Start API server mode
npm run start:cli -- --api

# Run database migrations
npm run start:cli -- migrate

# Initialize database with topics
npm run start:cli -- init-db
```

## Docker Deployment

### Using Docker Compose

1. Configure environment variables in `.env`

2. Start all services:
```bash
docker-compose up -d
```

3. Run initial setup:
```bash
# Wait for services to be ready, then:
docker-compose exec app npm run prisma:migrate
docker-compose exec app npm run start:cli -- init-db
```

### Production Configuration

For production deployment:

1. Use a managed PostgreSQL and Redis instance
2. Set strong API keys and secrets
3. Configure proper OpenAI and Slack credentials
4. Use a reverse proxy (nginx) for SSL termination
5. Set up monitoring and logging

### Docker Services

- **app**: Main News Agent application
- **postgres**: PostgreSQL database
- **redis**: Redis for queue management
- **pgadmin**: Database administration (optional, `--profile tools`)
- **redis-commander**: Redis management (optional, `--profile tools`)

## Content Sources

### RSS Feeds
- Automatic feed parsing and item extraction
- Configurable content cleanup and sanitization
- Support for various RSS/Atom formats

### GitHub Integration
- Release monitoring with filtering
- Commit tracking for repositories
- Automatic GitHub API rate limiting

### Discord Integration
- Channel message monitoring
- Link preview enrichment
- Snowflake-based cursor pagination

### Web Content Monitoring
- CSS selector-based content extraction
- Change detection with content hashing
- Support for dynamic content monitoring

## AI Processing

The service integrates with OpenAI's Assistant API for intelligent content processing:

1. **Content Preparation**: Items are cleaned, limited, and formatted
2. **Assistant Processing**: OpenAI Assistant analyzes and summarizes content
3. **Response Handling**: Summaries are extracted and validated
4. **Distribution**: Processed content is distributed via configured channels

### Assistant Configuration

Configure your OpenAI Assistant with appropriate instructions for your use case:

```
You are a technical news analyst. Analyze the provided news items and create a concise summary highlighting:

1. Key technical developments and releases
2. Important trends and patterns
3. Critical updates requiring attention

Format your response with clear sections and bullet points.
```

## Slack Integration

### Setup Requirements

1. Create a Slack App with these scopes:
   - `channels:read`
   - `chat:write`
   - `files:write`

2. Install the app to your workspace

3. Configure the bot token and signing secret

### Message Formatting

The service uses Slack's Block Kit for rich message formatting:
- **Headers**: Topic names with emoji
- **Content**: Formatted summaries with metadata
- **Files**: Long summaries uploaded as markdown files
- **Threading**: Contextual message organization

## Monitoring and Maintenance

### Health Checks

```bash
# Check application health
curl http://localhost:3000/health

# Check database connectivity
npm run start:cli -- --run health-check
```

### Task Management

Monitor background tasks via the API:

```bash
# List active tasks
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/tasks

# Get task statistics
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/tasks/stats
```

### Database Maintenance

```bash
# Clean up old data
npm run start:cli -- cleanup

# Backup database
pg_dump $DATABASE_URL > backup.sql

# View Prisma Studio
npm run prisma:studio
```

## Development

### Project Structure

- **Modular Architecture**: Each feature is organized into focused modules
- **Dependency Injection**: Full NestJS DI container usage
- **Type Safety**: Strict TypeScript with comprehensive type definitions
- **Validation**: Zod schemas for configuration validation
- **Testing**: Jest-based testing framework (configure as needed)

### Code Style

- **ESLint**: Configured with TypeScript rules
- **Prettier**: Consistent code formatting
- **Strict Mode**: Full TypeScript strict mode enabled

### Adding New Sources

1. Create a new fetcher class extending `BaseFetcher`
2. Implement the `fetchItems` method
3. Add the fetcher to `FetcherFactory`
4. Update source type definitions

Example:
```typescript
@Injectable()
export class CustomFetcher extends BaseFetcher {
  async fetchItems(source: Source, watermark?: string) {
    // Implementation
    return { items: [], nextWatermark: undefined };
  }
}
```

## Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check database status
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
npm run prisma:migrate
```

**Redis Connection Issues**
```bash
# Check Redis status
docker-compose logs redis

# Clear Redis data
docker-compose exec redis redis-cli FLUSHALL
```

**OpenAI API Issues**
- Verify API key is valid and has sufficient credits
- Check assistant ID is correct
- Review OpenAI API usage limits

**Slack Integration Issues**
- Verify bot token has required scopes
- Check workspace installation
- Validate signing secret configuration

### Logging

Enable debug logging:
```bash
LOG_LEVEL=debug npm run start:dev
```

### Performance Tuning

- Adjust `max_items_per_run` for processing batches
- Configure Redis memory limits
- Tune database connection pooling
- Monitor task queue performance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure code passes linting and formatting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review API documentation at `/api`
- Open an issue on GitHub

---

Built with ❤️ using NestJS, TypeScript, and modern development practices.