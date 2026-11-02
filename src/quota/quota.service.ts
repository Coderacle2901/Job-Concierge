import { Injectable, InternalServerErrorException, HttpException, HttpStatus, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotaPricing } from './entities/quota-pricing.entity';
import { Client } from '../clients/entities/client.entity';

@Injectable()
export class QuotaService implements OnModuleInit {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    @InjectRepository(QuotaPricing)
    private readonly quotaRepo: Repository<QuotaPricing>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  //   Auto-inserts the defaults into Supabase when the server starts!
  async onModuleInit() {
    await this.seedDefaults();
  }

  private async seedDefaults() {
    const defaults = [
      { actionName: 'GENERATE_RESUME', pointCost: 1, description: 'Cost to generate an AI tailored resume' },
      { actionName: 'SUBMIT_APPLICATION', pointCost: 1, description: 'Cost to execute an application' },
      { actionName: 'COACHING_SESSION', pointCost: 2, description: 'Cost for extra interview coaching' },
      { actionName: 'RESUME_REVISION', pointCost: 1, description: 'Cost for an additional resume revision' }
    ];

    for (const item of defaults) {
      const exists = await this.quotaRepo.findOne({ where: { actionName: item.actionName } });
      if (!exists) {
        await this.quotaRepo.save(this.quotaRepo.create(item));
        this.logger.log(`Seeded default quota pricing for: ${item.actionName}`);
      }
    }
  }

  // ==========================================
  // THE DEDUCTION ENGINE
  // ==========================================
  async deductQuota(clientId: string, actionName: string): Promise<void> {
    const pricing = await this.quotaRepo.findOne({ where: { actionName, isActive: true } });
    if (!pricing) {
      this.logger.error(`Pricing rule not found or inactive for: ${actionName}`);
      throw new InternalServerErrorException(`Pricing rule missing for ${actionName}`);
    }

    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    // Check if they have enough points
    if (client.remainingQuota < pricing.pointCost) {
      throw new HttpException({
        status: HttpStatus.PAYMENT_REQUIRED,
        error: 'Out of Quota',
        message: `You need ${pricing.pointCost} points for this action, but only have ${client.remainingQuota}.`
      }, HttpStatus.PAYMENT_REQUIRED);
    }

    // Deduct and save
    client.remainingQuota -= pricing.pointCost;
    await this.clientRepo.save(client);
    
    this.logger.log(`✅ Deducted ${pricing.pointCost} points from Client ${clientId} for ${actionName}. Remaining: ${client.remainingQuota}`);
  }

  // ==========================================
  // THE REFUND ENGINE
  // ==========================================
  async refundQuota(clientId: string, actionName: string): Promise<void> {
    const pricing = await this.quotaRepo.findOne({ where: { actionName } });
    if (!pricing) return; // Fail silently if pricing doesn't exist

    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (client) {
      client.remainingQuota += pricing.pointCost;
      await this.clientRepo.save(client);
      this.logger.log(`🔄 Refunded ${pricing.pointCost} points to Client ${clientId} for ${actionName}.`);
    }
  }

  // ==========================================
  // ADMIN DASHBOARD METHODS
  // ==========================================
  async getAllPricingRules() {
    return await this.quotaRepo.find({ order: { actionName: 'ASC' } });
  }

  async updatePricingRule(actionName: string, pointCost: number, isActive?: boolean) {
    const pricing = await this.quotaRepo.findOne({ where: { actionName } });
    if (!pricing) throw new NotFoundException(`Rule ${actionName} not found`);

    pricing.pointCost = pointCost;
    if (isActive !== undefined) pricing.isActive = isActive;

    await this.quotaRepo.save(pricing);
    this.logger.log(`Admin updated ${actionName} cost to ${pointCost}`);
    return pricing;
  }
}