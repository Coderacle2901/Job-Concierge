import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../../../staff/entities/staff.entity';
import { CreateStaffDto } from '../dtos/create-staff.dto';
import { SupabaseService } from '../../../supabase/supabase.service';

@Injectable()
export class AdminStaffService {
  private readonly logger = new Logger(AdminStaffService.name);

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly supabaseService: SupabaseService,
  ) {}

  // ─── CREATE STAFF ──────────────────────────────────────────────────────────

  async create(dto: CreateStaffDto): Promise<Staff> {
    // Same two-step pattern as admin creation:
    // 1. Create credentials in Supabase Auth
    // 2. Save to staff table
    // Rolls back Supabase Auth user if DB save fails.

    const existing = await this.staffRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        'A staff account with this email already exists',
      );
    }

    const supabase = this.supabaseService.getClient();

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        // Skips email verification — staff accounts are created
        // by admins directly, not through self-registration.
      });

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered')) {
        throw new ConflictException(
          'This email is already registered in the auth system',
        );
      }
      throw new InternalServerErrorException(
        `Failed to create auth user: ${authError.message}`,
      );
    }

    const supabaseUserId = authData.user.id;

    try {
      const staff = this.staffRepo.create({
        id: supabaseUserId,
        email: dto.email,
        name: `${dto.firstName} ${dto.lastName}`, 
        department: dto.department,
        role: 'staff',
        isActive: true,
      });

      const saved = await this.staffRepo.save(staff);
      this.logger.log(`Staff account created: ${saved.email} (${saved.id})`);
      return saved;

    } catch (dbError) {
      this.logger.error(
        'DB save failed, rolling back Supabase Auth user:',
        dbError,
      );
      await supabase.auth.admin.deleteUser(supabaseUserId);

      throw new InternalServerErrorException(
        'Failed to save staff record. Auth account has been rolled back.',
      );
    }
  }

  // ─── FIND ALL ──────────────────────────────────────────────────────────────

  async findAll(): Promise<Staff[]> {
    // Returns all staff accounts ordered by createdAt DESC.
    // Used in admin dashboard and assignment dropdown.
    return this.staffRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  // ─── FIND BY ID ────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Staff> {
    const staff = await this.staffRepo.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with id ${id} not found`);
    }

    return staff;
  } 

  // ─── DEACTIVATE ────────────────────────────────────────────────────────────

  async deactivate(id: string): Promise<Staff> {
    // Soft deactivation — deactivated staff cannot be assigned
    // to new clients but their existing assignment history is preserved.
    const staff = await this.staffRepo.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with id ${id} not found`);
    }

    if (!staff.isActive) {
      throw new ConflictException('This staff account is already deactivated');
    }

    staff.isActive = false;
    return this.staffRepo.save(staff);
  }

  // ─── REACTIVATE ────────────────────────────────────────────────────────────

  async reactivate(id: string): Promise<Staff> {
    const staff = await this.staffRepo.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff member with id ${id} not found`);
    }

    if (staff.isActive) {
      throw new ConflictException('This staff account is already active');
    }

    staff.isActive = true;
    return this.staffRepo.save(staff);
  }
}