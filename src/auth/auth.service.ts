import { 
  Injectable, 
  UnauthorizedException, 
  BadRequestException, 
  ConflictException,
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseService } from '../supabase/supabase.service';
import { Client } from '../clients/entities/client.entity'; // Adjust path if needed
import { CandidateProfile } from '../profile/entities/candidate-profile.entity'; 

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    //   NEW: Injecting the repositories for signup
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(CandidateProfile)
    private profileRepo: Repository<CandidateProfile>,
  ) {}

  // ==========================================
  //   1. SIGNUP LOGIC (The Two-Table Bridge)
  // ==========================================
  async signup(dto: any) {
    const supabase = this.supabaseService.getClient();

    // 1. Create the user securely in Supabase Auth FIRST
    // This inherently checks if the user exists in Auth, preventing race conditions
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/login`,
      }
    });

    if (authError) {
      // If it's a duplicate email, Supabase returns a specific error we can catch
      if (authError.message.includes('already registered')) {
        throw new ConflictException('Error! A user with this email already exists. Try logging in.');
      }
      throw new BadRequestException(`Signup failed: ${authError.message}`);
    }

    if (!authData.user) {
      throw new BadRequestException('Failed to generate user account.');
    }

    const userId = authData.user.id;

    try {
      // 2. Save Identity & Billing to TypeORM 'clients' table
      const client = this.clientRepo.create({
        id: userId, 
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        name: dto.name,
        role: 'customer',
        planName: 'launchpad', 
        totalQuota: 200,       
        remainingQuota: 200,
      });

      const savedClient = await this.clientRepo.save(client);

      // 3. Save Professional Persona to 'candidate_profiles' table
      if (dto.profile) {
        const profile = this.profileRepo.create({
          client: savedClient, 
          currentRole: dto.profile.currentRole,
          targetRole: dto.profile.targetRole,
          industry: dto.profile.industry,
          experienceYears: dto.profile.experienceYears,
          remotePreference: dto.profile.remotePreference,
          minSalary: dto.profile.minSalary?.toString(), 
          startDate: dto.profile.startDate,
        });

        await this.profileRepo.save(profile);
      }

      // 4. Return the token so the React frontend can auto-login
      return {
        token: authData.session?.access_token || null,
        message: 'Account created successfully',
        user: {
          id: userId,
          email: dto.email,
          role: 'customer',
        },
      };
    } catch (dbError) {
       console.error("DB Save failed during signup:", dbError);
       // Optional: Clean up Supabase Auth user if DB save fails to prevent ghost accounts
       throw new InternalServerErrorException('Account created, but failed to save profile data.');
    }
  }

  // ==========================================
  //   2. LOGIN LOGIC (With Heavy Debugging)
  // ==========================================
  async login(email: string, pass: string) {
    const supabase = this.supabaseService.getClient();

    

    // 1. Authenticate the raw credentials with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      
      throw new UnauthorizedException('Error! Invalid email or password.');
    }

    const userId = data.user.id;
    

    let userRole: string | null = null;
    let hasCompletedIntake = false;

    //   DEBUG: VIP CHECK 1: Admins Table
    
    const { data: admin, error: adminErr } = await supabase
      .from('admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    

    if (admin) {
      
      userRole = 'admin';
      hasCompletedIntake = true; 
    } else {
      //   DEBUG: VIP CHECK 2: Staff Table
      
      const { data: staff, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      

      if (staff) {
      
        userRole = 'staff';
        hasCompletedIntake = true; 
      } else {
        //   DEBUG: GENERAL ADMISSION: Clients Table
      
        const { data: client, error: clientErr } = await supabase
          .from('clients')
          .select('id, has_completed_intake') 
          .eq('id', userId)
          .maybeSingle();

      

        if (client) {
      
          userRole = 'customer';
          hasCompletedIntake = client.has_completed_intake || false; 
        }
      }
    }

    if (!userRole) {
      
      await supabase.auth.signOut();
      throw new UnauthorizedException('Profile not found in the database. Please contact support.');
    }


    return {
      token: data.session.access_token,
      user: {
        id: userId,
        email: data.user.email,
        role: userRole,
        hasCompletedIntake: hasCompletedIntake, 
      },
    };
  } 

  // ==========================================
  //   3. LOGOUT LOGIC
  // ==========================================
  async logout() {
    const { error } = await this.supabaseService.getClient().auth.signOut();
    if (error) throw new UnauthorizedException('Error logging out');
    return { message: 'Logged out successfully' };
  }

  // ==========================================
  //   4. FORGOT PASSWORD (SEND EMAIL)
  // ==========================================
  async forgotPassword(email: string) {
    try {
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        // This is the URL the user will be sent to after clicking the email link!
        // Make sure to change this to your production URL later.
        redirectTo: `${process.env.FRONTEND_URL}/update-password`, 
      });

      if (error) {
        console.error("Supabase reset password error:", error.message);
        throw error;
      }

      return { message: 'Password reset link sent successfully!' };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to send reset link');
    }
  }
  
  // ==========================================
  //   5. UPDATE PASSWORD (AFTER EMAIL LINK)
  // ==========================================
  async updatePassword(token: string, newPassword: string) {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Supabase trick: Update the user using their specific access token!
      const { data, error } = await supabase.auth.updateUser(
        { password: newPassword }
      );

      // Note: Because NestJS might be using a global service client, the safest 
      // Supabase Admin approach is to use the admin API if standard user update fails:
      if (error) {
        // Fallback: Manually get the user by their token, then admin-update them
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) throw new UnauthorizedException('Invalid or expired reset token.');
        
        const { error: adminError } = await supabase.auth.admin.updateUserById(
          userData.user.id,
          { password: newPassword }
        );
        if (adminError) throw adminError;
      }

      return { message: 'Password updated successfully!' };
    } catch (err: any) {
      console.error("Update password error:", err);
      throw new InternalServerErrorException(err.message || 'Failed to update password');
    }
  }
}