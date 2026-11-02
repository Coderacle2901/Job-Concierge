import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/profile')
  async getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  @Put(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Body() payload: { name: string, phone: string, linkedin: string }
  ) {
    console.log(`--- UPDATING PROFILE FOR: ${id} ---`);
    return this.usersService.updateProfile(id, payload);
  }
}