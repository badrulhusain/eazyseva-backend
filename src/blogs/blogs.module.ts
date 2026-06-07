import { Module } from '@nestjs/common';
import { BlogsController, AdminBlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [SupabaseModule, AuditLogsModule],
  controllers: [BlogsController, AdminBlogsController],
  providers: [BlogsService],
})
export class BlogsModule {}
