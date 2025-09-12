import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli.module';

async function bootstrap() {
  await CommandFactory.run(CliModule, ['warn', 'error']);
}

bootstrap().catch((error) => {
  console.error('CLI failed to start:', error);
  process.exit(1);
});