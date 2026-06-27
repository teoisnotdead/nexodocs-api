import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentRequestStatus,
  DocumentStatus,
  Prisma,
} from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { MockUploadDocumentDto } from './dto/mock-upload-document.dto';
import { UpdateDocumentStatusDto } from './dto/update-document-status.dto';

const documentInclude = {
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
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
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
  documentRequest: {
    select: {
      id: true,
      title: true,
      workspaceId: true,
    },
  },
} satisfies Prisma.DocumentInclude;

const reviewStatuses: DocumentStatus[] = [
  DocumentStatus.UNDER_REVIEW,
  DocumentStatus.APPROVED,
  DocumentStatus.OBSERVED,
  DocumentStatus.REJECTED,
];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async listByRequest(organizationId: string, documentRequestId: string) {
    await this.ensureDocumentRequest(organizationId, documentRequestId);

    const items = await this.prisma.document.findMany({
      where: { organizationId, documentRequestId },
      include: documentInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return { items };
  }

  async mockUpload(
    organizationId: string,
    userId: string,
    documentRequestId: string,
    dto: MockUploadDocumentDto,
  ) {
    const request = await this.ensureDocumentRequest(
      organizationId,
      documentRequestId,
    );

    const fileName = dto.fileName ?? this.defaultFileName(request.title);
    const mimeType = dto.mimeType ?? 'application/pdf';
    const sizeBytes = dto.sizeBytes ?? 248_000;
    const storageKey = [
      'mock',
      organizationId,
      documentRequestId,
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
          checksum: `mock-${Date.now()}`,
        },
      });

      const document = await tx.document.create({
        data: {
          organizationId,
          documentRequestId,
          createdById: userId,
          title: request.title,
          versions: {
            create: {
              organizationId,
              fileAssetId: fileAsset.id,
              createdById: userId,
              versionNumber: 1,
              notes: dto.notes,
            },
          },
        },
        include: documentInclude,
      });

      if (
        request.status === DocumentRequestStatus.PENDING ||
        request.status === DocumentRequestStatus.OVERDUE
      ) {
        await tx.documentRequest.update({
          where: { id: request.id },
          data: { status: DocumentRequestStatus.SUBMITTED },
        });
      }

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId: request.workspaceId,
          actorId: userId,
          action: 'DOCUMENT_MOCK_UPLOADED',
          entityType: 'Document',
          entityId: document.id,
          metadata: {
            title: document.title,
            fileName,
            documentRequestId,
          },
        },
        tx,
      );

      return document;
    });
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateDocumentStatusDto,
  ) {
    if (!reviewStatuses.includes(dto.status)) {
      throw new BadRequestException('Document status is not available here');
    }

    const document = await this.get(organizationId, id);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.document.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedAt:
            dto.status === DocumentStatus.APPROVED ||
            dto.status === DocumentStatus.OBSERVED ||
            dto.status === DocumentStatus.REJECTED
              ? now
              : null,
        },
        include: documentInclude,
      });

      await tx.documentRequest.update({
        where: { id: document.documentRequestId },
        data: { status: this.toDocumentRequestStatus(dto.status) },
      });

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId: document.documentRequest.workspaceId,
          actorId: userId,
          action: this.toActivityAction(dto.status),
          entityType: 'Document',
          entityId: document.id,
          metadata: {
            title: document.title,
            from: document.status,
            to: dto.status,
            documentRequestId: document.documentRequestId,
          },
        },
        tx,
      );

      return updated;
    });
  }

  private async get(organizationId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId },
      include: documentInclude,
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  private async ensureDocumentRequest(
    organizationId: string,
    documentRequestId: string,
  ) {
    const request = await this.prisma.documentRequest.findFirst({
      where: { id: documentRequestId, organizationId },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Document request not found');
    }

    return request;
  }

  private toDocumentRequestStatus(status: DocumentStatus) {
    const statuses: Record<DocumentStatus, DocumentRequestStatus> = {
      UPLOADED: DocumentRequestStatus.SUBMITTED,
      UNDER_REVIEW: DocumentRequestStatus.IN_REVIEW,
      APPROVED: DocumentRequestStatus.APPROVED,
      OBSERVED: DocumentRequestStatus.OBSERVED,
      REJECTED: DocumentRequestStatus.REJECTED,
      REPLACED: DocumentRequestStatus.SUBMITTED,
      ARCHIVED: DocumentRequestStatus.CANCELLED,
    };

    return statuses[status];
  }

  private toActivityAction(status: DocumentStatus) {
    const actions: Record<DocumentStatus, string> = {
      UPLOADED: 'DOCUMENT_STATUS_CHANGED',
      UNDER_REVIEW: 'DOCUMENT_STATUS_CHANGED',
      APPROVED: 'DOCUMENT_APPROVED',
      OBSERVED: 'DOCUMENT_OBSERVED',
      REJECTED: 'DOCUMENT_REJECTED',
      REPLACED: 'DOCUMENT_STATUS_CHANGED',
      ARCHIVED: 'DOCUMENT_STATUS_CHANGED',
    };

    return actions[status];
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
