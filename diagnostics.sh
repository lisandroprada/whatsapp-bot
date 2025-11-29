#!/bin/bash

echo "=== WhatsApp Bot Diagnostics ==="
echo ""

# 1. Check if server is running
echo "1. Server Status:"
if lsof -i :3000 &> /dev/null; then
    echo "   ✅ Server is running on port 3000"
else
    echo "   ❌ Server is NOT running"
    exit 1
fi

# 2. Check WhatsApp connection status
echo ""
echo "2. WhatsApp Connection Status:"
curl -s http://localhost:3000/whatsapp/status | jq '.' || echo "   ⚠️  Could not fetch status"

# 3. Check environment variables
echo ""
echo "3. Environment Variables:"
if [ -f .env ]; then
    echo "   GEMINI_API_KEY: $(grep GEMINI_API_KEY .env | cut -d'=' -f2 | head -c 20)..."
    echo "   CORE_BACKEND_URL: $(grep CORE_BACKEND_URL .env | cut -d'=' -f2)"
else
    echo "   ❌ .env file not found"
fi

# 4. Check MongoDB connection
echo ""
echo "4. MongoDB Status:"
if pgrep -x "mongod" > /dev/null; then
    echo "   ✅ MongoDB is running"
else
    echo "   ⚠️  MongoDB might not be running"
fi

# 5. Recent chats
echo ""
echo "5. Recent Chats (via API):"
curl -s http://localhost:3000/whatsapp/chats -H "x-api-key: my-secret-api-key" | jq '.[-3:]' || echo "   ⚠️  Could not fetch chats"

echo ""
echo "=== Diagnostics Complete ==="
