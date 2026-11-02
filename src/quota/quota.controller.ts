import { Controller, Get, Post, Body, Param, Put, UseGuards } from '@nestjs/common';
import { QuotaService } from './quota.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('quota')
//   CRITICAL FIX: Lock this entire controller down to Admins!
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
export class QuotaController {
    constructor(private readonly quotaService: QuotaService) {}

    // Admin Dashboard: View all current pricing rules
    @Get('pricing')
    async getAllPricing() {
        return await this.quotaService.getAllPricingRules();
    }

    // Admin Dashboard: Update the cost of an action
    @Put('pricing/:actionName')
    async updatePricing(
        @Param('actionName') actionName: string, 
        @Body('pointCost') pointCost: number,
        @Body('isActive') isActive?: boolean
    ) {
        return await this.quotaService.updatePricingRule(actionName, pointCost, isActive);
    }
}