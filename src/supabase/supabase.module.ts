import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global() // This makes Supabase available everywhere without needing to import the module constantly
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService], // Crucial: allows other modules to use it
})
export class SupabaseModule {}