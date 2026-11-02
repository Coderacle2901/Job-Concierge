import { Controller, Post, Body, BadRequestException, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto'; 

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    //   Now strictly using your LoginDto for validation!
    return this.authService.login(body.email, body.password);
  }

  //   NEW: The Signup Route mapping
  @Post('signup')
  async signup(@Body() body: any) {
    return this.authService.signup(body);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    return this.authService.forgotPassword(body.email);
  }

  @Post('update-password')
  async updatePassword(
    @Headers('authorization') authHeader: string,
    @Body() body: { newPassword: string }
  ) {
    if (!authHeader) {
      throw new BadRequestException('Authorization token is required');
    }
    
    // Extract the token (Bearer eyyy...)
    const token = authHeader.split(' ')[1]; 
    return this.authService.updatePassword(token, body.newPassword);
  }
}