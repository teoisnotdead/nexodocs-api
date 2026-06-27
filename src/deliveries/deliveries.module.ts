import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import {
  DeliveriesController,
  WorkspaceDeliveriesController,
} from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';

@Module({
  imports: [ActivityLogsModule, PrismaModule, StorageModule],
  controllers: [WorkspaceDeliveriesController, DeliveriesController],
  providers: [DeliveriesService],
})
export class DeliveriesModule {}
