import { Module } from '@nestjs/common';
import { ProjectModule } from './project/project.module';
import { TaskModule } from './task/task.module';
import { NoteModule } from './note/note.module';
import { CalendarEventModule } from './calendar/calendar-event.module';
import { CardModule } from './card/card.module';

@Module({
  imports: [
    ProjectModule,
    TaskModule,
    NoteModule,
    CalendarEventModule,
    CardModule,
  ],
})
export class DeskModule {}
