#!/usr/bin/env bash

EXAMPLE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ENTRYPOINT="$EXAMPLE_DIR/node.mjs"
STATE_DIR="${AGP_EXAMPLE_STATE_DIR:-$EXAMPLE_DIR/.run}"

profiles() {
  printf '%s\n' hub alpha beta
}

known_profile() {
  case "$1" in
    hub|alpha|beta) return 0 ;;
    *) return 1 ;;
  esac
}

pid_file_for() {
  printf '%s/%s.pid\n' "$STATE_DIR" "$1"
}

log_file_for() {
  printf '%s/%s.log\n' "$STATE_DIR" "$1"
}

read_pid_file() {
  local file="$1"
  local pid
  IFS= read -r pid < "$file" || return 1
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  printf '%s\n' "$pid"
}

process_exists() {
  local pid="$1"
  local state
  kill -0 "$pid" 2>/dev/null || return 1
  state="$(ps -o stat= -p "$pid" 2>/dev/null)" || return 1
  [[ "$state" != Z* ]]
}

is_owned_process() {
  local profile="$1"
  local pid="$2"
  local -a arguments=()

  process_exists "$pid" || return 1
  [[ -r "/proc/$pid/cmdline" ]] || return 1
  mapfile -d '' -t arguments < "/proc/$pid/cmdline"
  [[ "${arguments[1]-}" == "$ENTRYPOINT" ]]
  [[ "${arguments[2]-}" == "$profile" ]]
}

rotate_log() {
  local log_file="$1"
  local rotated
  [[ -e "$log_file" ]] || return 0
  rotated="${log_file}.$(date -u +%Y%m%dT%H%M%SZ).${BASHPID}"
  mv -- "$log_file" "$rotated"
}

management_url_for() {
  case "$1" in
    hub) printf 'http://127.0.0.1:%s\n' "${AGP_HUB_MANAGEMENT_PORT:-47101}" ;;
    alpha) printf 'http://127.0.0.1:%s\n' "${AGP_ALPHA_MANAGEMENT_PORT:-47111}" ;;
    beta) printf 'http://127.0.0.1:%s\n' "${AGP_BETA_MANAGEMENT_PORT:-47112}" ;;
  esac
}
