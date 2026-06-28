import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { AuthModule } from './auth/auth.module';
import { ChecklistTemplatesModule } from './checklist-templates/checklist-templates.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { ClientsModule } from './clients/clients.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { DocumentRequestsModule } from './document-requests/document-requests.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthController } from './health/health.controller';
import { OrganizationsModule } from './organizations/organizations.module';
import { PlansModule } from './plans/plans.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
    }),
    ActivityLogsModule,
    AuthModule,
    ChecklistTemplatesModule,
    ClientPortalModule,
    ClientsModule,
    DashboardModule,
    DeliveriesModule,
    DocumentRequestsModule,
    DocumentsModule,
    WorkspacesModule,
    PlansModule,
    PrismaModule,
    OrganizationsModule,
    ReviewsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
