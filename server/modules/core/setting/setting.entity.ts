import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SettingType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Json = 'json',
}

@Entity('setting')
export class Setting {
  @PrimaryColumn({ length: 128 })
  key: string;

  @Column({ type: 'text', default: '' })
  value: string;

  @Column({ type: 'enum', enum: SettingType, default: SettingType.String })
  type: SettingType;

  @Column({ length: 64, default: 'general' })
  group: string;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
