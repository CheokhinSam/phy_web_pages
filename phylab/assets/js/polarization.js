/**
 * 🕶️ 偏振：偏振片與透光軸
 *
 * 自然光通過第一片偏振片之後變成線偏振光，強度大約減半。
 * 第二片（檢偏片）只讓沿著自己透光軸的分量通過：
 * 兩片平行時最亮、垂直時全暗，中間角度介於兩者之間。
 *
 * 這一頁只做現象：不教光強的角度公式，也不把光強換成數字顯示。
 * 屏幕卡片只回報「亮／較暗／全暗」；亮度的模型只留在內部，
 * 讓畫面的明暗和真實情況一致，不寫進公式框或卡片。
 */

(function () {
    'use strict';

    const AXIS_Y = 500;
    const R = 110;                      // 偏振片半徑（世界單位）
    const P_X = [260, 540];             // 兩片偏振片的 x
    const SRC_X = 100;
    const DET_X = 830;
    const BEAM_START = 122;

    // 光具座上方的波形帶：把同一束光放大，畫出振動方向。
    // 這是一張立體示意圖——斜向代表垂直於畫面的方向，不是斜著傳播。
    const WAVE = {
        y: 272,             // 波形帶的中心線（世界座標）
        amp: 28,            // 通過第一片後，單一方向的振幅
        lambda: 120,        // 波長（世界單位，示意用）
        omega: 2.2,         // 動畫角頻率
        labelY: 196,        // 分段標籤
        naturalHalf: 12,    // 自然光段的短雙箭頭半長（比格距短，箭頭才數得出來）
    };
    const WAVE_X0 = P_X[0]; // 相位原點：第一片的中心
    const WAVE_K = 2 * Math.PI / WAVE.lambda;

    // ======================================================================
    // 立體視角
    // ======================================================================
    // 光束沿 +z 前進，x／y 是橫向平面（y 向上，投影時才翻成畫面 y 向下）。
    // 這樣 θ = 0° 就是 +y、θ = 90° 就是 +x，和平面檢視的波紋方向一致。
    const V3 = {
        Z_SRC: 0,
        Z_P1: 190,
        Z_P2: 500,
        Z_DET: 790,
        targetZ: 395,       // 相機環繞的中心（光束中點）
        R: 90,              // 偏振片半徑
        amp: 46,            // 通過 P₁ 後的振幅（比平面波形帶大，立體才看得見）
        lambda: 160,
        omega: 2.0,
        camDist: 1700,      // 透視的相機距離（越大越接近正交投影）
        rect: { x0: 64, y0: 214, x1: 836, y1: 756 },
        screenHW: 96,       // 屏幕半寬
        screenHH: 120,      // 屏幕半高
    };
    const CAM3_DEF = { yaw: 45, pitch: 15 };
    // yaw 的最小值不是「隨便轉到側面」：再小的話兩片圓盤在畫面上會疊成一團。
    const CAM3_LIM = {
        yawMin: 28, yawMax: 60,
        pitchMin: 8, pitchMax: 28,
    };
    // 畫布右上角的切換鈕（世界座標；不是 DOM 按鈕）。
    const TOGGLE3 = { x: 640, y: 62, x0: 620, x1: 790, y0: 40, y1: 88 };
    const W3_K = 2 * Math.PI / V3.lambda;

    let viewMode = '3d';                       // '3d' / '2d'
    let cam3 = { yaw: CAM3_DEF.yaw, pitch: CAM3_DEF.pitch };
    const ptr3 = { wasDown: false, active: false, lastX: 0, lastY: 0 };

    const LEGEND = { x: 54, y: 76, gap: 30 };

    const C_POL = [37, 99, 235];
    const C_POL_FILL = [219, 234, 254];
    const C_REF = [148, 163, 184];
    const C_SRC = [245, 158, 11];
    const C_WAVE_SOFT = [251, 191, 36];
    const C_ANGLE = [139, 92, 246];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    /** 兩個角度差，化到 −90°～90°。 */
    function wrapDiff(a, b) {
        let d = (a - b) % 180;
        if (d > 90) d -= 180;
        if (d < -90) d += 180;
        return d;
    }

    /** 屏幕的定性回報：只看最後一段光束相對於「最亮」的比例。 */
    function screenWord(I) {
        const frac = clamp(I, 0, 100) / 50;
        if (frac >= 0.70) return '亮';
        if (frac >= 0.05) return '較暗';
        return '全暗';
    }

    /**
     * 偏振方向在世界座標裡的「立體投影」單位向量。
     * θ = 0° 朝上；θ = 90° 斜向右上——斜向代表垂直於畫面的方向。
     * 回傳的向量長度固定是 1，振幅才不會被角度偷走。
     */
    function waveDir(deg) {
        const th = deg * Math.PI / 180;
        const dx = 0.62 * Math.sin(th);
        const dy = -Math.cos(th) - 0.62 * Math.sin(th);
        const m = Math.hypot(dx, dy) || 1;
        return { x: dx / m, y: dy / m };
    }

    /** 波形帶的相位：以第一片偏振片為原點，整條帶子共用同一個相位。 */
    function wavePhase(x, t) {
        return WAVE_K * (x - WAVE_X0) - WAVE.omega * t;
    }

    /**
     * 波形帶的分段內容（平面與立體共用）。自然光一段、第一片後一段；
     * 兩片模式再多第二片後一段。x0/x1 或 z0/z1 由呼叫端補上。
     */
    function waveSegmentSpecs(state, A1) {
        const specs = [
            {
                key: 'natural', angle: null, amp: 0,
                label: '自然光：各方向', col: C_SRC,
            },
            {
                key: 'p1',
                angle: state.theta1, amp: A1,
                label: state.count >= 2 ? '通過 P₁：θ₁ 方向' : '通過 P₁：線偏振光',
                col: C_POL,
            },
        ];
        if (state.count >= 2) {
            const A2 = A1 * Math.abs(Math.cos(state.delta12 * Math.PI / 180));
            const dark = state.screen === '全暗';
            specs.push({
                key: 'p2',
                angle: state.theta2, amp: A2,
                label: dark ? '沒有分量（全暗）' : '通過 P₂：θ₂ 的分量',
                col: dark ? C_REF : C_POL,
            });
        }
        return specs;
    }

    /**
     * 平面波形帶的分段。每一段都帶 x0/x1、振動方向 angle、振幅 amp 與標籤；
     * 振幅 0 的那一段是「全暗」，繪圖端會畫成壓平的中心線。
     */
    function waveStages(state) {
        const xs = [
            [BEAM_START, P_X[0]],
            [P_X[0], state.count >= 2 ? P_X[1] : DET_X],
            [P_X[1], DET_X],
        ];
        return waveSegmentSpecs(state, WAVE.amp).map((s, i) => ({
            ...s, x0: xs[i][0], x1: xs[i][1],
        }));
    }

    /**
     * 波形上一點的位移（世界座標）。e 是帶正負號的振幅，
     * x/y 是投影到畫面後的位移；|offset| 永遠不超過該段的 amp。
     */
    function waveOffset(x, stage, t) {
        if (!stage || !stage.amp) return { x: 0, y: 0, e: 0 };
        const d = waveDir(stage.angle);
        const e = stage.amp * Math.sin(wavePhase(x, t));
        return { x: d.x * e, y: d.y * e, e };
    }

    /**
     * 整條偏振鏈。I₀ = 100（百分比）。
     * mode = single / double，只影響 last 取哪一段。
     */
    function polarState(theta1, theta2, mode) {
        const t1 = clamp(num(theta1, 0), 0, 180);
        const t2 = clamp(num(theta2, 45), 0, 180);
        const I0 = 100;
        const I1 = I0 / 2;
        const d12 = wrapDiff(t2, t1);
        const I2 = I1 * Math.pow(Math.cos(d12 * Math.PI / 180), 2);

        const m = mode === 'double' ? 'double' : 'single';
        const last = m === 'single' ? I1 : I2;
        return {
            mode: m,
            theta1: t1, theta2: t2,
            I0, I1, I2,
            delta12: d12,
            abs12: Math.abs(d12),
            last,
            screen: screenWord(last),
            count: m === 'single' ? 1 : 2,
        };
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = panel.mode === 'double' ? 'double' : 'single';
        return polarState(panel.theta1, panel.theta2, mode);
    }

    function legendRows(state) {
        if (state.mode === 'double') {
            return [
                { text: '兩片夾角 Δθ = |θ₂ − θ₁|', col: C_ANGLE },
                { text: '第二片（檢偏片）：平行最亮、垂直全暗', col: C_POL },
                { text: '藍線＝透光軸；上方波形＝振動方向', col: C_REF },
            ];
        }
        return [
            { text: '自然光 → 偏振片 → 線偏振光', col: C_SRC },
            { text: '轉動第一片：屏幕一樣亮', col: C_POL },
            { text: '藍線＝透光軸；上方波形＝振動方向', col: C_REF },
        ];
    }

    // ======================================================================
    // 立體視角的純函式（不碰 DOM，Node 可逐位斷言）
    // ======================================================================

    function rad3(deg) {
        return deg * Math.PI / 180;
    }

    /** 偏振角在橫向平面上的單位向量；θ = 0° 是 +y，θ = 90° 是 +x。 */
    function dir3(deg) {
        const th = rad3(num(deg, 0));
        return { x: Math.sin(th), y: Math.cos(th), z: 0 };
    }

    /** 與 dir3 垂直、同樣在橫向平面上的單位向量（θ = 0° 時是 +x）。 */
    function perp3(deg) {
        const th = rad3(num(deg, 0));
        return { x: Math.cos(th), y: -Math.sin(th), z: 0 };
    }

    /**
     * 世界座標 → 相機座標：先繞 y 軸轉 yaw，再繞 x 軸抬 pitch。
     * 回傳的 z 是「離相機多遠」，用於透視。
     */
    function camSpace3(q, cam) {
        cam = cam || CAM3_DEF;
        const yaw = rad3(num(cam.yaw, CAM3_DEF.yaw));
        const pitch = rad3(num(cam.pitch, CAM3_DEF.pitch));
        const x0 = num(q.x, 0);
        const y0 = num(q.y, 0);
        const z0 = num(q.z, 0) - V3.targetZ;
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const x1 = x0 * cy + z0 * sy;
        const z1 = -x0 * sy + z0 * cy;
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        return {
            x: x1,
            y: y0 * cp + z1 * sp,
            z: -y0 * sp + z1 * cp,
        };
    }

    /**
     * 透視投影，回傳 fit 之前的相機平面座標。
     * u 向右、v 向上（和畫面的 y 向下相反），d 是深度。
     */
    function rawProject3(q, cam, camDist) {
        const D = camDist == null ? V3.camDist : camDist;
        const c = camSpace3(q, cam);
        const denom = D + c.z;
        const f = denom === 0 ? 1 : D / denom;
        return { u: c.x * f, v: c.y * f, d: c.z, f };
    }

    /**
     * 用相機限制範圍內的所有樣本點算一個固定的 fit：
     * 拖曳時畫面不會跟著「呼吸」，各角度都不會出界。
     */
    function fit3(points, limits, rect, camDist, yawSteps, pitchSteps, pad) {
        const lim = limits || CAM3_LIM;
        const r = rect || V3.rect;
        const yn = yawSteps == null ? 8 : yawSteps;
        const pn = pitchSteps == null ? 8 : pitchSteps;
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        for (let i = 0; i <= yn; i++) {
            const yaw = lim.yawMin + (lim.yawMax - lim.yawMin) * i / yn;
            for (let j = 0; j <= pn; j++) {
                const pitch = lim.pitchMin + (lim.pitchMax - lim.pitchMin) * j / pn;
                for (const q of points) {
                    const s = rawProject3(q, { yaw, pitch }, camDist);
                    if (s.u < minU) minU = s.u;
                    if (s.u > maxU) maxU = s.u;
                    if (s.v < minV) minV = s.v;
                    if (s.v > maxV) maxV = s.v;
                }
            }
        }
        const spanU = Math.max(1e-9, maxU - minU);
        const spanV = Math.max(1e-9, maxV - minV);
        const f = pad == null ? 0.96 : pad;
        const scale = Math.min((r.x1 - r.x0) / spanU, (r.y1 - r.y0) / spanV) * f;
        return {
            scale,
            cx: (r.x0 + r.x1) / 2 - scale * (minU + maxU) / 2,
            cy: (r.y0 + r.y1) / 2 + scale * (minV + maxV) / 2,
            minU, maxU, minV, maxV,
        };
    }

    /** 立體場景的外框：光源、兩片圓盤（含上方標籤）、波形包絡、屏幕。 */
    function sceneBounds3() {
        const out = [];
        const ring = (z, rx, ry) => {
            for (let i = 0; i < 16; i++) {
                const a = i / 16 * Math.PI * 2;
                out.push({ x: rx * Math.cos(a), y: ry * Math.sin(a), z });
            }
        };
        ring(V3.Z_SRC, 42, 42);                 // 光源光暈
        out.push({ x: 0, y: 62, z: V3.Z_SRC }); // 光源上方標籤
        ring(65, 55, 55);                       // 自然光的兩圈箭頭
        ring(140, 55, 55);
        ring(V3.Z_P1, V3.R, V3.R + 52);         // 圓盤＋上方標籤
        ring(V3.Z_P2, V3.R, V3.R + 52);
        for (const z of [V3.Z_P1 + 70, V3.Z_P2 - 70, V3.Z_P2 + 80, V3.Z_DET - 80]) {
            ring(z, V3.amp + 6, V3.amp + 6);    // 波形包絡
        }
        for (const sx of [-1, 1]) {
            for (const sy of [-1, 1]) {
                out.push({ x: sx * V3.screenHW, y: sy * V3.screenHH, z: V3.Z_DET });
            }
        }
        out.push({ x: 0, y: -V3.screenHH - 44, z: V3.Z_DET }); // 屏幕下方標籤
        return out;
    }

    const SCENE3_BOUNDS = sceneBounds3();
    const FIT3 = fit3(SCENE3_BOUNDS, CAM3_LIM, V3.rect, V3.camDist);

    /** 世界座標 → 世界單位下的畫面座標（之後才交給 view.toScreenX/Y）。 */
    function project3(q, cam) {
        const s = rawProject3(q, cam || CAM3_DEF);
        return {
            x: FIT3.cx + FIT3.scale * s.u,
            y: FIT3.cy - FIT3.scale * s.v,
            depth: s.d,
            f: s.f,
        };
    }

    /** 拖曳：橫向轉 yaw、縱向抬 pitch，兩者都夾在限制內。 */
    function dragCam3(cam, dx, dy) {
        const c = cam || CAM3_DEF;
        return {
            yaw: clamp(num(c.yaw, CAM3_DEF.yaw) + num(dx, 0) * 0.16,
                       CAM3_LIM.yawMin, CAM3_LIM.yawMax),
            pitch: clamp(num(c.pitch, CAM3_DEF.pitch) - num(dy, 0) * 0.12,
                         CAM3_LIM.pitchMin, CAM3_LIM.pitchMax),
        };
    }

    /** 右上角切換鈕的命中測試（世界座標）。 */
    function viewToggleHit(x, y) {
        return x >= TOGGLE3.x0 && x <= TOGGLE3.x1 &&
               y >= TOGGLE3.y0 && y <= TOGGLE3.y1;
    }

    function nextViewMode(mode) {
        return mode === '2d' ? '3d' : '2d';
    }

    function initialViewMode(search) {
        return /(?:^|[?&])view=2d(?:&|$)/.test(search || '') ? '2d' : '3d';
    }

    if (typeof window !== 'undefined' && window.location) {
        viewMode = initialViewMode(window.location.search);
    }

    /**
     * 立體波形帶的分段，幾何和平面版共用 waveSegmentSpecs；
     * 差別只在「沿光束」的座標是 z。
     */
    function wave3Stages(state) {
        const zs = [
            [V3.Z_SRC, V3.Z_P1],
            [V3.Z_P1, state.count >= 2 ? V3.Z_P2 : V3.Z_DET],
            [V3.Z_P2, V3.Z_DET],
        ];
        const stages = waveSegmentSpecs(state, V3.amp).map((s, i) => ({
            ...s, z0: zs[i][0], z1: zs[i][1],
        }));
        if (stages.length >= 3) {
            // 立體波形用帶正負號的投影，P₂ 前後的相位才接得起來；
            // 平面波形帶維持 |cos Δθ| 的既有寫法（兩邊圓盤看起來一樣）。
            stages[2].amp = V3.amp * Math.cos(state.delta12 * Math.PI / 180);
        }
        return stages;
    }

    /** 立體波形上一點的位移；e 是帶正負號的振幅。 */
    function wave3Point(z, stage, t) {
        if (!stage || !stage.amp) return { x: 0, y: 0, z, e: 0 };
        const d = dir3(stage.angle);
        const e = stage.amp * Math.sin(W3_K * (z - V3.Z_P1) - V3.omega * t);
        return { x: d.x * e, y: d.y * e, z, e };
    }

    /**
     * P₂ 圓盤上的「分解三角形」：入射的 A 沿 θ₁、通過的 A·cosΔθ 沿 θ₂，
     * 被擋掉的分量是兩者的差（與 θ₂ 垂直）。
     * 回傳的 cos 取正：cos(120°) 和 cos(−60°) 的投影長度一樣。
     */
    function projectionTri3(theta1, theta2, amp) {
        const A = num(amp, 0);
        let a = dir3(theta1);
        const b = dir3(theta2);
        let k = a.x * b.x + a.y * b.y;
        if (k < 0) {
            a = { x: -a.x, y: -a.y, z: 0 };
            k = -k;
        }
        const incoming = { x: a.x * A, y: a.y * A, z: 0 };
        const outgoing = { x: b.x * A * k, y: b.y * A * k, z: 0 };
        return {
            incoming, outgoing,
            connector: {
                x: incoming.x - outgoing.x,
                y: incoming.y - outgoing.y,
                z: 0,
            },
            cos: k,
            inAmp: A,
            outAmp: A * k,
            conLen: A * Math.sqrt(Math.max(0, 1 - k * k)),
        };
    }

    function legendRows3(state) {
        const rows = [
            { text: '拖曳旋轉；右上角切換平面檢視', col: C_REF },
            { text: '淡色平面＝光的振動平面', col: C_POL },
        ];
        if (state.mode === 'double') {
            rows.push({ text: '灰虛線＝被 P₂ 擋掉的分量', col: C_REF });
            if (state.screen === '全暗') {
                rows.push({ text: '兩片垂直：沒有分量，屏幕全暗', col: C_REF });
            }
        } else {
            rows.push({ text: '自然光：各方向都有振動', col: C_SRC });
        }
        return rows;
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawBeam(p, view, a, b, I) {
        // I = 0 就是「沒有光」：alpha 必須真的是 0，不能留一個底線。
        const alpha = 1.1 * clamp(I, 0, 100);
        p.push();
        p.stroke(245, 158, 11, alpha);
        p.strokeWeight(OpticsScene.L(view, 9, 3));
        p.line(view.toScreenX(a), view.toScreenY(AXIS_Y),
               view.toScreenX(b), view.toScreenY(AXIS_Y));
        p.pop();

        p.push();
        p.stroke(255, 255, 255, Math.min(110, alpha * 0.55));
        p.strokeWeight(OpticsScene.L(view, 3, 1));
        p.line(view.toScreenX(a), view.toScreenY(AXIS_Y),
               view.toScreenX(b), view.toScreenY(AXIS_Y));
        p.pop();
    }

    function drawPolarizer(p, view, x, angle, tag) {
        const cx = view.toScreenX(x);
        const cy = view.toScreenY(AXIS_Y);
        const rp = OpticsScene.L(view, R);
        const th = angle * Math.PI / 180;
        const dir = { x: Math.sin(th), y: -Math.cos(th) };
        const perp = { x: Math.cos(th), y: Math.sin(th) };
        const gx = v => view.toScreenX(v);
        const gy = v => view.toScreenY(v);

        // 圓盤本體
        p.push();
        p.stroke(C_POL[0], C_POL[1], C_POL[2], 210);
        p.strokeWeight(OpticsScene.L(view, 2.4, 1.5));
        p.fill(C_POL_FILL[0], C_POL_FILL[1], C_POL_FILL[2], 105);
        p.ellipse(cx, cy, rp * 2, rp * 2);
        p.pop();

        // 0° 參考線（鉛直）
        OpticsScene.dashed(p, view,
            { x, y: AXIS_Y - R * 0.92 }, { x, y: AXIS_Y + R * 0.92 },
            C_REF, { w: 1.1, dash: [6, 9] });

        // 柵欄：一串平行於透光軸的細線，長度由圓的弦決定，全部落在圓內。
        p.push();
        p.stroke(C_POL[0], C_POL[1], C_POL[2], 85);
        p.strokeWeight(OpticsScene.L(view, 1.2, 1));
        for (let i = -3; i <= 3; i++) {
            const d = i * R * 0.23;
            const half = Math.sqrt(Math.max(0, R * R - d * d));
            const ax = x + perp.x * d - dir.x * half;
            const ay = AXIS_Y + perp.y * d - dir.y * half;
            const bx = x + perp.x * d + dir.x * half;
            const by = AXIS_Y + perp.y * d + dir.y * half;
            p.line(gx(ax), gy(ay), gx(bx), gy(by));
        }
        p.pop();

        // 透光軸：從圓心往兩端各畫一支箭頭，才是雙向的軸。
        OpticsScene.line(p, view,
            { x, y: AXIS_Y },
            { x: x + dir.x * R, y: AXIS_Y + dir.y * R },
            C_POL, { w: 4.2, arrowEnd: true, head: 8 });
        OpticsScene.line(p, view,
            { x, y: AXIS_Y },
            { x: x - dir.x * R, y: AXIS_Y - dir.y * R },
            C_POL, { w: 4.2, arrowEnd: true, head: 8 });

        // 角度弧：從鉛直（0°）量到透光軸
        if (angle > 1.5) {
            OpticsScene.drawAngleArc(p, view, { x, y: AXIS_Y },
                -Math.PI / 2, -Math.PI / 2 + th, 40, C_POL);
        }

        OpticsScene.worldBadge(p, view, x, AXIS_Y - R - 32,
            `${tag}　θ = ${angle.toFixed(0)}°`,
            { size: 13, col: C_POL });
    }

    function drawSource(p, view) {
        const cx = view.toScreenX(SRC_X);
        const cy = view.toScreenY(AXIS_Y);
        p.push();
        p.noStroke();
        for (let i = 3; i >= 1; i--) {
            p.fill(C_SRC[0], C_SRC[1], C_SRC[2], 24 * i);
            p.ellipse(cx, cy, OpticsScene.L(view, 30 + i * 18),
                      OpticsScene.L(view, 30 + i * 18));
        }
        p.fill(C_SRC[0], C_SRC[1], C_SRC[2]);
        p.ellipse(cx, cy, OpticsScene.L(view, 30), OpticsScene.L(view, 30));
        p.fill(255, 248, 220);
        p.ellipse(cx, cy, OpticsScene.L(view, 12), OpticsScene.L(view, 12));
        p.pop();

        OpticsScene.worldBadge(p, view, SRC_X, AXIS_Y - 64, '自然光',
            { size: 13, col: C_SRC });
    }

    function drawDetector(p, view, I) {
        const x = view.toScreenX(DET_X);
        const y = view.toScreenY(AXIS_Y);
        const w = OpticsScene.L(view, 26, 8);
        const h = OpticsScene.L(view, 210, 60);

        p.push();
        p.noStroke();
        p.fill(30, 41, 59);
        p.rect(x - w / 2, y - h / 2, w, h, OpticsScene.L(view, 5, 2));
        p.fill(255);
        p.ellipse(x, y, OpticsScene.L(view, 54, 18), OpticsScene.L(view, 54, 18));
        // 屏幕的亮斑也一樣：I = 0 時不發光（原本留 55 的底色）。
        p.fill(245, 158, 11, 2.45 * clamp(I, 0, 100));
        p.ellipse(x, y, OpticsScene.L(view, 54, 18), OpticsScene.L(view, 54, 18));
        p.pop();

        OpticsScene.worldBadge(p, view, DET_X, AXIS_Y - 128, '屏幕',
            { size: 13, col: [30, 41, 59] });
    }

    // ======================================================================
    // 波形帶：把同一束光的振動方向畫在光具座上方
    // ======================================================================

    /** 雙箭頭：E 的振動是往復的，所以兩端都要有箭尖。 */
    function drawDoubleArrow(p, view, cx, cy, d, half, col, w, head) {
        const a = { x: cx - d.x * half, y: cy - d.y * half };
        const b = { x: cx + d.x * half, y: cy + d.y * half };
        OpticsScene.line(p, view, a, b, col, { w, arrowEnd: true, head });
        OpticsScene.line(p, view, b, a, col, { w, arrowEnd: true, head });
    }

    const NAT_ANGLES = [8, 62, 118, 32, 152, 84, 170];

    function drawNaturalStage(p, view, stage) {
        const n = NAT_ANGLES.length;
        const x0 = stage.x0 + 12, x1 = stage.x1 - 12;
        for (let i = 0; i < n; i++) {
            const x = x0 + (x1 - x0) * i / (n - 1);
            drawDoubleArrow(p, view, x, WAVE.y, waveDir(NAT_ANGLES[i]),
                WAVE.naturalHalf, C_WAVE_SOFT, 1.5, 4);
        }
    }

    function drawPolarizedStage(p, view, stage, t) {
        const d = waveDir(stage.angle);

        // 中心線：振幅歸零時，至少還有一條線說明「這裡沒有振動」。
        OpticsScene.dashed(p, view,
            { x: stage.x0, y: WAVE.y }, { x: stage.x1, y: WAVE.y },
            [226, 232, 240], { w: 1, dash: [5, 7] });

        if (stage.amp < 0.5) {
            OpticsScene.line(p, view,
                { x: stage.x0, y: WAVE.y }, { x: stage.x1, y: WAVE.y },
                stage.col, { w: 2.4 });
            return;
        }

        p.push();
        p.noFill();
        p.stroke(stage.col[0], stage.col[1], stage.col[2]);
        p.strokeWeight(OpticsScene.L(view, 2.2, 1.4));
        p.beginShape();
        for (let x = stage.x0; x <= stage.x1 + 1e-9; x += 2.5) {
            const o = waveOffset(x, stage, t);
            p.vertex(view.toScreenX(x + o.x), view.toScreenY(WAVE.y + o.y));
        }
        p.endShape();
        p.pop();

        // 三個固定取樣點：雙箭頭的半長就是該處的瞬時振幅。
        for (let i = 1; i <= 3; i++) {
            const x = stage.x0 + (stage.x1 - stage.x0) * i / 4;
            const o = waveOffset(x, stage, t);
            const half = Math.abs(o.e);
            if (half > 1.5) {
                drawDoubleArrow(p, view, x, WAVE.y, d, half, stage.col, 1.4, 4);
            }
        }
    }

    function drawWaveStrip(p, view, t, state) {
        const stages = waveStages(state);

        // 貫穿整條帶子的中心虛線
        OpticsScene.dashed(p, view,
            { x: BEAM_START, y: WAVE.y }, { x: DET_X, y: WAVE.y },
            [226, 232, 240], { w: 1, dash: [7, 9] });

        // 偏振片的位置：波形帶下緣接一小段虛線，指向下方的圓盤。
        // 不要把整條帶子切開——第二片那裡的投影虛線會和它疊在一起。
        const cuts = state.count >= 2 ? [P_X[0], P_X[1]] : [P_X[0]];
        for (const x of cuts) {
            OpticsScene.dashed(p, view,
                { x, y: WAVE.y + WAVE.amp + 8 },
                { x, y: WAVE.y + WAVE.amp + 40 },
                [203, 213, 225], { w: 1.1, dash: [6, 8] });
        }

        for (const s of stages) {
            if (s.key === 'natural') drawNaturalStage(p, view, s);
            else drawPolarizedStage(p, view, s, t);
        }

        // 第二片的位置：把原本 θ₁ 的振動投影到 θ₂；虛線是被擋掉的分量。
        if (state.count >= 2) {
            const o1 = waveOffset(P_X[1], stages[1], t);
            const o2 = waveOffset(P_X[1], stages[2], t);
            OpticsScene.dashed(p, view,
                { x: P_X[1] + o1.x, y: WAVE.y + o1.y },
                { x: P_X[1] + o2.x, y: WAVE.y + o2.y },
                C_REF, { w: 1.3, dash: [4, 5] });
        }

        for (const s of stages) {
            OpticsScene.worldBadge(p, view, (s.x0 + s.x1) / 2, WAVE.labelY,
                s.label, { size: 11, col: s.col });
        }
    }

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;

        // 主軸
        OS.dashed(p, view, { x: 40, y: AXIS_Y }, { x: 878, y: AXIS_Y },
            [226, 232, 240], { w: 1.2, dash: [10, 10] });

        // 光束：每一段的亮度就是那一段的光強
        drawBeam(p, view, BEAM_START, P_X[0], state.I0);
        if (state.count >= 2) {
            drawBeam(p, view, P_X[0], P_X[1], state.I1);
            drawBeam(p, view, P_X[1], DET_X, state.last);
        } else {
            drawBeam(p, view, P_X[0], DET_X, state.last);
        }

        drawSource(p, view);
        drawPolarizer(p, view, P_X[0], state.theta1, 'P₁');
        if (state.count >= 2) drawPolarizer(p, view, P_X[1], state.theta2, 'P₂');
        drawDetector(p, view, state.last);
        drawWaveStrip(p, view, t, state);

        const rows = legendRows(state);
        const gap = OS.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OS.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                rows[i].text, { size: 12, col: rows[i].col, align: 'left' });
        }
    }

    // ======================================================================
    // 立體畫面
    // ======================================================================

    function projectPoly3(p, view, cam, pts, fillCol, fillA, strokeCol, strokeW) {
        p.push();
        if (fillCol) p.fill(fillCol[0], fillCol[1], fillCol[2],
                             fillA == null ? 255 : fillA);
        else p.noFill();
        if (strokeCol) {
            p.stroke(strokeCol[0], strokeCol[1], strokeCol[2]);
            p.strokeWeight(OpticsScene.L(view, strokeW == null ? 1.5 : strokeW, 1));
        } else {
            p.noStroke();
        }
        p.beginShape();
        for (const q of pts) {
            const s = project3(q, cam);
            p.vertex(view.toScreenX(s.x), view.toScreenY(s.y));
        }
        p.endShape(p.CLOSE);
        p.pop();
    }

    function line3(p, view, cam, a, b, col, o) {
        const A = project3(a, cam);
        const B = project3(b, cam);
        OpticsScene.line(p, view, A, B, col, o);
    }

    function dashed3(p, view, cam, a, b, col, o) {
        const A = project3(a, cam);
        const B = project3(b, cam);
        OpticsScene.dashed(p, view, A, B, col, o);
    }

    function doubleArrow3(p, view, cam, c, d, half, col, w, head) {
        if (!(half > 0.5)) return;
        const A = project3({ x: c.x - d.x * half, y: c.y - d.y * half, z: c.z }, cam);
        const B = project3({ x: c.x + d.x * half, y: c.y + d.y * half, z: c.z }, cam);
        const o = { w: w || 1.5, arrowEnd: true, head: head || 4 };
        OpticsScene.line(p, view, A, B, col, o);
        OpticsScene.line(p, view, B, A, col, o);
    }

    function circlePts3(cx, cy, cz, rx, ry, n) {
        const pts = [];
        const count = n || 48;
        for (let i = 0; i < count; i++) {
            const a = i / count * Math.PI * 2;
            pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), z: cz });
        }
        return pts;
    }

    /** 以 +y（θ = 0°）為起點、在圓盤平面上的角度弧取樣。 */
    function arcPts3(z, r, a0, a1, n) {
        const pts = [];
        const count = n || 30;
        for (let i = 0; i <= count; i++) {
            const th = rad3(a0 + (a1 - a0) * i / count);
            pts.push({ x: r * Math.sin(th), y: r * Math.cos(th), z });
        }
        return pts;
    }

    function polyline3(p, view, cam, pts, col, w, minW) {
        p.push();
        p.noFill();
        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(OpticsScene.L(view, w == null ? 2 : w,
                                     minW == null ? 1 : minW));
        p.beginShape();
        for (const q of pts) {
            const s = project3(q, cam);
            p.vertex(view.toScreenX(s.x), view.toScreenY(s.y));
        }
        p.endShape();
        p.pop();
    }

    function drawBeam3(p, view, cam, z0, z1, col, alpha, w) {
        if (!(alpha > 0)) return;
        const A = project3({ x: 0, y: 0, z: z0 }, cam);
        const B = project3({ x: 0, y: 0, z: z1 }, cam);
        p.push();
        p.stroke(col[0], col[1], col[2], alpha);
        p.strokeWeight(OpticsScene.L(view, w, 2));
        p.line(view.toScreenX(A.x), view.toScreenY(A.y),
               view.toScreenX(B.x), view.toScreenY(B.y));
        p.pop();
    }

    function drawAxis3(p, view, cam) {
        dashed3(p, view, cam,
            { x: 0, y: 0, z: -20 }, { x: 0, y: 0, z: V3.Z_DET + 30 },
            [226, 232, 240], { w: 1.2, dash: [10, 10] });
    }

    function drawSource3(p, view, cam) {
        const s = project3({ x: 0, y: 0, z: V3.Z_SRC }, cam);
        const sx = view.toScreenX(s.x), sy = view.toScreenY(s.y);
        p.push();
        p.noStroke();
        for (const layer of [[30, 40], [22, 90], [14, 150]]) {
            p.fill(C_SRC[0], C_SRC[1], C_SRC[2], layer[1]);
            p.circle(sx, sy, OpticsScene.L(view, layer[0], 8));
        }
        p.fill(255, 252, 240, 240);
        p.circle(sx, sy, OpticsScene.L(view, 8, 4));
        p.pop();
    }

    function drawNatural3(p, view, cam) {
        const rings = [65, 140];
        for (let r = 0; r < rings.length; r++) {
            for (let i = 0; i < 8; i++) {
                const a = (i * 45 + (r ? 22.5 : 0));
                const d = dir3(a);
                const c = { x: d.x * 26, y: d.y * 26, z: rings[r] };
                doubleArrow3(p, view, cam, c, d, 16, C_WAVE_SOFT, 1.5, 4);
            }
        }
    }

    function drawScreen3(p, view, cam, state) {
        const z = V3.Z_DET;
        const hw = V3.screenHW, hh = V3.screenHH;
        projectPoly3(p, view, cam, [
            { x: -hw, y: -hh, z }, { x: hw, y: -hh, z },
            { x: hw, y: hh, z }, { x: -hw, y: hh, z },
        ], [30, 41, 59], 236, [71, 85, 105], 2.2);

        const I = clamp(state.last, 0, 100);
        if (I > 0.4) {
            // 三層暖色光暈＋中心亮點；半徑都畫在屏幕平面上。
            const layers = [[46, 0.70], [34, 1.00], [22, 1.35]];
            for (const layer of layers) {
                const a = Math.min(235, Math.round(layer[1] * I * 1.8));
                projectPoly3(p, view, cam,
                    circlePts3(0, 0, z, layer[0], layer[0], 40),
                    [255, 213, 128], a, null, 0);
            }
            const aCore = Math.min(235, Math.round(0.9 * I * 1.8));
            projectPoly3(p, view, cam,
                circlePts3(0, 0, z, 11, 11, 28),
                [255, 255, 255], aCore, null, 0);
        }
    }

    function drawWave3(p, view, cam, stage, t, opts) {
        opts = opts || {};
        if (!stage || stage.key === 'natural') return;
        const z0 = stage.z0, z1 = stage.z1;
        const c0 = { x: 0, y: 0, z: z0 };
        const c1 = { x: 0, y: 0, z: z1 };

        if (Math.abs(stage.amp) < 0.5) {
            // 沒有分量：壓成中心線（灰線），和平面檢視的處理一致。
            line3(p, view, cam, c0, c1, stage.col, { w: 2.6 });
            return;
        }

        const d = dir3(stage.angle);
        const A = stage.amp;

        // 振動平面：半透明的平行四邊形。
        projectPoly3(p, view, cam, [
            { x: d.x * A, y: d.y * A, z: z0 },
            { x: d.x * A, y: d.y * A, z: z1 },
            { x: -d.x * A, y: -d.y * A, z: z1 },
            { x: -d.x * A, y: -d.y * A, z: z0 },
        ], stage.col, 18, null, 0);

        // 平面上下緣的虛線包絡。
        for (const sgn of [1, -1]) {
            dashed3(p, view, cam,
                { x: sgn * d.x * A, y: sgn * d.y * A, z: z0 },
                { x: sgn * d.x * A, y: sgn * d.y * A, z: z1 },
                stage.col, { w: 1, dash: [5, 7] });
        }

        // 正弦曲線
        const n = Math.max(24, Math.ceil((z1 - z0) / 6));
        const pts = [];
        for (let i = 0; i <= n; i++) {
            pts.push(wave3Point(z0 + (z1 - z0) * i / n, stage, t));
        }
        polyline3(p, view, cam, pts, stage.col, 2.3, 1.4);

        // 取樣點：雙箭頭橫跨振動平面，半長是瞬時振幅。
        // 第二段（P₂ 後）只要兩個，不然斜向的箭頭會把波形和屏幕蓋住。
        const samples = opts.samples == null ? 3 : opts.samples;
        for (let i = 1; i <= samples; i++) {
            const f = samples === 1 ? 0.5 : i / (samples + 1);
            const z = z0 + (z1 - z0) * f;
            const q = wave3Point(z, stage, t);
            if (Math.abs(q.e) > 1.5) {
                doubleArrow3(p, view, cam, { x: 0, y: 0, z }, d,
                    Math.abs(q.e), stage.col,
                    opts.arrowW == null ? 1.5 : opts.arrowW,
                    opts.head == null ? 4 : opts.head);
            }
        }
    }

    function drawPolarizer3(p, view, cam, z, angle, opts) {
        opts = opts || {};
        const R = V3.R;
        const c = { x: 0, y: 0, z };
        const d = dir3(angle);
        const pp = perp3(angle);

        // 圓盤本體
        projectPoly3(p, view, cam, circlePts3(0, 0, z, R, R, 64),
            C_POL_FILL, 92, C_POL, 2.2);

        // 平行透光軸的細線（斜線），讓圓盤的朝向看得出來。
        p.push();
        p.stroke(C_POL[0], C_POL[1], C_POL[2], 85);
        p.strokeWeight(OpticsScene.L(view, 1.2, 1));
        for (let i = -3; i <= 3; i++) {
            const off = i * R * 0.23;
            const half = Math.sqrt(Math.max(0, R * R - off * off)) * 0.94;
            const base = { x: pp.x * off, y: pp.y * off, z };
            const A = project3({ x: base.x - d.x * half, y: base.y - d.y * half, z }, cam);
            const B = project3({ x: base.x + d.x * half, y: base.y + d.y * half, z }, cam);
            p.line(view.toScreenX(A.x), view.toScreenY(A.y),
                   view.toScreenX(B.x), view.toScreenY(B.y));
        }
        p.pop();

        // 0° 參考方向（豎直虛線）
        dashed3(p, view, cam,
            { x: 0, y: -R * 0.92, z }, { x: 0, y: R * 0.92, z },
            C_REF, { w: 1.1, dash: [6, 7] });

        // P₂ 上把 θ₁ 的方向畫成虛線，才能看出「入射」和「通過」的夾角。
        if (opts.ghostAngle != null) {
            const dg = dir3(opts.ghostAngle);
            dashed3(p, view, cam,
                { x: -dg.x * R * 0.92, y: -dg.y * R * 0.92, z },
                { x: dg.x * R * 0.92, y: dg.y * R * 0.92, z },
                C_REF, { w: 1.1, dash: [5, 6] });
        }

        // 透光軸：藍色雙箭頭
        doubleArrow3(p, view, cam, c, d, R, C_POL, 4.2, 8);

        // 從 0° 量到 θ 的弧
        if (Math.abs(angle) > 1.5) {
            polyline3(p, view, cam, arcPts3(z, 42, 0, angle, 30),
                C_POL, 2.2, 1.2);
        }

        // 兩片透光軸的夾角 Δθ（畫在第二片上）
        if (opts.delta != null && opts.delta > 1.5) {
            polyline3(p, view, cam,
                arcPts3(z, 66, opts.theta1, opts.theta2, 36),
                C_ANGLE, 2.4, 1.4);
        }

        // 分解三角形：入射（θ₁ 虛線）→ 通過（紫箭頭）＋ 被擋掉（灰虛線）
        if (opts.projection) {
            const tri = opts.projection;
            const outTip = { x: tri.outgoing.x, y: tri.outgoing.y, z };
            const inTip = { x: tri.incoming.x, y: tri.incoming.y, z };
            if (tri.conLen > 1) {
                dashed3(p, view, cam, outTip, inTip, C_REF,
                    { w: 1.4, dash: [4, 5] });
            }
            if (tri.outAmp > 1) {
                line3(p, view, cam, c, outTip, C_ANGLE,
                    { w: 3.8, arrowEnd: true, head: 7 });
            }
        }
    }

    function drawLabels3(p, view, cam, state) {
        const OS = OpticsScene;
        const src = project3({ x: 0, y: 62, z: V3.Z_SRC }, cam);
        OS.worldBadge(p, view, src.x, src.y, '自然光：各方向',
            { size: 13, col: C_SRC });

        const b1 = project3({ x: 0, y: V3.R + 30, z: V3.Z_P1 }, cam);
        OS.worldBadge(p, view, b1.x - 24, b1.y,
            `P₁　θ₁ = ${state.theta1.toFixed(0)}°`,
            { size: 13, col: C_POL });

        if (state.count >= 2) {
            const b2 = project3({ x: 0, y: V3.R + 30, z: V3.Z_P2 }, cam);
            OS.worldBadge(p, view, b2.x + 24, b2.y,
                `P₂　θ₂ = ${state.theta2.toFixed(0)}°`,
                { size: 13, col: C_POL });
        }

        const scr = project3({ x: 0, y: -V3.screenHH - 30, z: V3.Z_DET }, cam);
        OS.worldBadge(p, view, scr.x, scr.y, '屏幕',
            { size: 13, col: [51, 65, 85] });
    }

    function drawLegend3(p, view, state) {
        const rows = legendRows3(state);
        const gap = OpticsScene.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OpticsScene.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                rows[i].text, { size: 12, col: rows[i].col, align: 'left' });
        }
    }

    function drawViewToggle(p, view) {
        const text = viewMode === '2d' ? '切換立體檢視' : '切換平面檢視';
        OpticsScene.worldBadge(p, view, TOGGLE3.x, TOGGLE3.y, text,
            { size: 12, col: C_POL, align: 'left' });
    }

    function drawScene3(p, view, t, state) {
        const cam = cam3;

        drawAxis3(p, view, cam);

        // 光束：自然光（橙）→ P₁ 後（藍）→ P₂ 後（亮度跟著光強）
        drawBeam3(p, view, cam, -8, V3.Z_P1, C_SRC, 52, 7);
        if (state.count >= 2) {
            drawBeam3(p, view, cam, V3.Z_P1, V3.Z_P2, C_POL, 30, 5);
            drawBeam3(p, view, cam, V3.Z_P2, V3.Z_DET, C_POL,
                Math.round(1.0 * clamp(state.last, 0, 100)), 6);
        } else {
            drawBeam3(p, view, cam, V3.Z_P1, V3.Z_DET, C_POL,
                Math.round(1.0 * clamp(state.last, 0, 100)), 6);
        }

        drawScreen3(p, view, cam, state);

        const stages = wave3Stages(state);
        if (state.count >= 2) {
            drawWave3(p, view, cam, stages[2], t,
                { samples: 2, arrowW: 1.2, head: 3.5 });
            drawPolarizer3(p, view, cam, V3.Z_P2, state.theta2, {
                ghostAngle: state.theta1,
                delta: state.delta12,
                theta1: state.theta1,
                theta2: state.theta2,
                projection: projectionTri3(state.theta1, state.theta2, V3.amp),
            });
        }
        drawWave3(p, view, cam, stages[1], t);
        drawPolarizer3(p, view, cam, V3.Z_P1, state.theta1, {});
        drawNatural3(p, view, cam);
        drawSource3(p, view, cam);

        drawLabels3(p, view, cam, state);
        drawLegend3(p, view, state);
    }

    /** 滑鼠／觸控：右上角切換，或在 3D 畫布上拖曳旋轉。 */
    function updatePointer3(p, view) {
        const mx = num(p.mouseX, -1);
        const my = num(p.mouseY, -1);
        const inCanvas = mx >= 0 && mx <= p.width && my >= 0 && my <= p.height;
        let overToggle = false;
        if (inCanvas && view && view.scale) {
            const wx = (mx - (view.offsetX || 0)) / view.scale;
            const wy = (my - (view.offsetY || 0)) / view.scale;
            overToggle = viewToggleHit(wx, wy);
        }

        const down = !!p.mouseIsPressed;
        if (down && !ptr3.wasDown) {
            if (overToggle) {
                viewMode = nextViewMode(viewMode);
                ptr3.active = false;
            } else if (inCanvas && viewMode === '3d') {
                ptr3.active = true;
                ptr3.lastX = mx;
                ptr3.lastY = my;
            } else {
                ptr3.active = false;
            }
        }
        if (!down) ptr3.active = false;

        if (ptr3.active && down) {
            const dx = mx - ptr3.lastX;
            const dy = my - ptr3.lastY;
            if (dx || dy) cam3 = dragCam3(cam3, dx, dy);
            ptr3.lastX = mx;
            ptr3.lastY = my;
        }
        ptr3.wasDown = down;

        p.cursor(overToggle ? 'pointer'
            : (viewMode === '3d' ? (ptr3.active ? 'grabbing' : 'grab') : 'default'));
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isDouble = p => p.mode === 'double';

    OpticsScene.run({
        formula: 'I_1=\\frac{I_0}{2}',
        formulaFallback: 'I₁ = I₀/2',

        controls: {
            selects: [{
                key: 'mode', label: '偏振片數目', def: 'single',
                options: [
                    { v: 'single', t: '一片（自然光 → 偏振光）' },
                    { v: 'double', t: '兩片（第二片是檢偏片）' },
                ],
            }],
            sliders: [
                { key: 'theta1', label: '第一片方向 θ₁', def: 0, min: 0, max: 180,
                  step: 1, unit: '°', dec: 0 },
                { key: 'theta2', label: '第二片方向 θ₂', def: 45, min: 0, max: 180,
                  step: 1, unit: '°', dec: 0, when: isDouble },
            ],
        },

        cards: [
            CARD('光源', 'cardSource', '', false, null),
            CARD('第一片後的光', 'cardAfter1', '', false, null),
            CARD('第一片方向 θ₁', 'cardTheta1', '°', false, null),
            CARD('第二片方向 θ₂', 'cardTheta2', '°', false, isDouble),
            CARD('兩片夾角 Δθ', 'cardDelta', '°', true, isDouble),
            CARD('屏幕', 'cardScreen', '', true, null),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            return {
                cardSource: '自然光',
                cardAfter1: '線偏振光',
                cardTheta1: g.theta1.toFixed(0),
                cardTheta2: g.theta2.toFixed(0),
                cardDelta: g.abs12.toFixed(0),
                cardScreen: g.screen,
            };
        },

        titleText(t, panel, g) {
            if (g.mode === 'double') {
                return `θ₁ = ${g.theta1.toFixed(0)}°　θ₂ = ${g.theta2.toFixed(0)}°`
                     + `　Δθ = ${g.abs12.toFixed(0)}°　屏幕：${g.screen}`;
            }
            return `θ₁ = ${g.theta1.toFixed(0)}°`
                 + `　第一片後：線偏振光　（屏幕一樣亮）`;
        },

        onFrame(t, panel) {
            if (panel.mode === 'single') {
                // 轉第一片：光強不變，但偏振方向跟著轉。
                panel.set('theta1', clamp(90 + 90 * Math.sin(t * 0.55), 0, 180));
            } else {
                // 轉第二片：兩片從平行轉到垂直（再回到平行）。
                panel.set('theta2', clamp(90 + 90 * Math.sin(t * 0.85), 0, 180));
            }
        },

        onReset(reason) {
            // 只有 RESET 才把鏡頭拉回預設；換模式、拉滑桿時保留視角。
            if (reason === 'reset') {
                cam3 = { yaw: CAM3_DEF.yaw, pitch: CAM3_DEF.pitch };
            }
        },

        draw(p, view, t, panel, sol, state) {
            updatePointer3(p, view);
            if (viewMode === '2d') drawScene(p, view, t, panel, state || sol);
            else drawScene3(p, view, t, state || sol);
            drawViewToggle(p, view);
        },
    });

    // ======================================================================
    // 給驗證器的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            AXIS_Y, R, P_X, SRC_X, DET_X, BEAM_START, LEGEND,
            WAVE, WAVE_X0, WAVE_K, NAT_ANGLES,
            C_POL, C_POL_FILL, C_REF, C_SRC, C_WAVE_SOFT, C_ANGLE,
            clamp, wrapDiff, screenWord, polarState, stateFor, legendRows,
            waveDir, wavePhase, waveStages, waveOffset, drawScene, drawWaveStrip,
            V3, CAM3_DEF, CAM3_LIM, TOGGLE3, W3_K,
            SCENE3_BOUNDS, FIT3,
            dir3, perp3, camSpace3, rawProject3, fit3, sceneBounds3, project3,
            dragCam3, viewToggleHit, nextViewMode, initialViewMode,
            getViewMode: () => viewMode,
            waveSegmentSpecs, wave3Stages, wave3Point, projectionTri3,
            legendRows3, drawScene3, drawViewToggle,
        };
    }
})();
