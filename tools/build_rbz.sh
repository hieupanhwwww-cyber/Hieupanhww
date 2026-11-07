#!/usr/bin/env bash
# Đóng gói RBZ: loader .rb ở gốc + thư mục extension, không cache/tạm/đường dẫn máy phát triển.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in hl_tumodule.rb $(find hl_tumodule -name '*.rb'); do ruby -c "$f" >/dev/null; done
out=dist/hl_tumodule.rbz
rm -f "$out"
zip -q -r -X "$out" hl_tumodule.rb hl_tumodule -x '*.DS_Store' '*.tmp' '*~'
unzip -l "$out" | tail -n +1
