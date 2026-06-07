import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import type { BlogStatus } from '../blogs.types';

const BLOG_STATUSES: BlogStatus[] = ['draft', 'published', 'archived'];

export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  // Optional — auto-generated from title when omitted. When provided, must already
  // look like a slug; uniqueness is enforced (with -2, -3, … suffixing) in the service.
  @IsOptional()
  @IsString()
  @MaxLength(220)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase, alphanumeric, and hyphen-separated (e.g. "my-blog-post")',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    {
      message: 'coverImageUrl must be a valid HTTPS URL',
    },
  )
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Type(() => String)
  tags?: string[];

  @IsOptional()
  @IsIn(BLOG_STATUSES, {
    message: 'status must be one of: draft, published, archived',
  })
  status?: BlogStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;
}
