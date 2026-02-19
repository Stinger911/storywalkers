.DEFAULT_GOAL := help
.PHONY: help env install cc format isort fix-unused-imports check-unused-imports check tests build-frontend build-backend deploy-frontend deploy-backend deploy-frontend-dev deploy-backend-dev deploy-dev

help: ## this help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m%s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n\n"

TOPTARGETS := all clean

env: ## create the virtual environment
	uv venv --python 3.13

install: ## install the dependencies
	@(cd backend && \
	uv lock --upgrade && uv sync --all-groups)

format: ## format the codebase
	@(cd backend && \
	uv run --group dev ruff format .)

isort: ## sort imports
	@(cd backend && \
	uv run --group dev ruff check --select I --fix .)

fix-unused-imports: ## fix unused imports
	@(cd backend && \
	uv run --group dev ruff check --select F401 --fix .)

check-unused-imports: ## check for unused imports
	@(cd backend && \
	uv run --group dev ruff check --select F401 .)

check: ## check code style
	@(cd backend && \
	uv run --group dev ruff format --check .)
	make check-unused-imports

cc: ## clean code
	make fix-unused-imports
	make format
	make isort

tests-frontend: ## run frontend tests
	@echo "🧪 Running frontend tests..."
	(cd frontend && \
	npm install && \
	npm run test \
	)
	@echo "✅ Frontend tests passed!"

tests-backend: ## run backend tests
	@echo "🐍 Running backend tests..."
	(cd backend && \
	uv run --group dev pytest tests \
	)
	@echo "✅ Backend tests passed!"

tests-firestore: ## run firestore rules tests
	@echo "🔥 Running firestore rules tests..."
	(cd tests/firebase && \
	npm install && \
	npm run test:emu \
	)
	@echo "✅ Firestore rules tests passed!"

tests: ## run tests
	@make tests-frontend
# 	@make tests-firestore
	@make tests-backend
	@echo "🚀 All tests passed!"

dev: ## run the development servers
	@(cd backend && \
	uv run --group dev granian app.main:app --reload --host 0.0.0.0 --port 8080)

build-frontend: ## build frontend for hosting
	@./scripts/ci/build-frontend.sh

build-backend: ## build backend container image
	@./scripts/ci/build-backend.sh

deploy-frontend: ## deploy frontend hosting + firestore rules
	@./scripts/ci/deploy-frontend.sh

deploy-backend: ## deploy backend to Cloud Run
	@./scripts/ci/deploy-backend.sh

deploy-frontend-dev: ## deploy frontend to Firebase Hosting dev channel
	@./scripts/ci/deploy-frontend-dev.sh

deploy-backend-dev: ## deploy backend to Cloud Run dev service
	@./scripts/ci/deploy-backend-dev.sh

deploy-dev: ## one-step dev deployment (backend + frontend)
	@make deploy-backend-dev
	@make deploy-frontend-dev
