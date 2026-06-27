import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientStatus, Prisma } from '@prisma/client';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateClientContactDto,
  UpdateClientContactDto,
} from './dto/client-contact.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const clientInclude = {
  contacts: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  },
  _count: {
    select: { contacts: true },
  },
} satisfies Prisma.ClientInclude;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
    private readonly plansService: PlansService,
  ) {}

  async list(
    organizationId: string,
    options: { search?: string; status?: ClientStatus } = {},
  ) {
    const search = options.search?.trim();
    const where: Prisma.ClientWhereInput = {
      organizationId,
      status: options.status ?? { not: ClientStatus.ARCHIVED },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } },
              { taxId: { contains: search, mode: 'insensitive' } },
              { industry: { contains: search, mode: 'insensitive' } },
              {
                contacts: {
                  some: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, active, paused, archived] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: clientInclude,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.client.count({
        where: { organizationId, status: ClientStatus.ACTIVE },
      }),
      this.prisma.client.count({
        where: { organizationId, status: ClientStatus.PAUSED },
      }),
      this.prisma.client.count({
        where: { organizationId, status: ClientStatus.ARCHIVED },
      }),
    ]);

    return {
      items,
      summary: {
        active,
        paused,
        archived,
      },
    };
  }

  async stats(organizationId: string) {
    const [activeClients, contacts] = await this.prisma.$transaction([
      this.prisma.client.count({
        where: { organizationId, status: ClientStatus.ACTIVE },
      }),
      this.prisma.clientContact.count({
        where: {
          client: {
            organizationId,
            status: { not: ClientStatus.ARCHIVED },
          },
        },
      }),
    ]);

    return { activeClients, contacts };
  }

  async get(organizationId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId },
      include: clientInclude,
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async create(organizationId: string, userId: string, dto: CreateClientDto) {
    await this.plansService.assertCanCreateClient(organizationId);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          organizationId,
          ...this.clientCreateData(dto),
          contacts: dto.primaryContact
            ? {
                create: {
                  ...this.contactCreateData(dto.primaryContact),
                  isPrimary: true,
                },
              }
            : undefined,
        },
        include: clientInclude,
      });

      await this.activityLogs.create(
        {
          organizationId,
          actorId: userId,
          action: 'CLIENT_CREATED',
          entityType: 'Client',
          entityId: client.id,
          metadata: {
            clientName: client.name,
            status: client.status,
          },
        },
        tx,
      );

      return client;
    });
  }

  async update(organizationId: string, id: string, dto: UpdateClientDto) {
    await this.ensureClient(organizationId, id);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id },
        data: this.clientUpdateData(dto),
        include: clientInclude,
      });

      if (dto.primaryContact) {
        const primary = client.contacts.find((contact) => contact.isPrimary);

        if (primary) {
          await tx.clientContact.update({
            where: { id: primary.id },
            data: {
              ...this.contactUpdateData(dto.primaryContact),
              isPrimary: true,
            },
          });
        } else if (dto.primaryContact.name) {
          await tx.clientContact.create({
            data: {
              clientId: id,
              ...this.contactUpdateData(dto.primaryContact),
              name: dto.primaryContact.name,
              isPrimary: true,
            },
          });
        }
      }

      return tx.client.findUniqueOrThrow({
        where: { id },
        include: clientInclude,
      });
    });
  }

  async archive(organizationId: string, id: string) {
    await this.ensureClient(organizationId, id);

    return this.prisma.client.update({
      where: { id },
      data: { status: ClientStatus.ARCHIVED },
      include: clientInclude,
    });
  }

  async createContact(
    organizationId: string,
    clientId: string,
    dto: CreateClientContactDto,
  ) {
    await this.ensureClient(organizationId, clientId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientId },
          data: { isPrimary: false },
        });
      }

      return tx.clientContact.create({
        data: {
          clientId,
          ...this.contactCreateData(dto),
          isPrimary: dto.isPrimary ?? false,
        },
      });
    });
  }

  async updateContact(
    organizationId: string,
    clientId: string,
    contactId: string,
    dto: UpdateClientContactDto,
  ) {
    await this.ensureContact(organizationId, clientId, contactId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientId },
          data: { isPrimary: false },
        });
      }

      return tx.clientContact.update({
        where: { id: contactId },
        data: this.contactUpdateData(dto),
      });
    });
  }

  async deleteContact(
    organizationId: string,
    clientId: string,
    contactId: string,
  ) {
    await this.ensureContact(organizationId, clientId, contactId);
    await this.prisma.clientContact.delete({ where: { id: contactId } });

    return { success: true };
  }

  private async ensureClient(organizationId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  private async ensureContact(
    organizationId: string,
    clientId: string,
    contactId: string,
  ) {
    const contact = await this.prisma.clientContact.findFirst({
      where: {
        id: contactId,
        clientId,
        client: { organizationId },
      },
      select: { id: true },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
  }

  private clientCreateData(dto: CreateClientDto) {
    return {
      name: dto.name,
      legalName: this.clean(dto.legalName),
      taxId: this.clean(dto.taxId),
      industry: this.clean(dto.industry),
      email: this.clean(dto.email),
      phone: this.clean(dto.phone),
      website: this.clean(dto.website),
      notes: this.clean(dto.notes),
      status: dto.status,
    };
  }

  private clientUpdateData(dto: UpdateClientDto) {
    return {
      name: dto.name,
      legalName: this.clean(dto.legalName),
      taxId: this.clean(dto.taxId),
      industry: this.clean(dto.industry),
      email: this.clean(dto.email),
      phone: this.clean(dto.phone),
      website: this.clean(dto.website),
      notes: this.clean(dto.notes),
      status: dto.status,
    };
  }

  private contactCreateData(dto: CreateClientContactDto) {
    return {
      name: dto.name,
      email: this.clean(dto.email),
      phone: this.clean(dto.phone),
      role: this.clean(dto.role),
      isPrimary: dto.isPrimary,
    };
  }

  private contactUpdateData(dto: UpdateClientContactDto) {
    return {
      name: dto.name,
      email: this.clean(dto.email),
      phone: this.clean(dto.phone),
      role: this.clean(dto.role),
      isPrimary: dto.isPrimary,
    };
  }

  private clean(value: string | undefined) {
    return value === '' ? null : value;
  }
}
