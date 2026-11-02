import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client, ClientStatus } from '../../clients/entities/client.entity';

@Injectable()
export class ActivationGuard implements CanActivate {
  private readonly logger = new Logger(ActivationGuard.name);

  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; 

    if (!user || !user.sub) {
      throw new ForbiddenException('Authentication required');
    }

    const client = await this.clientRepo.findOne({ where: { id: user.sub } });

    if (!client) {
      throw new ForbiddenException('Client account not found');
    }

    //   THE LOCK LOGIC (Cleaned & Updated)
    
    // 1. Intake not finished
    if (client.status === ClientStatus.INCOMPLETE) {
      throw new ForbiddenException('ACTION_REQUIRED: Please complete your intake profile.');
    }

    // 2. Waiting for Staff Approval
    if (client.status === ClientStatus.REVIEW) {
      throw new ForbiddenException('PENDING_REVIEW: Your account is currently being reviewed by our engineering team.');
    }

    // 3. Rejected Base Resume
    if (client.status === ClientStatus.REJECTED) {
      throw new ForbiddenException('ACCOUNT_REJECTED: Please review feedback and re-upload your base resume.');
    }

    // 4. The Gate Opens ONLY for Approved clients
    if (client.status === ClientStatus.APPROVED) {
      return true;
    }

    // Fallback block for unknown statuses
    this.logger.warn(`Client ${client.id} blocked by ActivationGuard due to unknown status: ${client.status}`);
    return false;
  }
}