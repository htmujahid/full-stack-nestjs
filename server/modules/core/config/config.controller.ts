import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConfigService } from './config.service';

@ApiTags('Config')
@Controller('api/config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get all config entries' })
  getAll() {
    return this.configService.getAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a config value by key' })
  @ApiParam({ name: 'key', type: String })
  async get(@Param('key') key: string) {
    const value = await this.configService.get(key);
    return { key, value };
  }

  @Put(':key')
  @ApiOperation({ summary: 'Set a config value by key' })
  @ApiParam({ name: 'key', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { value: { type: 'string', nullable: true } },
      example: { value: 'your value here' },
    },
  })
  async set(@Param('key') key: string, @Body() body: { value: string | null }) {
    const config = await this.configService.set(key, body.value ?? null);
    return config;
  }
}
