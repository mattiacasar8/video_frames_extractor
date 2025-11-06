#!/bin/bash

# Video Frame Extractor - Launcher Script
# Double-click this file to start the app

echo "🎬 Starting Video Frame Extractor..."
echo ""

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 8000 is already in use."
    echo "Opening browser to existing server..."
    open http://localhost:8000
    exit 0
fi

echo "📂 Working directory: $DIR"
echo "🌐 Starting local server on http://localhost:8000"
echo ""
echo "✅ Server is running!"
echo "🌍 Opening browser..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Video Frame Extractor is now running at:"
echo "  http://localhost:8000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📌 To stop the server: Press Ctrl+C in this window"
echo ""

# Open browser after a short delay
sleep 2
open http://localhost:8000

# Start Python HTTP server
python3 -m http.server 8000
