import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getMembers(@Req() req: Request) {
    const currentUser = req.user as any;
    
    // Only admin can view all members
    if (currentUser?.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    return this.prisma.member.findMany({
      orderBy: { email: 'asc' },
    });
  }

  @Post()
  async addMember(@Req() req: Request, @Body() body: { email: string; role: 'admin' | 'user' }) {
    const currentUser = req.user as any;
    
    // Only admin can add members
    if (currentUser?.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    return this.prisma.member.create({
      data: {
        email: body.email,
        role: body.role,
        isActive: true,
      },
    });
  }

  @Put(':id')
  async updateMember(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { role?: 'admin' | 'user'; isActive?: boolean }
  ) {
    const currentUser = req.user as any;
    
    // Only admin can update members
    if (currentUser?.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    return this.prisma.member.update({
      where: { id },
      data: body,
    });
  }

  @Delete(':id')
  async removeMember(@Req() req: Request, @Param('id') id: string) {
    const currentUser = req.user as any;
    
    // Only admin can remove members
    if (currentUser?.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    return this.prisma.member.delete({
      where: { id },
    });
  }

  @Get('me')
  async getCurrentMember(@Req() req: Request) {
    const currentUser = req.user as any;
    
    return this.prisma.member.findUnique({
      where: { email: currentUser.email },
    });
  }
}