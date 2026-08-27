#!/bin/sh
set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
BLENDER_BIN=${BLENDER_BIN:-/Users/liujialuo/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender}

"$BLENDER_BIN" --background --python "$REPO_DIR/scripts/blender/build_about_room.py"
"$BLENDER_BIN" "$REPO_DIR/assets/3d/about-room.blend" --background --python "$REPO_DIR/scripts/blender/bake_about_room.py"
