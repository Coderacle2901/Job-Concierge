import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as puppeteer from 'puppeteer';
import { BaseResume } from '../entities/base-resume.entity';

@Injectable()
export class ResumeRenderService {
  private readonly logger = new Logger(ResumeRenderService.name);

  constructor(
    @InjectRepository(BaseResume)
    private readonly baseResumeRepo: Repository<BaseResume>,
  ) {}

  // ─── RENDER PDF FROM RESUME ID ─────────────────────────────────────────────

  async renderPdfFromId(resumeId: string): Promise<Buffer> {
    // Fetches the base resume record, converts the Atomic JSON to HTML,
    // then uses Puppeteer to generate a PDF buffer.
    // Returns the raw PDF buffer — the controller decides what to do with it
    // (stream it as a download or upload to Supabase Storage).

    const resume = await this.baseResumeRepo.findOne({
      where: { id: resumeId },
    });

    if (!resume) {
      throw new NotFoundException(
        `Base resume with id ${resumeId} not found`,
      );
    }

    if (!resume.resumeJson) {
      throw new NotFoundException(
        `Base resume with id ${resumeId} has no JSON content`,
      );
    }

    this.logger.log(`Rendering PDF for resume "${resume.resumeName}"...`);
    return this.generatePdfBuffer(resume.resumeJson);
  }

  // ─── RENDER PDF FROM JSON DIRECTLY ────────────────────────────────────────

  async renderPdfFromJson(resumeJson: Record<string, any>): Promise<Buffer> {
    // Renders a PDF directly from a JSON object without fetching from DB.
    // Used when the admin wants to preview the resume in the editor
    // before saving — the frontend sends the current JSON state and
    // gets back a PDF preview without creating a DB record.

    this.logger.log('Rendering PDF preview from raw JSON...');
    return this.generatePdfBuffer(resumeJson);
  }

  // ─── PDF BUFFER GENERATOR ──────────────────────────────────────────────────

  private async generatePdfBuffer(
    resumeJson: Record<string, any>,
  ): Promise<Buffer> {
    // Converts Atomic JSON → HTML string → PDF buffer via Puppeteer.
    // This is the core rendering engine.

    this.logger.log('Building HTML from Atomic JSON...');
    const html = this.buildHtml(resumeJson);

    const executablePath =
      process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome';
    // Puppeteer requires a Chrome/Chromium executable.
    // On Windows it uses the installed Chrome browser.
    // On Linux (production) it uses the system Chrome.

    this.logger.log('Launching Puppeteer...');
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      // waitUntil: 'networkidle0' ensures all fonts and assets
      // are fully loaded before generating the PDF.
      // Critical for Google Fonts (Poppins, Inter, Montserrat) to render.

      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          bottom: '20px',
          left: '30px',
          right: '30px',
        },
      });

      return Buffer.from(pdfUint8);

    } finally {
      await browser.close();
      // Always close the browser even if PDF generation fails.
      // Leaving browsers open causes memory leaks in production.
    }
  }

  // ─── HTML BUILDER ──────────────────────────────────────────────────────────

  private buildHtml(resumeJson: Record<string, any>): string {
    // Builds a complete HTML document from the Atomic JSON structure.
    // Each section is rendered by its own method.
    // Formatting objects in each node are converted to inline CSS.

    const body = [
      this.renderSection(resumeJson.personalInfo),
      this.renderSection(resumeJson.professionalSummary),
      this.renderSection(resumeJson.workExperience),
      this.renderSection(resumeJson.skills),
      this.renderSection(resumeJson.education),
    ]
      .filter(Boolean)
      .join('\n');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resume</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700&family=Poppins:wght@700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; font-size: 11px; color: #2d3748; background: white; padding: 20px 30px; }
    a { text-decoration: none; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
  }

  // ─── SECTION RENDERER ──────────────────────────────────────────────────────

  private renderSection(section: any): string {
    if (!section) return '';

    let html = '';

    // Render section title if present
    if (section.title) {
      const tf = section.titleFormatting || {};
      const style = this.formattingToCSS({
        ...tf,
        display: 'block',
        marginBottom: tf.marginBottom ? `${tf.marginBottom}px` : '8px',
        marginTop: tf.marginTop ? `${tf.marginTop}px` : '15px',
        paddingBottom: '4px',
      });
      html += `<div style="${style}">${section.title}</div>`;
    }

    // Render children nodes
    if (section.children && Array.isArray(section.children)) {
      html += section.children.map((child: any) => this.renderNode(child)).join('');
    }

    return html;
  }

  // ─── NODE RENDERER ─────────────────────────────────────────────────────────

  private renderNode(node: any): string {
    // Routes each node to its specific renderer based on type.
    // Every node type in the Atomic JSON format has a corresponding
    // rendering strategy here.

    if (!node || !node.type) return '';

    switch (node.type) {

      case 'text':
        return this.renderText(node);

      case 'link':
        return this.renderLink(node);

      case 'paragraph':
        return this.renderParagraph(node);

      case 'contactRow':
        return this.renderContactRow(node);

      case 'jobEntry':
        return this.renderJobEntry(node);

      case 'bulletList':
        return this.renderBulletList(node);

      case 'bulletPoint':
        return this.renderBulletPoint(node);

      case 'companyInfo':
        return this.renderChildren(node);

      case 'dateLocation':
        return this.renderDateLocation(node);

      case 'skillCategories':
        return this.renderSkillCategories(node);

      case 'category':
        return this.renderCategory(node);

      case 'educationEntry':
        return this.renderEducationEntry(node);

      default:
        return '';
    }
  }

  // ─── INDIVIDUAL NODE RENDERERS ─────────────────────────────────────────────

  private renderText(node: any): string {
    const style = this.formattingToCSS(node.formatting || {});
    return `<span style="${style}">${node.value || ''}</span>`;
  }

  private renderLink(node: any): string {
    const style = this.formattingToCSS(node.formatting || {});
    return `<a href="${node.url || '#'}" style="${style}">${node.value || ''}</a>`;
  }

  private renderParagraph(node: any): string {
    const children = (node.children || [])
      .map((child: any) => this.renderNode(child))
      .join('');
    return `<p style="margin-bottom: 8px; line-height: 1.5;">${children}</p>`;
  }

  private renderContactRow(node: any): string {
    const gap = node.gap || 20;
    const justify = node.justifyContent || 'center';
    const children = (node.children || [])
      .map((child: any) => this.renderNode(child))
      .join('');
    return `
<div style="display: flex; justify-content: ${justify}; gap: ${gap}px; flex-wrap: wrap; margin-bottom: 10px;">
  ${children}
</div>`;
  }

  private renderJobEntry(node: any): string {
    // Job entries use a two-column grid layout:
    // left column: company info (title + company name)
    // right column: date and location (right-aligned)
    const children = (node.children || [])
      .map((child: any, index: number) => {
        const align = index === 1 ? 'text-align: right;' : '';
        return `<div style="${align}">${this.renderNode(child)}</div>`;
      })
      .join('');

    return `
<div style="display: grid; grid-template-columns: 2fr 1fr; margin-bottom: 4px;">
  ${children}
</div>`;
  }

  private renderBulletList(node: any): string {
    const bulletColor = node.bulletColor || '#3182ce';
    const spacing = node.spacing || 4;
    const children = (node.children || [])
      .map((child: any) => this.renderBulletPoint(child, bulletColor, spacing))
      .join('');
    return `<div style="margin-bottom: 12px;">${children}</div>`;
  }

  private renderBulletPoint(
    node: any,
    bulletColor = '#3182ce',
    spacing = 4,
  ): string {
    const content = node.value
      ? `<span style="font-size: 10.5px;">${node.value}</span>`
      : (node.children || []).map((child: any) => this.renderNode(child)).join('');

    return `
<div style="display: flex; gap: 8px; margin-bottom: ${spacing}px; align-items: flex-start;">
  <span style="color: ${bulletColor}; margin-top: 1px; flex-shrink: 0;">•</span>
  <div style="flex: 1; line-height: 1.5;">${content}</div>
</div>`;
  }

  private renderDateLocation(node: any): string {
    const children = (node.children || [])
      .map((child: any) => this.renderNode(child))
      .join('<br/>');
    return `<div style="text-align: right;">${children}</div>`;
  }

  private renderSkillCategories(node: any): string {
    const columns = node.columns || 2;
    const gap = node.gap || 15;
    const children = (node.children || [])
      .map((child: any) => this.renderNode(child))
      .join('');
    return `
<div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gap}px; margin-bottom: 12px;">
  ${children}
</div>`;
  }

  private renderCategory(node: any): string {
    const tf = node.titleFormatting || {};
    const titleStyle = this.formattingToCSS({ ...tf, display: 'block', marginBottom: '6px' });
    const skills = (node.skills || [])
      .map((skill: any) => {
        const skillStyle = this.formattingToCSS(skill.formatting || {});
        return `<span style="${skillStyle}; display: inline-block; margin: 2px 4px 2px 0;">${skill.value}</span>`;
      })
      .join('');

    return `
<div style="margin-bottom: 8px;">
  <span style="${titleStyle}">${node.title || ''}</span>
  <div style="display: flex; flex-wrap: wrap;">${skills}</div>
</div>`;
  }

  private renderEducationEntry(node: any): string {
    const children = (node.children || [])
      .map((child: any) => this.renderNode(child))
      .join(' ');
    return `<div style="margin-bottom: 8px;">${children}</div>`;
  }

  private renderChildren(node: any): string {
    return (node.children || [])
      .map((child: any) => this.renderNode(child))
      .join('');
  }

  // ─── FORMATTING TO CSS ─────────────────────────────────────────────────────

  private formattingToCSS(formatting: Record<string, any>): string {
    // Converts a formatting object from the Atomic JSON into
    // an inline CSS string. Only maps properties that are present.
    // Unknown properties are safely ignored.

    const rules: string[] = [];

    if (formatting.fontFamily) rules.push(`font-family: '${formatting.fontFamily}', sans-serif`);
    if (formatting.fontSize) rules.push(`font-size: ${formatting.fontSize}px`);
    if (formatting.bold) rules.push('font-weight: bold');
    if (formatting.italic) rules.push('font-style: italic');
    if (formatting.color) rules.push(`color: ${formatting.color}`);
    if (formatting.backgroundColor) rules.push(`background-color: ${formatting.backgroundColor}`);
    if (formatting.alignment) rules.push(`text-align: ${formatting.alignment}`);
    if (formatting.letterSpacing) rules.push(`letter-spacing: ${formatting.letterSpacing}px`);
    if (formatting.marginTop) rules.push(`margin-top: ${formatting.marginTop}px`);
    if (formatting.marginBottom) rules.push(`margin-bottom: ${formatting.marginBottom}px`);
    if (formatting.padding) rules.push(`padding: ${formatting.padding}`);
    if (formatting.borderRadius) rules.push(`border-radius: ${formatting.borderRadius}px`);
    if (formatting.borderBottom) rules.push(`border-bottom: ${formatting.borderBottom}`);
    if (formatting.textDecoration) rules.push(`text-decoration: ${formatting.textDecoration}`);
    if (formatting.display) rules.push(`display: ${formatting.display}`);

    return rules.join('; ');
  }
}