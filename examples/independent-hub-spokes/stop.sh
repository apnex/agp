#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/process-lib.sh"

usage() {
  printf 'usage: ./stop.sh <hub|alpha|beta|all>\n'
}

stop_profile() {
  local profile="$1"
  local pid_file pid attempt archived

  pid_file="$(pid_file_for "$profile")"
  if [[ ! -e "$pid_file" ]]; then
    printf '%s: not running (no PID file)\n' "$profile"
    return 0
  fi
  if ! pid="$(read_pid_file "$pid_file")"; then
    printf '%s: invalid PID file; refusing to act on %s\n' \
      "$profile" "$pid_file" >&2
    return 1
  fi
  if ! process_exists "$pid"; then
    archived="${pid_file}.stale.$(date -u +%Y%m%dT%H%M%SZ).${BASHPID}"
    mv -- "$pid_file" "$archived"
    printf '%s: not running; archived stale PID file as %s\n' \
      "$profile" "$archived"
    return 0
  fi
  if ! is_owned_process "$profile" "$pid"; then
    printf '%s: PID %s is not the expected node process; refusing to signal it\n' \
      "$profile" "$pid" >&2
    return 1
  fi

  kill -TERM "$pid"
  for ((attempt = 0; attempt < 100; attempt += 1)); do
    if ! process_exists "$pid"; then
      mv -- "$pid_file" \
        "${pid_file}.stopped.$(date -u +%Y%m%dT%H%M%SZ).${BASHPID}"
      printf '%s: stopped PID %s\n' "$profile" "$pid"
      return 0
    fi
    sleep 0.1
  done

  printf '%s: PID %s did not stop within 10 seconds; no stronger signal sent\n' \
    "$profile" "$pid" >&2
  return 1
}

if (($# != 1)); then
  usage >&2
  exit 2
fi

target="$1"
if [[ "$target" == "all" ]]; then
  status=0
  for profile in beta alpha hub; do
    stop_profile "$profile" || status=1
  done
  exit "$status"
fi

if ! known_profile "$target"; then
  usage >&2
  exit 2
fi

stop_profile "$target"
