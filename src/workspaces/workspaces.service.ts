import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientStatus,
  DocumentRequestStatus,
  Prisma,
  WorkspaceStatus,
  WorkspaceType,
} from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

const workspaceInclude = {
  client: {
    select: {
      id: true,
      name: true,
      industry: true,
      status: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.WorkspaceInclude;

const emptyDocumentRequestSummary = {
  pending: 0,
  submitted: 0,
  approved: 0,
  rejected: 0,
};

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
    private readonly plansService: PlansService,
  ) {}

  async list(
    organizationId: string,
    options: {
      status?: WorkspaceStatus;
      clientId?: string;
      search?: string;
    } = {},
  ) {
    const search = options.search?.trim();
    const where: Prisma.WorkspaceWhereInput = {
      organizationId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { client: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, active, waitingClient, inReview, completed] =
      await this.prisma.$transaction([
        this.prisma.workspace.findMany({
          where,
          include: workspaceInclude,
          orderBy: [
            { status: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.workspace.count({
          where: {
            organizationId,
            deletedAt: null,
            status: WorkspaceStatus.ACTIVE,
          },
        }),
        this.prisma.workspace.count({
          where: {
            organizationId,
            deletedAt: null,
            status: WorkspaceStatus.WAITING_CLIENT,
          },
        }),
        this.prisma.workspace.count({
          where: {
            organizationId,
            deletedAt: null,
            status: WorkspaceStatus.IN_REVIEW,
          },
        }),
        this.prisma.workspace.count({
          where: {
            organizationId,
            deletedAt: null,
            status: WorkspaceStatus.COMPLETED,
          },
        }),
      ]);
    const documentRequestSummaries = await this.documentRequestSummaries(
      organizationId,
      items.map((item) => item.id),
    );

    return {
      items: items.map((item) => ({
        ...item,
        documentRequestSummary:
          documentRequestSummaries.get(item.id) ?? emptyDocumentRequestSummary,
      })),
      summary: {
        active,
        waitingClient,
        inReview,
        completed,
      },
    };
  }

  async stats(organizationId: string) {
    const [openWorkspaces, waitingClient, dueSoon] =
      await this.prisma.$transaction([
        this.prisma.workspace.count({
          where: {
            organizationId,
            deletedAt: null,
            status: {
              in: [
                WorkspaceStatus.DRAFT,
                WorkspaceStatus.ACTIVE,
                WorkspaceStatus.WAITING_CLIENT,
                WorkspaceStatus.IN_REVIEW,
                WorkspaceStatus.WAITING_APPROVAL,
              ],
            },
          },
        }),
        this.prisma.workspace.count({
          where: {
            organizationId,
            deletedAt: null,
            status: WorkspaceStatus.WAITING_CLIENT,
          },
        }),
        this.prisma.workspace.count({
          where: {
            organizationId,
            deletedAt: null,
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
            },
            status: {
              notIn: [
                WorkspaceStatus.COMPLETED,
                WorkspaceStatus.CANCELLED,
                WorkspaceStatus.ARCHIVED,
              ],
            },
          },
        }),
      ]);

    return { openWorkspaces, waitingClient, dueSoon };
  }

  async listByClient(organizationId: string, clientId: string) {
    await this.ensureClient(organizationId, clientId);

    return this.list(organizationId, { clientId });
  }

  async get(organizationId: string, id: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: workspaceInclude,
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateWorkspaceDto,
  ) {
    await this.ensureClient(organizationId, dto.clientId);
    await this.plansService.assertCanCreateWorkspace(
      organizationId,
      WorkspaceStatus.ACTIVE,
    );

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: this.createData(organizationId, userId, dto),
        include: workspaceInclude,
      });

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId: workspace.id,
          actorId: userId,
          action: 'WORKSPACE_CREATED',
          entityType: 'Workspace',
          entityId: workspace.id,
          metadata: {
            workspaceName: workspace.name,
            clientName: workspace.client.name,
            status: workspace.status,
          },
        },
        tx,
      );

      return workspace;
    });
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.get(organizationId, id);

    if (dto.clientId && dto.clientId !== workspace.clientId) {
      await this.ensureClient(organizationId, dto.clientId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id },
        data: this.updateData(dto, workspace.closedAt),
        include: workspaceInclude,
      });

      if (dto.status && dto.status !== workspace.status) {
        await this.activityLogs.create(
          {
            organizationId,
            workspaceId: updated.id,
            actorId: userId,
            action: 'WORKSPACE_STATUS_CHANGED',
            entityType: 'Workspace',
            entityId: updated.id,
            metadata: {
              workspaceName: updated.name,
              from: workspace.status,
              to: updated.status,
            },
          },
          tx,
        );
      }

      return updated;
    });
  }

  async archive(organizationId: string, userId: string, id: string) {
    const workspace = await this.get(organizationId, id);

    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.workspace.update({
        where: { id },
        data: {
          status: WorkspaceStatus.ARCHIVED,
          deletedAt: new Date(),
        },
        include: workspaceInclude,
      });

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId: archived.id,
          actorId: userId,
          action: 'WORKSPACE_STATUS_CHANGED',
          entityType: 'Workspace',
          entityId: archived.id,
          metadata: {
            workspaceName: archived.name,
            from: workspace.status,
            to: archived.status,
          },
        },
        tx,
      );

      return archived;
    });
  }

  private async ensureClient(organizationId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
        status: { not: ClientStatus.ARCHIVED },
      },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  private createData(
    organizationId: string,
    userId: string,
    dto: CreateWorkspaceDto,
  ): Prisma.WorkspaceUncheckedCreateInput {
    const status = WorkspaceStatus.ACTIVE;

    return {
      organizationId,
      createdById: userId,
      clientId: dto.clientId,
      name: dto.name,
      description: dto.description,
      workspaceType: dto.workspaceType ?? WorkspaceType.GENERIC_PROCESS,
      periodYear: dto.periodYear,
      periodMonth: dto.periodMonth,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status,
    };
  }

  private updateData(
    dto: UpdateWorkspaceDto,
    currentClosedAt: Date | null,
  ): Prisma.WorkspaceUncheckedUpdateInput {
    const data: Prisma.WorkspaceUncheckedUpdateInput = {
      clientId: dto.clientId,
      name: dto.name,
      description: dto.description,
      workspaceType: dto.workspaceType,
      periodYear: dto.periodYear,
      periodMonth: dto.periodMonth,
      dueDate:
        dto.dueDate === null
          ? null
          : dto.dueDate
            ? new Date(dto.dueDate)
            : undefined,
      status: dto.status,
    };

    if (dto.status === WorkspaceStatus.COMPLETED) {
      data.closedAt = currentClosedAt ?? new Date();
    } else if (dto.status) {
      data.closedAt = null;
    }

    return data;
  }

  private async documentRequestSummaries(
    organizationId: string,
    workspaceIds: string[],
  ) {
    const summaries = new Map<
      string,
      typeof emptyDocumentRequestSummary
    >();

    if (workspaceIds.length === 0) {
      return summaries;
    }

    const groups = await this.prisma.documentRequest.groupBy({
      by: ['workspaceId', 'status'],
      where: {
        organizationId,
        workspaceId: { in: workspaceIds },
      },
      _count: { _all: true },
    });

    for (const group of groups) {
      const summary = summaries.get(group.workspaceId) ?? {
        ...emptyDocumentRequestSummary,
      };
      const count = group._count._all;

      if (this.isPendingRequestStatus(group.status)) {
        summary.pending += count;
      } else if (this.isSubmittedRequestStatus(group.status)) {
        summary.submitted += count;
      } else if (group.status === DocumentRequestStatus.APPROVED) {
        summary.approved += count;
      } else {
        summary.rejected += count;
      }

      summaries.set(group.workspaceId, summary);
    }

    return summaries;
  }

  private isPendingRequestStatus(status: DocumentRequestStatus) {
    const pendingStatuses: DocumentRequestStatus[] = [
      DocumentRequestStatus.DRAFT,
      DocumentRequestStatus.PENDING,
      DocumentRequestStatus.OVERDUE,
    ];

    return pendingStatuses.includes(status);
  }

  private isSubmittedRequestStatus(status: DocumentRequestStatus) {
    const submittedStatuses: DocumentRequestStatus[] = [
      DocumentRequestStatus.SUBMITTED,
      DocumentRequestStatus.RESUBMITTED,
      DocumentRequestStatus.IN_REVIEW,
    ];

    return submittedStatuses.includes(status);
  }
}
