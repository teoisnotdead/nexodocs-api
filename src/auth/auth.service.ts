import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipRole, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthUserResponse, TokenPayload } from './auth.types';

type RequestMetadata = {
  userAgent?: string;
  ipAddress?: string;
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  memberships: {
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    take: 1,
    select: {
      id: true,
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata) {
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: dto.organizationName,
            legalName: dto.organizationName,
            industry: 'Servicios profesionales',
            onboardingCompleted: false,
          },
          select: { id: true },
        });

        const createdUser = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
          },
          select: { id: true },
        });

        await tx.membership.create({
          data: {
            organizationId: organization.id,
            userId: createdUser.id,
            role: MembershipRole.OWNER,
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: createdUser.id },
          select: userSelect,
        });
      });

      return this.createSessionResponse(user, metadata, true);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }

      throw error;
    }
  }

  async login(dto: LoginDto, metadata: RequestMetadata) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: userSelect,
    });

    if (
      !user?.passwordHash ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSessionResponse(user, metadata, dto.rememberMe ?? false);
  }

  async refresh(refreshToken: string, metadata: RequestMetadata) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const rememberMe = payload.rememberMe ?? true;
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true,
        userId: true,
        refreshTokenHash: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: userSelect },
      },
    });

    if (
      !session ||
      session.userId !== payload.userId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !(await argon2.verify(session.refreshTokenHash, refreshToken))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.signTokens(session.user, session.id, rememberMe);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await argon2.hash(tokens.refreshToken),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        expiresAt: this.refreshExpiresAt(rememberMe),
      },
    });

    return { user: this.toUserResponse(session.user), rememberMe, ...tokens };
  }

  async logout(refreshToken: string | null) {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.prisma.authSession.updateMany({
        where: {
          id: payload.sessionId,
          userId: payload.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } catch {
      return;
    }
  }

  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toUserResponse(user);
  }

  private async createSessionResponse(
    user: SelectedUser,
    metadata: RequestMetadata,
    rememberMe: boolean,
  ) {
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'pending',
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        expiresAt: this.refreshExpiresAt(rememberMe),
      },
      select: { id: true },
    });
    const tokens = await this.signTokens(user, session.id, rememberMe);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: await argon2.hash(tokens.refreshToken) },
    });

    return { user: this.toUserResponse(user), rememberMe, ...tokens };
  }

  private async signTokens(
    user: SelectedUser,
    sessionId: string,
    rememberMe: boolean,
  ) {
    const authUser = this.toUserResponse(user);
    const payload: TokenPayload = {
      userId: authUser.id,
      organizationId: authUser.organizationId,
      membershipId: authUser.membershipId,
      role: authUser.role,
      sessionId,
      rememberMe,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.accessSecret(),
      expiresIn: this.accessTtlSeconds(),
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.refreshSecret(),
      expiresIn: this.refreshTtlSeconds(rememberMe),
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private toUserResponse(user: SelectedUser): AuthUserResponse {
    const membership = user.memberships[0];

    if (!membership) {
      throw new UnauthorizedException('No active organization membership');
    }

    return {
      id: user.id,
      organizationId: membership.organization.id,
      membershipId: membership.id,
      name: user.name,
      email: user.email,
      role: membership.role,
      organization: membership.organization,
    };
  }

  private accessSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'dev_access_secret'
    );
  }

  private refreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'dev_refresh_secret'
    );
  }

  refreshDays(): number {
    return Number(this.configService.get<string>('JWT_REFRESH_DAYS') ?? 30);
  }

  private sessionRefreshDays(): number {
    return Number(
      this.configService.get<string>('JWT_SESSION_REFRESH_DAYS') ?? 1,
    );
  }

  accessTtlSeconds(): number {
    const configured = this.configService.get<string>('JWT_ACCESS_TTL_SECONDS');

    return configured ? Number(configured) : 60 * 60;
  }

  private refreshTtlSeconds(rememberMe: boolean): number {
    return this.refreshLifetimeDays(rememberMe) * 24 * 60 * 60;
  }

  private refreshExpiresAt(rememberMe: boolean): Date {
    return new Date(
      Date.now() + this.refreshLifetimeDays(rememberMe) * 24 * 60 * 60 * 1000,
    );
  }

  private refreshLifetimeDays(rememberMe: boolean): number {
    return rememberMe ? this.refreshDays() : this.sessionRefreshDays();
  }
}
