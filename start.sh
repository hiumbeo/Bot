#!/usr/bin/env bash
set -e
echo "========================================================"
echo "  Đang cài đặt thư viện và khởi động Discord Bot..."
echo "  Web Dashboard: http://localhost:3000"
echo "========================================================"
npm install --legacy-peer-deps
npx tsx server.ts
