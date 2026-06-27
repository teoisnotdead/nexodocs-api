import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../types/authenticated-request';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        },
      );
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractAccessToken(request: AuthenticatedRequest): string | null {
    const authorization = request.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice(7);
    }

    return this.extractCookie(request, 'access_token');
  }

  private extractCookie(
    request: AuthenticatedRequest,
    name: string,
  ): string | null {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const cookie = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
  }
}
