import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SupabaseAuthGuard } from '../auth/supabase.guard';

@Controller('analytics')
@UseGuards(SupabaseAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('client')
  async getClientAnalytics(@Req() req: any) {
    return this.analyticsService.getClientData(req.user.id);
  }

  @Get('staff')
  async getStaffAnalytics(@Req() req: any) {
    return this.analyticsService.getStaffData(req.user.id);
  }

  @Get('admin')
  async getAdminAnalytics() {
    return this.analyticsService.getAdminData();
  }
}