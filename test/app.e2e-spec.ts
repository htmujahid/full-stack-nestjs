import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from '../server/app.controller';
import { AppService } from '../server/app.service';

describe('/api/hello (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/hello → 200 with message', () => {
    return request(app.getHttpServer())
      .get('/api/hello')
      .expect(200)
      .expect({ message: 'Hello World!' });
  });

  it('GET /api/hello → Content-Type is JSON', () => {
    return request(app.getHttpServer())
      .get('/api/hello')
      .expect('Content-Type', /application\/json/);
  });

  it('POST /api/hello → 404 (method not allowed)', () => {
    return request(app.getHttpServer()).post('/api/hello').expect(404);
  });
});
