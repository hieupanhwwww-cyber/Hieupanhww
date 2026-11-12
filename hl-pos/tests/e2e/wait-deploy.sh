#!/bin/bash
# Đợi Netlify chạy đúng commit đang ở HEAD (trang có thẻ meta hl-build = 7 ký tự đầu của commit).
URL="${APP_URL:-https://profound-taiyaki-e22af3.netlify.app}/login"
SHA=$(git rev-parse --short=7 HEAD)
for i in $(seq 1 50); do
  if curl -sS "$URL" | grep -q "hl-build\" content=\"$SHA\""; then echo "bản $SHA đã lên"; exit 0; fi
  sleep 10
done
echo "QUÁ 8 PHÚT chưa thấy bản $SHA"; exit 1
