import * as THREE from "three";
import { labItems } from "../lab/labData";

/** Two actual still-life scenes, rendered only near their respective film frames. */
export function createReelStillLife(kind: "lab" | "contact", locale: "zh" | "en") {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(kind === 'lab' ? '#b8c7c9' : '#e3e4e0');
  const root = new THREE.Group(); scene.add(root);
  const camera = new THREE.PerspectiveCamera(33, 4/3, .1, 50);
  camera.position.set(kind === 'lab' ? 5.8 : 1.7, 6.8, 8.8); camera.lookAt(0,.25,0);
  scene.add(new THREE.HemisphereLight('#f4f6f5','#687a83',2.6));
  const key = new THREE.DirectionalLight('#fff6e8',3);key.position.set(-3,7,5);scene.add(key);
  const fill = new THREE.DirectionalLight('#a7cbdf',1.1);fill.position.set(5,2,-3);scene.add(fill);
  const textures:any[]=[];
  const materials:any[]=[];const geometries:any[]=[];
  function mat(color:string,metal=0,rough=.5,map?:any){const m=new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,...(map?{map}:{})});materials.push(m);return m;}
  const metal=mat('#758d91',.65,.36), rim=mat('#cbd5d5',.75,.28), dark=mat('#2e484d',.35),paper=mat('#f3f0e5'),cover=mat('#263f4d');
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:any,parent=root){
    // Extruded rounded profile gives real rolled edges instead of cube silhouettes.
    const r=Math.min(.055,w/6,h/6),s=new THREE.Shape();
    s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:Math.min(.02,d/4),bevelSize:.016,bevelSegments:2,steps:1,curveSegments:5});g.translate(0,0,-d/2);geometries.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;
  }
  function label(lines:string[],bg:string,ink:string){const c=document.createElement('canvas');c.width=1024;c.height=768;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,1024,768);ctx.strokeStyle='#a3b7c377';ctx.lineWidth=2;for(let y=136;y<740;y+=80){ctx.beginPath();ctx.moveTo(64,y);ctx.lineTo(960,y);ctx.stroke();}ctx.fillStyle=ink;ctx.font='500 43px ui-monospace, monospace';lines.forEach((line,i)=>ctx.fillText(line,76,130+i*80));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;textures.push(t);return mat('#ffffff',0,.75,t);}
  function print(w:number,h:number,x:number,y:number,z:number,m:any,parent=root){const g=new THREE.PlaneGeometry(w,h);geometries.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;}
  // Ground shadow is a soft transparent decal, avoiding an additional shadow map pass.
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!,grad=ctx.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'#172b3e66');grad.addColorStop(1,'#172b3e00');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);textures.push(t);const sm=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false});materials.push(sm);const shadow=print(8,6,0,-.29,0,sm);shadow.rotation.x=-Math.PI/2;
  let moving:any;
  if(kind==='lab'){
    // Open metal sleeve; drawer bottom, runners, rolled lip, recessed label holder.
    box(4.5,.14,3.45,0,-.15,-.6,metal);box(.14,1.75,3.45,-2.18,.68,-.6,metal);box(.14,1.75,3.45,2.18,.68,-.6,metal);box(4.5,1.75,.14,0,.68,-2.3,metal);
    const drawer=new THREE.Group();drawer.position.z=.65;root.add(drawer);moving=drawer;
    box(4.12,.12,3.6,0,-.02,0,dark,drawer);box(.07,.84,3.6,-2.02,.43,0,rim,drawer);box(.07,.84,3.6,2.02,.43,0,rim,drawer);
    box(4.3,1.1,.14,0,.5,1.8,metal,drawer);box(1.42,.42,.05,0,.65,1.9,rim,drawer);
    print(1.25,.28,0,.66,1.97,label(['THE LAB / 03'],'#f3f0e5','#253d49'),drawer);
    box(1.1,.11,.22,0,.24,2.02,dark,drawer);
    const colors=['#cfc7ad','#a5bbc0','#cf9074'];
    labItems.slice(0,3).forEach((item,i)=>{
      const folder=new THREE.Group();folder.position.set(0,.84+i*.20,.9-i*.77);folder.rotation.x=-.15;drawer.add(folder);
      box(3.75,1.78,.07,0,0,0,mat(colors[i]),folder);
      box(1.2,.30,.075,-1.18+i*1.17,1.0,0,mat(colors[i]),folder);
      const title=locale==='zh'?item.titleZh:item.title;
      print(3.42,1.4,0,.04,.081,label([item.index+' / '+item.tag,title,'',item.year+'   /   WORK IN PROGRESS'],colors[i],'#243b46'),folder);
    });
  }else{
    root.rotation.y=-.14;
    box(5.38,.12,4.13,0,-.10,0,cover);
    for(let i=0;i<7;i++)box(5.22,.019,4.0,0,i*.022-.02,0,i%2?paper:mat('#d4d8d4'));
    const page=print(5.18,3.96,0,.15,0,label(locale==='zh'?['06 / 联系','GALLO LIU','','18520455682@163.com','GITHUB / GALLO233','广州 · GMT+8']:['06 / CONTACT','GALLO LIU','','18520455682@163.com','GITHUB / GALLO233','GUANGZHOU · GMT+8'],'#f8f7ef','#29444e'));page.rotation.x=-Math.PI/2;
    for(let i=0;i<12;i++){
      const g=new THREE.TorusGeometry(.16,.026,8,28);geometries.push(g);const coil=new THREE.Mesh(g,rim);coil.position.set(-2.48,.18,-1.78+i*.325);root.add(coil);
    }
    const card=new THREE.Group();card.position.set(1.18,.27,1.06);card.rotation.y=-.2;root.add(card);box(1.75,.036,1.04,0,0,0,paper,card);const face=print(1.7,1,0,.045,0,label(['GALLO','SAY HELLO'],'#dae4df','#31515d'),card);face.rotation.x=-Math.PI/2;
    const pen=box(.10,.10,3.1,2.76,.04,-.2,dark);pen.rotation.y=-.10;
    moving=root;
  }
  return {scene,camera,update(time:number){if(kind==='lab')moving.position.z=.65+Math.sin(time*.3)*.08;else moving.rotation.y=-.14+Math.sin(time*.22)*.025;},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
