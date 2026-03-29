import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
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
import { UploadService } from './upload.service';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/;

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('api/upload')
export class UploadController {
  constructor(private readonly upload: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        prefix: {
          type: 'string',
          description: 'Optional S3 key prefix (default: uploads)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Returns the uploaded file URL and metadata',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'http://localhost:9000/crude/uploads/xxx.jpg',
        },
        key: { type: 'string' },
        size: { type: 'number' },
        name: { type: 'string' },
      },
    },
  })
  async uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_SIZE })
        .addFileTypeValidator({ fileType: ALLOWED_TYPES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @Body('prefix') prefix?: string,
  ) {
    return this.upload.upload(file, prefix ?? 'uploads');
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file from S3 by key or URL' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'S3 object key' },
        url: {
          type: 'string',
          description: 'Full file URL (alternative to key)',
        },
      },
    },
  })
  async deleteFile(@Body('key') key?: string, @Body('url') url?: string) {
    const target = key ?? url;
    if (!target) return;
    await this.upload.delete(target);
  }
}
