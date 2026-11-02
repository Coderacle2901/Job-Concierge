import { Controller, Post, Body, Res, Param, Get, Put, HttpStatus, Logger, UseInterceptors, UploadedFile, BadRequestException, UseGuards, ForbiddenException, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; 
import type { Response } from 'express';
import { ResumeService } from '../services/resumes.service'; 
import { SupabaseAuthGuard } from '../../auth/supabase.guard'; 

@Controller('resumes')
export class ResumeController {
  private readonly logger = new Logger(ResumeController.name);

  constructor(private readonly resumeService: ResumeService) {}
  
  // ==========================================
  // Check BullMQ Job Status
  // ==========================================
  @Get('job/:jobId/status')
  @UseGuards(SupabaseAuthGuard) 
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.resumeService.getJobStatus(jobId);
  }

  // ==========================================
  // Upload & Parse Base Resume
  // ==========================================
  @Post('upload')
  @UseGuards(SupabaseAuthGuard) 
  @UseInterceptors(FileInterceptor('file'))
  async uploadResume(
    @UploadedFile() file: Express.Multer.File, 
    @Body('userId') userId: string,
    @Request() req: any
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!userId) throw new BadRequestException('UserId is required');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Only PDF files are allowed');

    return this.resumeService.uploadAndParseResume(userId, file);
  }
 
  // ==========================================
  // 1. Generate & Save (AI Quota Consumer)
  // ==========================================
  @Post('generate')
  @UseGuards(SupabaseAuthGuard) //   REMOVED ActivationGuard completely here to unblock Staff
  async generateResume(
    @Body('targetRole') targetRole: string,
    @Body('clientId') clientId: string,
    @Body('jobDescription') jobDescription: string, 
    @Body('jobId') jobId: string | undefined,
    @Body('applicationId') applicationId: string | undefined, //   THE FIX: Catch the tracking number from the frontend!
    @Request() req: any
  ) {
    //   SECURITY: Ensure the user is either the client themselves OR a staff member
    const isStaff = req.user?.role === 'staff' || req.user?.role === 'admin';
    const isOwner = req.user?.sub === clientId || req.user?.id === clientId;

    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have permission to generate resumes for this client.');
    }

    this.logger.log(`--- QUEUEING RESUME FOR CLIENT: ${clientId} | ROLE: ${targetRole} ---`);
    
    const queueData = await this.resumeService.queueResumeGeneration(
      clientId, 
      targetRole, 
      jobDescription, 
      jobId,
      applicationId //   THE FIX: Pass it into the BullMQ Producer!
    );
    
    return { 
      message: queueData.message, 
      jobId: queueData.jobId 
    };
  }

  // ==========================================
  // 2. Update Content
  // ==========================================
  @Put(':id')
  @UseGuards(SupabaseAuthGuard) 
  async updateResume(@Param('id') id: string, @Body('content') content: any) {
    const updatedResume = await this.resumeService.updateResumeContent(id, content);
    return { message: 'Resume updated successfully', resume: updatedResume };
  }

  // ==========================================
  // 3. Get PDF
  // ==========================================
  @Get(':id/pdf')
  @UseGuards(SupabaseAuthGuard) 
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    try {
      const pdfBuffer = await this.resumeService.renderPdfFromId(id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Resume_${id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(), 
      });
      res.end(pdfBuffer);
    } catch (error) {
      this.logger.error(`Failed to render PDF for resume ${id}:`, error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to render PDF');
    }
  }
}