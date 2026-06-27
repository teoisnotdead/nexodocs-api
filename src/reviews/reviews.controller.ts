import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateObservationDto } from './dto/create-observation.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ResolveObservationDto } from './dto/resolve-observation.dto';
import { ReviewsService } from './reviews.service';

@Controller('documents/:id')
export class DocumentReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  createReview(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }

  @Get('observations')
  listObservations(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.reviewsService.listObservations(
      request.user!.organizationId,
      id,
    );
  }

  @Post('observations')
  createObservation(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateObservationDto,
  ) {
    return this.reviewsService.createObservation(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }
}

@Controller('observations')
export class ObservationsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id/resolve')
  resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveObservationDto,
  ) {
    return this.reviewsService.resolveObservation(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }
}
