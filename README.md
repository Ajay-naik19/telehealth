# TeleHealthx

TeleHealthx is a local full-stack healthcare platform with a Next.js frontend, an Express/Socket.IO backend, PostgreSQL data storage, and local disk-based uploads.

## Local architecture

- `frontend/` — Next.js app at `http://localhost:3000`
- `backend/` — Express API and Socket.IO server at `http://localhost:10000`
- PostgreSQL — local database named `telehealth`
- Uploads — stored locally in `backend/public/uploads/`

Supabase storage and Redis are disabled for the local setup.

## Requirements

- Node.js 18 or newer
- PostgreSQL running locally
- A PostgreSQL database named `telehealth`

## Configure the backend

Create `backend/.env` with your own values. Do not commit this file.

```env
PORT=10000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/telehealth
ACCESS_TOKEN_SECRET=replace-with-a-long-random-access-secret
REFRESH_TOKEN_SECRET=replace-with-a-different-long-random-refresh-secret
FRONTEND_URL=http://localhost:3000
PUBLIC_BACKEND_URL=http://localhost:10000
```

If the password includes special URL characters (for example `@`), URL-encode them (`@` becomes `%40`).

## Configure the frontend

Create `frontend/.env`:

```env
NEXT_SERVER_API_URL=http://localhost:10000
NEXT_PUBLIC_API_URL=/backend
```

## Create the database tables

The supplied Supabase export needs a small local adjustment first: remove or comment its `supabase_vault`, `pg_stat_statements`, `pgcrypto`, and `uuid-ossp` extension statements, plus grants to `anon`, `authenticated`, and `service_role`. Then import it in Command Prompt:

```cmd
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d telehealth -W -v ON_ERROR_STOP=1 -f "D:\telehealth_schema.sql"
```

The backend requires tables including `users`, `user_profile`, `doc_profile`, `appointments`, `medical_records`, and `refresh_tokens`.

## Install and run

Install dependencies once:

```cmd
cd backend
npm install
cd ..\frontend
npm install
```

Run each service in a separate terminal:

```cmd
cd D:\TeleHealth\backend
npm run dev
```

```cmd
cd D:\TeleHealth\frontend
npm run dev
```

Open `http://localhost:3000`.

## Auth routes

- Patient login: `/auth/patient`
- Patient signup: `/auth/patient?mode=signup`
- Doctor login: `/auth/doctor`
- Doctor signup: `/auth/doctor?mode=signup`

The auth form uses POST. Passwords must never be present in the browser URL.

## Security and repository hygiene

- `.env`, `.env.local`, uploads, logs, dependencies, and Next build output are ignored by Git.
- Keep `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` distinct.
- Do not add database passwords, SMTP passwords, API keys, or service-role keys to source files.
- If a password appears in browser history or a URL, change it immediately and clear that history entry.

## Known source references

The source has intentional public URLs for localhost development, Google Fonts/CDNs, and site/profile links. There are no committed credentials or private IP addresses. A legacy Supabase CSP allow-list remains in unused copied server files under `frontend/src`; it is not used by the active local frontend or backend upload path.
