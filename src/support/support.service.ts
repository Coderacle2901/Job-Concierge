import { Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { QuotaService } from '../quota/quota.service'; //   IMPORT QUOTA SERVICE

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly quotaService: QuotaService //   INJECT QUOTA SERVICE
  ) {}

  // ==========================================
  // 1. Submit a New Ticket (WITH QUOTA TRACKING)
  // ==========================================
  async createTicket(userId: string, payload: any) {
    let deductedAction: string | null = null;

    //   1. CHECK TICKET CATEGORY & DEDUCT QUOTA
    try {
      if (payload.category === 'Interview Preparation') {
        await this.quotaService.deductQuota(userId, 'COACHING_SESSION');
        deductedAction = 'COACHING_SESSION';
      } else if (payload.category === 'Resume Optimization') {
        // You will need to add RESUME_REVISION to your DB or use GENERATE_RESUME
        await this.quotaService.deductQuota(userId, 'RESUME_REVISION'); 
        deductedAction = 'RESUME_REVISION';
      }
    } catch (quotaError) {
      // If they are out of points, this stops execution and bubbles the 402 Payment Required error to the frontend
      throw quotaError;
    }

    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          user_id: userId,
          subject: payload.subject,
          category: payload.category,
          description: payload.description,
          status: 'Pending'
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      
      this.logger.log(`Ticket created successfully for ${userId}. Category: ${payload.category}`);
      return data;
      
    } catch (err) {
      this.logger.error('Service Error creating ticket:', err);
      
      //   2. REFUND QUOTA IF DB CRASHES
      if (deductedAction) {
        this.logger.warn(`Ticket creation failed. Refunding ${deductedAction} for user ${userId}`);
        await this.quotaService.refundQuota(userId, deductedAction);
      }
      
      throw new InternalServerErrorException('Failed to create ticket');
    }
  }

  // ==========================================
  // 2. Fetch Tickets for a Client
  // ==========================================
  async getClientTickets(userId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
      
    } catch (err) {
      console.error('Service Error fetching tickets:', err);
      return [];
    }
  }

  // ==========================================
  // 3. Fetch ALL Tickets for Staff
  // ==========================================
  async getAllTickets() {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('support_tickets')
        .select('*, clients(name)') 
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Join failed, falling back to basic select. Error:', error.message);
        
        const fallback = await this.supabaseService.getClient()
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (fallback.error) throw fallback.error;
        
        return fallback.data.map(ticket => ({
          ...ticket,
          clientName: 'Client'
        }));
      }
      
      return data.map(ticket => ({
        ...ticket,
        clientName: ticket.clients?.name || 'Unknown Client'
      }));
      
    } catch (err) {
      console.error('CRITICAL Service Error fetching all tickets:', err);
      return [];
    }
  }

  // ==========================================
  // 4. Resolve a Ticket
  // ==========================================
  async resolveTicket(ticketId: number, resolutionMessage: string) {
    try {
      const supabase = this.supabaseService.getClient();

      const { data: ticket, error: fetchError } = await supabase
        .from('support_tickets')
        .select('user_id')
        .eq('id', ticketId)
        .maybeSingle();
        
      if (fetchError) throw fetchError;
      
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

      const { data, error } = await supabase
        .from('support_tickets')
        .update({ 
          status: 'Resolved',
          resolution_message: resolutionMessage 
        })
        .eq('id', ticketId)
        .select()
        .maybeSingle();

      if (error) throw error;

      const { error: notifError } = await supabase
        .from('notifications')
        .insert([{
          user_id: ticket.user_id, 
          title: `Ticket TICK-${ticketId} Resolved ✅`,
          message: `Head over to your support page to view details.`,
          type: 'support',
          is_read: false
        }]);

      if (notifError) console.error("Error saving notification:", notifError);

      return data;
      
    } catch (err) {
      console.error('Service Error resolving ticket:', err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to resolve ticket');
    }
  }

  // ==========================================
  // 5. Fetch Chat History 
  // ==========================================
  async getChatHistory(userId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }); 

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Service Error fetching chat:', err);
      return [];
    }
  }

  // ==========================================
  // 6. Send Chat Message 
  // ==========================================
  async sendChatMessage(userId: string, senderId: string, senderRole: string, message: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('chat_messages')
        .insert([{
          user_id: userId,
          sender_id: senderId,
          sender_role: senderRole,
          message: message
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Service Error sending chat:', err);
      throw new InternalServerErrorException('Failed to send message');
    }
  }
}