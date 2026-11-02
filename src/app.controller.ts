import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  
  @Post('generate-pdf')
  async generateResumePdf(
    @Body() body: { targetRole: string }, 
    @Res() res: any // <-- Changed to 'any' to completely bypass the TS error
  ) {
    try {
      const { targetRole } = body;

      // 1. Pass the target role to your service where the Gemini logic lives
      const pdfBuffer = await this.appService.generateAiResume(targetRole);

      // 2. Set the correct headers so the browser knows it's receiving a PDF
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Tailored_${targetRole.replace(/\s+/g, '_')}_Resume.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      // 3. Send the generated PDF back to the frontend
      res.end(pdfBuffer);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to generate resume');
    }
  }
}

