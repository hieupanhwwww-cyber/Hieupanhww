#!/bin/bash
# Chạy một script kiểm thử bản thật: tests/e2e/run.sh nav-overlap.mjs [tham số]
cd "$(dirname "$0")" && NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/root/.ccr/ca-bundle.crt} node "$@" 2>&1 | grep -vE "UNDICI|trace-warnings"; exit ${PIPESTATUS[0]}
