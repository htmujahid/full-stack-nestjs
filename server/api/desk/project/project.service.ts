import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { FindProjectsDto } from './dto/find-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserRole } from '../../identity/user/user-role.enum';
import { AuditService } from '../../core/audit/audit.service';

export type AuthContext = { userId: string; role: UserRole };

export type ProjectsPage = {
  data: Project[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(dto: FindProjectsDto): Promise<ProjectsPage> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.projectRepository.createQueryBuilder('project');

    if (dto.search) {
      qb.andWhere(
        '(project.name LIKE :search OR project.description LIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    if (dto.userId) {
      qb.andWhere('project.userId = :userId', { userId: dto.userId });
    }

    const sortBy = dto.sortBy ?? 'name';
    const sortOrder = (dto.sortOrder ?? 'asc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(`project.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ id });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(dto: CreateProjectDto, userId: string): Promise<Project> {
    const project = this.projectRepository.create({ ...dto, userId });
    const saved = await this.projectRepository.save(project);
    void this.auditService.logCreate(
      'project',
      saved.id,
      { name: saved.name, description: saved.description },
      { actorId: userId },
    );
    return saved;
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
    auth: AuthContext,
  ): Promise<Project> {
    const project = await this.findOne(id);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    const oldValue = { name: project.name, description: project.description };
    Object.assign(project, dto);
    const saved = await this.projectRepository.save(project);
    void this.auditService.logUpdate(
      'project',
      id,
      oldValue,
      { name: saved.name, description: saved.description },
      { actorId: auth.userId },
    );
    return saved;
  }

  async remove(id: string, auth: AuthContext): Promise<void> {
    const project = await this.findOne(id);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    void this.auditService.logDelete(
      'project',
      id,
      { name: project.name },
      { actorId: auth.userId },
    );
    await this.projectRepository.remove(project);
  }
}
