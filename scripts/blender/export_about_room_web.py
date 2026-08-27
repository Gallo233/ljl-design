"""Export the saved About-room bake source with BakedUV exposed as glTF UV0.

This lightweight step is useful when only the web geometry contract changes. The
main `bake_about_room.py` performs the same conversion after every full bake.
"""

from pathlib import Path

import bpy


REPO = Path(__file__).resolve().parents[2]
GLB_PATH = REPO / "public" / "models" / "about-room.glb"


mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for obj in mesh_objects:
    baked_uv = obj.data.uv_layers.get("BakedUV")
    if baked_uv:
        for uv_layer in list(obj.data.uv_layers):
            if uv_layer != baked_uv:
                obj.data.uv_layers.remove(uv_layer)
        baked_uv.name = "UVMap"
        obj.data.uv_layers.active = baked_uv
        baked_uv.active_render = True

bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_materials="NONE",
    export_extras=True,
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_animations=False,
)

print(f"GLB={GLB_PATH}")
print(f"MESHES={len(mesh_objects)}")
