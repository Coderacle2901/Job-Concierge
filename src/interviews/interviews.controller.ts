import { Controller, Get, Param, Post, Body, Patch } from '@nestjs/common';
import { InterviewsService } from './interviews.service';

@Controller('interviews') // main.ts handles the /api/v1/
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}


  //   MUST BE ABOVE THE :clientId ROUTE!
  @Get('staff/all')
  async getAllStaffInterviews() {
    console.log(`--- FETCHING ALL INTERVIEWS FOR STAFF ---`);
    return this.interviewsService.getAllStaffInterviews();
  }

  @Get(':clientId')
  async getInterviews(@Param('clientId') clientId: string) {
    console.log(`--- FETCHING INTERVIEWS FOR: ${clientId} ---`);
    return this.interviewsService.getClientInterviews(clientId);
  }

  //   THE MISSING PIECE: This catches the POST request from your Staff Dashboard!
  @Post('schedule')
  async scheduleInterview(@Body() payload: any) {
    console.log("---   SCHEDULING NEW PREP SESSION ---", payload);
    return this.interviewsService.schedulePrepSession(payload);
  }

 @Patch(':id/complete')
  async completeInterview(@Param('id') id: string) {
    console.log(`--- ✅ MARKING INTERVIEW COMPLETE: ${id} ---`);
    return this.interviewsService.markAsCompleted(id);
  }
}