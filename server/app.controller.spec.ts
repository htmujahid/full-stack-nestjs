import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = module.get(AppController);
  });

  describe('GET /api/hello', () => {
    it('returns a message object', () => {
      expect(appController.getHello()).toEqual({ message: 'Hello World!' });
    });
  });
});
