#!/usr/bin/env bash

agp_command_usage() {
  local command_name=$1
  printf 'usage: agpctl %s [--json] [--url URL]\n' "${command_name}" >&2
}

agp_require_dependency() {
  local dependency=$1
  if ! command -v "${dependency}" >/dev/null 2>&1; then
    printf 'agpctl: missing required dependency: %s\n' "${dependency}" >&2
    return 3
  fi
}

agp_parse_options() {
  local command_name=$1
  local mode_name=$2
  local url_name=$3
  shift 3

  local parsed_mode=table
  local parsed_url=${AGP_MANAGEMENT_URL-}
  local saw_json=false
  local saw_url=false

  while (( $# > 0 )); do
    case "$1" in
      --json)
        if [[ ${saw_json} == true ]]; then
          printf 'agpctl: --json may be supplied only once\n' >&2
          agp_command_usage "${command_name}"
          return 2
        fi
        saw_json=true
        parsed_mode=json
        shift
        ;;
      --url)
        if [[ ${saw_url} == true || $# -lt 2 ]]; then
          printf 'agpctl: --url requires exactly one value\n' >&2
          agp_command_usage "${command_name}"
          return 2
        fi
        saw_url=true
        parsed_url=$2
        shift 2
        ;;
      -h|--help)
        agp_command_usage "${command_name}"
        return 64
        ;;
      *)
        printf 'agpctl: unsupported argument: %s\n' "$1" >&2
        agp_command_usage "${command_name}"
        return 2
        ;;
    esac
  done

  local normalized_url
  if ! normalized_url=$(agp_normalize_management_url "${parsed_url}"); then
    printf '%s\n' \
      "agpctl: management URL must be an explicit loopback HTTP URL with a valid port" >&2
    return 2
  fi

  printf -v "${mode_name}" '%s' "${parsed_mode}"
  printf -v "${url_name}" '%s' "${normalized_url}"
}

agp_normalize_management_url() {
  local candidate=$1
  local port

  if [[ ${candidate} =~ ^http://127[.]0[.]0[.]1:([0-9]{1,5})/?$ ]]; then
    port=${BASH_REMATCH[1]}
  elif [[ ${candidate} =~ ^http://\[::1\]:([0-9]{1,5})/?$ ]]; then
    port=${BASH_REMATCH[1]}
  else
    return 1
  fi

  local port_value=$((10#${port}))
  if (( port_value < 1 || port_value > 65535 )); then
    return 1
  fi
  printf '%s' "${candidate%/}"
}

agp_run_command() {
  local command_name=$1
  local driver_path=$2
  local template_path=$3
  shift 3

  agp_require_dependency curl || return $?
  agp_require_dependency jq || return $?

  local output_mode
  local management_url
  agp_parse_options \
    "${command_name}" \
    output_mode \
    management_url \
    "$@"
  local parse_status=$?
  if (( parse_status == 64 )); then
    return 0
  fi
  if (( parse_status != 0 )); then
    return "${parse_status}"
  fi

  local payload
  payload=$("${driver_path}" "${management_url}")
  local driver_status=$?
  if (( driver_status != 0 )); then
    return "${driver_status}"
  fi

  if [[ ${output_mode} == json ]]; then
    if ! printf '%s\n' "${payload}" | jq .; then
      printf '%s\n' "agpctl: failed to format management JSON" >&2
      return 7
    fi
    return 0
  fi

  local projected
  projected=$(
    printf '%s\n' "${payload}" |
      jq -f "${template_path}"
  )
  local template_status=$?
  if (( template_status != 0 )); then
    printf '%s\n' "agpctl: management table projection failed" >&2
    return 7
  fi

  if ! printf '%s\n' "${projected}" |
    "${AGP_CLI_ROOT}/lib/render.sh" "${command_name}"; then
    printf '%s\n' "agpctl: management table rendering failed" >&2
    return 7
  fi
}
