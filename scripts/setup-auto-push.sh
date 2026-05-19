#!/usr/bin/env bash
set -euo pipefail

git config core.hooksPath .githooks
chmod +x .githooks/post-commit scripts/push-hroperations.sh

echo "Auto-push enabled. Future commits will run scripts/push-hroperations.sh."
