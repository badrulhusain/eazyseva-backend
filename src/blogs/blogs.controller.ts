import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { AdminBlogQueryDto, PublicBlogQueryDto } from './dto/query-blog.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';

// ── Public routes ─────────────────────────────────────────────────────────────

@Public()
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  async findAll(@Query() query: PublicBlogQueryDto) {
    const result = await this.blogsService.findPublished(query);
    return { success: true, ...result };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.blogsService.findBySlug(slug);
    return { success: true, data };
  }
}

// ── Admin routes (JWT + ADMIN role) ───────────────────────────────────────────

@UseGuards(AdminGuard)
@Controller('admin/blogs')
export class AdminBlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get()
  async findAll(@Query() query: AdminBlogQueryDto) {
    const result = await this.blogsService.findAllAdmin(query);
    return { success: true, ...result };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.blogsService.findOneAdmin(id);
    return { success: true, data };
  }

  @Post()
  async create(
    @Body() dto: CreateBlogDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.blogsService.create(dto, user.id);
    await this.auditLogsService.record(
      user.id,
      data.status === 'published'
        ? 'ADMIN_PUBLISHED_BLOG'
        : 'ADMIN_CREATED_BLOG',
      'blog',
      data.id,
      { title: data.title, slug: data.slug, status: data.status },
    );
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlogDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const before = await this.blogsService.findOneAdmin(id);
    const data = await this.blogsService.update(id, dto);

    let action:
      | 'ADMIN_PUBLISHED_BLOG'
      | 'ADMIN_ARCHIVED_BLOG'
      | 'ADMIN_UPDATED_BLOG' = 'ADMIN_UPDATED_BLOG';
    if (before.status !== 'published' && data.status === 'published')
      action = 'ADMIN_PUBLISHED_BLOG';
    else if (before.status !== 'archived' && data.status === 'archived')
      action = 'ADMIN_ARCHIVED_BLOG';

    await this.auditLogsService.record(user.id, action, 'blog', data.id, {
      title: data.title,
      slug: data.slug,
      statusBefore: before.status,
      statusAfter: data.status,
    });
    return { success: true, data };
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.blogsService.softDelete(id);
    await this.auditLogsService.record(
      user.id,
      'ADMIN_DELETED_BLOG',
      'blog',
      data.id,
      {
        title: data.title,
        slug: data.slug,
      },
    );
    return { success: true, data };
  }
}
