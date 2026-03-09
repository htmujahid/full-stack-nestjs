# Project: crude

Full-stack monorepo: **NestJS** backend + **React + Vite** frontend. App title is "crude".

## Stack

- **Backend**: NestJS 11, Express 5, TypeScript (target ES2023, nodenext modules)
- **Frontend**: React 19, Vite 7, TypeScript (target ES2022, bundler mode, JSX react-jsx)
- **Package manager**: `pnpm` — always use pnpm, never npm or yarn

## Project Structure

```
/
├── server/                   # NestJS backend source (sourceRoot in nest-cli.json)
│   ├── main.ts               # Bootstrap — listens on PORT env or 3000
│   ├── app.module.ts         # Root module — mounts ViteMiddleware for all GET routes
│   ├── app.controller.ts     # GET /api/hello
│   ├── app.service.ts        # Returns 'Hello World!'
│   └── vite.middleware.ts    # Dev: Vite dev server in middleware mode; Prod: serves static client build
├── client/                   # React frontend source
│   └── main.tsx              # Entry point — mounts into #root
├── index.html                # Root HTML — loads /client/main.tsx as module
├── vite.config.ts            # Vite config — alias @ -> project root, includes in tsconfig.node.json
├── eslint.client.config.js   # ESLint for client/ (react-hooks, react-refresh, typescript-eslint)
├── eslint.server.config.mjs  # ESLint for server/ (prettier, typescript-eslint type-checked)
├── nest-cli.json             # NestJS CLI — sourceRoot: server, tsConfigPath: tsconfig.server.json
├── .prettierrc               # singleQuote: true, trailingComma: all
├── tsconfig.json             # Root — project references only
├── tsconfig.app.json         # Client TS config — includes client/, noEmit, strict
├── tsconfig.server.json      # Server TS config — emits to dist/server/, baseUrl: ./server
└── tsconfig.node.json        # Vite config TS — includes vite.config.ts only
```

## Key Conventions

- **API routes** must be prefixed with `/api` — `ViteMiddleware` passes `/api` requests to NestJS and handles all other GET routes itself
- **Client path alias**: `@/` resolves to `./client/` (set in tsconfig.app.json and vite.config.ts)
- **Prettier**: single quotes, trailing commas
- **Server ESLint**: uses type-checked rules via `tsconfig.server.json`; prettier integrated as ESLint error
- **Client ESLint**: `eslint.client.config.js` — components in `client/**/components/ui/**` have `react-refresh/only-export-components` turned off

## Scripts

```bash
pnpm run start:dev    # NestJS watch mode — serves API + Vite dev server together
pnpm run start:debug  # NestJS debug + watch mode
pnpm run build        # nest build && vite build
pnpm run start:prod   # node dist/server/main
pnpm run lint         # runs lint:client then lint:server
pnpm run lint:client  # eslint client/ --config eslint.client.config.js
pnpm run lint:server  # eslint server/ --config eslint.server.config.mjs
pnpm run format       # prettier --write on server/**/*.ts and client/**/*.{ts,tsx}
```

## Development Notes

- `ViteMiddleware` is lazy — it creates the Vite dev server on the first non-API request
- In production (`NODE_ENV=production`), middleware serves static files with SPA fallback to `index.html`
- `tsconfig.server.json` excludes `client/`, `vite.config.ts`, `test/`, and `**/*spec.ts`
- Server uses `emitDecoratorMetadata` and `experimentalDecorators` (required for NestJS DI)
