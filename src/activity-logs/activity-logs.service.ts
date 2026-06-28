import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const activityInclude = {
  workspace: {
    select: {
      id: true,
      name: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ActivityLogInclude;

type ActivityPrisma = PrismaService | Prisma.TransactionClient;

type CreateActivityInput = {
  organizationId: string;
  workspaceId?: string | null;
  actorId: string;
  actorType?: ActivityActorType;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

type ListActivityInput = {
  limit?: string | number;
  offset?: string | number;
};

const DEFAULT_WORKSPACE_ACTIVITY_LIMIT = 10;
const MAX_WORKSPACE_ACTIVITY_LIMIT = 50;

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateActivityInput, tx?: Prisma.TransactionClient) {
    const client: ActivityPrisma = tx ?? this.prisma;

    return client.activityLog.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId ?? undefined,
        actorType: input.actorType ?? ActivityActorType.USER,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? undefined,
        metadata: input.metadata ? this.toJson(input.metadata) : undefined,
      },
      include: activityInclude,
    });
  }

  async listRecent(organizationId: string, take = 5) {
    const items = await this.prisma.activityLog.findMany({
      where: { organizationId },
      include: activityInclude,
      orderBy: { createdAt: 'desc' },
      take,
    });

    return { items };
  }

  async listByWorkspace(
    organizationId: string,
    workspaceId: string,
    input: ListActivityInput = {},
  ) {
    await this.ensureWorkspace(organizationId, workspaceId);
    const limit = this.clampPositiveInteger(
      input.limit,
      DEFAULT_WORKSPACE_ACTIVITY_LIMIT,
      MAX_WORKSPACE_ACTIVITY_LIMIT,
    );
    const offset = this.parseNonNegativeInteger(input.offset, 0);

    const where = { organizationId, workspaceId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        include: activityInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  private async ensureWorkspace(organizationId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
  }

  private toJson(metadata: Record<string, unknown>): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined),
    ) as Prisma.InputJsonObject;
  }

  private clampPositiveInteger(
    value: string | number | undefined,
    fallback: number,
    max: number,
  ) {
    const parsed = this.parseInteger(value);

    if (parsed === null || parsed < 1) {
      return fallback;
    }

    return Math.min(parsed, max);
  }

  private parseNonNegativeInteger(
    value: string | number | undefined,
    fallback: number,
  ) {
    const parsed = this.parseInteger(value);

    return parsed === null || parsed < 0 ? fallback : parsed;
  }

  private parseInteger(value: string | number | undefined) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) ? parsed : null;
  }
}
