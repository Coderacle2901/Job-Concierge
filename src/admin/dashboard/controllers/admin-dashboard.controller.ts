import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { AdminGuard } from '../../guard/admin.gaurd';

@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {

  constructor(
    private readonly adminDashboardService: AdminDashboardService,
  ) {}

  // ─── OVERVIEW ──────────────────────────────────────────────────────────────

  @Get('overview')
  async getOverview() {
    // GET /admin/dashboard/overview
    // Returns all APPROVED clients with their assignment metrics.
    // System metrics include pending review count so admin can
    // see their review backlog without leaving the dashboard.
    // Syncs overdue assignments automatically before returning.
    return this.adminDashboardService.getOverview();
  }

  // ─── STAFF PERFORMANCE ─────────────────────────────────────────────────────

  @Get('staff-performance')
  async getStaffPerformance() {
    // GET /admin/dashboard/staff-performance
    // Returns performance summary per staff member.
    // Shows total, active, completed, overdue assignments
    // and overall progress percentage per staff.
    return this.adminDashboardService.getStaffPerformance();
  }

  // ─── INDIVIDUAL CLIENT DETAIL ──────────────────────────────────────────────

  @Get('clients/:clientId')
  async getClientDetail(@Param('clientId') clientId: string) {
    // GET /admin/dashboard/clients/:clientId
    // Returns detailed view for a single approved client.
    // Throws 400 if client is not approved — non-approved clients
    // belong in the client requests section.
    return this.adminDashboardService.getClientDetail(clientId);
  }
}