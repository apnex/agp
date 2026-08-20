def clean:
  if . == null then ""
  elif type == "string" then .
  else tostring
  end
  | gsub(
      "[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]";
      " "
    );

def pad2:
  tostring
  | if length < 2 then "0" + . else . end;

def uptime($duration_ms; $state):
  if $state != "Established" or ($duration_ms | type) != "number" then "-"
  else
    (($duration_ms / 1000) | floor) as $total
    | (($total / 3600) | floor) as $hours
    | ((($total % 3600) / 60) | floor) as $minutes
    | ($total % 60) as $seconds
    | "\($hours | pad2):\($minutes | pad2):\($seconds | pad2)"
  end;

def ttl($timers):
  if ($timers | type) != "array" then "-"
  else
    ([$timers[] | select(.name == "hold" and .state == "armed")][0]) as $hold
    | if ($hold | type) != "object"
        or ($hold.remainingMs | type) != "number"
      then "-"
      else
        (($hold.remainingMs / 1000) | ceil) as $remaining
        | if $remaining <= 0 then "0s" else "\($remaining)s" end
      end
  end;

if .apiVersion != "agp.management/v1"
  or .kind != "ConnectionList"
  or (.items | type) != "array"
then
  error("expected agp.management/v1 ConnectionList")
else
  .items
  | map({
      session_id: ((.sessionId // .localSessionId) | clean),
      remote_node: ((.remoteNodeId // "-") | clean),
      direction: (.direction | clean),
      state: (.state | clean),
      uptime: uptime(.establishedDurationMs; .state),
      ttl: ttl(.timers),
      last_event: (.lastTransition.event | clean)
    })
end
