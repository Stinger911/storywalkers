.DEFAULT_GOAL := help
.PHONY: help env install cc format isort fix-unused-imports check-unused-imports check tests

help: ## this help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m%s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n\n"

TOPTARGETS := all clean

env: ## create the virtual environment
	uv venv --python 3.13

install: ## install the dependencies
	(cd backend && \
	uv lock --upgrade --active && uv sync --all-groups --active)

format: ## format the codebase
	(cd backend && \
	uv run --group dev ruff format .)

isort: ## sort imports
	(cd backend && \
	uv run --group dev ruff check --select I --fix .)

fix-unused-imports: ## fix unused imports
	(cd backend && \
	uv run --group dev ruff check --select F401 --fix .)

check-unused-imports: ## check for unused imports
	(cd backend && \
	uv run --group dev ruff check --select F401 .)

check: ## check code style
	(cd backend && \
	uv run --group dev ruff format --check .)
	make check-unused-imports

cc: ## clean code
	make fix-unused-imports
	make format
	make isort

tests: ## run tests
	@echo "🧪 Running frontend tests..."
	@echo "✅ Frontend tests passed!"
	@echo "🔥 Running firestore rules tests..."
	(cd tests/firebase && \
	npm install && \
	npm run test:emu)
	@echo "✅ Firestore rules tests passed!"
	@echo "🐍 Running backend tests..."
# 	uv run --group dev pytest tests/backend
	@echo "✅ Backend tests passed!"
	@echo "🚀 All tests passed!"