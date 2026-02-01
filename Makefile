.DEFAULT_GOAL := help
.PHONY: help env install cc format isort fix-unused-imports check-unused-imports check

help: ## this help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m%s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n\n"

TOPTARGETS := all clean

env: ## create the virtual environment
	uv venv --python 3.13

install: ## install the dependencies
	uv lock --upgrade && uv sync --all-groups

format: ## format the codebase
	uv run --group dev ruff format .

isort: ## sort imports
	uv run --group dev ruff check --select I --fix .

fix-unused-imports: ## fix unused imports
	uv run --group dev ruff check --select F401 --fix .

check-unused-imports: ## check for unused imports
	uv run --group dev ruff check --select F401 .

check: ## check code style
	uv run --group dev ruff format --check .
	make check-unused-imports

cc: ## clean code
	make fix-unused-imports
	make format
	make isort
