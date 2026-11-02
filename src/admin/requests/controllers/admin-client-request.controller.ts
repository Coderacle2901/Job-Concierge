import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminClientRequestService } from '../services/admin-client-request.service';
import { AdminGuard } from '../../guard/admin.gaurd';
import { ApproveClientDto } from '../dtos/approve-client.dto';
import { RejectClientDto } from '../dtos/reject-client.dto';

@Controller('admin/client-requests')
@UseGuards(AdminGuard)
export class AdminClientRequestController {

  constructor(
    private readonly adminClientRequestService: AdminClientRequestService,
  ) {}

  // ─── GET PENDING REQUESTS ──────────────────────────────────────────────────

  @Get()
  async getPendingRequests() {
    // GET /admin/client-requests
    // Returns all clients with status REVIEW.
    // These are clients waiting for admin review and approval.
    return this.adminClientRequestService.getPendingRequests();
  }

  // ─── GET CLIENT REVIEW DATA ────────────────────────────────────────────────

  @Get(':clientId/review')
  async getClientReviewData(@Param('clientId') clientId: string) {
    // GET /admin/client-requests/:clientId/review
    // Returns the two data pieces for the two-panel review layout:
    //   - pdfUrl: original uploaded PDF for the left panel
    //   - baseResume: Atomic JSON for the right panel (Visual Editor)
    return this.adminClientRequestService.getClientReviewData(clientId);
  }

  // ─── APPROVE CLIENT ────────────────────────────────────────────────────────

  @Post(':clientId/approve')
  @HttpCode(HttpStatus.OK)
  async approveClient(
    @Param('clientId') clientId: string,
    @Body() dto: ApproveClientDto,
  ) {
    // POST /admin/client-requests/:clientId/approve
    // Three actions in one call:
    // 1. Saves updated resumeJson to BaseResume
    // 2. Deletes PDF from Supabase Storage
    // 3. Sets client.status to APPROVED
    return this.adminClientRequestService.approveClient(
      clientId,
      dto.resumeJson,
    );
  }

  // ─── REJECT CLIENT ─────────────────────────────────────────────────────────

  @Post(':clientId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectClient(
    @Param('clientId') clientId: string,
    @Body() dto: RejectClientDto,
  ) {
    // POST /admin/client-requests/:clientId/reject
    // Sets client.status to REJECTED with a reason.
    // Also deletes the PDF from storage.
    return this.adminClientRequestService.rejectClient(
      clientId,
      dto.rejectionReason,
    );
  }
}