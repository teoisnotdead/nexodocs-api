import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  DocumentReviewsController,
  ObservationsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [ActivityLogsModule, PrismaModule],
  controllers: [DocumentReviewsController, ObservationsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
