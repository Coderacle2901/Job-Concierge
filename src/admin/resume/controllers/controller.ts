import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AdminResumeService } from '../services/admin-resume.service';
import { AdminGuard } from '../../guard/admin.gaurd';
import { ParsePdfDto } from '../dtos/parse-pdf.dto';
import { CreateBaseResumeDto } from '../dtos/create-base-resume.dto';
import { UpdateBaseResumeDto } from '../dtos/update-base-resume.dto';
import { DuplicateResumeDto } from '../dtos/duplicate-resume.dto';
import { PreviewPdfDto } from '../dtos/preview-pdf.dto';

@Controller('admin/resumes')
@UseGuards(AdminGuard)
export class AdminResumeController {

  constructor(private readonly adminResumeService: AdminResumeService) {}

  // ─── A-03: PARSE CLIENT PDF ────────────────────────────────────────────────

  @Post('parse-pdf')
  async parsePdf(
    @Body() dto: ParsePdfDto,
    @Req() req: Request,
  ) {
    // POST /admin/resumes/parse-pdf
    // Fetches client's uploaded PDF from Supabase Storage,
    // sends to Gemini, returns Atomic JSON draft for the editor.
    // Nothing is saved — admin reviews and edits first.
    const admin = (req as any).admin;
    return this.adminResumeService.parsePdf(dto.clientId, admin.email);
  }

  // ─── A-05: SAVE BASE RESUME ────────────────────────────────────────────────

  @Post()
  async create(
    @Body() dto: CreateBaseResumeDto,
    @Req() req: Request,
  ) {
    // POST /admin/resumes
    // Saves the edited Atomic JSON as a base resume in the DB.
    // Validates JSON, saves record, calculates ATS baseline score.
    const admin = (req as any).admin;
    return this.adminResumeService.create({
      clientId: dto.clientId,
      adminId: admin.id,
      resumeName: dto.resumeName,
      resumeJson: dto.resumeJson,
    });
  }

  // ─── A-04: FETCH RESUME FOR EDITOR ────────────────────────────────────────

  @Get(':id')
  async findById(@Param('id') id: string) {
    // GET /admin/resumes/:id
    // Returns the full base resume record including resumeJson.
    // Frontend loads resumeJson into the Visual Resume Editor.
    return this.adminResumeService.findById(id);
  }

  // ─── FETCH ALL FOR CLIENT ──────────────────────────────────────────────────

  @Get('client/:clientId')
  async findByClientId(@Param('clientId') clientId: string) {
    // GET /admin/resumes/client/:clientId
    // Returns all active base resumes for a specific client.
    // Used in the admin dashboard to show available resume variants.
    return this.adminResumeService.findByClientId(clientId);
  }

  // ─── UPDATE RESUME JSON ────────────────────────────────────────────────────

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBaseResumeDto,
  ) {
    // PUT /admin/resumes/:id
    // Admin saves edits made in the Visual Resume Editor.
    // Validates updated JSON, increments version, recalculates ATS score.
    return this.adminResumeService.update(id, dto.resumeJson);
  }

  // ─── A-06: DUPLICATE RESUME ────────────────────────────────────────────────

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateResumeDto,
  ) {
    // POST /admin/resumes/:id/duplicate
    // Clones the base resume with a new name.
    // Sets parentResumeId to original, resets version to 1.
    // Validates clone and calculates ATS score.
    return this.adminResumeService.duplicate(id, dto.newResumeName);
  }

  // ─── DELETE JSON ENTRY ─────────────────────────────────────────────────────

  @Delete(':id/entries/:entryId')
  async deleteJsonEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    // DELETE /admin/resumes/:id/entries/:entryId
    // Removes a specific node from the resume JSON by its id.
    // e.g. admin deletes bullet_1_2 from a job entry.
    return this.adminResumeService.deleteJsonEntry(id, entryId);
  }

  // ─── SOFT DELETE ───────────────────────────────────────────────────────────

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    // PATCH /admin/resumes/:id/deactivate
    // Soft deletes the resume — sets isActive to false.
    // Record is preserved for audit history.
    return this.adminResumeService.deactivate(id);
  }

  // ─── RENDER PDF ────────────────────────────────────────────────────────────

  @Get(':id/render')
  async renderPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // GET /admin/resumes/:id/render
    // Generates a PDF from the saved Atomic JSON and streams it
    // as a file download response.
    const pdfBuffer = await this.adminResumeService.renderPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="resume-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // ─── PREVIEW PDF ───────────────────────────────────────────────────────────

  @Post('preview')
  async previewPdf(
    @Body() dto: PreviewPdfDto,
    @Res() res: Response,
  ) {
    // POST /admin/resumes/preview
    // Renders a PDF from raw JSON without saving.
    // Admin can preview the resume in the editor before committing.
    const pdfBuffer = await this.adminResumeService.previewPdf(dto.resumeJson);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="resume-preview.pdf"',
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // ─── GET VERSION CHAIN ─────────────────────────────────────────────────────

  @Get(':id/versions')
  async getVersionChain(@Param('id') id: string) {
    // GET /admin/resumes/:id/versions
    // Returns the full version chain for a resume.
    // e.g. [Base v1, Tech Focus v2, Remote Focus v3]
    return this.adminResumeService.getVersionChain(id);
  }

  
}