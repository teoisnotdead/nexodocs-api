import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientStatus } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ClientsService } from './clients.service';
import {
  CreateClientContactDto,
  UpdateClientContactDto,
} from './dto/client-contact.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('status') status?: ClientStatus,
  ) {
    return this.clientsService.list(request.user!.organizationId, {
      search,
      status,
    });
  }

  @Get('stats')
  stats(@Req() request: AuthenticatedRequest) {
    return this.clientsService.stats(request.user!.organizationId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateClientDto) {
    return this.clientsService.create(
      request.user!.organizationId,
      request.user!.userId,
      dto,
    );
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.clientsService.get(request.user!.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(request.user!.organizationId, id, dto);
  }

  @Delete(':id')
  archive(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.clientsService.archive(request.user!.organizationId, id);
  }

  @Post(':id/contacts')
  createContact(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateClientContactDto,
  ) {
    return this.clientsService.createContact(
      request.user!.organizationId,
      id,
      dto,
    );
  }

  @Patch(':id/contacts/:contactId')
  updateContact(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateClientContactDto,
  ) {
    return this.clientsService.updateContact(
      request.user!.organizationId,
      id,
      contactId,
      dto,
    );
  }

  @Delete(':id/contacts/:contactId')
  deleteContact(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.clientsService.deleteContact(
      request.user!.organizationId,
      id,
      contactId,
    );
  }
}
