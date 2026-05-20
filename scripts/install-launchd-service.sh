#!/usr/bin/env bash
set -euo pipefail

label="com.hroperations.assistant"
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plist_dir="$HOME/Library/LaunchAgents"
plist_file="$plist_dir/$label.plist"
node_path="$(command -v node)"
npm_path="$(command -v npm)"

mkdir -p "$plist_dir" "$project_dir/logs"

cat > "$plist_file" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>WorkingDirectory</key>
  <string>$project_dir</string>
  <key>ProgramArguments</key>
  <array>
    <string>$npm_path</string>
    <string>run</string>
    <string>serve</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(dirname "$node_path"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    <key>HR_ASSISTANT_API_PORT</key>
    <string>5173</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$project_dir/logs/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$project_dir/logs/launchd.err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$plist_file" >/dev/null 2>&1 || true
launchctl load "$plist_file"
launchctl start "$label" >/dev/null 2>&1 || true

echo "已安装并启动 launchd 服务：$label"
echo "访问地址：http://localhost:5173/"
echo "日志目录：$project_dir/logs"
