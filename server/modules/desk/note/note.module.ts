import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Note } from './note.entity';
import { NoteService } from './note.service';
import { NoteController } from './note.controller';
import { RbacModule } from '../../identity/rbac/rbac.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Note]),
    RbacModule,
    ProjectModule,
  ],
  controllers: [NoteController],
  providers: [NoteService],
})
export class NoteModule {}
