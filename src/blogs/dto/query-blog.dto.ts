import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { BlogStatus } from '../blogs.types';

const BLOG_STATUSES: BlogStatus[] = ['draft', 'published', 'archived'];

/** Public list query — no status filter (public listings are always status=published). */
export class PublicBlogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}

/** Admin list query — adds status filtering on top of the public query shape. */
export class AdminBlogQueryDto extends PublicBlogQueryDto {
  @IsOptional()
  @IsIn(BLOG_STATUSES, {
    message: 'status must be one of: draft, published, archived',
  })
  status?: BlogStatus;
}
