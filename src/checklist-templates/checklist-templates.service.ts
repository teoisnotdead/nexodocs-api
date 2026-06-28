import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentRequestStatus, Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyChecklistTemplateDto } from './dto/apply-checklist-template.dto';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';

const checklistTemplateInclude = {
  items: {
    orderBy: { position: 'asc' },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  _count: {
    select: {
      items: true,
      checklists: true,
    },
  },
} satisfies Prisma.ChecklistTemplateInclude;

const checklistInclude = {
  template: {
    select: {
      id: true,
      name: true,
    },
  },
  documentRequests: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      required: true,
      dueDate: true,
      status: true,
    },
  },
} satisfies Prisma.ChecklistInclude;

@Injectable()
export class ChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list(organizationId: string) {
    const items = await this.prisma.checklistTemplate.findMany({
      where: { organizationId, deletedAt: null },
      include: checklistTemplateInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return { items };
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateChecklistTemplateDto,
  ) {
    return this.prisma.checklistTemplate.create({
      data: {
        organizationId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        items: {
          create: dto.items.map((item, index) => ({
            title: item.title,
            description: item.description,
            required: item.required ?? true,
            position: index + 1,
          })),
        },
      },
      include: checklistTemplateInclude,
    });
  }

  async get(organizationId: string, id: string) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: checklistTemplateInclude,
    });

    if (!template) {
      throw new NotFoundException('Checklist template not found');
    }

    return template;
  }

  async applyToWorkspace(
    organizationId: string,
    userId: string,
    workspaceId: string,
    dto: ApplyChecklistTemplateDto,
  ) {
    const [workspace, template] = await Promise.all([
      this.prisma.workspace.findFirst({
        where: { id: workspaceId, organizationId, deletedAt: null },
        select: { id: true, clientId: true, dueDate: true },
      }),
      this.prisma.checklistTemplate.findFirst({
        where: { id: dto.templateId, organizationId, deletedAt: null },
        include: {
          items: {
            orderBy: { position: 'asc' },
          },
        },
      }),
    ]);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (!template) {
      throw new NotFoundException('Checklist template not found');
    }

    if (template.items.length === 0) {
      throw new BadRequestException('Checklist template has no items');
    }

    if (dto.assignedClientContactId) {
      const contact = await this.prisma.clientContact.findFirst({
        where: {
          id: dto.assignedClientContactId,
          clientId: workspace.clientId,
        },
        select: { id: true },
      });

      if (!contact) {
        throw new BadRequestException(
          'Assigned contact does not belong to workspace client',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const checklist = await tx.checklist.create({
        data: {
          organizationId,
          workspaceId: workspace.id,
          templateId: template.id,
          createdById: userId,
          name: template.name,
          description: template.description,
        },
      });

      for (const item of template.items) {
        const request = await tx.documentRequest.create({
          data: {
            organizationId,
            workspaceId: workspace.id,
            checklistId: checklist.id,
            createdById: userId,
            title: item.title,
            description: item.description,
            required: item.required,
            dueDate: workspace.dueDate,
            status: DocumentRequestStatus.PENDING,
            assignedClientContactId: dto.assignedClientContactId,
          },
        });

        await this.activityLogs.create(
          {
            organizationId,
            workspaceId: workspace.id,
            actorId: userId,
            action: 'DOCUMENT_REQUEST_CREATED',
            entityType: 'DocumentRequest',
            entityId: request.id,
            metadata: {
              title: request.title,
              status: request.status,
              checklistName: checklist.name,
            },
          },
          tx,
        );
      }

      return tx.checklist.findUniqueOrThrow({
        where: { id: checklist.id },
        include: checklistInclude,
      });
    });
  }
}
