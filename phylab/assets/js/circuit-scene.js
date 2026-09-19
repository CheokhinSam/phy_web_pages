/**
 * ⚡ CircuitScene — 電路的符號與電流動畫
 *
 * 搭配 circuit-kit.js（純物理、沒有 DOM）使用。這一支負責畫面：把一份電路
 * 資料畫成電路圖、把 solve() 解出來的電流畫成會動的點、把量測值標上去。
 *
 * 版面骨架（控制面板、數據卡片、圖表、底部標題列、p5 生命週期）**不在這裡**，
 * 已經搬到 `lab-scene.js`——磁學要用的是同一套骨架，只是畫的東西不同。
 * 這一支現在只有「電路長什麼樣子」。
 *
 * ⚠️ 全部包在 IIFE 裡。實驗檔是在同一個 classic script 環境執行的，若這裡
 *    用 top-level `const` 洩漏出 WORLD_W，會和實驗檔裡同名的常數撞成
 *    "Identifier has already been declared"。所以對外用 `var CircuitScene`，
 *    而且實驗檔不要重複宣告這裡已經宣告過的名字。
 *
 * ⚠️ **載入順序**：`lab-scene.js` 必須排在這一支前面（下面直接解構它）。
 *    js_deps 是 classic script、沒有 defer，照列出順序同步執行。
 *
 * ==========================================================================
 * 座標系統
 * ==========================================================================
 * 邏輯世界 900×900（由 lab-scene.js 宣告）。三欄版面在 1600×950 之下，
 * 中央畫布實測是 804×803——幾乎正方形，所以世界也用正方形，letterbox
 * 趨近 0（用 1000×700 會浪費 30% 的面積，120px 的空白條）。
 *
 * 電路的節點座標直接寫在世界座標上（頁面自己宣告），元件畫在兩個節點
 * 之間。所有節點都必須落在軸對齊的位置上，需要轉彎的地方就拆成兩段
 * 導線——這樣版面才是手算得出來的，而不是求解器猜的。
 *
 * ==========================================================================
 * 電流動畫：兩個載子
 * ==========================================================================
 * 每段導線上點的**間距固定、速度 ∝ |I|**。這是物理上對的（載子密度固定，
 * 漂移速度正比於電流），視覺上也剛好是對的：串聯時每個元件上的點一樣快，
 * 並聯時電阻小的支路點跑得快。
 *
 * 預設畫的是**傳統電流**（藍，正電荷的方向，和安培計讀數、I = Q/t 一致）。
 * 打開開關可以多畫一層**電子流**（橘），同一個電路上反向流動——舊的
 * ohms-law.js 把兩者畫成同向，等於把電子畫成帶正電。方向一律由
 * CircuitKit.flowSign() 決定，畫面不自己決定正負。
 */
var CircuitScene = (function () {
    'use strict';

    const {
        WORLD_W, WORLD_H, TITLE_TOP, TITLE_H,
        C_WIRE, C_CURRENT, C_ELECTRON, C_HOT, C_LABEL, C_OPEN, C_GRID,
        strokeOn, L, fmt, badge,
    } = LabScene;

    // 元件的世界尺寸（畫在 from→to 的局部座標上，x 軸沿著導線）
    const R_BOX_W = 64, R_BOX_H = 26;     // 電阻方框
    const METER_R = 24;                   // 電錶圓
    const BULB_R = 26;                    // 燈泡圓
    const BAT_HALF = 30;                  // 電池半長
    const GAP_PAD = 8;                    // 白底遮罩比符號再大一點

    // ======================================================================
    // 幾何：路徑、沿線取點
    // ======================================================================

    /**
     * 一個元件走過的路徑。節點座標在世界座標上。
     * `bend: 'h'` 表示「先水平離開 from 再轉」，`'v'` 是先垂直。
     * 沒有 bend 就是直線（頁面要自己保證那是軸對齊的）。
     */
    function routeOf(C, part) {
        const a = C.nodes[part.from], b = C.nodes[part.to];
        if (!a || !b) return [];
        if (!part.bend) return [a, b];
        if (part.bend === 'h') return [a, { x: b.x, y: a.y }, b];
        return [a, { x: a.x, y: b.y }, b];
    }

    function routeLen(pts) {
        let L = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
            L += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        }
        return L;
    }

    /**
     * 沿著路徑走 s 之後的點，順便回傳那一點的軸向單位向量。
     * 回傳 {x, y, ax, ay}，ax/ay 是**世界座標**上的方向（未經 view 換算）。
     */
    function pointAt(pts, s) {
        let acc = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
            const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y;
            const seg = Math.hypot(dx, dy);
            const last = i === pts.length - 2;
            if (seg > 0 && (acc + seg >= s || last)) {
                const u = Math.min(1, Math.max(0, (s - acc) / seg));
                return { x: pts[i].x + dx * u, y: pts[i].y + dy * u,
                         ax: dx / seg, ay: dy / seg };
            }
            if (seg === 0 && last) return { x: pts[i].x, y: pts[i].y, ax: 1, ay: 0 };
            acc += seg;
        }
        const e = pts[pts.length - 1];
        return { x: e.x, y: e.y, ax: 1, ay: 0 };
    }

    // ======================================================================
    // 繪圖小工具
    // ======================================================================

    /** 沿著路徑畫線。⚠️ 一定要自己 noFill()——不然 beginShape 會繼承上一個填色。 */
    function drawRoute(p, view, pts, col, weight) {
        if (pts.length < 2) return;
        p.noFill();
        strokeOn(p, col, weight);
        p.beginShape();
        for (const q of pts) p.vertex(view.toScreenX(q.x), view.toScreenY(q.y));
        p.endShape();
    }

    /**
     * 進入元件的局部座標系：原點在符號中心、x 軸沿著 from→to。
     * 回呼結束後自動還原。所有長度都用 view.len() 換算，才不會在大螢幕
     * 上變成一小顆、在小螢幕上爆出去。
     */
    function localFrame(p, view, cx, cy, ax, ay, fn) {
        p.push();
        p.translate(view.toScreenX(cx), view.toScreenY(cy));
        p.rotate(Math.atan2(ay, ax));
        fn();
        p.pop();
    }

    /** 白底遮罩：蓋掉底下的導線，元件的符號才不會被線穿過。 */
    function mask(p, view, halfW, halfH) {
        p.noStroke();
        p.fill(255);
        const w = view.len(halfW * 2), h = view.len(halfH * 2);
        p.rect(-w / 2, -h / 2, w, h);
    }

    // ======================================================================
    // 元件符號
    // ======================================================================
    // 每個符號都在局部座標系裡畫（原點是中心、x 軸沿 from→to），
    // 長度一律走 view.len()。回傳值沒有用到，純粹是為了版面可讀。

    function symResistor(p, view, o) {
        const w = L(view, o && o.w ? o.w : R_BOX_W), h = L(view, o && o.h ? o.h : R_BOX_H);
        mask(p, view, (o && o.w ? o.w : R_BOX_W) / 2 + GAP_PAD, h / view.scale / 2 + GAP_PAD);
        p.fill(255);
        strokeOn(p, o && o.col ? o.col : C_WIRE, L(view, 3, 2));
        p.rect(-w / 2, -h / 2, w, h);
    }

    function symRheostat(p, view, o) {
        symResistor(p, view, o);
        const w = L(view, R_BOX_W), h = L(view, R_BOX_H);
        // 可變：從斜上方畫一支箭頭指進方框
        const ax = w * 0.30, ay = -h / 2 - L(view, 26);
        strokeOn(p, o && o.col ? o.col : C_WIRE, L(view, 2.5, 1.5));
        p.noFill();
        p.line(-ax, ay + L(view, 12), ax * 1.15, ay);
        p.line(ax * 1.15, ay, ax * 1.15, -h / 2);
        p.fill(o && o.col ? o.col[0] : C_WIRE[0],
               o && o.col ? o.col[1] : C_WIRE[1],
               o && o.col ? o.col[2] : C_WIRE[2]);
        p.noStroke();
        const hd = L(view, 9, 5);
        p.triangle(ax * 1.15, -h / 2, ax * 1.15 - hd * 0.55, -h / 2 - hd,
                   ax * 1.15 + hd * 0.55, -h / 2 - hd);
    }

    /**
     * 電池。`from` 是 **+** 端——長線那一邊，和 CircuitKit 的符號約定一致。
     * 畫兩格（長短長短）讓它看起來是一顆電池而不是單一電池芯。
     */
    function symBattery(p, view, o) {
        const half = L(view, BAT_HALF);
        const longH = L(view, 52), shortH = L(view, 26);
        const thin = L(view, 3.5, 2), thick = L(view, 8, 4);
        mask(p, view, BAT_HALF + GAP_PAD, 40);
        const col = o && o.col ? o.col : C_WIRE;
        const bars = [[-0.60, longH, thin], [-0.20, shortH, thick],
                      [ 0.20, longH, thin], [ 0.60, shortH, thick]];
        strokeOn(p, col, 1);
        for (const [f, h, t] of bars) {
            const x = half * 2 * f * 0.8333;      // 分佈在 ±half 之內
            p.strokeWeight(t);
            p.line(x, -h / 2, x, h / 2);
        }
        // 極性標示：+ 在 from 那一邊
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.textSize(L(view, 20, 11));
        p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('+', -half - L(view, 16), 0);
        p.text('−',  half + L(view, 16), 0);
    }

    /** 燈泡：圓 + 叉。亮度由 o.glow（0..1）決定填色，發亮時加一圈光暈。 */
    function symBulb(p, view, o) {
        const r = L(view, BULB_R);
        const glow = o && o.glow != null ? Math.max(0, Math.min(1, o.glow)) : 0;
        mask(p, view, BULB_R + GAP_PAD, BULB_R + GAP_PAD);
        if (glow > 0.02) {
            p.noStroke();
            for (let i = 3; i >= 1; i--) {
                p.fill(251, 191, 36, 30 * glow / i);
                p.ellipse(0, 0, r * (2 + i * 0.42), r * (2 + i * 0.42));
            }
        }
        p.fill(glow > 0.02 ? [255, 251 - 60 * (1 - glow), 235 - 160 * (1 - glow)] : [255, 255, 255]);
        strokeOn(p, C_WIRE, L(view, 3, 2));
        p.ellipse(0, 0, r * 2, r * 2);
        const d = r * Math.SQRT1_2;
        p.line(-d, -d, d, d);
        p.line(-d, d, d, -d);
    }

    /** 電錶：圓 + 字母。A 串聯、V 並聯，長相刻意一樣。 */
    function symMeter(p, view, letter, o) {
        const r = L(view, METER_R);
        mask(p, view, METER_R + GAP_PAD, METER_R + GAP_PAD);
        p.fill(255);
        strokeOn(p, C_WIRE, L(view, 3, 2));
        p.ellipse(0, 0, r * 2, r * 2);
        p.noStroke();
        p.fill(C_LABEL[0], C_LABEL[1], C_LABEL[2]);
        p.textSize(L(view, 26, 13));
        p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(letter, 0, L(view, 1, 0));
    }

    /** 開關：兩個接點 + 一片刀。斷開時刀抬起來。 */
    function symSwitch(p, view, closed) {
        const w = L(view, 54), r = L(view, 5, 3);
        mask(p, view, 30 + GAP_PAD, 30);
        const col = closed ? C_WIRE : C_OPEN;
        p.fill(255);
        strokeOn(p, col, L(view, 3, 2));
        p.ellipse(-w / 2, 0, r * 2, r * 2);
        p.ellipse(w / 2, 0, r * 2, r * 2);
        const lift = closed ? 0 : -L(view, 26);
        strokeOn(p, col, L(view, 4, 2.5));
        p.line(-w / 2, 0, w / 2, lift);
        if (!closed) {
            p.noStroke();
            p.fill(C_OPEN[0], C_OPEN[1], C_OPEN[2]);
            p.textSize(L(view, 14, 9));
            p.textAlign(p.CENTER, p.BOTTOM);
            p.text('斷開', 0, -L(view, 30));
        }
    }

    /** 保險絲：方框 + 中間一條線。熔斷時線斷掉、框變色。 */
    function symFuse(p, view, blown, rating) {
        const w = L(view, 60), h = L(view, 26);
        mask(p, view, 30 + GAP_PAD, 13 + GAP_PAD);
        const col = blown ? C_HOT : C_WIRE;
        p.fill(255);
        strokeOn(p, col, L(view, 3, 2));
        p.rect(-w / 2, -h / 2, w, h);
        strokeOn(p, col, L(view, 2.5, 1.5));
        if (blown) {
            p.line(-w / 2 + L(view, 6), 0, -L(view, 8), 0);
            p.line(L(view, 8), 0, w / 2 - L(view, 6), 0);
            p.noStroke();
            p.fill(C_HOT[0], C_HOT[1], C_HOT[2]);
            p.textSize(L(view, 15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.text('熔斷', 0, -h / 2 - L(view, 7));
        } else {
            p.line(-w / 2, 0, w / 2, 0);
        }
        if (rating != null) {
            p.noStroke();
            p.fill(C_WIRE[0], C_WIRE[1], C_WIRE[2]);
            p.textSize(L(view, 13, 8));
            p.textStyle(p.NORMAL);
            p.textAlign(p.CENTER, p.TOP);
            p.text(rating + ' A', 0, h / 2 + L(view, 5));
        }
    }

    /** 二極體：三角形 + 一條橫槓。導通時填亮。 */
    function symDiode(p, view, on) {
        const s = L(view, 26);
        mask(p, view, 32 + GAP_PAD, 32);
        const col = on ? C_HOT : C_WIRE;
        p.fill(on ? [254, 226, 226] : [255, 255, 255]);
        strokeOn(p, col, L(view, 3, 2));
        p.triangle(-s, -s, -s, s, s, 0);
        p.line(s, -s, s, s);
    }

    /** 熱敏電阻：方框 + 一條帶拐角的斜線（IEC 記號）。 */
    function symThermistor(p, view, o) {
        symResistor(p, view, o);
        const w = L(view, R_BOX_W), h = L(view, R_BOX_H);
        const dx = w * 0.62, dy = h * 0.62;
        strokeOn(p, o && o.col ? o.col : C_WIRE, L(view, 2.5, 1.5));
        p.noFill();
        p.line(-dx - L(view, 8), h / 2 + dy + L(view, 8), dx, -h / 2 - dy);
        p.line(dx, -h / 2 - dy, dx + L(view, 12), -h / 2 - dy);
    }

    function symCurrentSource(p, view) {
        const r = L(view, METER_R);
        mask(p, view, METER_R + GAP_PAD, METER_R + GAP_PAD);
        p.fill(255);
        strokeOn(p, C_WIRE, L(view, 3, 2));
        p.ellipse(0, 0, r * 2, r * 2);
        strokeOn(p, C_WIRE, L(view, 2.5, 1.5));
        p.line(-r * 0.5, 0, r * 0.5, 0);
        p.fill(C_WIRE[0], C_WIRE[1], C_WIRE[2]);
        p.noStroke();
        const hd = L(view, 9, 5);
        p.triangle(r * 0.5, 0, r * 0.5 - hd, -hd * 0.55, r * 0.5 - hd, hd * 0.55);
    }

    // ======================================================================
    // 畫一整份電路
    // ======================================================================

    /**
     * @param {object} C    電路資料 { nodes:{name:{x,y}}, parts:[...] }
     * @param {object} sol  CircuitKit.solve(C) 的結果
     * @param {object} o
     *   o.t          模擬時間（驅動電流動畫）
     *   o.dots       畫不畫電流點（預設 true）
     *   o.carrier    'current' | 'electron' | 'both'
     *   o.iref       速度參考電流，|I| = iref 時每秒走 o.speed 世界單位
     *   o.speed      基礎速度
     *   o.badges     [{id, text, dx, dy, align}] 額外標註
     *   o.autometer  是否自動標示安培計／伏特計的讀數（預設 true）
     *   o.gapAt      斷路的位置：{after: partId} 或 {at: partId}
     */
    function drawCircuit(p, view, C, sol, o) {
        o = o || {};
        const ok = sol && sol.ok;

        // ---- 1. 導線（含每個元件的引線）----
        for (const part of C.parts) {
            const pts = routeOf(C, part);
            if (!pts.length) continue;
            const open = CircuitKit.isOpen(part);
            drawRoute(p, view, pts, open ? C_OPEN : C_WIRE,
                      L(view, part.kind === 'wire' ? 3.5 : 3, 2));
        }

        // ---- 2. 電流點（畫在符號底下，看起來像鑽進元件裡）----
        if (ok && o.dots !== false) {
            const carrier = o.carrier || 'current';
            const speed = o.speed == null ? 46 : o.speed;
            const iref = o.iref == null ? 1 : o.iref;
            // ⚠️ 半徑必須**小於間距的一半**，點與點之間才留得住縫隙。
            //    2026-09 第一版用間距 12、半徑 6.5（直徑 13 > 12），點連成
            //    一條藍色毛蟲，把底下的導線整條蓋掉——電路圖看不到導線，
            //    而且每個元件前後的空隙看起來像斷路。16/5 才有縫。
            // ⚠️ 兩層的橫向偏移必須**反號**（電子 +8、電流 −8）。同號會讓
            //    兩層疊在同一條線上，「電流與電子流反向」這個賣點當場消失；
            //    差一個符號肉眼也看不出來，只會覺得畫面糊掉。
            if (carrier === 'electron' || carrier === 'both') {
                drawAllDots(p, view, C, sol, o.t, 'electron', speed, iref, 10, 3.8,
                            carrier === 'both' ? 8 : 0);
            }
            if (carrier === 'current' || carrier === 'both') {
                drawAllDots(p, view, C, sol, o.t, 'current', speed, iref, 16, 5,
                            carrier === 'both' ? -8 : 0);
            }
        }

        // ---- 3. 元件符號 ----
        for (const part of C.parts) {
            const pts = routeOf(C, part);
            if (!pts.length) continue;
            const mid = pointAt(pts, routeLen(pts) / 2);
            const k = part.kind;
            const I = ok ? (sol.partI[part.id] || 0) : 0;
            const V = ok ? (sol.partV[part.id] || 0) : 0;

            localFrame(p, view, mid.x, mid.y, mid.ax, mid.ay, () => {
                switch (k) {
                    case 'wire': break;
                    case 'resistor': symResistor(p, view, part); break;
                    case 'rheostat': symRheostat(p, view, part); break;
                    case 'battery': symBattery(p, view, part); break;
                    case 'bulb':
                        // 亮度 ∝ 功率。同一顆燈泡，功率越大越亮。
                        symBulb(p, view, { glow: Math.min(1, Math.abs(V * I) / (o.bulbRef || 3)) });
                        break;
                    case 'thermistor': symThermistor(p, view, part); break;
                    case 'diode': symDiode(p, view, ok && I > 1e-4); break;
                    case 'ammeter': symMeter(p, view, 'A'); break;
                    case 'voltmeter': symMeter(p, view, 'V'); break;
                    case 'switch': symSwitch(p, view, !CircuitKit.isOpen(part)); break;
                    case 'fuse': symFuse(p, view, part.blown === true, part.rating); break;
                    case 'currentsource': symCurrentSource(p, view); break;
                    default: symResistor(p, view, part);
                }
            });
        }

        // ---- 4. 標註 ----
        if (ok) {
            for (const part of C.parts) {
                if (!o.autometer) continue;
                if (part.kind !== 'ammeter' && part.kind !== 'voltmeter') continue;
                const pts = routeOf(C, part);
                if (!pts.length) continue;
                const mid = pointAt(pts, routeLen(pts) / 2);
                const val = part.kind === 'ammeter'
                    ? Math.abs(sol.partI[part.id] || 0) : Math.abs(sol.partV[part.id] || 0);
                badge(p, view, mid.x, mid.y, fmt(val, part.kind === 'ammeter' ? 'A' : 'V'),
                      { dy: -46, size: 15 });
            }
        }
        for (const b of (o.badges || [])) {
            const part = C.parts.find(q => q.id === b.id);
            if (!part) continue;
            const pts = routeOf(C, part);
            if (!pts.length) continue;
            const mid = pointAt(pts, routeLen(pts) / 2);
            badge(p, view, mid.x + (b.dx || 0), mid.y + (b.dy || 0), b.text,
                  { size: b.size || 14, align: b.align });
        }
    }

    /** 把 |I| 換成動畫速度。短路的電流是安培級的好幾倍，要夾住。 */
    function dotSpeed(I, iref, speed) {
        const r = Math.min(4, Math.abs(I) / iref);
        return speed * r;
    }

    function drawAllDots(p, view, C, sol, t, carrier, speed, iref, spacing, radius, lateral) {
        const lat = lateral || 0;
        for (const part of C.parts) {
            if (CircuitKit.isZeroOhm(part) === false &&
                part.kind !== 'resistor' && part.kind !== 'rheostat' &&
                part.kind !== 'bulb' && part.kind !== 'thermistor' &&
                part.kind !== 'diode' && part.kind !== 'battery') continue;
            const pts = routeOf(C, part);
            const len = routeLen(pts);
            if (len < spacing) continue;

            const I = sol.partI[part.id] || 0;
            if (Math.abs(I) < 1e-9) continue;
            const sign = CircuitKit.flowSign(part, sol, carrier);
            const v = dotSpeed(I, iref, speed) * sign;

            // 相位從 0 開始，走過的距離對間距取模——負數要先加再取
            let s = ((t * v) % spacing + spacing) % spacing;
            const col = carrier === 'electron' ? C_ELECTRON : C_CURRENT;
            p.noStroke();
            p.fill(col[0], col[1], col[2]);
            const r = L(view, radius, 2);
            for (; s < len; s += spacing) {
                const q = pointAt(pts, s);
                // 沿法線偏移：兩層載子並排時才不會疊在同一條線上
                p.ellipse(view.toScreenX(q.x - q.ay * lat),
                          view.toScreenY(q.y + q.ax * lat), r * 2, r * 2);
            }
        }
    }

    /** 數值的格式：太小的值不要印成 0.00，改用科學記號。 */
    /** 節點標籤（A、B、C…），畫在節點旁邊。 */
    function drawNodeLabels(p, view, C, labels) {
        if (!labels) return;
        p.noStroke();
        p.fill(100, 116, 139);
        p.textSize(L(view, 14, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.CENTER);
        for (const [name, o] of Object.entries(labels)) {
            const n = C.nodes[name];
            if (!n) continue;
            p.text(o.t || name, view.toScreenX(n.x + (o.dx || 0)),
                   view.toScreenY(n.y + (o.dy || 0)));
        }
    }

    // ======================================================================
    // 對外介面
    // ======================================================================
    return {
        // ⚠️ 以下這些其實住在 lab-scene.js，這裡只是**轉出**——電學那七頁的
        //    呼叫端（CircuitScene.run / .badge / .drawGraph / .WORLD_W …）
        //    因此一行都不用改。新頁面請直接用 LabScene 的名字，
        //    不要再從這裡拿。
        WORLD_W, WORLD_H, TITLE_TOP, TITLE_H,
        C_WIRE, C_CURRENT, C_ELECTRON, C_HOT, C_LABEL, C_OPEN, C_GRID,
        strokeOn, L, fmt, badge,
        drawGraph: LabScene.drawGraph,
        drawTitleBar: LabScene.drawTitleBar,
        buildPanel: LabScene.buildPanel,
        run: LabScene.run,

        // 電路自己的
        routeOf, routeLen, pointAt,
        drawRoute, drawCircuit, drawNodeLabels,
    };
})();
