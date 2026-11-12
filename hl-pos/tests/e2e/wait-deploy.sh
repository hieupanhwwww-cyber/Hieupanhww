#!/bin/bash
# Đợi Netlify đưa bản mới lên: tests/e2e/wait-deploy.sh <đường dẫn> <chuỗi phải có trong HTML>
URL="${APP_URL:-https://profound-taiyaki-e22af3.netlify.app}$1"
for i in $(seq 1 60); do
  if curl -sS "$URL" | grep -q -- "$2"; then echo "bản mới đã lên"; exit 0; fi
  sleep 10
done
echo "QUÁ 10 PHÚT chưa thấy bản mới"; exit 1
