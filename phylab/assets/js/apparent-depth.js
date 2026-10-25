/**
 * 💧 實深與視深（多層平行介質）
 *
 * 物體在水底，光線從物體射出來，依序穿過好幾層平行的介質，最後進入
 * 觀察者所在的上方介質。眼睛沿著最後那一小段光線的**反方向**看回去，
 * 看到的是物體在這條直線上的像 P′。P′ 比物體更靠近表面，所以「看起來
 * 比較淺」。
 *
 * ==========================================================================
 * ⚠️ 公式與符號沿用教材
 * ==========================================================================
 * 單層介質、觀察者在空氣中：h′ = d / n。
 * 多層平行介質、觀察者介質 n₀：
 *
 *     h′ = n₀ ( d₁/n₁ + d₂/n₂ + d₃/n₃ + … )
 *
 * AP 是實深，AP′ 是視深；h′ 是從**最上面的介面**量下來的。
 *
 * ==========================================================================
 * ⚠️ 畫面上的光線真的每一層都遵守斯涅爾定律
 * ==========================================================================
 * 這條光線不是把 P′ 連到眼睛就算了：先從物體往上，在每一個介面用
 * n sinθ = 常數 算出下一層的角度，最後一段進入觀察者介質，才會打到眼睛。
 * 入射角 θ₀ 由「水平總位移等於眼睛與物體的水平距離」解出來（二分法），
 * 所以每一段的端點、角度與 P′ 都來自同一組數字。
 *
 * 公式的 h′ 是近軸（角度很小）的結果；畫面上的 P′ 是那一條**實際光線**
 * 的反向延長線與物體鉛直線的交點。預設參數下兩者相差不到 2%，卡片上的
 * 視深用公式，畫面與公式不會各說各話。
 *
 * ==========================================================================
 * ⚠️ 觀察者介質不會比每一層更密
 * ==========================================================================
 * n₀ 最大 1.33、每一層 nᵢ 最小 1.33，所以 h′ ≤ H：P′ 永遠在物體上方，
 * 不會跑到場景底下。反過來（觀察者在較密的介質看較疏的介質）物體看起來
 * 會更遠，那是另一個題目，這一頁不假裝它不存在——只是不讓它超出畫面。
 */

(function () {
    'use strict';

    const SURFACE_Y = 470;
    const OBJ_X = 430;
    const EYE = { x: 560, y: 140 };
    const SCALE_MAX = 18;          // 1 cm = 18 個世界單位（太深時自動縮小）
    const BOTTOM_MAX = 740;
    const PULSE_SPEED = 260;
    const SCENE_RECT = { x0: 8, y0: 8, x1: 892, y1: 806 };
    const LEGEND = { x: 676, y: 66, gap: 28 };

    const LAYER_COL = [
        [219, 234, 254],
        [254, 243, 199],
        [220, 252, 231],
    ];
    const LAYER_ALPHA = [58, 62, 58];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    function layerCountOf(panel) {
        return clamp(parseInt(panel.layers, 10) || 3, 1, 3);
    }

    function layerSpec(panel) {
        const count = layerCountOf(panel);
        const all = [
            { d: clamp(num(panel.d1, 6), 2, 6), n: clamp(num(panel.n1, 1.33), 1.33, 2) },
            { d: clamp(num(panel.d2, 4), 2, 6), n: clamp(num(panel.n2, 1.50), 1.40, 2) },
            { d: clamp(num(panel.d3, 3), 1, 5), n: clamp(num(panel.n3, 1.60), 1.40, 2) },
        ];
        return all.slice(0, count);
    }

    /**
     * 從物體往上追一條光線到眼睛。
     * θᵢ 是每一層與法線的夾角；n₀ sinθ₀ = nᵢ sinθᵢ。
     */
    function tracePath(layers, n0, scale) {
        const de = SURFACE_Y - EYE.y;
        const dx = EYE.x - OBJ_X;
        const depthWorld = layers.reduce((s, L) => s + L.d * scale, 0);

        const runAt = theta0 => {
            let run = de * Math.tan(theta0);
            for (const L of layers) {
                const s = n0 * Math.sin(theta0) / L.n;
                const th = Math.asin(clamp(s, -1, 1));
                run += L.d * scale * Math.tan(th);
            }
            return run;
        };

        let lo = 0, hi = Math.PI * 80 / 180;
        for (let i = 0; i < 90; i++) {
            const mid = (lo + hi) / 2;
            if (runAt(mid) < dx) lo = mid; else hi = mid;
        }
        const theta0 = (lo + hi) / 2;

        const path = [];
        let x = OBJ_X;
        let y = SURFACE_Y + depthWorld;
        path.push({ x, y });
        const thetas = [];
        for (let i = layers.length - 1; i >= 0; i--) {
            const L = layers[i];
            const s = n0 * Math.sin(theta0) / L.n;
            const th = Math.asin(clamp(s, -1, 1));
            thetas[i] = th;
            y -= L.d * scale;
            x += L.d * scale * Math.tan(th);
            path.push({ x, y });
        }
        const surface = { x, y: SURFACE_Y };
        path.push({ x: EYE.x, y: EYE.y });

        const hRay = (surface.x - OBJ_X) / Math.tan(theta0) / scale;
        const pPrime = { x: OBJ_X, y: SURFACE_Y + hRay * scale };

        return {
            path, surface, pPrime, theta0, thetas,
            hRay, depthWorld,
            pathLen: pathLength(path),
        };
    }

    function pathLength(path) {
        let sum = 0;
        for (let i = 1; i < path.length; i++) {
            sum += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
        }
        return sum;
    }

    /** 沿著折線走 s 個世界單位。 */
    function pointOnPath(path, s) {
        let remain = s;
        for (let i = 1; i < path.length; i++) {
            const a = path[i - 1], b = path[i];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len <= 1e-9) continue;
            if (remain <= len) {
                const t = remain / len;
                return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            }
            remain -= len;
        }
        const last = path[path.length - 1];
        return last ? { x: last.x, y: last.y } : null;
    }

    function pulsePoint(state, t) {
        if (!(state.pathLen > 0)) return null;
        let s = (t * PULSE_SPEED) % state.pathLen;
        if (s < 0) s += state.pathLen;
        return pointOnPath(state.path, s);
    }

    function stateFor(panel) {
        panel = panel || {};
        const layers = layerSpec(panel);
        const n0 = clamp(num(panel.n0, 1.00), 1.00, 1.33);
        const realDepth = layers.reduce((s, L) => s + L.d, 0);
        const scale = Math.min(SCALE_MAX, (BOTTOM_MAX - SURFACE_Y) / Math.max(realDepth, 1e-6));
        const hFormula = n0 * layers.reduce((s, L) => s + L.d / L.n, 0);
        const tr = tracePath(layers, n0, scale);

        let top = SURFACE_Y;
        const bands = layers.map((L, i) => {
            const y0 = top;
            const y1 = top + L.d * scale;
            top = y1;
            return {
                index: i, d: L.d, n: L.n,
                y0, y1, centerY: (y0 + y1) / 2,
                col: LAYER_COL[i], alpha: LAYER_ALPHA[i],
                label: `n${'₁₂₃'[i]} = ${L.n.toFixed(2)}　d${'₁₂₃'[i]} = ${L.d.toFixed(1)} cm`,
            };
        });

        return {
            layers, count: layers.length, n0,
            realDepth, scale, hFormula,
            hRay: tr.hRay,
            difference: realDepth - hFormula,
            ratio: realDepth > 1e-9 ? hFormula / realDepth : 0,
            bands,
            bottomY: SURFACE_Y + realDepth * scale,
            surface: tr.surface,
            pPrime: tr.pPrime,
            obj: { x: OBJ_X, y: SURFACE_Y + realDepth * scale },
            eye: EYE,
            theta0: tr.theta0,
            thetas: tr.thetas,
            path: tr.path,
            pathLen: tr.pathLen,
        };
    }

    /**
     * 近軸公式 h′ 在畫面上的深度（世界 y）。尺標用它當下端點；實際
     * 光線交出的 P′ 在 state.pPrime，兩者不是同一個點。
     */
    function hFormulaY(state) {
        return SURFACE_Y + state.hFormula * state.scale;
    }

    /** 標籤：物 P 與像 P′ 靠得很近時上下錯開。 */
    function pointLabels(state) {
        const overlap = Math.abs(state.obj.y - state.pPrime.y) < 24;
        return {
            obj: {
                x: OBJ_X - 16, y: state.obj.y - (overlap ? 20 : 0),
                text: 'P', align: 'right',
            },
            pPrime: {
                x: OBJ_X - 16, y: state.pPrime.y + (overlap ? 20 : 0),
                text: 'P′', align: 'right',
            },
        };
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    /** 垂直尺標：從 y1 到 y2，標籤放在右側（或左側）。 */
    function drawDimensionV(p, view, x, y1, y2, label, col, o) {
        o = o || {};
        const OS = OpticsScene;
        const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
        // 箭尖釘在 lo／hi，箭桿只畫到三角形底邊，長度才不會被箭頭加長。
        const sx = view.toScreenX(x);
        const sy1 = view.toScreenY(lo), sy2 = view.toScreenY(hi);
        const back = OS.L(view, 10) * OS.ARROW_LEN * 0.94;
        p.push();
        OS.strokeOn(p, col, OS.L(view, 1.8, 1));
        if (Math.abs(sy2 - sy1) > back * 2.04) {
            const sgn = Math.sign(sy2 - sy1) || 1;
            p.line(sx, sy1 + sgn * back, sx, sy2 - sgn * back);
        }
        p.pop();
        OS.arrowHead(p, view, sx, sy1, 0, -1, 10, col);
        OS.arrowHead(p, view, sx, sy2, 0, 1, 10, col);
        OS.line(p, view, { x: x - 7, y: lo }, { x: x + 7, y: lo }, col, { w: 1.2 });
        OS.line(p, view, { x: x - 7, y: hi }, { x: x + 7, y: hi }, col, { w: 1.2 });

        if (label) {
            const dx = o.dx == null ? 10 : o.dx;
            // 兩把尺只差 110 個世界單位，標籤又都有像素下限：放在尺的中點時，
            // 1100px 下 h′ 的標籤會壓到 H 的尺、兩張標籤也幾乎黏在一起。
            // 兩張都放到尺的 0.8 深度、都靠尺的左側，窄畫面才不會互相穿過。
            const f = o.labelAt == null ? 0.5 : o.labelAt;
            OS.worldBadge(p, view, x + dx, lo + (hi - lo) * f, label,
                          { size: 12, col, align: o.align || 'left' });
        }
    }

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;

        // 觀察者介質（上方）
        p.push();
        p.noStroke();
        p.fill(241, 245, 249, 150);
        p.rect(view.toScreenX(SCENE_RECT.x0), view.toScreenY(SCENE_RECT.y0),
               view.toScreenX(SCENE_RECT.x1) - view.toScreenX(SCENE_RECT.x0),
               view.toScreenY(SURFACE_Y) - view.toScreenY(SCENE_RECT.y0));
        p.pop();

        // 一層一層的介質
        for (const b of state.bands) {
            p.push();
            p.noStroke();
            p.fill(b.col[0], b.col[1], b.col[2], b.alpha);
            p.rect(view.toScreenX(SCENE_RECT.x0), view.toScreenY(b.y0),
                   view.toScreenX(SCENE_RECT.x1) - view.toScreenX(SCENE_RECT.x0),
                   view.toScreenY(b.y1) - view.toScreenY(b.y0));
            p.pop();
            OS.line(p, view, { x: SCENE_RECT.x0, y: b.y1 },
                    { x: SCENE_RECT.x1, y: b.y1 }, OS.C_MIRROR, { w: 2.2 });
        }

        // 最上面的介面
        OS.line(p, view, { x: SCENE_RECT.x0, y: SURFACE_Y },
                { x: SCENE_RECT.x1, y: SURFACE_Y }, OS.C_MIRROR, { w: 3 });

        // 介質標籤
        OS.worldBadge(p, view, 56, 104,
                      `觀察者介質 n₀ = ${state.n0.toFixed(2)}`,
                      { size: 12, col: OS.C_NORMAL, align: 'left' });
        for (const b of state.bands) {
            OS.worldBadge(p, view, 56, b.centerY, b.label,
                          { size: 12, col: OS.C_NORMAL, align: 'left' });
        }

        // 眼睛（先畫，光線最後收在瞳孔）
        OS.drawEye(p, view, state.eye.x, state.eye.y, { label: '眼' });

        // 物體鉛直線：P 與 P′ 的深度都從這條線量
        OS.dashed(p, view,
                  { x: OBJ_X, y: SURFACE_Y },
                  { x: OBJ_X, y: state.obj.y },
                  OS.C_DIM, { w: 1.2, dash: [5, 7] });

        // 每一個介面的法線（同一條光線在每一層都遵守 n sinθ = 常數）
        for (let i = 1; i <= state.count; i++) {
            const q = state.path[i];
            OS.dashed(p, view,
                      { x: q.x, y: q.y - 26 },
                      { x: q.x, y: q.y + 26 },
                      OS.C_NORMAL, { w: 1.0, dash: [3, 5] });
        }

        // 反向延長線：從表面往介質裡延伸，交到 P′
        OS.dashed(p, view, state.surface, state.pPrime, OS.C_IMG, { w: 1.8 });

        // 實際光路：物 → 各介面 → 眼
        for (let i = 1; i < state.path.length; i++) {
            const a = state.path[i - 1], b = state.path[i];
            OS.line(p, view, a, b, OS.C_RAY,
                    { w: 2.8, arrowAt: 0.52, head: 11 });
            if (i < state.path.length - 1) {
                OS.drawDot(p, view, b.x, b.y, OS.C_RAY, 4.5);
            }
        }

        // 物 P
        OS.drawDot(p, view, state.obj.x, state.obj.y, OS.C_OBJ, 9);
        // 像 P′（看起來的位置）
        OS.drawDot(p, view, state.pPrime.x, state.pPrime.y, OS.C_IMG, 8);

        const pl = pointLabels(state);
        OS.worldBadge(p, view, pl.obj.x, pl.obj.y, pl.obj.text,
                      { size: 13, col: OS.C_OBJ, align: pl.obj.align });
        OS.worldBadge(p, view, pl.pPrime.x, pl.pPrime.y, pl.pPrime.text,
                      { size: 13, col: OS.C_IMG, align: pl.pPrime.align });

        // 實深與視深。h′ 的尺要量的是「近軸公式」的深度，不是那條實際
        // 光線交出的 P′——兩者差約 1.7%，尺如果釘在 P′ 上，卡片上的
        // 9.05 cm 和尺的長度就對不起來。P′ 的實際深度另外用一條淡虛線
        // 標出來，兩個深度都看得到。
        drawDimensionV(p, view, 850, SURFACE_Y, state.obj.y,
                       `H = ${state.realDepth.toFixed(1)} cm`,
                       OS.C_DIM, { dx: -10, align: 'right', labelAt: 0.8 });
        drawDimensionV(p, view, 740, SURFACE_Y, hFormulaY(state),
                       `近軸 h′ = ${state.hFormula.toFixed(2)} cm`,
                       OS.C_IMG, { dx: -10, align: 'right', labelAt: 0.8 });
        OS.dashed(p, view, { x: OBJ_X, y: state.pPrime.y },
                  { x: 740, y: state.pPrime.y },
                  OS.C_IMG, { w: 1.1, dash: [4, 6] });

        // 左上角說明
        const rows = [
            { text: '實線：實際光路', col: OS.C_RAY },
            { text: '紫虛線：反向延長線', col: OS.C_IMG },
            { text: '灰虛線：法線與深度', col: OS.C_NORMAL },
        ];
        const gap = OS.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OS.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                          rows[i].text, { size: 12, col: rows[i].col, align: 'left' });
        }

        // 光脈衝
        if (panel && panel.started) {
            const q = pulsePoint(state, t);
            if (q) OS.drawPulse(p, view, q.x, q.y, OS.C_RAY, { r: 9 });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isLayer = (p, k) => layerCountOf(p) >= k;

    OpticsScene.run({
        formula: "\\begin{aligned}h'&=n_0\\Bigl(\\frac{d_1}{n_1}\\\\"
               + "&\\qquad+\\frac{d_2}{n_2}+\\cdots\\Bigr)\\end{aligned}",
        formulaFallback: "h' = n0 (d1/n1 + d2/n2 + ...)",

        controls: {
            selects: [{
                key: 'layers', label: '平行介質的層數', def: '3', live: true,
                options: [
                    { v: '1', t: '1 層' },
                    { v: '2', t: '2 層' },
                    { v: '3', t: '3 層' },
                ],
            }],
            sliders: [
                { key: 'n0', label: '觀察者介質 n₀', def: 1.00,
                  min: 1.00, max: 1.33, step: 0.01, unit: '', dec: 2 },
                { key: 'd1', label: '厚度 d₁', def: 6, min: 2, max: 6,
                  step: 0.5, unit: 'cm', dec: 1 },
                { key: 'n1', label: '折射率 n₁', def: 1.33, min: 1.33, max: 2,
                  step: 0.01, unit: '', dec: 2 },
                { key: 'd2', label: '厚度 d₂', def: 4, min: 2, max: 6,
                  step: 0.5, unit: 'cm', dec: 1, when: p => isLayer(p, 2) },
                { key: 'n2', label: '折射率 n₂', def: 1.50, min: 1.40, max: 2,
                  step: 0.01, unit: '', dec: 2, when: p => isLayer(p, 2) },
                { key: 'd3', label: '厚度 d₃', def: 3, min: 1, max: 5,
                  step: 0.5, unit: 'cm', dec: 1, when: p => isLayer(p, 3) },
                { key: 'n3', label: '折射率 n₃', def: 1.60, min: 1.40, max: 2,
                  step: 0.01, unit: '', dec: 2, when: p => isLayer(p, 3) },
            ],
        },

        cards: [
            CARD('介質層數', 'cardLayers', '', true),
            CARD('觀察者介質 n₀', 'cardN0', ''),
            CARD('實深 H', 'cardH', 'cm', true),
            CARD('視深 h′', 'cardApparent', 'cm', true),
            CARD('縮短量 H − h′', 'cardDiff', 'cm'),
            CARD('視深／實深', 'cardRatio', ''),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            return {
                cardLayers: `${g.count} 層`,
                cardN0: g.n0.toFixed(2),
                cardH: g.realDepth.toFixed(1),
                cardApparent: g.hFormula.toFixed(2),
                cardDiff: g.difference.toFixed(2),
                cardRatio: g.ratio.toFixed(2),
            };
        },

        titleText(t, panel, g) {
            return `${g.count} 層平行介質　n₀ = ${g.n0.toFixed(2)}`
                 + `　實深 H = ${g.realDepth.toFixed(1)} cm`
                 + `　視深 h′ = ${g.hFormula.toFixed(2)} cm`;
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
            SURFACE_Y, OBJ_X, EYE, SCALE_MAX, BOTTOM_MAX, PULSE_SPEED,
            SCENE_RECT, LEGEND, LAYER_COL, LAYER_ALPHA,
            clamp, layerCountOf, layerSpec, tracePath, pathLength, pointOnPath,
            pulsePoint, stateFor, hFormulaY, pointLabels, drawDimensionV,
            drawScene,
        };
    }
})();
