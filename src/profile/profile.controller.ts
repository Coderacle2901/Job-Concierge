import { Controller, Get, Put, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { SupabaseAuthGuard } from '../auth/supabase.guard'; 

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':id')
  getProfile(@Param('id') id: string) {
    return this.profileService.getProfile(id);
  }

  @Put(':id')
  updateProfile(@Param('id') id: string, @Body() data: any) {
    return this.profileService.updateProfile(id, data);
  }

  //   NEW: The Intake Endpoint
  @Post('intake')
  @UseGuards(SupabaseAuthGuard) // Protect it so only logged-in users can submit
  async submitIntakeForm(@Request() req: any, @Body() payload: any) {
    // req.user comes from the SupabaseAuthGuard (the user's token)
    const userId = req.user.sub || req.user.id; 
    return this.profileService.processIntake(userId, payload);
  }
}