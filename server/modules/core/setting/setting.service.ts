import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Setting, SettingType } from './setting.entity';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  private coerce<T>(setting: Setting): T {
    const { value, type } = setting;
    switch (type) {
      case SettingType.Number:
        return Number(value) as T;
      case SettingType.Boolean:
        return (value === 'true') as T;
      case SettingType.Json:
        return JSON.parse(value) as T;
      default:
        return value as T;
    }
  }

  private serialize(value: unknown): string {
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  async get<T>(key: string): Promise<T | null> {
    const setting = await this.repo.findOne({ where: { key } });
    if (!setting) return null;
    return this.coerce<T>(setting);
  }

  async getOrThrow<T>(key: string): Promise<T> {
    const setting = await this.repo.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
    return this.coerce<T>(setting);
  }

  async getAll(): Promise<Setting[]> {
    return this.repo.find({ order: { group: 'ASC', key: 'ASC' } });
  }

  async getPublic(): Promise<Record<string, unknown>> {
    const settings = await this.repo.find({
      where: { isPublic: true },
      order: { key: 'ASC' },
    });
    return Object.fromEntries(
      settings.map((s) => [s.key, this.coerce(s)]),
    );
  }

  async getByGroup(group: string): Promise<Record<string, unknown>> {
    const settings = await this.repo.find({
      where: { group },
      order: { key: 'ASC' },
    });
    return Object.fromEntries(
      settings.map((s) => [s.key, this.coerce(s)]),
    );
  }

  async set(
    key: string,
    value: unknown,
    meta?: Partial<Pick<Setting, 'type' | 'group' | 'isPublic' | 'description'>>,
  ): Promise<Setting> {
    let setting = await this.repo.findOne({ where: { key } });
    if (!setting) {
      setting = this.repo.create({
        key,
        type: SettingType.String,
        group: 'general',
        isPublic: false,
        description: null,
        ...meta,
      });
    } else if (meta) {
      Object.assign(setting, meta);
    }
    setting.value = this.serialize(value);
    return this.repo.save(setting);
  }

  async updateValue(key: string, value: unknown): Promise<Setting> {
    const setting = await this.repo.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
    setting.value = this.serialize(value);
    return this.repo.save(setting);
  }

  async delete(key: string): Promise<void> {
    const result = await this.repo.delete(key);
    if (result.affected === 0) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }
  }
}
