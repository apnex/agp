def clean:
  if . == null then ""
  elif type == "string" then .
  else tostring
  end
  | gsub(
      "[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]";
      " "
    );

def next_hop:
  if type != "object" then ""
  elif .kind == "local" and (.bindingId | type) == "string" then
    "local"
  elif .kind == "session"
    and (.nodeId | type) == "string"
    and (.owningSessionId | type) == "string"
  then
    "\(.nodeId)@\(.owningSessionId)"
  else ""
  end;

def path:
  if type != "array" then ""
  else map(clean) | join(">")
  end;

if .apiVersion != "agp.management/v1"
  or .kind != "RouteTable"
  or (.candidates | type) != "array"
  or (.selected | type) != "array"
then
  error("expected agp.management/v1 RouteTable")
else
  .selected as $selected
  | .candidates
  | map(
      . as $route
      | {
          selected: (
            if any($selected[]; .routeId == $route.routeId)
            then ">"
            else ""
            end
          ),
          endpoint: (.endpoint | clean),
          route_class: (.routeClass | clean),
          learned_kind: (.learnedKind | clean),
          next_hop: (.nextHop | next_hop | clean),
          origin_node: (.originNodeId | clean),
          path: (.path | path | clean),
          eligible: (.eligible | clean),
          reason: (.selectionReason | clean)
        }
    )
end
