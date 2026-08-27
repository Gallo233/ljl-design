"""Bake the About room into shared display-referred atlases and export web geometry.

Run after ``build_about_room.py`` with the authored blend file open:

    Blender assets/3d/about-room.blend --background \
      --python scripts/blender/bake_about_room.py

The shipped GLB deliberately contains geometry, normals, UVs, hierarchy and hotspot
extras only. Three.js loads the three external WebP atlases and applies them as unlit
materials. This is the same class of pipeline used by the visual reference: Blender
owns authored form and light transport; the browser owns loading and interaction.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path

import bpy


REPO = Path(__file__).resolve().parents[2]
BLEND_PATH = REPO / "assets" / "3d" / "about-room.blend"
GLB_PATH = REPO / "public" / "models" / "about-room.glb"
PUBLIC_BAKE_DIR = REPO / "public" / "models" / "about-room"
WORK_BAKE_DIR = REPO / "assets" / "3d" / "about-room-bakes"
PREVIEW_PATH = REPO / "docs" / "design-references" / "about-room-blender-preview.png"
MANIFEST_PATH = PUBLIC_BAKE_DIR / "manifest.json"

ATLAS_SIZE = int(os.environ.get("ABOUT_ROOM_ATLAS_SIZE", "4096"))
BAKE_SAMPLES = int(os.environ.get("ABOUT_ROOM_BAKE_SAMPLES", "16"))
BAKE_LIGHT_MULTIPLIER = float(os.environ.get("ABOUT_ROOM_BAKE_LIGHT_MULTIPLIER", "5.5"))
BAKE_WORLD_MULTIPLIER = float(os.environ.get("ABOUT_ROOM_BAKE_WORLD_MULTIPLIER", "12"))
BAKE_EXPOSURE = float(os.environ.get("ABOUT_ROOM_BAKE_EXPOSURE", "1.7"))
BAKE_MARGIN = max(8, ATLAS_SIZE // 256)
BAKE_GROUPS = ("architecture", "furniture", "props")

for directory in (GLB_PATH.parent, PUBLIC_BAKE_DIR, WORK_BAKE_DIR, PREVIEW_PATH.parent):
    directory.mkdir(parents=True, exist_ok=True)


def deselect_all() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")


def root_hotspot_name(obj: bpy.types.Object) -> str | None:
    cursor = obj.parent
    while cursor:
        if cursor.name.startswith("hotspot__"):
            return cursor.name.removeprefix("hotspot__")
        cursor = cursor.parent
    return None


def bake_group_for(obj: bpy.types.Object) -> str:
    hotspot = root_hotspot_name(obj)
    if hotspot == "window":
        return "architecture"
    if hotspot == "bookshelf":
        return "furniture"
    if hotspot:
        return "props"

    architecture_prefixes = (
        "room_",
        "rug",
        "window_",
        "timeline_",
        "back_baseboard",
        "left_baseboard",
    )
    furniture_prefixes = (
        "desk_",
        "chair_",
        "bookcase_",
        "book_",
        "bookend",
        "keyboard",
        "key_",
        "lamp_",
        "side_plinth",
    )
    if obj.name.startswith(architecture_prefixes):
        return "architecture"
    if obj.name.startswith(furniture_prefixes):
        return "furniture"
    return "props"


def convert_curves_to_meshes() -> None:
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {"CURVE", "SURFACE", "FONT", "META"}:
            continue
        deselect_all()
        obj.hide_set(False)
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target="MESH")


def collapse_to_interaction_meshes(objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    """Join authored parts by interaction root before UV packing and web export.

    Blender can preserve many material slots on one mesh, so this removes per-object
    4K bake overhead without flattening the hotspot hierarchy. It also enforces the
    product decision that one interactive element should be one shipped model.
    """
    buckets: dict[tuple[str, str, str], list[bpy.types.Object]] = {}
    for obj in objects:
        hotspot = root_hotspot_name(obj) or "static"
        surface = obj.get("surface_mode", "baked")
        key = (obj["bake_group"], hotspot, surface)
        buckets.setdefault(key, []).append(obj)

    collapsed: list[bpy.types.Object] = []
    for (group, hotspot, surface), parts in buckets.items():
        if len(parts) == 1:
            active = parts[0]
        else:
            deselect_all()
            for part in parts:
                part.hide_set(False)
                part.select_set(True)
            active = parts[0]
            bpy.context.view_layer.objects.active = active
            bpy.ops.object.join()
        active.name = f"baked__{group}__{hotspot}__{surface}"
        active["bake_group"] = group
        if surface != "baked":
            active["surface_mode"] = surface
        collapsed.append(active)
    return collapsed


def normalize_source_uv(obj: bpy.types.Object) -> None:
    """Give every authored part one consistently named UV channel before joining.

    Blender joins UV layers by name. Normalising after the join leaves some parts on
    an orphan `UVMap` channel, which makes their PBR textures sample empty coordinates
    during the bake. Doing it per part preserves the original authored mapping while
    still allowing the interaction-level mesh merge.
    """
    uv_layers = obj.data.uv_layers
    if uv_layers:
        source = next((uv for uv in uv_layers if uv.active_render), uv_layers.active)
        for uv_layer in list(uv_layers):
            if uv_layer != source:
                uv_layers.remove(uv_layer)
        source.name = "SourceUV"
        uv_layers.active = source
        source.active_render = True
        return

    source = uv_layers.new(name="SourceUV")
    uv_layers.active = source
    source.active_render = True
    deselect_all()
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=1.15192,
        margin_method="SCALED",
        island_margin=0.02,
        correct_aspect=True,
        scale_to_bounds=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def ensure_uv_layers(obj: bpy.types.Object) -> None:
    uv_layers = obj.data.uv_layers
    if not uv_layers:
        source = uv_layers.new(name="SourceUV")
        uv_layers.active = source
        source.active_render = True
        deselect_all()
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(
            angle_limit=1.15192,
            margin_method="SCALED",
            island_margin=0.02,
            correct_aspect=True,
            scale_to_bounds=True,
        )
        bpy.ops.object.mode_set(mode="OBJECT")
    else:
        source = uv_layers.get("SourceUV")
        if source is None:
            source = uv_layers.active
            source.name = "SourceUV"
    previous_baked = uv_layers.get("BakedUV")
    if previous_baked:
        uv_layers.remove(previous_baked)
    baked = uv_layers.new(name="BakedUV")
    uv_layers.active = baked
    baked.active_render = True


def route_source_textures_to_source_uv() -> None:
    """Keep authored PBR textures on their original UVs while BakedUV is active."""
    for mat in bpy.data.materials:
        if not mat.use_nodes or not mat.node_tree:
            continue
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        uv_node = nodes.get("__SOURCE_UV__") or nodes.new("ShaderNodeUVMap")
        uv_node.name = "__SOURCE_UV__"
        uv_node.label = "Authored material UV"
        uv_node.uv_map = "SourceUV"
        for node in nodes:
            if node.type != "TEX_IMAGE" or node.name.startswith("__BAKE_TARGET__"):
                continue
            vector_input = node.inputs.get("Vector")
            if vector_input is None:
                continue
            for link in list(vector_input.links):
                links.remove(link)
            links.new(uv_node.outputs["UV"], vector_input)


def unwrap_shared_atlas(objects: list[bpy.types.Object]) -> None:
    deselect_all()
    for obj in objects:
        obj.data.uv_layers.active = obj.data.uv_layers["BakedUV"]
        obj.data.uv_layers["BakedUV"].active_render = True
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=1.15192,
        margin_method="SCALED",
        rotate_method="AXIS_ALIGNED_Y",
        island_margin=0.0025,
        area_weight=0.2,
        correct_aspect=True,
        scale_to_bounds=False,
    )
    bpy.ops.uv.pack_islands(
        udim_source="CLOSEST_UDIM",
        rotate=True,
        rotate_method="ANY",
        scale=True,
        merge_overlap=False,
        margin_method="SCALED",
        margin=0.004,
        pin=False,
        shape_method="AABB",
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def ensure_material_slot(obj: bpy.types.Object) -> bpy.types.Material:
    if obj.data.materials:
        return obj.data.materials[0]
    mat = bpy.data.materials.get("Bake fallback")
    if mat is None:
        mat = bpy.data.materials.new("Bake fallback")
        mat.use_nodes = True
    obj.data.materials.append(mat)
    return mat


def make_bake_target(group: str, objects: list[bpy.types.Object]) -> bpy.types.Image:
    image_name = f"about-room__blue-hour__{group}"
    existing = bpy.data.images.get(image_name)
    if existing:
        bpy.data.images.remove(existing)
    image = bpy.data.images.new(
        image_name,
        width=ATLAS_SIZE,
        height=ATLAS_SIZE,
        alpha=False,
        float_buffer=False,
    )
    image.generated_color = (0.003, 0.006, 0.012, 1.0)

    materials: set[bpy.types.Material] = set()
    for obj in objects:
        ensure_material_slot(obj)
        materials.update(material for material in obj.data.materials if material)
    for mat in materials:
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        node_name = f"__BAKE_TARGET__{group}"
        old = nodes.get(node_name)
        if old:
            nodes.remove(old)
        target = nodes.new("ShaderNodeTexImage")
        target.name = node_name
        target.label = f"Baked blue-hour atlas · {group}"
        target.image = image
        target.interpolation = "Linear"
        nodes.active = target
        target.select = True
    return image


def save_bake_image(image: bpy.types.Image, group: str) -> tuple[Path, Path]:
    png_path = WORK_BAKE_DIR / f"baked-blue-hour-{group}-{ATLAS_SIZE}.png"
    webp_path = PUBLIC_BAKE_DIR / f"baked-blue-hour-{group}.webp"
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    image.filepath_raw = str(png_path)
    image.file_format = "PNG"
    image.save_render(filepath=str(png_path), scene=scene)
    subprocess.run(
        ["/opt/homebrew/bin/cwebp", "-quiet", "-q", "92", "-m", "6", str(png_path), "-o", str(webp_path)],
        check=True,
    )
    return png_path, webp_path


def bake_group(group: str, objects: list[bpy.types.Object]) -> tuple[bpy.types.Image, Path]:
    image = make_bake_target(group, objects)
    deselect_all()
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    print(f"BAKE_START group={group} objects={len(objects)} size={ATLAS_SIZE} samples={BAKE_SAMPLES}")
    bpy.ops.object.bake(
        type="COMBINED",
        pass_filter={"DIRECT", "INDIRECT", "COLOR", "EMIT"},
        margin=BAKE_MARGIN,
        margin_type="EXTEND",
        use_selected_to_active=False,
        use_clear=True,
        target="IMAGE_TEXTURES",
        save_mode="INTERNAL",
        uv_layer="BakedUV",
    )
    _, webp_path = save_bake_image(image, group)
    print(f"BAKE_DONE group={group} path={webp_path}")
    return image, webp_path


def baked_preview_material(group: str, image: bpy.types.Image) -> bpy.types.Material:
    mat = bpy.data.materials.new(f"Baked preview · {group}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.interpolation = "Linear"
    uv = nodes.new("ShaderNodeUVMap")
    uv.uv_map = "BakedUV"
    base = bsdf.inputs.get("Base Color")
    if base:
        base.default_value = (0.0, 0.0, 0.0, 1.0)
    roughness = bsdf.inputs.get("Roughness")
    if roughness:
        roughness.default_value = 1.0
    emission_color = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    emission_strength = bsdf.inputs.get("Emission Strength")
    links.new(uv.outputs["UV"], texture.inputs["Vector"])
    if emission_color:
        links.new(texture.outputs["Color"], emission_color)
    if emission_strength:
        emission_strength.default_value = 1.0
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def glass_preview_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("Baked preview · glass")
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    base = bsdf.inputs.get("Base Color")
    if base:
        base.default_value = (0.14, 0.28, 0.42, 1.0)
    roughness = bsdf.inputs.get("Roughness")
    if roughness:
        roughness.default_value = 0.22
    alpha = bsdf.inputs.get("Alpha")
    if alpha:
        alpha.default_value = 0.16
    mat.surface_render_method = "DITHERED"
    return mat


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def triangle_count(objects: list[bpy.types.Object]) -> int:
    return sum(max(0, len(polygon.vertices) - 2) for obj in objects for polygon in obj.data.polygons)


convert_curves_to_meshes()
authored_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for obj in authored_meshes:
    obj["bake_group"] = bake_group_for(obj)
    if obj.name in {"window_glass", "joi_shell"}:
        obj["surface_mode"] = "glass"
    normalize_source_uv(obj)
mesh_objects = authored_meshes
for obj in mesh_objects:
    ensure_uv_layers(obj)
route_source_textures_to_source_uv()

grouped = {
    group: [
        obj
        for obj in mesh_objects
        if obj["bake_group"] == group and obj.get("surface_mode") != "glass"
    ]
    for group in BAKE_GROUPS
}
for group, objects in grouped.items():
    if not objects:
        raise RuntimeError(f"Bake group {group!r} is empty")
    unwrap_shared_atlas(objects)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
try:
    cycles_preferences = bpy.context.preferences.addons["cycles"].preferences
    cycles_preferences.compute_device_type = "METAL"
    cycles_preferences.refresh_devices()
    for device in cycles_preferences.devices:
        device.use = device.type == "METAL"
    scene.cycles.device = "GPU"
except (KeyError, TypeError):
    # CPU remains the deterministic fallback on machines without Metal/Cycles GPU.
    scene.cycles.device = "CPU"
scene.cycles.samples = BAKE_SAMPLES
scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.08
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = True
scene.render.bake.margin = BAKE_MARGIN
scene.render.bake.use_clear = True
source_exposure = scene.view_settings.exposure
scene.view_settings.exposure = BAKE_EXPOSURE
source_light_energy = {
    obj.name: obj.data.energy
    for obj in bpy.context.scene.objects
    if obj.type == "LIGHT"
}
for obj in bpy.context.scene.objects:
    if obj.type == "LIGHT":
        obj.data.energy = source_light_energy[obj.name] * BAKE_LIGHT_MULTIPLIER
world_background = next(
    (node for node in scene.world.node_tree.nodes if node.type == "BACKGROUND"),
    None,
)
source_world_strength = world_background.inputs["Strength"].default_value if world_background else None
if world_background:
    world_background.inputs["Strength"].default_value = source_world_strength * BAKE_WORLD_MULTIPLIER
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass

baked_images: dict[str, bpy.types.Image] = {}
baked_paths: dict[str, Path] = {}
for group in BAKE_GROUPS:
    image, path = bake_group(group, grouped[group])
    baked_images[group] = image
    baked_paths[group] = path

# Persist editable source, original PBR materials and both UV channels before the
# temporary unlit preview materials are applied.
for obj in bpy.context.scene.objects:
    if obj.type == "LIGHT":
        obj.data.energy = source_light_energy[obj.name]
if world_background and source_world_strength is not None:
    world_background.inputs["Strength"].default_value = source_world_strength
scene.view_settings.exposure = source_exposure
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

preview_materials = {
    group: baked_preview_material(group, baked_images[group])
    for group in BAKE_GROUPS
}
preview_glass = glass_preview_material()
for obj in mesh_objects:
    obj.data.materials.clear()
    if obj.get("surface_mode") == "glass":
        obj.data.materials.append(preview_glass)
    else:
        obj.data.materials.append(preview_materials[obj["bake_group"]])

# Bake while every authored part still owns its original material slots and UVs;
# merge only the disposable web copy afterwards. Joining before the bake keeps the
# silhouette but can collapse per-part texture coordinates into the active object's
# material space, which is exactly how detailed wood and fabric turn into flat color.
web_mesh_objects = collapse_to_interaction_meshes(mesh_objects)

scene.render.engine = "BLENDER_EEVEE"
scene.view_settings.exposure = BAKE_EXPOSURE
scene.render.resolution_x = 1440
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = str(PREVIEW_PATH)
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)

# glTF exports UV layers in slot order, while Three's `material.map` samples
# TEXCOORD_0. The editable source keeps `SourceUV` first so the original PBR
# materials remain readable, but the shipped geometry must expose `BakedUV` as
# UV0. The .blend was saved above, so removing the authored channel here affects
# only the disposable export copy.
for obj in web_mesh_objects:
    baked_uv = obj.data.uv_layers.get("BakedUV")
    if baked_uv:
        for uv_layer in list(obj.data.uv_layers):
            if uv_layer != baked_uv:
                obj.data.uv_layers.remove(uv_layer)
        baked_uv.name = "UVMap"
        obj.data.uv_layers.active = baked_uv
        baked_uv.active_render = True

# No image is embedded in the GLB. The shared atlases are immutable, cacheable web
# assets and can be swapped later for alternate lighting states without re-exporting
# geometry.
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

manifest = {
    "version": 1,
    "lightingState": "blue-hour",
    "atlasSize": ATLAS_SIZE,
    "bakeSamples": BAKE_SAMPLES,
    "bakeLightMultiplier": BAKE_LIGHT_MULTIPLIER,
    "bakeWorldMultiplier": BAKE_WORLD_MULTIPLIER,
    "bakeExposure": BAKE_EXPOSURE,
    "geometry": {
        "url": "/models/about-room.glb",
        "sha256": sha256(GLB_PATH),
        "objects": len(web_mesh_objects),
        "triangles": triangle_count(web_mesh_objects),
        "materialsEmbedded": False,
    },
    "atlases": {
        group: {
            "url": f"/models/about-room/{baked_paths[group].name}",
            "sha256": sha256(baked_paths[group]),
            "objects": len(grouped[group]),
        }
        for group in BAKE_GROUPS
    },
}
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

print(f"BLEND={BLEND_PATH}")
print(f"GLB={GLB_PATH}")
print(f"MANIFEST={MANIFEST_PATH}")
print(f"PREVIEW={PREVIEW_PATH}")
print(json.dumps(manifest, indent=2))
