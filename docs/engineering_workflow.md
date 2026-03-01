# Engineering Workflow (Production)

## Repo zones
- `backend/` API, domain logic, migrations, workers
- `frontend/` web client
- `mobile/` Flutter client
- `ml/` model lifecycle artifacts and adapters
- `infra/` deployment/operations playbooks
- `contracts/` OpenAPI and generated SDK contracts

## Branching and releases
- Strategy: trunk-based (`main` is always releasable)
- Small PRs, feature flags for incomplete features
- Required checks before merge:
  - backend: migration check + import/compile + tests
  - frontend: typecheck/build
  - mobile: analyze/tests
- Environments:
  - `dev` -> `staging` -> `production`

## API contract flow
1. Backend change in schemas/endpoints.
2. `make openapi` updates `contracts/openapi.json`.
3. `make sdk` regenerates TypeScript and Dart SDK contracts.
4. Web/mobile update against generated contracts.
5. Breaking changes only with new API version.

## Async and online boundary
- Online API handles quick requests and orchestration.
- Heavy operations should be moved into worker queue (Redis + RQ/Celery):
  - AI generation
  - semantic grading
  - recommendation synthesis
  - TTS pre-generation

## Observability minimum
- Structured logs (JSON)
- Prometheus metrics (`/metrics`)
- Sentry for errors
- Alerting: error-rate, p95 latency, queue depth, DB pool saturation

## Data governance
- Define PII inventory and access policy
- Retention policy by dataset (tests, events, logs)
- Daily backups + periodic restore drills
- Audit log for critical actions (role/group/invitation/session changes)
