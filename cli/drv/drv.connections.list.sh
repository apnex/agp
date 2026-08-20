#!/usr/bin/env bash
set -uo pipefail

AGP_CLI_ROOT=${BASH_SOURCE[0]%/drv/*}
source "${AGP_CLI_ROOT}/lib/http.sh"

if (( $# != 1 )); then
  printf '%s\n' "agpctl: connections driver requires one management URL" >&2
  exit 2
fi

agp_http_get_json "$1" "/v1/connections" "ConnectionList" "list"
