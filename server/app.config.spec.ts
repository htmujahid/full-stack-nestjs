import appConfig from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('defaults', () => {
    it('uses port 3000 when PORT is not set', () => {
      delete process.env.PORT;
      expect(appConfig().port).toBe(3000);
    });

    it('uses http://localhost:3000 when APP_URL is not set', () => {
      delete process.env.APP_URL;
      expect(appConfig().url).toBe('http://localhost:3000');
    });

    it('uses "crude" when APP_NAME is not set', () => {
      delete process.env.APP_NAME;
      expect(appConfig().name).toBe('crude');
    });
  });

  describe('env overrides', () => {
    it('reads PORT as an integer', () => {
      process.env.PORT = '8080';
      expect(appConfig().port).toBe(8080);
    });

    it('reads APP_URL', () => {
      process.env.APP_URL = 'https://example.com';
      expect(appConfig().url).toBe('https://example.com');
    });

    it('reads APP_NAME', () => {
      process.env.APP_NAME = 'my-app';
      expect(appConfig().name).toBe('my-app');
    });
  });
});
