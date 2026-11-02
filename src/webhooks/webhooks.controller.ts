// src/webhooks/webhooks.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { ResumeParsedDto } from './dto/resume-parsed.dto';

@ApiTags('Automation Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('resume-parsed')
  @ApiOperation({ summary: 'Receive Parsed Resume from AI/n8n Engine' })
  @ApiResponse({ status: 201, description: 'Client profile enriched and stored.' })
  async handleParsedResume(@Body() payload: ResumeParsedDto) {
    return this.webhooksService.processParsedResume(payload);
  }
}