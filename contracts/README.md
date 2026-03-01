# API Contracts

- `openapi.json` is the single source of truth for API contracts.
- Primary versioned API prefix: `/api/v1`.
- Legacy (unversioned) routes are temporarily enabled for backward compatibility.

## Contract-first workflow

1. Update backend schemas/endpoints.
2. Export OpenAPI:
   - `python3 scripts/export_openapi.py`
3. Regenerate SDK/contracts:
   - `./scripts/generate_sdks.sh`
4. Update frontend/mobile integrations against generated contracts.

## Backward compatibility policy

- Additive changes in `/api/v1` are allowed.
- Breaking changes require:
  - new version (`/api/v2`) or
  - deprecation window and migration notice.
- Legacy unversioned routes should be removed only after clients migrate.
