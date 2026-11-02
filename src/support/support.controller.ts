import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets/all')
  async getAllTickets() {
    console.log('--- FETCHING GLOBAL TICKET QUEUE ---');
    return this.supportService.getAllTickets();
  }
   
  @Post('ticket/:userId')
  async createTicket(
    @Param('userId') userId: string,
    @Body() payload: any
  ) {
    return this.supportService.createTicket(userId, payload);
  }

  @Get('tickets/:userId')
  async getTickets(@Param('userId') userId: string) {
    return this.supportService.getClientTickets(userId);
  }

  //   NEW: Resolve ticket route
  @Patch('ticket/:id/resolve')
  async resolveTicket(
    @Param('id') id: string,
    @Body() payload: { message: string }
  ) {
    console.log(`--- ✅ MARKING TICKET RESOLVED: ${id} ---`);
    return this.supportService.resolveTicket(Number(id), payload.message);
  }

  // ==========================================
  //   NEW CHAT ENDPOINTS (Now safely inside the class!)
  // ==========================================
  @Get('chat/:userId')
  async getChatHistory(@Param('userId') userId: string) {
    return this.supportService.getChatHistory(userId);
  }

  @Post('chat/:userId')
  async sendChatMessage(
    @Param('userId') userId: string,
    @Body() payload: { senderId: string, senderRole: string, message: string }
  ) {
    return this.supportService.sendChatMessage(
      userId, 
      payload.senderId, 
      payload.senderRole, 
      payload.message
    );
  }
}