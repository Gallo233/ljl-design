#!/bin/sh
# Regenerate one prop's Three.js factory from its img2threejs spec.
#
#   scripts/props/build.sh basketball [--pass-id material-pass]
#
# Generation is fail-closed on the skill's strict-quality gate, so this only writes when
# the spec is implementation-ready. The trim step afterwards is packaging, not authoring:
# see scripts/props/trim_lookdev.py.
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
SKILL_DIR=${IMG2THREEJS_DIR:-$HOME/.claude/skills/img2threejs}
PROP=$1
shift

SPEC="$REPO_DIR/scripts/props/$PROP/spec.json"
# createBasketball, createBaseball, …
FACTORY=$(printf 'create%s' "$(printf '%s' "$PROP" | awk -F- '{for(i=1;i<=NF;i++) printf toupper(substr($i,1,1)) substr($i,2)}')")
OUT="$REPO_DIR/app/joi-signal-lab/props/$FACTORY.ts"

(cd "$SKILL_DIR" && python3 forge/stage3_build/generate_threejs_factory.py "$SPEC" --out "$OUT" --force "$@")
python3 "$REPO_DIR/scripts/props/trim_lookdev.py" "$OUT"
