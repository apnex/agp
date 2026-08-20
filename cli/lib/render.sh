#!/usr/bin/env bash
set -uo pipefail

if (( $# != 1 )); then
  printf '%s\n' "agpctl: renderer requires one whitelisted projection name" >&2
  exit 7
fi

projection_name=$1
case "${projection_name}" in
  connections.list)
    columns_json='[
      "session_id",
      "remote_node",
      "direction",
      "state",
      "uptime",
      "ttl",
      "last_event"
    ]'
    ;;
  routes.list)
    columns_json='[
      "selected",
      "endpoint",
      "route_class",
      "learned_kind",
      "next_hop",
      "origin_node",
      "path",
      "eligible",
      "reason"
    ]'
    ;;
  *)
    printf 'agpctl: unsupported renderer projection: %s\n' "${projection_name}" >&2
    exit 7
    ;;
esac

tsv=$(
  jq -r \
    --argjson columns "${columns_json}" \
    '
      def clean:
        if . == null then ""
        elif type == "string" then .
        else tostring
        end
        | gsub(
            "[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]";
            " "
          );

      if type != "array" then
        error("renderer input must be an array")
      else
        ($columns | map(ascii_upcase) | @tsv),
        (.[] as $row | [$columns[] | ($row[.] | clean)] | @tsv)
      end
    '
)
if (( $? != 0 )); then
  exit 7
fi

formatted=${tsv}
if command -v column >/dev/null 2>&1; then
  formatted=$(printf '%s\n' "${tsv}" | column -t -s $'\t')
  if (( $? != 0 )); then
    exit 7
  fi
fi

header=true
while IFS= read -r line; do
  if [[ ${header} == true ]]; then
    if [[ -t 1 && -z ${NO_COLOR+x} ]]; then
      printf '\033[36m%s\033[0m\n' "${line}"
    else
      printf '%s\n' "${line}"
    fi
    header=false
  else
    printf '%s\n' "${line}"
  fi
done <<< "${formatted}"
