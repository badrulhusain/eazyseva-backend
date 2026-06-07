import { Module } from '@nestjs/common';
import { AdminDocumentsController } from './documents.controller';
import { OrderDocumentsService } from './documents.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [SupabaseModule, UploadsModule, AuditLogsModule],
  controllers: [AdminDocumentsController],
  providers: [OrderDocumentsService],
  exports: [OrderDocumentsService],
})
export class DocumentsModule {}
