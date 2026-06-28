import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import {
  DocumentRequestDocumentsController,
  DocumentsController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [ActivityLogsModule, PrismaModule, StorageModule],
  controllers: [DocumentRequestDocumentsController, DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
