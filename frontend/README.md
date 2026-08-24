# TeleHealthx Frontend (Next.js)

This app owns all UI routes. Backend requests are proxied through Next rewrites.

## Environment

Copy [TeleHealthx frontend/.env.example](.env.example) to `.env.local` for local development.

- `NEXT_SERVER_API_URL`: server-side rewrite target. Required in staging/production.
- `NEXT_PUBLIC_API_URL`: optional browser-side base URL. Default behavior in code uses `/backend`.

For full environment matrix and startup guardrails, see [docs/phase-0-baseline.md](../docs/phase-0-baseline.md).

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Local Stability Flow

Use this when running with backend in parallel:

1. Terminal 1 (backend, project root):

```bash
npm run local:backend
```

2. Terminal 2 (frontend):

```bash
npm run local:dev
```

If port 3000 is occupied:

```bash
npm run local:free-port
```

Local smoke checklist:

1. Login works.
2. Session refresh works.
3. Core dashboard loads.
4. One appointment flow works.
5. One file upload/download flow works.

## API Boundary Rules

- UI navigation stays in Next App Router pages.
- Backend API is consumed under `/api/*` and `/backend/*` rewrite paths.
- Auth/session endpoints use `/api/auth/*`.
