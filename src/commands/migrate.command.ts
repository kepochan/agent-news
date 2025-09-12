import { Command, CommandRunner } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Command({
  name: 'migrate',
  description: 'Run database migrations',
})
export class MigrateCommand extends CommandRunner {
  private readonly logger = new Logger(MigrateCommand.name);

  async run(): Promise<void> {
    try {
      this.logger.log('Running database migrations...');
      
      const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
      
      if (stdout) {
        this.logger.log(stdout);
      }
      
      if (stderr) {
        this.logger.warn(stderr);
      }
      
      this.logger.log('Database migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed:', error);
      process.exit(1);
    }
  }
}