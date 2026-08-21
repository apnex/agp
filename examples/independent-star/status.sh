#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/process-lib.sh"

usage() {
  printf 'usage: ./status.sh <hub|alpha|beta|all>\n'
}

status_profile() {
  local profile="$1"
  local pid_file log_file pid ready

  pid_file="$(pid_file_for "$profile")"
  log_file="$(log_file_for "$profile")"
  if [[ ! -e "$pid_file" ]]; then
    printf '%-5s DOWN    no PID file (log %s)\n' "$profile" "$log_file"
    return 1
  fi
  if ! pid="$(read_pid_file "$pid_file")"; then
    printf '%-5s UNKNOWN invalid PID file %s\n' "$profile" "$pid_file"
    return 1
  fi
  if ! process_exists "$pid"; then
    printf '%-5s DOWN    stale PID %s (log %s)\n' "$profile" "$pid" "$log_file"
    return 1
  fi
  if ! is_owned_process "$profile" "$pid"; then
    printf '%-5s UNKNOWN PID %s belongs to another process; no action taken\n' \
      "$profile" "$pid"
    return 1
  fi

  printf '%-5s RUNNING PID %-7s log %s\n' \
    "$profile" "$pid" "$log_file"
  ready="$(grep -F 'AGP_NODE_READY ' "$log_file" 2>/dev/null | tail -n 1 || true)"
  if [[ -n "$ready" ]]; then
    printf '      %s\n' "$ready"
  fi
}

if (($# != 1)); then
  usage >&2
  exit 2
fi

target="$1"
if [[ "$target" == "all" ]]; then
  status=0
  while IFS= read -r profile; do
    status_profile "$profile" || status=1
  done < <(profiles)
  exit "$status"
fi

if ! known_profile "$target"; then
  usage >&2
  exit 2
fi

status_profile "$target"
