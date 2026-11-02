import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseModule } from '../supabase/supabase.module'; // Adjust path if needed

@Module({
  imports: [SupabaseModule], //   Inject Supabase so the service can query the DB
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // Export in case other modules need to trigger notifications later
})
export class NotificationsModule {}