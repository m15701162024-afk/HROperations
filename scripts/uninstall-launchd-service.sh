#!/usr/bin/env bash
set -euo pipefail

label="com.hroperations.assistant"
plist_file="$HOME/Library/LaunchAgents/$label.plist"

launchctl stop "$label" >/dev/null 2>&1 || true
launchctl unload "$plist_file" >/dev/null 2>&1 || true
rm -f "$plist_file"

echo "已卸载 launchd 服务：$label"
