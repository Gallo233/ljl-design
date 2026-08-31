/*
 * Mechanism-only baseline adapted from Viscose Carousel.
 * MIT License, Copyright (c) 2026 Yousuf Soomro.
 * No upstream images or commercial fonts are included.
 */
const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl2", { antialias: false, alpha: true });
if (!gl) throw new Error("WebGL2 is required for this baseline");

const vertex = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){ vUv=aPosition*.5+.5; gl_Position=vec4(aPosition,0.,1.); }`;

const fragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform vec4 uCards[3];
uniform vec4 uMouse;
uniform vec4 uMelt;
uniform float uTime;

float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q=abs(p)-b+r;
  return min(max(q.x,q.y),0.)+length(max(q,0.))-r;
}
float smin(float a,float b,float k){
  if(k<=.0001) return min(a,b);
  float h=clamp(.5+.5*(b-a)/k,0.,1.);
  return mix(b,a,h)-k*h*(1.-h);
}
float sdBridge(vec2 p,vec2 a,vec2 b,float rEnd,float rMid,float sag){
  vec2 ba=b-a; float len=length(ba); if(len<.001)return 1e6;
  vec2 dir=ba/len,nrm=vec2(-dir.y,dir.x),q=p-(a+b)*.5;
  float along=dot(q,dir),across=dot(q,nrm);
  float h=clamp(along/len+.5,0.,1.),bell=sin(3.14159265*h);
  across+=sag*bell*nrm.y;
  float taper=pow(1.-bell,1.7),r=mix(rMid,rEnd,taper);
  return max(abs(along)-len*.5,abs(across)-r);
}
void main(){
  vec2 p=(vUv-.5)*uResolution;
  float toMouse=length(p-uMouse.xy);
  float k=28.;
  if(uMouse.z>.001){ float t=1.-smoothstep(0.,max(uMelt.x,1.),toMouse); k+=uMouse.w*uMouse.z*t*t; }
  float d=1e6;
  for(int i=0;i<3;i++) d=smin(d,sdRoundBox(p-uCards[i].xy,uCards[i].zw,18.),k);
  for(int i=0;i<2;i++){
    vec2 a=uCards[i].xy,b=uCards[i+1].xy;
    float gap=max(0.,length(b-a)-uCards[i].z-uCards[i+1].z);
    float v=clamp(gap/320.,0.,1.);
    float w=pow(1.-v,.4),rEnd=42.*w-2.9;
    float rMid=rEnd*(1.-.65*smoothstep(0.,.7,v));
    d=smin(d,sdBridge(p,a,b,rEnd,rMid,10.*pow(v,1.5)),min(16.*smoothstep(0.,.35,v),max(rMid,0.)*1.5));
  }
  if(uMelt.y>.001) d+=sin(toMouse*uMelt.z-uTime*uMelt.w)*uMelt.y*exp(-toMouse/max(uMelt.x,1.));
  float aa=clamp(fwidth(d),.5,2.); float alpha=1.-smoothstep(-aa,aa,d);
  if(alpha<.001) discard;
  vec3 ink=mix(vec3(.035),vec3(.11,.24,.27),smoothstep(-22.,2.,d));
  outColor=vec4(ink,alpha);
}`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}
const program=gl.createProgram();
gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
const aPosition=gl.getAttribLocation(program,"aPosition"); gl.enableVertexAttribArray(aPosition); gl.vertexAttribPointer(aPosition,2,gl.FLOAT,false,0,0);
const loc={
  resolution:gl.getUniformLocation(program,"uResolution"), cards:gl.getUniformLocation(program,"uCards"),
  mouse:gl.getUniformLocation(program,"uMouse"), melt:gl.getUniformLocation(program,"uMelt"), time:gl.getUniformLocation(program,"uTime")
};
let progress=0,velocity=0,dragging=false,lastX=0,lastT=0;
let mouseX=0,mouseY=0,presence=0,wake=0,prevX=0,prevY=0,prevPointerT=performance.now();
function resize(){ const dpr=Math.min(devicePixelRatio,1.5); canvas.width=Math.round(innerWidth*dpr); canvas.height=Math.round(innerHeight*dpr); gl.viewport(0,0,canvas.width,canvas.height); }
addEventListener("resize",resize); resize();
canvas.addEventListener("wheel",e=>{ e.preventDefault(); const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY; velocity=Math.max(-2.8,Math.min(2.8,velocity+d*.0018)); },{passive:false});
canvas.addEventListener("pointerdown",e=>{ dragging=true;lastX=e.clientX;lastT=performance.now();canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove",e=>{
  const now=performance.now(),dt=Math.max(8,now-prevPointerT),speed=Math.hypot(e.clientX-prevX,e.clientY-prevY)/dt;
  mouseX=e.clientX-innerWidth/2; mouseY=innerHeight/2-e.clientY; presence=1; wake=Math.min(1,speed*.55); prevX=e.clientX;prevY=e.clientY;prevPointerT=now;
  if(dragging){ const t=performance.now(),dx=e.clientX-lastX; progress-=dx/innerWidth; velocity=-(dx/innerWidth)/(Math.max(8,t-lastT)/1000);lastX=e.clientX;lastT=t; }
});
canvas.addEventListener("pointerleave",()=>{presence=0;});
canvas.addEventListener("pointerup",e=>{dragging=false;canvas.releasePointerCapture(e.pointerId);});
const cards=new Float32Array(12);
let previous=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-previous)/1000);previous=now;
  if(!dragging){progress+=velocity*dt;velocity*=Math.pow(.94,dt*60);if(Math.abs(velocity)<.18){const target=Math.round(progress);velocity+=(target-progress)*Math.min(1,dt*8);}}
  progress=Math.max(0,Math.min(2,progress));wake*=Math.pow(.9,dt*60);presence+=(presence>0?1-presence:-presence)*Math.min(1,dt*(presence>0?14:5));
  const spread=Math.min(1,Math.max(0,progress));const release=Math.min(1,Math.max(0,progress-1));
  const x0=-innerWidth*.26*spread, x1=innerWidth*.02*(1-release), x2=innerWidth*.30*spread+innerWidth*.08*release;
  cards.set([x0,40,Math.min(250,innerWidth*.17),74,x1,-30,Math.min(300,innerWidth*.21),120,x2,70,Math.min(230,innerWidth*.15),70]);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(loc.resolution,innerWidth,innerHeight);gl.uniform4fv(loc.cards,cards);
  gl.uniform4f(loc.mouse,mouseX,mouseY,presence,34);gl.uniform4f(loc.melt,260,4*wake,0.05,7);gl.uniform1f(loc.time,now*.001);
  gl.drawArrays(gl.TRIANGLES,0,6);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
