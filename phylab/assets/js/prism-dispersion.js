/**
 * 🔺 稜鏡折射、最小偏向角與色散
 *
 * 一束光從左邊射進一個頂角 A = 60° 的三角形稜鏡，在左面折射、在右面
 * 再折射一次，最後離開稜鏡。入射線與出射線的夾角就是偏向角 d。
 *
 * ==========================================================================
 * ⚠️ 公式與符號沿用教材
 * ==========================================================================
 * 頂角 A、入射角 θ₁、出射角 θ₄、偏向角 d：
 *
 *     d = θ₁ + θ₄ − A
 *
 * 當 θ₁ = θ₄ 時偏向角最小，記作 d_min，此時稜鏡內的光線平行於底邊：
 *
 *     n = sin((A + d_min)/2) / sin(A/2)
 *     θ₁,min = sin⁻¹(n sin(A/2))
 *     d_min = 2θ₁,min − A
 *
 * 色散：同一種介質對不同顏色的折射率不同。紫光的 n 最大、偏向最大；
 * 紅光的 n 最小、偏向最小。
 *
 * ==========================================================================
 * ⚠️ 畫面上的光線是真的用斯涅爾定律逐面算出來的
 * ==========================================================================
 * 左面：θ₂ = sin⁻¹(sinθ₁ / n)，折射線與法線的夾角是 θ₂。
 * 右面：θ₃ 是內部光線與右面法線的夾角，θ₄ = sin⁻¹(n sinθ₃)。
 * 出射點是內部光線與右面的真正交點，不是把光線畫到某個固定高度。
 *
 * 角度範圍（A = 60°、θ₁ 40°–80°、n 1.30–1.60）掃過，右面都不會發生
 * 全反射，所以「出射線」在整個定義域裡都存在。這一點由驗證器掃描守住。
 * 下限 40° 不是排版偏好：θ₁ 再小，n = 1.60 時右面的 n sinθ₃ 會超過 1，
 * 折射線消失。上限 80° 則是畫面還放得下入射線與出射線的範圍。
 */

(function () {
    'use strict';

    const A_DEG = 60;
    const APEX = { x: 400, y: 220 };
    const SIDE = 420;
    const HALF_BASE = SIDE * Math.sin(A_DEG * Math.PI / 360); // 210
    const HEIGHT = SIDE * Math.cos(A_DEG * Math.PI / 360);    // 363.7
    const BL = { x: APEX.x - HALF_BASE, y: APEX.y + HEIGHT };
    const BR = { x: APEX.x + HALF_BASE, y: APEX.y + HEIGHT };

    const ENTRY_S = 0.5;           // 入射點在左面的位置（0 = 頂點、1 = 底角）
    const IN_LEN = 280;
    const OUT_LEN = 300;
    const REF_LEN = 150;

    const SCENE_RECT = { x0: 8, y0: 8, x1: 892, y1: 806 };
    const LEGEND = { x: 54, y: 76, gap: 30 };

    const C_PRISM = [30, 41, 59];
    const C_PRISM_FILL = [219, 234, 254];
    const C_DEV = [234, 88, 12];

    const SPECTRUM = [
        { name: '紅', n: 1.48, col: [220, 38, 38] },
        { name: '橙', n: 1.49, col: [249, 115, 22] },
        { name: '黃', n: 1.50, col: [202, 138, 4] },
        { name: '綠', n: 1.51, col: [22, 163, 74] },
        { name: '藍', n: 1.52, col: [37, 99, 235] },
        { name: '靛', n: 1.53, col: [79, 70, 229] },
        { name: '紫', n: 1.54, col: [147, 51, 234] },
    ];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    function unit(v) {
        const l = Math.hypot(v.x, v.y);
        return { x: v.x / l, y: v.y / l };
    }

    /** 把向量旋轉 ang（弧度；畫面 y 向下，所以正角看起來是順時針）。 */
    function rot(v, ang) {
        const c = Math.cos(ang), s = Math.sin(ang);
        return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
    }

    function dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    function cross(a, b) {
        return a.x * b.y - a.y * b.x;
    }

    function angleOf(v) {
        return Math.atan2(v.y, v.x);
    }

    /**
     * 兩個方向之間的「短弧」。
     * atan2 會把 210° 回報成 −150°，直接取 min/max 會畫出 310° 的大弧
     * （入射角那一圈看起來像一個完整的圓）。先把其中一個轉到另一個附近。
     */
    function arcPair(a, b) {
        const TAU = Math.PI * 2;
        while (a < 0) a += TAU;
        while (b < 0) b += TAU;
        if (b - a > Math.PI) b -= TAU;
        else if (a - b > Math.PI) a -= TAU;
        return a < b ? [a, b] : [b, a];
    }

    /** 左面的內側法線（指向稜鏡裡面）。 */
    function leftInwardNormal() {
        const e = unit({ x: BL.x - APEX.x, y: BL.y - APEX.y });
        const n = { x: -e.y, y: e.x };
        // 稜鏡中心在頂點的正下方（y 向下），用這個方向挑出內側。
        return dot(n, { x: 0, y: 1 }) > 0 ? n : { x: -n.x, y: -n.y };
    }

    /** 右面的外側法線。 */
    function rightOutwardNormal() {
        const e = unit({ x: BR.x - APEX.x, y: BR.y - APEX.y });
        const n = { x: -e.y, y: e.x };       // 其中一個法線
        return dot(n, { x: 1, y: 0 }) > 0 ? n : { x: -n.x, y: -n.y };
    }

    const N_LEFT = leftInwardNormal();
    const N_RIGHT_OUT = rightOutwardNormal();

    /** 射線 P + t·d 與線段 Q1–Q2 的交點。 */
    function intersectSegment(P, d, Q1, Q2) {
        const e = { x: Q2.x - Q1.x, y: Q2.y - Q1.y };
        const det = cross(e, d);
        if (Math.abs(det) < 1e-12) return null;
        const c = { x: Q1.x - P.x, y: Q1.y - P.y };
        const t = cross(e, c) / det;
        const u = cross(d, c) / det;
        return { t, u, point: { x: P.x + d.x * t, y: P.y + d.y * t } };
    }

    /**
     * 一束光在稜鏡裡的一次完整旅程。
     * 回傳入射線、內部線、出射線、交點、四個角、偏向角。
     */
    function prismGeometry(theta1Deg, n) {
        const theta1 = clamp(num(theta1Deg, 50), 40, 80);
        const nn = clamp(num(n, 1.50), 1.30, 1.60);
        const t1 = theta1 * Math.PI / 180;

        const entry = {
            x: APEX.x + (BL.x - APEX.x) * ENTRY_S,
            y: APEX.y + (BL.y - APEX.y) * ENTRY_S,
        };
        const dIn = rot(N_LEFT, -t1);
        const start = {
            x: entry.x - dIn.x * IN_LEN,
            y: entry.y - dIn.y * IN_LEN,
        };

        const s2 = Math.sin(t1) / nn;
        const theta2 = Math.asin(clamp(s2, -1, 1));
        const dInside = rot(N_LEFT, -theta2);

        const hit = intersectSegment(entry, dInside, APEX, BR);
        const ok = !!hit && hit.t > 0 && hit.u >= -1e-9 && hit.u <= 1 + 1e-9;
        const exit = hit ? hit.point : {
            x: APEX.x + (BR.x - APEX.x) * 0.5,
            y: APEX.y + (BR.y - APEX.y) * 0.5,
        };

        const theta3 = Math.acos(clamp(dot(dInside, N_RIGHT_OUT), -1, 1));
        const s4 = nn * Math.sin(theta3);
        const tir = s4 > 1;
        const theta4 = tir ? Math.PI / 2 : Math.asin(clamp(s4, -1, 1));
        const side = Math.sign(cross(N_RIGHT_OUT, dInside)) || 1;
        const dOut = rot(N_RIGHT_OUT, side * theta4);
        const end = {
            x: exit.x + dOut.x * OUT_LEN,
            y: exit.y + dOut.y * OUT_LEN,
        };

        const deviation = theta1 + theta4 * 180 / Math.PI - A_DEG;
        const theta1Min = Math.asin(clamp(nn * Math.sin(A_DEG * Math.PI / 360), -1, 1))
                          * 180 / Math.PI;
        const dMin = 2 * theta1Min - A_DEG;

        return {
            theta1, n: nn,
            entry, start, exit, end,
            dIn, dInside, dOut,
            theta2: theta2 * 180 / Math.PI,
            theta3: theta3 * 180 / Math.PI,
            theta4: theta4 * 180 / Math.PI,
            deviation, theta1Min, dMin,
            nearMin: Math.abs(theta1 - theta1Min) < 0.8,
            ok, tir,
        };
    }

    function spectrumGeometry(theta1Deg) {
        return SPECTRUM.map(c => Object.assign({}, c, {
            g: prismGeometry(theta1Deg, c.n),
        }));
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = panel.mode === 'dispersion' ? 'dispersion' : 'single';
        const theta1 = clamp(num(panel.theta1, 50), 40, 80);
        const n = clamp(num(panel.n, 1.50), 1.30, 1.60);
        const beam = prismGeometry(theta1, n);
        const spectrum = spectrumGeometry(theta1);
        const red = spectrum[0];
        const violet = spectrum[spectrum.length - 1];
        return {
            mode, theta1, n, beam, spectrum, red, violet,
            spread: violet.g.deviation - red.g.deviation,
            apexAngle: A_DEG,
        };
    }

    function legendRows(state) {
        const rows = [
            { text: '入射光', col: [245, 158, 11] },
            { text: '折射光', col: [30, 64, 175] },
            { text: '灰虛線：法線　橙虛線：入射方向', col: [100, 116, 139] },
        ];
        if (state.mode === 'dispersion') {
            rows.push({ text: '紫光 n 最大，偏向最大', col: [147, 51, 234] });
        } else {
            rows.push({ text: 'd：入射線與出射線的夾角', col: C_DEV });
        }
        return rows;
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawPrism(p, view) {
        p.push();
        p.stroke(C_PRISM[0], C_PRISM[1], C_PRISM[2], 220);
        p.strokeWeight(OpticsScene.L(view, 3, 2));
        p.fill(C_PRISM_FILL[0], C_PRISM_FILL[1], C_PRISM_FILL[2], 110);
        p.beginShape();
        p.vertex(view.toScreenX(APEX.x), view.toScreenY(APEX.y));
        p.vertex(view.toScreenX(BL.x), view.toScreenY(BL.y));
        p.vertex(view.toScreenX(BR.x), view.toScreenY(BR.y));
        p.endShape(p.CLOSE);
        p.pop();
    }

    /** 入射點與出射點的法線。 */
    function drawNormals(p, view, beam) {
        const OS = OpticsScene;
        const L = 78;
        OS.drawNormal(p, view,
            { x: beam.entry.x - N_LEFT.x * L, y: beam.entry.y - N_LEFT.y * L },
            { x: beam.entry.x + N_LEFT.x * L, y: beam.entry.y + N_LEFT.y * L });
        OS.drawNormal(p, view,
            { x: beam.exit.x - N_RIGHT_OUT.x * L, y: beam.exit.y - N_RIGHT_OUT.y * L },
            { x: beam.exit.x + N_RIGHT_OUT.x * L, y: beam.exit.y + N_RIGHT_OUT.y * L });
    }

    function drawAngles(p, view, beam) {
        const OS = OpticsScene;
        const e = beam.entry;
        const x = beam.exit;

        // 入射角：入射線（由頂點往回看）與外側法線的夾角
        const aIn = angleOf({ x: -beam.dIn.x, y: -beam.dIn.y });
        const aN = angleOf({ x: -N_LEFT.x, y: -N_LEFT.y });
        const pairIn = arcPair(aIn, aN);
        OS.drawAngleArc(p, view, e, pairIn[0], pairIn[1], 66, OS.C_ANGLE1);
        const midIn = (pairIn[0] + pairIn[1]) / 2;
        OS.worldBadge(p, view, e.x + 104 * Math.cos(midIn), e.y + 104 * Math.sin(midIn),
                      `θ₁ = ${beam.theta1.toFixed(1)}°`,
                      { size: 12, col: OS.C_ANGLE1, align: 'center' });

        // 出射角：出射線與外側法線的夾角
        const aOut = angleOf(beam.dOut);
        const aRn = angleOf(N_RIGHT_OUT);
        const pairOut = arcPair(aOut, aRn);
        OS.drawAngleArc(p, view, x, pairOut[0], pairOut[1], 62, OS.C_ANGLE2);
        // 標籤放在出射線的「外側」（射線下方），避開偏向角那顆。
        const perp = { x: -beam.dOut.y, y: beam.dOut.x };
        OS.worldBadge(p, view,
                      x.x + beam.dOut.x * 92 + perp.x * 30,
                      x.y + beam.dOut.y * 92 + perp.y * 30,
                      `θ₄ = ${beam.theta4.toFixed(1)}°`,
                      { size: 12, col: OS.C_ANGLE2, align: 'center' });

        // 偏向角：從出射點沿入射方向畫一條參考線，和出射線的夾角就是 d
        const ref = {
            x: x.x + beam.dIn.x * REF_LEN,
            y: x.y + beam.dIn.y * REF_LEN,
        };
        OS.dashed(p, view, x, ref, C_DEV, { w: 1.3, dash: [4, 6] });
        const aRef = angleOf(beam.dIn);
        const pairDev = arcPair(aRef, aOut);
        OS.drawAngleArc(p, view, x, pairDev[0], pairDev[1], 44, C_DEV);
        const midDev = (pairDev[0] + pairDev[1]) / 2;
        OS.worldBadge(p, view, x.x + 74 * Math.cos(midDev), x.y + 74 * Math.sin(midDev),
                      `d = ${beam.deviation.toFixed(1)}°`,
                      { size: 12, col: C_DEV, align: 'center' });
    }

    function drawBeamSingle(p, view, beam) {
        const OS = OpticsScene;
        OS.line(p, view, beam.start, beam.entry, OS.C_RAY,
                { w: 2.8, arrowAt: 0.55, head: 11 });
        OS.line(p, view, beam.entry, beam.exit, [37, 99, 235],
                { w: 2.8, arrowAt: 0.55, head: 10 });
        OS.line(p, view, beam.exit, beam.end, [37, 99, 235],
                { w: 2.8, arrowAt: 0.55, head: 11 });

        OS.drawDot(p, view, beam.entry.x, beam.entry.y, OS.C_RAY, 5);
        OS.drawDot(p, view, beam.exit.x, beam.exit.y, [37, 99, 235], 5);
    }

    function drawBeamDispersion(p, view, state) {
        const OS = OpticsScene;
        const g0 = state.spectrum[0].g;
        OS.line(p, view, g0.start, g0.entry, OS.C_RAY,
                { w: 2.8, arrowAt: 0.55, head: 11 });

        for (const row of state.spectrum) {
            const g = row.g;
            OS.line(p, view, g.entry, g.exit, row.col,
                    { w: 2.3, arrowAt: 0.5, head: 8 });
            OS.line(p, view, g.exit, g.end, row.col,
                    { w: 2.3, arrowAt: 0.55, head: 9 });
            OS.drawDot(p, view, g.exit.x, g.exit.y, row.col, 4.5);
        }
        OS.drawDot(p, view, state.beam.entry.x, state.beam.entry.y, OS.C_RAY, 5);
    }

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;
        drawPrism(p, view);

        // 頂角 A 的弧與標籤
        OS.drawAngleArc(p, view, APEX,
                        A_DEG * Math.PI / 180, Math.PI - A_DEG * Math.PI / 180,
                        46, OS.C_NORMAL, `A = ${A_DEG}°`);

        // 色散模式用中央（綠光）那條光線的出入點畫法線，不然法線會落在
        // 一條畫面上不存在的光線上。
        drawNormals(p, view,
                    state.mode === 'dispersion' ? state.spectrum[3].g : state.beam);

        if (state.mode === 'dispersion') {
            drawBeamDispersion(p, view, state);
        } else {
            drawBeamSingle(p, view, state.beam);
            drawAngles(p, view, state.beam);
        }

        // 左上角圖例
        const rows = legendRows(state);
        const gap = OS.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OS.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                          rows[i].text, { size: 12, col: rows[i].col, align: 'left' });
        }

        // 光脈衝：沿著中央那條光線走
        if (panel && panel.started) {
            const g = state.mode === 'dispersion' ? state.spectrum[3].g : state.beam;
            const pts = [g.start, g.entry, g.exit, g.end];
            let total = 0;
            const lens = [];
            for (let i = 1; i < pts.length; i++) {
                const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
                lens.push(l); total += l;
            }
            let s = (t * 260) % total;
            if (s < 0) s += total;
            let k = 0;
            while (k < lens.length - 1 && s > lens[k]) { s -= lens[k]; k++; }
            const a = pts[k], b = pts[k + 1];
            const f = lens[k] > 1e-9 ? s / lens[k] : 0;
            OS.drawPulse(p, view, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f,
                         OS.C_RAY, { r: 8 });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isSingle = p => p.mode !== 'dispersion';
    const isDispersion = p => p.mode === 'dispersion';

    OpticsScene.run({
        formula: 'n=\\frac{\\sin\\frac{A+d_{\\min}}{2}}{\\sin\\frac{A}{2}}',
        formulaFallback: 'n = sin((A + d_min)/2) / sin(A/2)',

        controls: {
            selects: [{
                key: 'mode', label: '光線', def: 'single', live: true,
                options: [
                    { v: 'single', t: '單色光（看偏向角）' },
                    { v: 'dispersion', t: '色散（七色光）' },
                ],
            }],
            sliders: [
                { key: 'theta1', label: '入射角 θ₁', def: 50, min: 40, max: 80,
                  step: 0.5, unit: '°', dec: 1 },
                { key: 'n', label: '折射率 n', def: 1.50, min: 1.30, max: 1.60,
                  step: 0.01, unit: '', dec: 2, when: isSingle },
            ],
        },

        cards: [
            CARD('入射角 θ₁', 'cardTheta1', '°', true, isSingle),
            CARD('折射率 n', 'cardN', '', true, isSingle),
            CARD('偏向角 d', 'cardDeviation', '°', true, isSingle),
            CARD('最小偏向角 d_min', 'cardDmin', '°', false, isSingle),
            CARD('θ₁,min = sin⁻¹(n sin A/2)', 'cardTheta1min', '°', false, isSingle),
            CARD('是否接近最小偏向', 'cardNearMin', '', false, isSingle),
            CARD('入射角 θ₁', 'cardTheta1d', '°', true, isDispersion),
            CARD('紅光折射率 n_red', 'cardNRed', '', false, isDispersion),
            CARD('紫光折射率 n_violet', 'cardNViolet', '', false, isDispersion),
            CARD('紅光偏向角', 'cardDevRed', '°', false, isDispersion),
            CARD('紫光偏向角', 'cardDevViolet', '°', true, isDispersion),
            CARD('角分散（紫 − 紅）', 'cardSpread', '°', true, isDispersion),
            CARD('哪一色偏向最大', 'cardColorRule', '', false, isDispersion),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            const b = g.beam;
            return {
                cardTheta1: b.theta1.toFixed(1),
                cardN: b.n.toFixed(2),
                cardDeviation: b.deviation.toFixed(2),
                cardDmin: b.dMin.toFixed(2),
                cardTheta1min: b.theta1Min.toFixed(2),
                cardNearMin: b.nearMin ? '是（內部光線平行底邊）' : '否',
                cardTheta1d: g.theta1.toFixed(1),
                cardNRed: g.red.n.toFixed(2),
                cardNViolet: g.violet.n.toFixed(2),
                cardDevRed: g.red.g.deviation.toFixed(2),
                cardDevViolet: g.violet.g.deviation.toFixed(2),
                cardSpread: g.spread.toFixed(2),
                cardColorRule: '紫光（n 最大）',
            };
        },

        titleText(t, panel, g) {
            if (g.mode === 'dispersion') {
                return `θ₁ = ${g.theta1.toFixed(1)}°　n = 1.48–1.54`
                     + `　紫光偏向 ${g.violet.g.deviation.toFixed(1)}°`
                     + `　紅光偏向 ${g.red.g.deviation.toFixed(1)}°`;
            }
            return `θ₁ = ${g.theta1.toFixed(1)}°　n = ${g.n.toFixed(2)}`
                 + `　d = ${g.beam.deviation.toFixed(2)}°`
                 + `　d_min = ${g.beam.dMin.toFixed(2)}°`;
        },

        onFrame(t, panel) {
            // 讓入射角緩慢掃過最小偏向角附近；偏向角會先減小、再變大。
            const theta = 55 + 14 * Math.sin(t * 0.7);
            panel.set('theta1', clamp(theta, 40, 80));
        },

        draw(p, view, t, panel, sol) {
            drawScene(p, view, t, panel, sol);
        },
    });

    // ======================================================================
    // 給驗證器的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            A_DEG, APEX, SIDE, HALF_BASE, HEIGHT, BL, BR,
            ENTRY_S, IN_LEN, OUT_LEN, REF_LEN, SCENE_RECT, LEGEND,
            C_PRISM, C_PRISM_FILL, C_DEV, SPECTRUM,
            N_LEFT, N_RIGHT_OUT,
            clamp, unit, rot, dot, cross, angleOf,
            intersectSegment, prismGeometry, spectrumGeometry, stateFor,
            legendRows, drawScene,
        };
    }
})();
