/** holo-card@1.0.1: the Blender graph's real-time counterpart.
 * Four registered image layers; signed depths are measured in the canonical card
 * frame, NOT the exported plane's X=90 degree mesh frame. glTF flips V on export,
 * so restore it exactly once here. Image samples remain encoded until compositing.
 */
export const holoVertex = `varying vec2 vUv;
void main(){vUv=vec2(uv.x,1.-uv.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

const common = `precision highp float;
varying vec2 vUv;
uniform float uTime,uFoil,uScale,uDepth,uBgDepth;
uniform vec3 uView;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
vec3 spectrum(float t){t=fract(t);if(t<.35)return mix(vec3(1.,.32,.62),vec3(1.,.85,.32),t/.35);if(t<.7)return mix(vec3(1.,.85,.32),vec3(.22,.62,1.),(t-.35)/.35);return mix(vec3(.22,.62,1.),vec3(1.),(t-.7)/.3);}
vec3 overlay(vec3 b,vec3 f){return mix(2.*b*f,1.-2.*(1.-b)*(1.-f),step(vec3(.5),b));}
vec3 printToLinear(vec3 c){return mix(pow((c+.055)/1.055,vec3(2.4)),c/12.92,step(c,vec3(.04045)));}
float inside(vec2 p){return step(0.,p.x)*step(0.,p.y)*step(p.x,1.)*step(p.y,1.);}
vec2 parallax(vec2 p,float scale,float depth){return (p-.5)*scale+.5+uView.xy/max(abs(uView.z),.35)*depth*.14;}
float wave(vec2 p){vec2 a=p+uView.xy*2.4;return .5+.5*sin((a.x*.848-a.y*.530)*6.283*.55+7.*noise(a*1.5));}
float stars(vec2 p){
 vec2 q=p*105.,id=floor(q),f=fract(q);float first=9.,second=9.;
 for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){
  vec2 g=vec2(float(x),float(y));vec2 o=vec2(hash(id+g),hash(id+g+43.3));
  float d=length(g+o-f);if(d<first){second=first;first=d;}else second=min(second,d);
 }}
 float edge=1.-smoothstep(.01,.035,second-first);
 float sparse=step(.90,hash(id+8.8));
 float twinkle=pow(.5+.5*sin(uTime*1.8+hash(id)*30.+uView.x*27.+uView.y*21.),6.);
 return edge*sparse*twinkle;
}
`;

export const holoFragment = common + `
uniform sampler2D tSubject,tBackground,tText,tLine;
void main(){
 vec2 uv=vUv;
 // The 1.25 subject UV control and the .8 safe-area registration compensate
 // at rest; the signed view offset still places the person ahead of the print.
 vec2 su=parallax(uv,uScale,uDepth)*.8+.1;
 vec2 bu=parallax(uv,1.,uBgDepth);
 vec4 sub=texture2D(tSubject,clamp(su,0.,1.));sub.a*=inside(su);
 vec3 bg=texture2D(tBackground,clamp(bu,0.,1.)).rgb;
 float pattern=dot(texture2D(tBackground,uv).rgb,vec3(.2126,.7152,.0722));
 float w=wave(uv);
 vec3 foil=spectrum(w*(.70+.3*pattern)+pattern*.12);
 vec3 subject=mix(sub.rgb,overlay(sub.rgb,foil),uFoil*.20);
 bg=mix(bg,overlay(bg,foil),uFoil*.32);
 vec3 col=mix(bg,subject,sub.a);
 float sweep=pow(max(0.,sin((uv.x*.83+uv.y*.35+uView.x*1.8+uView.y*.9)*6.283)),12.);
 // Etched diffraction remains visible even in the resting pose; movement shifts
 // spectral bands rather than gating the entire foil with an interaction class.
 float grooves=.5+.5*sin((uv.x*.848-uv.y*.530)*1600.+uView.x*40.);
 col+=foil*(sweep*.48+grooves*.026)*uFoil;
 float line=1.-smoothstep(.06,.25,texture2D(tLine,clamp(su,0.,1.)).r);
 // Source-derived contours are denser than the earlier regenerated line art;
 // keep their glow sparse enough that the original print retains its colour.
 col+=vec3(1.,.94,.78)*line*inside(su)*sub.a*sweep*uFoil*.28;
 col+=vec3(.66,.86,1.)*stars(bu)*uFoil*1.25*(1.-sub.a*.85);
 vec4 text=texture2D(tText,uv);col=mix(col,text.rgb,text.a);
 gl_FragColor=vec4(printToLinear(max(col,vec3(0.))),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export const holoEdgeFragment = common + `void main(){
 vec3 col=mix(vec3(.40,.45,.49),spectrum(wave(vUv)),.75)*.80+.14;
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
