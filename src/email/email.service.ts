import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  async notifyAdminsNewClient(clientName: string, targetRole: string) {
    try {
      await this.mailerService.sendMail({
        to: this.configService.get('ADMIN_EMAIL_GROUP'), 
        subject: `Action Required: New Client Intake - ${clientName}`,
        template: './admin-alert', 
        context: {
          clientName,
          targetRole,
        },
      });
      this.logger.log(`Admin alert sent successfully for ${clientName}`);
    } catch (error: any) {
      this.logger.error(`Error dispatching Admin alert: ${error.message}`);
    }
  }

  async sendClientWelcomeReceipt(clientEmail: string, clientName: string, targetRole: string) {
    try {
      await this.mailerService.sendMail({
        to: clientEmail,
        subject: 'Your JobConcierge Review is in Progress!',
        template: './client-receipt', 
        context: {
          clientName,
          targetRole,
        },
      });
      this.logger.log(`Client receipt dispatched to ${clientEmail}`);
    } catch (error: any) {
      this.logger.error(`Error dispatching Client receipt: ${error.message}`);
    }
  }
}