#!/usr/bin/env bash
set -uo pipefail

CLI_TEST_ROOT=${BASH_SOURCE[0]%/*}

node --test --test-concurrency=1 --test-reporter=spec \
  "${CLI_TEST_ROOT}"/unit/*.test.js \
  "${CLI_TEST_ROOT}"/contract/*.test.js
