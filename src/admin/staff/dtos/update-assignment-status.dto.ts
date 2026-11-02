import { IsEnum } from 'class-validator';
import { AssignmentStatus } from '../../../staff/entities/staff-assignment.entity';

export class UpdateAssignmentStatusDto {

  @IsEnum(AssignmentStatus)
  status: AssignmentStatus;
}