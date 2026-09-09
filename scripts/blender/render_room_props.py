"""Close-up quality views of the Blender-authored room props. No web assets changed."""
import bpy,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/3d/about-room-props.blend'))
def cv(p):return Vector((p[0],-p[2],p[1]))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral studio world');scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.8,.8,.8,1);bg.inputs[1].default_value=.3
scene.view_settings.view_transform='AgX'
out=root/'assets/3d/room-props-qa';out.mkdir(exist_ok=True)
for name,target,cam,floor in [('basketball',(3.828,-.44,5.618),(7.5,2.0,9.5),-1.635),('baseball',(5.1,5.25,.45),(8.25,8.3,4.0),4.78)]:
 for o in scene.objects:o.hide_render=o.name!='about-room-'+name
 bpy.ops.mesh.primitive_plane_add(size=200,location=cv((0,floor,0)));plane=bpy.context.object
 m=bpy.data.materials.new('Warm white receiver');m.diffuse_color=(.58,.57,.53,1);plane.data.materials.append(m)
 ld=bpy.data.lights.new('Large window','AREA');lo=bpy.data.objects.new('Large window',ld);scene.collection.objects.link(lo);lo.location=cv(Vector(target)+Vector((.38,.86,.34))*8);ld.energy=800;ld.shape='DISK';ld.size=4;lo.rotation_euler=(cv(target)-lo.location).to_track_quat('-Z','Y').to_euler()
 cd=bpy.data.cameras.new('Inspection camera');co=bpy.data.objects.new('Inspection camera',cd);scene.collection.objects.link(co);co.location=cv(cam);co.rotation_euler=(cv(target)-co.location).to_track_quat('-Z','Y').to_euler();cd.type='ORTHO';cd.ortho_scale=3.5 if name=='basketball' else 3.7;scene.camera=co
 scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(plane,do_unlink=True);bpy.data.objects.remove(lo,do_unlink=True);bpy.data.objects.remove(co,do_unlink=True)
