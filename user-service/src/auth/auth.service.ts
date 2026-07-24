import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import type { User } from '../generated/prisma/client';
import type { GoogleProfile } from '../users/interfaces/user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  getGoogleAuthURL(state: string): string {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
    const redirectUri = this.configService.get<string>('GOOGLE_CALLBACK_URL');
    if (!redirectUri) throw new Error('GOOGLE_CALLBACK_URL is not configured');
    const scope = 'openid profile email';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  getFrontendUrl(): string {
    return this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:5173',
    );
  }

  private getJsonString(raw: unknown, key: string): string {
    if (typeof raw !== 'object' || raw === null) return '';
    const value: unknown = Reflect.get(raw, key);
    if (typeof value === 'string') return value;
    if (value == null) return '';
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    return '';
  }

  async exchangeCode(
    code: string,
  ): Promise<{ accessToken: string; idToken: string }> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth is not configured');
    }

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new UnauthorizedException(`Google token exchange failed: ${error}`);
    }

    const raw: unknown = await resp.json();
    return {
      accessToken: this.getJsonString(raw, 'access_token'),
      idToken: this.getJsonString(raw, 'id_token'),
    };
  }

  async fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      throw new UnauthorizedException('Failed to fetch Google profile');
    }

    const raw: unknown = await resp.json();
    return {
      sub: this.getJsonString(raw, 'sub'),
      email: this.getJsonString(raw, 'email'),
      given_name: this.getJsonString(raw, 'given_name'),
      family_name: this.getJsonString(raw, 'family_name'),
      picture: this.getJsonString(raw, 'picture') || undefined,
    };
  }

  async findOrCreateUser(profile: GoogleProfile): Promise<User> {
    const existing = await this.usersService.findByGoogleId(profile.sub);
    if (existing) {
      return this.usersService.update(existing.id, {
        lastLoginAt: new Date(),
      });
    }

    return this.usersService.create({
      googleId: profile.sub,
      email: profile.email,
      firstName: profile.given_name,
      lastName: profile.family_name ?? '',
      avatarUrl: profile.picture,
    });
  }
}
