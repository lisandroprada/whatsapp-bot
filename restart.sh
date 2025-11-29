#!/bin/bash

echo "🔄 Restarting WhatsApp Bot Server..."

# 1. Kill all node processes on port 3000
echo "1. Killing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "   No processes to kill"

# 2. Clean dist folder
echo "2. Cleaning dist folder..."
rm -rf dist/

# 3. Wait a bit
sleep 2

# 4. Start server
echo "3. Starting server..."
pnpm run start:dev

echo "✅ Server restarted!"
