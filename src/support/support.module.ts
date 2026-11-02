import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupabaseModule } from '../supabase/supabase.module'; //   ADDED THIS
import { QuotaModule } from '../quota/quota.module';
@Module({
    
    imports: [SupabaseModule, QuotaModule], //   MAKE SURE TO IMPORT THE SUPABASE MODULE AND QUOTA MODULE HERE
    controllers: [SupportController],
    providers: [SupportService],
    exports: [SupportService],
})
export class SupportModule {}