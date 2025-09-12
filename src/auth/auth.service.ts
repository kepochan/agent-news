import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validateGoogleUser(profile: any): Promise<any> {
    const { id, emails, displayName, photos } = profile;
    const email = emails[0].value;
    const image = photos && photos.length > 0 ? photos[0].value : null;

    // Check if user is in whitelist
    const member = await this.prisma.member.findUnique({
      where: { email },
    });

    if (!member || !member.isActive) {
      return null;
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: displayName,
          googleId: id,
          role: member.role,
          image,
        },
      });
    } else {
      // Update image if it has changed
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { image },
      });
    }

    return user;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
      },
    };
  }

  async validateJwtUser(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return null;
    }

    // Check if still in whitelist and active
    const member = await this.prisma.member.findUnique({
      where: { email: user.email },
    });

    if (!member || !member.isActive) {
      return null;
    }

    return user;
  }
}