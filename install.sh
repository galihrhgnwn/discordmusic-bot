#!/bin/bash

# Aether's Discord Bot - Installation & Startup Script

echo "==========================================="
echo "   Aether's Discord Bot Setup & Launcher   "
echo "==========================================="
echo ""

# Check for node modules
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install
fi

echo ""
echo "Please select how you want to run Aether's:"
echo "1) Run Bot Only (Minimal RAM Usage)"
echo "2) Run Both (Bot + Web Dashboard)"
echo ""
read -p "Enter your choice (1 or 2): " choice

echo ""

if [ "$choice" == "1" ]; then
    echo "Building Next.js (Minimal)..."
    npm run build
    echo "[*] Starting Bot Only..."
    npm run bot
elif [ "$choice" == "2" ]; then
    echo "Building Next.js..."
    npm run build
    echo "Starting services..."
    npm run start
else
    echo "Invalid choice. Exiting."
    exit 1
fi
