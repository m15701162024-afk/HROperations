#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current)"
if [ -z "$branch" ]; then
  echo "No current branch detected."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Missing git remote 'origin'. Add the HRAssistant repository first:"
  echo "git remote add origin <HRAssistant仓库地址>"
  exit 1
fi

npm run test
npm run build

if ! git diff --quiet || ! git diff --cached --quiet; then
  git add .
  git commit -m "feat: build recruitment operations assistant"
fi

git push -u origin "$branch"
