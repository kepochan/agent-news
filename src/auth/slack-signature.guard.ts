import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@/config/config.service';
import * as crypto from 'crypto';

@Injectable()
export class SlackSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    const slackSignature = request.headers['x-slack-signature'];
    const slackTimestamp = request.headers['x-slack-request-timestamp'];
    const body = request.body;

    if (!slackSignature || !slackTimestamp) {
      throw new BadRequestException('Missing Slack signature headers');
    }

    // Check timestamp freshness (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(slackTimestamp, 10);

    if (Math.abs(currentTime - requestTime) > 300) {
      throw new UnauthorizedException('Request timestamp too old');
    }

    // Verify signature
    const signingSecret = this.configService.slackSigningSecret;
    const baseString = `v0:${slackTimestamp}:${JSON.stringify(body)}`;
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(slackSignature),
      Buffer.from(expectedSignature)
    )) {
      throw new UnauthorizedException('Invalid Slack signature');
    }

    return true;
  }
}