import { PrismaPg } from '@prisma/adapter-pg';
import {
  DocumentRequestStatus,
  PrismaClient,
  WorkspaceStatus,
  WorkspaceType,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

async function main() {
  const passwordHash = await argon2.hash('nexodocs123');

  const organization = await prisma.organization.upsert({
    where: {
      id: 'org_tyt_demo',
    },
    update: {
      name: 'TYT Tech Solutions',
      legalName: 'TYT Tech Solutions',
      industry: 'Servicios profesionales',
      primaryColor: '#2563eb',
      onboardingCompleted: true,
    },
    create: {
      id: 'org_tyt_demo',
      name: 'TYT Tech Solutions',
      legalName: 'TYT Tech Solutions',
      industry: 'Servicios profesionales',
      primaryColor: '#2563eb',
      onboardingCompleted: true,
    },
  });

  const basicPlan = await prisma.plan.upsert({
    where: { code: 'basic' },
    update: {
      name: 'Basico',
      description: 'Plan inicial para equipos que comienzan a ordenar clientes y procesos.',
      maxClients: 15,
      maxActiveWorkspaces: 30,
      maxStorageGb: 5,
      maxInternalUsers: 1,
      maxTemplates: 3,
      maxReminders: 100,
    },
    create: {
      id: 'plan_basic',
      code: 'basic',
      name: 'Basico',
      description: 'Plan inicial para equipos que comienzan a ordenar clientes y procesos.',
      maxClients: 15,
      maxActiveWorkspaces: 30,
      maxStorageGb: 5,
      maxInternalUsers: 1,
      maxTemplates: 3,
      maxReminders: 100,
    },
  });

  await prisma.plan.upsert({
    where: { code: 'professional' },
    update: {
      name: 'Profesional',
      description: 'Plan para operaciones documentales con mayor volumen mensual.',
      maxClients: 75,
      maxActiveWorkspaces: 200,
      maxStorageGb: 25,
      maxInternalUsers: 5,
      maxTemplates: 20,
      maxReminders: 1000,
    },
    create: {
      id: 'plan_professional',
      code: 'professional',
      name: 'Profesional',
      description: 'Plan para operaciones documentales con mayor volumen mensual.',
      maxClients: 75,
      maxActiveWorkspaces: 200,
      maxStorageGb: 25,
      maxInternalUsers: 5,
      maxTemplates: 20,
      maxReminders: 1000,
    },
  });

  await prisma.plan.upsert({
    where: { code: 'enterprise' },
    update: {
      name: 'Empresa',
      description: 'Plan para organizaciones con cartera amplia y alto volumen documental.',
      maxClients: 250,
      maxActiveWorkspaces: 1000,
      maxStorageGb: 100,
      maxInternalUsers: 15,
      maxTemplates: 100,
      maxReminders: 5000,
    },
    create: {
      id: 'plan_enterprise',
      code: 'enterprise',
      name: 'Empresa',
      description: 'Plan para organizaciones con cartera amplia y alto volumen documental.',
      maxClients: 250,
      maxActiveWorkspaces: 1000,
      maxStorageGb: 100,
      maxInternalUsers: 15,
      maxTemplates: 100,
      maxReminders: 5000,
    },
  });

  await prisma.organizationSubscription.upsert({
    where: { organizationId: organization.id },
    update: {
      planId: basicPlan.id,
      status: 'ACTIVE',
      endsAt: null,
    },
    create: {
      id: 'subscription_tyt_basic',
      organizationId: organization.id,
      planId: basicPlan.id,
      status: 'ACTIVE',
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email: 'alfredo.ssm@gmail.com',
    },
    update: {
      name: 'Alfredo Saavedra',
      passwordHash,
    },
    create: {
      id: 'user_alfredo_demo',
      name: 'Alfredo Saavedra',
      email: 'alfredo.ssm@gmail.com',
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id,
      },
    },
    update: {
      role: 'OWNER',
      status: 'ACTIVE',
    },
    create: {
      id: 'membership_tyt_owner_demo',
      organizationId: organization.id,
      userId: user.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  const clients = [
    {
      id: 'client_lumina',
      name: 'Lumina Retail',
      legalName: 'Lumina Retail SpA',
      taxId: '76.123.456-7',
      industry: 'Retail',
      email: 'administracion@lumina.cl',
      phone: '+56 2 2345 6789',
      website: 'https://lumina.cl',
      notes: 'Cliente con cierres mensuales y solicitudes recurrentes.',
      contact: {
        id: 'contact_lumina_primary',
        name: 'Carolina Reyes',
        email: 'carolina.reyes@lumina.cl',
        phone: '+56 9 8123 4567',
        role: 'Administracion',
      },
    },
    {
      id: 'client_andes',
      name: 'Andes Legal',
      legalName: 'Andes Legal Consultores Ltda.',
      taxId: '77.234.567-8',
      industry: 'Servicios legales',
      email: 'contacto@andeslegal.cl',
      phone: '+56 2 2456 7890',
      website: 'https://andeslegal.cl',
      notes: 'Requiere orden documental para carpetas de clientes.',
      contact: {
        id: 'contact_andes_primary',
        name: 'Matias Fuentes',
        email: 'matias@andeslegal.cl',
        phone: '+56 9 8234 5678',
        role: 'Socio',
      },
    },
    {
      id: 'client_aurora',
      name: 'Aurora Foods',
      legalName: 'Aurora Foods Chile SpA',
      taxId: '78.345.678-9',
      industry: 'Alimentos',
      email: 'finanzas@aurorafoods.cl',
      phone: '+56 2 2567 8901',
      website: 'https://aurorafoods.cl',
      notes: 'Equipo financiero con varias solicitudes por periodo.',
      contact: {
        id: 'contact_aurora_primary',
        name: 'Valentina Rojas',
        email: 'valentina.rojas@aurorafoods.cl',
        phone: '+56 9 8345 6789',
        role: 'Finanzas',
      },
    },
    {
      id: 'client_norte',
      name: 'Norte Energia',
      legalName: 'Norte Energia S.A.',
      taxId: '79.456.789-0',
      industry: 'Energia',
      email: 'operaciones@norteenergia.cl',
      phone: '+56 2 2678 9012',
      website: 'https://norteenergia.cl',
      notes: 'Cuenta estrategica con alto volumen documental.',
      contact: {
        id: 'contact_norte_primary',
        name: 'Ignacio Silva',
        email: 'ignacio.silva@norteenergia.cl',
        phone: '+56 9 8456 7890',
        role: 'Operaciones',
      },
    },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: {
        name: client.name,
        legalName: client.legalName,
        taxId: client.taxId,
        industry: client.industry,
        email: client.email,
        phone: client.phone,
        website: client.website,
        notes: client.notes,
        status: 'ACTIVE',
      },
      create: {
        id: client.id,
        organizationId: organization.id,
        name: client.name,
        legalName: client.legalName,
        taxId: client.taxId,
        industry: client.industry,
        email: client.email,
        phone: client.phone,
        website: client.website,
        notes: client.notes,
        status: 'ACTIVE',
      },
    });

    await prisma.clientContact.upsert({
      where: { id: client.contact.id },
      update: {
        name: client.contact.name,
        email: client.contact.email,
        phone: client.contact.phone,
        role: client.contact.role,
        isPrimary: true,
      },
      create: {
        id: client.contact.id,
        clientId: client.id,
        name: client.contact.name,
        email: client.contact.email,
        phone: client.contact.phone,
        role: client.contact.role,
        isPrimary: true,
      },
    });
  }

  const workspaces: Array<{
    id: string;
    clientId: string;
    name: string;
    description: string;
    workspaceType: WorkspaceType;
    periodYear: number | null;
    periodMonth: number | null;
    dueDate: Date | null;
    status: WorkspaceStatus;
  }> = [
    {
      id: 'workspace_cierre_abril_2026',
      clientId: 'client_lumina',
      name: 'Cierre mensual Abril 2026',
      description: 'Proceso de recopilacion y revision documental mensual.',
      workspaceType: WorkspaceType.MONTHLY_CLOSURE,
      periodYear: 2026,
      periodMonth: 4,
      dueDate: new Date('2026-05-10T12:00:00.000Z'),
      status: WorkspaceStatus.ACTIVE,
    },
    {
      id: 'workspace_documentacion_abril',
      clientId: 'client_andes',
      name: 'Documentacion mensual Abril',
      description: 'Carpeta mensual para documentos compartidos por el cliente.',
      workspaceType: WorkspaceType.GENERIC_PROCESS,
      periodYear: 2026,
      periodMonth: 4,
      dueDate: new Date('2026-05-12T12:00:00.000Z'),
      status: WorkspaceStatus.WAITING_CLIENT,
    },
    {
      id: 'workspace_informe_abril_2026',
      clientId: 'client_aurora',
      name: 'Informe mensual Abril 2026',
      description: 'Proceso de revision y entrega de informe mensual.',
      workspaceType: WorkspaceType.DOCUMENT_REVIEW,
      periodYear: 2026,
      periodMonth: 4,
      dueDate: new Date('2026-05-18T12:00:00.000Z'),
      status: WorkspaceStatus.IN_REVIEW,
    },
    {
      id: 'workspace_documentos_trabajadores',
      clientId: 'client_norte',
      name: 'Documentos trabajadores',
      description: 'Proceso generico para recopilar antecedentes internos.',
      workspaceType: WorkspaceType.GENERIC_PROCESS,
      periodYear: null,
      periodMonth: null,
      dueDate: new Date('2026-06-05T12:00:00.000Z'),
      status: WorkspaceStatus.DRAFT,
    },
  ];

  for (const workspace of workspaces) {
    await prisma.workspace.upsert({
      where: { id: workspace.id },
      update: {
        name: workspace.name,
        description: workspace.description,
        workspaceType: workspace.workspaceType,
        periodYear: workspace.periodYear,
        periodMonth: workspace.periodMonth,
        dueDate: workspace.dueDate,
        status: workspace.status,
        deletedAt: null,
        closedAt:
          workspace.status === WorkspaceStatus.COMPLETED ? new Date() : null,
      },
      create: {
        id: workspace.id,
        organizationId: organization.id,
        clientId: workspace.clientId,
        createdById: user.id,
        name: workspace.name,
        description: workspace.description,
        workspaceType: workspace.workspaceType,
        periodYear: workspace.periodYear,
        periodMonth: workspace.periodMonth,
        dueDate: workspace.dueDate,
        status: workspace.status,
        closedAt:
          workspace.status === WorkspaceStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  const documentRequests: Array<{
    id: string;
    workspaceId: string;
    title: string;
    description: string;
    required: boolean;
    dueDate: Date | null;
    status: DocumentRequestStatus;
    assignedClientContactId: string | null;
  }> = [
    {
      id: 'request_facturas_compra',
      workspaceId: 'workspace_cierre_abril_2026',
      title: 'Facturas de compra',
      description: 'Documentos de respaldo recibidos durante el periodo.',
      required: true,
      dueDate: new Date('2026-05-06T12:00:00.000Z'),
      status: DocumentRequestStatus.PENDING,
      assignedClientContactId: 'contact_lumina_primary',
    },
    {
      id: 'request_facturas_venta',
      workspaceId: 'workspace_cierre_abril_2026',
      title: 'Facturas de venta',
      description: 'Documentos emitidos y respaldos relacionados.',
      required: true,
      dueDate: new Date('2026-05-06T12:00:00.000Z'),
      status: DocumentRequestStatus.SUBMITTED,
      assignedClientContactId: 'contact_lumina_primary',
    },
    {
      id: 'request_cartola_bancaria',
      workspaceId: 'workspace_documentacion_abril',
      title: 'Cartola bancaria',
      description: 'Movimientos bancarios del periodo solicitado.',
      required: true,
      dueDate: new Date('2026-05-08T12:00:00.000Z'),
      status: DocumentRequestStatus.PENDING,
      assignedClientContactId: 'contact_andes_primary',
    },
    {
      id: 'request_comprobantes_pago',
      workspaceId: 'workspace_documentacion_abril',
      title: 'Comprobantes de pago',
      description: 'Respaldos de pagos realizados durante el periodo.',
      required: false,
      dueDate: new Date('2026-05-09T12:00:00.000Z'),
      status: DocumentRequestStatus.OBSERVED,
      assignedClientContactId: 'contact_andes_primary',
    },
    {
      id: 'request_documentos_trabajadores',
      workspaceId: 'workspace_documentos_trabajadores',
      title: 'Documentos trabajadores',
      description: 'Antecedentes internos para revision del proceso.',
      required: true,
      dueDate: new Date('2026-06-01T12:00:00.000Z'),
      status: DocumentRequestStatus.IN_REVIEW,
      assignedClientContactId: 'contact_norte_primary',
    },
    {
      id: 'request_contratos',
      workspaceId: 'workspace_informe_abril_2026',
      title: 'Contratos',
      description: 'Contratos y anexos relevantes para el informe.',
      required: false,
      dueDate: new Date('2026-05-14T12:00:00.000Z'),
      status: DocumentRequestStatus.APPROVED,
      assignedClientContactId: 'contact_aurora_primary',
    },
    {
      id: 'request_boletas_honorarios',
      workspaceId: 'workspace_informe_abril_2026',
      title: 'Boletas de honorarios',
      description: 'Respaldos emitidos por prestadores externos.',
      required: false,
      dueDate: new Date('2026-05-15T12:00:00.000Z'),
      status: DocumentRequestStatus.PENDING,
      assignedClientContactId: 'contact_aurora_primary',
    },
  ];

  for (const request of documentRequests) {
    await prisma.documentRequest.upsert({
      where: { id: request.id },
      update: {
        title: request.title,
        description: request.description,
        required: request.required,
        dueDate: request.dueDate,
        status: request.status,
        assignedClientContactId: request.assignedClientContactId,
      },
      create: {
        id: request.id,
        organizationId: organization.id,
        workspaceId: request.workspaceId,
        createdById: user.id,
        title: request.title,
        description: request.description,
        required: request.required,
        dueDate: request.dueDate,
        status: request.status,
        assignedClientContactId: request.assignedClientContactId,
      },
    });
  }

  await prisma.checklistTemplate.upsert({
    where: { id: 'template_cierre_mensual_pyme' },
    update: {
      name: 'Cierre mensual pyme',
      description: 'Lista base para ordenar documentos recurrentes del periodo.',
      deletedAt: null,
      items: {
        deleteMany: {},
        create: [
          {
            title: 'Facturas de compra',
            description: 'Respaldos recibidos durante el periodo.',
            required: true,
            position: 1,
          },
          {
            title: 'Facturas de venta',
            description: 'Documentos emitidos y respaldos relacionados.',
            required: true,
            position: 2,
          },
          {
            title: 'Cartola bancaria',
            description: 'Movimientos bancarios del periodo solicitado.',
            required: true,
            position: 3,
          },
          {
            title: 'Comprobantes de pago',
            description: 'Respaldos de pagos realizados durante el periodo.',
            required: false,
            position: 4,
          },
          {
            title: 'Boletas de honorarios',
            description: 'Respaldos emitidos por prestadores externos.',
            required: false,
            position: 5,
          },
        ],
      },
    },
    create: {
      id: 'template_cierre_mensual_pyme',
      organizationId: organization.id,
      createdById: user.id,
      name: 'Cierre mensual pyme',
      description: 'Lista base para ordenar documentos recurrentes del periodo.',
      items: {
        create: [
          {
            title: 'Facturas de compra',
            description: 'Respaldos recibidos durante el periodo.',
            required: true,
            position: 1,
          },
          {
            title: 'Facturas de venta',
            description: 'Documentos emitidos y respaldos relacionados.',
            required: true,
            position: 2,
          },
          {
            title: 'Cartola bancaria',
            description: 'Movimientos bancarios del periodo solicitado.',
            required: true,
            position: 3,
          },
          {
            title: 'Comprobantes de pago',
            description: 'Respaldos de pagos realizados durante el periodo.',
            required: false,
            position: 4,
          },
          {
            title: 'Boletas de honorarios',
            description: 'Respaldos emitidos por prestadores externos.',
            required: false,
            position: 5,
          },
        ],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
