/**
 * Camera Kaleidoscope - Main Logic
 * Handles WebGL setup, camera input, and UI interaction.
 */

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

// UI Elements
const ui = {
    panel: document.querySelector('.panel'),
    panelToggle: document.getElementById('panelToggle'),
    errorOverlay: document.getElementById('errorOverlay'),
    errorMsg: document.getElementById('errorMsg'),
    btnRetry: document.getElementById('btnRetry'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    inputs: {
        segments: document.getElementById('inpSegments'),
        zoom: document.getElementById('inpZoom'),
        rotate: document.getElementById('inpRotate'),
        panX: document.getElementById('inpPanX'),
        panY: document.getElementById('inpPanY'),
    },
    displays: {
        segments: document.getElementById('valSegments'),
    }
};

// State
const state = {
    mode: 0, // 0: Rosette, 1: Tiling, 2: Sphere, 3: Hyperbolic
    segments: 8,
    zoom: 1.0,
    rotate: 0.0,
    pan: { x: 0, y: 0 },
    theme: 'dark'
};

// Shader Sources
const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_uv = a_position * 0.5 + 0.5;
        // v_uv.y = 1.0 - v_uv.y; // Done in fragment or depending on texture orientation
    }
`;

const fsSource = `
    precision mediump float;
    
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_mode; // 0: Rosette, 1: Prism, 2: Sphere, 3: Hyperbolic
    uniform float u_segments;
    uniform float u_zoom;
    uniform float u_rotate;
    uniform vec2 u_pan;

    #define PI 3.14159265359

    // --- Utils ---
    vec2 rotate(vec2 uv, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    }

    // --- Modes ---

    // 0. Rosette (Radial Symmetry)
    vec2 modeRosette(vec2 uv) {
        vec2 st = uv - 0.5;
        float r = length(st);
        float a = atan(st.y, st.x);
        
        float segmentAngle = PI * 2.0 / u_segments;
        a = mod(a, segmentAngle);
        if (a > segmentAngle * 0.5) a = segmentAngle - a; // Mirroring within segment
        
        // Add rotation offset to the sector to make it spin if needed
        // a += u_rotate; 

        return vec2(cos(a), sin(a)) * r + 0.5;
    }

    // 1. Prism (Triangle Tiling / Planar)
    // Simple 3-mirror kaleidoscope logic
    vec2 modePrism(vec2 uv) {
        vec2 st = (uv - 0.5) * 2.0; // -1 to 1
        
        // Hexagonal / Triangular tiling basics
        // Fold space 3 times for 3 mirrors
        for (int i = 0; i < 3; i++) {
            // Mirror line normal roughly at angles
            float angle = PI / 3.0; // 60 degrees logic for 3 mirrors
            // Simple iterative folding
            st = abs(st);
            st -= 0.5;
            st = rotate(st, -PI/3.0);
        }
        
        return st * 0.5 + 0.5;
    }

    // Better Prism Implementation (Wallpaper Group p3m1 ish)
    vec2 kaleidoscope(vec2 uv, float n) {
        float angle = PI / n;
        
        float r = length(uv);
        float a = atan(uv.y, uv.x);
        
        a = mod(a, 2.0 * angle);
        a = abs(a - angle);
        
        return vec2(cos(a), sin(a)) * r;
    }

    // 2. Spherical
    vec2 modeSphere(vec2 uv) {
        vec2 st = uv - 0.5;
        float r = length(st);
        
        // Fisheye distortion
        float z = sqrt(1.0 - r * r);
        float r2 = atan(r, z) / PI;
        r2 *= 2.5; // Scale
        
        float phi = atan(st.y, st.x);
        return vec2(cos(phi), sin(phi)) * r2 + 0.5;
    }

    // 3. Hyperbolic (Poincare Disk)
    // Mapping texture into the disk
    vec2 modeHyperbolic(vec2 uv) {
        vec2 st = uv - 0.5;
        float r = length(st);
        // Inverse Mobius or simply scaling r non-linearly
        // r = 2.0 * r / (1.0 + r*r); // Stereographic projection
        
        // Let's try a tiling in hyperbolic space logic simulation
        // Just a complex distortion for now
        float newR = tan(r * 2.0); 
        return normalize(st) * newR * 0.2 + 0.5;
    }

    void main() {
        // 1. Normalize coords
        vec2 uv = gl_FragCoord.xy / u_resolution;
        
        // 2. Apply Input Transform (Zoom/Pan/Rotate the CAMERA view)
        // We actually want to apply this AFTER the kaleidoscopic folding 
        // OR Before? Usually Before makes the pattern change.
        // Let's apply camera transform BEFORE folding to "look around" the kaleidoscope.
        
        vec2 center = vec2(0.5);
        vec2 st = uv;

        // Apply Mode
        if (u_mode == 0) {
            st = modeRosette(st);
        } else if (u_mode == 1) {
            // Simple p3m1 tiling attempt
            st -= 0.5;
            st *= 2.0; // Scale up to fill
            // Fold
            for (int i=0; i<3; i++) {
                st = abs(st); // Mirror X
                st = rotate(st, PI/3.0); // Rotate 60
                st = abs(st); // Mirror New X
            }
            st += 0.5;
        } else if (u_mode == 2) {
             // Sphere Refraction
             vec2 p = uv - 0.5;
             float r = length(p);
             if (r < 0.45) {
                 float z = sqrt(0.45*0.45 - r*r);
                 vec2 normal = p / 0.45;
                 // Refract
                 st = uv - p * 0.2 * z;
             }
        } else if (u_mode == 3) {
            // Swirl / Hyperbolic-ish
             vec2 p = uv - 0.5;
             float r = length(p);
             float a = atan(p.y, p.x);
             float dist = 0.5 * u_zoom; // variable zoom
             st = vec2(cos(a + r*5.0 - u_time + u_rotate), sin(a + r*5.0 - u_time + u_rotate)) * r + 0.5;
        }

        // 3. Input Transforms (The "Content" inside the shards)
        // Center the coordinate system for rotation
        st -= 0.5;
        
        // Pan
        st -= u_pan * 0.5;
        
        // Zoom (Smaller zoom value = Zoom In, so we divide or multiply coords)
        st /= u_zoom;
        
        // Rotate
        st = rotate(st, u_rotate);
        
        st += 0.5;
        
        // Flip Y for texture
        st.y = 1.0 - st.y; 

        // 4. Sample
        gl_FragColor = texture2D(u_texture, st);
    }
`;

// WebGL Globals
let program;
let video;
let texture;
let locations = {};

function initWebGL() {
    if (!gl) {
        showError("WebGL not supported");
        return;
    }

    // Compile Shader
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    program = createProgram(gl, vs, fs);
    gl.useProgram(program);

    // Look up locations
    locations = {
        position: gl.getAttribLocation(program, 'a_position'),
        texture: gl.getUniformLocation(program, 'u_texture'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        mode: gl.getUniformLocation(program, 'u_mode'),
        segments: gl.getUniformLocation(program, 'u_segments'),
        zoom: gl.getUniformLocation(program, 'u_zoom'),
        rotate: gl.getUniformLocation(program, 'u_rotate'),
        pan: gl.getUniformLocation(program, 'u_pan'),
    };

    // Setup Geometry (Quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
    ]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    // Setup Texture
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // WEBGL 1.0 NOTE: NPOT textures (like 1280x720 webcam) MUST use CLAMP_TO_EDGE and NO Mipmaps.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

// Camera Setup
async function setupCamera() {
    video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        });
        video.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });

        await video.play();
        ui.errorOverlay.classList.add('hidden');
        console.log("Camera started:", video.videoWidth, video.videoHeight);

    } catch (err) {
        console.error("Camera error:", err);
        showError("Could not access camera. Please allow permissions.");
    }
}

function showError(msg) {
    ui.errorMsg.textContent = msg;
    ui.errorOverlay.classList.remove('hidden');
}

// Event Listeners
function initEvents() {
    // Panel Toggle
    ui.panelToggle.addEventListener('click', () => {
        document.body.classList.toggle('panel-collapsed');
    });

    // Modes
    ui.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ui.modeBtns.forEach(b => b.classList.remove('mode-btn--active'));
            btn.classList.add('mode-btn--active');

            const modeName = btn.dataset.mode;
            if (modeName === 'rosette') state.mode = 0;
            else if (modeName === 'tiling') state.mode = 1;
            else if (modeName === 'spherical') state.mode = 2;
            else if (modeName === 'hyperbolic') state.mode = 3;
        });
    });

    // Inputs
    ui.inputs.segments.addEventListener('input', (e) => {
        state.segments = parseFloat(e.target.value);
        ui.displays.segments.textContent = state.segments;
    });

    ui.inputs.zoom.addEventListener('input', e => state.zoom = parseFloat(e.target.value));
    ui.inputs.rotate.addEventListener('input', e => state.rotate = parseFloat(e.target.value));
    ui.inputs.panX.addEventListener('input', e => state.pan.x = parseFloat(e.target.value));
    ui.inputs.panY.addEventListener('input', e => state.pan.y = parseFloat(e.target.value));

    // Theme
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('theme-btn--active'));
            btn.classList.add('theme-btn--active');
            const theme = btn.dataset.theme;
            document.querySelector('.app').dataset.theme = theme;
        });
    });

    // Screenshot
    document.getElementById('btnScreenshot').addEventListener('click', () => {
        render(); // Ensure fresh frame
        const link = document.createElement('a');
        link.download = `kaleidoscope-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });

    // Resize
    window.addEventListener('resize', resize);

    // Error Retry
    ui.btnRetry.addEventListener('click', setupCamera);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

// Main Loop
function render(time) {
    if (!gl || !video || video.readyState < 2) {
        requestAnimationFrame(render);
        return;
    }

    // Update Texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    // Uniforms
    gl.uniform2f(locations.resolution, canvas.width, canvas.height);
    gl.uniform1f(locations.time, time * 0.001);
    gl.uniform1i(locations.mode, state.mode);
    gl.uniform1f(locations.segments, state.segments);
    gl.uniform1f(locations.zoom, state.zoom);
    gl.uniform1f(locations.rotate, state.rotate);
    gl.uniform2f(locations.pan, state.pan.x, state.pan.y);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

// Boot
async function main() {
    initWebGL();
    resize();
    initEvents();
    await setupCamera();
    requestAnimationFrame(render);
}

main();
