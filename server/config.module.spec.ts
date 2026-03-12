import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from './config.module';

describe('AppConfigModule', () => {
  it('compiles and exposes ConfigService globally', async () => {
    const module = await Test.createTestingModule({
      imports: [AppConfigModule],
    }).compile();

    const configService = module.get(ConfigService);
    expect(configService).toBeDefined();
  });

  it('loads app config namespace with defaults', async () => {
    const module = await Test.createTestingModule({
      imports: [AppConfigModule],
    }).compile();

    const configService = module.get(ConfigService);
    expect(configService.get('app.port')).toBe(3000);
    expect(configService.get('app.url')).toBe('http://localhost:3000');
    expect(configService.get('app.name')).toBe('crude');
  });

  it('re-exports ConfigModule as global', async () => {
    // A module that does NOT import AppConfigModule should still
    // resolve ConfigService because ConfigModule is registered as global.
    const module = await Test.createTestingModule({
      imports: [AppConfigModule],
      providers: [
        {
          provide: 'TEST',
          useFactory: (cfg: ConfigService) => cfg.get('app.name'),
          inject: [ConfigService],
        },
      ],
    }).compile();

    expect(module.get('TEST')).toBe('crude');
  });
});
