"""Blender-authored room replacements, in the capture's measured world coordinates.
Export geometry only; roomSurface.ts supplies the room's existing baked-light response.
Run with Blender --background --python scripts/blender/build_room_props.py.
"""
import bpy,math,random
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
# Author in Three world XYZ, converted to Blender Z-up at the final export boundary.
parts={}; group=''
def mat(name,color,rough=.5,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=tuple((int(color[i:i+2],16)/255)**2.2 for i in (0,2,4))+(1,);m.use_nodes=True
 b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');b.inputs['Base Color'].default_value=m.diffuse_color;b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;return m
leather=mat('Glove / saddle leather','985329',.72);lining=mat('Glove / pocket','663b26',.85);lace=mat('Glove / rawhide laces','d7aa70',.75);ink=mat('Rubber / charcoal','232622',.83);orange=mat('Basketball / pebbled rubber','bd652c',.8);white=mat('Baseball / ivory hide','e9e3d3',.65);red=mat('Baseball / raised red stitch','a53d31',.8);silver=mat('MacBook / satin aluminum','b2b7ba',.33,.72);edge=mat('MacBook / machined edge','d5d9dc',.25,.85);black=mat('MacBook / keyboard','202527',.72);legend=mat('MacBook / key print','bbc4c6',.6)
def reg(o,name,m):
 o.name=name;o.data.materials.append(m);parts.setdefault(group,[]).append(o);return o
def bevel(o,w=.03,n=3):
 m=o.modifiers.new('Manufactured fillet','BEVEL');m.width=w;m.segments=n
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
def box(name,pos,dim,m,r=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=reg(bpy.context.object,name,m);o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if r:bevel(o,r)
 return o
def uv(name,pos,scale,m,seg=48,rings=24):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=pos);o=reg(bpy.context.object,name,m);o.scale=scale
 for f in o.data.polygons:f.use_smooth=True
 return o
def tube(name,pts,r,m,closed=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=3
 s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for v,p in zip(s.points,pts):v.co=(*p,1)
 s.use_cyclic_u=closed;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return reg(o,name,m)
def text(name,value,pos,size,m,rotation):
 c=bpy.data.curves.new(name,'FONT');c.body=value;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.0003;c.resolution_u=3
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=rotation;return reg(o,name,m)
# Sports props: actual panel topology, recessed rubber channels, 108 double stitches.
# Seam reference: Spalding US2843383 (two dumbbell panels and their bisectors).
# The closed spherical curve is x=a*cos(t)+b*cos(3t), y=a*sin(t)-b*sin(3t),
# z=2*sqrt(a*b)*sin(2t). Its radius is identically a+b, not a projected oval.
from mathutils import Matrix
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

def mesh(name,verts,faces,m):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);reg(o,name,m)
 for f in me.polygons:f.use_smooth=True
 return o

def seam(t,a=.75):
 b=1-a
 return Vector((a*math.cos(t)+b*math.cos(3*t),a*math.sin(t)-b*math.sin(3*t),2*math.sqrt(a*b)*math.sin(2*t)))

def arc_samples(fn,n=108,res=4096):
 ps=[fn(i*math.tau/res) for i in range(res+1)]; ds=[0.]
 for i in range(res):ds.append(ds[-1]+(ps[i+1]-ps[i]).length)
 out=[];j=0
 for i in range(n):
  d=ds[-1]*i/n
  while ds[j+1]<d:j+=1
  out.append(ps[j].lerp(ps[j+1],(d-ds[j])/(ds[j+1]-ds[j])))
 return out

def grain_material(m,scale,strength):
 # Editable Blender procedural leather; runtime uses matching world-space grain.
 b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'); nt=m.node_tree
 tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=2;tex.inputs['Roughness'].default_value=.7
 bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=strength
 nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],b.inputs['Normal'])
for m in [leather,lining,lace]:grain_material(m,145,.011)
grain_material(orange,180,.014);grain_material(white,210,.002)
welting=mat('Glove / rolled dark welting','60391f',.75);thread=mat('Glove / saddle thread','bb9160',.8);edgehide=mat('Glove / cut leather edge','bd8050',.78);holemat=mat('Glove / punched eyelet interior','372518',.9)
# Eight-panel basketball with physically recessed grooves on a uniform sphere.
# A figure-eight cover edge and two 45-degree bisecting great circles reproduce
# Spalding's cross + opposing U-arc pattern, including its deeply curved side panels.
# A uniform spherical mesh avoids singularities where a cover edge doubles back in
# longitude. The black inlays follow the recessed surface; none are raised tubes.
group='about-room-basketball';radius=1.169;centre=Vector((3.828,-1.609+radius,5.618))
front=Vector((3.672,2.44,3.882)).normalized();right=Vector((0,1,0)).cross(front).normalized();top=front.cross(right).normalized()
rot=Matrix((right,top,front)).transposed() @ Matrix.Rotation(math.pi/4+.10,3,'Z')
def bp(p):return centre+rot@p
paths=[[seam(i*math.tau/768,.625) for i in range(768)]]
for phi in [math.pi/4,3*math.pi/4]:
 paths.append([Vector((math.cos(phi)*math.cos(i*math.tau/768),math.sin(phi)*math.cos(i*math.tau/768),math.sin(i*math.tau/768))) for i in range(768)])
kd=KDTree(768)
for i,p in enumerate(paths[0]):kd.insert(p,i)
kd.balance()
n1=Vector((1,-1,0)).normalized();n2=Vector((1,1,0)).normalized()
def groove(p):return min(abs(p.dot(n1)),abs(p.dot(n2)),kd.find(p)[2])
def recessed_radius(p):return radius*(1-.017*math.exp(-(groove(p)/.026)**2))
ball=uv('Eight-panel leather skin',centre,(1,1,1),orange,256,144)
for v in ball.data.vertices:
 p=v.co.normalized();v.co=rot@p*recessed_radius(p)
for index,path in enumerate(paths):
 verts=[];faces=[];N=len(path);across=4
 for i,p in enumerate(path):
  tangent=(path[(i+1)%N]-path[(i-1)%N]).normalized();side=p.cross(tangent).normalized()
  for j in range(across+1):
   q=(p+side*((j/across-.5)*.027)).normalized();verts.append(bp(q*(recessed_radius(q)+.012)))
 for i in range(N):
  for j in range(across):
   a0=i*(across+1)+j;b0=((i+1)%N)*(across+1)+j;faces.append((a0,b0,b0+1,a0+1))
 mesh('Inset moulded rubber channel '+str(index+1),verts,faces,ink)
valve_n=(rot@Vector((.27,.70,.66))).normalized()
valve=uv('Recessed inflation valve',centre+valve_n*(radius-.006),(.026,.026,.005),ink,24,12);valve.rotation_euler=Vector((0,0,1)).rotation_difference(valve_n).to_euler()
# Baseball glove: cupped palm with a separately padded back, shaped finger shells,
# raised dual welting, H-web, punched holes and flattened rawhide laces.
group='about-room-baseball';origin=Vector((5.18,4.80,.65))
def gp(p):return origin+Vector((p[2],p[1],-p[0]))
def palm(x,z):
 return .13+.28*(x/.90)**2+.21*((z+.13)/.93)**2+.07*max(0,-z)
N=72;M=28;verts=[];faces=[]
for j in range(M+1):
 r=j/M
 for i in range(N):
  a=i*math.tau/N;x=.90*r*math.cos(a);z=.87*r*math.sin(a)-.08
  verts.append(gp((x,palm(x,z),z)))
for j in range(M):
 for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
o=mesh('Cupped full-grain palm',verts,faces,leather);o.data.materials.append(lining)
sol=o.modifiers.new('Padded palm and darker interior backing','SOLIDIFY');sol.thickness=.085;sol.material_offset=1
# Rounded finger sleeves curl inward above the pocket. The volume is padded and
# closed at the toe; there are no flat cut caps or ladder-like bars on the fingers.
def finger(name,controls,width,depth):
 controls=[Vector(p) for p in controls]
 controls[0].y=palm(controls[0].x,controls[0].z)-.032
 NU=52;NV=28;verts=[];faces=[]
 def path(t):
  a,b,c,d=controls;return a*(1-t)**3+b*(3*(1-t)**2*t)+c*(3*(1-t)*t*t)+d*t**3
 def point(t,a):
  p=path(t);tangent=(path(min(1,t+.0001))-path(max(0,t-.0001))).normalized()
  side=Vector((1,0,0));side=(side-tangent*side.dot(tangent)).normalized();top=side.cross(tangent).normalized()
  cap=math.sqrt(max(.00001,1-((t-.69)/.31)**2)) if t>.69 else 1.
  belly=.80+.20*math.sin(math.pi*t)
  u=min(1.,t/.30);root_pad=.07+.93*(u*u*(3-2*u))
  return p+side*(math.cos(a)*width*belly*cap)+top*(math.sin(a)*depth*belly*cap*root_pad)
 for j in range(NU+1):
  for i in range(NV):verts.append(gp(point(j/NU,i*math.tau/NV)))
 for j in range(NU):
  for i in range(NV):faces.append(((j+1)*NV+i,(j+1)*NV+(i+1)%NV,j*NV+(i+1)%NV,j*NV+i))
 faces.append(tuple(reversed(range(NV))));faces.append(tuple(NU*NV+i for i in range(NV)))
 mesh(name,verts,faces,leather)
 # One continuous U-shaped welt follows both side edges and the rounded toe.
 left=[gp(point(.08+.92*i/80,.37)) for i in range(81)]
 right=[gp(point(.08+.92*i/80,math.pi-.37)) for i in range(81)]
 tube(name+' continuous rolled toe welt',left+list(reversed(right)),.012,welting)
 for edge in [left,right]:
  for i in range(2,73,4):tube(name+' fine side saddle stitch',[edge[i]+Vector((0,.009,0)),edge[i+1]+Vector((0,.009,0))],.0042,thread)
 # A continuous rawhide thong loops around the side/toe edge through paired holes.
 # It never spans the palm-facing surface of the finger like a ladder rung.
 for side in [1,-1]:
  stations=[.45,.55,.65,.75,.84,.91,.97];pts=[]
  def angle(v):return v if side==1 else math.pi-v
  for i,t in enumerate(stations):
   top=gp(point(t,angle(.82)));uv(name+' side eyelet',top,(.015,.006,.015),holemat,12,6)
   for j in range(7):
    f=j/6;a=.82-1.45*f;tt=min(.993,t+(.065*f if i<len(stations)-1 else .005*f));pts.append(gp(point(tt,angle(a))))
  tube(name+' edge rawhide return loops',pts,.0105,lace)
 return path
finger('Little finger',[(-.58,.27,-.04),(-.88,.45,-.46),(-.97,1.00,-1.05),(-.73,1.05,-.90)],.218,.143)
finger('Ring finger',[(-.27,.23,-.17),(-.46,.49,-.64),(-.52,1.27,-1.29),(-.38,1.21,-1.04)],.229,.151)
finger('Middle finger',[(.11,.24,-.20),(.02,.55,-.68),(-.01,1.43,-1.34),(.08,1.29,-1.10)],.237,.158)
finger('Index finger',[(.44,.32,-.17),(.44,.57,-.63),(.44,1.40,-1.26),(.46,1.26,-1.02)],.236,.155)
finger('Sculpted thumb',[(.62,.32,.30),(1.08,.45,.23),(1.17,1.15,-.38),(.87,1.05,-.54)],.267,.175)
# Bound heel opening; leather folds taper into the wrist rather than a circular bowl.
heel=[]
for i in range(65):
 a=.05+(math.pi-.10)*i/64;x=.90*math.cos(a);z=.73*math.sin(a)-.08;heel.append(gp((x,palm(x,z)+.026,z)))
tube('Heel rolled binding',heel,.061,edgehide)
for i in range(4,61,3):
 p=heel[i];q=heel[i+1];tube('Heel double saddle stitches',[p+Vector((0,.047,-.027)),q+Vector((0,.047,-.027))],.006,thread)
# H-web cut from three flat leather straps, with softened edges and real edge
# saddle stitches. The cross bridge bows gently into the pocket under tension.
def strap(name,p0,p1,width,side):
 p0=Vector(p0);p1=Vector(p1);side=Vector(side).normalized();verts=[];faces=[];N=24;thick=.028
 for i in range(N+1):
  t=i/N;p=p0.lerp(p1,t);p.y-=.035*math.sin(math.pi*t)
  for k in range(4):
   dx=[-1,1,1,-1][k];dy=[-1,-1,1,1][k]
   verts.append(gp(p+side*(dx*width*.5)+Vector((0,dy*thick*.5,0))))
 for i in range(N):
  for k in range(4):faces.append((i*4+k,i*4+(k+1)%4,(i+1)*4+(k+1)%4,(i+1)*4+k))
 faces.extend([(3,2,1,0),tuple(N*4+k for k in range(4))]);o=mesh(name,verts,faces,leather)
 import bmesh
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();bevel(o,.009,3)
 for sign in [-1,1]:
  ps=[]
  for i in range(N+1):
   t=i/N;p=p0.lerp(p1,t);p.y-=.035*math.sin(math.pi*t);ps.append(gp(p+side*(sign*width*.35)+Vector((0,thick*.5+.005,0))))
  for i in range(1,N-1,2):tube(name+' saddle sewing',[ps[i],ps[i+1]],.004,thread)
 return p0,p1
strap('H web index-side leather post',(.54,.70,-.51),(.57,1.16,-.94),.145,(1,0,.1))
strap('H web thumb-side leather post',(.92,.66,-.14),(.96,1.10,-.49),.145,(1,0,.1))
strap('H web flat cross bridge',(.55,.97,-.76),(.95,.93,-.35),.183,(0,.8,-.6))
for x,y,z in [(.55,.97,-.76),(.95,.93,-.35)]:
 # Two crossed stitches join the bridge to each post through four visible holes.
 for dx in [-.047,.047]:
  for dz in [-.047,.047]:uv('Bridge stitch hole',gp((x+dx,y+.023,z+dz)),(.012,.006,.012),holemat,12,6)
 for sign in [-1,1]:
  tube('Cross-stitched bridge attachment',[gp((x-.047,y+.027,z-sign*.047)),gp((x,y+.044,z)),gp((x+.047,y+.027,z+sign*.047))],.0085,lace)
# Rawhide lacing around heel, with short tied tails.
for i in range(4,61,5):
 p=heel[i];tube('Heel cross lace',[p+Vector((-.055,.03,-.06)),p+Vector((0,.055,0)),p+Vector((.055,.025,.06))],.014,lace)
for dx in [-.07,.07]:tube('Tied rawhide ends',[gp((-.76,.54,.37)),gp((-.89+dx,.49,.67)),gp((-.94+dx,.35,.85))],.020,lace)
ballBegin=len(parts[group])
# Regulation proportion: 74 mm baseball vs a 242 mm basketball, one uninterrupted
# seam around two figure-eight cowhide covers, 108 equally spaced DOUBLE stitches.
bc=gp((-.04,.535,-.25));br=radius*(.074/.242)
base=uv('Two-piece cowhide baseball',bc,(br,)*3,white,128,80)
brot=Matrix.Rotation(.42,3,'Y') @ Matrix.Rotation(.62,3,'X')
curve=lambda t: brot@seam(t,.75)
pts=arc_samples(curve,1296)
kd=KDTree(len(pts))
for i,p in enumerate(pts):kd.insert(p,i)
kd.balance()
# Fine depressed leather split; stitches arch above it and enter paired needle holes.
for v in base.data.vertices:
 d=kd.find(v.co.normalized())[2];v.co*=1-.006*math.exp(-(d/.019)**2)
tube('One continuous figure-eight leather seam',[bc+p*br*.998 for p in pts],.0022,lining,True)
stations=arc_samples(curve,108)
for i,n in enumerate(stations):
 n=n.normalized();t=(stations[(i+1)%108]-stations[(i-1)%108]).normalized();side=n.cross(t).normalized()
 for arm in [-1,1]:
  # 216 individual diagonal legs; equal arc-length spacing avoids polar bunching.
  start=(n+side*(arm*.042)-t*.021).normalized();end=(n+t*.014).normalized()
  points=[]
  for j in range(7):
   f=j/6;v=start.lerp(end,f).normalized();points.append(bc+v*(br+.0035*math.sin(f*math.pi)))
  tube('Double stitch %03d %s'%(i+1,arm),points,.0031,red)
  hp=bc+start*(br-.0004);o=uv('Needle puncture',hp,(.0044,.0044,.0017),lining,10,6);o.rotation_euler=Vector((0,0,1)).rotation_difference(start).to_euler()
baseballParts=parts[group][ballBegin:]
# MacBook body: capture screen is kept live at its exact existing plane.
group='about-room-macbook'
box('Unibody lower shell',(4.37,4.875,-4.06),(1.94,.10,2.76),silver,.065)
box('Bottom seam',(4.37,4.83,-4.06),(1.90,.026,2.72),ink,.04)
box('Keyboard recessed tray',(4.07,4.933,-4.06),(1.07,.012,2.35),black,.06)
for row in range(6):
 for col in range(14):
  x=3.64+row*.162;z=-5.13+col*.165
  box('Keycap',(x,4.956,z),(.137,.028,.142),black,.018)
  if row<5:text('Key legend',str((col+row*14)%10) if row==0 else 'QWERTYUIOPASDF'[col],(x,4.974,z),.053,legend,(-math.pi/2,0,-math.pi/2))
box('Space bar',(4.48,4.96,-4.06),(.12,.03,1.08),black,.02)
box('Trackpad bevel',(4.91,4.933,-4.06),(.49,.013,1.32),edge,.035)
box('Glass trackpad',(4.91,4.942,-4.06),(.47,.01,1.29),silver,.025)
for z in [-5.32,-2.8]:
 for ix in range(24):
  for iz in range(3):box('Speaker perforation',(3.65+ix*.043,4.941,z+iz*.028),(.012,.004,.012),ink,0)
# Lid basis: width along Z; up slants toward wall (-X).
up=Vector((-.37,.929,0));normal=Vector((.929,.37,0));lc=Vector((3.07,5.798,-4.06))
lid=box('Display aluminum lid',lc-normal*.057,(.07,1.96,2.76),silver,.045);lid.rotation_euler.z=math.asin(.37)
for side in [-1,1]:
 o=box('Display side bezel',lc+Vector((0,0,side*1.357)),(.026,1.94,.034),black,.009);o.rotation_euler.z=math.asin(.37)
 o=box('Display top bottom bezel',lc+up*(side*.953)+normal*.015,(.025,.045,2.74),black,.007);o.rotation_euler.z=math.asin(.37)
uv('Webcam',lc+up*.945+normal*.035,(.014,.014,.014),ink,16,8)
# Fuse the padded hide where fingers grow out of the palm, preserving finger gaps
# and eliminating the hard cut ends that made the previous glove look assembled
# from separate tubes. A small voxel gives the hand-broken leather transitions.
body_names={'Cupped full-grain palm','Little finger','Ring finger','Middle finger','Index finger','Sculpted thumb'}
body=[o for o in parts['about-room-baseball'] if o.name in body_names]
parts['about-room-baseball']=[o for o in parts['about-room-baseball'] if o not in body]
bpy.ops.object.select_all(action='DESELECT')
for o in body:o.select_set(True)
bpy.context.view_layer.objects.active=body[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();o=bpy.context.object;o.name='Continuous sculpted leather glove'
o.data.remesh_voxel_size=.021;bpy.ops.object.voxel_remesh()
smooth=o.modifiers.new('Broken-in leather softness','SMOOTH');smooth.factor=.55;smooth.iterations=4
simplify=o.modifiers.new('Web mesh budget','DECIMATE');simplify.ratio=.57
for f in o.data.polygons:f.use_smooth=True
parts['about-room-baseball'].append(o)
# Apply manufacturing modifiers and retain three assemblies for existing hotspots.
for name,objs in parts.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.convert(target='MESH')
 if name=='about-room-baseball':
  for part in baseballParts:
   vg=part.vertex_groups.new(name='Preserved baseball');vg.add(list(range(len(part.data.vertices))),1.,'REPLACE')
 bpy.ops.object.join();o=bpy.context.object;o.name=name
# Bake geometry occlusion into vertex colours, independent of the room's lighting.
assemblies=[o for o in bpy.context.scene.objects if o.type=='MESH']
# Seat both assemblies on measured receiver planes, rather than retaining the old
# guitar stand's slightly elevated bounding-box floor.
seatingDelta={}
for o in assemblies:
 if o.name in ['about-room-basketball','about-room-baseball']:
  floor=-1.635 if 'basketball' in o.name else 4.78085
  bottom=min((o.matrix_world@v.co).y for v in o.data.vertices)
  seatingDelta[o.name]=floor+.002-bottom
  o.location.y+=seatingDelta[o.name]
bpy.context.view_layer.update()
# Keep the already-reviewed baseball pose as the leather shell is refined around it.
o=bpy.data.objects['about-room-baseball'];vg=o.vertex_groups['Preserved baseball'].index
delta=Vector((4.929983616,5.268179893,.690010548))-(bc+Vector((0,seatingDelta[o.name],0)))
localDelta=o.matrix_world.inverted().to_3x3()@delta
for v in o.data.vertices:
 if any(g.group==vg and g.weight>.5 for g in v.groups):v.co+=localDelta
# Web-only topology reduction preserves all baseball, lacing and seam vertices.
import sys
sys.path.insert(0,str(Path(__file__).parent))
from optimize_room_glove import optimize_glove
print('GLOVE_WEB_OPTIMIZATION', optimize_glove(bpy.data.objects['about-room-baseball'],up_axis=1),flush=True)
verts=[];polys=[]
for o in assemblies:
 off=len(verts);verts.extend([o.matrix_world@v.co for v in o.data.vertices]);polys.extend([tuple(off+i for i in p.vertices) for p in o.data.polygons])
bvh=BVHTree.FromPolygons(verts,polys,all_triangles=False)
random.seed(11);golden=math.pi*(3-math.sqrt(5))
for o in assemblies:
 if 'basketball' in o.name:
  # Explicit radial shading normals avoid long interpolation creases at polar
  # panel boundaries; geometric shoulder recesses remain in the silhouette.
  o.data.normals_split_custom_set_from_vertices([tuple(v.co.normalized()) for v in o.data.vertices])
 attr=o.data.color_attributes.new(name='RoomAO',type='FLOAT_COLOR',domain='POINT')
 for i,v in enumerate(o.data.vertices):
  if 'macbook' in o.name or 'basketball' in o.name:ao=1.
  else:
   p=o.matrix_world@v.co;n=(o.matrix_world.to_3x3()@v.normal).normalized();up=Vector((0,1,0)) if abs(n.y)<.95 else Vector((1,0,0));a=n.cross(up).normalized();b=n.cross(a).normalized();occ=0.
   for k in range(20):
    r=math.sqrt((k+.5)/20);phi=k*golden;d=a*(r*math.cos(phi))+b*(r*math.sin(phi))+n*math.sqrt(1-r*r)
    hit=bvh.ray_cast(p+n*.002,d,.70)
    if hit[0] is not None:occ+=max(0.,1-hit[3]/.70)
   ao=max(.33,1-occ/20*.88)
  attr.data[i].color=(ao,ao,ao,1.)
 for m in o.data.materials:
  if not m or not m.use_nodes:continue
  nt=m.node_tree
  if any(n.name=='Room AO' for n in nt.nodes):continue
  bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');at=nt.nodes.new('ShaderNodeVertexColor');at.layer_name='RoomAO';at.name='Room AO'
  mul=nt.nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=bs.inputs['Base Color'].default_value;nt.links.new(at.outputs['Color'],mul.inputs[2]);nt.links.new(mul.outputs[0],bs.inputs['Base Color'])
print('ROOM_AO_COMPLETE',flush=True)
# Transparent receiver masks from the actual evaluated glove/ball geometry. Sampling
# the same key direction as roomSurface means finger/web silhouettes and soft penumbra
# agree with the shading, without lighting the original baked room a second time.
out=R/'public/models/room-props';out.mkdir(parents=True,exist_ok=True)
key=Vector((.38,.86,.34)).normalized();side=key.cross(Vector((0,1,0))).normalized();cross=side.cross(key).normalized()
shadow_specs=[('basketball',3.44,5.26,-1.631,4.3,4.3),('baseball',4.85,.65,4.784,3.6,3.7)]
for name,cx,cz,y,w,h in shadow_specs:
 ob=bpy.data.objects['about-room-'+name];vs=[ob.matrix_world@v.co for v in ob.data.vertices];fs=[tuple(p.vertices) for p in ob.data.polygons];tree=BVHTree.FromPolygons(vs,fs)
 N=256;pixels=[]
 for iz in range(N):
  for ix in range(N):
   p=Vector((cx+((ix+.5)/N-.5)*w,y,cz+((iz+.5)/N-.5)*h));shade=0.;ambient=0.
   for k in range(24):
    r=math.sqrt((k+.5)/24);a=k*golden;d=(key+side*(r*math.cos(a)*.19)+cross*(r*math.sin(a)*.19)).normalized()
    if tree.ray_cast(p,d,6)[0] is not None:shade+=1
   for k in range(12):
    r=math.sqrt((k+.5)/12);a=k*golden;d=Vector((r*math.cos(a),math.sqrt(1-r*r),r*math.sin(a)));hit=tree.ray_cast(p,d,.8)
    if hit[0] is not None:ambient+=1-hit[3]/.8
   alpha=min(.72,shade/24*.34+ambient/12*.59);pixels.extend((.075,.060,.045,alpha))
 im=bpy.data.images.new('Baked '+name+' contact and penumbra',N,N,alpha=True);im.pixels.foreach_set(pixels);im.filepath_raw=str(out/(name+'-shadow.png'));im.file_format='PNG';im.save()
print('ROOM_SHADOWS_COMPLETE',flush=True)
# Rotate complete world transforms from Three Y-up into Blender Z-up, exactly once.
for o in assemblies:
 o.rotation_euler.x=math.pi/2;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 loc=o.location.copy();o.location=(loc.x,-loc.z,loc.y)
# Keep render materials in .blend; glTF gets original base swatches + AO vertex colours.
(R/'assets/3d').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'assets/3d/about-room-props.blend'))
for m in bpy.data.materials:
 if m.use_nodes:
  bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if bs:
   for link in list(bs.inputs['Base Color'].links):m.node_tree.links.remove(link)
   bs.inputs['Base Color'].default_value=m.diffuse_color
bpy.ops.export_scene.gltf(filepath=str(R/'public/models/about-room-props.glb'),export_format='GLB',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=14,export_vertex_color='ACTIVE')
print('ROOM_PROPS_EXPORTED',flush=True)
