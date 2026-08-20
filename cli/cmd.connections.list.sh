#!/usr/bin/env bash
set -uo pipefail

AGP_CLI_ROOT=${BASH_SOURCE[0]%/*}
if [[ ${AGP_CLI_ROOT} == "${BASH_SOURCE[0]}" ]]; then
  AGP_CLI_ROOT=.
fi
source "${AGP_CLI_ROOT}/lib/command.sh"

agp_run_command \
  "connections.list" \
  "${AGP_CLI_ROOT}/drv/drv.connections.list.sh" \
  "${AGP_CLI_ROOT}/tpl/tpl.connections.list.jq" \
  "$@"
