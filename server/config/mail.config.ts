import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  transport: {
    host: process.env.MAIL_HOST ?? '127.0.0.1',
    port: Number(process.env.MAIL_PORT ?? 1025),
    tls: { ciphers: 'SSLv3' },
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER ?? '',
      pass: process.env.MAIL_PASS ?? '',
    },
  },
  defaults: {
    from: process.env.MAIL_FROM ?? 'info@crude.com',
  },
}));
