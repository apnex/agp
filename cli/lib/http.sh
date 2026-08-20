#!/usr/bin/env bash

agp_http_get_json() {
  local management_url=$1
  local resource_path=$2
  local expected_kind=$3
  local expected_shape=$4

  if ! agp_http_url_is_loopback "${management_url}"; then
    printf '%s\n' "agpctl: driver rejected a non-loopback management URL" >&2
    return 2
  fi

  local response_and_status
  response_and_status=$(
    curl \
      --disable \
      --silent \
      --show-error \
      --connect-timeout 2 \
      --max-time 7 \
      --noproxy '*' \
      --proto '=http' \
      --header 'Accept: application/json' \
      --write-out $'\nAGP_HTTP_STATUS:%{http_code}' \
      --url "${management_url}${resource_path}"
  )
  local curl_status=$?
  if (( curl_status != 0 )); then
    printf '%s\n' "agpctl: management endpoint is unavailable or timed out" >&2
    return 4
  fi

  local status_marker=${response_and_status##*$'\n'}
  if [[ ! ${status_marker} =~ ^AGP_HTTP_STATUS:([0-9]{3})$ ]]; then
    printf '%s\n' "agpctl: curl did not return a management HTTP status" >&2
    return 4
  fi
  local http_status=${BASH_REMATCH[1]}
  local response_body=${response_and_status%$'\n'"${status_marker}"}

  if [[ ${http_status} != 200 ]]; then
    printf 'agpctl: management endpoint returned HTTP %s\n' "${http_status}" >&2
    return 5
  fi

  local shape_filter
  case "${expected_shape}" in
    list)
      shape_filter='(.items | type == "array")'
      ;;
    routes)
      shape_filter='
        (.candidates | type == "array") and
        (.selected | type == "array")
      '
      ;;
    *)
      printf '%s\n' "agpctl: internal driver shape is unsupported" >&2
      return 6
      ;;
  esac

  if ! printf '%s\n' "${response_body}" |
    jq -e \
      --arg expected_kind "${expected_kind}" \
      "
        .apiVersion == \"agp.management/v1\" and
        .kind == \$expected_kind and
        (.meta | type == \"object\") and
        (.meta.nodeId | type == \"string\") and
        (.meta.instanceId | type == \"string\") and
        (.meta.capturedAt | type == \"string\") and
        (.meta.revision | type == \"string\") and
        (${shape_filter})
      " >/dev/null; then
    printf '%s\n' "agpctl: response is not expected-version management JSON" >&2
    return 6
  fi

  printf '%s\n' "${response_body}"
}

agp_http_url_is_loopback() {
  local candidate=$1
  local port
  if [[ ${candidate} =~ ^http://127[.]0[.]0[.]1:([0-9]{1,5})$ ]]; then
    port=${BASH_REMATCH[1]}
  elif [[ ${candidate} =~ ^http://\[::1\]:([0-9]{1,5})$ ]]; then
    port=${BASH_REMATCH[1]}
  else
    return 1
  fi
  local port_value=$((10#${port}))
  (( port_value >= 1 && port_value <= 65535 ))
}
