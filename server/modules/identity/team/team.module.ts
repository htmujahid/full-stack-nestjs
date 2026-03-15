import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember]),
    RbacModule,
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TypeOrmModule, TeamService],
})
export class TeamModule {}
