import {
  Controller, Post, Get, Delete, Patch,
  Param, Body, Query, Req,
  HttpCode, HttpStatus, Logger,
  ParseUUIDPipe,
  UseGuards
} from '@nestjs/common';
import { ApplicationsService } from '../services/applications.service';
import { SubmitApplicationDto } from '../dto/submit-application-dto';
import { ApplicationStatus } from '../enums/application-status.enum';

import { SupabaseAuthGuard } from '../../auth/supabase.guard';
import { ActivationGuard } from '../../auth/guards/activation.guard';

@Controller('applications')
export class ApplicationsController {
  private readonly logger = new Logger(ApplicationsController.name);

  constructor(private readonly applicationsService: ApplicationsService) {}

  // ─────────────────────────────────────────────
  // POST /applications/request
  //   THE NEW CONCIERGE TARGET LOCK
  // ─────────────────────────────────────────────
  @Post('request')
  @UseGuards(SupabaseAuthGuard, ActivationGuard) // Locked: Requires active account!
  @HttpCode(HttpStatus.ACCEPTED)
  async requestApplication(
    @Body() dto: { 
      clientId: string; 
      company: string; 
      role: string; 
      jobUrl: string; 
      jobDescription?: string 
    }
  ) {
    this.logger.log(`POST /applications/request — client: ${dto.clientId} | company: ${dto.company}`);
    return this.applicationsService.createApplicationRequest(dto);
  }

  // ─────────────────────────────────────────────
  // POST /applications (Legacy / Automated)
  // ─────────────────────────────────────────────
  @Post()
  @UseGuards(SupabaseAuthGuard, ActivationGuard) 
  @HttpCode(HttpStatus.ACCEPTED)
  async createApplication(@Body() dto: SubmitApplicationDto) {
    this.logger.log(
      `POST /applications — client: ${dto.clientId} | job: ${dto.jobId}`,
    );
    return this.applicationsService.createApplication(dto);
  }

  // ─────────────────────────────────────────────
  // GET /applications/queue/stats
  // ─────────────────────────────────────────────
  @Get('queue/stats')
  @UseGuards(SupabaseAuthGuard)
  async getQueueStats() {
    return this.applicationsService.getQueueStatus();
  }

  // ─────────────────────────────────────────────
  // GET /applications/staff/all
  //   GLOBAL STAFF VIEW: Get all applications across all clients
  // (Moved up to prevent router clash with /:id)
  // ─────────────────────────────────────────────
  @Get('staff/all')
  @UseGuards(SupabaseAuthGuard) // Add RoleGuard for 'staff'/'admin' if you have it
  async getStaffGlobalQueue(
    @Query('status') status?: string,
    @Query('search') search?: string
  ) {
    return this.applicationsService.getGlobalQueue(status, search);
  }

  // ─────────────────────────────────────────────
  // GET /applications/client/:clientId
  // ─────────────────────────────────────────────
  @Get('client/:clientId')
  @UseGuards(SupabaseAuthGuard)
  async getAllApplications(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('search') search?: string,
  ) {
    return this.applicationsService.getAllApplications(clientId, search);
  }

  // ─────────────────────────────────────────────
  // GET /applications/client/:clientId/status?value=applied
  // ─────────────────────────────────────────────
  @Get('client/:clientId/status')
  @UseGuards(SupabaseAuthGuard)
  async getApplicationsByStatus(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('value') status: ApplicationStatus,
  ) {
    return this.applicationsService.getApplicationsByStatus(clientId, status);
  }

  // ─────────────────────────────────────────────
  // GET /applications/:id
  // ─────────────────────────────────────────────
  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  async getApplicationById(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicationsService.getApplicationById(id);
  }

  // ─────────────────────────────────────────────
  //   PATCH /applications/:id (INLINE EDITING)
  // ─────────────────────────────────────────────
  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  async updateApplicationDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Record<string, any>
  ) {
    this.logger.log(`PATCH /applications/${id} — Inline Edit Update`);
    return this.applicationsService.updateApplicationDetails(id, updateData);
  }

  

  // ─────────────────────────────────────────────
  // DELETE /applications/:id
  // ─────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  async deleteApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.applicationsService.deleteApplication(id, clientId);
  }
}