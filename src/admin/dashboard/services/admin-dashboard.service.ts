import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, ClientStatus } from '../../../clients/entities/client.entity';
import { StaffAssignment, AssignmentStatus } from '../../../staff/entities/staff-assignment.entity';
import { ApplicationRecord } from '../../../applications/entities/application.entity';
import { BaseResume } from '../../resume/entities/base-resume.entity';
import { AdminAssignmentService } from '../../staff/services/admin-assignment.service';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(StaffAssignment)
    private readonly assignmentRepo: Repository<StaffAssignment>,

    @InjectRepository(ApplicationRecord)
    private readonly applicationRepo: Repository<ApplicationRecord>,

    @InjectRepository(BaseResume)
    private readonly baseResumeRepo: Repository<BaseResume>,

    private readonly assignmentService: AdminAssignmentService,
  ) {}

  // ─── OVERVIEW DASHBOARD ────────────────────────────────────────────────────

  async getOverview() {
    // Step 1 — sync overdue assignments so statuses are always accurate.
    // Wrapped in try/catch so a sync failure does not crash the dashboard.
    try {
      await this.assignmentService.syncOverdueAssignments();
    } catch (error) {
      this.logger.warn(
        'Overdue sync failed — dashboard will load with potentially stale statuses',
      );
    }

    // Step 2 — fetch approved clients only.
    // REVIEW and REJECTED clients belong in the client requests section.
    const clients = await this.clientRepo.find({
      where: { status: ClientStatus.APPROVED },
      order: { name: 'ASC' },
    });

    // Step 3 — fetch all assignments with relations in one query
    const assignments = await this.assignmentRepo.find({
      relations: ['staff', 'client', 'baseResume'],
    });

    // Step 4 — build clientId → active assignments map.
    // One client can have multiple active assignments (different resume focuses)
    const assignmentMap = new Map<string, StaffAssignment[]>();
    assignments.forEach((a) => {
      if (a.status === AssignmentStatus.ACTIVE && a.client) {
        const existing = assignmentMap.get(a.client.id) || [];
        existing.push(a);
        assignmentMap.set(a.client.id, existing);
      }
    });

    // Step 5 — aggregate base resume counts per client using a single query
    // instead of loading all resume records into memory
    const resumeCounts = await this.baseResumeRepo
      .createQueryBuilder('resume')
      .select('resume.clientId', 'clientId')
      .addSelect('COUNT(resume.id)', 'count')
      .where('resume.isActive = :isActive', { isActive: true })
      .groupBy('resume.clientId')
      .getRawMany();

    const resumeCountMap = new Map<string, number>();
    resumeCounts.forEach((row) => {
      resumeCountMap.set(row.clientId, parseInt(row.count));
    });

    // Step 6 — aggregate application counts per client using a single query
    const applicationCounts = await this.applicationRepo
      .createQueryBuilder('app')
      .select('app.clientId', 'clientId')
      .addSelect('COUNT(app.id)', 'count')
      .groupBy('app.clientId')
      .getRawMany();

    const applicationCountMap = new Map<string, number>();
    applicationCounts.forEach((row) => {
      applicationCountMap.set(row.clientId, parseInt(row.count));
    });

    const totalApplicationsSubmitted = applicationCounts.reduce(
      (sum, row) => sum + parseInt(row.count),
      0,
    );

    // Step 7 — fetch client status counts in parallel
    const [totalPendingReview, totalRejectedClients] = await Promise.all([
      this.clientRepo.count({ where: { status: ClientStatus.REVIEW } }),
      this.clientRepo.count({ where: { status: ClientStatus.REJECTED } }),
    ]);

    // Step 8 — build per-client metrics
    const clientMetrics = clients.map((client) => {
      const activeAssignments = assignmentMap.get(client.id) || [];
      const baseResumeCount = resumeCountMap.get(client.id) || 0;
      const totalApplications = applicationCountMap.get(client.id) || 0;

      const totalTarget = activeAssignments.reduce(
        (sum, a) => sum + a.targetApplications,
        0,
      );
      const totalCompleted = activeAssignments.reduce(
        (sum, a) => sum + a.completedApplications,
        0,
      );
      const overallProgress =
        totalTarget > 0
          ? Math.round((totalCompleted / totalTarget) * 100)
          : 0;

      return {
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          plan: client.planName,
          applyMode: client.applyMode,
        },
        activeAssignments: activeAssignments.map((a) => ({
          id: a.id,
          status: a.status,
          staffName: a.staff?.name || null,
          staffEmail: a.staff?.email || null,
          baseResumeName: a.baseResume?.resumeName || null,
          baseResumeId: a.baseResume?.id || null,
          targetApplications: a.targetApplications,
          completedApplications: a.completedApplications,
          progressPercentage:
            a.targetApplications > 0
              ? Math.round(
                  (a.completedApplications / a.targetApplications) * 100,
                )
              : 0,
          startDate: a.startDate,
          endDate: a.endDate,
        })),
        overallProgress,
        baseResumeCount,
        totalApplications,
      };
    });

    // Step 9 — system-wide metrics
    const totalApprovedClients = clients.length;
    const totalActive = assignments.filter(
      (a) => a.status === AssignmentStatus.ACTIVE,
    ).length;
    const totalOverdue = assignments.filter(
      (a) => a.status === AssignmentStatus.OVERDUE,
    ).length;
    const totalComplete = assignments.filter(
      (a) => a.status === AssignmentStatus.COMPLETE,
    ).length;

    this.logger.log('Dashboard overview loaded successfully');

    return {
      systemMetrics: {
        totalApprovedClients,
        totalPendingReview,
        totalRejectedClients,
        totalActiveAssignments: totalActive,
        totalOverdueAssignments: totalOverdue,
        totalCompletedAssignments: totalComplete,
        totalApplicationsSubmitted,
      },
      clients: clientMetrics,
    };
  }

  // ─── INDIVIDUAL CLIENT DETAIL ──────────────────────────────────────────────

  async getClientDetail(clientId: string) {
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    // Guard — only approved clients belong on the progress dashboard.
    // Non-approved clients are handled in the client requests section.
    if (client.status !== ClientStatus.APPROVED) {
      throw new BadRequestException(
        `Client ${clientId} has not been approved yet. ` +
        `Only approved clients appear on the progress dashboard. ` +
        `Check the client requests section for pending reviews.`,
      );
    }

    // All assignments for this client including historical ones
    const assignments = await this.assignmentRepo.find({
      where: { client: { id: clientId } },
      relations: ['staff', 'baseResume'],
      order: { createdAt: 'DESC' },
    });

    const activeAssignments = assignments.filter(
      (a) => a.status === AssignmentStatus.ACTIVE,
    );

    // All active base resumes for this client
    const baseResumes = await this.baseResumeRepo.find({
      where: { client: { id: clientId }, isActive: true },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });

    // Full application history
    const applicationHistory = await this.applicationRepo.find({
      where: { client: { id: clientId } },
      order: { applicationDate: 'DESC' },
    });

    this.logger.log(`Client detail loaded for client ${clientId}`);

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        plan: client.planName,
        status: client.status,
        applyMode: client.applyMode,
        totalQuota: client.totalQuota,
        remainingQuota: client.remainingQuota,
      },
      activeAssignments: activeAssignments.map((a) => ({
        id: a.id,
        status: a.status,
        staffName: a.staff?.name || null,
        staffEmail: a.staff?.email || null,
        baseResumeName: a.baseResume?.resumeName || null,
        baseResumeId: a.baseResume?.id || null,
        targetApplications: a.targetApplications,
        completedApplications: a.completedApplications,
        progressPercentage:
          a.targetApplications > 0
            ? Math.round(
                (a.completedApplications / a.targetApplications) * 100,
              )
            : 0,
        startDate: a.startDate,
        endDate: a.endDate,
        notes: a.notes,
      })),
      assignmentHistory: assignments.map((a) => ({
        id: a.id,
        status: a.status,
        staffName: a.staff?.name || null,
        baseResumeName: a.baseResume?.resumeName || null,
        targetApplications: a.targetApplications,
        completedApplications: a.completedApplications,
        startDate: a.startDate,
        endDate: a.endDate,
        createdAt: a.createdAt,
      })),
      baseResumes: baseResumes.map((r) => ({
        id: r.id,
        resumeName: r.resumeName,
        atsBaselineScore: r.atsBaselineScore,
        version: r.version,
        parentResumeId: r.parentResumeId,
        createdBy: r.createdBy?.email || null,
        createdAt: r.createdAt,
      })),
      applicationHistory: applicationHistory.map((app) => ({
        id: app.id,
        status: app.status,
        applicationDate: app.applicationDate,
      })),
      totalApplications: applicationHistory.length,
    };
  }

  // ─── STAFF PERFORMANCE SUMMARY ─────────────────────────────────────────────

  async getStaffPerformance() {
    const assignments = await this.assignmentRepo.find({
      relations: ['staff'],
    });

    const staffMap = new Map<
      string,
      {
        staffId: string;
        staffName: string;
        staffEmail: string;
        total: number;
        active: number;
        completed: number;
        overdue: number;
        totalTarget: number;
        totalCompleted: number;
      }
    >();

    assignments.forEach((a) => {
      if (!a.staff) {
        this.logger.warn(
          `Assignment ${a.id} has no staff relation — skipping in performance calc`,
        );
        return;
      }

      const existing = staffMap.get(a.staff.id) || {
        staffId: a.staff.id,
        staffName: a.staff.name,
        staffEmail: a.staff.email,
        total: 0,
        active: 0,
        completed: 0,
        overdue: 0,
        totalTarget: 0,
        totalCompleted: 0,
      };

      existing.total += 1;
      existing.totalTarget += a.targetApplications;
      existing.totalCompleted += a.completedApplications;

      if (a.status === AssignmentStatus.ACTIVE) existing.active += 1;
      if (a.status === AssignmentStatus.COMPLETE) existing.completed += 1;
      if (a.status === AssignmentStatus.OVERDUE) existing.overdue += 1;

      staffMap.set(a.staff.id, existing);
    });

    return Array.from(staffMap.values()).map((s) => ({
      ...s,
      overallProgressPercentage:
        s.totalTarget > 0
          ? Math.round((s.totalCompleted / s.totalTarget) * 100)
          : 0,
    }));
  }
}