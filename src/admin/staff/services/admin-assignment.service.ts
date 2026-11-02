import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffAssignment, AssignmentStatus } from '../../../staff/entities/staff-assignment.entity';
import { Staff } from '../../../staff/entities/staff.entity';
import { Client } from '../../../clients/entities/client.entity';
import { BaseResume } from '../../resume/entities/base-resume.entity';
import { CreateAssignmentDto } from '../dtos/create-assignment.dto';
import { UpdateAssignmentStatusDto } from '../dtos/update-assignment-status.dto';

@Injectable()
export class AdminAssignmentService {
  private readonly logger = new Logger(AdminAssignmentService.name);

  constructor(
    @InjectRepository(StaffAssignment)
    private readonly assignmentRepo: Repository<StaffAssignment>,

    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(BaseResume)
    private readonly baseResumeRepo: Repository<BaseResume>,
  ) {}

  // ─── CREATE ASSIGNMENT ─────────────────────────────────────────────────────

  async create(dto: CreateAssignmentDto): Promise<StaffAssignment> {
    // Validates all referenced entities exist before creating assignment.
    // Checks that the client doesn't already have an active assignment
    // since one client can only have one active staff assignment at a time.

    // ── Verify staff exists and is active ────────────────────────────────────
    const staff = await this.staffRepo.findOne({
      where: { id: dto.staffId },
    });

    if (!staff) {
      throw new NotFoundException(
        `Staff member with id ${dto.staffId} not found`,
      );
    }

    if (!staff.isActive) {
      throw new BadRequestException(
        'Cannot assign a deactivated staff member to a client',
      );
    }

    // ── Verify client exists ─────────────────────────────────────────────────
    const client = await this.clientRepo.findOne({
      where: { id: dto.clientId },
    });

    if (!client) {
      throw new NotFoundException(
        `Client with id ${dto.clientId} not found`,
      );
    }

    // ── Check client doesn't already have an active assignment ───────────────
   const existingAssignment = await this.assignmentRepo.findOne({
  where: {
    client: { id: dto.clientId },
    baseResume: { id: dto.baseResumeId },
    status: AssignmentStatus.ACTIVE,
  },
});

if (existingAssignment) {
  throw new ConflictException(
    'This client already has an active assignment using this base resume. ' +
    'Each staff assignment must use a different resume focus.',
  );
}

    // ── Verify base resume belongs to this client if provided ─────────────────
    let baseResume: BaseResume | null = null;

    if (dto.baseResumeId) {
      baseResume = await this.baseResumeRepo.findOne({
        where: {
          id: dto.baseResumeId,
          client: { id: dto.clientId }, // ← ensures resume belongs to this client
        },
      });

      if (!baseResume) {
        throw new NotFoundException(
          `Base resume with id ${dto.baseResumeId} not found for this client`,
        );
      }
    }

    // ── Validate dates ───────────────────────────────────────────────────────
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException(
        'End date must be after start date',
      );
    }

    // ── Create and save assignment ───────────────────────────────────────────
    const assignment = this.assignmentRepo.create({
      staff,
      client,
      baseResume,
    targetApplications: dto.targetApplications,
      completedApplications: 0,
      startDate,
      endDate,
      notes: dto.notes || null,
      status: AssignmentStatus.ACTIVE,
    });

    const saved = await this.assignmentRepo.save(assignment);

   this.logger.log(
  `Assignment created: Staff ${staff.name} → Client ${client.email} ` +
  `(Target: ${dto.targetApplications} applications)`,
);

    return saved;
  }

  // ─── FIND ALL ──────────────────────────────────────────────────────────────

  async findAll(): Promise<StaffAssignment[]> {
    // Returns all assignments with staff, client and base resume details.
    // Used in the admin dashboard overview.
    return this.assignmentRepo.find({
      relations: ['staff', 'client', 'baseResume'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── FIND BY ID ────────────────────────────────────────────────────────────

  async findById(id: string): Promise<StaffAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: ['staff', 'client', 'baseResume'],
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with id ${id} not found`,
      );
    }

    return assignment;
  }

  // ─── FIND BY CLIENT ────────────────────────────────────────────────────────

  async findByClientId(clientId: string): Promise<StaffAssignment[]> {
    // Returns all assignments for a specific client — including
    // historical ones. Used in the individual client detail view.
    return this.assignmentRepo.find({
      where: { client: { id: clientId } },
      relations: ['staff', 'client', 'baseResume'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── FIND BY STAFF ─────────────────────────────────────────────────────────

  async findByStaffId(staffId: string): Promise<StaffAssignment[]> {
    // Returns all assignments for a specific staff member.
    // Used to check staff workload before creating new assignments.
    return this.assignmentRepo.find({
      where: { staff: { id: staffId } },
      relations: ['staff', 'client', 'baseResume'],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── UPDATE STATUS ─────────────────────────────────────────────────────────

  async updateStatus(
    id: string,
    dto: UpdateAssignmentStatusDto,
  ): Promise<StaffAssignment> {
    // Admin manually updates assignment status.
    // e.g. marking as COMPLETE, PAUSED, or OVERDUE.
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: ['staff', 'client', 'baseResume'],
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with id ${id} not found`,
      );
    }

    assignment.status = dto.status;
    return this.assignmentRepo.save(assignment);
  }

  // ─── SYNC OVERDUE ASSIGNMENTS ──────────────────────────────────────────────

  async syncOverdueAssignments(): Promise<void> {
    // Checks all ACTIVE assignments and marks them OVERDUE
    // if their end date has passed.
    // Called by the dashboard service when loading data
    // to ensure statuses are always up to date.

    const today = new Date();

    const activeAssignments = await this.assignmentRepo.find({
      where: { status: AssignmentStatus.ACTIVE },
    });

    const overdueAssignments = activeAssignments.filter(
      (a) => a.endDate != null && new Date(a.endDate) < today,
    );

    if (overdueAssignments.length > 0) {
      await this.assignmentRepo.save(
        overdueAssignments.map((a) => {
          a.status = AssignmentStatus.OVERDUE;
          return a;
        }),
      );

      this.logger.log(
        `Synced ${overdueAssignments.length} assignments to OVERDUE status`,
      );
    }
  }

  // ─── INCREMENT COMPLETED APPLICATIONS ─────────────────────────────────────

  async incrementCompleted(assignmentId: string): Promise<StaffAssignment> {
    // Called when a job application is marked as submitted.
    // Increments completedApplications and checks if target is reached.
    // If target is reached, marks assignment as COMPLETE.

    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Assignment with id ${assignmentId} not found`,
      );
    }

    assignment.completedApplications += 1;

    if (assignment.completedApplications >= assignment.targetApplications) {
      assignment.status = AssignmentStatus.COMPLETE;
      this.logger.log(
        `Assignment ${assignmentId} marked COMPLETE — target reached`,
      );
    }

    return this.assignmentRepo.save(assignment);
  }

  // ─── GET OVERDUE ASSIGNMENTS ───────────────────────────────────────────────

  async getOverdueAssignments(): Promise<StaffAssignment[]> {
    return this.assignmentRepo.find({
      where: { status: AssignmentStatus.OVERDUE },
    });
  }

  // ─── GET OVERDUE ASSIGNMENTS BY STAFF ─────────────────────────────────────

  async getOverdueAssignmentsByStaff(staffId: string): Promise<StaffAssignment[]> {
    return this.assignmentRepo.find({
      where: { status: AssignmentStatus.OVERDUE, staff: { id: staffId } },
    });
  }

  // ─── GET ACTIVE ASSIGNMENTS BY STAFF ──────────────────────────────────────

  async getActiveAssignmentsByStaff(staffId: string): Promise<StaffAssignment[]> {
    return this.assignmentRepo.find({
      where: { status: AssignmentStatus.ACTIVE, staff: { id: staffId } },
    });
  }

  // ─── GET ALL ACTIVE ASSIGNMENTS ────────────────────────────────────────────

  async getActiveAssignments(): Promise<StaffAssignment[]> {
    return this.assignmentRepo.find({
      where: { status: AssignmentStatus.ACTIVE },
    });
  }

  // ─── GET ALL COMPLETED ASSIGNMENTS ────────────────────────────────────────

  async getCompletedAssignments(): Promise<StaffAssignment[]> {
    return this.assignmentRepo.find({
      where: { status: AssignmentStatus.COMPLETE },
    });
  }

  // ─── GET COMPLETED ASSIGNMENTS BY STAFF ───────────────────────────────────

  async getCompletedAssignmentsByStaff(staffId: string): Promise<StaffAssignment[]> {
    return this.assignmentRepo.find({
      where: { status: AssignmentStatus.COMPLETE, staff: { id: staffId } },
    });
  }
}