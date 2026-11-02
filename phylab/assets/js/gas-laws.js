/**
 * 🧪 氣體定律
 *
 * 活塞汽缸裡關著一團氣體。三個量在互相牽制：**壓力 p、體積 V、溫度 T**。
 * 這一頁要學生自己發現一件事——
 *
 *   **三個量裡只有兩個是自由的。**你固定一個，另外兩個就綁在一起了：
 *
 *     等溫（波以耳）  固定 T → p ∝ 1/V      圖是一條雙曲線
 *     等壓（查理）    固定 p → V ∝ T        圖是一條過原點的直線
 *     等容（壓力定律）固定 V → p ∝ T        圖也是一條過原點的直線
 *
 *   三個模式畫的是同一條式子 `pV = nRT`，只是固定了不同的變數。
 *   右邊那塊面板把數字填進式子裡，最後一行 `pV/(nT)` **永遠是 8.314**
 *   ——那條就是「理想氣體常數」R 的意思：它不是課本給的一個數字，
 *   是這三條定律共用同一個比例常數。
 *
 * ⚠️ 兩個 T 模式（等壓、等容）的圖，直線**往回延長會穿過原點**。
 *    橫軸切到「攝氏」就會看到它撞上 −273.15 °C 的垂直線——絕對零度
 *    不是誰規定的，是這條直線自己指的。切到「克耳文」原點就在 0。
 *    同一筆資料、同一條線，換一個橫軸刻度而已（所以切換橫軸**不會**
 *    清掉量測點，見 `selects` 裡 axis 的 `live: true`）。
 *
 * ⚠️ 「壓力是分子撞出來的」在這一頁是看得見的：分子撞到缸壁時會亮一圈，
 *    下面那條徽章是**畫面上**數到的每秒撞擊次數。但撞擊次數**不等於**
 *    壓力——每次撞擊帶走的動量 ∝ √T，所以
 *
 *        p  ∝  (每秒撞幾次) × (每次撞多用力)  ∝  (√T / V) × √T  =  T / V
 *
 *    這正是 `ThermalKit.collisionRate` 與 `ThermalKit.pressureFromKinetic`
 *    兩支都存在的理由，驗證腳本 ⑧ 會把這條推導壓成斷言。
 */

var GasLaws = (function () {
    'use strict';

    const Kit = ThermalKit;

    // ======================================================================
    // 版面（世界座標 900×900）
    // ======================================================================
    const CYL = { x: 268, yBottom: 470, w: 200, h: 318 };
    const GRAPH = { x: 150, y: 540, w: 600, h: 230 };
    const EQ = { x: 404, y0: 140, dy: 46 };
    const HEAD_Y = 58;
    // 撞擊次數徽章掛在汽缸**左邊**那一欄，不是汽缸與圖之間。
    // 放中間的話會和 drawGraph 的標題疊在一起——標題是
    // `textAlign(CENTER, BOTTOM)` 畫在 `GRAPH.y - 30`（＝世界 y 493–510），
    // 徽章 ±12 畫在 508 就是 496–520，兩塊直接蓋掉「波以耳定律」的「波」。
    // 這是截圖放大才看得出來的那一類（畫面不會報錯），所以位置寫在這裡。
    const HIT_BADGE = { x: 88, y: 416 };

    // ======================================================================
    // 實驗條件
    // ======================================================================
    const N_FIXED = 0.20;                        // 莫耳數（這一頁固定）
    const T_MIN = 200, T_MAX = 600, T_DEF = 300; // 克耳文
    const V_MIN = 1.5, V_MAX = 12.0, V_DEF = 5.0; // 公升
    // 等壓模式的「重物」：活塞上的壓力。體積由 V = nRT/p 決定。
    const P_CHARLES = 100e3;                     // Pa

    // 橫軸刻度。兩個 T 模式的資料都在 200–600 K，攝氏刻度刻意往左多留
    // 一段，好讓 −273.15 那條線落在圖裡面而不是貼在左邊界上。
    const AXIS_K = { min: 0, max: 650, ticks: 5 };
    const AXIS_C = { min: -350, max: 350, ticks: 5 };

    const N_MOL = 40;                            // 畫面上的分子數
    const MOL_R = 3.2;                           // 分子半徑（世界單位）
    const VIS_V0 = 88;                           // 300 K 時的畫面速率（世界單位/秒）
    const HIT_TAU = 0.6;                         // 撞擊閃光與計數的滑動視窗（秒）

    const MODE_INFO = {
        boyle: {
            name: '波以耳定律（等溫）',
            hold: '溫度 T 固定——拉活塞看壓力怎麼變',
            col: [37, 99, 235],
        },
        charles: {
            name: '查理定律（等壓）',
            hold: '壓力 p 固定——活塞上壓著重物，加熱它就自己升起來',
            col: [13, 148, 136],
        },
        pressure: {
            name: '壓力定律（等容）',
            hold: '體積 V 固定——活塞鎖住，加熱看壓力怎麼變',
            col: [234, 88, 12],
        },
    };

    const GAS_COL = [56, 130, 246];
    const HIT_COL = [234, 88, 12];
    const HOT_COL = [220, 38, 38];

    // ======================================================================
    // 小工具
    // ======================================================================
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    /** 決定性偽隨機（LCG）。分子要用可重現的亂數，驗證腳本才驗得動。 */
    function rng(seed) {
        let s = (seed >>> 0) || 1;
        return function () {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    /**
     * 座標軸上限，刻度間距取 1／2／5 ×10ⁿ。
     *
     * ⚠️ **刻意不用 ThermalScene.niceMax**。那一支的間距選項裡有 2.5，而
     *    `drawGraph` 的 `trim()` 對 ≥10 的數字做 toFixed(0)——間距 2.5 碰上
     *    五位刻度會生出 12.5 這種刻度值，標籤印成「13」，**格線在騙人**。
     *    熱學別頁的量程讓那個情況沒發生，這一頁的量程是我挑的，所以自己
     *    寫一個只出 1／2／5 的版本，驗證腳本再逐格檢查都是整數。
     */
    function niceStep(maxV, ticks) {
        if (!(maxV > 0)) return ticks;
        const raw = maxV / ticks;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const n = raw / pow;
        const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
        return m * pow * ticks;
    }

    function kPa(Pa) { return Pa / 1000; }

    // ======================================================================
    // 狀態：三個量裡哪兩個是自由的
    // ======================================================================
    /**
     * 把面板上的滑桿換算成一個合法的氣體狀態（SI：Pa、m³、K、mol）。
     *
     * ⚠️ 等壓模式下 **V 不是自由變數**——它由 T 決定。面板上的 V 滑桿在
     *    那個模式會被 `snapV()` 拉回正確的位置，所以 `panel.V` 和這裡算
     *    出來的 V 是一致的；但兩者的**來源**不同，改這一頁的時候要知道
     *    「等壓模式下 V 滑桿是顯示器，不是控制器」。
     */
    function stateOf(panel) {
        const mode = panel.mode;
        const gas = Kit.GASES[panel.gas] ? panel.gas : 'air';
        const n = N_FIXED;
        const T = clamp(parseFloat(panel.T), T_MIN, T_MAX);
        let V = clamp(parseFloat(panel.V), V_MIN, V_MAX) / 1000;

        if (mode === 'charles') V = n * Kit.R_GAS * T / P_CHARLES;

        const p = Kit.idealP(n, T, V);
        const M = Kit.GASES[gas].M;
        return {
            mode, n, T, V, V_L: V * 1000, p,
            TC: Kit.toC(T),
            gas, M, gasName: Kit.GASES[gas].name,
            cRms: Kit.rmsSpeed(T, M),
            ke: Kit.meanKE(T),
            // 這個量在三種模式下都必須是 R。它同時是卡片、也是驗證斷言。
            inv: p * V / (n * T),
        };
    }

    /** 等壓模式下把 V 滑桿拉到 T 對應的位置（不觸發 onChange）。 */
    function snapV(panel) {
        if (panel.mode !== 'charles') return;
        const want = Math.round(N_FIXED * Kit.R_GAS * clamp(parseFloat(panel.T), T_MIN, T_MAX)
                                / P_CHARLES * 1000 / 0.1) * 0.1;
        const v = clamp(want, V_MIN, V_MAX);
        if (Math.abs(v - parseFloat(panel.V)) > 0.05) panel.set('V', v);
    }

    /**
     * 這一頁的畫面狀態：分子、撞擊閃光、量測點。
     * 全部掛在一個物件上，方便 `reset()` 一次清乾淨。
     */
    const G = {
        mol: [], box: null, hits: [], seeded: null,
        rand: rng(20260918),
        pts: [], last: null, lastSim: 0, shownRate: 0,
    };

    // ======================================================================
    // 分子的彈道運動
    // ======================================================================
    /**
     * 分子的活動範圍。
     *
     * ⚠️ 這一支**不可以自己算**——汽缸的幾何只有 `ThermalScene.cylinderBox`
     *    一個住處，`drawCylinder` 畫活塞用的就是它。頁面重算一份的話，
     *    「畫出來的活塞」和「分子撞到的活塞」會悄悄差幾個單位，而畫面上
     *    只會看到分子偶爾穿出活塞，其他一切正常。
     */
    function gasBox(V_L) {
        return ThermalScene.cylinderBox(CYL.x, CYL.yBottom, CYL.w, CYL.h, V_L / V_MAX);
    }

    /** 畫面速率：正比於 √T（真實的方均根速率也是），300 K 時是 VIS_V0。 */
    function visSpeed(T) { return VIS_V0 * Math.sqrt(T / 300); }

    function seedGas(box, T) {
        G.rand = rng(20260918);
        G.mol = [];
        for (let i = 0; i < N_MOL; i++) {
            const a = G.rand() * Math.PI * 2;
            G.mol.push({
                x: box.x0 + G.rand() * (box.x1 - box.x0),
                y: box.y0 + G.rand() * (box.y1 - box.y0),
                ux: Math.cos(a), uy: Math.sin(a),
                v: visSpeed(T),
            });
        }
        G.hits = [];
        G.seeded = { n: N_MOL, T };
    }

    /** 溫度變了就重新縮放速度。條數不變——加熱不會讓分子變多。 */
    function retuneGas(T) {
        const v = visSpeed(T);
        for (const m of G.mol) m.v = v;
        G.seeded.T = T;
    }

    /**
     * 走一步。回傳這一格撞了幾次牆。
     *
     * 分子在盒子裡彈道飛行，撞到牆就反彈並記一次撞擊。分子半徑要算進去，
     * 否則分子會穿牆——在收縮的活塞下那個誤差會被放大成「分子跑到缸外」。
     */
    function stepGas(box, dt) {
        const sub = 4;                       // 分子跑得快，一格分四小步才不穿牆
        const h = dt / sub;
        let n = 0;
        for (let k = 0; k < sub; k++) {
            for (const m of G.mol) {
                m.x += m.ux * m.v * h;
                m.y += m.uy * m.v * h;
                if (m.x < box.x0 + MOL_R) {
                    m.x = box.x0 + MOL_R; m.ux = Math.abs(m.ux); n++; hitAt(box.x0, m.y);
                } else if (m.x > box.x1 - MOL_R) {
                    m.x = box.x1 - MOL_R; m.ux = -Math.abs(m.ux); n++; hitAt(box.x1, m.y);
                }
                if (m.y < box.y0 + MOL_R) {
                    m.y = box.y0 + MOL_R; m.uy = Math.abs(m.uy); n++; hitAt(m.x, box.y0);
                } else if (m.y > box.y1 - MOL_R) {
                    m.y = box.y1 - MOL_R; m.uy = -Math.abs(m.uy); n++; hitAt(m.x, box.y1);
                }
            }
        }
        return n;
    }

    function hitAt(x, y) {
        G.hits.push({ x, y, age: 0 });
        if (G.hits.length > 400) G.hits.shift();
    }

    // ======================================================================
    // 量測點：走過的軌跡
    // ======================================================================
    /** 這一頁的「被固定的那個變數」。它一變就是換了另一條曲線。 */
    function heldKey(pr) {
        if (pr.mode === 'boyle') return 'T=' + pr.T.toFixed(3);
        if (pr.mode === 'pressure') return 'V=' + pr.V_L.toFixed(3);
        return 'p=' + P_CHARLES.toFixed(0);      // 等壓：重物的重量沒動
    }

    function plotX(pr, panel, T_K) {
        return panel.axis === 'C' ? Kit.toC(T_K) : T_K;
    }

    /** 目前狀態在圖上的位置（資料座標）。 */
    function plotPoint(pr, panel) {
        if (pr.mode === 'boyle') return { x: pr.V_L, y: kPa(pr.p) };
        return { x: plotX(pr, panel, pr.T),
                 y: pr.mode === 'charles' ? pr.V_L : kPa(pr.p) };
    }

    function clearPoints() { G.pts = []; G.last = null; }

    function recordPoint(pr, panel) {
        const q = plotPoint(pr, panel);
        const A = axesOf(pr, panel);
        const dx = (A.xMax - A.xMin) * 0.02, dy = (A.yMax - A.yMin) * 0.02;
        const last = G.pts[G.pts.length - 1];
        // 門檻用意是「同一條曲線上密集取樣」而不是「每個像素都記一筆」。
        // 太小的話拖一次滑桿會落幾百個點，圖上糊成一團。
        if (last && Math.abs(last.x - q.x) < dx && Math.abs(last.y - q.y) < dy) return;
        G.pts.push(q);
        if (G.pts.length > 400) G.pts.shift();
    }

    // ======================================================================
    // 座標軸
    // ======================================================================
    function axesOf(pr, panel) {
        if (pr.mode === 'boyle') {
            // 等溫線的縱軸上限由**現在的溫度**決定。溫度一變就是換一條
            // 等溫線，點會清掉（見 onChange），所以縱軸跟著換是合理的。
            const top = kPa(Kit.idealP(N_FIXED, pr.T, V_MIN / 1000));
            return {
                xMin: 0, xMax: V_MAX, xTicks: 6, yMin: 0,
                yMax: niceStep(top, 5), yTicks: 5,
                xLabel: '體積 V', xUnit: 'L', yLabel: '壓力 p', yUnit: 'kPa',
            };
        }
        const A = panel.axis === 'C' ? AXIS_C : AXIS_K;
        const isV = pr.mode === 'charles';
        const yMax = isV ? V_MAX
                         : niceStep(kPa(Kit.idealP(N_FIXED, T_MAX, pr.V)), 5);
        return {
            xMin: A.min, xMax: A.max, xTicks: A.ticks, yMin: 0,
            yMax, yTicks: isV ? 4 : 5,
            xLabel: '溫度 T', xUnit: panel.axis === 'C' ? '°C' : 'K',
            yLabel: isV ? '體積 V' : '壓力 p', yUnit: isV ? 'L' : 'kPa',
        };
    }

    /** 這條理論線在溫度 T 時的縱座標（等壓是 V、等容是 p）。 */
    function theoryY(pr, T_K) {
        if (pr.mode === 'charles') return N_FIXED * Kit.R_GAS * T_K / P_CHARLES * 1000;
        return kPa(Kit.idealP(N_FIXED, T_K, pr.V));
    }

    // ======================================================================
    // 畫面
    // ======================================================================
    function drawScene(p, view, t, panel, pr) {
        const M = MODE_INFO[pr.mode];

        // --- 頂部標題：這個模式固定了什麼 ---
        ThermalScene.worldBadge(p, view, 450, HEAD_Y, M.hold, { size: 15, col: M.col });

        drawEquation(p, view, pr);
        drawCylinder(p, view, pr, t);
        drawGraph(p, view, pr, panel);
    }

    /**
     * 右邊那塊：把現在的數字填進 pV = nRT 裡。
     * 最後一行是這一頁的結論——`pV/(nT)` 永遠是同一個數。
     */
    function drawEquation(p, view, pr) {
        const x = EQ.x, y0 = EQ.y0, dy = EQ.dy;
        ThermalScene.worldBadge(p, view, x, y0,
            'p  ×  V  =  n  ×  R  ×  T', { size: 16, col: [15, 23, 42], align: 'left' });
        ThermalScene.worldBadge(p, view, x, y0 + dy,
            `${kPa(pr.p).toFixed(0)} kPa × ${pr.V_L.toFixed(2)} L`
            + ` = ${pr.n.toFixed(2)} mol × R × ${pr.T.toFixed(0)} K`,
            { size: 13, col: [71, 85, 105], align: 'left' });
        ThermalScene.worldBadge(p, view, x, y0 + 2 * dy,
            `pV/(nT) = ${pr.inv.toFixed(3)} J/(mol·K)　不管哪一種氣體、怎麼拉，都是這個數`,
            { size: 13, col: [22, 163, 74], align: 'left' });
        ThermalScene.worldBadge(p, view, x, y0 + 3 * dy,
            `${pr.gasName}　M = ${(pr.M * 1000).toFixed(1)} g/mol`
            + `　方均根速率 ${pr.cRms.toFixed(0)} m/s`,
            { size: 12, col: [100, 116, 139], align: 'left' });
    }

    function drawCylinder(p, view, pr, t) {
        // 畫汽缸（活塞位置＝體積）。分子被關在哪個盒子裡是由 onFrame 用
        // ThermalScene.cylinderBox 算的——同一條式子，所以必然一致。
        ThermalScene.drawCylinder(p, view, CYL.x, CYL.yBottom, CYL.w, CYL.h,
                                  pr.V_L / V_MAX,
                                  { T: pr.T, Tmin: T_MIN, Tmax: T_MAX });

        // 缸壁被撞得兇不兇：用滑動視窗裡的撞擊數上色。這是「壓力是撞出來的」
        // 唯一看得見的地方，所以它必須跟著分子跑，不能是一條獨立的動畫。
        const glow = clamp(G.shownRate / 260, 0, 1);
        if (glow > 0.01) {
            const px = view.toScreenX(CYL.x - CYL.w / 2);
            const py = view.toScreenY(CYL.yBottom - CYL.h * clamp(pr.V_L / V_MAX, 0.04, 1));
            const pw = view.len(CYL.w);
            const ph = view.toScreenY(CYL.yBottom) - py;
            const W = view.len(11);
            p.noStroke();
            p.fill(HIT_COL[0], HIT_COL[1], HIT_COL[2], 30 + 90 * glow);
            p.rect(px, py, W, ph);
            p.rect(px + pw - W, py, W, ph);
        }

        drawMolecules(p, view, t);

        ThermalScene.worldBadge(p, view, HIT_BADGE.x, HIT_BADGE.y,
            `每秒撞牆 ${G.shownRate.toFixed(0)} 次`,
            { size: 12, col: HIT_COL });
    }

    function drawMolecules(p, view, t) {
        // 撞擊閃光：一圈往外的環，0.6 秒內淡掉
        p.noFill();
        for (const h of G.hits) {
            const u = h.age / HIT_TAU;
            if (u >= 1) continue;
            p.stroke(HIT_COL[0], HIT_COL[1], HIT_COL[2], 200 * (1 - u));
            p.strokeWeight(view.len(1.6, 1));
            const r = view.len(3 + 11 * u);
            p.ellipse(view.toScreenX(h.x), view.toScreenY(h.y), r * 2, r * 2);
        }

        p.noStroke();
        p.fill(GAS_COL[0], GAS_COL[1], GAS_COL[2]);
        const R = view.len(MOL_R, 2);
        for (const m of G.mol) {
            p.ellipse(view.toScreenX(m.x), view.toScreenY(m.y), R * 2, R * 2);
        }
    }

    function drawGraph(p, view, pr, panel) {
        const A = axesOf(pr, panel);
        const mode = pr.mode;
        const lines = [];
        let series = [], marker = null;

        if (mode === 'boyle') {
            // 現在這條等溫線：p = nRT/V
            const pts = [];
            for (let i = 0; i <= 90; i++) {
                const V_L = A.xMin + (A.xMax - A.xMin) * i / 90;
                if (V_L < V_MIN * 0.5) continue;
                pts.push({ x: V_L, y: kPa(Kit.idealP(N_FIXED, pr.T, V_L / 1000)) });
            }
            series = [{ pts, col: [203, 213, 225], r: 0, join: true },
                      { pts: G.pts, col: HOT_COL, r: 3.5, join: true }];
            marker = plotPoint(pr, panel);
        } else {
            // 直線往回延長會穿過原點。資料範圍（200–600 K）畫實線，
            // 往回延到 0 K 的那一段畫虛線——那是**外推**，不是量到的。
            const xr = A.xMax, x0 = panel.axis === 'C' ? -273.15 : 0;
            const TintoK = x => (panel.axis === 'C' ? x + 273.15 : x);
            const yAt = x => theoryY(pr, TintoK(x));
            lines.push({ from: { x: x0, y: 0 }, to: { x: plotX(pr, panel, T_MIN), y: yAt(plotX(pr, panel, T_MIN)) },
                         col: [203, 213, 225], dash: true });
            lines.push({ from: { x: plotX(pr, panel, T_MIN), y: yAt(plotX(pr, panel, T_MIN)) },
                         to: { x: xr, y: yAt(xr) }, col: [203, 213, 225] });
            if (panel.axis === 'C') {
                lines.push({ from: { x: -273.15, y: A.yMin }, to: { x: -273.15, y: A.yMax },
                             col: [148, 163, 184], dash: true });
            }
            series = [{ pts: G.pts, col: HOT_COL, r: 3.5, join: true }];
            marker = plotPoint(pr, panel);
        }

        ThermalScene.drawGraph(p, view, {
            x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
            xMin: A.xMin, xMax: A.xMax, yMin: A.yMin, yMax: A.yMax,
            xTicks: A.xTicks, yTicks: A.yTicks,
            xLabel: A.xLabel, xUnit: A.xUnit, yLabel: A.yLabel, yUnit: A.yUnit,
            title: `${MODE_INFO[mode].name}：${A.yLabel}–${A.xLabel} 圖`,
            lines, series, marker,
        });

        // ⚠️ 絕對零度的標籤**不能**交給 drawGraph 的 lines[].label：那是在
        //    裁切區裡畫的，標籤會被左邊界切掉一半。這裡在圖畫完之後自己畫，
        //    不受裁切，位置也自己挑。
        if (mode !== 'boyle' && panel.axis === 'C') {
            const xa = plotX(pr, panel, 0);      // 0 K 就是 −273.15 °C
            const px = view.toScreenX(GRAPH.x)
                     + view.len((xa - A.xMin) / (A.xMax - A.xMin) * GRAPH.w);
            p.noStroke();
            p.fill(148, 163, 184);
            p.textSize(view.len(11, 7));
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('← 絕對零度 −273.15 °C', px + view.len(5), view.toScreenY(GRAPH.y) - view.len(2));
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    let panelRef = null;

    ThermalScene.run({
        // 三條定律並排會超出面板寬度，而且 KaTeX 不會自己縮——用 aligned
        // 疊成三行。（`\qquad` 並排的症狀只是「後面那條被切掉」。）
        formula: '\\begin{aligned}'
               + 'pV &= nRT \\\\[2pt]'
               + 'p &\\propto \\tfrac{1}{V}\\ (T\\text{ 固定}) \\\\[2pt]'
               + 'V &\\propto T,\\;\\; p \\propto T'
               + '\\end{aligned}',
        formulaFallback: 'pV = nRT　　p ∝ 1/V　　V ∝ T',

        controls: {
            selects: [
                { key: 'mode', label: '固定哪一個量', def: 'boyle',
                  options: [
                      { v: 'boyle', t: '固定 T（等溫・波以耳）' },
                      { v: 'charles', t: '固定 p（等壓・查理）' },
                      { v: 'pressure', t: '固定 V（等容・壓力定律）' },
                  ] },
                { key: 'gas', label: '氣體', def: 'air',
                  options: [
                      { v: 'air', t: '空氣（29.0）' },
                      { v: 'helium', t: '氦氣（4.0）' },
                      { v: 'argon', t: '氬氣（40.0）' },
                      { v: 'co2', t: '二氧化碳（44.0）' },
                  ] },
                // live: true → 換橫軸刻度**不會**清掉量測點。切換攝氏／克耳文
                // 換的是看法，不是實驗條件——同一筆資料只是換了一把尺。
                { key: 'axis', label: '橫軸刻度', def: 'K', live: true,
                  options: [{ v: 'K', t: '克耳文 K' }, { v: 'C', t: '攝氏 °C' }] },
            ],
            sliders: [
                { key: 'T', label: '溫度 T', def: T_DEF,
                  min: T_MIN, max: T_MAX, step: 5, unit: 'K', dec: 0 },
                { key: 'V', label: '體積 V', def: V_DEF,
                  min: V_MIN, max: V_MAX, step: 0.1, unit: 'L', dec: 1 },
            ],
        },

        cards: [
            { label: '壓力 p', id: 'cardP', unit: 'kPa', highlight: true },
            { label: '體積 V', id: 'cardV', unit: 'L', highlight: true },
            { label: '溫度 T', id: 'cardT', unit: 'K' },
            { label: 'pV/(nT)', id: 'cardInv', unit: 'J/(mol·K)' },
            { label: '方均根速率 c', id: 'cardC', unit: 'm/s' },
            // 這一張是「氣體種類不影響」的證據：換氣體它不動，只有 c 會動。
            { label: '平均動能 3/2·kT', id: 'cardKE', unit: '×10⁻²¹ J' },
            { label: '莫耳數 n', id: 'cardN', unit: 'mol' },
        ],

        model(t, panel) {
            panelRef = panel;
            return stateOf(panel);
        },

        onFrame(t, panel) {
            // ⚠️ 拉滑桿這種「讓面板反映狀態」的事要放在 dt 的提早返回**之前**。
            //    放在後面的話，只要這一幀的 dt 是 0（時間沒前進），面板就不會
            //    被修正——而 dt 剛好是 0 的情況一點都不罕見：暫停後恢復、
            //    headless 驅動器餵了重複的時間戳。症狀是等壓模式的 V 滑桿
            //    停在學生拉到的位置，圖和汽缸卻用另一個體積。
            snapV(panel);

            const dt = clamp(t - G.lastSim, 0, 0.1);
            G.lastSim = t;
            if (dt <= 0) return;
            const pr = stateOf(panel);

            // 分子：盒子由**狀態**決定，不是由上一幀畫了什麼決定。
            // 溫度變了就重新縮放速度。條數永遠不變——加熱不會生出分子。
            G.box = gasBox(pr.V_L);
            if (!G.mol.length) seedGas(G.box, pr.T);
            else if (Math.abs(G.seeded.T - pr.T) > 0.5) retuneGas(pr.T);

            stepGas(G.box, dt);

            // 撞擊閃光老化，順便算出滑動視窗裡的碰撞率
            let live = 0;
            for (const h of G.hits) { h.age += dt; if (h.age < HIT_TAU) live++; }
            G.hits = G.hits.filter(h => h.age < HIT_TAU);
            // 指數平滑：直接印 live/τ 會在每格之間跳得很兇，讀不出趨勢。
            const inst = live / HIT_TAU;
            G.shownRate += (inst - G.shownRate) * Math.min(1, dt / 0.25);
        },

        values(t, panel, pr) {
            return {
                cardP: kPa(pr.p).toFixed(0),
                cardV: pr.V_L.toFixed(2),
                cardT: pr.T.toFixed(0),
                cardInv: pr.inv.toFixed(3),
                cardC: pr.cRms.toFixed(0),
                cardKE: (pr.ke * 1e21).toFixed(2),
                cardN: pr.n.toFixed(2),
            };
        },

        onChange(reason) {
            if (!panelRef) return;
            if (reason === 'pause') return;
            if (reason === 'reset') { clearPoints(); seedGas(G.box || gasBox(V_DEF), T_DEF); return; }

            const pr = stateOf(panelRef);
            // 「被固定的那個量」變了＝換了另一條等溫線／等容線，點要清掉。
            // 這是物理上對的，不是為了讓圖好看：等溫線是**一個溫度**的曲線。
            const key = heldKey(pr);
            if (G.last !== key) { clearPoints(); G.last = key; }
            recordPoint(pr, panelRef);
            snapV(panelRef);
        },

        onReset() {
            clearPoints();
            G.lastSim = 0;
            G.shownRate = 0;
            G.box = gasBox(V_DEF);
            seedGas(G.box, T_DEF);
        },

        titleText(t, panel, pr) {
            return `${MODE_INFO[pr.mode].name}　${pr.gasName}`
                 + `　n = ${pr.n.toFixed(2)} mol`
                 + `　p = ${kPa(pr.p).toFixed(0)} kPa`
                 + `　T = ${pr.T.toFixed(0)} K（${pr.TC.toFixed(0)} °C）`;
        },

        draw(p, view, t, panel, pr) {
            drawScene(p, view, t, panel, pr);
        },
    });

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    // ⚠️ 出口要掛在 `window.__page` 上：verify-thermal.js 用
    //    `loadModule(file, 'window.__page', {...})` 把這一頁抓進 Node，
    //    讀的就是這個名字（`return` 出來的是 IIFE 自己，讀不到）。
    //    `window` 是驗證腳本餵進來的空物件，所以這裡碰不到真的 DOM。
    if (typeof window !== 'undefined') {
        window.__page = {
            CYL, GRAPH, EQ, AXIS_K, AXIS_C, HEAD_Y, HIT_BADGE,
            N_FIXED, P_CHARLES, T_MIN, T_MAX, V_MIN, V_MAX, V_DEF, T_DEF,
            N_MOL, MOL_R, VIS_V0, HIT_TAU, MODE_INFO, GAS_COL, HIT_COL,
            stateOf, axesOf, theoryY, plotPoint, plotX, heldKey,
            niceStep, gasBox, visSpeed, rng, clamp,
            kPa,
            G,
        };
    }
})();
