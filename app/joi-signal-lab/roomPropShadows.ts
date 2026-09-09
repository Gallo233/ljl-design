import * as THREE from "three";

/** Retire the old props' baked marks as well as their geometry. Re-sample a clean
 * point on the same planar surface; the UV Jacobian keeps this independent of atlas
 * packing. Restrict to the tabletop / floor and feather the repair at its boundary. */
export function retirePropShadows(model: any, ownedTextures: any[] = []) {
  const patch = (name: string, floor: boolean) => {
    const node=model.getObjectByName(name);
    if (!node?.material?.isShaderMaterial) return;
    const material=node.material.clone();
    material.vertexShader=material.vertexShader.replace('varying vec2 vBakeUv;', 'varying vec2 vBakeUv; varying vec3 vSurfacePosition;').replace('vBakeUv = uv;', 'vBakeUv = uv; vSurfacePosition = (modelMatrix * vec4(position,1.0)).xyz;');
    material.fragmentShader=material.fragmentShader.replace('varying vec2 vBakeUv;', 'varying vec2 vBakeUv; varying vec3 vSurfacePosition;').replace('gl_FragColor =', `
      vec2 px=dFdx(vSurfacePosition.xz), py=dFdy(vSurfacePosition.xz);
      vec2 ux=dFdx(vBakeUv), uy=dFdy(vBakeUv);
      float det=px.x*py.y-px.y*py.x;
      vec2 centre=${floor ? 'vec2(3.2,9.0)' : 'vec2(5.1,.5)'};
      vec2 halfSize=${floor ? 'vec2(1.9,2.2)' : 'vec2(1.65,2.55)'};
      vec2 q=abs(vSurfacePosition.xz-centre)-halfSize;
      float mask=(1.-smoothstep(-.18,.15,max(q.x,q.y)))*${floor ? '(1.-smoothstep(.03,.08,abs(vSurfacePosition.y+1.635)))' : '(1.-smoothstep(.02,.08,abs(vSurfacePosition.y-4.78)))'};
      if(mask>0. && abs(det)>.00000001){
        vec2 delta=${floor ? 'vec2(6.2,9.1)' : 'vec2(6.7,-5.9)'}-vSurfacePosition.xz;
        vec2 screenDelta=vec2(delta.x*py.y-delta.y*py.x,px.x*delta.y-px.y*delta.x)/det;
        vec2 cleanUv=vBakeUv+ux*screenDelta.x+uy*screenDelta.y;
        vec3 clean=texture2D(uBake,cleanUv).rgb;
        baked=mix(baked,clean,mask);
      }
      gl_FragColor =`);
    node.material=material;
  };
  patch('Cube001_mate_0001',false);
  patch('Cube001_mate_0002',false);
  patch('env',true);
  // Blender ray-traced masks from the real replacement meshes: the ball's contact
  // patch, glove fingers, H-web and soft penumbra use ROOM_KEY_DIR, the same direction
  // as roomSurface. They are receiver marks on the existing table/floor, not lights.
  const specs = [
    { name: "basketball", x: 3.44, z: 5.26, y: -1.631, w: 4.3, h: 4.3 },
    { name: "baseball", x: 4.85, z: .65, y: 4.784, w: 3.6, h: 3.7 },
  ];
  for (const spec of specs) {
    const geometry=new THREE.PlaneGeometry(spec.w,spec.h);
    const material=new THREE.ShaderMaterial({ transparent:true,depthWrite:false,toneMapped:false,
      uniforms:{uShadow:{value:null}},
      vertexShader: 'varying vec2 vUv; void main(){vUv=vec2(uv.x,1.-uv.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform sampler2D uShadow;varying vec2 vUv;void main(){vec4 s=texture2D(uShadow,vUv);gl_FragColor=vec4(.075,.060,.045,s.a);}',
    });
    const shadow=new THREE.Mesh(geometry,material);shadow.name=`baked-${spec.name}-contact-shadow`;
    shadow.rotation.x=-Math.PI/2;shadow.position.set(spec.x,spec.y,spec.z);
    shadow.renderOrder=2;shadow.visible=false;model.add(shadow);
    const texture=new THREE.TextureLoader().load(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/models/room-props/${spec.name}-shadow.png?v=2`,
      () => {
        material.uniforms.uShadow.value=texture;shadow.visible=true;
        if(spec.name === "basketball") {
          const fallback=model.getObjectByName("about-room-ball-corner");
          fallback?.children.forEach((child:any)=>{ if(child.name !== "about-room-basketball" && child.name !== "retired-procedural-basketball") child.visible=false; });
        }
      }, undefined, () => { /* The old ball shadow remains if a texture is unavailable. */ },
    );
    texture.colorSpace=THREE.NoColorSpace;texture.anisotropy=4;ownedTextures.push(texture);
  }
}
