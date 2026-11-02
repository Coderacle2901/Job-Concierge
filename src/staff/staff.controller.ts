import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StaffService } from './staff.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('staff')
//   Uncomment these when you want to lock this down to Staff/Admins only!
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('staff', 'admin') 
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('tasks/pending')
  getPendingTasks() {
    return this.staffService.getPendingTasks();
  }

  @Post('tasks/:id/resolve')
  resolveTask(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any
  ) {
    const staffId = req.user?.id || 'manual-staff-id'; 
    return this.staffService.resolveTask(id, staffId, body);
  }

  @Post('tasks/:id/refund')
  failAndRefundTask(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any
  ) {
    const staffId = req.user?.id || 'manual-staff-id'; 
    return this.staffService.failAndRefundTask(id, staffId, body.reason);
  }

  // ==========================================
  //   APPROVE/REJECT CLIENT ENDPOINT
  // ==========================================
  @Put('clients/:id/status')
  async evaluateClientResume(
    @Param('id') clientId: string,
    @Body() dto: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }
  ) {
    return this.staffService.evaluateClientResume(clientId, dto.status, dto.rejectionReason);
  }
}