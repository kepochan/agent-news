import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // This route initiates Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    
    if (!user) {
      // User not in whitelist or authentication failed
      return res.redirect('http://localhost:3000?error=unauthorized');
    }

    const result = await this.authService.login(user);
    
    // Redirect to frontend with token
    return res.redirect(
      `http://localhost:3000?token=${result.access_token}&user=${encodeURIComponent(JSON.stringify(result.user))}`
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: Request) {
    return req.user;
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  getSession(@Req() req: Request) {
    return {
      user: req.user,
      authenticated: true
    };
  }
}