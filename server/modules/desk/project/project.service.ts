import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UserRole } from '../../identity/user/user-role.enum';

export type AuthContext = { userId: string; role: UserRole };

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  findAll(): Promise<Project[]> {
    return this.projectRepository.find();
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ id });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(dto: CreateProjectDto, userId: string): Promise<Project> {
    const project = this.projectRepository.create({ ...dto, userId });
    return this.projectRepository.save(project);
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
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async remove(id: string, auth: AuthContext): Promise<void> {
    const project = await this.findOne(id);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    await this.projectRepository.remove(project);
  }
}
