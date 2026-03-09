# crude

Full-stack monorepo: **NestJS** backend + **React + Vite** frontend, served from a **single port**.

## Single-port architecture

Backend and frontend run on the **same port** (default `3000`) in both development and production. No separate dev servers, no proxy config, no CORS headaches.

- **API routes** (`/api/*`) → NestJS handles them
- **Everything else** → Vite (dev) or static client build (prod)

Because the browser talks to one origin, CORS is a non-issue: same-origin requests require no special headers or configuration.

## Stack

- **Backend**: NestJS 11, Express 5, TypeScript
- **Frontend**: React 19, Vite 7, TypeScript
- **Package manager**: pnpm

## Project layout

```
├── server/          # NestJS backend (API, Vite middleware)
├── client/          # React frontend
├── index.html       # Root HTML (loads /client/main.tsx)
└── vite.config.ts   # Vite config (builds to dist/client)
```

## Scripts

| Command        | Description                            |
|----------------|----------------------------------------|
| `pnpm start:dev` | Dev mode: Nest + Vite HMR on port 3000 |
| `pnpm build`     | Builds server + client                 |
| `pnpm start:prod`| Runs prod server (static client + API) |
| `pnpm lint`      | Lint client & server                   |

## How it works

**Development**

- NestJS starts with watch mode.
- `ViteMiddleware` mounts Vite in middleware mode. First non-API request initializes the dev server lazily.
- `/api/*` → NestJS controllers; all other GET requests → Vite (HMR, transforms).

**Production**

- `pnpm build` emits NestJS to `dist/server` and Vite to `dist/client`.
- `ViteMiddleware` serves static files from `dist/client` with SPA fallback to `index.html`.
- `/api/*` still hits NestJS; static assets and SPA routes from Express.

Single process, single port, no CORS.
