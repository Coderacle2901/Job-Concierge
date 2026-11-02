import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminAssignmentService } from '../services/admin-assignment.service';
import { AdminGuard } from '../../guard/admin.gaurd';
import { CreateAssignmentDto } from '../dtos/create-assignment.dto';
import { UpdateAssignmentStatusDto } from '../dtos/update-assignment-status.dto';

@Controller('admin/assignments')
@UseGuards(AdminGuard)
export class AdminAssignmentController {

  constructor(
    private readonly adminAssignmentService: AdminAssignmentService,
  ) {}

  // ─── CREATE ASSIGNMENT ─────────────────────────────────────────────────────

  @Post()
  async create(@Body() dto: CreateAssignmentDto) {
    // POST /admin/assignments
    // Admin assigns a staff member to a client with a monthly target.
    return this.adminAssignmentService.create(dto);
  }

  // ─── GET ALL ASSIGNMENTS ───────────────────────────────────────────────────

  @Get()
  async findAll() {
    // GET /admin/assignments
    return this.adminAssignmentService.findAll();
  }

  // ─── GET ACTIVE ASSIGNMENTS ────────────────────────────────────────────────

  @Get('active')
  async getActiveAssignments() {
    // GET /admin/assignments/active
    // Returns all assignments currently in ACTIVE status.
    return this.adminAssignmentService.getActiveAssignments();
  }

  // ─── GET OVERDUE ASSIGNMENTS ───────────────────────────────────────────────

  @Get('overdue')
  async getOverdueAssignments() {
    // GET /admin/assignments/overdue
    // Returns all assignments that have passed their end date
    // without meeting the application target.
    return this.adminAssignmentService.getOverdueAssignments();
  }

  // ─── GET COMPLETED ASSIGNMENTS ─────────────────────────────────────────────

  @Get('completed')
  async getCompletedAssignments() {
    // GET /admin/assignments/completed
    // Returns all assignments that have met their application target.
    return this.adminAssignmentService.getCompletedAssignments();
  }

  // ─── GET BY CLIENT ─────────────────────────────────────────────────────────

  @Get('client/:clientId')
  async findByClientId(@Param('clientId') clientId: string) {
    // GET /admin/assignments/client/:clientId
    // Returns all assignments for a specific client including history.
    return this.adminAssignmentService.findByClientId(clientId);
  }

  // ─── GET BY STAFF ──────────────────────────────────────────────────────────

  @Get('staff/:staffId')
  async findByStaffId(@Param('staffId') staffId: string) {
    // GET /admin/assignments/staff/:staffId
    // Returns all assignments for a specific staff member.
    return this.adminAssignmentService.findByStaffId(staffId);
  }

  // ─── GET ACTIVE ASSIGNMENTS BY STAFF ──────────────────────────────────────

  @Get('staff/:staffId/active')
  async getActiveAssignmentsByStaff(@Param('staffId') staffId: string) {
    // GET /admin/assignments/staff/:staffId/active
    // Returns all active assignments for a specific staff member.
    // Used to check current workload before assigning new clients.
    return this.adminAssignmentService.getActiveAssignmentsByStaff(staffId);
  }

  // ─── GET OVERDUE ASSIGNMENTS BY STAFF ─────────────────────────────────────

  @Get('staff/:staffId/overdue')
  async getOverdueAssignmentsByStaff(@Param('staffId') staffId: string) {
    // GET /admin/assignments/staff/:staffId/overdue
    // Returns overdue assignments for a specific staff member.
    // Used in the dashboard to flag at-risk staff performance.
    return this.adminAssignmentService.getOverdueAssignmentsByStaff(staffId);
  }

  // ─── GET COMPLETED ASSIGNMENTS BY STAFF ───────────────────────────────────

  @Get('staff/:staffId/completed')
  async getCompletedAssignmentsByStaff(@Param('staffId') staffId: string) {
    // GET /admin/assignments/staff/:staffId/completed
    // Returns completed assignments for a specific staff member.
    // Used in the dashboard for staff performance metrics.
    return this.adminAssignmentService.getCompletedAssignmentsByStaff(staffId);
  }

  // ─── GET SINGLE ASSIGNMENT ─────────────────────────────────────────────────

  @Get(':id')
  async findById(@Param('id') id: string) {
    // GET /admin/assignments/:id
    // Must come AFTER all named routes above to avoid
    // NestJS matching 'active', 'overdue', 'completed' as :id params.
    return this.adminAssignmentService.findById(id);
  }

  // ─── UPDATE STATUS ─────────────────────────────────────────────────────────

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentStatusDto,
  ) {
    // PATCH /admin/assignments/:id/status
    // Admin manually updates assignment status.
    return this.adminAssignmentService.updateStatus(id, dto);
  }

  // ─── INCREMENT COMPLETED APPLICATIONS ─────────────────────────────────────

  @Patch(':id/increment')
  @HttpCode(HttpStatus.OK)
  async incrementCompleted(@Param('id') id: string) {
    // PATCH /admin/assignments/:id/increment
    // Increments completedApplications by 1.
    // Automatically marks assignment COMPLETE if target is reached.
    return this.adminAssignmentService.incrementCompleted(id);
  }

  // ─── SYNC OVERDUE ──────────────────────────────────────────────────────────

  @Patch('sync/overdue')
  @HttpCode(HttpStatus.OK)
  async syncOverdueAssignments() {
    // PATCH /admin/assignments/sync/overdue
    // Checks all ACTIVE assignments and marks them OVERDUE
    // if their end date has passed.
    // Admin can trigger this manually or it can be called
    // automatically by the dashboard service on load.
    await this.adminAssignmentService.syncOverdueAssignments();
    return { message: 'Overdue assignments synced successfully' };
  }
}