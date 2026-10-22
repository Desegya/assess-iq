# AssessIQ

Two learning products, one shared platform: **Nightklass** helps students turn their courses into a practical study system, while **KwikEval** supports institutional assessment workflows.

This repository contains both Next.js applications, their shared NestJS API, and the PostgreSQL data model. It is an actively developed product codebase; feature availability depends on the application, account role, and configured services.

## Products

### Nightklass

[Nightklass](https://www.nightklass.com) is a personal study workspace for students.

- Organize courses and topic outlines, starting with a course title or existing materials.
- Upload notes and documents to support lessons and learning workflows.
- Study topic lessons, ask course questions, and discover supporting resources.
- Create study plans, take practice quizzes, and revise with flashcards.
- Track learning progress, topic mastery, study activity, and GPA.

The dedicated administration workspace at `/admin` supports learner management, courses and topics, lesson corrections, questions, material processing records, learning activity, content reports, and audit history. Owners manage administrative access. These permissions are separate from institutional roles.

### KwikEval

[KwikEval](https://www.kwikeval.com) provides organization, teacher, and student workspaces for courses, materials, question banks, assessments, attempts, and assessment analytics.

Institutional records are scoped to an organization. Nightklass uses standalone learner accounts and personal courses; both products share the API without sharing administrative permissions.

## Architecture

| Workspace | Purpose | Local address |
| --- | --- | --- |
| `apps/nightklass` | Nightklass student and admin frontend | `http://localhost:3002` |
| `apps/web` | KwikEval institutional frontend | `http://localhost:3000` |
| `apps/api` | Shared NestJS REST API | `http://localhost:3001/api/v1` |
| `packages/db` | Prisma schema, migrations, and client | — |
| `packages/types` | Shared TypeScript domain types | — |
| `packages/config` | Shared tooling configuration | — |

The stack uses npm workspaces and Turborepo, Next.js 15, React 19, Tailwind CSS, NestJS 10, Prisma 5, and PostgreSQL. Integrations include OpenAI, Cloudflare R2/S3-compatible storage, Resend, and optional YouTube resource discovery. Docker Compose supplies local PostgreSQL and Redis.

## Local development

### Prerequisites

- Node.js 20 or newer; production deployments use Node.js 24.
- npm 10 or newer.
- Docker with Docker Compose for the local database and Redis.

Run the following commands from the repository root.

### 1. Install and configure

```sh
npm ci
cp .env.example apps/api/.env
cp .env.example packages/db/.env
```

The API loads environment files from its workspace. Prisma commands run from `packages/db`, so that workspace also needs `DATABASE_URL`. Use the same local database URL in both files.

In `apps/api/.env`, replace the sample JWT secrets with distinct random values. For local disk uploads, leave `R2_ACCESS_KEY_ID` and `R2_ENDPOINT` blank. Configure valid R2 credentials and an endpoint when using object storage.

Configure both frontend workspaces:

```sh
printf '%s\n' 'NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1' > apps/nightklass/.env.local
printf '%s\n' 'NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1' > apps/web/.env.local
```

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API and Prisma | PostgreSQL connection |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | API | Access and refresh token signing |
| `APP_URL` | API | Comma-separated allowed frontend origins |
| `API_URL` | API | Public API origin, including local upload URLs |
| `NEXT_PUBLIC_API_URL` | Frontends | Full API base URL, including `/api/v1` |
| `API_URL_INTERNAL` | Nightklass server | Optional server-side API base URL; falls back to `NEXT_PUBLIC_API_URL` |
| `OPENAI_API_KEY` | API | AI learning and assessment workflows |
| `R2_*` | API | Private object storage (required in production; `R2_PUBLIC_URL` must be unset) |
| `RESEND_API_KEY`, `EMAIL_FROM` | API | Password-reset and verification email |
| `PASSWORD_RESET_URL` | API | Frontend reset page, e.g. `https://nightklass.com/reset-password` |
| `TRUST_PROXY` | API | Reverse-proxy hop count (Railway: `1`) for per-address rate limits |
| `EXAM_ACCESS`, `EXAM_NEW_ATTEMPTS_PAUSED` | API | Pilot cohort gate and new-mock brake (also adjustable in Admin → Operations) |
| `AI_PAUSED`, `AI_*_BUDGET_USD`, `AI_USER_DAILY_REQUESTS` | API | AI kill switch and budgets (also adjustable in Admin → Operations) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Nightklass | Contact shown in the privacy notice |
| `YOUTUBE_API_KEY` | API | Optional recommended video discovery |

In production the API refuses to start with missing or unsafe security configuration. See [the release and operations runbook](docs/nightklass/08-release-and-operations.md) for defaults, migrations, pilot activation, monitoring and restore.

The default local CORS origins are `http://localhost:3000,http://localhost:3002`. AI, email, and external resource features require their respective credentials. Keep secret keys on the API server; do not put them in `NEXT_PUBLIC_*` variables.

### 2. Prepare the database

```sh
docker compose up -d postgres redis
npm run db:generate --workspace @assessiq/db
npm run db:migrate:deploy --workspace @assessiq/db
npm run build --workspace @assessiq/types
```

`db:migrate:deploy` applies the migrations already committed to the repository. When developing a schema change, use `npm run db:migrate --workspace @assessiq/db` to create a new migration.

The generated Prisma client lives in `packages/db/generated/client` and is not committed. Shared types resolve from `packages/types/dist`, which must be built before starting the apps.

### 3. Start the apps

```sh
npm run dev
```

Or run individual workspaces in separate terminals:

```sh
npm run dev --workspace @assessiq/api
npm run dev --workspace @assessiq/nightklass
npm run dev --workspace @assessiq/web
```

API documentation is available at `http://localhost:3001/api/docs`.

## Nightklass administration

Administration uses existing active standalone Nightklass accounts. There are no default administrator credentials.

To provision the **first owner**, run the bootstrap script from a trusted shell with `DATABASE_URL` exported for the intended database:

```sh
node packages/db/scripts/bootstrap-nightklass-admin.cjs owner@example.com
```

The script grants owner access, records an audit event, and revokes existing refresh sessions. It refuses to run after administration has been provisioned. Subsequent access changes go through the owner dashboard.

Sign in at `/admin/login` using the account’s existing password. See [the administration guide](apps/nightklass/ADMIN.md) for permissions, security boundaries, deployment details, and integration testing.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start workspace development servers |
| `npm run build` | Build applications and shared packages |
| `npm run type-check` | Run workspace TypeScript checks |
| `npm run test --workspace @assessiq/api` | Run API unit tests |
| `npm run db:generate --workspace @assessiq/db` | Regenerate the Prisma client |
| `npm run db:migrate --workspace @assessiq/db` | Create and apply a development migration |
| `npm run db:migrate:deploy --workspace @assessiq/db` | Apply committed migrations |
| `npm run db:studio` | Open Prisma Studio |

The existing lint scripts need configuration work: the API workspace lacks a working ESLint executable, and the frontend scripts invoke Next.js lint setup. Do not treat `npm run lint` as a configured CI gate yet; CI relies on type checks and the test suites.

Admin integration tests exercise a real API and PostgreSQL database. They require a disposable database named `nightklass_admin_test`; apply the migrations first and follow [ADMIN.md](apps/nightklass/ADMIN.md). They add fixtures and must not run against production.

## Deployment

Nightklass and KwikEval are hosted on Vercel; the shared API and PostgreSQL database are hosted on Railway. The current production workflow deploys changes pushed to `main`.

- **Vercel:** use `apps/nightklass` or `apps/web` as the project root. Set `NEXT_PUBLIC_API_URL` to the live API base URL, including `/api/v1`. Nightklass can additionally use `API_URL_INTERNAL` for its server-side admin proxy.
- **Railway API:** use the repository root as the Docker build context and `apps/api/Dockerfile` as the Dockerfile. The image generates Prisma, builds shared types and the API, then applies committed migrations before starting the server.
- **Production configuration:** set database and authentication secrets, allowed frontend origins, provider credentials, and persistent object storage in the hosting environment. Use HTTPS for admin sessions.

Review migrations before merging production changes. Use `prisma migrate deploy` for production, rather than `db push` or development migration commands. Deployment-specific credentials belong in the hosting platform, never in the repository.

See [Nightklass administration](apps/nightklass/ADMIN.md) and [Nightklass SEO](apps/nightklass/SEO.md) for additional operational guidance.

## Contributing

Keep changes within the relevant workspace and preserve the separation between personal learning and institutional records. Enforce authorization and tenant boundaries on the API, even when frontend controls hide an action.

For changes, run the relevant TypeScript checks, builds, and tests. Include Prisma migrations when changing the database schema. Do not commit environment files, credentials, database exports, uploaded learner materials, generated Prisma clients, or build output.

If dependencies fail to resolve, rebuild `@assessiq/types` and regenerate the Prisma client. If the API cannot connect to PostgreSQL, check Docker Compose and confirm the API and Prisma environment files point to the same database.
