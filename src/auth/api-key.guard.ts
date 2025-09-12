import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@/config/config.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization type. Expected Bearer token');
    }

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const validApiKey = this.configService.apiKey;
    if (token !== validApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Add API key info to request for logging
    request.apiKey = token.substring(0, 8) + '...';

    return true;
  }
}