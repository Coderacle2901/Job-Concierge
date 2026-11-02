import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotaService } from './quota.service';
import { QuotaController } from './quota.controller';
import { QuotaPricing } from './entities/quota-pricing.entity';
import { Client } from '../clients/entities/client.entity';

@Module({
  //   CRITICAL FIX: You must import the entities the Service uses!
  imports: [TypeOrmModule.forFeature([QuotaPricing, Client])],
  controllers: [QuotaController],
  providers: [QuotaService],
  exports: [QuotaService], 
})
export class QuotaModule {}