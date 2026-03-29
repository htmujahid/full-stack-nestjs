import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeamService } from './team.service';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { FindTeamsDto } from './dto/find-teams.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamMemberRole } from './team-member-role.enum';
import { mockRepository } from '../../../mocks/db.mock';

const makeTeam = (overrides: Partial<Team> = {}): Team =>
  ({
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Test Team',
    description: 'A test team',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Team;

const makeMember = (overrides: Partial<TeamMember> = {}): TeamMember =>
  ({
    id: '550e8400-e29b-41d4-a716-446655440002',
    teamId: '550e8400-e29b-41d4-a716-446655440001',
    userId: '550e8400-e29b-41d4-a716-446655440003',
    role: TeamMemberRole.Member,
    joinedAt: new Date(),
    ...overrides,
  }) as TeamMember;

const mockQueryBuilder = () => {
  const chain = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  return chain;
};

describe('TeamService', () => {
  let service: TeamService;
  let teamRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let memberRepo: ReturnType<typeof mockRepository>;
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    teamRepo = mockRepository() as ReturnType<typeof mockRepository> & {
      createQueryBuilder: jest.Mock;
    };
    memberRepo = mockRepository();
    qb = mockQueryBuilder();
    teamRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: getRepositoryToken(Team), useValue: teamRepo },
        { provide: getRepositoryToken(TeamMember), useValue: memberRepo },
      ],
    }).compile();

    service = module.get(TeamService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns TeamsPage with data, total, page, limit', async () => {
      const teams = [makeTeam(), makeTeam({ id: 'other-id', name: 'Second' })];
      qb.getManyAndCount.mockResolvedValue([teams, 2]);

      const dto: FindTeamsDto = {};
      const result = await service.findAll(dto);

      expect(teamRepo.createQueryBuilder).toHaveBeenCalledWith('team');
      expect(qb.orderBy).toHaveBeenCalledWith('team.name', 'ASC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ data: teams, total: 2, page: 1, limit: 20 });
    });

    it('adds andWhere when search is provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'acme' });

      expect(qb.andWhere).toHaveBeenCalledWith('team.name LIKE :search', {
        search: '%acme%',
      });
    });

    it('does not call andWhere when search is empty', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('applies pagination with custom page and limit', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('applies sortBy and sortOrder', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'createdAt', sortOrder: 'desc' });

      expect(qb.orderBy).toHaveBeenCalledWith('team.createdAt', 'DESC');
    });

    it('defaults sortOrder to asc when not provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(qb.orderBy).toHaveBeenCalledWith('team.name', 'ASC');
    });
  });

  describe('findOne', () => {
    it('returns team when found', async () => {
      const team = makeTeam();
      teamRepo.findOne.mockResolvedValue(team);

      const result = await service.findOne(team.id);

      expect(teamRepo.findOne).toHaveBeenCalledWith({
        where: { id: team.id },
        relations: { members: { user: true } },
      });
      expect(result).toBe(team);
    });

    it('throws NotFoundException when not found', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('missing-id')).rejects.toThrow(
        'Team not found',
      );
    });
  });

  describe('create', () => {
    it('creates and returns a new team', async () => {
      const dto: CreateTeamDto = {
        name: 'New Team',
        description: 'A new team',
      };
      const created = makeTeam({ name: 'New Team', description: 'A new team' });

      teamRepo.create.mockReturnValue(created);
      teamRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(teamRepo.create).toHaveBeenCalledWith({
        name: 'New Team',
        description: 'A new team',
      });
      expect(teamRepo.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });

    it('uses null for description when not provided', async () => {
      const dto: CreateTeamDto = { name: 'Minimal Team' };
      const created = makeTeam({ name: 'Minimal Team', description: null });

      teamRepo.create.mockReturnValue(created);
      teamRepo.save.mockResolvedValue(created);

      await service.create(dto);

      expect(teamRepo.create).toHaveBeenCalledWith({
        name: 'Minimal Team',
        description: null,
      });
    });
  });

  describe('update', () => {
    it('updates and returns the team', async () => {
      const team = makeTeam();
      const dto: UpdateTeamDto = { name: 'Updated Name' };
      const updated = makeTeam({ name: 'Updated Name' });

      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.save.mockResolvedValue(updated);

      const result = await service.update(team.id, dto);

      expect(teamRepo.findOne).toHaveBeenCalledWith({
        where: { id: team.id },
        relations: { members: { user: true } },
      });
      expect(teamRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Name' }),
      );
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when team does not exist', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
      expect(teamRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes the team', async () => {
      const team = makeTeam();
      teamRepo.findOne.mockResolvedValue(team);
      teamRepo.remove.mockResolvedValue(undefined);

      await service.remove(team.id);

      expect(teamRepo.findOne).toHaveBeenCalledWith({
        where: { id: team.id },
        relations: { members: { user: true } },
      });
      expect(teamRepo.remove).toHaveBeenCalledWith(team);
    });

    it('throws NotFoundException when team does not exist', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(teamRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    const teamId = '550e8400-e29b-41d4-a716-446655440001';
    const userId = '550e8400-e29b-41d4-a716-446655440003';

    it('adds member and returns member with user relation', async () => {
      const team = makeTeam({ id: teamId });
      const saved = makeMember({ teamId, userId });
      const withUser = makeMember({ ...saved, user: {} as never });

      teamRepo.findOne.mockResolvedValue(team);
      memberRepo.findOneBy.mockResolvedValue(null);
      memberRepo.create.mockReturnValue(saved);
      memberRepo.save.mockResolvedValue(saved);
      memberRepo.findOneOrFail.mockResolvedValue(withUser);

      const result = await service.addMember(
        teamId,
        userId,
        TeamMemberRole.Admin,
      );

      expect(teamRepo.findOne).toHaveBeenCalledWith({
        where: { id: teamId },
        relations: { members: { user: true } },
      });
      expect(memberRepo.findOneBy).toHaveBeenCalledWith({ teamId, userId });
      expect(memberRepo.create).toHaveBeenCalledWith({
        teamId,
        userId,
        role: TeamMemberRole.Admin,
      });
      expect(memberRepo.save).toHaveBeenCalledWith(saved);
      expect(memberRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: saved.id },
        relations: { user: true },
      });
      expect(result).toBe(withUser);
    });

    it('defaults role to Member when not provided', async () => {
      const team = makeTeam({ id: teamId });
      const saved = makeMember({ teamId, userId });

      teamRepo.findOne.mockResolvedValue(team);
      memberRepo.findOneBy.mockResolvedValue(null);
      memberRepo.create.mockReturnValue(saved);
      memberRepo.save.mockResolvedValue(saved);
      memberRepo.findOneOrFail.mockResolvedValue(saved);

      await service.addMember(teamId, userId);

      expect(memberRepo.create).toHaveBeenCalledWith({
        teamId,
        userId,
        role: TeamMemberRole.Member,
      });
    });

    it('throws ConflictException when user is already a member', async () => {
      const team = makeTeam({ id: teamId });
      const existing = makeMember({ teamId, userId });

      teamRepo.findOne.mockResolvedValue(team);
      memberRepo.findOneBy.mockResolvedValue(existing);

      await expect(service.addMember(teamId, userId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.addMember(teamId, userId)).rejects.toThrow(
        'User is already a member',
      );
      expect(memberRepo.create).not.toHaveBeenCalled();
      expect(memberRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when team does not exist', async () => {
      teamRepo.findOne.mockResolvedValue(null);

      await expect(service.addMember('missing-team', userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(memberRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    const teamId = '550e8400-e29b-41d4-a716-446655440001';
    const userId = '550e8400-e29b-41d4-a716-446655440003';

    it('removes the member', async () => {
      const member = makeMember({ teamId, userId });
      memberRepo.findOneBy.mockResolvedValue(member);
      memberRepo.remove.mockResolvedValue(undefined);

      await service.removeMember(teamId, userId);

      expect(memberRepo.findOneBy).toHaveBeenCalledWith({ teamId, userId });
      expect(memberRepo.remove).toHaveBeenCalledWith(member);
    });

    it('throws NotFoundException when member not found', async () => {
      memberRepo.findOneBy.mockResolvedValue(null);

      await expect(service.removeMember(teamId, userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.removeMember(teamId, userId)).rejects.toThrow(
        'Member not found',
      );
      expect(memberRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    const teamId = '550e8400-e29b-41d4-a716-446655440001';
    const userId = '550e8400-e29b-41d4-a716-446655440003';

    it('updates role and returns member', async () => {
      const member = makeMember({ teamId, userId });
      const updated = makeMember({ ...member, role: TeamMemberRole.Admin });

      memberRepo.findOneBy.mockResolvedValue(member);
      memberRepo.save.mockResolvedValue(updated);

      const result = await service.updateMemberRole(
        teamId,
        userId,
        TeamMemberRole.Admin,
      );

      expect(memberRepo.findOneBy).toHaveBeenCalledWith({ teamId, userId });
      expect(member.role).toBe(TeamMemberRole.Admin);
      expect(memberRepo.save).toHaveBeenCalledWith(member);
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when member not found', async () => {
      memberRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(teamId, userId, TeamMemberRole.Admin),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateMemberRole(teamId, userId, TeamMemberRole.Admin),
      ).rejects.toThrow('Member not found');
      expect(memberRepo.save).not.toHaveBeenCalled();
    });
  });
});
