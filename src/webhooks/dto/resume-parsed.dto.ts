import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsNumber } from 'class-validator';

export class ResumeParsedDto {
  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  clientName!: string;  

  @ApiProperty({ example: 'Gold' })
  @IsString()
  planName!: string;  

  @ApiProperty({ example: 'Backend Engineer' })
  @IsString()
  targetRole!: string;  

  @ApiProperty({ example: { skills: ['Node.js', 'NestJS'], experience: 5 } })
  @IsObject()
  masterResumeJson!: Record<string, any>;  

  @ApiProperty({ example: 92 })
  @IsNumber()
  initialAtsScore!: number;  
}