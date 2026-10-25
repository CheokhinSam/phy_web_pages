/**
 * 🌈 彩虹與水滴中的色散
 *
 * 一束平行的陽光照在一顆球形的水滴上。光從左側進入水滴，在內部反射
 * 一次（主虹）或兩次（副虹），再從水滴的左側折射出來。入射線與出射線
 * 的夾角叫偏向角 D；出射線與「反日方向」的夾角就是我們看到的彩虹角。
 *
 * ==========================================================================
 * ⚠️ 幾何只有一份：traceRay()
 * ==========================================================================
 * 入射點由撞擊參數 b（0 到 1，以半徑為單位）決定：
 *
 *     sin i = b
 *     sin i = n sin r
 *
 * 之後每一次在球面上的交點、反射方向、出射點與出射方向，都是從同一組
 * 向量逐次算出來的，不是把角度「畫上去」：
 *
 *     球面交點：P + s·t，s = −2(P·t)（P 在單位圓上）
 *     反射：t' = t − 2(t·n)n
 *     出射：t_out = n·t + (cos i − n·t·n)·n
 *
 * 偏向角 D 是從出射方向量出來的（p5 的角度，0 在 +x、順時針增加），
 * 不是把 180° + 2i − 4r 抄進畫面。公式只用來對照：
 *
 *     一次內反射：D = 180° + 2i − 4r
 *     兩次內反射：D = 360° + 2i − 6r
 *
 * 彩虹角 = |180° − D|。主虹在 D 最小時最亮（約 42°），副虹在 D 最小時
 * 約 51°，而且顏色的順序相反。
 *
 * ==========================================================================
 * ⚠️ 紅色與紫色是兩次獨立的追蹤
 * ==========================================================================
 * 同一條入射光（同一個 b），紅光 n = 1.331、紫光 n = 1.343。兩條路徑在
 * 水滴裡就分開，出射方向差約 1.7°（主虹）或 3°（副虹）——不是把一條
 * 光線複製成兩個顏色。卡片上的「角色差」是兩條出射線的彩虹角相減。
 *
 * ==========================================================================
 * ⚠️ 兩個撞擊參數滑桿各有各的預設值
 * ==========================================================================
 * 主虹的彩虹光線在 b/R ≈ 0.86，副虹在 b/R ≈ 0.95。用同一個滑桿的話，
 * 切到副虹時預設值會停在 0.86，彩虹角變成 57°（不是 md 說的 51°）。
 * 所以 bPrimary 與 bSecondary 是兩支獨立的滑桿，用 `when` 依模式收起來；
 * `when` 只看 mode（下拉，會經過 change()），不看滑桿值。
 */

(function () {
    'use strict';

    // ======================================================================
    // 場景
    // ======================================================================
    const CX = 430;
    const CY = 430;
    const R = 190;

    const N_RED = 1.331;
    const N_VIOLET = 1.343;
    const N_MID = 1.337;

    const IN_X0 = 70;                 // 入射光起點
    const OUT_LEN = { primary: 240, secondary: 160 };

    const LEGEND = { x: 54, y: 76, gap: 30 };

    // 右側的小圖：D 對 b/R
    const GRAPH = {
        x0: 660, y0: 140, x1: 880, y1: 420,
        px0: 695, px1: 855, py0: 205, py1: 380,
    };

    // ======================================================================
    // 顏色
    // ======================================================================
    const C_DROP_FILL = [219, 234, 254];
    const C_DROP_EDGE = [96, 165, 250];
    const C_IN = [245, 158, 11];
    const C_SUN = [253, 224, 71];
    const C_RED = [220, 38, 38];
    const C_VIOLET = [124, 58, 237];
    const C_FAINT = [148, 163, 184];
    const C_NORMAL = [100, 116, 139];
    const C_TEXT = [51, 65, 85];
    const C_AXIS = [203, 213, 225];
    const C_ANGLE_I = [37, 99, 235];
    const C_ANGLE_R = [22, 163, 74];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    // ======================================================================
    // 純物理：一條光線在水滴裡的路徑
    // ======================================================================
    /**
     * @param {number} bRatio 撞擊參數 b/R，0～1
     * @param {number} n      水滴對這個顏色的折射率
     * @param {number} m      內部反射次數（1 = 主虹、2 = 副虹）
     * @returns {object} 入口、內部反射點、出口、出射方向、偏向角、彩虹角
     */
    function traceRay(bRatio, n, m) {
        const b = clamp(num(bRatio, 0.86), 0.001, 0.999);
        const ref = clamp(num(n, 1.333), 1.2, 1.5);
        const refl = m === 2 ? 2 : 1;

        // 單位圓，圓心在原點；入射光方向 (1, 0)，從上方 b 處射入。
        const P0 = { x: -Math.sqrt(1 - b * b), y: -b };
        const nin = { x: -P0.x, y: -P0.y };       // 指向圓心的單位法線
        const cosi = -P0.x;                        // (1,0)·nin
        const i = Math.acos(clamp(cosi, -1, 1));
        const r = Math.asin(clamp(Math.sin(i) / ref, -1, 1));

        // 入口折射：t = d/n + (cos r − cos i / n)·nin
        const k = Math.cos(r) - cosi / ref;
        let t = { x: 1 / ref + k * nin.x, y: k * nin.y };
        let tl = Math.hypot(t.x, t.y) || 1;
        t = { x: t.x / tl, y: t.y / tl };

        let P = P0;
        const hits = [];
        for (let q = 0; q < refl; q++) {
            const s = -2 * (P.x * t.x + P.y * t.y);
            const Q = { x: P.x + s * t.x, y: P.y + s * t.y };
            hits.push(Q);
            const dot = t.x * Q.x + t.y * Q.y;
            t = { x: t.x - 2 * dot * Q.x, y: t.y - 2 * dot * Q.y };
            tl = Math.hypot(t.x, t.y) || 1;
            t = { x: t.x / tl, y: t.y / tl };
            P = Q;
        }

        // 出射點：最後一次反射之後，光線與球面的下一個交點
        const sExit = -2 * (P.x * t.x + P.y * t.y);
        const E = { x: P.x + sExit * t.x, y: P.y + sExit * t.y };

        // 出射折射（水滴 → 空氣）
        const dotE = t.x * E.x + t.y * E.y;
        const cosiO = Math.cos(i);
        let out = {
            x: ref * t.x + (cosiO - ref * dotE) * E.x,
            y: ref * t.y + (cosiO - ref * dotE) * E.y,
        };
        const ol = Math.hypot(out.x, out.y) || 1;
        out = { x: out.x / ol, y: out.y / ol };

        let D = Math.atan2(out.y, out.x) * 180 / Math.PI;
        if (D < 0) D += 360;

        return {
            b,
            i: i * 180 / Math.PI,
            r: r * 180 / Math.PI,
            D,
            rainbow: Math.abs(180 - D),
            P0, hits, E,
            out,
            path: [P0].concat(hits, [E]),
        };
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = panel.mode === 'secondary' ? 'secondary' : 'primary';
        const m = mode === 'secondary' ? 2 : 1;
        const key = mode === 'secondary' ? 'bSecondary' : 'bPrimary';
        const def = mode === 'secondary' ? 0.95 : 0.86;
        const b = clamp(num(panel[key], def), 0.05, 0.98);
        const red = traceRay(b, N_RED, m);
        const violet = traceRay(b, N_VIOLET, m);
        return { mode, m, b, red, violet };
    }

    function legendRows(state) {
        if (state.mode === 'secondary') {
            return [
                { text: '兩次內反射：光從水滴左側退出', col: C_TEXT },
                { text: '偏向角最小時，彩虹角約 51°', col: C_VIOLET },
                { text: '顏色順序反過來：紫光在外側', col: C_VIOLET },
            ];
        }
        return [
            { text: '白光進水滴：折射 → 一次內反射 → 折射', col: C_TEXT },
            { text: '偏向角最小時，出射光最集中：彩虹', col: C_RED },
            { text: '紅光偏折較小，所以在彩虹外側', col: C_RED },
        ];
    }

    // ======================================================================
    // 繪圖
    // ======================================================================
    const DEG = Math.PI / 180;

    function toWorld(pt) {
        return { x: CX + R * pt.x, y: CY + R * pt.y };
    }

    function pixelText(p, view, x, y, s, o) {
        o = o || {};
        p.push();
        p.noStroke();
        p.fill(o.col ? o.col[0] : C_TEXT[0],
               o.col ? o.col[1] : C_TEXT[1],
               o.col ? o.col[2] : C_TEXT[2]);
        p.textSize(OpticsScene.L(view, o.size || 10, 8));
        p.textStyle(o.bold ? p.BOLD : p.NORMAL);
        p.textAlign(o.align === 'right' ? p.RIGHT
                  : o.align === 'left' ? p.LEFT : p.CENTER, p.CENTER);
        p.text(s, view.toScreenX(x), view.toScreenY(y));
        p.pop();
    }

    function drawDrop(p, view) {
        p.push();
        p.fill(C_DROP_FILL[0], C_DROP_FILL[1], C_DROP_FILL[2], 90);
        p.stroke(C_DROP_EDGE[0], C_DROP_EDGE[1], C_DROP_EDGE[2]);
        p.strokeWeight(OpticsScene.L(view, 3, 2));
        p.ellipse(view.toScreenX(CX), view.toScreenY(CY),
                  OpticsScene.L(view, 2 * R), OpticsScene.L(view, 2 * R));
        // 左上角一小片反光，讓它看起來是球而不是圓
        p.noFill();
        p.stroke(255, 255, 255, 180);
        p.strokeWeight(OpticsScene.L(view, 2.2, 1.5));
        p.arc(view.toScreenX(CX), view.toScreenY(CY),
              OpticsScene.L(view, 2 * R - 22), OpticsScene.L(view, 2 * R - 22),
              200 * DEG, 250 * DEG);
        p.pop();
        OpticsScene.worldBadge(p, view, CX, CY - R - 30, '水滴',
                               { size: 13, col: C_DROP_EDGE });
    }

    function drawSun(p, view) {
        const sx = 70, sy = 180;
        p.push();
        p.stroke(217, 119, 6);
        p.strokeWeight(OpticsScene.L(view, 2, 1.4));
        for (let k = 0; k < 8; k++) {
            const a = k * Math.PI / 4;
            p.line(view.toScreenX(sx + 16 * Math.cos(a)),
                   view.toScreenY(sy + 16 * Math.sin(a)),
                   view.toScreenX(sx + 26 * Math.cos(a)),
                   view.toScreenY(sy + 26 * Math.sin(a)));
        }
        p.noStroke();
        p.fill(C_SUN[0], C_SUN[1], C_SUN[2]);
        p.ellipse(view.toScreenX(sx), view.toScreenY(sy),
                  OpticsScene.L(view, 24), OpticsScene.L(view, 24));
        p.pop();
        OpticsScene.worldBadge(p, view, 102, sy, '陽光',
                               { size: 12, col: [180, 83, 9], align: 'left' });
    }

    /** 主虹模式下，一批不同撞擊參數的淡灰色光線（看得出出射光集中在彩虹方向）。 */
    function drawBundle(p, view) {
        const list = [0.15, 0.30, 0.45, 0.60, 0.72, 0.86, 0.95];
        p.push();
        p.stroke(C_FAINT[0], C_FAINT[1], C_FAINT[2], 70);
        p.strokeWeight(OpticsScene.L(view, 1.1, 1));
        for (const br of list) {
            const tr = traceRay(br, N_MID, 1);
            const entry = toWorld(tr.P0);
            const exit = toWorld(tr.E);
            p.line(view.toScreenX(IN_X0), view.toScreenY(entry.y),
                   view.toScreenX(entry.x), view.toScreenY(entry.y));
            p.line(view.toScreenX(exit.x), view.toScreenY(exit.y),
                   view.toScreenX(exit.x + tr.out.x * 190),
                   view.toScreenY(exit.y + tr.out.y * 190));
        }
        p.pop();
    }

    function drawSelectedRays(p, view, state) {
        const redW = state.red.path.map(toWorld);
        const vioW = state.violet.path.map(toWorld);
        const entry = redW[0];

        // 入射的白光（紅、紫共用同一條）
        OpticsScene.line(p, view, { x: IN_X0, y: entry.y }, entry, C_IN,
                         { w: 3.2, arrowAt: 0.62, head: 11 });

        // 內部路徑
        for (let k = 1; k < redW.length; k++) {
            OpticsScene.line(p, view, redW[k - 1], redW[k], C_RED, { w: 2.8 });
        }
        for (let k = 1; k < vioW.length; k++) {
            OpticsScene.line(p, view, vioW[k - 1], vioW[k], C_VIOLET, { w: 2.2 });
        }

        // 反射點
        for (const h of state.red.hits) {
            const w = toWorld(h);
            OpticsScene.drawDot(p, view, w.x, w.y, C_RED, 5);
        }
        for (const h of state.violet.hits) {
            const w = toWorld(h);
            OpticsScene.drawDot(p, view, w.x, w.y, C_VIOLET, 3.5);
        }

        // 出射線（拉長，顏色分離才看得出來）
        const len = OUT_LEN[state.mode] || 200;
        const redE = redW[redW.length - 1];
        const vioE = vioW[vioW.length - 1];
        OpticsScene.line(p, view, redE,
                         { x: redE.x + state.red.out.x * len,
                           y: redE.y + state.red.out.y * len },
                         C_RED, { w: 3, arrowEnd: true, head: 12 });
        OpticsScene.line(p, view, vioE,
                         { x: vioE.x + state.violet.out.x * len,
                           y: vioE.y + state.violet.out.y * len },
                         C_VIOLET, { w: 2.4, arrowEnd: true, head: 11 });

        OpticsScene.drawDot(p, view, redE.x, redE.y, C_RED, 4.5);
        OpticsScene.drawDot(p, view, vioE.x, vioE.y, C_VIOLET, 3.5);
    }

    function drawEntryAngles(p, view, state) {
        const tr = state.red;
        const P = toWorld(tr.P0);
        const outward = { x: tr.P0.x, y: tr.P0.y };   // 單位外法線
        const aOut = Math.atan2(outward.y, outward.x);
        const aIn = Math.atan2(-outward.y, -outward.x);

        // 法線：圓心 → 入口 → 往外一點
        const nEnd = { x: P.x + outward.x * 62, y: P.y + outward.y * 62 };
        OpticsScene.dashed(p, view, { x: CX, y: CY }, nEnd, C_NORMAL, { w: 1.3 });

        // 入射角 i：入射方向（−x）與外法線的夾角
        OpticsScene.drawAngleArc(p, view, P, Math.PI, aOut, 45,
                                 C_ANGLE_I, 'i', { w: 1.6 });

        // 折射角 r：內法線與折射線的夾角
        const next = tr.path.length > 1 ? tr.path[1] : tr.E;
        const aRay = Math.atan2(next.y - tr.P0.y, next.x - tr.P0.x);
        OpticsScene.drawAngleArc(p, view, P, aRay, aIn, 58,
                                 C_ANGLE_R, 'r', { w: 1.6 });
    }

    function drawExitAngle(p, view, state) {
        const tr = state.red;
        const E = toWorld(tr.E);
        // 出射線的角度要先歸一化到 [0, 2π)：副虹的出射線朝左下，
        // atan2 會回傳負角，直接和 π 取 min/max 會畫出一整圈 305° 的弧。
        let aRay = Math.atan2(tr.out.y, tr.out.x);
        if (aRay < 0) aRay += Math.PI * 2;
        const a0 = Math.min(aRay, Math.PI);
        const a1 = Math.max(aRay, Math.PI);

        // 水平的參考線（指向太陽那一側）；它與出射線的夾角就是彩虹角
        OpticsScene.dashed(p, view, E, { x: E.x - 128, y: E.y },
                           C_FAINT, { w: 1.2 });
        OpticsScene.drawAngleArc(p, view, E, a0, a1, 62, C_RED, null, { w: 1.8 });

        const mid = (a0 + a1) / 2;
        const bx = E.x + 132 * Math.cos(mid);
        const by = E.y + 132 * Math.sin(mid);
        OpticsScene.worldBadge(p, view, bx, by,
            `紅 ${tr.rainbow.toFixed(1)}°`, { size: 12, col: C_RED });
    }

    /**
     * 小圖的縱軸範圍。副虹的 D 在 b → 0 時趨近 360°（D = 360° + 2i − 6r，
     * i、r → 0 但 6r 追得比 2i 快，所以是從下面貼近 360），上限留 355
     * 會把曲線最上面那一段削平；360 才是這個函數的值域上界。
     */
    function graphRange(m) {
        return m === 2
            ? { yMin: 225, yMax: 360 }
            : { yMin: 130, yMax: 180 };
    }

    function drawGraph(p, view, state) {
        const m = state.m;
        const { yMin, yMax } = graphRange(m);
        const G = GRAPH;
        const mapX = br => G.px0 + br * (G.px1 - G.px0);
        const mapY = D => G.py1 - (clamp(D, yMin, yMax) - yMin)
                                 / (yMax - yMin) * (G.py1 - G.py0);

        // 底板
        p.push();
        p.fill(255, 255, 255, 244);
        p.stroke(C_AXIS[0], C_AXIS[1], C_AXIS[2]);
        p.strokeWeight(OpticsScene.L(view, 1.2, 1));
        p.rect(view.toScreenX(G.x0), view.toScreenY(G.y0),
               OpticsScene.L(view, G.x1 - G.x0),
               OpticsScene.L(view, G.y1 - G.y0),
               OpticsScene.L(view, 8, 4));
        p.pop();

        pixelText(p, view, (G.x0 + G.x1) / 2, 160, '偏向角 D 對 b/R',
                  { size: 11, bold: true });
        pixelText(p, view, G.px0 - 10, G.py0 - 16, 'D/°',
                  { size: 8, align: 'right', col: C_NORMAL });
        pixelText(p, view, G.px1 + 4, G.py1 + 30, 'b/R',
                  { size: 8, align: 'right', col: C_NORMAL });

        // 軸
        OpticsScene.line(p, view, { x: G.px0, y: G.py1 }, { x: G.px1, y: G.py1 },
                         C_AXIS, { w: 1.2 });
        OpticsScene.line(p, view, { x: G.px0, y: G.py0 }, { x: G.px0, y: G.py1 },
                         C_AXIS, { w: 1.2 });
        pixelText(p, view, G.px0, G.py1 + 14, '0', { size: 8, col: C_NORMAL });
        pixelText(p, view, G.px1, G.py1 + 14, '1', { size: 8, col: C_NORMAL });
        pixelText(p, view, G.px0 - 6, G.py1, String(yMin),
                  { size: 8, align: 'right', col: C_NORMAL });
        pixelText(p, view, G.px0 - 6, G.py0, String(yMax),
                  { size: 8, align: 'right', col: C_NORMAL });

        // 兩條曲線
        function curve(n, col) {
            p.push();
            p.noFill();
            p.stroke(col[0], col[1], col[2]);
            p.strokeWeight(OpticsScene.L(view, 2, 1.4));
            p.beginShape();
            for (let br = 0.02; br <= 0.985; br += 0.01) {
                const tr = traceRay(br, n, m);
                p.vertex(view.toScreenX(mapX(br)), view.toScreenY(mapY(tr.D)));
            }
            p.endShape();
            p.pop();
        }
        curve(N_RED, C_RED);
        curve(N_VIOLET, C_VIOLET);

        // 現在這一條 b/R 與兩顆點
        const xNow = mapX(state.b);
        OpticsScene.dashed(p, view, { x: xNow, y: G.py0 }, { x: xNow, y: G.py1 },
                           C_FAINT, { w: 1.3 });
        OpticsScene.drawDot(p, view, xNow, mapY(state.red.D), C_RED, 6);
        OpticsScene.drawDot(p, view, xNow, mapY(state.violet.D), C_VIOLET, 4);
    }

    function drawPulse(p, view, t, panel, state) {
        if (!panel || !panel.started) return;
        const pts = [toWorld(state.red.P0)]
            .concat(state.red.hits.map(toWorld), [toWorld(state.red.E)]);
        const end = pts[pts.length - 1];
        pts.push({ x: end.x + state.red.out.x * (OUT_LEN[state.mode] || 200),
                   y: end.y + state.red.out.y * (OUT_LEN[state.mode] || 200) });
        pts.unshift({ x: IN_X0, y: pts[0].y });

        let total = 0;
        const lens = [];
        for (let i = 1; i < pts.length; i++) {
            const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            lens.push(l);
            total += l;
        }
        if (!(total > 0)) return;
        let s = (t * 260) % total;
        if (s < 0) s += total;
        let k = 0;
        while (k < lens.length - 1 && s > lens[k]) { s -= lens[k]; k++; }
        const a = pts[k], b = pts[k + 1];
        const f = lens[k] > 1e-9 ? s / lens[k] : 0;
        OpticsScene.drawPulse(p, view, a.x + (b.x - a.x) * f,
                              a.y + (b.y - a.y) * f, C_RED, { r: 8 });
    }

    function drawScene(p, view, t, panel, sol) {
        const state = sol || stateFor(panel);

        // 主虹模式才畫那一批淡灰光線；副虹的出射線會和入射光交錯，
        // 留給紅、紫兩條就夠了。
        if (state.mode === 'primary') drawBundle(p, view);

        drawDrop(p, view);
        drawSun(p, view);
        drawSelectedRays(p, view, state);
        drawEntryAngles(p, view, state);
        drawExitAngle(p, view, state);
        drawGraph(p, view, state);
        drawPulse(p, view, t, panel, state);

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

    const isPrimary = p => p.mode !== 'secondary';
    const isSecondary = p => p.mode === 'secondary';

    OpticsScene.run({
        formula: '\\begin{aligned}'
               + '\\sin i&=n\\sin r\\\\'
               + 'D&=m\\cdot180^\\circ\\\\'
               + '&\\quad+2i-2(m+1)r'
               + '\\end{aligned}',
        formulaFallback: 'sin i = n sin r；D = m·180° + 2i − 2(m+1)r',

        controls: {
            selects: [{
                key: 'mode', label: '彩虹', def: 'primary',
                options: [
                    { v: 'primary', t: '主虹（一次內反射）' },
                    { v: 'secondary', t: '副虹（兩次內反射）' },
                ],
            }],
            sliders: [
                { key: 'bPrimary', label: '撞擊參數 b/R', def: 0.86,
                  min: 0.05, max: 0.98, step: 0.01, unit: '', dec: 2,
                  when: isPrimary },
                { key: 'bSecondary', label: '撞擊參數 b/R', def: 0.95,
                  min: 0.05, max: 0.98, step: 0.01, unit: '', dec: 2,
                  when: isSecondary },
            ],
        },

        cards: [
            CARD('撞擊參數 b/R', 'cardB', '', false, null),
            CARD('入射角 i', 'cardI', '°', false, null),
            CARD('折射角 r', 'cardR', '°', false, null),
            CARD('偏向角 D', 'cardD', '°', false, null),
            CARD('彩虹角（紅）', 'cardRainRed', '°', true, null),
            CARD('彩虹角（紫）', 'cardRainViolet', '°', false, null),
            CARD('角色差', 'cardDiff', '°', true, null),
            CARD('內部反射次數', 'cardReflections', '次', false, null),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            return {
                cardB: g.b.toFixed(2),
                cardI: g.red.i.toFixed(1),
                cardR: g.red.r.toFixed(1),
                cardD: g.red.D.toFixed(1),
                cardRainRed: g.red.rainbow.toFixed(1),
                cardRainViolet: g.violet.rainbow.toFixed(1),
                cardDiff: Math.abs(g.red.rainbow - g.violet.rainbow).toFixed(1),
                cardReflections: String(g.m),
            };
        },

        titleText(t, panel, g) {
            return `b/R = ${g.b.toFixed(2)}　i = ${g.red.i.toFixed(1)}°`
                 + `　r = ${g.red.r.toFixed(1)}°　D = ${g.red.D.toFixed(1)}°`
                 + `　紅 ${g.red.rainbow.toFixed(1)}°　紫 ${g.violet.rainbow.toFixed(1)}°`;
        },

        onFrame(t, panel) {
            if (panel.mode === 'secondary') {
                // 副虹的彩虹光線在 b/R ≈ 0.95：在最小值附近來回，角度幾乎不動。
                panel.set('bSecondary', clamp(0.92 + 0.06 * Math.sin(t * 0.7), 0.05, 0.98));
            } else {
                // 主虹：從 0.13 掃到 0.97，會經過 b/R ≈ 0.86 的最低點。
                panel.set('bPrimary', clamp(0.55 + 0.42 * Math.sin(t * 0.5), 0.05, 0.98));
            }
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
            CX, CY, R, N_RED, N_VIOLET, N_MID, IN_X0, OUT_LEN,
            LEGEND, GRAPH, C_DROP_FILL, C_DROP_EDGE, C_IN, C_RED, C_VIOLET,
            C_FAINT, C_NORMAL, C_ANGLE_I, C_ANGLE_R,
            graphRange, clamp, traceRay, stateFor, legendRows,
            toWorld, drawScene,
        };
    }
})();
