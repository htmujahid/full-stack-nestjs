import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './note.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { FindNotesDto } from './dto/find-notes.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';

export type AuthContext = { userId: string; role: UserRole };

export type NotesPage = {
  data: Note[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class NoteService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
    private readonly projectService: ProjectService,
  ) {}

  async findAll(dto: FindNotesDto, _auth: AuthContext): Promise<NotesPage> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.noteRepository.createQueryBuilder('note');

    if (dto.search) {
      qb.andWhere(
        '(note.title LIKE :search OR note.content LIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    if (dto.projectId) {
      qb.andWhere('note.projectId = :projectId', { projectId: dto.projectId });
    }

    const sortBy = dto.sortBy ?? 'createdAt';
    const sortOrder = (dto.sortOrder ?? 'desc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(`note.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Note> {
    const note = await this.noteRepository.findOne({
      where: { id },
      relations: { project: true },
    });
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  async create(dto: CreateNoteDto, auth: AuthContext): Promise<Note> {
    const project = await this.projectService.findOne(dto.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    const note = this.noteRepository.create({
      title: dto.title,
      content: dto.content ?? null,
      projectId: dto.projectId,
    });
    return this.noteRepository.save(note);
  }

  async update(id: string, dto: UpdateNoteDto, auth: AuthContext): Promise<Note> {
    const note = await this.findOne(id);
    const project = await this.projectService.findOne(note.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    Object.assign(note, dto);
    return this.noteRepository.save(note);
  }

  async remove(id: string, auth: AuthContext): Promise<void> {
    const note = await this.findOne(id);
    const project = await this.projectService.findOne(note.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    await this.noteRepository.remove(note);
  }
}
