import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { TeamMember } from '../../identity/team/team-member.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationStreamService } from './notification-stream.service';
import { RbacModule } from '../../identity/rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, TeamMember]),
    RbacModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationStreamService],
  exports: [NotificationService],
})
export class NotificationModule {}
