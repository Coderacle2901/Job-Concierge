// src/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

// We need to import the entities so our WebhookService can write to the database
import { Client } from '../clients/entities/client.entity';
import { ResumeVariant } from '../resumes/entities/resume.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, ResumeVariant]),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}