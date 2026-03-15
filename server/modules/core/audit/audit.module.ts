import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit.entity';
import { AuditService } from './audit.service';
import { DbAuditSink } from './db-audit.sink';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_SINKS } from './audit.service';
import { RbacModule } from '../../identity/rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), RbacModule],
  controllers: [AuditController],
  providers: [
    DbAuditSink,
    {
      provide: AUDIT_SINKS,
      useFactory: (db: DbAuditSink) => [db],
      inject: [DbAuditSink],
    },
    AuditService,
    AuditInterceptor,
  ],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
