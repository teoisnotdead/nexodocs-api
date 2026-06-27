import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  DeliveryStatus,
  Prisma,
} from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { CreateDeliveryItemDto } from './dto/create-delivery-item.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

const actorSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

const deliveryInclude = {
  createdBy: {
    select: actorSelect,
  },
  items: {
    orderBy: { createdAt: 'desc' },
    include: {
      fileAsset: true,
      createdBy: {
        select: actorSelect,
      },
    },
  },
  approvals: {
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: actorSelect,
      },
    },
  },
} satisfies Prisma.DeliveryInclude;

const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  DRAFT: [DeliveryStatus.SENT, DeliveryStatus.CANCELLED],
  SENT: [
    DeliveryStatus.VIEWED,
    DeliveryStatus.APPROVED,
    DeliveryStatus.OBSERVED,
    DeliveryStatus.COMPLETED,
    DeliveryStatus.CANCELLED,
  ],
  VIEWED: [
    DeliveryStatus.APPROVED,
    DeliveryStatus.OBSERVED,
    DeliveryStatus.COMPLETED,
    DeliveryStatus.CANCELLED,
  ],
  APPROVED: [DeliveryStatus.COMPLETED],
  OBSERVED: [DeliveryStatus.SENT, DeliveryStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list(organizationId: string, workspaceId: string) {
    await this.ensureWorkspace(organizationId, workspaceId);

    const [items, draft, sent, approved, observed, completed] =
      await this.prisma.$transaction([
        this.prisma.delivery.findMany({
          where: { organizationId, workspaceId },
          include: deliveryInclude,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.delivery.count({
          where: { organizationId, workspaceId, status: DeliveryStatus.DRAFT },
        }),
        this.prisma.delivery.count({
          where: { organizationId, workspaceId, status: DeliveryStatus.SENT },
        }),
        this.prisma.delivery.count({
          where: {
            organizationId,
            workspaceId,
            status: DeliveryStatus.APPROVED,
          },
        }),
        this.prisma.delivery.count({
          where: {
            organizationId,
            workspaceId,
            status: DeliveryStatus.OBSERVED,
          },
        }),
        this.prisma.delivery.count({
          where: {
            organizationId,
            workspaceId,
            status: DeliveryStatus.COMPLETED,
          },
        }),
      ]);

    return {
      items,
      summary: {
        draft,
        sent,
        approved,
        observed,
        completed,
      },
    };
  }

  async create(
    organizationId: string,
    userId: string,
    workspaceId: string,
    dto: CreateDeliveryDto,
  ) {
    await this.ensureWorkspace(organizationId, workspaceId);

    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.create({
        data: {
          organizationId,
          workspaceId,
          createdById: userId,
          title: dto.title,
          description: dto.description,
        },
        include: deliveryInclude,
      });

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId,
          actorId: userId,
          action: 'DELIVERY_CREATED',
          entityType: 'Delivery',
          entityId: delivery.id,
          metadata: {
            title: delivery.title,
            status: delivery.status,
          },
        },
        tx,
      );

      return delivery;
    });
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateDeliveryStatusDto,
  ) {
    const delivery = await this.get(organizationId, id);
    this.assertTransition(delivery.status, dto.status);

    if (dto.status === DeliveryStatus.SENT && delivery.items.length === 0) {
      throw new BadRequestException('Delivery needs at least one item');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id },
        data: this.statusData(dto.status),
        include: deliveryInclude,
      });

      if (updated.status !== delivery.status) {
        await this.activityLogs.create(
          {
            organizationId,
            workspaceId: updated.workspaceId,
            actorId: userId,
            action:
              updated.status === DeliveryStatus.SENT
                ? 'DELIVERY_SENT'
                : 'DELIVERY_STATUS_CHANGED',
            entityType: 'Delivery',
            entityId: updated.id,
            metadata: {
              title: updated.title,
              from: delivery.status,
              to: updated.status,
            },
          },
          tx,
        );
      }

      return updated;
    });
  }

  async addItem(
    organizationId: string,
    userId: string,
    id: string,
    dto: CreateDeliveryItemDto,
  ) {
    const delivery = await this.get(organizationId, id);

    if (
      delivery.status === DeliveryStatus.COMPLETED ||
      delivery.status === DeliveryStatus.CANCELLED
    ) {
      throw new BadRequestException('Delivery cannot receive more items');
    }

    const fileName = dto.fileName ?? this.defaultFileName(delivery.title);
    const title = dto.title ?? fileName;
    const mimeType = dto.mimeType ?? 'application/pdf';
    const sizeBytes = dto.sizeBytes ?? 312_000;
    const storageKey = [
      'mock-deliveries',
      organizationId,
      id,
      `${Date.now()}-${this.safeFileName(fileName)}`,
    ].join('/');

    return this.prisma.$transaction(async (tx) => {
      const fileAsset = await tx.fileAsset.create({
        data: {
          organizationId,
          createdById: userId,
          storageKey,
          fileName,
          mimeType,
          sizeBytes,
          checksum: `mock-delivery-${Date.now()}`,
        },
      });

      const item = await tx.deliveryItem.create({
        data: {
          organizationId,
          deliveryId: delivery.id,
          fileAssetId: fileAsset.id,
          createdById: userId,
          title,
          description: dto.description,
        },
        include: {
          fileAsset: true,
          createdBy: {
            select: actorSelect,
          },
        },
      });

      return item;
    });
  }

  async createApproval(
    organizationId: string,
    userId: string,
    id: string,
    dto: CreateApprovalDto,
  ) {
    const delivery = await this.get(organizationId, id);

    return this.prisma.$transaction(async (tx) => {
      const approval = await tx.approval.create({
        data: {
          organizationId,
          deliveryId: id,
          createdById: userId,
          status: dto.status,
          comment: dto.comment,
        },
        include: {
          createdBy: {
            select: actorSelect,
          },
        },
      });

      const deliveryStatus = this.toDeliveryStatus(dto.status);
      if (deliveryStatus) {
        this.assertTransition(delivery.status, deliveryStatus);
        await tx.delivery.update({
          where: { id },
          data: this.statusData(deliveryStatus),
        });

        await this.activityLogs.create(
          {
            organizationId,
            workspaceId: delivery.workspaceId,
            actorId: userId,
            action:
              deliveryStatus === DeliveryStatus.APPROVED
                ? 'DELIVERY_APPROVED'
                : 'DELIVERY_OBSERVED',
            entityType: 'Delivery',
            entityId: delivery.id,
            metadata: {
              title: delivery.title,
              approvalStatus: dto.status,
              comment: dto.comment,
            },
          },
          tx,
        );
      }

      return approval;
    });
  }

  private async get(organizationId: string, id: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, organizationId },
      include: deliveryInclude,
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    return delivery;
  }

  private async ensureWorkspace(organizationId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  private assertTransition(from: DeliveryStatus, to: DeliveryStatus) {
    if (from === to) {
      return;
    }

    if (!allowedTransitions[from].includes(to)) {
      throw new BadRequestException(`Cannot move delivery from ${from} to ${to}`);
    }
  }

  private statusData(status: DeliveryStatus): Prisma.DeliveryUpdateInput {
    const now = new Date();

    return {
      status,
      sentAt: status === DeliveryStatus.SENT ? now : undefined,
      viewedAt: status === DeliveryStatus.VIEWED ? now : undefined,
      completedAt:
        status === DeliveryStatus.COMPLETED ? now : undefined,
      cancelledAt:
        status === DeliveryStatus.CANCELLED ? now : undefined,
    };
  }

  private toDeliveryStatus(status: ApprovalStatus) {
    const statuses: Record<ApprovalStatus, DeliveryStatus | null> = {
      PENDING: null,
      APPROVED: DeliveryStatus.APPROVED,
      OBSERVED: DeliveryStatus.OBSERVED,
      REJECTED: DeliveryStatus.OBSERVED,
    };

    return statuses[status];
  }

  private defaultFileName(title: string) {
    return `${this.safeFileName(title)}.pdf`;
  }

  private safeFileName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }
}
