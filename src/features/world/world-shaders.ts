export const fullscreenVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
export const noiseGLSL = `
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise3(p)*.57+noise3(p*2.03+11.)*.28+noise3(p*4.11-7.)*.15;}
`;
export const skyFragment = `varying vec2 vUv;uniform float uDescent;${noiseGLSL}
void main(){vec2 uv=vUv;float glow=exp(-length((uv-vec2(.78,.28))*vec2(1.3,2.2))*3.);
float horizon=pow(1.-uv.y,3.);float haze=fbm(vec3(uv*5.,2.));
float value=.018+.15*horizon+glow*.24+haze*.017;
value+=uDescent*.035*(1.-uv.y);gl_FragColor=vec4(vec3(value),1.);}`;
export const cloudFragment = `
varying vec2 vUv;uniform sampler2D uDepth;uniform mat4 uInverseProjection;uniform mat4 uCameraWorld;uniform vec3 uEye;uniform float uTime;uniform vec2 uSize;uniform float uNear;uniform float uFar;uniform vec2 uPointer;
${noiseGLSL}
float density(vec3 p){
 float envelope=smoothstep(4.,20.,p.y)*(1.-smoothstep(55.,110.,p.y));
 vec3 q=p*vec3(.021,.021,.021)+vec3(uTime*.008,0.,uTime*.002);
 q.xz+=uPointer*.045*exp(-length(p.xz-uEye.xz)*.006);
 float shape=fbm(q);float detail=noise3(q*3.7);
 return max(0.,shape-.53-(1.-envelope)*.22-detail*.045)*envelope*.055;
}
void main(){
 vec4 view=uInverseProjection*vec4(vUv*2.-1.,1.,1.);vec3 localRay=normalize(view.xyz/view.w);
 vec3 ray=normalize((uCameraWorld*vec4(localRay,0.)).xyz);
 float depth=texture2D(uDepth,vUv).x;float viewZ=(uNear*uFar)/((uFar-uNear)*depth-uFar);
 float hit=depth>.999999?1200.:-viewZ/max(.001,-localRay.z);
 float ry=abs(ray.y)<.00001?.00001:ray.y;
 float a=(4.-uEye.y)/ry,b=(110.-uEye.y)/ry;
 float start=max(0.,min(a,b)),end=min(min(max(a,b),hit),1100.);
 if(end<=start){gl_FragColor=vec4(0.);return;}
 float stepSize=(end-start)/40.;float trans=1.;float light=0.;
 // Stable per-pixel phase: no frame-to-frame stochastic noise or temporal trails.
 float jitter=fract(sin(dot(floor(vUv*uSize),vec2(12.9898,78.233)))*43758.5453);
 for(int i=0;i<40;i++){
  vec3 p=uEye+ray*(start+(float(i)+jitter)*stepSize);
  float d=density(p);float alpha=1.-exp(-d*stepSize);
  float sun=clamp((p.y-25.)/45.,0.,1.);
  float silver=pow(max(0.,dot(ray,normalize(vec3(.6,.5,-.8)))),6.);
  float shadow=density(p+vec3(7.,11.,-6.))*20.+density(p+vec3(19.,30.,-17.))*28.;
  float shade=.045+exp(-shadow)*(.28+.28*sun)+.15*silver;
  light+=trans*alpha*shade;trans*=1.-alpha;
  if(trans<.012)break;
 }
 gl_FragColor=vec4(vec3(light),1.-trans);
}`;
export const compositeFragment = `
varying vec2 vUv;uniform sampler2D uScene;uniform sampler2D uCloud;uniform sampler2D uDepth;uniform vec2 uCloudSize;uniform float uNear;uniform float uFar;
float linearDepth(float d){return (uNear*uFar)/((uFar-uNear)*d-uFar);}
void main(){
 vec3 base=texture2D(uScene,vUv).rgb;float depth=linearDepth(texture2D(uDepth,vUv).r);
 vec2 pixel=vUv*uCloudSize-.5;vec2 cell=floor(pixel);vec2 f=fract(pixel);vec4 cloud=vec4(0.);float total=0.;
 for(int y=0;y<2;y++){for(int x=0;x<2;x++){
  vec2 offset=vec2(float(x),float(y));vec2 uv=(cell+offset+.5)/uCloudSize;
  float other=linearDepth(texture2D(uDepth,uv).r);
  float spatial=mix(1.-f.x,f.x,float(x))*mix(1.-f.y,f.y,float(y));
  float weight=spatial*exp(-abs(other-depth)*.08)+.00001;
  cloud+=texture2D(uCloud,uv)*weight;total+=weight;
 }}cloud/=total;
 vec3 col=base*(1.-cloud.a)+cloud.rgb;
 float luminance=dot(col,vec3(.2126,.7152,.0722));
 luminance*=1.-.28*(1.-smoothstep(.12,.72,vUv.x));
 float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
 float vignette=1.-.16*pow(length((vUv-.5)*1.25),2.);
 gl_FragColor=vec4(vec3(max(0.,luminance*vignette+grain*.006)),1.);
}`;
