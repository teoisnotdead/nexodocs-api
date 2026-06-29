import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentRequestStatus, Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { UpdateDocumentRequestStatusDto } from './dto/update-document-request-status.dto';
import { UpdateDocumentRequestDto } from './dto/update-document-request.dto';

const documentRequestInclude = {
  workspace: {
    select: {
      id: true,
      name: true,
      clientId: true,
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
      phone: true,
      role: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.DocumentRequestInclude;

const allowedTransitions: Record<
  DocumentRequestStatus,
  DocumentRequestStatus[]
> = {
  DRAFT: [DocumentRequestStatus.PENDING, DocumentRequestStatus.CANCELLED],
  PENDING: [
    DocumentRequestStatus.SUBMITTED,
    DocumentRequestStatus.IN_REVIEW,
    DocumentRequestStatus.OBSERVED,
    DocumentRequestStatus.APPROVED,
    DocumentRequestStatus.REJECTED,
    DocumentRequestStatus.OVERDUE,
    DocumentRequestStatus.CANCELLED,
  ],
  SUBMITTED: [
    DocumentRequestStatus.IN_REVIEW,
    DocumentRequestStatus.OBSERVED,
    DocumentRequestStatus.APPROVED,
    DocumentRequestStatus.REJECTED,
    DocumentRequestStatus.CANCELLED,
  ],
  IN_REVIEW: [
    DocumentRequestStatus.OBSERVED,
    DocumentRequestStatus.APPROVED,
    DocumentRequestStatus.REJECTED,
    DocumentRequestStatus.CANCELLED,
  ],
  OBSERVED: [
    DocumentRequestStatus.RESUBMITTED,
    DocumentRequestStatus.CANCELLED,
  ],
  RESUBMITTED: [
    DocumentRequestStatus.IN_REVIEW,
    DocumentRequestStatus.OBSERVED,
    DocumentRequestStatus.APPROVED,
    DocumentRequestStatus.REJECTED,
    DocumentRequestStatus.CANCELLED,
  ],
  APPROVED: [],
  REJECTED: [],
  OVERDUE: [
    DocumentRequestStatus.SUBMITTED,
    DocumentRequestStatus.IN_REVIEW,
    DocumentRequestStatus.CANCELLED,
  ],
  CANCELLED: [],
};

const visibleStatusGroups = {
  pending: [
    DocumentRequestStatus.DRAFT,
    DocumentRequestStatus.PENDING,
    DocumentRequestStatus.OVERDUE,
  ],
  submitted: [
    DocumentRequestStatus.SUBMITTED,
    DocumentRequestStatus.RESUBMITTED,
    DocumentRequestStatus.IN_REVIEW,
  ],
  approved: [DocumentRequestStatus.APPROVED],
  rejected: [
    DocumentRequestStatus.OBSERVED,
    DocumentRequestStatus.REJECTED,
    DocumentRequestStatus.CANCELLED,
  ],
};

@Injectable()
export class DocumentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list(organizationId: string, workspaceId: string) {
    await this.ensureWorkspace(organizationId, workspaceId);

    const [items, pending, submitted, approved, rejected] =
      await this.prisma.$transaction([
        this.prisma.documentRequest.findMany({
          where: { organizationId, workspaceId },
          include: documentRequestInclude,
          orderBy: [
            { status: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'desc' },
          ],
        }),
        this.prisma.documentRequest.count({
          where: {
            organizationId,
            workspaceId,
            status: { in: visibleStatusGroups.pending },
          },
        }),
        this.prisma.documentRequest.count({
          where: {
            organizationId,
            workspaceId,
            status: { in: visibleStatusGroups.submitted },
          },
        }),
        this.prisma.documentRequest.count({
          where: {
            organizationId,
            workspaceId,
            status: DocumentRequestStatus.APPROVED,
          },
        }),
        this.prisma.documentRequest.count({
          where: {
            organizationId,
            workspaceId,
            status: { in: visibleStatusGroups.rejected },
          },
        }),
      ]);

    return {
      items,
      summary: {
        pending,
        submitted,
        approved,
        rejected,
      },
    };
  }

  async create(
    organizationId: string,
    userId: string,
    workspaceId: string,
    dto: CreateDocumentRequestDto,
  ) {
    const workspace = await this.ensureWorkspace(organizationId, workspaceId);

    if (dto.assignedClientContactId) {
      await this.ensureContact(workspace.clientId, dto.assignedClientContactId);
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.documentRequest.create({
        data: {
          organizationId,
          workspaceId,
          createdById: userId,
          title: dto.title,
          description: dto.description,
          required: dto.required ?? true,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          status: dto.status ?? DocumentRequestStatus.PENDING,
          assignedClientContactId: dto.assignedClientContactId ?? undefined,
        },
        include: documentRequestInclude,
      });

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId,
          actorId: userId,
          action: 'DOCUMENT_REQUEST_CREATED',
          entityType: 'DocumentRequest',
          entityId: request.id,
          metadata: {
            title: request.title,
            status: request.status,
            clientName: request.workspace.client.name,
            workspaceName: request.workspace.name,
          },
        },
        tx,
      );

      return request;
    });
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateDocumentRequestDto,
  ) {
    const request = await this.get(organizationId, id);

    if (dto.assignedClientContactId) {
      await this.ensureContact(
        request.workspace.clientId,
        dto.assignedClientContactId,
      );
    }

    const data: Prisma.DocumentRequestUncheckedUpdateInput = {
      title: dto.title,
      description: dto.description,
      required: dto.required,
      dueDate:
        dto.dueDate === null
          ? null
          : dto.dueDate
            ? new Date(dto.dueDate)
            : undefined,
      assignedClientContactId: dto.assignedClientContactId,
    };

    if (dto.status) {
      this.assertTransition(request.status, dto.status);
      data.status = dto.status;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentRequest.update({
        where: { id },
        data,
        include: documentRequestInclude,
      });

      if (dto.status && dto.status !== request.status) {
        await this.activityLogs.create(
          {
            organizationId,
            workspaceId: updated.workspaceId,
            actorId: userId,
            action: 'DOCUMENT_REQUEST_STATUS_CHANGED',
            entityType: 'DocumentRequest',
            entityId: updated.id,
            metadata: {
              title: updated.title,
              from: request.status,
              to: updated.status,
            },
          },
          tx,
        );
      }

      return updated;
    });
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateDocumentRequestStatusDto,
  ) {
    const request = await this.get(organizationId, id);
    this.assertTransition(request.status, dto.status);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentRequest.update({
        where: { id },
        data: { status: dto.status },
        include: documentRequestInclude,
      });

      if (updated.status !== request.status) {
        await this.activityLogs.create(
          {
            organizationId,
            workspaceId: updated.workspaceId,
            actorId: userId,
            action: 'DOCUMENT_REQUEST_STATUS_CHANGED',
            entityType: 'DocumentRequest',
            entityId: updated.id,
            metadata: {
              title: updated.title,
              from: request.status,
              to: updated.status,
            },
          },
          tx,
        );
      }

      return updated;
    });
  }

  async delete(organizationId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.documentRequest.delete({ where: { id } });

    return { success: true };
  }

  private async get(organizationId: string, id: string) {
    const request = await this.prisma.documentRequest.findFirst({
      where: { id, organizationId },
      include: documentRequestInclude,
    });

    if (!request) {
      throw new NotFoundException('Document request not found');
    }

    return request;
  }

  private async ensureWorkspace(organizationId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, organizationId, deletedAt: null },
      select: { id: true, clientId: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  private async ensureContact(clientId: string, contactId: string) {
    const contact = await this.prisma.clientContact.findFirst({
      where: { id: contactId, clientId },
      select: { id: true },
    });

    if (!contact) {
      throw new BadRequestException(
        'Assigned contact does not belong to workspace client',
      );
    }
  }

  private assertTransition(
    current: DocumentRequestStatus,
    next: DocumentRequestStatus,
  ) {
    if (current === next) {
      return;
    }

    if (!allowedTransitions[current].includes(next)) {
      throw new BadRequestException(
        'Document request status transition is not allowed',
      );
    }
  }
}
