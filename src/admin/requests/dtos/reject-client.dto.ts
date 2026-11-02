import { IsString, IsNotEmpty } from 'class-validator';

export class RejectClientDto {

  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
  // Reason for rejection — stored on the client record
  // and can be displayed to the client or used for reporting.
}