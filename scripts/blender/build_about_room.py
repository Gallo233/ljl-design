"""Build the selected About-room art direction as an editable Blender source.

Run with Blender, not system Python:

    scripts/blender/build_about_room.sh

The script is intentionally deterministic. It writes the editable high-detail source
to the untracked ``assets/3d`` working area and renders a source-material QA still.
``bake_about_room.py`` then owns shared UV atlases, baked lighting and the geometry-only
web GLB. Keeping those stages separate mirrors the reference site's asset pipeline and
makes it possible to re-bake without rebuilding the authored scene.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO = Path(__file__).resolve().parents[2]
BLEND_PATH = REPO / "assets" / "3d" / "about-room.blend"
GLB_PATH = REPO / "public" / "models" / "about-room.glb"
PREVIEW_PATH = REPO / "docs" / "design-references" / "about-room-source-preview.png"
WINDOW_TEXTURE_PATH = REPO / "public" / "media" / "guangzhou-blue-hour-window.webp"
TEXTURE_DIR = REPO / "scripts" / "blender" / "textures"

for path in (BLEND_PATH.parent, GLB_PATH.parent, PREVIEW_PATH.parent):
    path.mkdir(parents=True, exist_ok=True)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def hex_rgba(value: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)) + (alpha,)


def material(
    name: str,
    color: str,
    *,
    roughness: float = 0.72,
    metallic: float = 0.0,
    emission: str | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = hex_rgba(color, alpha)
    # Node display names are localized in the author's Blender install, while node
    # types and socket identifiers are stable across locales.
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        base = bsdf.inputs.get("Base Color")
        if base:
            base.default_value = hex_rgba(color, alpha)
        rough = bsdf.inputs.get("Roughness")
        if rough:
            rough.default_value = roughness
        metal = bsdf.inputs.get("Metallic")
        if metal:
            metal.default_value = metallic
        if emission:
            emit_color = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
            emit_strength = bsdf.inputs.get("Emission Strength")
            if emit_color:
                emit_color.default_value = hex_rgba(emission)
            if emit_strength:
                emit_strength.default_value = emission_strength
        if alpha < 1:
            alpha_input = bsdf.inputs.get("Alpha")
            if alpha_input:
                alpha_input.default_value = alpha
            mat.surface_render_method = "DITHERED"
    return mat


def image_material(
    name: str,
    path: Path,
    *,
    roughness: float = 0.72,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    """A glTF-safe image material used for authored, non-procedural surfaces."""
    mat = material(name, "#ffffff", roughness=roughness)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = f"{name} image"
    texture.image = bpy.data.images.load(str(path), check_existing=True)
    texture.interpolation = "Linear"
    links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    if emission_strength > 0:
        emission_color = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_color:
            links.new(texture.outputs["Color"], emission_color)
        emission = bsdf.inputs.get("Emission Strength")
        if emission:
            emission.default_value = emission_strength
    return mat


def pbr_material(
    name: str,
    diffuse_path: Path,
    normal_path: Path,
    roughness_path: Path,
    *,
    normal_strength: float = 0.55,
    metallic: float = 0.0,
) -> bpy.types.Material:
    """Compact three-map PBR material that exports directly to glTF/Three.js."""
    mat = material(name, "#ffffff", roughness=0.72, metallic=metallic)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")

    diffuse = nodes.new("ShaderNodeTexImage")
    diffuse.name = f"{name} · diffuse"
    diffuse.image = bpy.data.images.load(str(diffuse_path), check_existing=True)
    links.new(diffuse.outputs["Color"], bsdf.inputs["Base Color"])

    roughness = nodes.new("ShaderNodeTexImage")
    roughness.name = f"{name} · roughness"
    roughness.image = bpy.data.images.load(str(roughness_path), check_existing=True)
    roughness.image.colorspace_settings.name = "Non-Color"
    links.new(roughness.outputs["Color"], bsdf.inputs["Roughness"])

    normal = nodes.new("ShaderNodeTexImage")
    normal.name = f"{name} · normal"
    normal.image = bpy.data.images.load(str(normal_path), check_existing=True)
    normal.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = normal_strength
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def apply_bevel(obj: bpy.types.Object, width: float, segments: int = 3) -> None:
    if width <= 0:
        return
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new(name="Soft edges", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def assign_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)


def tile_uv(obj: bpy.types.Object, x: float, y: float | None = None) -> None:
    """Repeat a texture without a runtime shader; glTF preserves the wrapped UVs."""
    if not obj.data or not hasattr(obj.data, "uv_layers") or not obj.data.uv_layers.active:
        return
    y = y if y is not None else x
    for loop in obj.data.uv_layers.active.data:
        loop.uv.x *= x
        loop.uv.y *= y


def cube(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    bevel: float = 0.04,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, mat)
    apply_bevel(obj, min(bevel, min(dimensions) * 0.22))
    return obj


def plane(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float],
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (math.pi / 2, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(size=2, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (dimensions[0] / 2, dimensions[1] / 2, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, mat)
    return obj


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 48,
    bevel: float = 0.02,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, mat)
    apply_bevel(obj, bevel)
    return obj


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    segments: int = 48,
    rings: int = 28,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, mat)
    bpy.ops.object.shade_smooth()
    return obj


def curve_tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    mat: bpy.types.Material,
    *,
    cyclic: bool = False,
) -> bpy.types.Object:
    data = bpy.data.curves.new(name=f"{name}.curve", type="CURVE")
    data.dimensions = "3D"
    data.resolution_u = 3
    data.bevel_depth = radius
    data.bevel_resolution = 4
    spline = data.splines.new(type="POLY")
    spline.points.add(len(points) - 1)
    for point, position in zip(spline.points, points):
        point.co = (*position, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, mat)
    return obj


def beam_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    mat: bpy.types.Material,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    midpoint = (start_vector + end_vector) * 0.5
    direction = end_vector - start_vector
    obj = cylinder(name, tuple(midpoint), radius, direction.length, mat, vertices=20, bevel=radius * 0.24)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def tapered_box(
    name: str,
    location: tuple[float, float, float],
    *,
    bottom_width: float,
    top_width: float,
    depth: float,
    height: float,
    mat: bpy.types.Material,
    bevel: float = 0.05,
) -> bpy.types.Object:
    """A gently tapered upholstered panel for the chair's ergonomic silhouette."""
    bx = bottom_width / 2
    tx = top_width / 2
    dy = depth / 2
    hz = height / 2
    vertices = [
        (-bx, -dy, -hz), (bx, -dy, -hz), (bx, dy, -hz), (-bx, dy, -hz),
        (-tx, -dy, hz), (tx, -dy, hz), (tx, dy, hz), (-tx, dy, hz),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)]
    mesh_data = bpy.data.meshes.new(f"{name}.mesh")
    mesh_data.from_pydata(vertices, [], faces)
    mesh_data.update()
    obj = bpy.data.objects.new(name, mesh_data)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    assign_material(obj, mat)
    apply_bevel(obj, bevel, 3)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=0.03)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()
    obj.select_set(False)
    return obj


def empty(name: str, location: tuple[float, float, float]) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.22
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def parent_keep_world(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    # Hotspot roots stay at the scene origin, so a child's authored transform is
    # already its correct parent-relative transform. Keeping roots neutral also
    # prevents exporters from baking the representative centre twice.
    obj.parent = parent


def hotspot(name: str, centre: tuple[float, float, float], parts: list[bpy.types.Object]) -> bpy.types.Object:
    root = empty(f"hotspot__{name}", (0, 0, 0))
    root["focus_x"] = centre[0]
    root["focus_y"] = centre[1]
    root["focus_z"] = centre[2]
    for part in parts:
        parent_keep_world(part, root)
    return root


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


reset_scene()

# Material palette: brighter blue hour, restrained coral, photographed CC0 PBR.
navy = pbr_material(
    "Wall · midnight blue plaster",
    TEXTURE_DIR / "painted_plaster_wall_navy_1k.jpg",
    TEXTURE_DIR / "painted_plaster_wall_nor_gl_1k.jpg",
    TEXTURE_DIR / "painted_plaster_wall_rough_1k.jpg",
    normal_strength=0.13,
)
navy_dark = material("Joinery · deep navy", "#050c18", roughness=0.78)
oak = pbr_material(
    "Desk · smoked oak",
    TEXTURE_DIR / "dark_wood_diff_1k.jpg",
    TEXTURE_DIR / "dark_wood_nor_gl_1k.jpg",
    TEXTURE_DIR / "dark_wood_rough_1k.jpg",
    normal_strength=0.42,
)
oak_edge = oak
floor_mat = pbr_material(
    "Floor · dark oak",
    TEXTURE_DIR / "dark_wood_floor_1k.jpg",
    TEXTURE_DIR / "dark_wood_nor_gl_1k.jpg",
    TEXTURE_DIR / "dark_wood_rough_1k.jpg",
    normal_strength=0.3,
)
rug_mat = pbr_material(
    "Rug · blue grey linen",
    TEXTURE_DIR / "rough_linen_diff_1k.jpg",
    TEXTURE_DIR / "rough_linen_nor_gl_1k.jpg",
    TEXTURE_DIR / "rough_linen_rough_1k.jpg",
    normal_strength=0.7,
)
chair_fabric = pbr_material(
    "Chair · charcoal wool",
    TEXTURE_DIR / "poly_wool_herringbone_charcoal_1k.jpg",
    TEXTURE_DIR / "poly_wool_herringbone_nor_gl_1k.jpg",
    TEXTURE_DIR / "poly_wool_herringbone_rough_1k.jpg",
    normal_strength=0.82,
)
joinery_wood = pbr_material(
    "Bookcase · blackened oak",
    TEXTURE_DIR / "dark_wood_joinery_1k.jpg",
    TEXTURE_DIR / "dark_wood_nor_gl_1k.jpg",
    TEXTURE_DIR / "dark_wood_rough_1k.jpg",
    normal_strength=0.34,
)
metal = material("Metal · graphite", "#1f242b", roughness=0.36, metallic=0.56)
screen = material("Screen", "#17222c", roughness=0.18, emission="#91c7d8", emission_strength=0.6)
glass = material("Window glass", "#3a5571", roughness=0.22, metallic=0.04, alpha=0.42)
sky = material("Guangzhou blue hour", "#123f70", roughness=0.8, emission="#245f96", emission_strength=0.5)
city = material("City silhouettes", "#182a42", roughness=0.88)
city_lit = material("City windows", "#a68b66", roughness=0.6, emission="#c5a26f", emission_strength=1.7)
coral = material("Accent · coral", "#e66f55", roughness=0.5, emission="#d95e45", emission_strength=0.08)
warm = material("Lamp glow", "#f5c792", roughness=0.5, emission="#ffb86b", emission_strength=3.5)
paper = material("Paper", "#ded8ca", roughness=0.9)
plastic = material("Warm plastic", "#cfc7ba", roughness=0.62)
black = material("Soft black", "#16191d", roughness=0.72)
orange = material("Basketball", "#bb5b2c", roughness=0.82)
baseball_white = material("Baseball", "#ddd9cd", roughness=0.9)
baseball_red = material("Baseball seam", "#a54137", roughness=0.78)
cat_grey = material("Cat coat", "#77787c", roughness=0.96)
cat_light = material("Cat muzzle", "#b9b6af", roughness=0.96)
joi_glow = material("JOI signal", "#ee7359", roughness=0.3, emission="#ff6f50", emission_strength=4.0)
vinyl = material("Vinyl", "#07090c", roughness=0.22, metallic=0.12)
record_label = material("Record label", "#e66f55", roughness=0.55)
window_view = image_material(
    "Guangzhou blue-hour window plate",
    WINDOW_TEXTURE_PATH,
    roughness=0.9,
    emission_strength=0.34,
)

# Simple shell and furniture; the interactive props carry the detail.
floor = cube("room_floor", (0, 1.3, -0.13), (12.4, 7.4, 0.26), floor_mat, bevel=0.03)
tile_uv(floor, 4.0, 3.0)
back_wall = cube("room_back_wall", (0, 4.94, 3.8), (12.4, 0.18, 7.6), navy, bevel=0.02)
tile_uv(back_wall, 2.5, 1.4)
left_wall = cube("room_left_wall", (-6.11, 1.3, 3.8), (0.18, 7.4, 7.6), navy, bevel=0.02)
tile_uv(left_wall, 1.7, 1.6)
rug = cube("rug", (0.25, 0.8, 0.025), (6.4, 4.15, 0.05), rug_mat, bevel=0.14)
tile_uv(rug, 3.2, 2.1)
cube("back_baseboard", (0, 4.79, 0.18), (12.18, 0.12, 0.34), joinery_wood, bevel=0.025)
cube("left_baseboard", (-5.97, 1.32, 0.18), (0.12, 6.95, 0.34), joinery_wood, bevel=0.025)

# Desk and chair are intentionally quiet support geometry, but their silhouette now
# follows the selected reference: one smoked-oak slab, two black A-frame trestles and
# a compact ergonomic task chair rather than placeholder cubes.
desk_top = cube("desk_top", (1.15, 2.18, 1.45), (5.25, 1.45, 0.16), oak, bevel=0.07)
tile_uv(desk_top, 2.2, 1.0)
# Separate edge band and rear cable slot make the slab read as manufactured furniture.
cube("desk_front_edge", (1.15, 1.47, 1.43), (5.18, 0.045, 0.13), oak_edge, bevel=0.02)
cube("desk_cable_slot", (1.45, 2.62, 1.54), (0.78, 0.13, 0.035), black, bevel=0.025)
for x in (-1.22, 3.52):
    beam_between(f"desk_trestle_front_{x}", (x - 0.36, 1.64, 0.08), (x, 1.64, 1.4), 0.06, metal)
    beam_between(f"desk_trestle_back_{x}", (x + 0.36, 2.68, 0.08), (x, 2.68, 1.4), 0.06, metal)
    beam_between(f"desk_trestle_cross_{x}", (x - 0.36, 1.64, 0.1), (x + 0.36, 2.68, 0.1), 0.05, metal)
    for y in (1.64, 2.68):
        cylinder(
            f"desk_fastener_{x}_{y}",
            (x, y - 0.035, 1.31),
            0.045,
            0.025,
            metal,
            rotation=(math.pi / 2, 0, 0),
            vertices=24,
            bevel=0.006,
        )

cube("chair_seat", (0.72, 0.75, 0.92), (1.12, 1.0, 0.17), black, bevel=0.17)
chair_seat_pad = cube("chair_seat_pad", (0.72, 0.66, 1.01), (0.96, 0.78, 0.12), chair_fabric, bevel=0.11)
tile_uv(chair_seat_pad, 2.0)
cube("chair_back_frame", (0.72, 1.18, 1.65), (1.08, 0.12, 1.15), metal, bevel=0.18)
chair_back_pad = tapered_box(
    "chair_back_pad",
    (0.72, 1.1, 1.67),
    bottom_width=0.72,
    top_width=0.96,
    depth=0.14,
    height=0.92,
    mat=chair_fabric,
    bevel=0.08,
)
tile_uv(chair_back_pad, 2.2)
# The outer rail, lumbar pad and stitched channels make the chair read as a designed
# object in silhouette instead of two upholstered cuboids.
curve_tube(
    "chair_back_outer_rail",
    [
        (0.19, 1.18, 1.18),
        (0.11, 1.19, 1.72),
        (0.26, 1.18, 2.22),
        (0.72, 1.17, 2.34),
        (1.18, 1.18, 2.22),
        (1.33, 1.19, 1.72),
        (1.25, 1.18, 1.18),
    ],
    0.035,
    metal,
)
cube("chair_lumbar_pad", (0.72, 0.98, 1.43), (0.68, 0.11, 0.18), black, bevel=0.07)
for index, z in enumerate((1.35, 1.58, 1.81, 2.04)):
    curve_tube(
        f"chair_back_stitch_{index}",
        [(0.4, 1.015, z), (0.72, 0.99, z + 0.025), (1.04, 1.015, z)],
        0.006,
        black,
    )
cylinder("chair_left_arm", (0.13, 0.73, 1.23), 0.035, 0.58, metal, bevel=0.012)
cylinder("chair_right_arm", (1.31, 0.73, 1.23), 0.035, 0.58, metal, bevel=0.012)
cube("chair_left_arm_pad", (0.13, 0.58, 1.52), (0.12, 0.52, 0.08), black, bevel=0.04)
cube("chair_right_arm_pad", (1.31, 0.58, 1.52), (0.12, 0.52, 0.08), black, bevel=0.04)
cylinder("chair_post", (0.75, 0.82, 0.48), 0.07, 0.72, metal, bevel=0.02)
for angle in range(0, 360, 72):
    rad = math.radians(angle)
    curve_tube(
        f"chair_spoke_{angle}",
        [(0.75, 0.82, 0.23), (0.75 + math.cos(rad) * 0.52, 0.82 + math.sin(rad) * 0.52, 0.15)],
        0.025,
        metal,
    )
    wheel_x = 0.75 + math.cos(rad) * 0.55
    wheel_y = 0.82 + math.sin(rad) * 0.55
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.07,
        minor_radius=0.022,
        major_segments=20,
        minor_segments=8,
        location=(wheel_x, wheel_y, 0.1),
        rotation=(math.pi / 2, 0, rad),
    )
    wheel = bpy.context.object
    wheel.name = f"chair_wheel_{angle}"
    assign_material(wheel, black)

# One bookcase + one grouped row of books = one reading hotspot.
book_parts: list[bpy.types.Object] = []
for location, dimensions in (
    ((-4.62, 4.43, 2.55), (2.45, 0.52, 5.1)),
    ((-4.62, 4.10, 0.22), (2.7, 0.68, 0.18)),
):
    # The first entry is replaced by rails below; keeping the footprint as a back panel.
    if dimensions[2] > 1:
        book_parts.append(cube("bookcase_back", location, (2.55, 0.16, 5.1), joinery_wood, bevel=0.03))
    else:
        book_parts.append(cube("bookcase_plinth", location, dimensions, navy_dark, bevel=0.04))
for x in (-5.85, -3.39):
    side = cube(f"bookcase_side_{x}", (x, 4.14, 2.62), (0.14, 0.7, 5.0), joinery_wood, bevel=0.025)
    tile_uv(side, 1.0, 2.4)
    book_parts.append(side)
for z in (0.22, 1.48, 2.74, 4.0, 5.12):
    shelf = cube(f"bookcase_shelf_{z}", (-4.62, 4.12, z), (2.6, 0.72, 0.12), joinery_wood, bevel=0.025)
    tile_uv(shelf, 1.8, 1.0)
    book_parts.append(shelf)
book_colors = [paper, oak, plastic, paper, coral, oak, plastic]
for row, base_z in enumerate((1.55, 2.81, 4.07)):
    for index, (width, height) in enumerate(((0.19, 0.82), (0.22, 0.9), (0.17, 0.76), (0.21, 0.86), (0.16, 0.7), (0.24, 0.92), (0.18, 0.8))):
        x = -5.35 + index * 0.3
        book = cube(
            f"book_{row}_{index}",
            (x, 3.72, base_z + height / 2),
            (width, 0.48, height),
            book_colors[(index + row * 2) % len(book_colors)],
            bevel=0.015,
        )
        book.rotation_euler.y = math.radians((-2, 1, 0, 3, -1, 2, -3)[index])
        book_parts.append(book)
# One horizontal art book and a brass bookend prevent the shelves reading as clones.
book_parts.append(cube("book_horizontal", (-4.92, 3.72, 0.58), (0.9, 0.5, 0.12), coral, bevel=0.018))
book_parts.append(cube("bookend", (-4.35, 3.69, 0.79), (0.08, 0.46, 0.48), metal, bevel=0.02))
hotspot("bookshelf", (-4.62, 4.15, 2.6), book_parts)

# Workstation: one monitor model, with keyboard treated as non-pickable support.
monitor_parts = [
    cube("monitor_body", (1.15, 2.55, 2.42), (2.35, 0.22, 1.45), metal, bevel=0.1),
    cube("monitor_screen", (1.15, 2.415, 2.42), (2.04, 0.035, 1.15), screen, bevel=0.055),
    cube("monitor_stem", (1.15, 2.56, 1.72), (0.18, 0.25, 0.54), metal, bevel=0.04),
    cube("monitor_foot", (1.15, 2.42, 1.5), (0.88, 0.55, 0.08), metal, bevel=0.04),
]
# A small real UI composition keeps the monitor from reading as a blank emissive slab.
for index, (width, y, color) in enumerate(((1.12, 2.392, coral), (0.82, 2.389, paper), (1.42, 2.386, paper))):
    monitor_parts.append(cube(f"monitor_ui_line_{index}", (0.82, y, 2.72 - index * 0.22), (width, 0.012, 0.045), color, bevel=0.01))
monitor_parts.append(sphere("monitor_ui_orb", (1.75, 2.38, 2.45), (0.22, 0.035, 0.22), joi_glow, segments=24, rings=14))
for x in (0.23, 2.07):
    monitor_parts.append(cube(f"monitor_speaker_{x}", (x, 2.405, 2.4), (0.045, 0.018, 0.86), black, bevel=0.015))
hotspot("crt-monitor", (1.15, 2.5, 2.2), monitor_parts)
keyboard = cube("keyboard", (1.05, 1.7, 1.58), (1.3, 0.42, 0.06), plastic, bevel=0.035)
for row in range(3):
    for column in range(10):
        cube(
            f"key_{row}_{column}",
            (0.53 + column * 0.115, 1.54 + row * 0.115, 1.626),
            (0.082, 0.075, 0.018),
            row == 0 and column == 9 and coral or black,
            bevel=0.008,
        )

# Compact coral task lamp.
cylinder("lamp_base", (-0.92, 2.22, 1.56), 0.25, 0.09, coral, bevel=0.02)
curve_tube("lamp_arm", [(-0.92, 2.22, 1.62), (-0.82, 2.22, 2.28), (-0.38, 2.22, 2.62)], 0.035, metal)
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.34, radius2=0.16, depth=0.42, location=(-0.25, 2.22, 2.55), rotation=(0, math.radians(68), 0))
lamp_shade = bpy.context.object
lamp_shade.name = "lamp_shade"
assign_material(lamp_shade, coral)
sphere("lamp_bulb", (-0.08, 2.22, 2.43), (0.12, 0.12, 0.12), warm, segments=24, rings=14)

# Handheld: one sparse shelf object.
handheld_parts = [
    cube("handheld_body", (-4.62, 3.72, 1.83), (1.05, 0.3, 0.55), plastic, bevel=0.13),
    cube("handheld_screen", (-4.62, 3.545, 1.86), (0.53, 0.025, 0.3), screen, bevel=0.035),
    cylinder("handheld_left", (-4.98, 3.52, 1.82), 0.08, 0.04, black, rotation=(math.pi / 2, 0, 0), vertices=24, bevel=0.01),
    cylinder("handheld_right", (-4.25, 3.52, 1.82), 0.055, 0.04, coral, rotation=(math.pi / 2, 0, 0), vertices=24, bevel=0.01),
]
for x, z, mat in ((-4.32, 2.04, coral), (-4.2, 1.9, black), (-5.0, 1.96, black)):
    handheld_parts.append(sphere(f"handheld_control_{x}_{z}", (x, 3.51, z), (0.055, 0.025, 0.055), mat, segments=18, rings=10))
hotspot("handheld", (-4.62, 3.7, 1.84), handheld_parts)

# Camera: one clean model on the desk.
camera_parts = [
    cube("camera_body", (2.72, 1.98, 1.72), (0.7, 0.38, 0.46), black, bevel=0.09),
    cylinder("camera_lens", (2.72, 1.755, 1.72), 0.22, 0.3, metal, rotation=(math.pi / 2, 0, 0), vertices=36, bevel=0.025),
    cylinder("camera_glass", (2.72, 1.585, 1.72), 0.14, 0.025, screen, rotation=(math.pi / 2, 0, 0), vertices=36, bevel=0.01),
    cube("camera_prism", (2.72, 1.97, 2.0), (0.32, 0.3, 0.18), black, bevel=0.04),
]
camera_parts.extend([
    cylinder("camera_mode_dial", (2.5, 1.94, 2.01), 0.09, 0.055, metal, vertices=24, bevel=0.01),
    cylinder("camera_shutter", (2.95, 1.92, 2.0), 0.045, 0.06, coral, vertices=20, bevel=0.008),
    cube("camera_grip", (2.98, 1.9, 1.7), (0.22, 0.3, 0.38), black, bevel=0.08),
])
hotspot("camera", (2.72, 1.85, 1.77), camera_parts)

# Side plinth for the JOI record box and the single JOI artifact.
cube("side_plinth", (4.7, 1.52, 0.64), (1.55, 2.35, 1.2), navy_dark, bevel=0.05)

music_parts: list[bpy.types.Object] = [
    cube("joi_music_box", (4.7, 0.73, 1.36), (1.28, 0.88, 0.42), black, bevel=0.1),
    cube("joi_music_deck", (4.7, 0.64, 1.6), (1.15, 0.68, 0.08), metal, bevel=0.035),
    cylinder("joi_vinyl", (4.56, 0.61, 1.67), 0.38, 0.035, vinyl, vertices=48, bevel=0.008),
    cylinder("joi_vinyl_label", (4.56, 0.585, 1.67), 0.1, 0.043, record_label, vertices=32, bevel=0.006),
    cube("joi_music_signal", (5.12, 0.55, 1.7), (0.12, 0.07, 0.12), joi_glow, bevel=0.03),
    cylinder("joi_spindle", (4.56, 0.575, 1.71), 0.018, 0.075, metal, vertices=18, bevel=0.004),
]
# Tone arm, pitch slider and hardware buttons make this a playable device, not a box
# with a disc sitting on it.
music_parts.append(curve_tube("joi_tonearm", [(5.02, 0.62, 1.72), (5.08, 0.63, 1.82), (4.79, 0.61, 1.84)], 0.018, metal))
music_parts.append(cube("joi_pitch_slot", (5.12, 0.52, 1.56), (0.12, 0.035, 0.28), navy_dark, bevel=0.015))
music_parts.append(cube("joi_pitch_fader", (5.12, 0.49, 1.61), (0.16, 0.045, 0.055), coral, bevel=0.018))
for index, x in enumerate((4.15, 4.32, 4.49)):
    music_parts.append(cylinder(f"joi_music_button_{index}", (x, 0.48, 1.55), 0.035, 0.035, index == 0 and coral or metal, rotation=(math.pi / 2, 0, 0), vertices=18, bevel=0.006))
# Three sleeves in the open rear slot signal the selectable records without adding
# three unrelated room props; the whole station remains one interaction target.
for index, mat in enumerate((coral, sky, paper)):
    sleeve = cube(
        f"joi_record_sleeve_{index}",
        (4.35 + index * 0.3, 1.02 + index * 0.025, 1.92 + index * 0.05),
        (0.5, 0.055, 0.54),
        mat,
        bevel=0.025,
    )
    sleeve.rotation_euler.y = math.radians(-4 + index * 4)
    music_parts.append(sleeve)
hotspot("joi-music-box", (4.7, 0.78, 1.58), music_parts)

joi_parts = [
    cube("joi_shell", (4.7, 2.05, 1.43), (0.62, 0.38, 0.62), glass, bevel=0.12),
    sphere("joi_core", (4.7, 1.83, 1.43), (0.15, 0.15, 0.15), joi_glow, segments=28, rings=18),
]
hotspot("joi-artifact", (4.7, 1.95, 1.43), joi_parts)

# Cat: one stylised but PBR model with no extra figurines.
cat_parts = [
    sphere("cat_body", (-0.55, -0.05, 0.39), (0.72, 0.44, 0.34), cat_grey),
    sphere("cat_head", (-1.13, -0.16, 0.49), (0.33, 0.3, 0.3), cat_grey, segments=28, rings=18),
    sphere("cat_muzzle", (-1.34, -0.34, 0.43), (0.16, 0.1, 0.12), cat_light, segments=24, rings=14),
    sphere("cat_front_paw", (-0.94, -0.37, 0.18), (0.22, 0.18, 0.12), cat_light, segments=24, rings=14),
    sphere("cat_hind_paw", (-0.03, -0.32, 0.18), (0.28, 0.2, 0.13), cat_grey, segments=24, rings=14),
    sphere("cat_left_eye", (-1.25, -0.405, 0.56), (0.032, 0.018, 0.043), joi_glow, segments=16, rings=10),
    sphere("cat_right_eye", (-1.06, -0.405, 0.56), (0.032, 0.018, 0.043), joi_glow, segments=16, rings=10),
    sphere("cat_nose", (-1.34, -0.45, 0.45), (0.035, 0.025, 0.025), coral, segments=16, rings=10),
]
for x in (-1.28, -1.02):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.13, radius2=0.0, depth=0.27, location=(x, -0.14, 0.78), rotation=(0, 0, 0))
    ear = bpy.context.object
    ear.name = f"cat_ear_{x}"
    assign_material(ear, cat_grey)
    cat_parts.append(ear)
tail_points = []
for index in range(13):
    angle = math.radians(index * 16)
    tail_points.append((0.05 + math.cos(angle) * 0.55, -0.03 - math.sin(angle) * 0.42, 0.28 + index * 0.013))
cat_parts.append(curve_tube("cat_tail", tail_points, 0.07, cat_grey))
for side in (-1, 1):
    for offset in (-0.045, 0.0, 0.045):
        cat_parts.append(curve_tube(
            f"cat_whisker_{side}_{offset}",
            [(-1.34, -0.44, 0.43 + offset), (-1.34 + side * 0.42, -0.52, 0.42 + offset * 1.4)],
            0.006,
            cat_light,
        ))
hotspot("cat-figure", (-0.55, -0.08, 0.42), cat_parts)

# Sports: exactly one basketball and one baseball, each with its own hotspot.
basketball_parts = [sphere("basketball", (-4.95, -0.62, 0.43), (0.43, 0.43, 0.43), orange, segments=36, rings=24)]
for rotation in ((0, 0, 0), (math.pi / 2, 0, 0), (0, math.pi / 2, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.43, minor_radius=0.011, major_segments=40, minor_segments=8, location=(-4.95, -0.62, 0.43), rotation=rotation)
    seam = bpy.context.object
    seam.name = "basketball_seam"
    assign_material(seam, black)
    basketball_parts.append(seam)
hotspot("basketball", (-4.95, -0.62, 0.43), basketball_parts)

baseball_parts = [sphere("baseball", (3.75, -0.68, 0.24), (0.24, 0.24, 0.24), baseball_white, segments=32, rings=20)]
for rotation in ((math.pi / 2, 0, 0), (0, math.pi / 2, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.235, minor_radius=0.008, major_segments=36, minor_segments=6, location=(3.75, -0.68, 0.24), rotation=rotation)
    seam = bpy.context.object
    seam.name = "baseball_seam"
    assign_material(seam, baseball_red)
    baseball_parts.append(seam)
hotspot("baseball", (3.75, -0.68, 0.24), baseball_parts)

# Timeline is one restrained wall object. The readable copy remains accessible DOM.
timeline_parts = [cube("timeline_line", (-2.75, 4.81, 3.0), (0.025, 0.035, 2.7), coral, bevel=0.01)]
for index, z in enumerate((1.72, 2.55, 3.38, 4.2)):
    timeline_parts.append(sphere(f"timeline_marker_{index}", (-2.75, 4.75, z), (0.055, 0.055, 0.055), coral, segments=16, rings=10))
timeline_root = empty("timeline", (0, 0, 0))
for part in timeline_parts:
    parent_keep_world(part, timeline_root)

# One window hotspot: a real Guangzhou blue-hour plate behind restrained framing.
# Removing the duplicate block skyline keeps the city deep and the room itself sparse.
window_parts: list[bpy.types.Object] = [
    plane("window_view", (1.75, 4.825, 3.5), (6.65, 4.45), window_view),
    cube("window_glass", (1.75, 4.68, 3.5), (6.75, 0.04, 4.55), glass, bevel=0.02),
]
for x in (-1.55, 5.05):
    window_parts.append(cube(f"window_jamb_{x}", (x, 4.55, 3.5), (0.13, 0.38, 4.78), metal, bevel=0.025))
for z in (1.12, 5.86):
    window_parts.append(cube(f"window_rail_{z}", (1.75, 4.55, z), (6.75, 0.38, 0.13), metal, bevel=0.025))
window_parts.append(cube("window_mullion", (1.78, 4.54, 3.5), (0.11, 0.38, 4.65), metal, bevel=0.02))
window_parts.append(cube("window_transom", (1.75, 4.53, 3.18), (6.65, 0.38, 0.1), metal, bevel=0.02))
hotspot("window", (1.75, 4.7, 3.5), window_parts)

# Render lighting: broad cool window fill plus a small warm practical pool.
world = bpy.context.scene.world
world.use_nodes = True
world_background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
world_background.inputs["Color"].default_value = hex_rgba("#071321")
world_background.inputs["Strength"].default_value = 0.12

def area_light(name: str, location: tuple[float, float, float], energy: float, color: str, size: float, target: tuple[float, float, float]) -> None:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.color = hex_rgba(color)[:3]
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    look_at(obj, target)


area_light("Blue-hour window fill", (3.7, -1.5, 7.2), 470, "#82bce8", 6.5, (0.3, 1.5, 1.6))
area_light("Soft room fill", (-4.8, -2.0, 5.5), 265, "#7796b8", 4.0, (-1.5, 1.5, 1.8))
area_light("Coral desk pool", (-0.3, 1.5, 4.0), 145, "#ff8a60", 1.8, (0.4, 2.0, 1.2))

# QA camera matches the selected design's clear three-quarter view.
camera_data = bpy.data.cameras.new("About room camera")
camera = bpy.data.objects.new("About room camera", camera_data)
camera.location = (10.8, -15.6, 6.35)
camera_data.lens = 50
camera_data.sensor_width = 36
bpy.context.collection.objects.link(camera)
look_at(camera, (0.0, 1.72, 2.3))
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1440
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PREVIEW_PATH)
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass

# Keep source and shipped model reproducible from the same scene.
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_materials="EXPORT",
    export_extras=True,
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_animations=False,
)
bpy.ops.render.render(write_still=True)

print(f"BLEND={BLEND_PATH}")
print(f"GLB={GLB_PATH}")
print(f"PREVIEW={PREVIEW_PATH}")
