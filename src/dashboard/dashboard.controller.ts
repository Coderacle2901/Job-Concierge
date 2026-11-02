import { Controller, Get, Param, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard Operations')
@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  // 1. ADMIN ENDPOINT
  @Get('admin/:adminId')
  async getAdminDashboard(@Param('adminId') adminId: string) {
    return this.dashboardService.getAdminDashboardData(adminId);
  }

  //   2. STAFF ENDPOINT (The Missing Door!)
  @Get('staff/:staffId')
  async getStaffDashboard(@Param('staffId') staffId: string) {
    this.logger.log(`Fetching staff operations queue for: ${staffId}`);
    return this.dashboardService.getStaffDashboardData(staffId);
  }

  // 3. ANALYTICS ENDPOINT
  @Get('analytics/:clientId')
  async getAnalytics(@Param('clientId') clientId: string) {
    return this.dashboardService.getAnalyticsData(clientId);
  }

  // 4. APPLICATIONS ENDPOINT
  @Get('applications/:clientId')
  async getApplications(@Param('clientId') clientId: string) {
    this.logger.log(`Fetching applications for client: ${clientId}`);
    return this.dashboardService.getApplicationsData(clientId);
  }
  
  // 5. CLIENT DASHBOARD ENDPOINT (Generic fallback)
  @Get(':clientId')
  @ApiOperation({ summary: 'Get Client Dashboard Data' })
  @ApiParam({ name: 'clientId' })
  async getDashboard(@Param('clientId') clientId: string) {
    //   FIXED: Added 'staff' to the protected route words
    if (clientId === 'applications' || clientId === 'analytics' || clientId === 'admin' || clientId === 'staff') {
      this.logger.error(`Detected orphaned route call: ${clientId}. Missing UUID in URL?`);
      throw new BadRequestException(`Route /dashboard/${clientId} requires a valid UUID parameter.`);
    }

    this.logger.log(`Fetching dashboard summary for: ${clientId}`);
    return this.dashboardService.getDashboardSummary(clientId);
  }
}