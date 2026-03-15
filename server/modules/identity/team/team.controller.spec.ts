import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { FindTeamsDto } from './dto/find-teams.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { RolesGuard } from '../rbac/roles.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { TeamMemberRole } from './team-member-role.enum';

const makeTeam = (overrides: Partial<Team> = {}): Team =>
  ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Team',
    description: 'A test team',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Team;

const makeMember = (overrides: Partial<TeamMember> = {}): TeamMember =>
  ({
    id: '660e8400-e29b-41d4-a716-446655440001',
    teamId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '770e8400-e29b-41d4-a716-446655440002',
    role: TeamMemberRole.Member,
    joinedAt: new Date(),
    ...overrides,
  }) as TeamMember;

const mockTeamService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
});

describe('TeamController', () => {
  let controller: TeamController;
  let service: ReturnType<typeof mockTeamService>;

  beforeEach(async () => {
    service = mockTeamService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [{ provide: TeamService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(TeamController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll(dto) and returns TeamsPage', async () => {
      const dto: FindTeamsDto = {};
      const page = { data: [makeTeam()], total: 1, page: 1, limit: 20 };
      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto);

      expect(service.findAll).toHaveBeenCalledWith(dto);
      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(result).toBe(page);
    });

    it('passes dto with search and sort to service', async () => {
      const dto: FindTeamsDto = {
        search: 'acme',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      const page = { data: [], total: 0, page: 1, limit: 20 };
      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto);

      expect(service.findAll).toHaveBeenCalledWith(dto);
      expect(result).toEqual(page);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id) and returns result', async () => {
      const team = makeTeam();
      service.findOne.mockResolvedValue(team);

      const result = await controller.findOne(team.id);

      expect(service.findOne).toHaveBeenCalledWith(team.id);
      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(result).toBe(team);
    });

    it('propagates NotFoundException from service when team is not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Team not found'));

      await expect(controller.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.findOne('missing-id')).rejects.toThrow(
        'Team not found',
      );
    });
  });

  describe('create', () => {
    it('delegates to service.create(dto) and returns result', async () => {
      const dto: CreateTeamDto = { name: 'New Team' };
      const team = makeTeam({ name: 'New Team' });

      service.create.mockResolvedValue(team);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(service.create).toHaveBeenCalledTimes(1);
      expect(result).toBe(team);
    });

    it('passes dto with description to service', async () => {
      const dto: CreateTeamDto = {
        name: 'My Team',
        description: 'Team description',
      };
      service.create.mockResolvedValue(makeTeam());

      await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto) and returns result', async () => {
      const team = makeTeam();
      const dto: UpdateTeamDto = { name: 'Updated Name' };
      const updatedTeam = makeTeam({ name: 'Updated Name' });

      service.update.mockResolvedValue(updatedTeam);

      const result = await controller.update(team.id, dto);

      expect(service.update).toHaveBeenCalledWith(team.id, dto);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(result).toBe(updatedTeam);
    });

    it('propagates NotFoundException from service when team is not found', async () => {
      const dto: UpdateTeamDto = { name: 'Updated' };

      service.update.mockRejectedValue(new NotFoundException('Team not found'));

      await expect(
        controller.update('missing-id', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id) and returns undefined', async () => {
      const team = makeTeam();
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(team.id);

      expect(service.remove).toHaveBeenCalledWith(team.id);
      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException from service when team is not found', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Team not found'));

      await expect(controller.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addMember', () => {
    it('delegates to service.addMember(id, dto.userId, dto.role) when role provided', async () => {
      const teamId = makeTeam().id;
      const dto: AddMemberDto = {
        userId: '770e8400-e29b-41d4-a716-446655440002',
        role: TeamMemberRole.Admin,
      };
      const member = makeMember({ role: TeamMemberRole.Admin });
      service.addMember.mockResolvedValue(member);

      const result = await controller.addMember(teamId, dto);

      expect(service.addMember).toHaveBeenCalledWith(
        teamId,
        dto.userId,
        TeamMemberRole.Admin,
      );
      expect(service.addMember).toHaveBeenCalledTimes(1);
      expect(result).toBe(member);
    });

    it('passes TeamMemberRole.Member when dto.role is omitted', async () => {
      const teamId = makeTeam().id;
      const dto: AddMemberDto = { userId: '770e8400-e29b-41d4-a716-446655440002' };
      const member = makeMember();
      service.addMember.mockResolvedValue(member);

      await controller.addMember(teamId, dto);

      expect(service.addMember).toHaveBeenCalledWith(
        teamId,
        dto.userId,
        TeamMemberRole.Member,
      );
    });

    it('propagates NotFoundException from service when team is not found', async () => {
      const dto: AddMemberDto = { userId: 'user-id' };

      service.addMember.mockRejectedValue(
        new NotFoundException('Team not found'),
      );

      await expect(
        controller.addMember('missing-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException from service when user already member', async () => {
      const dto: AddMemberDto = { userId: 'user-id' };

      service.addMember.mockRejectedValue(
        new ConflictException('User is already a member'),
      );

      await expect(
        controller.addMember('team-id', dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('delegates to service.removeMember(id, userId) and returns undefined', async () => {
      const teamId = makeTeam().id;
      const userId = '770e8400-e29b-41d4-a716-446655440002';
      service.removeMember.mockResolvedValue(undefined);

      const result = await controller.removeMember(teamId, userId);

      expect(service.removeMember).toHaveBeenCalledWith(teamId, userId);
      expect(service.removeMember).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException from service when member is not found', async () => {
      service.removeMember.mockRejectedValue(
        new NotFoundException('Member not found'),
      );

      await expect(
        controller.removeMember('team-id', 'missing-user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMemberRole', () => {
    it('delegates to service.updateMemberRole(id, userId, dto.role) and returns result', async () => {
      const teamId = makeTeam().id;
      const userId = '770e8400-e29b-41d4-a716-446655440002';
      const dto: UpdateMemberDto = { role: TeamMemberRole.Admin };
      const member = makeMember({ role: TeamMemberRole.Admin });
      service.updateMemberRole.mockResolvedValue(member);

      const result = await controller.updateMemberRole(teamId, userId, dto);

      expect(service.updateMemberRole).toHaveBeenCalledWith(
        teamId,
        userId,
        TeamMemberRole.Admin,
      );
      expect(service.updateMemberRole).toHaveBeenCalledTimes(1);
      expect(result).toBe(member);
    });

    it('propagates NotFoundException from service when member is not found', async () => {
      const dto: UpdateMemberDto = { role: TeamMemberRole.Admin };

      service.updateMemberRole.mockRejectedValue(
        new NotFoundException('Member not found'),
      );

      await expect(
        controller.updateMemberRole('team-id', 'missing-user-id', dto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
