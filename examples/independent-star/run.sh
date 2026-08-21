#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/process-lib.sh"

usage() {
  cat <<'EOF'
usage:
  ./run.sh <hub|alpha|beta> [--foreground] [node options]
  ./run.sh all

Node options:
  --management-port PORT
  --ws-host HOST             hub only
  --ws-port PORT             hub only
  --hub-url ws://HOST:PORT/agp
                              alpha or beta only
EOF
}

start_profile() {
  local profile="$1"
  shift
  local pid_file log_file pid attempt

  mkdir -p -m 700 -- "$STATE_DIR"
  pid_file="$(pid_file_for "$profile")"
  log_file="$(log_file_for "$profile")"

  if [[ -e "$pid_file" ]]; then
    if ! pid="$(read_pid_file "$pid_file")"; then
      printf '%s: invalid PID file; refusing to overwrite %s\n' \
        "$profile" "$pid_file" >&2
      return 1
    fi
    if is_owned_process "$profile" "$pid"; then
      printf '%s: already running (PID %s, log %s)\n' \
        "$profile" "$pid" "$log_file"
      return 0
    fi
    if process_exists "$pid"; then
      printf '%s: PID %s belongs to another process; refusing to start\n' \
        "$profile" "$pid" >&2
      return 1
    fi
    mv -- "$pid_file" "${pid_file}.stale.$(date -u +%Y%m%dT%H%M%SZ).${BASHPID}"
  fi

  rotate_log "$log_file"
  nohup node "$ENTRYPOINT" "$profile" "$@" >>"$log_file" 2>&1 &
  pid=$!
  printf '%s\n' "$pid" > "${pid_file}.new.${BASHPID}"
  mv -- "${pid_file}.new.${BASHPID}" "$pid_file"

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    if grep -Fq 'AGP_NODE_READY ' "$log_file" 2>/dev/null; then
      printf '%s: started (PID %s, log %s)\n' "$profile" "$pid" "$log_file"
      return 0
    fi
    if ! process_exists "$pid"; then
      wait "$pid" 2>/dev/null || true
      mv -- "$pid_file" \
        "${pid_file}.failed.$(date -u +%Y%m%dT%H%M%SZ).${BASHPID}"
      printf '%s: exited before readiness; log follows\n' "$profile" >&2
      tail -n 20 -- "$log_file" >&2
      return 1
    fi
    sleep 0.1
  done

  if is_owned_process "$profile" "$pid"; then
    kill -TERM "$pid"
  fi
  printf '%s: readiness timed out; sent SIGTERM to PID %s (log %s)\n' \
    "$profile" "$pid" "$log_file" >&2
  return 1
}

if (($# == 0)); then
  usage >&2
  exit 2
fi

target="$1"
shift

if [[ "$target" == "all" ]]; then
  if (($# != 0)); then
    printf 'run.sh: all takes no options; use environment overrides\n' >&2
    exit 2
  fi
  start_profile hub
  start_profile alpha
  start_profile beta
  exit 0
fi

if ! known_profile "$target"; then
  usage >&2
  exit 2
fi

foreground=false
if [[ "${1-}" == "--foreground" ]]; then
  foreground=true
  shift
fi

if [[ "$foreground" == true ]]; then
  exec node "$ENTRYPOINT" "$target" "$@"
fi

start_profile "$target" "$@"
