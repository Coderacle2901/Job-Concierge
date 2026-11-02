import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class InterviewsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  // ==========================================
  // 1. Fetch Client Interviews
  // ==========================================
  async getClientInterviews(clientId: string) {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('interviews') 
        .select('*')
        .eq('user_id', clientId) 
        .order('id', { ascending: false }); 

      if (error) {
        console.error('Supabase Error:', error);
        throw new InternalServerErrorException('Failed to fetch interviews from database');
      }

      return data || []; 
      
    } catch (err) {
      console.error('Service Error:', err);
      return []; 
    }
  }

  // ==========================================
  // 2. Schedule Interview & Notify (Phase 1)
  // ==========================================
  async schedulePrepSession(payload: any) {
    try {
      const supabase = this.supabaseService.getClient();

      // DYNAMIC LOGIC: Check if it's an Employer or Prep interview
      const isEmployer = payload.type === 'employer';
      const companyName = isEmployer ? payload.company : 'Job Concierge Staff';
      const jobTitle = isEmployer ? payload.jobTitle : 'Mock Interview & Resume Defense';
      const stage = isEmployer ? 'Interview' : 'Preparation';

      // Save the interview using dynamic data
      const { data: interview, error: interviewError } = await supabase
        .from('interviews')
        .insert([{
          user_id: payload.clientId, 
          job_title: jobTitle,
          company: companyName,
          date: payload.date,
          time: payload.time,
          type: 'video',
          platform: 'Zoom/Meet',
          meeting_link: payload.meetingLink,
          notes: payload.notes,
          stage: stage,
          status: 'upcoming',
          preparation_status: isEmployer ? 'Needs Prep' : 'Ready'
        }])
        .select()
        .maybeSingle();

      if (interviewError) throw interviewError;

      // Dynamic Notification logic
      const notifTitle = isEmployer 
        ? `New Interview: ${companyName} 🎉` 
        : 'New Prep Session Scheduled! 🎉';
        
      const notifMessage = isEmployer
        ? `Your interview for ${jobTitle} at ${companyName} is booked for ${payload.date} at ${payload.time}.`
        : `Your mock interview is booked for ${payload.date} at ${payload.time}.`;

      const { error: notifError } = await supabase
        .from('notifications')
        .insert([{
          user_id: payload.clientId, 
          title: notifTitle,
          message: notifMessage,
          type: 'interview',
          is_read: false
        }]);

      if (notifError) console.error("Error saving notification:", notifError);

      return interview;

    } catch (err) {
      console.error('Service Error:', err);
      throw new InternalServerErrorException('Failed to schedule interview');
    }
  }

  // ==========================================
  // 3. Mark Interview as Completed (Phase 2)
  // ==========================================
  async markAsCompleted(interviewId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('interviews')
        .update({ status: 'completed' }) //   Flips the state!
        .eq('id', interviewId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
      
    } catch (err) {
      console.error('Error updating interview:', err);
      throw new InternalServerErrorException('Failed to mark interview as completed');
    }
  }

  // ==========================================
  // 4. Fetch ALL Interviews (Phase 3)
  // ==========================================
  async getAllStaffInterviews() {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('interviews')
        // We select *, then link to the 'auth.users' table to grab their email, 
        // OR to your 'clients' table if you have a foreign key set up.
        // Assuming 'clients' table relationship exists for 'user_id':
        .select('*, clients(name)') 
        .order('date', { ascending: true }); // Sort by upcoming dates

      if (error) throw error;
      
      // If the join works, we map the client's name out so the frontend can use it easily
      const mappedData = data.map(item => ({
        ...item,
        clientName: item.clients?.name || 'Unknown Client'
      }));

      return mappedData;
      
    } catch (err) {
      console.error('Service Error fetching all staff interviews:', err);
      return []; 
    }
  }
}