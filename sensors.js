/* GLOBAL MONITOR — sensor-style post-processing for the Orbital View
 *
 * A second WebGL canvas sits on top of the globe canvas (pointer-events: none).
 * Every frame it uploads the globe's drawing buffer as a texture and runs one of
 * four fragment shaders over it: CRT, NVG (night vision), FLIR (thermal, ironbow)
 * or NOIR. Keys 1-5 switch looks, 1 = plain RGB. Nothing runs while RGB is active.
 *
 * Requires the globe renderer to be created with preserveDrawingBuffer: true so
 * the globe canvas can be read back at any point in the frame.
 */
"use strict";

const Sensors = (() => {
  const VERT = `
    attribute vec2 a;
    varying vec2 v;
    void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

  const HEAD = `
    precision mediump float;
    uniform sampler2D tex;
    uniform vec2 dims;
    uniform float time;
    varying vec2 v;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    float vignette(vec2 uv, float inner, float outer) {
      vec2 c = (uv - 0.5) * vec2(dims.x / dims.y, 1.0);
      return 1.0 - smoothstep(inner, outer, length(c));
    }
    vec3 blur5(vec2 uv, float px) {
      vec2 t = px / dims; vec3 s = vec3(0.0); float w = 0.0;
      for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
        float k = exp(-0.4 * float(x * x + y * y));
        s += texture2D(tex, uv + vec2(float(x), float(y)) * t).rgb * k; w += k;
      }
      return s / w;
    }`;

  const SHADERS = {
    /* Phosphor CRT: chromatic fringe, scanlines, barrel curve, flicker */
    crt: HEAD + `
      void main() {
        vec2 uv = v - 0.5;
        float r2 = dot(uv, uv);
        uv *= 1.0 + 0.10 * r2;                      // barrel distortion
        uv += 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        float ab = 1.2 / dims.x;
        vec3 col = vec3(
          texture2D(tex, uv + vec2(ab, 0.0)).r,
          texture2D(tex, uv).g,
          texture2D(tex, uv - vec2(ab, 0.0)).b);
        col = pow(col, vec3(0.9)) * 1.15;
        float scan = 0.82 + 0.18 * sin(uv.y * dims.y * 3.14159);   // one dark line per 2 px
        col *= scan;
        col *= 0.97 + 0.03 * sin(time * 120.0);                     // 60 Hz flicker
        col += vec3(0.02, 0.09, 0.10) * (1.0 - luma(col));           // phosphor tint in the blacks
        col *= vignette(v, 0.55, 1.05);
        gl_FragColor = vec4(col, 1.0);
      }`,

    /* Image-intensifier tube: green phosphor, grain, bloom, round tube mask */
    nvg: HEAD + `
      void main() {
        float mask = vignette(v, 0.42, 0.78);
        if (mask <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        vec3 src = texture2D(tex, v).rgb;
        vec3 halo = blur5(v, 2.5);
        float l = luma(src) * 1.9 + luma(halo) * 0.9;   // gain + bloom
        l = 1.0 - exp(-l * 1.6);                         // tube saturation curve
        float grain = (hash(v * dims + fract(time * 13.7) * 91.0) - 0.5) * 0.14;
        float sparkle = step(0.9985, hash(v * dims * 0.5 + time * 7.0)) * 0.6;
        l = clamp(l + grain + sparkle, 0.0, 1.0);
        vec3 col = vec3(l * 0.18, l * 1.0, l * 0.25) + vec3(0.0, 0.035, 0.005);
        col *= 0.9 + 0.1 * mask;
        col *= 0.985 + 0.015 * sin(time * 50.0);
        gl_FragColor = vec4(col * mask + vec3(0.0, 0.01, 0.0) * (1.0 - mask), 1.0);
      }`,

    /* FLIR: luminance to temperature, ironbow ramp, pixelation, banding, crosshair */
    flir: HEAD + `
      vec3 ironbow(float t) {
        t = clamp(t, 0.0, 1.0);
        vec3 c0 = vec3(0.0), c1 = vec3(0.13, 0.0, 0.30), c2 = vec3(0.49, 0.0, 0.45),
             c3 = vec3(0.86, 0.10, 0.18), c4 = vec3(1.0, 0.55, 0.0), c5 = vec3(1.0, 0.91, 0.32), c6 = vec3(1.0);
        float s = t * 6.0;
        if (s < 1.0) return mix(c0, c1, s);
        if (s < 2.0) return mix(c1, c2, s - 1.0);
        if (s < 3.0) return mix(c2, c3, s - 2.0);
        if (s < 4.0) return mix(c3, c4, s - 3.0);
        if (s < 5.0) return mix(c4, c5, s - 4.0);
        return mix(c5, c6, s - 5.0);
      }
      void main() {
        float px = 2.0;
        vec2 uv = floor(v * dims / px) * px / dims;          // sensor pixel grid
        vec3 src = mix(texture2D(tex, uv).rgb, blur5(uv, 1.5), 0.5);
        float t = clamp((luma(src) - 0.08) / 0.7, 0.0, 1.0);
        float band = smoothstep(0.03, 0.06, abs(fract(t * 10.0) - 0.5));
        t *= 0.85 + 0.15 * band;
        t += (hash(uv * dims + time * 3.0) - 0.5) * 0.04;
        vec3 col = ironbow(t);
        float hot = smoothstep(0.55, 1.0, luma(blur5(uv, 3.0)));
        col += vec3(hot * 0.35);                               // hot-spot bleed
        // crosshair + frame ticks
        vec2 c = v - 0.5;
        float ch = (smoothstep(0.0025, 0.0008, abs(c.y)) * step(0.02, abs(c.x)) * step(abs(c.x), 0.06)) +
                   (smoothstep(0.0025, 0.0008, abs(c.x)) * step(0.02, abs(c.y)) * step(abs(c.y), 0.06));
        col = mix(col, vec3(1.0), clamp(ch, 0.0, 1.0) * 0.9);
        col *= vignette(v, 0.75, 1.25);
        gl_FragColor = vec4(col, 1.0);
      }`,

    /* Noir: high-contrast monochrome, film grain, heavy vignette, cyan tinted whites */
    noir: HEAD + `
      void main() {
        vec3 src = texture2D(tex, v).rgb;
        float l = luma(src);
        l = smoothstep(0.08, 0.85, l);
        l = pow(l, 1.25);
        l += (hash(v * dims + fract(time * 9.1) * 37.0) - 0.5) * 0.09;
        vec3 col = mix(vec3(0.0, 0.02, 0.04), vec3(0.85, 0.95, 1.0), clamp(l, 0.0, 1.0));
        col *= vignette(v, 0.35, 1.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  };

  const NAMES = ["rgb", "crt", "nvg", "flir", "noir"];
  let gl = null, canvas = null, sourceFn = null, programs = {}, current = "rgb", raf = 0, tex = null, start = performance.now();

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(frag) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return { p, dims: gl.getUniformLocation(p, "dims"), time: gl.getUniformLocation(p, "time"), tex: gl.getUniformLocation(p, "tex") };
  }

  function init(overlayCanvas, getSourceCanvas) {
    canvas = overlayCanvas; sourceFn = getSourceCanvas;
    gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false });
    if (!gl) return false;
    try {
      for (const k of Object.keys(SHADERS)) programs[k] = program(SHADERS[k]);
    } catch (e) { console.error("sensor shader failed:", e); return false; }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    for (const k of Object.keys(programs)) {
      gl.useProgram(programs[k].p);
      const a = gl.getAttribLocation(programs[k].p, "a");
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    }
    return true;
  }

  function frame() {
    raf = 0;
    if (current === "rgb") return;
    const src = sourceFn && sourceFn();
    if (src && src.width && src.height) {
      if (canvas.width !== src.width || canvas.height !== src.height) {
        canvas.width = src.width; canvas.height = src.height;
      }
      const prog = programs[current];
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog.p);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src); } catch (_) { /* tainted or lost */ }
      gl.uniform2f(prog.dims, canvas.width, canvas.height);
      gl.uniform1f(prog.time, (performance.now() - start) / 1000);
      gl.uniform1i(prog.tex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    raf = requestAnimationFrame(frame);
  }

  function set(name) {
    if (!gl) return false;
    if (!NAMES.includes(name)) name = "rgb";
    current = name;
    canvas.hidden = name === "rgb";
    document.body.dataset.sensor = name;
    document.querySelectorAll("[data-sensor]").forEach((b) => b.classList.toggle("active", b.dataset.sensor === name));
    if (name !== "rgb" && !raf) raf = requestAnimationFrame(frame);
    try { localStorage.setItem("gm:sensor", name); } catch (_) { /* private mode */ }
    return true;
  }
  function get() { return current; }
  function restore() {
    let saved = "rgb";
    try { saved = localStorage.getItem("gm:sensor") || "rgb"; } catch (_) { /* ignore */ }
    set(saved);
  }

  return { init, set, get, restore, NAMES };
})();
