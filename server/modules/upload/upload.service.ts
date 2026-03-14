import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('s3.endpoint');
    const region = this.config.get<string>('s3.region') ?? 'us-east-1';
    const accessKey = this.config.getOrThrow<string>('s3.accessKey');
    const secretKey = this.config.getOrThrow<string>('s3.secretKey');

    this.bucket = this.config.getOrThrow<string>('s3.bucket');
    this.publicUrl = this.config.getOrThrow<string>('s3.publicUrl').replace(/\/$/, '');

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
  }

  async upload(
    file: Express.Multer.File,
    prefix = 'uploads',
  ): Promise<{ url: string; key: string; size: number; name: string }> {
    const ext = file.originalname.split('.').pop() ?? '';
    const key = `${prefix}/${randomUUID()}${ext ? `.${ext}` : ''}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3.send(new PutObjectCommand(params));

    const url = `${this.publicUrl}/${key}`;
    return {
      url,
      key,
      size: file.size,
      name: file.originalname,
    };
  }
}
