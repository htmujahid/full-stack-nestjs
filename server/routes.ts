import { Routes } from '@nestjs/core';
import { AnalyticsModule } from './api/core/analytics/analytics.module';
import { AuditModule } from './api/core/audit/audit.module';
import { HealthModule } from './api/core/health/health.module';
import { SettingModule } from './api/core/setting/setting.module';
import { AccountModule } from './api/identity/account/account.module';
import { AuthModule } from './api/identity/auth/auth.module';
import { MeModule } from './api/identity/me/me.module';
import { OAuthModule } from './api/identity/oauth/oauth.module';
import { TeamModule } from './api/identity/team/team.module';
import { TwoFactorModule } from './api/identity/2fa/two-factor.module';
import { UserModule } from './api/identity/user/user.module';
import { CalendarEventModule } from './api/desk/calendar/calendar-event.module';
import { CardModule } from './api/desk/card/card.module';
import { NoteModule } from './api/desk/note/note.module';
import { ProjectModule } from './api/desk/project/project.module';
import { TaskModule } from './api/desk/task/task.module';
import { ExportModule } from './api/data/export/export.module';
import { ImportModule } from './api/data/import/import.module';
import { ReportModule } from './api/data/report/report.module';
import { NotificationModule } from './api/misc/notification/notification.module';
import { UploadModule } from './api/misc/upload/upload.module';

export const routes: Routes = [
  {
    path: 'api',
    children: [
      // Core
      { path: 'analytics', module: AnalyticsModule },
      { path: 'audit', module: AuditModule },
      { path: 'health', module: HealthModule },
      { path: 'settings', module: SettingModule },
      // Identity
      { path: 'auth', module: AuthModule },
      { path: 'account', module: AccountModule },
      { path: 'me', module: MeModule },
      { path: 'two-factor', module: TwoFactorModule },
      { path: 'users', module: UserModule },
      {
        path: 'identity',
        children: [{ path: 'teams', module: TeamModule }],
      },
      {
        path: 'oauth',
        children: [{ path: 'google', module: OAuthModule }],
      },
      // Desk
      { path: 'calendar-events', module: CalendarEventModule },
      { path: 'cards', module: CardModule },
      { path: 'notes', module: NoteModule },
      { path: 'projects', module: ProjectModule },
      { path: 'tasks', module: TaskModule },
      // Data
      {
        path: 'data',
        children: [
          { path: 'export', module: ExportModule },
          { path: 'import', module: ImportModule },
          { path: 'report', module: ReportModule },
        ],
      },
      // Misc
      { path: 'notifications', module: NotificationModule },
      { path: 'upload', module: UploadModule },
    ],
  },
];
