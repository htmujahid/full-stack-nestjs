import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Config } from './config.entity';

@Injectable()
export class ConfigService {
  constructor(
    @InjectRepository(Config)
    private configRepository: Repository<Config>,
  ) {}

  async get(key: string): Promise<string | null> {
    const row = await this.configRepository.findOne({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string | null): Promise<Config> {
    let row = await this.configRepository.findOne({ where: { key } });
    if (row) {
      row.value = value;
      return this.configRepository.save(row);
    }
    row = this.configRepository.create({ key, value });
    return this.configRepository.save(row);
  }

  async getAll(): Promise<Record<string, string | null>> {
    const rows = await this.configRepository.find();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
