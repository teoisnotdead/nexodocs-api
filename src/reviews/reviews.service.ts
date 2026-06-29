import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DocumentRequestStatus,
  DocumentStatus,
  Prisma,
  ReviewDecision,
} from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateObservationDto } from './dto/create-observation.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ResolveObservationDto } from './dto/resolve-observation.dto';

const actorSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

const reviewInclude = {
  createdBy: {
    select: actorSelect,
  },
} satisfies Prisma.ReviewInclude;

const observationInclude = {
  createdBy: {
    select: actorSelect,
  },
  resolvedBy: {
    select: actorSelect,
  },
} satisfies Prisma.ObservationInclude;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async createReview(
    organizationId: string,
    userId: string,
    documentId: string,
    dto: CreateReviewDto,
  ) {
    const document = await this.ensureDocument(organizationId, documentId);
    const now = new Date();
    const documentStatus =
      dto.decision === ReviewDecision.APPROVED
        ? DocumentStatus.APPROVED
        : DocumentStatus.REJECTED;

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          organizationId,
          documentId: document.id,
          createdById: userId,
          decision: dto.decision,
          comment: dto.comment,
        },
        include: reviewInclude,
      });

      const shouldCreateObservation =
        dto.decision === ReviewDecision.REJECTED && Boolean(dto.comment);
      const observation = shouldCreateObservation
        ? await tx.observation.create({
            data: {
              organizationId,
              documentId: document.id,
              documentRequestId: document.documentRequestId,
              createdById: userId,
              comment: dto.comment!,
            },
            select: { id: true },
          })
        : null;

      await tx.document.update({
        where: { id: document.id },
        data: {
          status: documentStatus,
          reviewedAt: now,
        },
      });

      await tx.documentRequest.update({
        where: { id: document.documentRequestId },
        data: {
          status:
            dto.decision === ReviewDecision.APPROVED
              ? DocumentRequestStatus.APPROVED
              : DocumentRequestStatus.REJECTED,
        },
      });

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId: document.documentRequest.workspaceId,
          actorId: userId,
          action:
            dto.decision === ReviewDecision.APPROVED
              ? 'DOCUMENT_APPROVED'
              : 'DOCUMENT_REJECTED',
          entityType: 'Document',
          entityId: document.id,
          metadata: {
            documentRequestId: document.documentRequestId,
            decision: dto.decision,
            comment: dto.comment,
            observationId: observation?.id,
          },
        },
        tx,
      );

      return review;
    });
  }

  async listObservations(organizationId: string, documentId: string) {
    await this.ensureDocument(organizationId, documentId);

    const items = await this.prisma.observation.findMany({
      where: { organizationId, documentId },
      include: observationInclude,
      orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
    });

    return { items };
  }

  async createObservation(
    organizationId: string,
    userId: string,
    documentId: string,
    dto: CreateObservationDto,
  ) {
    const document = await this.ensureDocument(organizationId, documentId);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const observation = await tx.observation.create({
        data: {
          organizationId,
          documentId: document.id,
          documentRequestId: document.documentRequestId,
          createdById: userId,
          comment: dto.comment,
        },
        include: observationInclude,
      });

      await tx.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.OBSERVED,
          reviewedAt: now,
        },
      });

      await tx.documentRequest.update({
        where: { id: document.documentRequestId },
        data: { status: DocumentRequestStatus.REJECTED },
      });

      await this.activityLogs.create(
        {
          organizationId,
          workspaceId: document.documentRequest.workspaceId,
          actorId: userId,
          action: 'DOCUMENT_OBSERVED',
          entityType: 'Document',
          entityId: document.id,
          metadata: {
            documentRequestId: document.documentRequestId,
            observationId: observation.id,
          },
        },
        tx,
      );

      return observation;
    });
  }

  async resolveObservation(
    organizationId: string,
    userId: string,
    id: string,
    dto: ResolveObservationDto,
  ) {
    const observation = await this.prisma.observation.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!observation) {
      throw new NotFoundException('Observation not found');
    }

    return this.prisma.observation.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolvedById: userId,
        resolutionNote: dto.resolutionNote,
      },
      include: observationInclude,
    });
  }

  private async ensureDocument(organizationId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
      select: {
        id: true,
        documentRequestId: true,
        documentRequest: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }
}
