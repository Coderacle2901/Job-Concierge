import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai'; // The new unified SDK!
import * as puppeteer from 'puppeteer';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async generateAiResume(targetRole: string): Promise<Buffer> {
    try {
      const apiKey = process.env.GEMINI_API_KEY; 
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is missing from environment variables');
      }

      // 1. Initialize the new Google GenAI Client
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const prompt = `You are an expert resume writer. Generate a professional, highly ATS-optimized resume for the role of "${targetRole}". 
      Return ONLY raw, valid HTML code. Include beautiful inline CSS styling so it looks like a modern, clean document. 
      Use a white background, dark text, and a sky blue (#0275D8) accent color for headers.
      Do not wrap the output in markdown code blocks (e.g., no \`\`\`html). Just return the HTML structure starting with <!DOCTYPE html>.`;

      // 2. Fire the prompt using the new models.generateContent syntax
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Utilizing the latest model version
        contents: prompt,
      });

      // 3. Extract the text (it is a property now, not a function)
      let htmlContent = response.text;

      if (!htmlContent) {
        throw new Error('Gemini returned an empty response.');
      }

      // Clean up the response just in case Gemini stubbornly adds markdown backticks
      htmlContent = htmlContent.replace(/```html/gi, '').replace(/```/gi, '').trim();

      // 4. Fire up Puppeteer to convert the HTML to a PDF
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'], 
      });

      const page = await browser.newPage();
      
      await page.setContent(htmlContent, { waitUntil: 'load' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true, 
        margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      });

      await browser.close();

      return Buffer.from(pdfUint8Array);

    } catch (error) {
      console.error('Error generating AI Resume:', error);
      throw new InternalServerErrorException('Could not generate the resume. Check your API key and internet connection.');
    }
  }
}