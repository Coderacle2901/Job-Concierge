import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // ==========================================
  // FETCH USER PROFILE
  // ==========================================
  async getProfile(userId: string) {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Fetch core client info
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (clientError) throw clientError;

      // Fetch extended profile info
      const { data: profile } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('clientId', userId)
        .maybeSingle();

      // Merge them together for the frontend
      return { ...client, ...profile };
    } catch (err) {
      console.error('Error fetching profile:', err);
      throw new NotFoundException('Profile not found');
    }
  }

  // ==========================================
  // UPDATE USER PROFILE
  // ==========================================
  async updateProfile(userId: string, payload: { firstName?: string, lastName?: string, phone?: string, linkedin?: string }) {
    try {
      const supabase = this.supabaseService.getClient();

      // 1. Update the core 'clients' table
      const { error: clientError } = await supabase
        .from('clients')
        .update({ 
          firstName: payload.firstName,
          lastName: payload.lastName,
          // Optional: Keep the legacy 'name' column synced just in case other parts of the app use it!
          name: `${payload.firstName} ${payload.lastName}`.trim() 
        })
        .eq('id', userId);

      if (clientError) throw clientError;

      // 2. Upsert the 'candidate_profiles' table 
      const { error: profileError } = await supabase
        .from('candidate_profiles')
        .upsert({
          clientId: userId,
          phone: payload.phone,
          linkedin: payload.linkedin
        }, { onConflict: 'clientId' });

      if (profileError) throw profileError;

      return { message: 'Profile updated successfully' };
      
    } catch (err) {
      console.error('Error updating profile:', err);
      throw new InternalServerErrorException('Failed to update profile');
    }
  }
}