import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NoteController } from './note.controller';
import { NoteService } from './note.service';
import { Note } from './note.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { FindNotesDto } from './dto/find-notes.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { UserRole } from '../../identity/user/user-role.enum';

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

const makeRequest = (userId: string, role: UserRole = UserRole.Member): Request =>
  ({ user: { userId, role } }) as unknown as Request;

const mockNoteService = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('NoteController', () => {
  let controller: NoteController;
  let service: ReturnType<typeof mockNoteService>;

  beforeEach(async () => {
    service = mockNoteService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NoteController],
      providers: [{ provide: NoteService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(NoteController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('delegates to service.findAll(dto, auth) and returns NotesPage', async () => {
      const dto: FindNotesDto = {};
      const page = { data: [makeNote()], total: 1, page: 1, limit: 20 };
      const req = makeRequest('user-1');

      service.findAll.mockResolvedValue(page);

      const result = await controller.findAll(dto, req);

      expect(service.findAll).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(page);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findOne(id)', async () => {
      const note = makeNote();
      service.findOne.mockResolvedValue(note);

      const result = await controller.findOne('note-1');

      expect(service.findOne).toHaveBeenCalledWith('note-1');
      expect(result).toBe(note);
    });

    it('propagates NotFoundException', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Note not found'));

      await expect(controller.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('delegates to service.create(dto, auth)', async () => {
      const dto: CreateNoteDto = { title: 'New', projectId: 'proj-1' };
      const note = makeNote({ title: 'New' });
      const req = makeRequest('user-1');

      service.create.mockResolvedValue(note);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(note);
    });
  });

  describe('update', () => {
    it('delegates to service.update(id, dto, auth)', async () => {
      const dto: UpdateNoteDto = { title: 'Updated' };
      const updated = makeNote({ title: 'Updated' });
      const req = makeRequest('user-1');

      service.update.mockResolvedValue(updated);

      const result = await controller.update('note-1', dto, req);

      expect(service.update).toHaveBeenCalledWith('note-1', dto, {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBe(updated);
    });

    it('propagates ForbiddenException', async () => {
      const req = makeRequest('user-1');
      service.update.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.update('note-1', { title: 'x' }, req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove(id, auth)', async () => {
      const req = makeRequest('user-1');
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove('note-1', req);

      expect(service.remove).toHaveBeenCalledWith('note-1', {
        userId: 'user-1',
        role: UserRole.Member,
      });
      expect(result).toBeUndefined();
    });
  });
});
