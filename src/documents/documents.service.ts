import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  ActivityActorType,
  DocumentOrigin,
  DocumentRequestStatus,
  DocumentStatus,
  Prisma,
} from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MockUploadDocumentDto } from './dto/mock-upload-document.dto';
import { UpdateDocumentStatusDto } from './dto/update-document-status.dto';

const STORAGE_PROVIDER_SUPABASE = 'supabase';

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

type ClientPortalUploadAccess = {
  organizationId: string;
  workspaceId: string;
  clientContactId: string;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
    private readonly storage: StorageService,
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
          origin: DocumentOrigin.ORGANIZATION_UPLOAD,
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

  async upload(
    organizationId: string,
    userId: string,
    documentRequestId: string,
    file: Express.Multer.File | undefined,
    notes?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('File is empty');
    }

    const request = await this.ensureDocumentRequest(
      organizationId,
      documentRequestId,
    );
    const fileName = file.originalname || this.defaultFileName(request.title);
    const mimeType = file.mimetype || 'application/octet-stream';
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = [
      'documents',
      organizationId,
      documentRequestId,
      `${Date.now()}-${randomUUID()}-${this.safeFileName(fileName)}`,
    ].join('/');

    let uploadedKey: string | null = null;

    try {
      const uploaded = await this.storage.upload({
        key: storageKey,
        buffer: file.buffer,
        contentType: mimeType,
      });
      uploadedKey = uploaded.key;

      return await this.prisma.$transaction(async (tx) => {
        const fileAsset = await tx.fileAsset.create({
          data: {
            organizationId,
            createdById: userId,
            storageProvider: STORAGE_PROVIDER_SUPABASE,
            storageKey: uploaded.key,
            fileName,
            mimeType,
            sizeBytes: file.size,
            checksum,
          },
        });

        const document = await tx.document.create({
          data: {
            organizationId,
            documentRequestId,
            createdById: userId,
            title: request.title,
            origin: DocumentOrigin.ORGANIZATION_UPLOAD,
            versions: {
              create: {
                organizationId,
                fileAssetId: fileAsset.id,
                createdById: userId,
                versionNumber: 1,
                notes: this.optionalText(notes),
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
            action: 'DOCUMENT_UPLOADED',
            entityType: 'Document',
            entityId: document.id,
            metadata: {
              title: document.title,
              fileName,
              mimeType,
              sizeBytes: file.size,
              documentRequestId,
            },
          },
          tx,
        );

        return document;
      });
    } catch (error) {
      if (uploadedKey) {
        await this.storage.remove(uploadedKey).catch(() => undefined);
      }

      throw error;
    }
  }

  async uploadFromClientPortal(
    access: ClientPortalUploadAccess,
    documentRequestId: string,
    file: Express.Multer.File | undefined,
    notes?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('File is empty');
    }

    const request = await this.ensureClientPortalDocumentRequest(
      access,
      documentRequestId,
    );
    const fileName = file.originalname || this.defaultFileName(request.title);
    const mimeType = file.mimetype || 'application/octet-stream';
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = [
      'documents',
      access.organizationId,
      documentRequestId,
      `${Date.now()}-${randomUUID()}-${this.safeFileName(fileName)}`,
    ].join('/');

    let uploadedKey: string | null = null;

    try {
      const uploaded = await this.storage.upload({
        key: storageKey,
        buffer: file.buffer,
        contentType: mimeType,
      });
      uploadedKey = uploaded.key;

      return await this.prisma.$transaction(async (tx) => {
        const fileAsset = await tx.fileAsset.create({
          data: {
            organizationId: access.organizationId,
            uploadedByClientContactId: access.clientContactId,
            storageProvider: STORAGE_PROVIDER_SUPABASE,
            storageKey: uploaded.key,
            fileName,
            mimeType,
            sizeBytes: file.size,
            checksum,
          },
        });

        const document = await tx.document.create({
          data: {
            organizationId: access.organizationId,
            documentRequestId,
            uploadedByClientContactId: access.clientContactId,
            title: request.title,
            origin: DocumentOrigin.CLIENT_UPLOAD,
            versions: {
              create: {
                organizationId: access.organizationId,
                fileAssetId: fileAsset.id,
                uploadedByClientContactId: access.clientContactId,
                versionNumber: 1,
                notes: this.optionalText(notes),
              },
            },
          },
          include: documentInclude,
        });

        const nextStatus = this.statusAfterClientUpload(request.status);

        if (nextStatus) {
          await tx.documentRequest.update({
            where: { id: request.id },
            data: { status: nextStatus },
          });
        }

        await this.activityLogs.create(
          {
            organizationId: access.organizationId,
            workspaceId: request.workspaceId,
            actorType: ActivityActorType.CLIENT_CONTACT,
            actorId: access.clientContactId,
            action: 'CLIENT_DOCUMENT_UPLOADED',
            entityType: 'Document',
            entityId: document.id,
            metadata: {
              title: document.title,
              fileName,
              mimeType,
              sizeBytes: file.size,
              documentRequestId,
            },
          },
          tx,
        );

        return document;
      });
    } catch (error) {
      if (uploadedKey) {
        await this.storage.remove(uploadedKey).catch(() => undefined);
      }

      throw error;
    }
  }

  async createDownloadUrl(organizationId: string, id: string) {
    const document = await this.get(organizationId, id);
    const currentVersion = document.versions[0];

    if (!currentVersion) {
      throw new NotFoundException('Document version not found');
    }

    const { fileAsset } = currentVersion;

    if (fileAsset.publicUrl) {
      return {
        url: fileAsset.publicUrl,
        fileName: fileAsset.fileName,
        mimeType: fileAsset.mimeType,
        sizeBytes: fileAsset.sizeBytes,
        expiresInSeconds: null,
      };
    }

    if (fileAsset.storageProvider !== STORAGE_PROVIDER_SUPABASE) {
      throw new BadRequestException('File is not available for download');
    }

    const expiresInSeconds = 3600;
    const url = await this.storage.createSignedUrl(
      fileAsset.storageKey,
      expiresInSeconds,
    );

    return {
      url,
      fileName: fileAsset.fileName,
      mimeType: fileAsset.mimeType,
      sizeBytes: fileAsset.sizeBytes,
      expiresInSeconds,
    };
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

  private async ensureClientPortalDocumentRequest(
    access: ClientPortalUploadAccess,
    documentRequestId: string,
  ) {
    const request = await this.prisma.documentRequest.findFirst({
      where: {
        id: documentRequestId,
        organizationId: access.organizationId,
        workspaceId: access.workspaceId,
        OR: [
          { assignedClientContactId: access.clientContactId },
          { assignedClientContactId: null },
        ],
      },
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

    if (
      request.status === DocumentRequestStatus.APPROVED ||
      request.status === DocumentRequestStatus.CANCELLED
    ) {
      throw new BadRequestException('Document request is closed');
    }

    return request;
  }

  private statusAfterClientUpload(status: DocumentRequestStatus) {
    if (
      status === DocumentRequestStatus.OBSERVED ||
      status === DocumentRequestStatus.REJECTED
    ) {
      return DocumentRequestStatus.SUBMITTED;
    }

    if (
      status === DocumentRequestStatus.PENDING ||
      status === DocumentRequestStatus.OVERDUE
    ) {
      return DocumentRequestStatus.SUBMITTED;
    }

    return null;
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

  private optionalText(value: string | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
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
