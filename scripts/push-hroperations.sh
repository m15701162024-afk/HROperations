#!/usr/bin/env bash
set -euo pipefail

remote_name="${HR_OPERATIONS_REMOTE_NAME:-origin}"
remote_url="${HR_OPERATIONS_REMOTE_URL:-ssh://git@ssh.github.com:443/m15701162024-afk/HROperations.git}"
branch="$(git branch --show-current)"

if [ -z "$branch" ]; then
  echo "No current branch detected."
  exit 1
fi

if git remote get-url "$remote_name" >/dev/null 2>&1; then
  current_url="$(git remote get-url "$remote_name")"
  if [ "$current_url" != "$remote_url" ]; then
    git remote set-url "$remote_name" "$remote_url"
  fi
else
  git remote add "$remote_name" "$remote_url"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has uncommitted changes. Commit before pushing."
  exit 1
fi

git push -u "$remote_name" "$branch"
