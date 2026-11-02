import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { ApplicationRecord } from '../applications/entities/application.entity';
import { ApplicationStatus } from '../applications/enums/application-status.enum';
import { Client } from '../clients/entities/client.entity';
import { Staff } from '../staff/entities/staff.entity';
import { StaffAssignment, AssignmentStatus } from '../staff/entities/staff-assignment.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ApplicationRecord) private appRepo: Repository<ApplicationRecord>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Staff) private staffRepo: Repository<Staff>,
    @InjectRepository(StaffAssignment) private assignRepo: Repository<StaffAssignment>,
  ) {}

  // ─── CLIENT DATA ──────────────────────────────────────────────────────────
async getClientData(clientId: string) {
  const apps = await this.appRepo.find({ 
    where: { client: { id: clientId } },
    relations: ['attempts'] 
  });

  const totalApps = apps.length;
  // Use your actual status enum values here
  const interviewed = apps.filter(a => a.status === ApplicationStatus.INTERVIEW).length;
  
  // New Analytics: Using your 'hours' and 'platform' fields
  const platformStats = apps.reduce((acc, a) => {
    acc[a.platform || 'Unknown'] = (acc[a.platform || 'Unknown'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    kpi: {
      totalApplications: totalApps,
      interviewRate: totalApps > 0 ? Math.round((interviewed / totalApps) * 100) : 0,
      // Calculate avg response time using your dueDate and dateLatestReply
      avgResponseDays: this.calculateAvgResponse(apps),
      avgAtsScore: 0 // Placeholder: does your ATS score live in 'attempts' or here?
    },
    // ... use platformStats for your distribution charts
  };
}

private calculateAvgResponse(apps: ApplicationRecord[]): number {
  const validApps = apps.filter(a => a.dateLatestReply && a.applicationDate);
  if (validApps.length === 0) return 0;
  
  const totalDays = validApps.reduce((sum, a) => {
    const diff = new Date(a.dateLatestReply).getTime() - new Date(a.applicationDate).getTime();
    return sum + (diff / (1000 * 60 * 60 * 24));
  }, 0);
  
  return Math.round(totalDays / validApps.length);
}

  // ─── STAFF DATA ───────────────────────────────────────────────────────────
  async getStaffData(staffId: string) {
    const assignments = await this.assignRepo.find({ 
      where: { staff: { id: staffId } },
      relations: ['client'] 
    });

    return {
      kpi: {
        activeClients: assignments.filter(a => a.status === AssignmentStatus.ACTIVE).length,
        totalSubmitted: assignments.reduce((sum, a) => sum + a.completedApplications, 0),
        avgProgressPct: 65, // Calculate based on targetApplications vs completed
        assignmentsCompleted: assignments.filter(a => a.status === AssignmentStatus.COMPLETE).length,
      },
      clientProgress: assignments.map(a => ({
        clientName: a.client.name,
        targetApplications: a.targetApplications,
        submitted: a.completedApplications,
        progressPct: Math.round((a.completedApplications / a.targetApplications) * 100),
        daysLeft: Math.ceil((new Date(a.endDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        status: a.status
      })),
      submissionTrend: [],
      statusBreakdown: []
    };
  }

  // ─── ADMIN DATA ───────────────────────────────────────────────────────────
  async getAdminData() {
    const [totalClients, totalStaff, totalApps, activeAssigns] = await Promise.all([
      this.clientRepo.count(),
      this.staffRepo.count(),
      this.appRepo.count(),
      this.assignRepo.count({ where: { status: AssignmentStatus.ACTIVE } })
    ]);

    return {
      kpi: { totalClients, totalStaff, totalApplicationsThisMonth: totalApps, activeAssignments: activeAssigns },
      staffLeaderboard: [],
      platformTrend: [],
      assignmentStatusBreakdown: [
        { name: 'Active', value: activeAssigns, color: '#0275D8' },
        { name: 'Completed', value: await this.assignRepo.count({ where: { status: AssignmentStatus.COMPLETE } }), color: '#10B981' }
      ],
      clientActivity: []
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  private aggregateByMonth(apps: ApplicationRecord[]) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = new Map<string, { applications: number, interviews: number }>();

    apps.forEach(a => {
        const date = new Date(a.createdAt);
        const month = months[date.getMonth()];
        const current = counts.get(month) || { applications: 0, interviews: 0 };    
     
      current.applications++;
      if (a.status === ApplicationStatus.INTERVIEW) current.interviews++;
      counts.set(month, current);
    });

    return Array.from(counts.entries()).map(([month, data]) => ({
      month,
      applications: data.applications,
      interviews: data.interviews
    }));
  }
}