import { Controller, Post, Get, Body, Param, Query, BadRequestException, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Controller('mock-ats')
export class MockAtsController {
  private readonly logger = new Logger('MockEmployerATS');

  // ==========================================
  // STAGE 1: The API Receiver
  // ==========================================
  @Post('api/apply/:jobId')
  receiveApplicationApi(
    @Param('jobId') jobId: string, 
    @Body() candidateData: any, 
    @Query('forceFail') forceFail: string
  ) {
    this.logger.log(`Incoming API Application for Job: ${jobId}`);
    
    // 🚨 The Intentional Sabotage (For Stage 2 Testing) 
    if (forceFail === 'true') {
      this.logger.warn('API Application Blocked! (Simulating ATS rejection or CAPTCHA)');
      throw new BadRequestException('Application via API rejected. Please apply manually.');
    }

    this.logger.log(`API Application Accepted for: ${candidateData.firstName} ${candidateData.lastName}`);
    return { 
      success: true, 
      message: 'Application successfully received via ATS API!',
      candidateId: `cand_${Date.now()}`
    };
  }

  // ==========================================
  // STAGE 2: The HTML Webpage (For Puppeteer)
  // ==========================================
  @Get('web/apply/:jobId')
  serveApplicationWebpage(@Param('jobId') jobId: string, @Res() res: Response) {
    this.logger.log(`Serving Web Form for Job: ${jobId}`);
    
    // A raw HTML form for our Puppeteer bot to interact with
    const htmlForm = `
      <html>
        <head><title>Apply for Job ${jobId}</title></head>
        <body style="font-family: Arial, padding: 40px;">
          <h2>Apply for Job at Stark Industries</h2>
          <form id="apply-form" action="/mock-ats/web/submit" method="POST">
            <label>First Name:</label><br/>
            <input type="text" id="first_name" name="first_name" required /><br/><br/>
            
            <label>Last Name:</label><br/>
            <input type="text" id="last_name" name="last_name" required /><br/><br/>
            
            <label>LinkedIn URL:</label><br/>
            <input type="text" id="linkedin" name="linkedin" /><br/><br/>
            
            <button type="submit" id="submit-btn">Submit Application</button>
          </form>
        </body>
      </html>
    `;
    res.status(200).send(htmlForm);
  }

  @Post('web/submit')
  receiveWebSubmission(@Body() body: any) {
    this.logger.log(`Form Submitted via Browser Automation! Data: ${JSON.stringify(body)}`);
    return { success: true, message: 'Browser application received!' };
  }
}