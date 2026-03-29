import {
  Controller,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Express } from 'express';
import { ImportService, type ImportFormat } from './import.service';
import { RolesGuard } from '../../identity/rbac/roles.guard';
import { PermissionsGuard } from '../../identity/rbac/permissions.guard';
import { Roles } from '../../identity/rbac/roles.decorator';
import { RequirePermissions } from '../../identity/rbac/require-permissions.decorator';
import { UserRole } from '../../identity/user/user-role.enum';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = /^(text\/csv|application\/json|text\/plain)$/;

@ApiTags('Data Import')
@ApiBearerAuth()
// Route prefix: /api/data/import (managed by RouterModule — see server/routes.ts)
@Controller()
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.Admin, UserRole.Member)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Preview imported file (CSV or JSON)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        format: { type: 'string', enum: ['csv', 'json'] },
      },
    },
  })
  @ApiOkResponse({ description: 'Preview of parsed data' })
  @RequirePermissions('project:read')
  async preview(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_SIZE })
        .addFileTypeValidator({
          fileType: ALLOWED_TYPES,
          fallbackToMimetype: true,
        })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    format?: ImportFormat,
  ) {
    const detected: ImportFormat =
      format ??
      (file.mimetype === 'application/json' ? 'json' : 'csv');
    return this.importService.preview(file.buffer, detected);
  }
}
