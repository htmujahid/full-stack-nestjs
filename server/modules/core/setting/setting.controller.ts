import {
  Controller,
  Get,
  Put,
  Param,
  Body,
} from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { Public } from '../../identity/auth/decorators/public.decorator';

@Controller('api/settings')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Public()
  @Get('public')
  getPublic() {
    return this.settingService.getPublic();
  }

  @Get()
  getAll() {
    return this.settingService.getAll();
  }

  @Get(':key')
  getOne(@Param('key') key: string) {
    return this.settingService.getOrThrow(key);
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingService.updateValue(key, dto.value);
  }
}
