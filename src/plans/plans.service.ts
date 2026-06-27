import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientStatus,
  MembershipStatus,
  Prisma,
  SubscriptionStatus,
  WorkspaceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const planSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  maxClients: true,
  maxActiveWorkspaces: true,
  maxStorageGb: true,
  maxInternalUsers: true,
  maxTemplates: true,
  maxReminders: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlanSelect;

const subscriptionInclude = {
  plan: {
    select: planSelect,
  },
} satisfies Prisma.OrganizationSubscriptionInclude;

const openWorkspaceStatuses: WorkspaceStatus[] = [
  WorkspaceStatus.DRAFT,
  WorkspaceStatus.ACTIVE,
  WorkspaceStatus.WAITING_CLIENT,
  WorkspaceStatus.IN_REVIEW,
  WorkspaceStatus.WAITING_APPROVAL,
];

type UsageKey =
  | 'clients'
  | 'activeWorkspaces'
  | 'storageGb'
  | 'internalUsers'
  | 'templates'
  | 'reminders';

type UsageMap = Record<UsageKey, number>;

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    const items = await this.prisma.plan.findMany({
      select: planSelect,
      orderBy: { maxClients: 'asc' },
    });

    return { items };
  }

  async current(organizationId: string) {
    const subscription = await this.ensureSubscription(organizationId);
    const usage = await this.getUsage(organizationId);
    await this.persistUsage(organizationId, usage);

    return {
      subscription,
      plan: subscription.plan,
      usage,
      limits: this.limits(subscription.plan),
    };
  }

  async assertCanCreateClient(organizationId: string) {
    const subscription = await this.ensureSubscription(organizationId);
    const clients = await this.prisma.client.count({
      where: { organizationId, status: { not: ClientStatus.ARCHIVED } },
    });

    if (clients >= subscription.plan.maxClients) {
      throw new BadRequestException(
        'El plan actual alcanzo el limite de clientes disponibles.',
      );
    }
  }

  async assertCanCreateWorkspace(
    organizationId: string,
    status: WorkspaceStatus,
  ) {
    if (!openWorkspaceStatuses.includes(status)) {
      return;
    }

    const subscription = await this.ensureSubscription(organizationId);
    const activeWorkspaces = await this.prisma.workspace.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: openWorkspaceStatuses },
      },
    });

    if (activeWorkspaces >= subscription.plan.maxActiveWorkspaces) {
      throw new BadRequestException(
        'El plan actual alcanzo el limite de procesos activos.',
      );
    }
  }

  private async ensureSubscription(organizationId: string) {
    const existing = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: subscriptionInclude,
    });

    if (existing) {
      return existing;
    }

    const basicPlan = await this.prisma.plan.findUnique({
      where: { code: 'basic' },
      select: { id: true },
    });

    if (!basicPlan) {
      throw new NotFoundException('Plan not found');
    }

    return this.prisma.organizationSubscription.create({
      data: {
        organizationId,
        planId: basicPlan.id,
        status: SubscriptionStatus.ACTIVE,
      },
      include: subscriptionInclude,
    });
  }

  private async getUsage(organizationId: string): Promise<UsageMap> {
    const storage = await this.prisma.fileAsset.aggregate({
      where: { organizationId },
      _sum: { sizeBytes: true },
    });

    const [
      clients,
      activeWorkspaces,
      internalUsers,
      templates,
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
      this.prisma.membership.count({
        where: { organizationId, status: MembershipStatus.ACTIVE },
      }),
      this.prisma.checklistTemplate.count({
        where: { organizationId, deletedAt: null },
      }),
    ]);

    return {
      clients,
      activeWorkspaces,
      storageGb: Math.ceil((storage._sum.sizeBytes ?? 0) / 1024 / 1024 / 1024),
      internalUsers,
      templates,
      reminders: 0,
    };
  }

  private async persistUsage(organizationId: string, usage: UsageMap) {
    await this.prisma.$transaction(
      Object.entries(usage).map(([metric, value]) =>
        this.prisma.usageMetric.upsert({
          where: {
            organizationId_metric: {
              organizationId,
              metric,
            },
          },
          update: {
            value,
            measuredAt: new Date(),
          },
          create: {
            organizationId,
            metric,
            value,
          },
        }),
      ),
    );
  }

  private limits(plan: Prisma.PlanGetPayload<{ select: typeof planSelect }>) {
    return {
      clients: plan.maxClients,
      activeWorkspaces: plan.maxActiveWorkspaces,
      storageGb: plan.maxStorageGb,
      internalUsers: plan.maxInternalUsers,
      templates: plan.maxTemplates,
      reminders: plan.maxReminders,
    };
  }
}
