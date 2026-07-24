import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import type { User } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('google')
  googleAuth(@Req() req: Request, @Res() res: Response): void {
    const state = uuid();
    req.session.state = state;
    const url = this.authService.getGoogleAuthURL(state);
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<void> {
    const savedState = req.session.state;
    if (!state || state !== savedState) {
      throw new UnauthorizedException(
        'Invalid state parameter — possible CSRF',
      );
    }

    const { accessToken } = await this.authService.exchangeCode(code);
    const profile = await this.authService.fetchGoogleProfile(accessToken);
    const user: User = await this.authService.findOrCreateUser(profile);

    req.session.userId = user.id;

    const frontendUrl = this.authService.getFrontendUrl();
    res.redirect(frontendUrl);
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out' });
    });
  }

  @Get('me')
  async me(@Req() req: Request): Promise<User> {
    const userId = req.session.userId;
    if (!userId) throw new UnauthorizedException('Not authenticated');
    return this.usersService.findById(userId);
  }
}
