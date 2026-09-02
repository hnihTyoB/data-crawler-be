# Backend guidance

## Architecture

- Keep the request path `Route -> Controller -> Service -> Repository -> Prisma`.
- Only `*.repository.ts` files may import or call the Prisma client.
- Keep module code under `src/modules/<feature>/`; use the existing route, controller, service, repository, DTO, validation, and test conventions in the nearest module.
- Put shared errors, helpers, constants, storage code, and types under `src/common/` only when they are genuinely reused.
- Mount module routes through `src/routes/index.ts`.

## Data and integrations

- Treat `prisma/schema.prisma` as the database schema source of truth.
- Make schema changes through Prisma migrations and commit the schema and generated migration together.
- Never run `pnpm db:migrate:reset` unless the user explicitly requests destructive local reset.
- Keep queue processors idempotent where retries are possible, and preserve valid crawl-job state transitions.
- Parse and validate external input at boundaries. Reuse Zod validation and the existing application error shape.
- Keep configuration access in `src/config/`; document new variables in `.env.example` without real values.
- Preserve the clean/raw output contract described in `docs/DATA_CONTRACT_V1.md`.

## Generated and runtime files

- Do not hand-edit `dist/`, `coverage/`, `storage/exports/`, or generated Swagger JSON.
- When API annotations or routes change, regenerate Swagger with `pnpm swagger`.

## Validation

Run commands from `data-crawler-be/`.

- Focused test: `pnpm test -- <path-to-test> --runInBand`
- Test suite: `pnpm test -- --runInBand`
- Lint: `pnpm lint`
- Production compile: `pnpm build`

Add colocated Jest tests under `__tests__/` for service, worker, repository-boundary, export, or contract behavior that changes.

