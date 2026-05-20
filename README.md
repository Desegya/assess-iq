# AssessIQ

AssessIQ is an AI-assisted learning and assessment platform for schools, training institutions, exam bodies, teachers, and students.

The current codebase is an early MVP monorepo. It already has authentication, organization registration, course management, document upload, document text extraction, shared domain types, and a Prisma data model for the larger product. Several future modules are scaffolded but not fully implemented yet.

## What The Product Does

AssessIQ is intended to help institutions:

- Register an organization and admin account.
- Manage teachers, students, courses, and topics.
- Upload PDFs, Word documents, and text notes.
- Extract document text for AI workflows.
- Generate question banks from uploaded material.
- Create assessments from approved questions.
- Let students take timed assessments.
- Track attempts, scores, and academic integrity events.
- Generate study materials such as flashcards.
- Monitor AI usage and assessment analytics.

## Current Implementation Status

Implemented today:

- Organization registration with an `ORG_ADMIN` user.
- Login, refresh token rotation, logout, and current-user lookup.
- JWT authentication and role-based access guards.
- Course create/read/update/delete APIs.
- Document upload APIs for PDF, DOC, DOCX, and TXT files.
- Cloudflare R2-compatible storage service.
- Text extraction from PDF and DOCX files.
- Teacher documents UI with upload, list, and delete.
- Basic auth, teacher, student, and admin portal layouts.
- Shared TypeScript domain types.
- Prisma schema and initial migration.

Scaffolded but mostly empty:

- Users module.
- Organizations module.
- Questions module.
- Assessments module.
- Attempts module.
- AI module.
- Analytics module.
- Study module.
- Admin module.

## Tech Stack

- Monorepo: npm workspaces and Turborepo.
- API: NestJS 10.
- Web: Next.js 15, React 19, Tailwind CSS.
- Database: PostgreSQL.
- ORM: Prisma.
- Cache/queues: Redis and Bull are configured as dependencies.
- Storage: Cloudflare R2 / S3-compatible storage.
- AI provider dependency: Anthropic SDK.
- Email provider dependency: Resend.

## Repository Layout

```text
apps/
  api/                  NestJS REST API
  web/                  Next.js frontend

packages/
  config/               Shared TypeScript and ESLint config
  db/                   Prisma schema, migrations, generated Prisma client wrapper
  types/                Shared enums, entities, and API DTO types

docker-compose.yml      Local PostgreSQL and Redis services
turbo.json              Turborepo task pipeline
```

## Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- Docker, for local PostgreSQL and Redis.

The repo was configured with npm workspaces, so use npm commands from the repository root unless a command explicitly says otherwise.

## Environment Setup

Create a local environment file:

```bash
cp .env.example .env
```

Minimum required values for local API startup:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/assessiq"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="change-me-to-a-long-random-secret"
JWT_REFRESH_SECRET="change-me-to-another-long-random-secret"
APP_URL="http://localhost:3000"
API_URL="http://localhost:3001"
NODE_ENV="development"
```

Document upload also needs working R2/S3-compatible credentials:

```env
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="assessiq-uploads"
R2_PUBLIC_URL="https://your-bucket.r2.dev"
```

AI and email features are not fully implemented yet, but the intended environment variables are:

```env
ANTHROPIC_API_KEY=""
RESEND_API_KEY=""
EMAIL_FROM="AssessIQ <noreply@assessiq.com>"
```

## First-Time Setup

Install dependencies:

```bash
npm install
```

Start local infrastructure:

```bash
docker compose up -d postgres redis
```

Generate the Prisma client:

```bash
npm run db:generate
```

Run database migrations:

```bash
npm run db:migrate
```

Build shared types:

```bash
npm run build --workspace @assessiq/types
```

Start the API and web app in development mode:

```bash
npm run dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- Swagger docs: `http://localhost:3001/api/docs`

## Common Commands

```bash
npm run dev              # Start all dev servers through Turbo
npm run build            # Build all buildable workspaces
npm run type-check       # Type-check workspaces
npm run lint             # Run lint tasks
npm run test             # Run test tasks
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Create/apply a local Prisma migration
npm run db:push          # Push schema changes without creating a migration
npm run db:studio        # Open Prisma Studio
```

Run only the API:

```bash
npm run dev --workspace @assessiq/api
```

Run only the web app:

```bash
npm run dev --workspace @assessiq/web
```

## API Overview

The API uses `/api/v1` as the default prefix.

Implemented routes:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

POST   /api/v1/courses
GET    /api/v1/courses
GET    /api/v1/courses/:id
PATCH  /api/v1/courses/:id
DELETE /api/v1/courses/:id

POST   /api/v1/documents/upload
GET    /api/v1/documents
GET    /api/v1/documents/:id
GET    /api/v1/documents/:id/download-url
DELETE /api/v1/documents/:id
```

Authentication is global by default. Routes marked with `@Public()` are accessible without a token.

## Database Model

The Prisma schema is in:

```text
packages/db/prisma/schema.prisma
```

The data model includes:

- Organizations.
- Users and refresh tokens.
- Courses and topics.
- Documents and extracted text.
- Questions and question metadata.
- Assessments and assessment-question ordering.
- Student attempts and answers.
- Academic integrity events.
- AI usage logs.
- Flashcards.

All major learning and assessment records are scoped by `organizationId` for multi-tenancy.

## Generated Files

The Prisma client is generated into:

```text
packages/db/generated/client
```

That directory is ignored by Git and should be regenerated with:

```bash
npm run db:generate
```

The shared types package builds from `packages/types/src` into `packages/types/dist`. Because apps resolve `@assessiq/types` from `dist`, run this before local development if the directory is missing:

```bash
npm run build --workspace @assessiq/types
```

## Troubleshooting

If the API fails with:

```text
PrismaClientInitializationError: Can't reach database server at localhost:5432
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

If the API or web app cannot resolve `@assessiq/types`, build the shared types package:

```bash
npm run build --workspace @assessiq/types
```

If Prisma types or `@assessiq/db` cannot be resolved, regenerate the Prisma client:

```bash
npm run db:generate
```

## Notes For Contributors

- Keep source edits in `apps/*` and `packages/*`.
- Do not commit local `.env` files.
- Do not commit generated Prisma client files under `packages/db/generated`.
- Prefer committing Prisma migrations under `packages/db/prisma/migrations`.
- The current test surface is minimal; run `npm run type-check` before committing.
