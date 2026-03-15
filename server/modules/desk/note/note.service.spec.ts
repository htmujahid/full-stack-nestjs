import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NoteService } from './note.service';
import { Note } from './note.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { FindNotesDto } from './dto/find-notes.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';
import { mockRepository } from '../../../mocks/db.mock';

const makeNote = (overrides: Partial<Note> = {}): Note =>
  ({
    id: 'note-1',
    title: 'Test Note',
    content: null,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Note;

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'project-1',
  userId: 'user-1',
  ...overrides,
});

const mockQueryBuilder = () => ({
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

const auth = { userId: 'user-1', role: UserRole.Member } as const;

describe('NoteService', () => {
  let service: NoteService;
  let noteRepo: ReturnType<typeof mockRepository> & {
    createQueryBuilder: jest.Mock;
  };
  let projectService: { findOne: jest.Mock };
  let qb: ReturnType<typeof mockQueryBuilder>;

  beforeEach(async () => {
    noteRepo = {
      ...mockRepository(),
      createQueryBuilder: jest.fn(),
    };
    qb = mockQueryBuilder();
    noteRepo.createQueryBuilder.mockReturnValue(qb);

    projectService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoteService,
        { provide: getRepositoryToken(Note), useValue: noteRepo },
        { provide: ProjectService, useValue: projectService },
      ],
    }).compile();

    service = module.get(NoteService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns NotesPage with data, total, page, limit', async () => {
      const notes = [makeNote(), makeNote({ id: 'note-2', title: 'Second' })];
      qb.getManyAndCount.mockResolvedValue([notes, 2]);

      const dto: FindNotesDto = {};
      const result = await service.findAll(dto, auth);

      expect(noteRepo.createQueryBuilder).toHaveBeenCalledWith('note');
      expect(qb.orderBy).toHaveBeenCalledWith('note.createdAt', 'DESC');
      expect(result).toEqual({ data: notes, total: 2, page: 1, limit: 20 });
    });

    it('adds andWhere for search and projectId', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'meeting', projectId: 'proj-1' }, auth);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(note.title LIKE :search OR note.content LIKE :search)',
        { search: '%meeting%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('note.projectId = :projectId', {
        projectId: 'proj-1',
      });
    });

    it('applies pagination and sortBy', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { page: 2, limit: 10, sortBy: 'title', sortOrder: 'asc' },
        auth,
      );

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.orderBy).toHaveBeenCalledWith('note.title', 'ASC');
    });
  });

  describe('findOne', () => {
    it('returns note when found', async () => {
      const note = makeNote();
      noteRepo.findOne.mockResolvedValue(note);

      const result = await service.findOne('note-1');

      expect(noteRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        relations: { project: true },
      });
      expect(result).toBe(note);
    });

    it('throws NotFoundException when not found', async () => {
      noteRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates note when user owns project', async () => {
      const dto: CreateNoteDto = { title: 'New Note', projectId: 'project-1' };
      const project = makeProject({ userId: 'user-1' });
      const created = makeNote({ title: 'New Note' });

      projectService.findOne.mockResolvedValue(project);
      noteRepo.create.mockReturnValue(created);
      noteRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(noteRepo.create).toHaveBeenCalledWith({
        title: 'New Note',
        content: null,
        projectId: 'project-1',
      });
      expect(result).toBe(created);
    });

    it('throws ForbiddenException when Member creates in another user project', async () => {
      const dto: CreateNoteDto = { title: 'New', projectId: 'project-1' };
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.create(dto, auth)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows Admin to create in any project', async () => {
      const dto: CreateNoteDto = { title: 'New', projectId: 'project-1' };
      const project = makeProject({ userId: 'other-user' });
      const created = makeNote();

      projectService.findOne.mockResolvedValue(project);
      noteRepo.create.mockReturnValue(created);
      noteRepo.save.mockResolvedValue(created);

      const result = await service.create(dto, {
        userId: 'admin-1',
        role: UserRole.Admin,
      });

      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('updates note when user owns project', async () => {
      const note = makeNote();
      const dto: UpdateNoteDto = { title: 'Updated' };
      const project = makeProject({ userId: 'user-1' });

      noteRepo.findOne.mockResolvedValue(note);
      projectService.findOne.mockResolvedValue(project);
      noteRepo.save.mockResolvedValue({ ...note, ...dto });

      const result = await service.update('note-1', dto, auth);

      expect(projectService.findOne).toHaveBeenCalledWith('project-1');
      expect(noteRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws ForbiddenException when Member updates note in another user project', async () => {
      const note = makeNote();
      noteRepo.findOne.mockResolvedValue(note);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(
        service.update('note-1', { title: 'Updated' }, auth),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('removes note when user owns project', async () => {
      const note = makeNote();
      noteRepo.findOne.mockResolvedValue(note);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'user-1' }),
      );
      noteRepo.remove.mockResolvedValue(undefined);

      await service.remove('note-1', auth);

      expect(noteRepo.remove).toHaveBeenCalledWith(note);
    });

    it('throws ForbiddenException when Member removes note in another user project', async () => {
      const note = makeNote();
      noteRepo.findOne.mockResolvedValue(note);
      projectService.findOne.mockResolvedValue(
        makeProject({ userId: 'other-user' }),
      );

      await expect(service.remove('note-1', auth)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
