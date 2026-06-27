import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import type { AuthResponse, AuthUserResponse } from './auth.types';
import { clearAuthCookies, getCookie, setAuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(dto, this.metadata(request));
    this.setCookies(response, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto, this.metadata(request));
    this.setCookies(response, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const refreshToken = getCookie(request.headers.cookie, 'refresh_token');

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refresh(
      refreshToken,
      this.metadata(request),
    );
    this.setCookies(response, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      getCookie(request.headers.cookie, 'refresh_token'),
    );
    clearAuthCookies(response, this.cookieSecure());

    return { success: true };
  }

  private setCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    setAuthCookies(response, accessToken, refreshToken, {
      secure: this.cookieSecure(),
      refreshDays: this.authService.refreshDays(),
    });
  }

  private cookieSecure(): boolean {
    return this.configService.get<string>('COOKIE_SECURE') === 'true';
  }

  private metadata(request: Request) {
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    };
  }
}

@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  me(@Req() request: AuthenticatedRequest): Promise<AuthUserResponse> {
    return this.authService.me(request.user!.userId);
  }
}
