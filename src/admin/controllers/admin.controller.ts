import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService } from '../services/admin-service';
import { AdminGuard } from '../guard/admin.gaurd';
import { CreateAdminDto } from '../dto/create-dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── DASHBOARD METRICS (STATIC ROUTES FIRST) ──────────────────────────────
  @Get('dashboard/overview')
  async getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  } 
 
  @Get('dashboard/staff-performance') 
  async getStaffPerformance() {
    return this.adminService.getStaffPerformance();
  }

  @Get('dashboard/client-progress')
  async getClientProgress() {
    return this.adminService.getClientProgress();
  }

  @Get('clients/list')
  async getAllClients() {
    return this.adminService.findAllClients();
  }

  // ─── ADMIN MANAGEMENT (DYNAMIC ROUTES LAST) ──────────────────────────────
  @Post('create')
  async createAdmin(@Body() dto: CreateAdminDto, @Req() req: Request) {
    const callingAdmin = (req as any).admin;
    return this.adminService.create(dto);
  }

  @Get('manage') // List all admins
  async getAllAdmins() {
    return this.adminService.findAll();
  }

  @Get('manage/:id') // Explicitly separated dynamic route
  async getAdminById(@Param('id') id: string) {
    //   Added check: if id is 'staff', don't even try to query the DB
    if (id === 'staff') return null; 
    return this.adminService.findById(id);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateAdmin(@Param('id') id: string, @Req() req: Request) {
    const callingAdmin = (req as any).admin;
    if (callingAdmin.id === id) throw new BadRequestException('Cannot deactivate yourself');
    return this.adminService.deactivate(id);
  }

  @Patch(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateAdmin(@Param('id') id: string) {
    return this.adminService.reactivate(id);
  }
}