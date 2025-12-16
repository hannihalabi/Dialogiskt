const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
if (!gl) {
  console.error("WebGL 2 not supported");
  document.body.innerHTML = "WebGL 2 is not supported in your browser.";
}

const vertexShaderSource = `#version 300 es
in vec4 aPosition;
void main() {
    gl_Position = aPosition;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
out vec4 fragColor;

/*--- BEGIN OF SHADERTOY ---*/

#define FLAME_HEIGHT 2.0
#define FLAME_ITERATIONS 5
#define FLAME_INTENSITY 2.0
#define SPARK_COUNT 50.0
#define SMOKE_OPACITY 0.8
#define TIME_SCALE 0.7
#define FLAME_WIDTH 1.2
#define NOISE_OCTAVES 3
#define DISPLACEMENT_OCTAVES 3

#define float2   vec2
#define float3   vec3
#define float4   vec4
#define lerp     mix
#define atan2    atan
#define frac     fract
#define fmod     mod
#define float2x2 mat2
#define mul(a, b) a*b
#define texSampl 1.
#define Texture2DSample(iChannel0, texSampl, uv) texture(iChannel0, uv)
#define ddx dFdx
#define ddy dFdy
#define saturate(oo) clamp(oo, 0.0, 1.0)

float3 fmod289(float3 x){return x-floor(x*(1./289.))*289.;}
float4 fmod289(float4 x){return x-floor(x*(1./289.))*289.;}
float4 permute(float4 x){return fmod289(((x*34.)+1.)*x);}
float4 taylorInvSqrt(float4 r){return 1.79284291400159-0.85373472095314*r;}

float snoise(float3 v){
    const float2 C = float2(1./6.,1./3.); const float4 D = float4(0.,.5,1.,2.);
    float3 i = floor(v + dot(v, C.yyy)); float3 x0 = v - i + dot(i, C.xxx);
    float3 g = step(x0.yzx, x0.xyz); float3 l = 1.0 - g;
    float3 i1 = min(g.xyz, l.zxy); float3 i2 = max(g.xyz, l.zxy);
    float3 x1 = x0 - i1 + C.xxx; float3 x2 = x0 - i2 + C.yyy;
    float3 x3 = x0 - D.yyy; i = fmod289(i);
    float4 p = permute(permute(permute(i.z + float4(0.0, i1.z, i2.z, 1.0))
        + i.y + float4(0.0, i1.y, i2.y, 1.0))+ i.x + float4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857; float3 ns = n_ * D.wyz - D.xzx;
    float4 j = p - 49.0 * floor(p * ns.z * ns.z);
    float4 x_ = floor(j * ns.z); float4 y_ = floor(j - 7.0 * x_);
    float4 x = x_ * ns.x + ns.yyyy; float4 y = y_ * ns.x + ns.yyyy;
    float4 h = 1.0 - abs(x) - abs(y);
    float4 b0 = float4(x.xy, y.xy); float4 b1 = float4(x.zw, y.zw);
    float4 s0 = floor(b0) * 2.0 + 1.0;float4 s1 = floor(b1) * 2.0 + 1.0;
    float4 sh = -step(h, float4(0.,0.,0.,0.));
    float4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; float4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    float3 p0 = float3(a0.xy, h.x); float3 p1 = float3(a0.zw, h.y);
    float3 p2 = float3(a1.xy, h.z); float3 p3 = float3(a1.zw, h.w);
    float4 norm = 1./sqrt(float4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;p1 *= norm.y;p2 *= norm.z; p3 *= norm.w;
    float4 m = max(.6-float4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
    return 42.0 * dot(m * m, float4(dot(p0, x0), dot(p1, x1),
        dot(p2, x2), dot(p3, x3)));
}

float prng(in float2 seed) {
    seed = frac(seed * float2(5.3983, 5.4427));
    seed += dot(seed.yx, seed.xy + float2(21.5351, 14.3137));
    return frac(seed.x * seed.y * 95.4337);
}

float noiseStack(float3 pos, int octaves, float falloff) {
    float noise = snoise(float3(pos)); float off = 1.0;
    if (octaves > 1) {pos *= 2.0;off *= falloff;
       noise = (1.0 - off) * noise + off * snoise(float3(pos));}
    if (octaves > 2) {pos *= 2.0;off *= falloff;
        noise = (1.0 - off) * noise + off * snoise(float3(pos));
    }if (octaves > 3) {pos *= 2.0; off *= falloff;
        noise = (1.0 - off) * noise + off * snoise(float3(pos)); }
    if (octaves > 4) {pos *= 2.0; off *= falloff;
        noise = (1.0 - off) * noise + off * snoise(float3(pos)); }
    return (1.+noise)/2.;
}

float2 noiseStackUV(float3 pos, int octaves, float falloff, float diff) {
    float displaceA = noiseStack(pos, octaves, falloff);
    float displaceB = noiseStack(pos + float3(3984.293, 423.21, 5235.19), octaves, falloff);
    return float2(displaceA, displaceB);
}

float2 res(float2 uv, float time) {
    float PI = 3.1415926535897932384626433832795;
    float ypartClip = uv.y * FLAME_HEIGHT;
    float ypartClippedFalloff = clamp(FLAME_HEIGHT - ypartClip, 0.0, 1.0);
    float ypartClipped = min(ypartClip, 1.0);
    float ypartClippedn = 1.-ypartClipped;
    float xfuel = FLAME_WIDTH * (1.-abs(2.*uv.x-1.));
    float realTime = TIME_SCALE * time; float2 coordScaled = 6.*uv-.2;
    float3 position = float3(coordScaled,0.)+float3(1223.,6434.,8425.);
    float3 flow = float3(4.1*(.5-uv.x)*pow(ypartClippedn,4.),-2.*xfuel*pow(ypartClippedn,64.),0.);
    float3 timing = realTime * float3(0.0, -1.7, 1.1) + flow;
    float3 displacePos = float3(1.,.5,1.)*2.4*position+realTime*float3(.01,-.7,1.3);
    float3 displace3 = float3(noiseStackUV(displacePos, DISPLACEMENT_OCTAVES, 0.4, 0.1), 0.0);
    float3 noiseCoord = (float3(2.,1.,1.)*position+timing+.4*displace3);
    float noise = noiseStack(noiseCoord, NOISE_OCTAVES, 0.4);
    float flames = pow(ypartClipped,.3*xfuel)*pow(noise,.3*xfuel);
    float f = ypartClippedFalloff*pow(1.-flames*flames*flames,8.);
    float fire = FLAME_INTENSITY*(pow(f,3.)+f);
    float smokeNoise = .5+snoise(.4*(position+float3(0.,1.,0.))+timing*float3(1.,.8,-.5))/2.;
    float smoke = SMOKE_OPACITY*pow(xfuel,3.)*pow(uv.y,2.)*(smokeNoise+.4*(1.-noise));
    float sparkGridSize = SPARK_COUNT;
    float2 sparkCoord = uv*300.-float2(.0,190.*realTime);
    sparkCoord -= 30.*noiseStackUV(.01*float3(sparkCoord,30.*time),1,.4,.1);
    sparkCoord += 100.*flow.xy;
    if (fmod(sparkCoord.y/sparkGridSize,2.)<1.) sparkCoord.x +=.5*sparkGridSize;
    float2 sparkGridIndex = float2(floor(sparkCoord/sparkGridSize));
    float sparkRandom = prng(sparkGridIndex);
    float sparkLife=min(10.*(1.-min((sparkGridIndex.y+(190.*realTime/sparkGridSize))/(24.-20.*sparkRandom),1.)),1.);
    float sparks = 0.;
    if (sparkLife > 0.) {
        float sparkSize = xfuel*xfuel*sparkRandom*.04;
        float sparkRadians = 999.*sparkRandom*2.*PI+2.*time;
        float2 sparkCircular = float2(sin(sparkRadians), cos(sparkRadians));
        float2 sparkOffset = (.5-sparkSize)*sparkGridSize*sparkCircular;
        float2 sparkfmodulus = fmod(sparkCoord+sparkOffset,sparkGridSize)-float2(.5,.5)* sparkGridSize;
        float sparksGray = max(0.0, 1.0 - length(sparkfmodulus) / (sparkSize * sparkGridSize));
        sparks = sparkLife * sparksGray;
    }
    return float2(max(fire, sparks), smoke);
}

void mainImage(out float4 fragColor, in float2 fragCoord) {
    float2 uv = fragCoord.xy/iResolution.xy;
    float2 o = res(uv, iTime);
    fragColor = o.x*vec4(1.,.5,.0,1.)+vec4(.9,.8,.7,1.)*o.y;
}

/*--- END OF SHADERTOY ---*/

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

const positionAttributeLocation = gl.getAttribLocation(program, "aPosition");
const resolutionUniformLocation = gl.getUniformLocation(program, "iResolution");
const timeUniformLocation = gl.getUniformLocation(program, "iTime");
const mouseUniformLocation = gl.getUniformLocation(program, "iMouse");

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

gl.useProgram(program);

gl.enableVertexAttribArray(positionAttributeLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

let mouseX = 0, mouseY = 0;
canvas.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = canvas.height - e.clientY; // Flip Y coordinate
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Call once to set initial size

function render(time) {
  gl.uniform3f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height, 1.0);
  gl.uniform1f(timeUniformLocation, time * 0.001);
  gl.uniform4f(mouseUniformLocation, mouseX, mouseY, 0.0, 0.0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// Hero gating: show full-screen hero on first visit (desktop + mobile)
const hero = document.getElementById("hero");
const enterHero = document.getElementById("enterHero");
const skipHero = document.getElementById("skipHero");
const HERO_KEY = "fireplaceHeroSeen";

function hideHero() {
  document.body.classList.remove("hero-active");
  localStorage.setItem(HERO_KEY, "1");
  hero.style.opacity = "0";
  hero.style.visibility = "hidden";
  setTimeout(() => hero.remove(), 500);
}

if (!localStorage.getItem(HERO_KEY)) {
  document.body.classList.add("hero-active");
} else {
  hero.remove();
}

enterHero.addEventListener("click", hideHero);
skipHero.addEventListener("click", hideHero);
