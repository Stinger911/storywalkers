#!/usr/bin/env bash
set -euo pipefail

docker build -t "${IMAGE_TAG:-storywalkers-api:local}" -f backend/Dockerfile backend
