import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminStaffService } from '../services/admin-staff.service';
import { AdminGuard } from '../../guard/admin.gaurd';
import { CreateStaffDto } from '../dtos/create-staff.dto';

@Controller('admin/staff')
@UseGuards(AdminGuard)
export class AdminStaffController {

  constructor(private readonly adminStaffService: AdminStaffService) {}

  // ─── CREATE STAFF ──────────────────────────────────────────────────────────

  @Post()
  async create(@Body() dto: CreateStaffDto) {
    // POST /admin/staff
    // Admin creates a new staff account.
    // Creates Supabase Auth credentials + saves to staff table.
    return this.adminStaffService.create(dto);
  }

  // ─── GET ALL STAFF ─────────────────────────────────────────────────────────

  @Get()
  async findAll() {
    // GET /admin/staff
    // Returns all staff accounts for the admin dashboard.
    return this.adminStaffService.findAll();
  }

  // ─── GET SINGLE STAFF ──────────────────────────────────────────────────────

  @Get(':id')
  async findById(@Param('id') id: string) {
    // GET /admin/staff/:id
    return this.adminStaffService.findById(id);
  }

  // ─── DEACTIVATE STAFF ──────────────────────────────────────────────────────

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    // PATCH /admin/staff/:id/deactivate
    // Soft deactivates a staff account.
    // Deactivated staff cannot be assigned to new clients.
    return this.adminStaffService.deactivate(id);
  }

  // ─── REACTIVATE STAFF ──────────────────────────────────────────────────────

  @Patch(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id') id: string) {
    // PATCH /admin/staff/:id/reactivate
    return this.adminStaffService.reactivate(id);
  }
}