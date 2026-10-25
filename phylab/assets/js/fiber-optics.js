/**
 * 🧵 光纖與全反射的應用
 *
 * 兩個模式：
 *   光纖 —— 光從空氣射入內芯（n₁），折射角 θ；打到內芯與外層（n₂）的
 *           介面時，入射角 φ = 90° − θ。φ ≥ θ_C 就發生全反射，光被留在
 *           內芯裡，沿著光纖一段一段彈到另一端。
 *   稜鏡 —— 45°–45°–90° 的全反射稜鏡。光垂直射入左面，在斜面（斜邊）
 *           的入射角固定是 45°；n ≥ √2 時 45° ≥ θ_C，光轉 90° 出去。
 *
 * ==========================================================================
 * ⚠️ 兩條式子，一條都不能少
 * ==========================================================================
 * 入口（空氣 → 內芯）： n₀ sin α = n₁ sin θ，n₀ = 1
 * 介面（內芯 → 外層）： φ = 90° − θ，sin θ_C = n₂ / n₁
 *
 * 把 θ = 90° − θ_C 代進入口那一條，就得到最大入射角
 *
 *     sin α_max = n₁ cos θ_C = √(n₁² − n₂²)　（數值孔徑 NA）
 *
 * α 超過 α_max 時 φ < θ_C，光從介面漏進外層——畫面上那條紅色虛線。
 *
 * ⚠️ 光纖的「彎」不是這一頁的幾何：這一頁的內芯是直的。彎曲光纖仍然靠
 *    同一個 φ ≥ θ_C 的條件，只是彎得太急時外側的入射角會變小、開始漏光；
 *    那一段寫在 md 裡，不在畫面裡假裝算得出來。
 */

(function () {
    'use strict';

    const AXIS_Y = 400;
    const FIBER_X0 = 200;
    const FIBER_X1 = 850;
    const CORE_HALF = 55;
    const CLAD_HALF = 115;
    const CONE_R = 140;
    const LEGEND = { x: 54, y: 76, gap: 30 };

    // 45°–45°–90° 稜鏡：A 左上、B 左下（直角）、C 右下。
    const PRISM = {
        A: { x: 400, y: 250 },
        B: { x: 400, y: 550 },
        C: { x: 700, y: 550 },
        P0: { x: 400, y: 400 },   // 入射點（左面）
        H: { x: 550, y: 400 },    // 斜面反射點
        E: { x: 550, y: 550 },    // 出射點（底面）
    };

    const C_CLAD = [219, 234, 254];
    const C_CLAD_EDGE = [96, 165, 250];
    const C_CORE = [240, 253, 244];
    const C_CORE_EDGE = [34, 197, 94];
    const C_RAY = [245, 158, 11];
    const C_LEAK = [220, 38, 38];
    const C_NORMAL = [148, 163, 184];
    const C_CONE = [187, 247, 208];
    const C_GLASS = [219, 234, 254];
    const C_GLASS_EDGE = [37, 99, 235];

    const RAD = Math.PI / 180;
    const DEG = 180 / Math.PI;

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    /**
     * 光纖的整條光路。
     *
     * 參數範圍刻意讓 n₁ > n₂ 永遠成立（n₁ 1.46–1.62、n₂ 1.28–1.44），
     * 所以 θ_C、α_max 都不會出現 NaN，也不需要偷偷把 n₂ 夾到 n₁ 以下。
     */
    function fiberState(alphaDeg, n1, n2) {
        const alpha = clamp(num(alphaDeg, 15), 0, 60);
        const n1c = clamp(num(n1, 1.50), 1.46, 1.62);
        const n2c = clamp(num(n2, 1.44), 1.28, 1.44);

        const theta = Math.asin(Math.sin(alpha * RAD) / n1c);
        const phi = Math.PI / 2 - theta;
        const thetaC = Math.asin(n2c / n1c);
        const NA = Math.sqrt(Math.max(0, n1c * n1c - n2c * n2c));
        const alphaMax = Math.asin(Math.min(1, NA));
        const guided = phi >= thetaC - 1e-12;

        // 入口那一點固定是 (FIBER_X0, AXIS_Y)；光源在左上方，沿著 α 射進來。
        const source = {
            x: FIBER_X0 - CONE_R * Math.cos(alpha * RAD),
            y: AXIS_Y - CONE_R * Math.sin(alpha * RAD),
        };

        const points = [{ x: FIBER_X0, y: AXIS_Y }];
        let bounces = 0;
        let leak = null;
        let exit = null;

        const tanT = Math.tan(theta);
        if (tanT < 1e-12) {
            points.push({ x: FIBER_X1, y: AXIS_Y });
            exit = { x: FIBER_X1, y: AXIS_Y };
        } else {
            const firstDx = CORE_HALF / tanT;
            if (!guided) {
                const hx = FIBER_X0 + firstDx;
                if (hx < FIBER_X1) {
                    const hy = AXIS_Y + CORE_HALF;   // 光一開始往下走，先撞下介面
                    points.push({ x: hx, y: hy });
                    leak = leakRay(hx, hy, theta, phi, n1c, n2c);
                } else {
                    const yEnd = AXIS_Y + (FIBER_X1 - FIBER_X0) * tanT;
                    points.push({ x: FIBER_X1, y: yEnd });
                    exit = { x: FIBER_X1, y: yEnd };
                }
            } else {
                let x = FIBER_X0;
                let y = AXIS_Y;
                let dir = 1;              // +1 往下、−1 往上
                let dx = firstDx;
                for (let i = 0; i < 80; i++) {
                    const nx = x + dx;
                    if (nx >= FIBER_X1) {
                        const yEnd = y + dir * (FIBER_X1 - x) * tanT;
                        points.push({ x: FIBER_X1, y: yEnd });
                        exit = { x: FIBER_X1, y: yEnd };
                        break;
                    }
                    x = nx;
                    y = AXIS_Y + dir * CORE_HALF;
                    dir = -dir;
                    points.push({ x, y });
                    bounces++;
                    dx = 2 * CORE_HALF / tanT;
                }
            }
        }

        // 出射後在空氣裡走一小段：由可逆性，離開內芯的角度就是 α。
        let out = null;
        if (exit) {
            const L = 42;
            // 最後一段是往上還是往下？出射後在空氣裡的角度是 α，方向要跟著。
            const prev = points[points.length - 2] || exit;
            const sgn = Math.sign(exit.y - prev.y);
            out = {
                a: exit,
                b: {
                    x: exit.x + L * Math.cos(alpha * RAD),
                    y: exit.y + L * Math.sin(alpha * RAD) * sgn,
                },
            };
        }

        return {
            alpha, n1: n1c, n2: n2c,
            theta, thetaDeg: theta * DEG,
            phi, phiDeg: phi * DEG,
            thetaC, thetaCDeg: thetaC * DEG,
            NA, alphaMax, alphaMaxDeg: alphaMax * DEG,
            guided, source, points, bounces, leak, exit, out,
        };
    }

    /**
     * 介面漏光時，進入外層的折射線。
     *
     * 介面是水平的，向下的法線是 +y；入射線在內芯裡的方向角是 θ
     * （往下、往右）。它與法線的夾角是 φ = 90° − θ；折射線在同一側、
     * 離法線更遠，方向角是 90° − θ₂。
     */
    function leakRay(hx, hy, theta, phi, n1, n2) {
        const sinT2 = n1 * Math.sin(phi) / n2;
        const theta2 = Math.asin(clamp(sinT2, -1, 1));
        const ang = Math.PI / 2 - theta2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);

        // 裁在外層的矩形裡（先撞到外緣或光纖末端都算離開）。
        const tY = dy > 1e-9 ? (AXIS_Y + CLAD_HALF - hy) / dy : Infinity;
        const tX = dx > 1e-9 ? (FIBER_X1 - hx) / dx : Infinity;
        const t = Math.max(0, Math.min(tY, tX, 260));
        return {
            a: { x: hx, y: hy },
            b: { x: hx + t * dx, y: hy + t * dy },
            theta2Deg: theta2 * DEG,
        };
    }

    /** 全反射稜鏡：斜面入射角固定 45°，n ≥ √2 才有 TIR。 */
    function prismState(n) {
        const N = clamp(num(n, 1.50), 1.30, 1.60);
        const phi = Math.PI / 4;
        const thetaC = Math.asin(1 / N);          // 玻璃 → 空氣
        const tir = phi >= thetaC - 1e-12;
        const deviation = tir ? 90 : null;

        let refracted = null;
        if (!tir) {
            // 斜面外法線（指向空氣）：(1, −1)/√2；入射方向 (1, 0)。
            const nx = Math.SQRT1_2, ny = -Math.SQRT1_2;
            const cosi = nx;                       // d·n = 1·nx + 0·ny
            const sint = N * Math.sqrt(Math.max(0, 1 - cosi * cosi));
            const cost = Math.sqrt(Math.max(0, 1 - sint * sint));
            // t = (n₁/n₂)d + (cosθt − (n₁/n₂)cosθi)n，n₁/n₂ = N（n₂ = 1）
            const dx = N + (cost - N * cosi) * nx;
            const dy = (cost - N * cosi) * ny;
            const m = Math.hypot(dx, dy) || 1;
            const L = 175;
            refracted = {
                a: { x: PRISM.H.x, y: PRISM.H.y },
                b: { x: PRISM.H.x + L * dx / m, y: PRISM.H.y + L * dy / m },
                theta2Deg: Math.asin(Math.min(1, sint)) * DEG,
            };
        }

        return {
            n: N, thetaC, thetaCDeg: thetaC * DEG,
            phi, phiDeg: 45, tir, deviation,
            refracted,
            threshold: Math.SQRT2,
        };
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = panel.mode === 'prism' ? 'prism' : 'fiber';
        return {
            mode,
            fiber: fiberState(panel.alpha, panel.n1, panel.n2),
            prism: prismState(panel.nPrism),
        };
    }

    function legendRows(state) {
        if (state.mode === 'prism') {
            return [
                { text: '光垂直射入左面，斜面入射角固定 45°', col: C_RAY },
                { text: 'n ≥ √2 ≈ 1.414 時，45° ≥ θ_C', col: C_CORE_EDGE },
                { text: '全反射讓光轉 90°，不必鍍反射膜', col: C_GLASS_EDGE },
            ];
        }
        return [
            { text: '黃線：光在內芯裡靠全反射前進', col: C_RAY },
            { text: 'φ = 90° − θ；φ ≥ θ_C 才留得住', col: C_CORE_EDGE },
            { text: 'α 超過 α_max，光就從外層漏出去', col: C_CLAD_EDGE },
        ];
    }

    // ======================================================================
    // 光纖畫面
    // ======================================================================

    function drawFiberBody(p, view) {
        const x0 = view.toScreenX(FIBER_X0);
        const x1 = view.toScreenX(FIBER_X1);
        const w = x1 - x0;

        // 外層
        p.push();
        p.fill(C_CLAD[0], C_CLAD[1], C_CLAD[2], 120);
        p.stroke(C_CLAD_EDGE[0], C_CLAD_EDGE[1], C_CLAD_EDGE[2], 170);
        p.strokeWeight(OpticsScene.L(view, 1.8, 1));
        p.rect(x0, view.toScreenY(AXIS_Y - CLAD_HALF), w,
               OpticsScene.L(view, CLAD_HALF * 2));
        // 內芯
        p.fill(C_CORE[0], C_CORE[1], C_CORE[2], 235);
        p.stroke(C_CORE_EDGE[0], C_CORE_EDGE[1], C_CORE_EDGE[2], 230);
        p.strokeWeight(OpticsScene.L(view, 2.4, 1.5));
        p.rect(x0, view.toScreenY(AXIS_Y - CORE_HALF), w,
               OpticsScene.L(view, CORE_HALF * 2));
        p.pop();

        // 內芯與外層的兩個介面（全反射就發生在這裡）
        OpticsScene.line(p, view,
            { x: FIBER_X0, y: AXIS_Y - CORE_HALF },
            { x: FIBER_X1, y: AXIS_Y - CORE_HALF }, C_CORE_EDGE, { w: 2.2 });
        OpticsScene.line(p, view,
            { x: FIBER_X0, y: AXIS_Y + CORE_HALF },
            { x: FIBER_X1, y: AXIS_Y + CORE_HALF }, C_CORE_EDGE, { w: 2.2 });

        // 兩端
        OpticsScene.line(p, view,
            { x: FIBER_X0, y: AXIS_Y - CLAD_HALF },
            { x: FIBER_X0, y: AXIS_Y + CLAD_HALF }, [30, 41, 59], { w: 3 });
        OpticsScene.line(p, view,
            { x: FIBER_X1, y: AXIS_Y - CLAD_HALF },
            { x: FIBER_X1, y: AXIS_Y + CLAD_HALF }, C_CLAD_EDGE, { w: 2.2 });

        // 軸線
        OpticsScene.dashed(p, view,
            { x: FIBER_X0, y: AXIS_Y }, { x: FIBER_X1, y: AXIS_Y },
            [226, 232, 240], { w: 1.1, dash: [9, 9] });

        // 標籤刻意放在軸線上方／下方的空白處，不壓到光線。
        OpticsScene.worldBadge(p, view, 300, 310, '外層 n₂',
            { size: 12, col: C_CLAD_EDGE });
        OpticsScene.worldBadge(p, view, 300, 366, '內芯 n₁',
            { size: 12, col: C_CORE_EDGE });
        OpticsScene.worldBadge(p, view, 300, 492, '外層 n₂',
            { size: 12, col: C_CLAD_EDGE });
    }

    function drawAcceptanceCone(p, view, st) {
        const amax = st.alphaMax;
        const apexX = view.toScreenX(FIBER_X0);
        const apexY = view.toScreenY(AXIS_Y);

        p.push();
        p.noStroke();
        p.fill(C_CONE[0], C_CONE[1], C_CONE[2], 95);
        p.beginShape();
        p.vertex(apexX, apexY);
        for (let i = 0; i <= 28; i++) {
            const a = Math.PI - amax + (2 * amax) * i / 28;
            p.vertex(view.toScreenX(FIBER_X0 + CONE_R * Math.cos(a)),
                     view.toScreenY(AXIS_Y + CONE_R * Math.sin(a)));
        }
        p.endShape(p.CLOSE);
        p.pop();

        const a1 = Math.PI - amax, a2 = Math.PI + amax;
        const e1 = { x: FIBER_X0 + CONE_R * Math.cos(a1), y: AXIS_Y + CONE_R * Math.sin(a1) };
        const e2 = { x: FIBER_X0 + CONE_R * Math.cos(a2), y: AXIS_Y + CONE_R * Math.sin(a2) };
        OpticsScene.dashed(p, view, { x: FIBER_X0, y: AXIS_Y }, e1,
            C_CORE_EDGE, { w: 1.4, dash: [7, 8] });
        OpticsScene.dashed(p, view, { x: FIBER_X0, y: AXIS_Y }, e2,
            C_CORE_EDGE, { w: 1.4, dash: [7, 8] });

        const txt = st.guided
            ? `α = ${st.alpha.toFixed(0)}° ≤ α_max = ${st.alphaMaxDeg.toFixed(1)}°`
            : `α = ${st.alpha.toFixed(0)}° > α_max = ${st.alphaMaxDeg.toFixed(1)}°：漏光`;
        // 固定在圖例下方那一列：α = 60° 時光源升到 y ≈ 279，
        // 若還畫在 245 會和光源上的「雷射」徽章疊在一起。
        OpticsScene.worldBadge(p, view, 100, 210, txt, {
            size: 11, align: 'left',
            col: st.guided ? C_CORE_EDGE : C_LEAK,
        });
    }

    function drawRaySegments(p, view, pts, col, w) {
        if (pts.length < 2) return;
        p.push();
        p.noFill();
        for (let pass = 0; pass < 2; pass++) {
            p.stroke(col[0], col[1], col[2], pass === 0 ? 55 : 235);
            p.strokeWeight(pass === 0
                ? OpticsScene.L(view, w * 3.2, 2)
                : OpticsScene.L(view, w, 1.4));
            for (let i = 1; i < pts.length; i++) {
                p.line(view.toScreenX(pts[i - 1].x), view.toScreenY(pts[i - 1].y),
                       view.toScreenX(pts[i].x), view.toScreenY(pts[i].y));
            }
        }
        p.pop();
    }

    function drawFiberRay(p, view, st) {
        drawRaySegments(p, view, st.points, C_RAY, 3.2);

        // 反射點
        for (let i = 1; i < st.points.length - 1; i++) {
            OpticsScene.drawDot(p, view, st.points[i].x, st.points[i].y,
                C_RAY, 7);
        }

        // 漏光：紅色虛線進入外層
        if (st.leak) {
            OpticsScene.dashed(p, view, st.leak.a, st.leak.b,
                C_LEAK, { w: 2.8, dash: [9, 7] });
            const mx = (st.leak.a.x + st.leak.b.x) / 2;
            const my = (st.leak.a.y + st.leak.b.y) / 2;
            OpticsScene.worldBadge(p, view, mx, my + 26, '漏光',
                { size: 11, col: C_LEAK });
        }

        // 出射
        if (st.out) {
            OpticsScene.line(p, view, st.out.a, st.out.b, C_RAY,
                { w: 3.2, arrowEnd: true, head: 9 });
            OpticsScene.worldBadge(p, view, FIBER_X1 + 8,
                st.out.b.y - 28, '輸出', { size: 11, align: 'left', col: C_RAY });
        }
    }

    function drawFiberAngles(p, view, st) {
        // 入口的法線（水平）與兩個角
        OpticsScene.dashed(p, view,
            { x: FIBER_X0 - 72, y: AXIS_Y }, { x: FIBER_X0 + 72, y: AXIS_Y },
            C_NORMAL, { w: 1.3, dash: [7, 7] });

        if (st.alpha > 0.5) {
            OpticsScene.drawAngleArc(p, view, { x: FIBER_X0, y: AXIS_Y },
                Math.PI, Math.PI + st.alpha * RAD, 45, C_RAY);
        }
        if (st.theta > 0.5 * RAD) {
            OpticsScene.drawAngleArc(p, view, { x: FIBER_X0, y: AXIS_Y },
                0, st.theta, 45, C_CORE_EDGE);
        }
        // 第一個反射點：法線、φ、θ_C。
        // 只有真的撞到介面（y = ±CORE_HALF）才畫；光直接從末端出去的那一幀
        // 雖然也有第二個點，但那個點是出射點，不是反射點。
        const firstHit = st.points.length > 1
            && Math.abs(st.points[1].y - AXIS_Y) >= CORE_HALF - 1e-6;
        if (firstHit) {
            const h = st.points[1];
            OpticsScene.dashed(p, view,
                { x: h.x, y: h.y - 82 }, { x: h.x, y: h.y + 38 },
                C_NORMAL, { w: 1.3, dash: [7, 7] });

            if (st.guided) {
                // 反射線的方向是 −θ；與向上的法線夾 φ。
                OpticsScene.drawAngleArc(p, view, h,
                    -Math.PI / 2, -st.theta, 38, C_CORE_EDGE);
            }
            OpticsScene.worldBadge(p, view, h.x + 62, h.y - 38,
                `φ = ${st.phiDeg.toFixed(1)}°`,
                { size: 11, align: 'left', col: st.guided ? C_CORE_EDGE : C_LEAK });
            OpticsScene.worldBadge(p, view, h.x + 62, h.y - 68,
                `θ_C = ${st.thetaCDeg.toFixed(1)}°`,
                { size: 11, align: 'left', col: C_NORMAL });
            if (!st.guided) {
                OpticsScene.worldBadge(p, view, h.x + 62, h.y - 98,
                    'φ < θ_C：不全反射',
                    { size: 11, align: 'left', col: C_LEAK });
            }
        }
    }

    function drawSource(p, view, st) {
        const s = st.source;
        const cx = view.toScreenX(s.x);
        const cy = view.toScreenY(s.y);
        p.push();
        p.noStroke();
        for (let i = 3; i >= 1; i--) {
            p.fill(245, 158, 11, 22 * i);
            p.ellipse(cx, cy, OpticsScene.L(view, 22 + i * 12),
                      OpticsScene.L(view, 22 + i * 12));
        }
        p.fill(245, 158, 11);
        p.ellipse(cx, cy, OpticsScene.L(view, 22), OpticsScene.L(view, 22));
        p.fill(255, 248, 220);
        p.ellipse(cx, cy, OpticsScene.L(view, 9), OpticsScene.L(view, 9));
        p.pop();

        OpticsScene.line(p, view, s, { x: FIBER_X0, y: AXIS_Y }, C_RAY,
            { w: 3, arrowAt: 0.9, head: 9 });
        OpticsScene.worldBadge(p, view, s.x, s.y - 30, '雷射',
            { size: 11, col: C_RAY });
    }

    function drawFiberScene(p, view, st) {
        drawAcceptanceCone(p, view, st);
        drawFiberBody(p, view);
        drawFiberRay(p, view, st);
        drawFiberAngles(p, view, st);
        drawSource(p, view, st);
    }

    // ======================================================================
    // 稜鏡畫面
    // ======================================================================

    function drawPrismScene(p, view, st) {
        const A = PRISM.A, B = PRISM.B, C = PRISM.C, H = PRISM.H, E = PRISM.E;
        const gx = x => view.toScreenX(x), gy = y => view.toScreenY(y);

        // 玻璃本體
        p.push();
        p.fill(C_GLASS[0], C_GLASS[1], C_GLASS[2], 155);
        p.stroke(C_GLASS_EDGE[0], C_GLASS_EDGE[1], C_GLASS_EDGE[2], 220);
        p.strokeWeight(OpticsScene.L(view, 2.6, 1.5));
        p.triangle(gx(A.x), gy(A.y), gx(B.x), gy(B.y), gx(C.x), gy(C.y));
        p.pop();
        OpticsScene.drawRightAngle(p, view, B.x, B.y, -1, -1, 16, C_NORMAL);

        // 入射線（空氣 → 玻璃，垂直入射）
        OpticsScene.line(p, view, { x: 140, y: 400 }, PRISM.P0, C_RAY,
            { w: 3.2, arrowAt: 0.9, head: 9 });
        OpticsScene.drawRightAngle(p, view, PRISM.P0.x, PRISM.P0.y, 1, 1, 14, C_NORMAL);
        OpticsScene.worldBadge(p, view, 250, 372, '入射光',
            { size: 11, align: 'left', col: C_RAY });

        // 玻璃內：入射到斜面
        OpticsScene.line(p, view, PRISM.P0, H, C_RAY, { w: 3.2 });

        // 斜面法線（指向空氣的方向是右上）
        const nrm = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
        OpticsScene.dashed(p, view,
            { x: H.x - 70 * nrm.x, y: H.y - 70 * nrm.y },
            { x: H.x + 70 * nrm.x, y: H.y + 70 * nrm.y },
            C_NORMAL, { w: 1.3, dash: [7, 7] });

        // 斜面上的入射角：法線（指回玻璃）135°，入射線反向 180°
        OpticsScene.drawAngleArc(p, view, H,
            Math.PI * 3 / 4, Math.PI, 45, C_GLASS_EDGE);
        OpticsScene.worldBadge(p, view, H.x - 72, H.y + 30, '45°',
            { size: 11, col: C_GLASS_EDGE });

        if (st.tir) {
            OpticsScene.line(p, view, H, E, C_RAY, { w: 3.2 });
            OpticsScene.line(p, view, E, { x: E.x, y: 690 }, C_RAY,
                { w: 3.2, arrowEnd: true, head: 9 });
            OpticsScene.drawRightAngle(p, view, E.x, E.y, -1, 1, 14, C_NORMAL);
            OpticsScene.worldBadge(p, view, 575, 648, '轉 90°',
                { size: 12, align: 'left', col: C_RAY });
            OpticsScene.worldBadge(p, view, 120, 612,
                `φ = 45° ≥ θ_C = ${st.thetaCDeg.toFixed(1)}°：全反射`,
                { size: 11, align: 'left', col: C_CORE_EDGE });
        } else {
            // 部分反射（弱）＋ 斜面折射出去（強）
            OpticsScene.dashed(p, view, H, E, [148, 163, 184],
                { w: 1.6, dash: [7, 7] });
            if (st.refracted) {
                OpticsScene.dashed(p, view, st.refracted.a, st.refracted.b,
                    C_LEAK, { w: 2.8, dash: [9, 7] });
                const mx = (st.refracted.a.x + st.refracted.b.x) / 2;
                const my = (st.refracted.a.y + st.refracted.b.y) / 2;
                OpticsScene.worldBadge(p, view, mx + 10, my - 24,
                    '折射光（漏光）', { size: 11, align: 'left', col: C_LEAK });
            }
            OpticsScene.worldBadge(p, view, 120, 612,
                `φ = 45° < θ_C = ${st.thetaCDeg.toFixed(1)}°：不全反射`,
                { size: 11, align: 'left', col: C_LEAK });
            OpticsScene.worldBadge(p, view, 575, 648, '沒有出射光',
                { size: 12, align: 'left', col: C_LEAK });
        }

        OpticsScene.worldBadge(p, view, 430, 505, `n = ${st.n.toFixed(2)}`,
            { size: 11, align: 'left', col: C_GLASS_EDGE });
    }

    function drawScene(p, view, t, panel, state) {
        if (state.mode === 'prism') {
            drawPrismScene(p, view, state.prism);
        } else {
            drawFiberScene(p, view, state.fiber);
        }
        const rows = legendRows(state);
        const gap = OpticsScene.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OpticsScene.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                rows[i].text, { size: 12, col: rows[i].col, align: 'left' });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isFiber = p => p.mode !== 'prism';
    const isPrism = p => p.mode === 'prism';

    OpticsScene.run({
        formula: '\\begin{aligned}n_0\\sin\\alpha&=n_1\\sin\\theta\\\\\\sin\\theta_C&=\\frac{n_2}{n_1}\\end{aligned}',
        formulaFallback: 'n₀ sin α = n₁ sin θ；sin θ_C = n₂/n₁',

        controls: {
            selects: [{
                key: 'mode', label: '模式', def: 'fiber', live: true,
                options: [
                    { v: 'fiber', t: '光纖（內芯與外層）' },
                    { v: 'prism', t: '全反射稜鏡' },
                ],
            }],
            sliders: [
                { key: 'alpha', label: '入射角 α', def: 15, min: 0, max: 60,
                  step: 1, unit: '°', dec: 0, when: isFiber },
                { key: 'n1', label: '內芯折射率 n₁', def: 1.50, min: 1.46, max: 1.62,
                  step: 0.01, unit: '', dec: 2, when: isFiber },
                { key: 'n2', label: '外層折射率 n₂', def: 1.44, min: 1.28, max: 1.44,
                  step: 0.01, unit: '', dec: 2, when: isFiber },
                { key: 'nPrism', label: '稜鏡折射率 n', def: 1.50, min: 1.30, max: 1.60,
                  step: 0.01, unit: '', dec: 2, when: isPrism },
            ],
        },

        cards: [
            CARD('內芯折射率 n₁', 'cardN1', '', false, isFiber),
            CARD('外層折射率 n₂', 'cardN2', '', false, isFiber),
            CARD('入射角 α', 'cardAlpha', '°', false, isFiber),
            CARD('內芯內折射角 θ', 'cardTheta', '°', false, isFiber),
            CARD('介面入射角 φ', 'cardPhi', '°', false, isFiber),
            CARD('臨界角 θ_C', 'cardThetaC', '°', false, isFiber),
            CARD('最大入射角 α_max', 'cardAlphaMax', '°', true, isFiber),
            CARD('是否全反射', 'cardGuided', '', true, isFiber),
            CARD('反射次數', 'cardBounces', '次', false, isFiber),

            CARD('稜鏡折射率 n', 'cardPrismN', '', false, isPrism),
            CARD('臨界角 θ_C', 'cardPrismThetaC', '°', false, isPrism),
            CARD('斜面入射角 φ', 'cardPrismPhi', '°', false, isPrism),
            CARD('是否全反射', 'cardPrismTir', '', true, isPrism),
            CARD('偏向角', 'cardDeviation', '°', true, isPrism),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, sol, state) {
            const st = state || sol;
            const f = st.fiber, pr = st.prism;
            return {
                cardN1: f.n1.toFixed(2),
                cardN2: f.n2.toFixed(2),
                cardAlpha: f.alpha.toFixed(0),
                cardTheta: f.thetaDeg.toFixed(1),
                cardPhi: f.phiDeg.toFixed(1),
                cardThetaC: f.thetaCDeg.toFixed(1),
                cardAlphaMax: f.alphaMaxDeg.toFixed(1),
                cardGuided: f.guided ? '是' : '否',
                cardBounces: String(f.bounces),
                cardPrismN: pr.n.toFixed(2),
                cardPrismThetaC: pr.thetaCDeg.toFixed(1),
                cardPrismPhi: '45.0',
                cardPrismTir: pr.tir ? '是' : '否',
                cardDeviation: pr.tir ? '90' : '—',
            };
        },

        titleText(t, panel, sol, state) {
            const st = state || sol;
            if (st.mode === 'prism') {
                const pr = st.prism;
                return `n = ${pr.n.toFixed(2)}　φ = 45°`
                     + `　θ_C = ${pr.thetaCDeg.toFixed(1)}°`
                     + (pr.tir ? '　全反射，偏向 90°' : '　不全反射，光從斜面漏出');
            }
            const f = st.fiber;
            return `α = ${f.alpha.toFixed(0)}°　θ = ${f.thetaDeg.toFixed(1)}°`
                 + `　φ = ${f.phiDeg.toFixed(1)}°　θ_C = ${f.thetaCDeg.toFixed(1)}°`
                 + (f.guided ? '　全反射' : '　漏光');
        },

        onFrame(t, panel) {
            if (panel.mode === 'prism') {
                panel.set('nPrism', clamp(1.45 + 0.15 * Math.sin(t * 0.7), 1.30, 1.60));
            } else {
                // 掃描整段滑桿 0°–60°，不是只掃一半：大角度那一半正是
                // 「α > α_max、光漏進外層」的教學重點。
                panel.set('alpha', clamp(30 + 30 * Math.sin(t * 0.6), 0, 60));
            }
        },

        draw(p, view, t, panel, sol, state) {
            drawScene(p, view, t, panel, state || sol);
        },
    });

    // ======================================================================
    // 給驗證器的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            AXIS_Y, FIBER_X0, FIBER_X1, CORE_HALF, CLAD_HALF, CONE_R,
            PRISM, LEGEND,
            C_CLAD, C_CLAD_EDGE, C_CORE, C_CORE_EDGE, C_RAY, C_LEAK,
            C_NORMAL, C_CONE, C_GLASS, C_GLASS_EDGE,
            RAD, DEG, clamp, fiberState, leakRay, prismState, stateFor,
            legendRows, drawScene,
        };
    }
})();
