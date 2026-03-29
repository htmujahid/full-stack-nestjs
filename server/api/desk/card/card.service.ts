import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Card } from './card.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { FindCardsDto } from './dto/find-cards.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { ProjectService } from '../project/project.service';
import { UserRole } from '../../identity/user/user-role.enum';

export type AuthContext = { userId: string; role: UserRole };

export type CardsPage = {
  data: Card[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class CardService {
  constructor(
    @InjectRepository(Card)
    private readonly cardRepository: Repository<Card>,
    private readonly projectService: ProjectService,
  ) {}

  async findAll(dto: FindCardsDto, _auth: AuthContext): Promise<CardsPage> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.cardRepository.createQueryBuilder('card');

    if (dto.search) {
      qb.andWhere(
        '(card.title LIKE :search OR card.description LIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    if (dto.projectId) {
      qb.andWhere('card.projectId = :projectId', { projectId: dto.projectId });
    }

    const sortBy = dto.sortBy ?? 'createdAt';
    const sortOrder = (dto.sortOrder ?? 'desc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(`card.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Card> {
    const card = await this.cardRepository.findOne({
      where: { id },
      relations: { project: true },
    });
    if (!card) throw new NotFoundException('Card not found');
    return card;
  }

  async create(dto: CreateCardDto, auth: AuthContext): Promise<Card> {
    const project = await this.projectService.findOne(dto.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    const card = this.cardRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      projectId: dto.projectId,
    });
    return this.cardRepository.save(card);
  }

  async update(
    id: string,
    dto: UpdateCardDto,
    auth: AuthContext,
  ): Promise<Card> {
    const card = await this.findOne(id);
    const project = await this.projectService.findOne(card.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    Object.assign(card, dto);
    return this.cardRepository.save(card);
  }

  async remove(id: string, auth: AuthContext): Promise<void> {
    const card = await this.findOne(id);
    const project = await this.projectService.findOne(card.projectId);
    if (auth.role !== UserRole.Admin && project.userId !== auth.userId) {
      throw new ForbiddenException();
    }
    await this.cardRepository.remove(card);
  }
}
