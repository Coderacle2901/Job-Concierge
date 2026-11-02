import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service'; // Assuming this is here
import { Client } from '../clients/entities/client.entity';
import { CandidateProfile } from '../profile/entities/candidate-profile.entity'; // Assuming this is here

@Module({
  imports: [
    //   Give AuthService access to the databases
    TypeOrmModule.forFeature([Client, CandidateProfile])
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService]
})
export class AuthModule {}