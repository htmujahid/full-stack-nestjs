import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { ViteDevServer } from 'vite';

const isProduction = process.env.NODE_ENV === 'production';

const clientDist = path.resolve(process.cwd(), 'dist/client');

@Injectable()
export class ViteMiddleware implements NestMiddleware {
  private vite: ViteDevServer | null = null;
  private initialized = false;
  private staticHandler: ReturnType<typeof express.static> | null = null;

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    if (isProduction) {
      if (!this.staticHandler) {
        this.staticHandler = express.static(clientDist);
      }
      return this.staticHandler(req, res, () => {
        res.sendFile(path.resolve(clientDist, 'index.html'));
      });
    }

    if (!this.initialized) {
      await this.init();
    }

    if (!this.vite) {
      return next();
    }

    this.vite.middlewares(req, res, async () => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(
          path.resolve(process.cwd(), 'index.html'),
          'utf-8',
        );
        template = await this.vite!.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        this.vite!.ssrFixStacktrace(error);
        console.error(error);
        res.status(500).end(error.message);
      }
    });
  }

  private async init() {
    if (this.initialized) return;
    this.initialized = true;
    const { createServer } = await import('vite');
    this.vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }
}
