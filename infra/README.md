# Infra Zone

Infrastructure-related assets and playbooks:

- Runtime compose stack: `../docker-compose.yml`
- Edge proxy config: `../deploy/Caddyfile`
- CI config: `../.sourcecraft/ci.yaml`

Recommended next step:
- move environment-specific deployment manifests into this directory
  (`infra/dev`, `infra/staging`, `infra/prod`) while keeping root wrappers.
