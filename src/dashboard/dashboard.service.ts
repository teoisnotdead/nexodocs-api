import { Injectable } from '@nestjs/common';
import {
  ClientStatus,
  DocumentRequestStatus,
  Prisma,
  WorkspaceStatus,
} from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';

const openWorkspaceStatuses = [
  WorkspaceStatus.DRAFT,
  WorkspaceStatus.ACTIVE,
  WorkspaceStatus.WAITING_CLIENT,
  WorkspaceStatus.IN_REVIEW,
  WorkspaceStatus.WAITING_APPROVAL,
];

const pendingRequestStatuses = [
  DocumentRequestStatus.DRAFT,
  DocumentRequestStatus.PENDING,
  DocumentRequestStatus.OBSERVED,
  DocumentRequestStatus.OVERDUE,
];

const closedRequestStatuses = [
  DocumentRequestStatus.APPROVED,
  DocumentRequestStatus.REJECTED,
  DocumentRequestStatus.CANCELLED,
];

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

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async summary(organizationId: string) {
    const now = new Date();
    const dueSoonLimit = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);

    const [
      totalClients,
      activeWorkspaces,
      pendingRequests,
      overdueRequests,
      completedRequests,
      recentWorkspaces,
      dueSoonRequests,
    ] = await this.prisma.$transaction([
      this.prisma.client.count({
        where: { organizationId, status: { not: ClientStatus.ARCHIVED } },
      }),
      this.prisma.workspace.count({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: openWorkspaceStatuses },
        },
      }),
      this.prisma.documentRequest.count({
        where: {
          organizationId,
          status: { in: pendingRequestStatuses },
        },
      }),
      this.prisma.documentRequest.count({
        where: {
          organizationId,
          OR: [
            { status: DocumentRequestStatus.OVERDUE },
            {
              dueDate: { lt: now },
              status: { notIn: closedRequestStatuses },
            },
          ],
        },
      }),
      this.prisma.documentRequest.count({
        where: {
          organizationId,
          status: DocumentRequestStatus.APPROVED,
        },
      }),
      this.prisma.workspace.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              industry: true,
              status: true,
            },
          },
          _count: {
            select: {
              documentRequests: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      this.prisma.documentRequest.findMany({
        where: {
          organizationId,
          dueDate: { lte: dueSoonLimit },
          status: { notIn: closedRequestStatuses },
        },
        include: {
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
          assignedClientContact: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 5,
      }),
    ]);
    const recentActivity = await this.activityLogs.listRecent(organizationId, 5);

    return {
      totalClients,
      activeWorkspaces,
      pendingRequests,
      overdueRequests,
      completedRequests,
      recentWorkspaces,
      dueSoonRequests,
      recentActivity: recentActivity.items.map((activity) =>
        this.toDashboardActivity(activity),
      ),
    };
  }

  private toDashboardActivity(
    activity: Prisma.ActivityLogGetPayload<{ include: typeof activityInclude }>,
  ) {
    const metadata = this.metadata(activity.metadata);
    const title = this.activityTitle(activity.action, metadata);
    const workspace = activity.workspace;
    const description =
      workspace && workspace.client
        ? `${workspace.client.name} - ${workspace.name}`
        : this.activityDescription(activity.action, metadata);

    return {
      id: activity.id,
      title,
      description,
      createdAt: activity.createdAt,
      kind: activity.entityType,
    };
  }

  private metadata(value: Prisma.JsonValue | null) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  }

  private text(metadata: Record<string, unknown>, key: string) {
    const value = metadata[key];
    return typeof value === 'string' ? value : null;
  }

  private activityTitle(action: string, metadata: Record<string, unknown>) {
    const named =
      this.text(metadata, 'title') ??
      this.text(metadata, 'workspaceName') ??
      this.text(metadata, 'clientName');

    const labels: Record<string, string> = {
      CLIENT_CREATED: `Cliente creado${named ? `: ${named}` : ''}`,
      WORKSPACE_CREATED: `Proceso creado${named ? `: ${named}` : ''}`,
      WORKSPACE_STATUS_CHANGED: `Proceso actualizado${named ? `: ${named}` : ''}`,
      DOCUMENT_REQUEST_CREATED: `Solicitud creada${named ? `: ${named}` : ''}`,
      DOCUMENT_REQUEST_STATUS_CHANGED: `Solicitud actualizada${named ? `: ${named}` : ''}`,
      DOCUMENT_MOCK_UPLOADED: `Documento recibido${named ? `: ${named}` : ''}`,
      DOCUMENT_APPROVED: `Documento aprobado${named ? `: ${named}` : ''}`,
      DOCUMENT_OBSERVED: `Documento observado${named ? `: ${named}` : ''}`,
      DOCUMENT_REJECTED: `Documento rechazado${named ? `: ${named}` : ''}`,
      DELIVERY_CREATED: `Entrega creada${named ? `: ${named}` : ''}`,
      DELIVERY_SENT: `Entrega enviada${named ? `: ${named}` : ''}`,
      DELIVERY_APPROVED: `Entrega aprobada${named ? `: ${named}` : ''}`,
      DELIVERY_OBSERVED: `Entrega observada${named ? `: ${named}` : ''}`,
      DELIVERY_STATUS_CHANGED: `Entrega actualizada${named ? `: ${named}` : ''}`,
    };

    return labels[action] ?? 'Movimiento registrado';
  }

  private activityDescription(
    action: string,
    metadata: Record<string, unknown>,
  ) {
    const from = this.text(metadata, 'from');
    const to = this.text(metadata, 'to');

    if (from && to) {
      return `Cambio de estado: ${from} a ${to}`;
    }

    const labels: Record<string, string> = {
      CLIENT_CREATED: 'Nuevo cliente disponible en la cartera.',
      WORKSPACE_CREATED: 'Nuevo proceso listo para coordinar.',
      DOCUMENT_MOCK_UPLOADED: 'Archivo registrado para revision.',
      DELIVERY_SENT: 'Documentos compartidos con el cliente.',
    };

    return labels[action] ?? 'Movimiento relevante registrado.';
  }
}
