.PHONY: setup backend frontend build-frontend start-backend start-frontend mobile-get mobile-analyze mobile-test mobile-ios-build migrate-backend worker openapi sdk docker-up docker-down docker-logs import-catalog-csv import-catalog-local

setup:
	./scripts/setup_backend.sh
	./scripts/setup_frontend.sh

backend:
	./scripts/run_backend.sh

frontend:
	./scripts/run_frontend.sh

build-frontend:
	./scripts/build_frontend.sh

start-backend:
	./scripts/start_backend_prod.sh

migrate-backend:
	cd backend && ../.venv/bin/alembic upgrade head

worker:
	. .venv/bin/activate && cd backend && rq worker default

openapi:
	. .venv/bin/activate && python3 scripts/export_openapi.py

sdk: openapi
	./scripts/generate_sdks.sh

start-frontend:
	./scripts/start_frontend_prod.sh

mobile-get:
	cd mobile && flutter pub get

mobile-analyze:
	cd mobile && flutter analyze

mobile-test:
	cd mobile && flutter test

mobile-ios-build:
	cd mobile && flutter build ios --debug --no-codesign

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f --tail=150

import-catalog-csv:
	. .venv/bin/activate && python3 scripts/import_catalog_csv.py --csv "$(CSV)"

import-catalog-local:
	. .venv/bin/activate && python3 scripts/import_catalog_csv.py --csv "backend/app/db/database_question.csv"
