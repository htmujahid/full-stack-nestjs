import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    appService = module.get(AppService);
  });

  describe('getHello', () => {
    it('returns { message: "Hello World!" }', () => {
      expect(appService.getHello()).toEqual({ message: 'Hello World!' });
    });
  });
});
