#!/bin/sh
set -eu
REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
BLENDER_BIN=${BLENDER_BIN:-/Users/liujialuo/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender}
"$BLENDER_BIN" --background --python "$REPO_DIR/scripts/blender/build_handheld.py"
node "$REPO_DIR/scripts/dev/verify-handheld-glb.mjs"
