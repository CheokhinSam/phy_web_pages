/**
 * 🌀 帶電粒子在磁場中的螺旋運動（3D · three.js）
 *
 * ==========================================================================
 * 這一頁為什麼要 3D
 * ==========================================================================
 * 「帶電粒子在磁場中作圓周運動」成立的前提是速度**垂直**於磁場。真實世界
 * 的速度幾乎都有一個沿著磁力線的分量，而磁場對那個分量完全沒有作用力——
 * 於是粒子一邊繞圈、一邊沿著磁力線等速前進，走出來是一條**螺旋線**。
 *
 *      v⊥ 決定半徑      r = m·v⊥ / (|q|·B)
 *      v∥ 決定螺距      p = v∥ · T，T = 2πm / (|q|·B)
 *
 * v∥ → 0 時螺旋線收成一個圓；這條退化關係是這一頁和「圓周運動」之間
 * 唯一需要記住的事。平面畫布只能畫投影（也就是圓），所以這一頁改用
 * three.js：畫面上那條線的螺距、半徑、傾角都是真的立體幾何。
 *
 * ==========================================================================
 * 幾何只有一份：HelixKit
 * ==========================================================================
 * 粒子的位置、速度、力的方向全部由 stateOf() → pointAtPhase() 推出來，
 * 畫面與右側卡片問的是同一份狀態。**不要**在繪圖函式裡另外湊一條 cos/sin
 * ——那正是本專案其他頁面「畫面全對、數字全錯」的老問題。
 *
 * 軌跡用**解析解**而不是逐步積分：圓周運動有閉式解，Euler／RK4 的數值誤差
 * 會讓軌跡慢慢往外漂，而這一頁的賣點就是「畫出來的線 = 公式算出來的線」。
 *
 * ==========================================================================
 * ⚠️ three.js 用動態 import 載入，不掛在 js_deps
 * ==========================================================================
 * `js_deps` 產出的是 classic script，three.js 現在只發 ESM；直接把 module
 * 塞進 `<script src>` 會整個載入失敗。頁面檔（defer）裡用 `import()` 拿
 * 模組，晚一點到位沒關係——`window.__tick` 會把先到的 tick 排隊，等場景
 * 建好再一起補跑（headless 驅動器在 three 還沒載完時就會開始 tick）。
 *
 * ==========================================================================
 * ⚠️ 動畫時間不是物理時間
 * ==========================================================================
 * 質子的週期是 0.66 µs，照真實時間播的話一個畫面都看不到。畫面固定
 * 「3 秒繞一圈」（ANIM_PERIOD），這是**示意**，不是週期；卡片上的 T 才是
 * 物理值。螺距的「每一圈往上幾公尺」則完全照 v∥·T 走，所以拉的 v∥ 滑桿
 * 改變的是真螺距與畫面比例，不是動畫速度。
 */
var HelixKit = (function () {
    'use strict';

    // ======================================================================
    // 物理常數與粒子
    // ======================================================================
    const E_CHARGE = 1.602176634e-19;       // C
    const M_ELECTRON = 9.1093837015e-31;    // kg
    const M_PROTON = 1.67262192369e-27;     // kg
    const M_ALPHA = 6.6446573357e-27;       // kg

    const PARTICLES = {
        proton:   { id: 'proton',   name: '質子',   sym: 'p⁺', q: +E_CHARGE,      m: M_PROTON },
        electron: { id: 'electron', name: '電子',   sym: 'e⁻', q: -E_CHARGE,      m: M_ELECTRON },
        alpha:    { id: 'alpha',    name: 'α 粒子', sym: 'α',  q: +2 * E_CHARGE, m: M_ALPHA },
    };

    const ANIM_PERIOD = 3.0;    // 螢幕上繞一圈幾秒（示意，不是物理週期）
    const TURNS = 2;            // 畫面畫幾個螺距
    const TRAIL_N = 97;         // 走過的軌跡取樣點數（固定，避免每幀重建緩衝區）

    const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

    // ======================================================================
    // 純物理：面板數字 → 狀態 → 位置／速度／力
    // ======================================================================

    /**
     * 面板單位：v⊥、v∥ 是 ×10⁶ m/s，B 是 mT。
     * 回傳的所有量都是 SI。
     */
    function stateOf(panel) {
        const p = PARTICLES[panel.particle] || PARTICLES.proton;
        const vperp = clamp(Number(panel.vperp) || 0, 0, 50) * 1e6;
        const vpar = clamp(Number(panel.vpar) || 0, 0, 50) * 1e6;
        const B = clamp(Number(panel.B) || 1, 1, 1000) * 1e-3;

        const omega = p.q * B / p.m;        // 帶正負號：電荷變號 → 轉向反過來
        const omegaAbs = Math.abs(omega);
        const rSigned = vperp / omega;      // 帶正負號：正、負電荷繞在軸的兩側
        const T = 2 * Math.PI / omegaAbs;

        return {
            particle: p, vperp, vpar, B,
            omega, omegaAbs,
            rSigned,
            r: Math.abs(rSigned),
            T,
            pitch: vpar * T,
        };
    }

    /**
     * 相位 θ（不是時間）→ 位置（公尺）。
     * y 的原點是這一圈螺旋的起點；畫面會再平移 −pitch 讓整條線居中。
     */
    function pointAtPhase(st, theta) {
        return {
            x: st.rSigned * Math.cos(theta),
            y: st.vpar * theta / st.omega,
            z: st.rSigned * Math.sin(theta),
        };
    }

    /** 同一相位的速度（公尺／秒）。 */
    function velocityAtPhase(st, theta) {
        return {
            vx: -st.vperp * Math.sin(theta),
            vy: st.vpar,
            vz: st.vperp * Math.cos(theta),
        };
    }

    /**
     * 力的方向（單位向量）。力永遠指向軸心，而軸心在 x 的哪一側由電荷符號
     * 決定——所以方向是 −sign(ω)·(cos θ, 0, sin θ)。
     */
    function forceDir(st, theta) {
        const s = st.omega > 0 ? -1 : 1;
        return { x: s * Math.cos(theta), y: 0, z: s * Math.sin(theta) };
    }

    const API = {
        PARTICLES, ANIM_PERIOD, TURNS,
        stateOf, pointAtPhase, velocityAtPhase, forceDir, clamp,
    };
    if (typeof window !== 'undefined') window.HelixKit = API;

    // Node 讀得到純物理，碰不到 DOM。
    if (typeof document === 'undefined') return API;

    // ======================================================================
    // 畫面
    // ======================================================================
    const COLORS = {
        helix: 0x93c5fd,
        travelled: 0x2563eb,
        particle: 0xef4444,
        vperp: 0x16a34a,
        vpar: 0x8b5cf6,
        force: 0xef4444,
        field: 0xcbd5e1,
        axis: 0x94a3b8,
        guide: 0xe2e8f0,
    };

    const $ = (id) => document.getElementById(id);

    let THREE = null;
    let renderer = null;
    let scene = null;
    let camera = null;

    let dynamicGroup = null;      // 參數一改就整組重畫的東西
    let travelled = null;         // 走過的軌跡（每幀更新）
    let travelledPositions = null;
    let particle = null;
    let vPerpArrow = null;
    let vParArrow = null;
    let forceArrow = null;
    const labels = {};

    let state = null;
    let frustumH = 1;             // 正交相機的垂直視野（公尺）
    let yaw = 0.62;
    let elev = 0.30;
    let simTime = 0;
    let running = false;
    let lastTs = 0;
    let pendingTicks = 0;
    let rulerLen = null;

    // ----------------------------------------------------------------------
    // 面板與卡片（同步建立：three 還沒載完時，控制項已經能用）
    // ----------------------------------------------------------------------
    function buildPanel() {
        const panel = $('controlPanel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>粒子</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="particleVal" style="color: #2563eb;">質子 p⁺</span>
                    </span>
                </label>
                <select id="particleSelect" style="width: 100%; padding: 8px; font-size: 0.9rem; font-weight: 700; border: 1px solid #000; background: #fff; cursor: pointer;">
                    <option value="proton">質子 p⁺</option>
                    <option value="electron">電子 e⁻</option>
                    <option value="alpha">α 粒子</option>
                </select>
            </div>
            <div class="control-box">
                <label>
                    <span>垂直分量 <i>v</i>⊥</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vperpVal" style="color: #16a34a;">5.0</span> ×10⁶ m/s
                    </span>
                </label>
                <input type="range" id="vperpSlider" min="1" max="10" step="0.5" value="5">
            </div>
            <div class="control-box">
                <label>
                    <span>平行分量 <i>v</i>∥</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vparVal" style="color: #8b5cf6;">1.5</span> ×10⁶ m/s
                    </span>
                </label>
                <input type="range" id="vparSlider" min="0" max="4" step="0.5" value="1.5">
            </div>
            <div class="control-box">
                <label>
                    <span>磁場 <i>B</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="bVal" style="color: #2563eb;">100</span> mT
                    </span>
                </label>
                <input type="range" id="bSlider" min="20" max="200" step="10" value="100">
            </div>
            <div class="control-box" style="gap: 10px;">
                <button id="startBtn">開始 / START</button>
                <button id="pauseBtn" style="background-color: #ffffff; color: #000000; border: 1px solid #000000; margin-top: 10px;">暫停 / PAUSE</button>
                <button id="rstBtn" style="background-color: #ffffff; color: #000000; border: 1px solid #000000; margin-top: 10px;">重設 / RESET</button>
            </div>
        `;
    }

    function buildCards() {
        const grid = $('dataCardsGrid');
        if (!grid) return;
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(160px, 1fr))';
        grid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">半徑 RADIUS r</span>
                <div class="card-num-wrapper"><span id="cardR" class="card-num">—</span><span class="card-unit" id="cardRUnit"></span></div>
            </div>
            <div class="data-card">
                <span class="card-label">螺距 PITCH p</span>
                <div class="card-num-wrapper"><span id="cardPitch" class="card-num">—</span><span class="card-unit" id="cardPitchUnit"></span></div>
            </div>
            <div class="data-card">
                <span class="card-label">週期 PERIOD T</span>
                <div class="card-num-wrapper"><span id="cardT" class="card-num">—</span><span class="card-unit" id="cardTUnit"></span></div>
            </div>
            <div class="data-card">
                <span class="card-label">垂直速率 v⊥</span>
                <div class="card-num-wrapper"><span id="cardVperp" class="card-num">—</span><span class="card-unit">×10⁶ m/s</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">平行速率 v∥</span>
                <div class="card-num-wrapper"><span id="cardVpar" class="card-num">—</span><span class="card-unit">×10⁶ m/s</span></div>
            </div>
        `;
    }

    // ----------------------------------------------------------------------
    // 數字格式：半徑跨 mm～m、週期跨 ns～µs，固定小數位會讓某一端印成 0.00
    // ----------------------------------------------------------------------
    function fmtLen(m) {
        if (m === 0) return { num: '0.00', unit: 'm' };
        if (m >= 1) return { num: m.toFixed(2), unit: 'm' };
        if (m >= 1e-2) return { num: (m * 1e2).toFixed(1), unit: 'cm' };
        if (m >= 1e-3) return { num: (m * 1e3).toFixed(2), unit: 'mm' };
        if (m >= 1e-6) return { num: (m * 1e6).toFixed(1), unit: 'µm' };
        return { num: (m * 1e9).toFixed(1), unit: 'nm' };
    }

    function fmtTime(s) {
        if (s >= 1e-3) return { num: (s * 1e3).toFixed(2), unit: 'ms' };
        if (s >= 1e-6) return { num: (s * 1e6).toFixed(2), unit: 'µs' };
        return { num: (s * 1e9).toFixed(1), unit: 'ns' };
    }

    function updateCards() {
        const r = fmtLen(state.r);
        const p = fmtLen(state.pitch);
        const t = fmtTime(state.T);
        const set = (id, num, unit) => {
            const el = $(id);
            if (el) el.textContent = num;
            if (unit != null) {
                const u = $(id + 'Unit');
                if (u) u.textContent = unit;
            }
        };
        set('cardR', r.num, r.unit);
        set('cardPitch', p.num, p.unit);
        set('cardT', t.num, t.unit);
        const vp = $('cardVperp'); if (vp) vp.textContent = (state.vperp / 1e6).toFixed(1);
        const vl = $('cardVpar'); if (vl) vl.textContent = (state.vpar / 1e6).toFixed(1);
    }

    // ----------------------------------------------------------------------
    // three.js：場景骨架
    // ----------------------------------------------------------------------
    async function bootThree() {
        const mod = await import(THREE_CDN);
        THREE = mod;
        initThree();
    }

    function initThree() {
        const canvas = $('physicsCanvas');
        if (!canvas) return;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0xffffff, 1);

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

        dynamicGroup = new THREE.Group();
        scene.add(dynamicGroup);

        // 走過的軌跡：頂點緩衝區固定，每幀只改座標（不重建 geometry）
        travelledPositions = new Float32Array(TRAIL_N * 3);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(travelledPositions, 3));
        travelled = new THREE.Line(
            trailGeo,
            new THREE.LineBasicMaterial({ color: COLORS.travelled })
        );
        travelled.frustumCulled = false;
        scene.add(travelled);

        // 粒子本體：半徑 1 的球，靠 scale 調整
        particle = new THREE.Mesh(
            new THREE.SphereGeometry(1, 20, 14),
            new THREE.MeshBasicMaterial({ color: COLORS.particle })
        );
        scene.add(particle);

        // 三個箭頭：v⊥（綠）、v∥（紫）、F（紅）
        vPerpArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, COLORS.vperp);
        vParArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, COLORS.vpar);
        forceArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, COLORS.force);
        scene.add(vPerpArrow, vParArrow, forceArrow);

        // 文字標籤：Sprite 永遠面向相機
        labels.vperp = makeLabel('v⊥', '#16a34a');
        labels.vpar = makeLabel('v∥', '#8b5cf6');
        labels.force = makeLabel('F', '#ef4444');
        labels.b = makeLabel('B', '#475569');
        labels.pitch = makeLabel('p', '#ea580c');
        Object.values(labels).forEach((s) => scene.add(s));

        // 比例尺（HTML 疊層）：正交投影下像素／公尺是常數，量得準
        buildRuler();

        resize();

        requestAnimationFrame(loop);
        flushPendingTicks();
    }

    function makeLabel(text, color) {
        const px = 64;
        const pad = 10;
        const probe = document.createElement('canvas').getContext('2d');
        probe.font = `900 ${px}px "Inter", "Noto Sans TC", sans-serif`;
        const w = Math.ceil(probe.measureText(text).width) + pad * 2;
        const h = Math.ceil(px * 1.35);

        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.font = `900 ${px}px "Inter", "Noto Sans TC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(text, w / 2, h / 2);

        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tex, transparent: true, depthTest: false, depthWrite: false,
        }));
        sprite.userData.aspect = w / h;
        return sprite;
    }

    // ----------------------------------------------------------------------
    // 場景內容：參數改變時整組重建
    // ----------------------------------------------------------------------
    function disposeTree(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
        if (obj.children) obj.children.slice().forEach(disposeTree);
    }

    function clearGroup(group) {
        while (group.children.length) {
            const obj = group.children[0];
            group.remove(obj);
            disposeTree(obj);
        }
    }

    function computeFrustum(st) {
        // 場景裡最高的東西是兩圈螺旋（2·pitch）與四根磁場箭頭；
        // 最寬的是磁場箭頭那一圈。兩者都要塞得進去，不能只算螺旋。
        const canvas = $('physicsCanvas');
        const aspect = (canvas && canvas.clientWidth && canvas.clientHeight)
            ? canvas.clientWidth / canvas.clientHeight
            : 1.4;
        const ring = Math.max(2.2 * st.r, 0.3 * st.pitch);
        const halfH = Math.max(st.pitch * 1.05, st.r * 1.4);
        const vert = 2 * halfH + 0.6 * st.r;
        const horiz = 2 * (ring + 0.55 * st.r);
        return Math.max(Math.max(vert, horiz / aspect) * 1.2, 1e-6);
    }

    function rebuildScene() {
        if (!THREE || !state) return;
        const st = state;
        const dir = st.omega >= 0 ? 1 : -1;

        clearGroup(dynamicGroup);

        // ---- 整條螺旋（淡） ----
        const pts = [];
        const N = 200;
        for (let i = 0; i <= N; i++) {
            const th = dir * (i / N) * (Math.PI * 2 * TURNS);
            const q = pointAtPhase(st, th);
            pts.push(new THREE.Vector3(q.x, q.y - st.pitch, q.z));
        }
        dynamicGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: COLORS.helix })
        ));

        // ---- 磁力線（軸） ----
        const dash = Math.max(frustumH * 0.018, st.r * 0.12);
        const axisGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -st.pitch * 1.18, 0),
            new THREE.Vector3(0, st.pitch * 1.18, 0),
        ]);
        const axis = new THREE.Line(axisGeo, new THREE.LineDashedMaterial({
            color: COLORS.axis, dashSize: dash, gapSize: dash * 0.8,
            transparent: true, opacity: 0.8,
        }));
        axis.computeLineDistances();
        dynamicGroup.add(axis);

        // ---- 磁場箭頭：四根，斜著擺開，不跟 v⊥／F 搶位置 ----
        const ring = Math.max(2.2 * st.r, 0.3 * st.pitch);
        const halfH = Math.max(st.pitch * 1.05, st.r * 1.4);
        for (let k = 0; k < 4; k++) {
            const a = Math.PI / 4 + k * Math.PI / 2;
            const x = ring * Math.cos(a);
            const z = ring * Math.sin(a);
            const len = halfH * 2;
            const head = Math.max(len * 0.055, st.r * 0.16);
            dynamicGroup.add(new THREE.ArrowHelper(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(x, -halfH, z),
                len, COLORS.field, head, head * 0.6
            ));
        }

        // ---- 底部的導引圓：垂直分量走出來的圓 ----
        const guidePts = [];
        for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2;
            guidePts.push(new THREE.Vector3(
                st.rSigned * Math.cos(a), -st.pitch, st.rSigned * Math.sin(a)
            ));
        }
        dynamicGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(guidePts),
            new THREE.LineBasicMaterial({ color: COLORS.guide })
        ));

        // ---- 螺距括號：一圈的起點到終點 ----
        const showPitch = st.pitch > 1e-9;
        if (showPitch) {
            const bx = Math.max(1.9 * st.r, ring * 1.18);
            const tick = Math.max(st.pitch * 0.07, st.r * 0.16);
            const y0 = -st.pitch;
            const y1 = 0;
            const seg = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(bx - tick, y0, 0), new THREE.Vector3(bx + tick, y0, 0),
                new THREE.Vector3(bx, y0, 0), new THREE.Vector3(bx, y1, 0),
                new THREE.Vector3(bx - tick, y1, 0), new THREE.Vector3(bx + tick, y1, 0),
            ]);
            dynamicGroup.add(new THREE.LineSegments(seg, new THREE.LineBasicMaterial({ color: 0x64748b })));
            labels.pitch.userData.anchor = { x: bx + tick * 1.8, y: (y0 + y1) / 2, z: 0, dx: 0.6 };
        }
        labels.pitch.visible = showPitch;

        // ---- 底部格線：讓立體感有參照 ----
        const size = frustumH * 0.95;
        const grid = new THREE.GridHelper(size, 10, 0xe2e8f0, 0xeef2f7);
        grid.position.y = -st.pitch - Math.max(st.r * 1.35, frustumH * 0.02);
        grid.material.transparent = true;
        grid.material.opacity = 0.7;
        dynamicGroup.add(grid);

        // B 標籤掛在其中一根箭頭頂端
        labels.b.userData.anchor = {
            x: ring * Math.cos(Math.PI / 4) + st.r * 0.25,
            y: halfH + Math.max(st.pitch * 0.12, st.r * 0.25),
            z: ring * Math.sin(Math.PI / 4),
        };
        labels.b.visible = true;
    }

    // ----------------------------------------------------------------------
    // 相機、fit、比例尺
    // ----------------------------------------------------------------------
    function updateCamera() {
        if (!camera) return;
        const canvas = $('physicsCanvas');
        const aspect = (canvas && canvas.clientWidth && canvas.clientHeight)
            ? canvas.clientWidth / canvas.clientHeight
            : 1.5;
        camera.top = frustumH / 2;
        camera.bottom = -frustumH / 2;
        camera.left = -frustumH * aspect / 2;
        camera.right = frustumH * aspect / 2;
        camera.updateProjectionMatrix();

        const d = 40;
        const ce = Math.cos(elev);
        camera.position.set(d * ce * Math.sin(yaw), d * Math.sin(elev), d * ce * Math.cos(yaw));
        camera.lookAt(0, 0, 0);
    }

    function wrapperPadding(wrapper) {
        const cs = getComputedStyle(wrapper);
        return {
            l: parseFloat(cs.paddingLeft) || 0,
            t: parseFloat(cs.paddingTop) || 0,
            b: parseFloat(cs.paddingBottom) || 0,
        };
    }

    function buildRuler() {
        const wrapper = $('physicsCanvas') && $('physicsCanvas').parentElement;
        if (!wrapper || $('scaleRuler')) return;
        wrapper.style.position = 'relative';
        const pad = wrapperPadding(wrapper);

        const box = document.createElement('div');
        box.id = 'scaleRuler';
        box.style.cssText = [
            'position:absolute', 'left:' + (pad.l + 8) + 'px',
            'bottom:' + (pad.b + 8) + 'px',
            'display:flex', 'align-items:center', 'gap:8px',
            'font:800 12px "Inter", monospace', 'color:#475569',
            'pointer-events:none', 'user-select:none',
        ].join(';');
        box.innerHTML = '<span id="scaleBar" style="display:inline-block;height:3px;background:#475569;"></span><span id="scaleText"></span>';
        wrapper.appendChild(box);

        const legend = document.createElement('div');
        legend.id = 'viewLegend';
        legend.style.cssText = [
            'position:absolute', 'left:' + (pad.l + 8) + 'px',
            'top:' + (pad.t + 8) + 'px',
            'font:700 12px "Inter", "Noto Sans TC", sans-serif',
            'color:#475569', 'pointer-events:none', 'user-select:none',
            'background:rgba(255,255,255,0.82)', 'padding:4px 8px', 'border-radius:4px',
        ].join(';');
        legend.innerHTML = '<span style="color:#16a34a;">v⊥</span> ／ '
            + '<span style="color:#8b5cf6;">v∥</span> ／ '
            + '<span style="color:#ef4444;">F</span>　'
            + '<span style="color:#ea580c;">p</span> = 螺距　拖曳可旋轉視角';
        wrapper.appendChild(legend);
    }

    function updateRuler() {
        const bar = $('scaleBar');
        const text = $('scaleText');
        const canvas = $('physicsCanvas');
        if (!bar || !text || !canvas || !canvas.clientHeight) return;

        // 視窗變窄時 .canvas-wrapper 的 padding 會換一組，疊層要跟著走。
        const wrapper = canvas.parentElement;
        if (wrapper) {
            const pad = wrapperPadding(wrapper);
            const ruler = $('scaleRuler');
            const legend = $('viewLegend');
            if (ruler) {
                ruler.style.left = (pad.l + 8) + 'px';
                ruler.style.bottom = (pad.b + 8) + 'px';
            }
            if (legend) {
                legend.style.left = (pad.l + 8) + 'px';
                legend.style.top = (pad.t + 8) + 'px';
            }
        }

        const pxPerM = canvas.clientHeight / frustumH;
        const nice = [
            1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5,
            1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3,
            1e-2, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20,
        ];
        let pick = nice[0];
        for (let i = 0; i < nice.length; i++) {
            const px = nice[i] * pxPerM;
            if (px >= 55 && px <= 150) { pick = nice[i]; break; }
            if (px < 55) pick = nice[i];
        }
        rulerLen = pick;

        const px = clamp(pick * pxPerM, 20, 160);
        bar.style.width = px.toFixed(1) + 'px';

        const f = fmtLen(pick);
        text.textContent = f.num + ' ' + f.unit;
    }

    // ----------------------------------------------------------------------
    // 每幀
    // ----------------------------------------------------------------------
    function render() {
        if (!THREE || !renderer || !state) return;
        const st = state;
        const dir = st.omega >= 0 ? 1 : -1;
        const maxTheta = Math.PI * 2 * TURNS;
        const frac = clamp(simTime / (ANIM_PERIOD * TURNS), 0, 1);
        const theta = dir * maxTheta * frac;

        // ---- 走過的軌跡 ----
        for (let i = 0; i < TRAIL_N; i++) {
            const th = theta * (i / (TRAIL_N - 1));
            const q = pointAtPhase(st, th);
            travelledPositions[i * 3] = q.x;
            travelledPositions[i * 3 + 1] = q.y - st.pitch;
            travelledPositions[i * 3 + 2] = q.z;
        }
        travelled.geometry.attributes.position.needsUpdate = true;

        // ---- 粒子 ----
        const pos = pointAtPhase(st, theta);
        const px = pos.x;
        const py = pos.y - st.pitch;
        const pz = pos.z;
        particle.position.set(px, py, pz);
        particle.scale.setScalar(Math.max(st.r * 0.06, frustumH * 0.0045));

        // ---- 三個箭頭 ----
        const vlen = 0.82 * st.r;
        const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
        vPerpArrow.position.set(px, py, pz);
        vPerpArrow.setDirection(tangent);
        vPerpArrow.setLength(vlen, vlen * 0.26, vlen * 0.13);
        vPerpArrow.visible = st.vperp > 0;

        const parLen = st.vperp > 0 ? vlen * (st.vpar / st.vperp) : 0;
        vParArrow.position.set(px, py, pz);
        vParArrow.setDirection(new THREE.Vector3(0, st.vpar >= 0 ? 1 : -1, 0));
        vParArrow.setLength(Math.max(parLen, 1e-9), Math.max(parLen * 0.26, 1e-9), Math.max(parLen * 0.13, 1e-9));
        vParArrow.visible = st.vpar > 1e3 && parLen > 1e-9;

        const fd = forceDir(st, theta);
        const flen = 0.62 * st.r;
        forceArrow.position.set(px, py, pz);
        forceArrow.setDirection(new THREE.Vector3(fd.x, fd.y, fd.z));
        forceArrow.setLength(flen, flen * 0.28, flen * 0.14);
        forceArrow.visible = true;

        // ---- 標籤 ----
        const gap = frustumH * 0.018;
        labels.vpar.visible = vParArrow.visible;
        placeLabel(labels.vperp, px + tangent.x * (vlen + gap), py + gap, pz + tangent.z * (vlen + gap));
        placeLabel(labels.vpar, px, py + parLen + gap * 2.2, pz);
        placeLabel(labels.force, px + fd.x * (flen + gap), py + gap, pz + fd.z * (flen + gap));

        const a = labels.pitch.userData.anchor;
        if (a) placeLabel(labels.pitch, a.x, a.y, a.z);
        const b = labels.b.userData.anchor;
        if (b) placeLabel(labels.b, b.x, b.y, b.z);

        renderer.render(scene, camera);
    }

    function placeLabel(sprite, x, y, z) {
        if (!sprite || !sprite.visible) return;
        sprite.position.set(x, y, z);
        const s = frustumH * 0.032;
        sprite.scale.set(s * sprite.userData.aspect, s, 1);
    }

    // ----------------------------------------------------------------------
    // 模擬時間
    // ----------------------------------------------------------------------
    function advance(dt) {
        if (!running) return;
        simTime += clamp(Number(dt) || 0, 0, 0.1);
        const total = ANIM_PERIOD * TURNS;
        if (simTime >= total) simTime -= total;
    }

    function loop(ts) {
        if (!renderer) return;
        const dt = lastTs ? (ts - lastTs) / 1000 : 0;
        lastTs = ts;
        // headless 驅動器（?ticks=N）自己會呼叫 __tick；rAF 再推進一次的話
        // 截圖會落在哪個相位就不確定了。使用者手動開頁時沒有 __ticks，
        // 這裡才是動畫真正的時鐘。
        if (!(typeof window !== 'undefined' && window.__ticks)) advance(dt);
        render();
        requestAnimationFrame(loop);
    }

    function flushPendingTicks() {
        if (!pendingTicks) { render(); return; }
        const n = pendingTicks;
        pendingTicks = 0;
        const step = (typeof window !== 'undefined' && window.__step) || 0.05;
        for (let i = 0; i < n; i++) advance(step);
        render();
    }

    // ----------------------------------------------------------------------
    // headless 自我驅動
    // ----------------------------------------------------------------------
    // `patch-site.py` 的 tick 迴圈是注入在 `*-scene.js` 的 p5 生命週期裡，
    // 而這一頁沒有 p5、也沒有 scene 模組——所以 `?ticks=N` 要自己跑。
    // 時機和 scene 補丁一致：load + 600 ms（驅動器固定 load + 400 ms 套
    // s_* 參數與按下 START），然後**同步**跑完，模擬時間才能逐位重現。
    function scheduleSelfDrive() {
        const q = pageQuery;
        const n = parseInt(q.get('ticks'), 10);
        if (!n) return;
        const step = parseFloat(q.get('dt') || '0.05');
        if (window.__ticks == null) window.__ticks = n;

        const run = () => setTimeout(() => {
            if (q.get('start')) running = true;
            if (!running) return;
            for (let i = 0; i < n; i++) advance(step);
            render();
        }, 600);

        if (document.readyState === 'complete') run();
        else window.addEventListener('load', run);
    }

    // headless 驅動器會呼叫這個；three 還沒載好就先排隊。
    if (typeof window !== 'undefined') {
        window.__tick = function (dt) {
            if (!renderer) { pendingTicks++; return; }
            advance(dt == null ? window.__step : dt);
            render();
        };
    }

    // ----------------------------------------------------------------------
    // 事件
    // ----------------------------------------------------------------------
    function bindEvents(canvas) {
        const psel = $('particleSelect');
        const vperp = $('vperpSlider');
        const vpar = $('vparSlider');
        const bsl = $('bSlider');

        if (psel) psel.onchange = () => {
            const el = $('particleVal');
            const p = PARTICLES[psel.value] || PARTICLES.proton;
            if (el) el.textContent = p.name + ' ' + p.sym;
            resetSim();
        };

        const syncVals = () => {
            const a = $('vperpVal'); if (a) a.textContent = parseFloat(vperp.value).toFixed(1);
            const b = $('vparVal'); if (b) b.textContent = parseFloat(vpar.value).toFixed(1);
            const c = $('bVal'); if (c) c.textContent = parseFloat(bsl.value).toFixed(0);
        };
        [vperp, vpar, bsl].forEach((el) => {
            if (el) el.oninput = () => { syncVals(); resetSim(); };
        });

        const startBtn = $('startBtn');
        const pauseBtn = $('pauseBtn');
        const rstBtn = $('rstBtn');
        if (startBtn) startBtn.onclick = () => { running = true; };
        if (pauseBtn) pauseBtn.onclick = () => { running = false; };
        if (rstBtn) rstBtn.onclick = () => resetSim();

        // 拖曳旋轉
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        canvas.style.cursor = 'grab';
        canvas.addEventListener('pointerdown', (e) => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas.style.cursor = 'grabbing';
            if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            yaw -= dx * 0.008;
            elev = clamp(elev + dy * 0.006, -0.25, 1.25);
            updateCamera();
            render();
        });
        const endDrag = () => { dragging = false; canvas.style.cursor = 'grab'; };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);

        window.addEventListener('resize', resize);
        if (typeof ResizeObserver !== 'undefined') {
            const wrapper = canvas.parentElement;
            if (wrapper) new ResizeObserver(() => resize()).observe(wrapper);
        }

        // 先把數值標籤同步一次
        syncVals();
    }

    function readPanel() {
        return {
            particle: ($('particleSelect') || {}).value || 'proton',
            vperp: parseFloat(($('vperpSlider') || {}).value || '5'),
            vpar: parseFloat(($('vparSlider') || {}).value || '1.5'),
            B: parseFloat(($('bSlider') || {}).value || '100'),
        };
    }

    function applyState() {
        if (!THREE) return;
        state = stateOf(readPanel());
        frustumH = computeFrustum(state);
        updateCards();
        rebuildScene();
        updateCamera();
        updateRuler();
        render();
    }

    function resetSim() {
        simTime = 0;
        running = false;
        if (THREE) applyState();
    }

    function resize() {
        if (!renderer) return;
        const canvas = $('physicsCanvas');
        if (!canvas) return;
        const wrapper = canvas.parentElement;
        const size = wrapper && typeof PhysicsUtils !== 'undefined'
            ? PhysicsUtils.contentSize(wrapper)
            : { w: wrapper ? wrapper.clientWidth : 800, h: wrapper ? wrapper.clientHeight : 600 };
        renderer.setSize(size.w, size.h, false);
        updateCamera();
        updateRuler();
        render();
    }

    // ----------------------------------------------------------------------
    // 開場
    // ----------------------------------------------------------------------
    const pageQuery = new URLSearchParams(location.search);
    if (pageQuery.get('ticks')) window.__ticks = parseInt(pageQuery.get('ticks'), 10);

    buildPanel();
    buildCards();

    // ⚠️ 事件要在 three.js 載完**之前**就綁好：headless 驅動器在 400 ms 就
    // 會按下「開始」，那時候 three 還在 CDN 上。綁在 initThree() 裡的話，
    // 那一下點擊會落空 → running 永遠是 false → tick 全部白跑，而
    // errs=0、按鈕有反應（只是沒效果）、截圖停在起點。
    bindEvents($('physicsCanvas'));

    bootThree().then(() => {
        applyState();
        scheduleSelfDrive();
    }).catch((err) => {
        // three.js 載不到時，畫面留下說明而不是一片空白。
        console.error('[helical-motion] three.js 載入失敗', err);
        const canvas = $('physicsCanvas');
        if (canvas && canvas.parentElement) {
            const note = document.createElement('div');
            note.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 14px "Inter",sans-serif;color:#64748b;text-align:center;padding:24px;';
            const webgl = /WebGL/i.test((err && err.message) || '');
            note.textContent = webgl
                ? '這個瀏覽器沒有開啟 WebGL，3D 畫面無法繪製。控制項與右側數據仍然可用。'
                : '3D 畫面載入失敗（three.js CDN 沒有回應）。控制項與右側數據仍然可用。';
            canvas.parentElement.style.position = 'relative';
            canvas.parentElement.appendChild(note);
        }
    });

    return API;
})();
