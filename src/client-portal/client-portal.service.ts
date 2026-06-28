import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientPortalAccessDto } from './dto/create-client-portal-access.dto';
import { VerifyClientPortalCodeDto } from './dto/verify-client-portal-code.dto';

const MAX_CODE_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DEFAULT_EXPIRES_IN_DAYS = 14;
const PORTAL_SESSION_TTL_SECONDS = 8 * 60 * 60;

const portalAccessInclude = {
  organization: {
    select: {
      id: true,
      name: true,
    },
  },
  workspace: {
    select: {
      id: true,
      name: true,
      description: true,
      dueDate: true,
      status: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  clientContact: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
} satisfies Prisma.ClientPortalAccessInclude;

const portalDocumentInclude = {
  versions: {
    orderBy: { versionNumber: 'desc' },
    include: {
      fileAsset: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      uploadedByClientContact: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  uploadedByClientContact: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  reviews: {
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  observations: {
    orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      resolvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.DocumentInclude;

type PortalAccess = Prisma.ClientPortalAccessGetPayload<{
  include: typeof portalAccessInclude;
}>;

type PortalSessionPayload = {
  type: 'client_portal';
  portalAccessId: string;
  organizationId: string;
  workspaceId: string;
  clientId: string;
  clientContactId: string;
};

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createAccess(
    organizationId: string,
    userId: string,
    workspaceId: string,
    dto: CreateClientPortalAccessDto,
  ) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, organizationId, deletedAt: null },
      select: {
        id: true,
        clientId: true,
        client: {
          select: {
            id: true,
            contacts: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const contact = dto.clientContactId
      ? workspace.client.contacts.find((item) => item.id === dto.clientContactId)
      : workspace.client.contacts[0];

    if (!contact) {
      throw new BadRequestException(
        'Client needs at least one contact before sharing the portal',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = this.expiresAt(dto.expiresInDays);
    const codeHash = await argon2.hash(code);
    const tokenHash = this.hashToken(token);

    const access = await this.prisma.$transaction(async (tx) => {
      await tx.clientPortalAccess.updateMany({
        where: {
          organizationId,
          workspaceId,
          clientContactId: contact.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return tx.clientPortalAccess.create({
        data: {
          organizationId,
          workspaceId,
          clientId: workspace.clientId,
          clientContactId: contact.id,
          createdById: userId,
          tokenHash,
          codeHash,
          expiresAt,
          codeExpiresAt: expiresAt,
        },
        include: portalAccessInclude,
      });
    });

    return {
      ...this.toAccessResponse(access),
      token,
      code,
      portalPath: `/portal/${token}`,
      sessionExpiresInSeconds: PORTAL_SESSION_TTL_SECONDS,
    };
  }

  async inspectAccess(token: string) {
    const access = await this.getActiveAccessByToken(token);

    return {
      ...this.toAccessResponse(access),
      requiresCode: true,
      sessionExpiresInSeconds: PORTAL_SESSION_TTL_SECONDS,
    };
  }

  async verifyCode(token: string, dto: VerifyClientPortalCodeDto) {
    const access = await this.getActiveAccessByToken(token);
    const now = new Date();

    if (access.lockedUntil && access.lockedUntil.getTime() > now.getTime()) {
      throw new ForbiddenException('Portal code is temporarily locked');
    }

    if (access.codeExpiresAt.getTime() <= now.getTime()) {
      throw new ForbiddenException('Portal code expired');
    }

    const isValid = await argon2.verify(access.codeHash, dto.code);

    if (!isValid) {
      const failedAttempts = access.failedAttempts + 1;
      await this.prisma.clientPortalAccess.update({
        where: { id: access.id },
        data: {
          failedAttempts,
          lockedUntil:
            failedAttempts >= MAX_CODE_ATTEMPTS
              ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
              : null,
        },
      });
      throw new UnauthorizedException('Invalid portal code');
    }

    await this.prisma.clientPortalAccess.update({
      where: { id: access.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastUsedAt: now,
      },
    });

    const portalSessionToken = await this.signPortalSession(access);

    return {
      ...this.toAccessResponse(access),
      portalSessionToken,
      sessionExpiresInSeconds: PORTAL_SESSION_TTL_SECONDS,
    };
  }

  async listDocumentRequests(token: string, sessionToken: string | null) {
    const access = await this.verifyPortalSession(token, sessionToken);
    const [items, pending, submitted, inReview, observed, approved] =
      await this.prisma.$transaction([
        this.prisma.documentRequest.findMany({
          where: this.visibleRequestWhere(access),
          include: {
            assignedClientContact: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
              },
            },
            documents: {
              include: portalDocumentInclude,
              orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            },
          },
          orderBy: [
            { status: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.documentRequest.count({
          where: {
            ...this.visibleRequestWhere(access),
            status: 'PENDING',
          },
        }),
        this.prisma.documentRequest.count({
          where: {
            ...this.visibleRequestWhere(access),
            status: 'SUBMITTED',
          },
        }),
        this.prisma.documentRequest.count({
          where: {
            ...this.visibleRequestWhere(access),
            status: 'IN_REVIEW',
          },
        }),
        this.prisma.documentRequest.count({
          where: {
            ...this.visibleRequestWhere(access),
            status: 'OBSERVED',
          },
        }),
        this.prisma.documentRequest.count({
          where: {
            ...this.visibleRequestWhere(access),
            status: 'APPROVED',
          },
        }),
      ]);

    return {
      access: this.toAccessResponse(access),
      items,
      summary: {
        pending,
        submitted,
        inReview,
        observed,
        approved,
      },
    };
  }

  async uploadDocument(
    token: string,
    sessionToken: string | null,
    documentRequestId: string,
    file: Express.Multer.File | undefined,
    notes?: string,
  ) {
    const access = await this.verifyPortalSession(token, sessionToken);

    return this.documentsService.uploadFromClientPortal(
      {
        organizationId: access.organizationId,
        workspaceId: access.workspaceId,
        clientContactId: access.clientContactId,
      },
      documentRequestId,
      file,
      notes,
    );
  }

  async createDocumentDownloadUrl(
    token: string,
    sessionToken: string | null,
    documentId: string,
  ) {
    const access = await this.verifyPortalSession(token, sessionToken);
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId: access.organizationId,
        documentRequest: this.visibleRequestWhere(access),
      },
      select: { id: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.documentsService.createDownloadUrl(access.organizationId, documentId);
  }

  private async getActiveAccessByToken(token: string) {
    const access = await this.prisma.clientPortalAccess.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: portalAccessInclude,
    });

    if (
      !access ||
      access.revokedAt ||
      access.expiresAt.getTime() <= Date.now()
    ) {
      throw new NotFoundException('Portal access not found');
    }

    return access;
  }

  private async verifyPortalSession(
    token: string,
    sessionToken: string | null,
  ) {
    if (!sessionToken) {
      throw new UnauthorizedException('Portal session required');
    }

    const access = await this.getActiveAccessByToken(token);

    try {
      const payload =
        await this.jwtService.verifyAsync<PortalSessionPayload>(sessionToken, {
          secret: this.portalSessionSecret(),
        });

      if (
        payload.type !== 'client_portal' ||
        payload.portalAccessId !== access.id ||
        payload.organizationId !== access.organizationId ||
        payload.workspaceId !== access.workspaceId ||
        payload.clientContactId !== access.clientContactId
      ) {
        throw new Error('Invalid portal session');
      }

      return access;
    } catch {
      throw new UnauthorizedException('Invalid or expired portal session');
    }
  }

  private signPortalSession(access: PortalAccess) {
    const payload: PortalSessionPayload = {
      type: 'client_portal',
      portalAccessId: access.id,
      organizationId: access.organizationId,
      workspaceId: access.workspaceId,
      clientId: access.clientId,
      clientContactId: access.clientContactId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.portalSessionSecret(),
      expiresIn: PORTAL_SESSION_TTL_SECONDS,
    });
  }

  private visibleRequestWhere(access: PortalAccess) {
    return {
      organizationId: access.organizationId,
      workspaceId: access.workspaceId,
      OR: [
        { assignedClientContactId: access.clientContactId },
        { assignedClientContactId: null },
      ],
    } satisfies Prisma.DocumentRequestWhereInput;
  }

  private toAccessResponse(access: PortalAccess) {
    return {
      id: access.id,
      expiresAt: access.expiresAt,
      lastUsedAt: access.lastUsedAt,
      organization: access.organization,
      workspace: access.workspace,
      client: access.client,
      clientContact: access.clientContact,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiresAt(days = DEFAULT_EXPIRES_IN_DAYS) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private portalSessionSecret() {
    const secret =
      this.configService.get<string>('CLIENT_PORTAL_JWT_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET');

    if (!secret) {
      throw new Error('CLIENT_PORTAL_JWT_SECRET or JWT_ACCESS_SECRET is required');
    }

    return secret;
  }
}
