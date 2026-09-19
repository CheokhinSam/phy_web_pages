/**
 * 🌡️ ThermalScene — 溫度色階、棒子、分子、溫度計、熱流箭頭
 *
 * 搭配 thermal-kit.js（純物理、沒有 DOM）使用。這一支負責畫面：把一份
 * **溫度**畫成顏色、把一群分子畫成抖動的點、把熱流畫成箭頭。
 *
 * 版面骨架（控制面板、數據卡片、圖表、底部標題列、p5 生命週期）**不在這裡**，
 * 它在 `lab-scene.js`。這一支只有「熱學長什麼樣子」，和 magnetic-scene.js
 * 之於磁學、circuit-scene.js 之於電學是同一個位置。
 *
 * ==========================================================================
 * ⚠️ 為什麼這一支沒有 p5 生命週期（而且必須繼續沒有）
 * ==========================================================================
 * `patch-site.py` 會 glob `_site/phylab/assets/js/*-scene.js`，凡是自己開了
 * p5 實例的模組就要交出三個錨點字串。純繪圖模組沒有 p.draw 可以掛，所以
 * 被跳過——判定方式是在原始碼裡找「建立 p5 實例」的那一行。
 *
 * 這一支一旦自己開了 p5 實例，就會當場被要求錨點，而它本來就沒有那些
 * 字串，補丁腳本會 exit 1，整個 headless 驗證跟著掛掉。
 *
 * ⚠️ 而且**連註解都不能提到那個字串**：判斷是純文字比對，看不出那是註解。
 *    要講這件事就用中文講。verify-thermal.js 有斷言盯著這一條。
 *
 * ==========================================================================
 * ⚠️ 熱學的核心視覺語言是「顏色＝溫度」，而它是**一個函式**
 * ==========================================================================
 * 熱學不像力學有「那顆球」、電學有「那條電路」——它的主角是一個純量場。
 * 學生要能在畫面上任何一個地方讀出「這裡幾度」，靠的就是色階。所以：
 *
 *   **所有**溫度都用 `tempColor()` 上色，**頁面不得自己寫 RGB**。
 *
 * 自己寫 RGB 的症狀：色帶用的是 A 色階、溫度計用的是 B 色階、粒子用的是
 * C 色階，畫面上三個東西同時說「這是熱的」，但同一溫度在不同位置的顏色
 * 不一樣。這種錯不會有任何錯誤訊息，看起來甚至「還挺好看的」。
 */
var ThermalScene = (function () {
    'use strict';

    const {
        WORLD_W, WORLD_H, TITLE_TOP,
        strokeOn, L, fmt, badge,
    } = LabScene;

    /**
     * 場景的可畫區域。**下緣是標題列的上緣，不是 WORLD_H。**
     * （底部黑條只蓋住 TITLE_TOP～TITLE_TOP+48，再往下幾十個世界單位是
     *   看得見的，畫到那裡就會有一截東西孤零零地露在黑條底下。）
     */
    const SCENE = { x0: 8, y0: 8, x1: WORLD_W - 8, y1: TITLE_TOP - 6 };

    /**
     * 白底標籤，**吃世界座標**。
     *
     * ⚠️ `LabScene.badge()` 的第二、三個參數是**畫布像素**。熱學這一組的
     *    直覺和磁學一樣（標籤放在世界座標的某一點上），直接餵世界座標進去
     *    會讓文字愈靠邊偏愈多，最後整顆被裁掉，而**所有數值斷言照樣全過**。
     *    熱學的頁面一律用這一支；`badge` 只是為了和波動學／電學共用才轉出來。
     *    verify-thermal.js 有靜態掃描在擋「熱學頁面直接呼叫小寫 badge(」。
     */
    function worldBadge(p, view, x, y, text, o) {
        badge(p, view, view.toScreenX(x), view.toScreenY(y), text, o);
    }

    // ======================================================================
    // 溫度色階
    // ======================================================================
    /**
     * 色階的停點。低溫端是深藍，高溫端是深紅——這是所有人的共同直覺，
     * 不要為了「好看」換成別的色系（曾經考慮過紫→黃，但那樣「哪邊熱」
     * 就得看圖例才知道了）。
     *
     * 中間刻意穿過青、綠、黃：單調的藍→紅在色盲模擬下會塌成一條灰階，
     * 而且兩端一樣深，看不出方向。加了亮度變化之後，即使完全灰階也讀得
     * 出來「中間亮、兩端深」。
     */
    const RAMP = [
        [0.00, [ 30,  64, 175]],   // 深藍：冰／背景
        [0.20, [ 56, 189, 248]],   // 青
        [0.40, [134, 239, 172]],   // 淡綠
        [0.55, [253, 224,  71]],   // 黃
        [0.75, [249, 115,  22]],   // 橙
        [1.00, [185,  28,  28]],   // 深紅
    ];

    /** 停點之間的線性插值。回傳 [r, g, b]，每個分量都是整數。 */
    function rampAt(s) {
        const x = Math.max(0, Math.min(1, s));
        for (let i = 0; i + 1 < RAMP.length; i++) {
            const a = RAMP[i], b = RAMP[i + 1];
            if (x <= b[0]) {
                const f = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
                return [
                    Math.round(a[1][0] + f * (b[1][0] - a[1][0])),
                    Math.round(a[1][1] + f * (b[1][1] - a[1][1])),
                    Math.round(a[1][2] + f * (b[1][2] - a[1][2])),
                ];
            }
        }
        return RAMP[RAMP.length - 1][1].slice();
    }

    /**
     * 溫度 → 顏色。**所有**溫度都用這一支上色（見檔頭）。
     *
     * @param {number} T     溫度（K 或 °C 都可以，只要和 Tmin/Tmax 同一種）
     * @param {number} Tmin  色階的最低溫
     * @param {number} Tmax  色階的最高溫
     * @param {object} [o]   {size: 幾階}——不給就是連續的
     * @returns {Array<number>} [r, g, b]
     */
    function tempColor(T, Tmin, Tmax, o) {
        let s = (Tmax > Tmin) ? (T - Tmin) / (Tmax - Tmin) : 0.5;
        s = Math.max(0, Math.min(1, s));
        if (o && o.size > 1) s = Math.round(s * (o.size - 1)) / (o.size - 1);
        return rampAt(s);
    }

    /** 色階圖例：一條橫的漸層條加兩端的溫度標籤。 */
    function tempScale(p, view, x, y, w, h, Tmin, Tmax, o) {
        o = o || {};
        const steps = o.steps || 90;
        const px = view.toScreenX(x), py = view.toScreenY(y);
        const pw = L(view, w), ph = L(view, h);
        p.noStroke();
        for (let i = 0; i < steps; i++) {
            const c = rampAt(i / (steps - 1));
            p.fill(c[0], c[1], c[2]);
            p.rect(px + pw * i / steps, py, pw / steps + 1, ph);
        }
        strokeOn(p, [30, 41, 59], L(view, 1.2, 1));
        p.noFill();
        p.rect(px, py, pw, ph);
        const unit = o.unit || '°C';
        worldBadge(p, view, x, y + h + L(view, 15, 8), `${Tmin.toFixed(0)} ${unit}`,
                   { size: 12, align: 'center' });
        worldBadge(p, view, x + w, y + h + L(view, 15, 8), `${Tmax.toFixed(0)} ${unit}`,
                   { size: 12, align: 'center' });
    }

    // ======================================================================
    // 小工具（和 magnetic-scene 同一組，繪圖層一律吃世界座標）
    // ======================================================================

    /**
     * 座標軸的上限，挑成「好看的」數字：刻度間距取 1／2／2.5／4／5 ×10ⁿ，
     * 上限就是間距 × 格數，所以刻度標籤永遠是 50、100、150 這種。
     *
     * ⚠️ 不能只用 10 的次方去湊。湊出來的上限會讓間距變成 37.5，格線本身
     *    畫得整整齊齊，標籤卻被四捨五入成 40、80、110、150——**格線在騙人**。
     *    物理圖表上這比畫得醜嚴重得多。
     *
     * （磁學的 field-lines.js 有一份一模一樣的，那邊是局部函式。熱學有三頁
     *   要畫圖，所以擺在這裡共用。）
     */
    function niceMax(maxV, ticks) {
        if (!(maxV > 0)) return 1;
        const raw = maxV / ticks;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const n = raw / pow;                       // 1 ≤ n < 10
        const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5
                   : n <= 4 ? 4 : n <= 5 ? 5 : 10) * pow;
        return step * ticks;
    }

    /** 箭頭頭（螢幕座標）。dx, dy 只需要方向。 */
    function arrowHead(p, view, x, y, dx, dy, size, col) {
        const m = Math.hypot(dx, dy) || 1;
        const ux = dx / m, uy = dy / m;
        const px = -uy, py = ux;
        const s = L(view, size);
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.triangle(x + ux * s, y + uy * s,
                   x - ux * s * 0.4 + px * s * 0.6, y - uy * s * 0.4 + py * s * 0.6,
                   x - ux * s * 0.4 - px * s * 0.6, y - uy * s * 0.4 - py * s * 0.6);
    }

    /** 從 (x, y) 往 (dx, dy) 畫一枝箭（世界座標）。回傳箭尖的世界座標。 */
    function arrow(p, view, x, y, dx, dy, col, o) {
        o = o || {};
        const x2 = x + dx, y2 = y + dy;
        strokeOn(p, col, L(view, o.w || 2.5, 1.5));
        p.line(view.toScreenX(x), view.toScreenY(y),
               view.toScreenX(x2), view.toScreenY(y2));
        arrowHead(p, view, view.toScreenX(x2), view.toScreenY(y2),
                  dx, dy, o.head || 11, col);
        return { x: x2, y: y2 };
    }

    /** 虛線（世界座標）。ctx.setLineDash 只在有 drawingContext 時才有。 */
    function dashed(p, view, x1, y1, x2, y2, col, o) {
        o = o || {};
        const ctx = p.drawingContext;
        strokeOn(p, col, L(view, o.w || 1.5, 1));
        if (ctx.setLineDash) ctx.setLineDash([L(view, 8, 4), L(view, 7, 3)]);
        p.line(view.toScreenX(x1), view.toScreenY(y1),
               view.toScreenX(x2), view.toScreenY(y2));
        if (ctx.setLineDash) ctx.setLineDash([]);
    }

    /**
     * 熱流箭頭：一排沿著某個方向前進的箭頭，**密度與長度都在講同一件事**。
     *
     * @param {object} o
     *   o.count   畫幾個（或由呼叫端給 flux，這裡算）
     *   o.flux    0–1 的相對強度，決定箭頭的長度
     *   o.dir     'right' | 'down' | 'up'
     */
    function heatFlowArrows(p, view, x0, y0, x1, y1, flux, o) {
        o = o || {};
        const f = Math.max(0, Math.min(1, flux));
        // ⚠️ **條數與長度一起編碼通量**，這是刻意照著磁力線的慣例做的：
        //    熱流圖上箭頭的疏密和長短都代表「每秒搬多少能量」。只改長度的話
        //    兩者差三個數量級時（銅 200 W 對木材 0.075 W）看起來幾乎一樣。
        const n = o.count || Math.max(2, Math.round(11 * f));
        const col = o.col || [234, 88, 12];
        const len = L(view, 26) * (0.35 + 0.65 * f);
        for (let i = 0; i < n; i++) {
            const f2 = (i + 0.5) / n;
            const x = x0 + (x1 - x0) * f2, y = y0 + (y1 - y0) * f2;
            if (o.dir === 'down') {
                arrow(p, view, x, y - len / 2, 0, len, col, { w: 2, head: 8 });
            } else if (o.dir === 'up') {
                arrow(p, view, x, y + len / 2, 0, -len, col, { w: 2, head: 8 });
            } else {
                arrow(p, view, x - len / 2, y, len, 0, col, { w: 2, head: 8 });
            }
        }
    }

    // ======================================================================
    // 一根棒子的溫度分布
    // ======================================================================
    /**
     * 把一個溫度陣列畫成一條**連續的色帶**（不是一格一格），外加一層輪廓。
     *
     * 用「很多細長方塊」而不是「每個節點一個方塊」是刻意的：節點數目是數值
     * 方法的事，學生看到的應該是連續的物理量。方塊數固定，和 N 無關。
     *
     * @param {object} o {Tmin, Tmax, steps, border}
     * @returns {function(number):number} 世界 x → 世界 y 的中心線（給標註用）
     */
    function drawTempBand(p, view, x, y, w, h, T, Tmin, Tmax, o) {
        o = o || {};
        const steps = o.steps || 120;
        const px = view.toScreenX(x), py = view.toScreenY(y);
        const pw = L(view, w), ph = L(view, h);
        const n = T.length;
        p.noStroke();
        for (let i = 0; i < steps; i++) {
            const f = (i + 0.5) / steps;
            const c = tempColor(T[Math.min(n - 1, Math.floor(f * n))], Tmin, Tmax);
            p.fill(c[0], c[1], c[2]);
            p.rect(px + pw * i / steps, py, pw / steps + 1.2, ph);
        }
        if (o.border !== false) {
            strokeOn(p, [30, 41, 59], L(view, 1.5, 1));
            p.noFill();
            p.rect(px, py, pw, ph);
        }
        return { cy: y + h / 2 };
    }

    // ======================================================================
    // 分子：一格會抖的粒子
    // ======================================================================
    /**
     * 一團分子。**這不是裝飾，是一個真的熱庫。**
     *
     * 每一顆跑的是 Langevin 方程式：
     *
     *     dv = [ −γ·v − k·(r − r_home) ]·dt + v_T·√(2γ·dt)·ξ
     *
     * 最後那一項是隨機力，強度由 **v_T 決定**——而 v_T 就是這一團的
     * 熱運動速率，`√T` 正比。所以平衡時所有分子的方均根速率會收斂到 v_T
     * （這叫漲落–耗散定理），也就是說：**畫面上的抖動幅度是真的從溫度來的**，
     * 不是「看起來比較熱就抖大一點」。
     *
     * ⚠️ 這一點值得堅持。分子動畫很容易寫成 `x += sin(t·ω)·amp`，其中
     *    amp 是「熱度」，看起來一模一樣。差別在於：那樣寫的分子在固體裡
     *    也是自由飛的，只是飛得比較小力，而真正的固體是**繞著晶格點振動**。
     *    這個差別正好是熱傳導那一頁與比熱那一頁要教的東西。
     *
     * 三種狀態靠兩個參數表示：
     *   固體  tether 大（綁在晶格點上）、bounds 是整塊物質
     *   液體  tether 小、bounds 是液面以下
     *   氣體  tether 0、bounds 是整個容器、damp 很小（彈道飛行）
     *
     * @param {object} o {x0,y0,x1,y1, cols, rows}
     */
    function moleculeBox(o) {
        const cols = o.cols, rows = o.rows;
        const list = [];
        const box = { x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 };

        function relayout() {
            const n = list.length ? list.length : cols * rows;
            const c = cols, r = Math.ceil(n / c);
            for (let i = 0; i < list.length; i++) {
                const ix = i % c, iy = Math.floor(i / c);
                list[i].hx = box.x0 + (box.x1 - box.x0) * (ix + 0.5) / c;
                list[i].hy = box.y0 + (box.y1 - box.y0) * (iy + 0.5) / r;
            }
        }

        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                list.push({
                    hx: 0, hy: 0, x: 0, y: 0, vx: 0, vy: 0,
                    ph: (i * 3.1 + j * 5.7) % 6.283,
                });
            }
        }
        relayout();
        for (const m of list) { m.x = m.hx; m.y = m.hy; }

        return {
            list, box, cols, rows,

            /** 換一個容器：重新算晶格點，分子的位置**按比例**搬過去。 */
            setBox(b) {
                const oldW = Math.max(1e-6, box.x1 - box.x0);
                const oldH = Math.max(1e-6, box.y1 - box.y0);
                const nW = b.x1 - b.x0, nH = b.y1 - b.y0;
                for (const m of list) {
                    m.x = b.x0 + (m.x - box.x0) / oldW * nW;
                    m.y = b.y0 + (m.y - box.y0) / oldH * nH;
                }
                box.x0 = b.x0; box.y0 = b.y0; box.x1 = b.x1; box.y1 = b.y1;
                relayout();
            },

            /**
             * 走一步。
             * @param {object} s
             *   s.dt      秒
             *   s.speed   熱運動速率 v_T（世界單位／秒）——**由 √T 決定**。
             *             ⚠️ 可以是一個**函式** `m => 速率`：一根棒子上每一顆
             *             分子就該有自己的 v_T（它住的那個位置幾度），熱端抖
             *             得凶、冷端抖得小。整根用同一個速率的話，畫面上一樣
             *             好看，但「熱的地方粒子抖得厲害」那件事就不見了。
             *   s.tether  0（自由）～1（牢牢綁在晶格點上）
             *   s.damp    阻尼 γ（1/s）。氣體要小（彈道），液體要大
             *   s.box     分子被關在裡面（不給就用建構時那個）
             *   s.r       半徑，用來讓分子不穿牆
             */
            step(s) {
                const b = s.box || box;
                const dt = Math.min(s.dt, 0.05);
                const damp = s.damp == null ? 9 : s.damp;
                const tether = s.tether || 0;
                const k = tether * 60;
                const r = s.r || 0;
                const speedAt = typeof s.speed === 'function' ? s.speed : () => s.speed;
                const amp = Math.sqrt(2 * damp * dt);

                for (const m of list) {
                    // 隨機力：均勻分布在 [−√3, √3] 上，變異數剛好是 1
                    const kick = speedAt(m) * amp;
                    const nx = (Math.random() * 2 - 1) * Math.sqrt(3);
                    const ny = (Math.random() * 2 - 1) * Math.sqrt(3);
                    m.vx += (-damp * m.vx - k * (m.x - m.hx)) * dt + kick * nx;
                    m.vy += (-damp * m.vy - k * (m.y - m.hy)) * dt + kick * ny;
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;

                    // 牆：反彈（氣體的自由飛行就是靠這個變成「撞牆」）
                    if (m.x < b.x0 + r) { m.x = b.x0 + r; m.vx = Math.abs(m.vx); }
                    if (m.x > b.x1 - r) { m.x = b.x1 - r; m.vx = -Math.abs(m.vx); }
                    if (m.y < b.y0 + r) { m.y = b.y0 + r; m.vy = Math.abs(m.vy); }
                    if (m.y > b.y1 - r) { m.y = b.y1 - r; m.vy = -Math.abs(m.vy); }
                }
            },

            /** 熱運動速率的**估計值**（每秒的方均根）。卡片要印的是這個。 */
            rmsSpeed() {
                let s2 = 0;
                for (const m of list) s2 += m.vx * m.vx + m.vy * m.vy;
                return Math.sqrt(s2 / Math.max(1, list.length) / 2);
            },

            /**
             * 畫出來。
             * @param {object} g {r, col, colorBySpeed, Tmin, Tmax}
             */
            draw(p, view, g) {
                g = g || {};
                const r = g.r || 4;
                const R = L(view, r);
                p.noStroke();
                for (const m of list) {
                    let col = g.col;
                    if (g.colorBySpeed) {
                        const sp = Math.hypot(m.vx, m.vy);
                        col = tempColor(sp, 0, g.vRef || 1, { size: 6 });
                    }
                    p.fill(col[0], col[1], col[2]);
                    p.ellipse(view.toScreenX(m.x), view.toScreenY(m.y), R * 2, R * 2);
                }
            },
        };
    }

    // ======================================================================
    // 示蹤粒子：被流場帶著走的一群點
    // ======================================================================

    /**
     * 流場最快有多快——在格子內側戳幾個點取最大值。
     *
     * 只在呼叫端沒給 `vmax` 時才跑，用來決定子步數。戳點刻意避開邊界：
     * 這個流場的最快處在 z = 0（牆）上，戳不到會低估 15% 左右，而低估
     * 只會讓子步少一點，不影響正確性。
     */
    function probeSpeed(vel, W, H) {
        let m = 0;
        for (let i = 1; i < 12; i++) {
            for (let j = 1; j < 6; j++) {
                const v = vel((i / 12) * W, (j / 6) * H);
                const sp = Math.sqrt(v.u * v.u + v.w * v.w);
                if (sp > m) m = sp;
            }
        }
        return m;
    }

    /**
     * 一群**被流體搬著走**的示蹤粒子（tracer）。
     *
     * 和 moleculeBox 的差別是「誰在動」：
     *   分子        dv = [−γv − k(r−r_home)]dt + v_T√(2γdt)ξ   自己抖（熱運動）
     *   示蹤粒子    dx/dt = u(x, z)                              自己不動，被搬著走
     *
     * 對流那一頁要看的就是後者：**熱的流體往上跑、冷的往下沉**，所以粒子的
     * 顏色必須是它**當下所在位置**的溫度，而不是它自己的溫度。
     *
     * ⚠️ 座標是**物理座標**（x、z 都是公尺、z 向上），因為流場
     *    （`ThermalKit.cellVelocity`）吐出來的 u、w 就是 m/s，餵進來剛好。
     *    世界座標那一層由 `draw()` 的 `box` 線性映射，這一支不猜。
     */
    function tracerField(o) {
        const n = o.n || 120;
        const list = [];
        for (let i = 0; i < n; i++) list.push({ x: 0, z: 0, trail: [] });

        /**
         * 初始位置。
         *
         * ⚠️ 預設是**隨機均勻**，但穩態的胞狀流場不可以這樣灑。理由見
         *    convection.js 的 seedStreamlines()：隨機灑的粒子會全部卡在
         *    Ψ = 0 的等值線（牆、以及胞與胞的邊界）上，看起來像壞掉。
         *    呼叫端要傳 `o.seed(W, H, n) → [{x,z}, …]` 自己決定。
         */
        function scatter(W, H) {
            const pts = o.seed ? o.seed(W, H, n) : null;
            for (let i = 0; i < n; i++) {
                const p = pts ? pts[i % pts.length] : null;
                list[i].x = p ? p.x : Math.random() * W;
                list[i].z = p ? p.z : Math.random() * H;
                list[i].trail.length = 0;
            }
        }

        return {
            list,

            /** 重新散布（換流體、按重設時用）。 */
            reset(W, H) { scatter(W, H); },

            /**
             * 走一步。`s.dt` 是**物理時間**，而且頁面已經乘過時間壓縮了。
             * `s.vmax` 是流場最快有多快（世界單位／秒），只用來決定子步數。
             *
             * ⚠️ 子步數要看「一個子步走多遠」，不是「一個子步多久」。
             *
             *    這一格踩過一個坑：原本寫成 `min(40, ceil(dt / 0.02))`，看起來
             *    很合理，結果粒子全部堆到牆上去。原因是**顯式歐拉法在旋轉的
             *    流場裡每一步都會把面積放大 (ω·h)²**，ω 是流速的空間變化率
             *    （≈ U/L），h 是子步長。dt = 0.05 s、U/L ≈ 2 /s 時一個子步
             *    放大 1%，跑 200 幀就放大快兩倍——粒子像被甩乾一樣往外甩，
             *    最後全部黏在盒壁上。畫面上只看得出「粒子分布怪怪的」，
             *    `errs` 還是 0。
             *
             *    把子步的**位移**壓在盒子短邊的 0.2% 以下，放大率就掉到
             *    4×10⁻⁶，跑一萬步也才 4%。
             */
            step(s) {
                const W = s.W, H = s.H;
                if (!(W > 0 && H > 0)) {
                    throw new Error('tracerField.step：W/H 要是正的');
                }
                if (!(s.dt > 0)) return;
                const trail = s.trail == null ? 8 : s.trail;
                const vmax = s.vmax > 0 ? s.vmax : probeSpeed(s.vel, W, H);
                const dmax = 0.002 * Math.min(W, H);
                const sub = Math.max(1, Math.min(160, Math.ceil((vmax * s.dt) / dmax)));
                const dt = s.dt / sub;
                for (const t of list) {
                    for (let i = 0; i < sub; i++) {
                        // 中點法（RK2）：先走半步探路，再用中點的速度走完整步。
                        //
                        // ⚠️ 不要改回顯式歐拉。歐拉的誤差是二階的，在旋轉流場裡
                        //    它每步都把面積放大 (ω·h)²——就算子步切到 17 步，
                        //    跑 10 秒也會讓粒子偏離原本的流線 8%。中點法的誤差是
                        //    四階的，同樣的子步數偏離量掉到 10⁻⁹ 等級，流線才會
                        //    真的是流線。代價是每一步多問一次流場，很便宜。
                        const v1 = s.vel(t.x, t.z);
                        const v2 = s.vel(t.x + v1.u * dt * 0.5, t.z + v1.w * dt * 0.5);
                        t.x += v2.u * dt;
                        t.z += v2.w * dt;
                    }
                    // 牆：流場本來就沿著牆走（Ψ 的邊界條件保證的），會跑出去
                    // 只有數值誤差。夾住就好，**不要繞回另一邊**——繞回去會
                    // 在軌跡上拉出一條橫貫整個盒子的直線。
                    if (t.x < 1e-9) t.x = 1e-9;
                    if (t.x > W - 1e-9) t.x = W - 1e-9;
                    if (t.z < 1e-9) t.z = 1e-9;
                    if (t.z > H - 1e-9) t.z = H - 1e-9;
                    if (trail > 0) {
                        t.trail.push(t.x, t.z);      // 兩個數字一個點
                        if (t.trail.length > trail * 2) {
                            t.trail.splice(0, t.trail.length - trail * 2);
                        }
                    } else if (t.trail.length) {
                        // 關掉軌跡時要清掉舊點，不然切回「有軌跡」的那一瞬間
                        // 會畫出一條停在幾十秒前位置的假軌跡。
                        t.trail.length = 0;
                    }
                }
            },

            /**
             * 畫出來。
             *
             * ⚠️ `g.box` 一定要是 `{x0,y0,x1,y1}`。餵它一個 `{x,y,w,h}` 的矩形
             *    （場景物件的慣用寫法）不會報錯，`b.x0` 是 undefined、每個
             *    粒子都畫在 NaN 上——**畫面上只是粒子全部不見了**，`errs=0`。
             *    README 陷阱九就是這一種。
             *
             * @param {object} g
             *   g.box     世界座標的矩形 {x0,y0,x1,y1}（粒子被映射進去）
             *   g.W, g.H  盒子實際的物理尺寸（公尺），和 step() 的要一致
             *   g.colorAt (x, z) → [r,g,b]；不給就用 g.col
             *   g.r, g.ring, g.trail
             */
            draw(p, view, g) {
                const b = g.box, W = g.W, H = g.H;
                if (!(b && b.x1 > b.x0 && b.y1 > b.y0 && W > 0 && H > 0)) {
                    throw new Error('tracerField.draw：box 要是 {x0,y0,x1,y1}，W/H 要是正的');
                }
                const sx = x => view.toScreenX(b.x0 + (x / W) * (b.x1 - b.x0));
                const sy = z => view.toScreenY(b.y1 - (z / H) * (b.y1 - b.y0));
                const R = L(view, g.r || 2.6);
                const useTrail = g.trail !== false;
                for (const t of list) {
                    const c = g.colorAt ? g.colorAt(t.x, t.z) : (g.col || [255, 255, 255]);
                    if (useTrail && t.trail.length >= 4) {
                        p.noFill();                    // ⚠️ beginShape 會繼承填色
                        strokeOn(p, c, L(view, 1.5, 1));
                        p.beginShape();
                        for (let i = 0; i < t.trail.length; i += 2) {
                            p.vertex(sx(t.trail[i]), sy(t.trail[i + 1]));
                        }
                        p.endShape();
                    }
                    if (g.ring) {
                        strokeOn(p, g.ring, L(view, 1.2, 1));
                        p.fill(c[0], c[1], c[2]);
                    } else {
                        p.noStroke();
                        p.fill(c[0], c[1], c[2]);
                    }
                    p.ellipse(sx(t.x), sy(t.z), R * 2, R * 2);
                }
            },
        };
    }

    // ======================================================================
    // 溫度計
    // ======================================================================
    /**
     * 實驗室溫度計：下方一顆球、上方一根管子，裡面那一條的高度正比於溫度。
     *
     * ⚠️ 管子的**起點是 Tmin 不是 0**。溫度計不是從絕對零度開始量的——
     *    一條「0 到 400 °C」的管子如果起點畫在最低刻度上，那個最低刻度
     *    就是 Tmin，呼叫端要自己決定。這裡只負責照著 Tmin/Tmax 放位置。
     */
    function drawThermometer(p, view, x, y, h, T, Tmin, Tmax, o) {
        o = o || {};
        const bulbR = o.bulb || 22;
        const tubeW = o.tube || 17;
        const cx = view.toScreenX(x), cy = view.toScreenY(y);
        const H = L(view, h), BR = L(view, bulbR), TW = L(view, tubeW);

        // 管子（外殼）
        p.noStroke();
        p.fill(255, 255, 255, 235);
        p.rect(cx - TW / 2, cy - H, TW, H);
        strokeOn(p, [30, 41, 59], L(view, 2, 1.2));
        p.noFill();
        p.rect(cx - TW / 2, cy - H, TW, H);
        p.noStroke();
        p.fill(255, 255, 255, 235);
        p.ellipse(cx, cy, BR * 2, BR * 2);
        strokeOn(p, [30, 41, 59], L(view, 2, 1.2));
        p.noFill();
        p.ellipse(cx, cy, BR * 2, BR * 2);

        // 液柱：從球心往上，高度依 T 在 [Tmin, Tmax] 的比例
        const f = Math.max(0, Math.min(1, (T - Tmin) / (Tmax - Tmin)));
        const col = tempColor(T, Tmin, Tmax);
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        const hh = (H - L(view, 10)) * f;
        if (hh > 0) p.rect(cx - TW / 2 + L(view, 3.4), cy - hh, TW - L(view, 6.8), hh);
        p.ellipse(cx, cy, (BR - L(view, 5)) * 2, (BR - L(view, 5)) * 2);

        if (o.label !== false) {
            worldBadge(p, view, x, y - h - L(view, 18, 10), `${T.toFixed(o.dec == null ? 0 : o.dec)} ${o.unit || '°C'}`,
                       { size: 14, col: [30, 64, 175] });
        }
    }

    // ======================================================================
    // 熱輻射：發光與能量射線
    // ======================================================================
    /**
     * 一個**會發光**的物體：本體依溫度上色，外圍一圈射線。
     *
     * ⚠️ 射線的**條數**固定、**長度**依 P（淨輻射功率）決定。條數固定是
     *    刻意的：條數一變，學生會以為「輻射出更多種射線」，而物理上變的是
     *    功率。長度是唯一誠實的編碼方式，再配一個數字標籤就夠了。
     */
    function drawGlow(p, view, x, y, r, T, Tmin, Tmax, o) {
        o = o || {};
        const f = Math.max(0, Math.min(1, o.flux == null ? 1 : o.flux));
        const cx = view.toScreenX(x), cy = view.toScreenY(y);
        const R = L(view, r);
        const col = tempColor(T, Tmin, Tmax);

        // 光暈：三層愈來愈淡的圓
        const halo = o.halo == null ? 0.55 : o.halo;
        if (halo > 0) {
            p.noStroke();
            for (let i = 3; i >= 1; i--) {
                p.fill(col[0], col[1], col[2], 20 * halo * (4 - i));
                p.ellipse(cx, cy, R * 2 * (1 + i * 0.22), R * 2 * (1 + i * 0.22));
            }
        }
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.rect(cx - R, cy - R, R * 2, R * 2);
        strokeOn(p, [30, 41, 59], L(view, 2, 1.2));
        p.noFill();
        p.rect(cx - R, cy - R, R * 2, R * 2);

        // 射線
        const n = o.rays || 12;
        const len = L(view, 16) * (0.25 + 0.75 * f);
        for (let i = 0; i < n; i++) {
            const a = 2 * Math.PI * i / n + (o.spin || 0);
            const sx = x + Math.cos(a) * (r * 1.12);
            const sy = y + Math.sin(a) * (r * 1.12);
            arrow(p, view, sx, sy, Math.cos(a) * len, Math.sin(a) * len,
                  col, { w: 1.8, head: 6 });
        }
    }

    // ======================================================================
    // 活塞汽缸（氣體定律那一頁）
    // ======================================================================
    /**
     * 汽缸與活塞。**活塞的位置就是體積**——所以它必須由 V 算出來，
     * 不能在頁面上寫死一個高度再另外宣告一個 V。
     *
     * @param {object} o {w, h, vFrac, wall, T, Tmin, Tmax, label}
     * @returns {{x0,y0,x1,y1}} 活塞**下方**的氣體區域（世界座標），
     *                          分子的盒子就用這一個
     */
    /**
     * 汽缸內部的分子活動範圍（世界座標）。
     *
     * ⚠️ 這一支是**唯一**的汽缸幾何。`drawCylinder` 用它畫，氣體定律那一頁
     *    也用它關分子——兩邊各寫一份的症狀是「畫出來的活塞」與「分子撞到
     *    的活塞」悄悄差幾個單位，而畫面上只會看到分子偶爾穿出活塞，數字
     *    全部正常。**不要**在頁面裡重算這一條式子。
     */
    function cylinderBox(x, yBottom, w, h, vFrac, wall) {
        const wl = wall == null ? 11 : wall;
        const f = Math.max(0.04, Math.min(1, vFrac));
        const gasTop = yBottom - h * f;
        return {
            x0: x - w / 2 + wl + 3, y0: gasTop + 3,
            x1: x + w / 2 - wl - 3, y1: yBottom - wl - 3,
            top: gasTop, f, wall: wl,
        };
    }

    function drawCylinder(p, view, x, yBottom, w, h, vFrac, o) {
        o = o || {};
        const wall = o.wall || 11;
        const f = Math.max(0.04, Math.min(1, vFrac));
        const gasH = h * f;
        const gasTop = yBottom - gasH;

        const px = view.toScreenX(x - w / 2), py = view.toScreenY(yBottom);
        const pw = L(view, w), ph = L(view, h), W = L(view, wall);

        // 氣體本身：依溫度上色（半透明，分子才看得見）
        const col = tempColor(o.T, o.Tmin, o.Tmax);
        p.noStroke();
        p.fill(col[0], col[1], col[2], 46);
        p.rect(px + W, view.toScreenY(gasTop), pw - W * 2, L(view, gasH));

        // 缸壁
        p.fill(226, 232, 240);
        p.rect(px, py - ph, W, ph);
        p.rect(px + pw - W, py - ph, W, ph);
        p.rect(px, py, pw, W);

        // 活塞
        const ph2 = L(view, o.pistonH || 20);
        p.fill(100, 116, 139);
        p.rect(px, view.toScreenY(gasTop) - ph2, pw, ph2);
        strokeOn(p, [30, 41, 59], L(view, 2, 1.2));
        p.noFill();
        p.rect(px, view.toScreenY(gasTop) - ph2, pw, ph2);
        // 活塞桿
        p.noStroke();
        p.fill(148, 163, 184);
        p.rect(px + pw / 2 - L(view, 5), view.toScreenY(gasTop) - ph2 - L(view, 34),
               L(view, 10), L(view, 34));

        // 氣體區域（給分子用的盒子）——和 cylinderBox 同一條式子
        return cylinderBox(x, yBottom, w, h, vFrac, wall);
    }

    // ======================================================================
    // 對外介面
    // ======================================================================
    return {
        // lab-scene.js 的東西，只是**轉出**——熱學的頁面因此只要記住
        // ThermalScene 一個名字（磁學、電學也是同樣的做法）。
        strokeOn, L, fmt, badge,
        // ⚠️ 標籤一律用 worldBadge（吃世界座標）。`badge` 是像素版本，
        //    只為了和波動學／電學那幾頁共用才一起轉出來——熱學的頁面不要用它。
        worldBadge,
        run: LabScene.run,
        drawGraph: LabScene.drawGraph,
        drawTitleBar: LabScene.drawTitleBar,
        WORLD_W, WORLD_H, SCENE,

        // 溫度色階（**所有**溫度的唯一住處）
        RAMP, tempColor, tempScale, niceMax,

        arrowHead, arrow, dashed, heatFlowArrows,
        drawTempBand, moleculeBox, tracerField, drawThermometer, drawGlow,
        drawCylinder, cylinderBox,
    };
})();
