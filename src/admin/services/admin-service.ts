import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Admin } from '../entities/admin.entity';
import { CreateAdminDto } from '../dto/create-dto';
import { SupabaseService } from '../../supabase/supabase.service';
import { Client } from '../../clients/entities/client.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(Client) 
    private readonly clientRepository: Repository<Client>,

    private readonly supabaseService: SupabaseService,
    private readonly dataSource: DataSource,  
  ) {}

  // ─── CREATE ADMIN ─────────────────────────────────────────────────────────
  async create(dto: CreateAdminDto): Promise<Omit<Admin, 'id'> & { id: string }> {
    const supabase = this.supabaseService.getClient();

    const existing = await this.adminRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('An admin with this email already exists');
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
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
      const admin = this.adminRepository.create({
        id: supabaseUserId,
        firstName: (dto as any).firstName,
        lastName: (dto as any).lastName,
        email: dto.email,
        isActive: true,
      });
 
      const saved = await this.adminRepository.save(admin);
      return saved;
    } catch (dbError) {
      console.error('DB save failed, rolling back Supabase Auth user:', dbError);
      await supabase.auth.admin.deleteUser(supabaseUserId);
      throw new InternalServerErrorException(
        'Failed to save admin to database. Auth user has been rolled back.',
      );
    }
  }

  // ─── FIND BY ID / EMAIL / DEACTIVATE / REACTIVATE / FIND ALL ────────────
  async findById(id: string): Promise<Admin | null> {
    return this.adminRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.adminRepository.findOne({ where: { email } });
  }

  async deactivate(id: string): Promise<Admin> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin with id ${id} not found`);
    admin.isActive = false;
    return this.adminRepository.save(admin);
  }

  async reactivate(id: string): Promise<Admin> {
    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) throw new NotFoundException(`Admin with id ${id} not found`);
    admin.isActive = true;
    return this.adminRepository.save(admin);
  }

  async findAll(): Promise<Admin[]> {
    return this.adminRepository.find({ order: { createdAt: 'DESC' } });
  }

  // ───  FETCH ALL CLIENTS FOR ASSIGNMENT DROPDOWN ───────────────────────
  async findAllClients() {
    return await this.clientRepository.find({
      select: ['id', 'firstName', 'lastName', 'email'],
    });
  }

  

  // ─── GET DASHBOARD OVERVIEW ──────────────────────────────────────────────
  async getDashboardOverview() {
  const [stats] = await this.dataSource.query(`
    SELECT 
        (SELECT COUNT(*) FROM clients WHERE status::text = 'APPROVED') as "approvedClients",
        (SELECT COUNT(*) FROM clients WHERE status::text = 'REVIEW') as "pendingReview",
        (SELECT COUNT(*) FROM clients WHERE status::text = 'INCOMPLETE') as "incompleteClients",
        (SELECT COUNT(*) FROM staff_assignments) as "activeAssignments",
        (SELECT COUNT(*) FROM application_records) as "totalApplications"
    `);

  return {
    approvedClients: Number(stats?.approvedClients || 0),
    pendingReview: Number(stats?.pendingReview || 0),
    rejectedClients: Number(stats?.incompleteClients || 0), 
    activeAssignments: Number(stats?.activeAssignments || 0),
    totalApplications: Number(stats?.totalApplications || 0),
  };
}

  // ─── GET STAFF PERFORMANCE ───────────────────────────────────────────────
 async getStaffPerformance() {
    const query = `
      SELECT 
        s.id,
        s.name, 
        COALESCE(SUM(sa."targetVolume"), 0) as "target",
        (SELECT COUNT(*) FROM application_records ar 
         JOIN staff_assignments sa2 ON ar."clientId" = sa2."clientId"
         WHERE sa2."staffId" = s.id AND ar.status::text != 'APPLIED') as "active",
        (SELECT COUNT(*) FROM application_records ar 
         JOIN staff_assignments sa2 ON ar."clientId" = sa2."clientId"
         WHERE sa2."staffId" = s.id AND ar.status::text = 'APPLIED') as "completed",
        (SELECT COUNT(*) FROM application_records ar 
         JOIN staff_assignments sa2 ON ar."clientId" = sa2."clientId"
         WHERE sa2."staffId" = s.id 
         AND ar."dueDate" < CURRENT_DATE 
         AND ar.status::text != 'applied') as "overdue"
      FROM staff s
      LEFT JOIN staff_assignments sa ON s.id = sa."staffId"
      WHERE s.role = 'staff'
      GROUP BY s.id, s.name
    `;
   
    const performance = await this.dataSource.query(query);
 
    return performance.map((p: any) => ({
      id: p.id,
      name: p.name,
      target: Number(p.target || 0),
      active: Number(p.active || 0),
      completed: Number(p.completed || 0),
      overdue: Number(p.overdue || 0),
    }));
  }

 // ─── GET CLIENT PROGRESS ─────────────────────────────────────────────────
  async getClientProgress() {
    const query = `
      SELECT 
        c.id, 
        c."name",
        s."name" as "staffAssigned",
        sa."targetVolume" as "target",
        (SELECT COUNT(*) FROM "application_records" ar 
         WHERE ar."clientId" = c.id 
         AND ar.status::text = 'APPLIED') as "progress"
      FROM "clients" c
      JOIN "staff_assignments" sa ON c.id = sa."clientId"
      JOIN "staff" s ON sa."staffId" = s.id
    `;

    const progress = await this.dataSource.query(query);

    return progress.map((p: any) => {
      const prog = Number(p.progress || 0);
      const tgt = Number(p.target || 0);
      return {
        id: p.id,
        name: p.name,
        staffAssigned: p.staffAssigned,
        progress: prog,
        target: tgt,
        status: prog >= tgt ? 'COMPLETE' : (prog < tgt / 2 ? 'AT RISK' : 'ON TRACK')
      };
    });
  }
}