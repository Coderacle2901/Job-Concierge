import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    //   Check exactly what you named it in .env (e.g., SUPABASE_KEY or SUPABASE_ANON_KEY)
    const supabaseKey = process.env.SUPABASE_KEY; 

    if (!supabaseUrl || !supabaseKey) {
      this.logger.error('Supabase URL or Key missing from .env!');
      throw new InternalServerErrorException('Database configuration missing');
    }

    // 🔍 Log the first few characters to verify it's the 'sb_secret' one
    this.logger.log(`Initializing Supabase with key starting with: ${supabaseKey.substring(0, 10)}...`);

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, //   CRUCIAL for backend: prevents permission/session leaks
        autoRefreshToken: false,
      },
    });
  }

  getClient(): SupabaseClient {
    if (!this.supabase) {
      throw new InternalServerErrorException('Supabase connection not initialized');
    }
    return this.supabase;
  }
  
}