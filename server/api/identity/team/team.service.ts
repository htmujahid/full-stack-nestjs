import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { FindTeamsDto } from './dto/find-teams.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamMemberRole } from './team-member-role.enum';

export type TeamsPage = {
  data: Team[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly memberRepository: Repository<TeamMember>,
  ) {}

  async findAll(dto: FindTeamsDto): Promise<TeamsPage> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.teamRepository.createQueryBuilder('team');

    if (dto.search) {
      qb.andWhere('team.name LIKE :search', {
        search: `%${dto.search}%`,
      });
    }

    const sortBy = dto.sortBy ?? 'name';
    const sortOrder = (dto.sortOrder ?? 'asc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(`team.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: { members: { user: true } },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async create(dto: CreateTeamDto): Promise<Team> {
    const team = this.teamRepository.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.teamRepository.save(team);
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);
    Object.assign(team, dto);
    return this.teamRepository.save(team);
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.teamRepository.remove(team);
  }

  async addMember(
    teamId: string,
    userId: string,
    role: TeamMemberRole = TeamMemberRole.Member,
  ): Promise<TeamMember> {
    await this.findOne(teamId);
    const existing = await this.memberRepository.findOneBy({
      teamId,
      userId,
    });
    if (existing) throw new ConflictException('User is already a member');
    const member = this.memberRepository.create({
      teamId,
      userId,
      role,
    });
    const saved = await this.memberRepository.save(member);
    return this.memberRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { user: true },
    });
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findOneBy({
      teamId,
      userId,
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.memberRepository.remove(member);
  }

  async updateMemberRole(
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<TeamMember> {
    const member = await this.memberRepository.findOneBy({
      teamId,
      userId,
    });
    if (!member) throw new NotFoundException('Member not found');
    member.role = role;
    return this.memberRepository.save(member);
  }
}
