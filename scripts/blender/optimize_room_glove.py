"""Reduce only the glove's redundant leather surface density for the web GLB.
The baseball, every thread, lace, punched eyelet and rolled welt remain untouched.
"""
import bpy, bmesh, math
from mathutils.bvhtree import BVHTree


def optimize_glove(obj, remove_triangles=33000, up_axis=1):
    group = obj.vertex_groups.get('Preserved baseball')
    if group is None:
        raise RuntimeError('The preserved baseball group is required before optimizing the glove')
    protected = {v.index for v in obj.data.vertices if any(g.group == group.index and g.weight > .5 for g in v.groups)}
    before_ball = sorted(tuple(round(x, 6) for x in (obj.matrix_world @ obj.data.vertices[i].co)) for i in protected)
    material_ids = {i for i, m in enumerate(obj.data.materials) if m and (m.name.startswith('Glove / saddle leather') or m.name.startswith('Glove / pocket'))}
    def is_body(face):
        return face.material_index in material_ids and not any(v.index in protected for v in face.verts)
    body = obj.copy()
    body.data = obj.data.copy()
    body.name = 'Optimized glove leather surface'
    bpy.context.collection.objects.link(body)
    for target, keep_body in [(body, True), (obj, False)]:
        bm = bmesh.new(); bm.from_mesh(target.data); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        discard = [f for f in bm.faces if is_body(f) != keep_body]
        bmesh.ops.delete(bm, geom=discard, context='FACES')
        loose = [v for v in bm.verts if not v.link_faces]
        if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bm.to_mesh(target.data); bm.free(); target.data.update()
    initial = sum(len(f.vertices) - 2 for f in body.data.polygons)
    reference = BVHTree.FromPolygons([body.matrix_world @ v.co for v in body.data.vertices], [tuple(f.vertices) for f in body.data.polygons])
    weight = body.vertex_groups.new(name='Leather simplification priority')
    for v in body.data.vertices:
        normal = (body.matrix_world.to_3x3() @ v.normal).normalized()
        # Keep the bias mild: all surfaces retain many triangles, downward-facing
        # interior surfaces merely collapse before the palm-facing leather.
        hidden = normal[up_axis] < -.15
        weight.add([v.index], .9 if hidden else .3, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
    dec = body.modifiers.new('Remove redundant leather density', 'DECIMATE')
    dec.ratio = max(.3, (initial - remove_triangles) / initial)
    dec.vertex_group = weight.name
    dec.vertex_group_factor = .45
    dec.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    remaining = sum(len(f.vertices) - 2 for f in body.data.polygons)
    errors = [reference.find_nearest(body.matrix_world @ v.co)[3] or 0. for v in body.data.vertices]
    max_error = max(errors, default=0.)
    rms_error = math.sqrt(sum(e*e for e in errors) / max(1, len(errors)))
    # Same parent transform and active object preserve the approved pose exactly.
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); body.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join(); obj.data.update(); bpy.context.view_layer.update()
    group = obj.vertex_groups['Preserved baseball']
    protected_after = [v for v in obj.data.vertices if any(g.group == group.index and g.weight > .5 for g in v.groups)]
    after_ball = sorted(tuple(round(x, 6) for x in (obj.matrix_world @ v.co)) for v in protected_after)
    if before_ball != after_ball:
        raise RuntimeError('Optimization changed the preserved baseball vertices')
    return dict(leather_triangles_before=initial, leather_triangles_after=remaining, removed_triangles=initial-remaining, max_surface_error=max_error, rms_surface_error=rms_error, baseball_vertices_preserved=len(before_ball))
