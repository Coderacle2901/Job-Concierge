import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getUserNotifications(clientId: string) {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('notifications')
        .select('*')
        .eq('user_id', clientId)
        //   UPGRADE: Order by timestamp, and bump limit to 50 so they don't miss anything
        .order('created_at', { ascending: false }) 
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return [];
    }
  }

  async markAllAsRead(clientId: string) {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', clientId)
        .eq('is_read', false); // Only update unread ones

      if (error) throw error;
      return { success: true, message: 'All notifications marked as read' };
    } catch (err) {
      throw new InternalServerErrorException('Failed to mark notifications as read');
    }
  }

  //   NEW: Update a single notification
  async markSingleAsRead(clientId: string, notificationId: string) {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', clientId)
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      throw new InternalServerErrorException('Failed to mark single notification as read');
    }
  }
}