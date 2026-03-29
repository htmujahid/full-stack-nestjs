import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

export const PermissionHealth = {
  NETWORK: 'network',
  DB: 'database',
  MH: 'memory-heap',
  MR: 'memory-rss',
  DISK: 'disk',
} as const;

@ApiTags('Health Check')
// Route prefix: /api/health (managed by RouterModule — see server/routes.ts)
@Controller()
export class HealthController {
  constructor(
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get('network')
  @HealthCheck()
  async checkNetwork() {
    return this.http.pingCheck(
      'crude',
      'https://jsonplaceholder.typicode.com/posts',
    );
  }

  @Get('database')
  @HealthCheck()
  async checkDatabase() {
    return this.db.pingCheck('database');
  }

  @Get('memory-heap')
  @HealthCheck()
  async checkMemoryHeap() {
    // the process should not use more than 200MB memory
    return this.memory.checkHeap('memory-heap', 200 * 1024 * 1024);
  }

  @Get('memory-rss')
  @HealthCheck()
  async checkMemoryRSS() {
    // the process should not have more than 200MB RSS memory allocated
    return this.memory.checkRSS('memory-rss', 200 * 1024 * 1024);
  }

  @Get('disk')
  @HealthCheck()
  async checkDisk() {
    return this.disk.checkStorage('disk', {
      // The used disk storage should not exceed 75% of the full disk size
      thresholdPercent: 0.75,
      path: '/',
    });
  }
}
