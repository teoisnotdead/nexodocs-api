import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DocumentsModule } from '../documents/documents.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ClientPortalController,
  WorkspaceClientPortalAccessController,
} from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';

@Module({
  imports: [DocumentsModule, JwtModule.register({}), PrismaModule],
  controllers: [WorkspaceClientPortalAccessController, ClientPortalController],
  providers: [ClientPortalService],
})
export class ClientPortalModule {}
