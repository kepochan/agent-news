import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class ProcessTopicDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  force?: boolean;
}

export class RevertTopicDto {
  @IsString()
  @Matches(/^\d+[dhm]$/, {
    message: 'Period must match pattern: number followed by d (days), h (hours), or m (minutes)',
  })
  period: string;
}

export class CleanTopicDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  confirm?: boolean = false;
}

export class TaskParamsDto {
  @IsOptional()
  @IsString()
  topic_slug?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  period?: string;
}