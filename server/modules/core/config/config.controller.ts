import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('api/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getAll() {
    return this.configService.getAll();
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    const value = await this.configService.get(key);
    return { key, value };
  }

  @Put(':key')
  async set(@Param('key') key: string, @Body() body: { value: string | null }) {
    const config = await this.configService.set(key, body.value ?? null);
    return config;
  }
}
