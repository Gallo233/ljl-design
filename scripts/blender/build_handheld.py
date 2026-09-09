"""Author POCKET-NT in Blender; export the same articulated asset to both web views.

Run: Blender --background --python scripts/blender/build_handheld.py
Editable source stays in assets/3d (untracked). Only the web GLB and this recipe ship.
Coordinates below match console3d: X right, Y up, Z toward the player.
"""
from pathlib import Path
import math
import json
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/3d/pocket-nt.blend'
WEB = ROOT / 'public/models/pocket-nt.glb'
PREVIEW = ROOT / 'docs/design-references/pocket-nt-blender.png'
for path in (SOURCE, WEB, PREVIEW):
    path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
W, H, D = 13.91, 13.91 / 1.82, 1.25
SW, SH, F, DX = 7.85, 7.85 * 9 / 16, .625, 5.58
parts = {}

def rgba(hex):
    values = [int(hex[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)

def material(name, color, rough=.45, metal=0, coat=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = rgba(color)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = rgba(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    return m

shell = material('Ceramic-white PC-ABS', 'e7e9e5', .34, 0, .22)
rear = material('Warm-grey rear moulding', 'c7cdc9', .53)
trim = material('Satin titanium bezel', '9ca8a6', .31, .65)
dark = material('Recess shadow / graphite', '35403f', .7)
rubber = material('Warm graphite elastomer', '66736c', .83)
keymat = material('Pearl control plastic', 'e4e7df', .3, 0, .4)
ink = material('Silkscreen / sage graphite', '54645e', .68)
silver = material('Machined screw heads', 'b7c2bc', .25, .8)
screenmat = material('Display placeholder', 'f6f8fb', .65)
colors = {k:material('Key / '+k, c, .28, 0, .45) for k,c in
          [('x','a9c9b6'),('y','9ba4cf'),('a','e0968a'),('b','e8c68d')]}
ledmat = material('Power light', 'a9c9b6', .2)
cartmat = material('Cartridge light', '9ba4cf', .2)
for mat in (ledmat, cartmat):
    b = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Emission Color'].default_value = mat.diffuse_color
    b.inputs['Emission Strength'].default_value = .5

def register(o, name, mat, assembly='shell-front'):
    o.name = name
    if mat: o.data.materials.append(mat)
    parts.setdefault(assembly, []).append(o)
    return o

def bevel(o, width=.04, segments=4):
    b = o.modifiers.new('Manufactured edge fillet', 'BEVEL')
    b.width, b.segments = width, segments
    b.limit_method = 'ANGLE'
    n = o.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    n.keep_sharp = True
    for p in o.data.polygons: p.use_smooth = True

def outline(w, h, r, steps=24):
    return [(cx + r*math.cos(a+i*math.pi/2/steps), cy + r*math.sin(a+i*math.pi/2/steps))
            for cx,cy,a in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,math.pi/2),
                            (-w/2+r,-h/2+r,math.pi),(w/2-r,-h/2+r,math.pi*1.5)]
            for i in range(steps+1)]

def slab(name, w, h, depth, radius, pos, mat, assembly='shell-front', fillet=.04):
    pts = outline(w,h,min(radius,w/2-.001,h/2-.001))
    count=len(pts)
    verts=[(x,y,z) for z in (-depth/2,depth/2) for x,y in pts]
    faces=[tuple(reversed(range(count))), tuple(range(count,count*2))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o)
    o.location=pos
    register(o,name,mat,assembly)
    if fillet: bevel(o,fillet,5)
    return o

def ring(name, w, h, r, iw, ih, ir, depth, pos, mat, assembly='display-module'):
    a,b=outline(w,h,r),outline(iw,ih,ir)
    n=len(a); v=[(x,y,z) for z in (-depth/2,depth/2) for loop in (a,b) for x,y in loop]
    f=[]
    for i in range(n):
        j=(i+1)%n
        f += [(i,j,j+2*n,i+2*n),(i+n,i+3*n,j+3*n,j+n),
              (i+2*n,j+2*n,j+3*n,i+3*n),(i,i+n,j+n,j)]
    me=bpy.data.meshes.new(name); me.from_pydata(v,[],f); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); o.location=pos
    register(o,name,mat,assembly); bevel(o,.018,3)
    return o

def cyl(name, radius, depth, pos, mat, assembly='shell-front', vertices=64, edge=.018):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    o=register(bpy.context.object,name,mat,assembly)
    if edge: bevel(o,edge,4)
    return o

def torus(name, radius, tube, pos, mat, assembly):
    bpy.ops.mesh.primitive_torus_add(major_segments=80, minor_segments=12, location=pos,
                                  major_radius=radius, minor_radius=tube)
    o=register(bpy.context.object,name,mat,assembly)
    for p in o.data.polygons: p.use_smooth=True
    return o

def text(name, value, size, pos, mat=ink, assembly='technical-markings'):
    c=bpy.data.curves.new(name,'FONT'); c.body=value; c.align_x='CENTER'; c.align_y='CENTER'
    c.size=size; c.extrude=.0005; c.resolution_u=6
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.location=pos
    register(o,name,mat,assembly)
    return o

def cut(obj, cutter):
    # Apply fillets first: a physical recess then retains a clean planar floor.
    bpy.context.view_layer.objects.active=obj
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new('Machined recess','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for values in parts.values():
        if cutter in values: values.remove(cutter)
    bpy.data.objects.remove(cutter,do_unlink=True)

# Two independently editable mouldings with a real parting gap.
front=slab('shell-front',W,H,.72,1.42,(0,0,.265),shell,fillet=.16)
back=slab('shell-back',W-.07,H-.07,.48,1.42,(0,0,-.385),rear,'shell-back',.16)
seam=slab('shell-seam',W-.08,H-.08,.055,1.39,(0,0,-.12),dark,'shell-seam',.015)
for moulding in (front,back,seam):
    cutter=slab('slot-cutter',2.17,.43,.85,.055,(0,0,0),None,'cutters',0)
    cutter.rotation_euler.x=math.pi/2;cutter.location=(0,H/2-.15,-.12)
    cut(moulding,cutter)
# The display is a ring with an actual aperture, not a slab painted over the shell.
cut(front,slab('display-cutter',SW+.13,SH+.13,1,.17,(0,.3,.68),None,'cutters',0))
ring('screen-gasket',SW+.59,SH+.59,.34,SW+.11,SH+.11,.1,.12,(0,.3,.59),dark)
ring('screen-bezel',SW+.52,SH+.52,.31,SW+.03,SH+.03,.065,.16,(0,.3,.66),trim)
ring('glass-edge',SW+.09,SH+.09,.07,SW,SH,.045,.035,(0,.3,.727),dark)
slab('screen-aperture',SW,SH,.016,.035,(0,.3,.732),screenmat,'screen-aperture',0)

# Broad thumb dish, fine circumferential lip, four independently articulated arms.
cyl('dpad-recess',1.10,.055,(-DX,.52,.63),dark,'left-control-cluster')
cyl('dpad-well',1.04,.06,(-DX,.52,.66),rear,'left-control-cluster')
torus('dpad-well-rim',1.045,.024,(-DX,.52,.696),trim,'left-control-cluster')
slab('dpad-hub',.49,.49,.28,.07,(-DX,.52,.79),keymat,'left-control-cluster')
for id,dx,dy,w,h in [('up',0,1,.54,.69),('down',0,-1,.54,.69),('left',-1,0,.69,.54),('right',1,0,.69,.54)]:
    x,y=-DX+dx*.43,.52+dy*.43
    slab('control-'+id,w,h,.25,.095,(x,y,.79),keymat,'control-'+id,.035)
    # Small inset dash on the outer end makes the pad's orientation legible at close range.
    slab('pad-grip-'+id,.16 if dy else .035,.035 if dy else .16,.008,.012,
         (x+dx*.13,y+dy*.13,.922),ink,'control-'+id,.002)

for id,x,y in [('x',-.12,.64),('y',-.78,.04),('a',.54,-.08),('b',-.16,-.66)]:
    px,py=DX+x,.52+y
    cyl('button-socket-'+id,.485,.042,(px,py,.644),dark,'right-control-cluster')
    torus('button-collar-'+id,.468,.016,(px,py,.675),trim,'right-control-cluster')
    cyl('control-'+id,.435,.275,(px,py,.805),colors[id],'control-'+id,80,.048)
    text('legend-'+id,id.upper(),.24,(px,py,.946),ink,'control-'+id)

# Proper dished rubber caps, with two concentric grip ridges and a skirt.
for name,x in [('analog-left',-DX+.85),('analog-right',DX-.85)]:
    y=-1.72
    cyl(name+'-socket',.58,.07,(x,y,.646),dark,name)
    torus(name+'-bearing',.52,.032,(x,y,.71),trim,name)
    cyl(name+'-boot',.40,.14,(x,y,.735),rubber,name)
    cyl(name+'-shaft',.18,.26,(x,y,.87),silver,name)
    cyl(name+'-cap',.43,.16,(x,y,1.04),rubber,name,80,.045)
    cyl(name+'-thumb',.337,.025,(x,y,1.12),rubber,name,80,.01)
    torus(name+'-grip-outer',.39,.022,(x,y,1.12),rubber,name)
    torus(name+'-grip-inner',.35,.01,(x,y,1.139),rubber,name)
    for i in range(36):
        a=i*math.tau/36
        cyl(name+'-knurl',.012,.07,(x+.427*math.cos(a),y+.427*math.sin(a),1.04),rubber,name,8,.003)

for id,x in [('select',-.72),('start',.72)]:
    y=-SH/2-.36
    slab(id+'-socket',1.0,.34,.024,.15,(x,y,.635),dark,'utility-buttons',.005)
    slab('control-'+id,.9,.25,.19,.12,(x,y,.738),keymat,'control-'+id,.025)
    text(id+'-legend',id.upper(),.105,(x,y-.31,.638))

for id,x in [('l2',-(W/2-1.35)),('l1',-(W/2-2.65)),('r1',W/2-2.65),('r2',W/2-1.35)]:
    slab('control-'+id,1.22,.39,.72,.17,(x,H/2+.08,-.045),rear,'control-'+id,.07)
    text('legend-'+id,id.upper(),.095,(x,H/2-.015,.326),ink,'control-'+id)
    for n in range(5):
        slab(id+'-traction',.022,.065,.012,.008,(x-.22+n*.11,H/2+.15,.325),trim,'control-'+id,.002)

# Front speaker bores: cut through the front plate, with dark acoustic cloth below.
bores=[]
for side in (-1,1):
    x=side*5.58
    for row in range(3):
        for col in range(6):
            xx=x+(col-2.5)*.18; yy=-2.67+row*.17
            bores.append(cyl('speaker-bore',.044,.42,(xx,yy,.57),None,'cutters',20,0))
    slab('speaker-cloth',1.16,.60,.018,.13,(x,-2.5,.40),dark,'speaker-array',.005)
bpy.ops.object.select_all(action='DESELECT')
for o in bores:o.select_set(True)
bpy.context.view_layer.objects.active=bores[0]; bpy.ops.object.join()
cut(front,bores[0])
parts['cutters']=[]

for i,mat in enumerate((ledmat,cartmat)):
    x=W/2-1.05+i*.34
    cyl('led-seat-'+str(i),.10,.035,(x,2.58,.64),trim,'status-lenses',32)
    cyl('power-led' if i==0 else 'cartridge-led',.06,.048,(x,2.58,.68),mat,'status-lenses',32,.015)

text('wordmark','J O I  /  P O C K E T - N T',.123,(-DX,2.56,.638))
text('display-header','P O C K E T   /   0 1',.14,(0,3.21,.638))
text('footer-brand','N I G H T   T I D E   / / /   J O I   L A B',.135,(0,-3.18,.638))
text('footer-spec','PORTABLE PLAY SYSTEM     -     DESIGNED BY GALLO',.076,(0,-3.43,.638))
text('power-label','PWR   /   CART',.082,(6.02,2.30,.638))

# Top cartridge mouth uses the runtime's exact insertion axis and seat coordinates.
slot=ring('cartridge-slot',2.51,.76,.16,2.17,.43,.055,.14,(0,0,0),trim,'cartridge-assembly')
slot.rotation_euler.x=math.pi/2; slot.location=(0,H/2-.015,-.12)
well=slab('cartridge-well',2.17,.43,.035,.05,(0,0,0),dark,'cartridge-assembly',.005)
well.rotation_euler.x=math.pi/2; well.location=(0,H/2-.40,-.12)
# Rear service panel, screw seats, moulded traction ribs and identification plate.
slab('battery-panel-seam',8.1,4.7,.04,.4,(0,-.3,-.634),dark,'shell-back',.01)
slab('battery-cover',8.02,4.62,.06,.38,(0,-.3,-.67),rear,'shell-back',.028)
for x in (-5.55,5.55):
    for y in (-2.55,2.55):
        cyl('screw-seat',.15,.035,(x,y,-.613),dark,'shell-back',40)
        cyl('torx-head',.10,.04,(x,y,-.642),silver,'shell-back',32,.008)
        for a in (0,math.pi/3,2*math.pi/3):
            o=slab('torx-slot',.11,.024,.009,.008,(x,y,-.667),dark,'shell-back',.002);o.rotation_euler.z=a
    for row in range(14):
        slab('rear-grip-rib',.95,.046,.055,.022,(x,-1.3+row*.2,-.625),rubber,'shell-back',.01)
# USB-C and headphone socket on the bottom edge; actual inset trim with a tongue.
usb=ring('usb-c-port',.64,.26,.10,.49,.15,.05,.035,(0,0,0),silver,'shell-back')
usb.rotation_euler.x=math.pi/2;usb.location=(0,-H/2+.03,-.18)
tongue=slab('usb-c-tongue',.35,.04,.09,.016,(0,0,0),dark,'shell-back',.005)
tongue.rotation_euler.x=math.pi/2;tongue.location=(0,-H/2+.02,-.18)
jack=torus('headphone-jack',.105,.034,(0,0,0),silver,'shell-back')
jack.rotation_euler.x=math.pi/2;jack.location=(2,-H/2+.035,-.18)

# Freeze modifiers and join by semantic assembly; dynamic controls retain their pivots.
for o in list(bpy.context.scene.objects):
    if o.type not in {'MESH','FONT'}:continue
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.convert(target='MESH')
    # Boolean bores leave long coplanar faces. Keep their normals exactly planar
    # instead of interpolating the bore-wall normals across the broad face plate.
    for polygon in o.data.polygons:
        if abs(polygon.normal.z) > .9999: polygon.use_smooth=False
    if o.name in {'shell-front','shell-back','shell-seam'} and o.data.has_custom_normals:
        # Boolean operations can carry stale weighted split normals onto new loops.
        o.data.normals_split_custom_set([(0,0,0)] * len(o.data.loops))
for name, objects in parts.items():
    objects=[o for o in objects if o.name in bpy.data.objects]
    if not objects:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    o=bpy.context.object;o.name=name
    if name.startswith('control-'):o['button']=name.removeprefix('control-')
    o['assembly']=name

# Convert authoring coordinates to Blender Z-up. glTF's Y-up export reverses this exactly.
rotate=Matrix.Rotation(math.pi/2,4,'X')
for o in list(bpy.context.scene.objects):
    o.matrix_world=rotate @ o.matrix_world
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
scene=bpy.context.scene
scene['asset']='POCKET-NT / Blender authored replacement'
scene['screen_contract']='7.85 x 4.415625, center [0,0.3,0.755], Three.js Y-up'
scene['web_asset']='/models/pocket-nt.glb'
meshes=list(scene.objects)
# Keep the source's dense fillets; the web copy removes redundant coplanar/fillet
# tessellation and uses the site's already-vendored Draco decoder.
web_modifiers=[]
for o in meshes:
    if len(o.data.polygons)>2000:
        mod=o.modifiers.new('Web-only mesh reduction','DECIMATE');mod.ratio=.48
        web_modifiers.append((o,mod))
bpy.ops.export_scene.gltf(filepath=str(WEB),export_format='GLB',use_selection=True,
                          export_apply=True,export_yup=True,export_extras=True,
                          export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14,
                          export_draco_normal_quantization=10,
                          export_cameras=False,export_lights=False,export_animations=False)
for o,mod in web_modifiers:o.modifiers.remove(mod)
for o in meshes:o.data.calc_loop_triangles()
stats={'meshes':len(meshes),'source_triangles':sum(len(o.data.loop_triangles) for o in meshes),
       'glb_bytes':WEB.stat().st_size,'screen':[SW,SH],'body':[W,H,D],
       'controls':[o.name for o in meshes if o.name.startswith('control-')]}
print('POCKET_NT_ASSET',json.dumps(stats))

# Studio setup is part of the editable .blend, excluded from the browser export.
world=bpy.data.worlds.new('Soft studio');scene.world=world;world.use_nodes=True
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs[0].default_value=(.33,.37,.40,1)
background.inputs[1].default_value=.45
def area(name,position,energy,size):
    bpy.ops.object.light_add(type='AREA',location=position)
    l=bpy.context.object;l.name=name;l.data.energy=energy;l.data.shape='DISK';l.data.size=size
    l.rotation_euler=(Vector((0,0,0))-l.location).to_track_quat('-Z','Y').to_euler()
area('Large silk key',(-7,-10,14),1800,9)
area('Right fill',(9,-5,6),1000,7)
area('Edge softbox',(0,5,10),1600,6)
bpy.ops.object.camera_add(location=(10,-24,13))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=18.5;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(PREVIEW)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.render.render(write_still=True)
