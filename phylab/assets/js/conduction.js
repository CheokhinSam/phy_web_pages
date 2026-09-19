/**
 * 🔥 熱傳導
 *
 * 這一頁做一件事：把**一根棒子**上的溫度分布同時用四種方式顯示，而四者
 * 必須一致。
 *
 *   ① 溫度色帶      棒子上每一點的顏色＝它的溫度
 *   ② 分子的抖動    同一根棒子上每一顆分子的抖動幅度＝√(那個位置的溫度)
 *   ③ T(x) 圖       同一份溫度陣列畫出來的剖面
 *   ④ 數字卡片      k、P、q、R、中間溫度
 *
 * 四者全部來自**同一個 Float64Array**。色帶是它、粒子是它、圖是它、卡片
 * 也是它——不是四份各自算的程式。這是熱學版的「電路是一份資料」。
 *
 * ==========================================================================
 * ⚠️ 為什麼這一頁要「時間壓縮」，而且壓縮倍率不一樣
 * ==========================================================================
 * 銅的熱擴散率 α = k/(ρc) = 1.16×10⁻⁴ m²/s，木材是 1.47×10⁻⁷ ——**差了
 * 790 倍**。同一根 4 公分的棒子，銅 5.6 秒就到穩態，木材要 1.2 小時。
 *
 * 任何「固定的時間流速」都只有兩種下場：銅在幾毫秒內就到位（看不到過程），
 * 或者木材永遠停在初始的那條平線（看起來像壞掉）。
 *
 * 解法是讓每一格畫面都走「同一個 τ 分數」（τ 是擴散時間，見
 * ThermalKit.conductionDriver）。於是六種材質在**同樣的畫面時間**裡走完
 * 各自的暫態，而卡片上的「已過時間」與「時間壓縮」把真正的差別印出來：
 *
 *   銅    畫面 6 秒 ≈ 真實 5.6 秒      ×0.94（幾乎是真實速度）
 *   木材  畫面 6 秒 ≈ 真實 1.2 小時    ×736
 *
 * 所以「木材隔熱」不是用嘴講的，是同一段畫面時間裡它只過了 0.008 秒。
 *
 * ==========================================================================
 * ⚠️ 舊版這一頁的問題（重寫的理由）
 * ==========================================================================
 * 舊版是原生 Canvas、沒有邏輯世界、沒有 p5、沒有 KaTeX，而且粒子視圖與
 * 溫度分布是**兩份各自模擬的東西**——粒子只知道自己「大概幾度」，棒子的
 * 溫度分布是另一條程式算的。兩個動畫可以各自跑得很順，但它們講的是兩根
 * 不同的棒子。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 lab-scene.js）
    // ======================================================================
    const ROD = { x: 150, y: 190, w: 600, h: 110 };
    const RES_L = { x: 62, y: 168, w: 84, h: 154 };      // 左端的水浴／熱源
    const RES_R = { x: 754, y: 168, w: 84, h: 154 };     // 右端
    const LEGEND = { x: 180, y: 58, w: 540, h: 16 };
    const GRAPH = { x: 150, y: 520, w: 600, h: 230 };

    // ======================================================================
    // 物理：一根棒子
    // ======================================================================
    const N = 64;                 // 節點數（數值方法的事，畫面上看不到）
    const L_ROD = 0.04;           // 棒長 4 cm
    const A_ROD = 1e-4;           // 截面積 1 cm²
    const WALL_SECONDS = 6;       // 畫面 6 秒走完一次暫態（見檔頭）

    const MAT_ORDER = ['copper', 'aluminium', 'iron', 'steel', 'glass', 'wood'];

    /** 這一幀的材料性質。滑桿一動就重算，其他地方一律讀這一個。 */
    function propsFor(panel) {
        const m = ThermalKit.MATERIALS[panel.mat];
        const alpha = ThermalKit.diffusivity(m.k, m.rho, m.c);
        const drv = ThermalKit.conductionDriver({ alpha, L: L_ROD, n: N, frames: WALL_SECONDS * 60 });
        return { mat: m, alpha, drv };
    }

    // ======================================================================
    // 狀態
    // ======================================================================
    // ⚠️ 這兩個一定要在 ThermalScene.run() **之前**宣告。run() 會同步呼叫
    //    refresh() → values()，也就是在 IIFE 還沒跑完的時候就讀它們；
    //    宣告寫在下面的話這裡會直接 TDZ ReferenceError。
    //    （lab-scene.js 的 buildPanel 就是為了同一個理由才不在建構時回呼。）
    // ⚠️ 初始溫度要填「預設的 T₂」而不是 0：onReset() 只在**參數變動**時被
    //    呼叫，載入頁面時不會跑，所以這裡填什麼就是學生第一眼看到的東西。
    //    填 0 的話卡片寫 T₂ = 20 °C、畫面上一整根棒子卻是 0 °C 的顏色。
    let T = new Float64Array(N).fill(20);  // 節點溫度（°C）
    let physTime = 0;                      // 已過的**真實**時間（秒）
    let lastSim = 0;                       // 上一幀的畫面時間，用來算 dt

    /** 面板目前的兩端溫度。全部集中在這裡讀，免得散在各處。 */
    const T1 = panel => panel.t1;
    const T2 = panel => panel.t2;

    // ⚠️ `onReset(reason)` **拿不到 panel**——lab-scene 只把 reason 傳給它
    //    （見 lab-scene.js 的 onChange），但它需要知道兩端溫度才能決定初始
    //    溫度。panel 物件本身是穩定的，而且 run() 在回傳之前就同步跑過一次
    //    refresh() → model()，所以任何一次使用者互動之前這裡一定有值。
    //    （第一版直接在 onReset 裡寫 panel.t1，載入頁面就 ReferenceError，
    //      而且是在**按下第一顆滑桿之後**才炸。）
    let panelRef = null;

    // ======================================================================
    // 分子
    // ======================================================================
    // 分子住在棒子裡面，晶格點固定（固體），抖動幅度由**它自己那個位置的
    // 溫度**決定——所以熱端的分子抖得凶、冷端的安靜，中間是連續變化的。
    // 這正是「熱傳導是鄰居互相撞擊、一層一層傳下去」那句話的畫面。
    const MOL = ThermalScene.moleculeBox({
        x0: ROD.x + 7, y0: ROD.y + 7,
        x1: ROD.x + ROD.w - 7, y1: ROD.y + ROD.h - 7,
        cols: 30, rows: 5,
    });

    /** 這個世界座標的 x 上，棒子有幾度。分子要用它決定自己抖多快。 */
    function tempAt(x) {
        const f = (x - ROD.x) / ROD.w;
        const i = Math.max(0, Math.min(N - 1, f * (N - 1)));
        const i0 = Math.floor(i), i1 = Math.min(N - 1, i0 + 1);
        return T[i0] + (T[i1] - T[i0]) * (i - i0);
    }

    /** 抖動速率 ∝ √(T/K)。**開氏溫度的平方根**，不是溫度本身。 */
    const MOL_BASE = 34;                                   // 世界單位／秒 @ 300 K
    const molSpeed = m => MOL_BASE * Math.sqrt(Math.max(1, ThermalKit.toK(tempAt(m.x))) / 300);

    // ======================================================================
    // 時間格式：六種材質差了三個數量級，固定用秒會印出 4409.5 這種數字
    // ======================================================================
    function fmtDur(s) {
        if (!(s > 0)) return '0 秒';
        if (s < 90) return s.toFixed(1) + ' 秒';
        if (s < 5400) return (s / 60).toFixed(1) + ' 分';
        if (s < 172800) return (s / 3600).toFixed(1) + ' 小時';
        return (s / 86400).toFixed(1) + ' 天';
    }

    // ======================================================================
    // 對外
    // ======================================================================
    ThermalScene.run({
        formula: '\\begin{aligned} q &= -k\\,\\frac{dT}{dx} \\\\[2pt] '
               + 'P &= \\frac{kA\\,(T_1 - T_2)}{L} \\end{aligned}',
        formulaFallback: 'q = −k·dT/dx　　P = kA(T₁ − T₂)/L',

        controls: {
            selects: [
                { key: 'mat', label: '材質', def: 'copper', options: MAT_ORDER.map(k => ({
                      v: k, t: `${ThermalKit.MATERIALS[k].name}　k = ${ThermalKit.MATERIALS[k].k} W/(m·K)` })) },
                { key: 'show', label: '顯示', def: 'both', live: true, options: [
                    { v: 'both',  t: '溫度色帶 ＋ 分子' },
                    { v: 'band',  t: '只看溫度色帶' },
                    { v: 'mol',   t: '只看分子' },
                ] },
            ],
            sliders: [
                { key: 't1', label: '左端溫度 T₁', def: 200, min: 0, max: 400, step: 10, unit: '°C', dec: 0 },
                { key: 't2', label: '右端溫度 T₂', def: 20, min: 0, max: 400, step: 10, unit: '°C', dec: 0 },
            ],
        },

        cards: [
            { label: '熱導率 k', id: 'cardK', unit: 'W/(m·K)', highlight: true },
            { label: '熱流功率 P', id: 'cardP', unit: 'W', highlight: true },
            { label: '熱流密度 q = P/A', id: 'cardQ', unit: 'W/m²' },
            { label: '熱阻 L/(kA)', id: 'cardR', unit: 'K/W' },
            { label: '中間溫度 T(中)', id: 'cardMid', unit: '°C' },
            { label: '已過時間（真實）', id: 'cardClock', unit: '' },
            { label: '達穩態所需時間', id: 'cardTau', unit: '' },
        ],

        model(t, panel) {
            panelRef = panel;
            const pr = propsFor(panel);
            const T1v = T1(panel), T2v = T2(panel);
            const dT = T1v - T2v;
            const P = ThermalKit.heatCurrent(pr.mat.k, A_ROD, dT, L_ROD);
            return { pr, T1v, T2v, dT, P };
        },

        /** 每一幀把溫度場往前推進。**推進量是「τ 的分數」，不是秒數。** */
        onFrame(t, panel) {
            const dt = Math.min(0.1, Math.max(0, t - lastSim));
            lastSim = t;
            const pr = propsFor(panel);
            const target = Math.min(t / WALL_SECONDS, 1) * pr.drv.tau;

            // 一次畫面最多補 240 步（視窗被切走再回來時 dt 會被夾住，
            // 但保險還是要上，不然一個卡頓就是幾萬次迴圈）
            let guard = 0;
            while (physTime < target && guard < 240) {
                for (let s = 0; s < pr.drv.substeps; s++) {
                    T = ThermalKit.conductionStep(T, {
                        n: N, dx: pr.drv.dx, dt: pr.drv.dtStep, alpha: pr.alpha,
                        left: T1(panel), right: T2(panel),
                    });
                }
                physTime += pr.drv.dtFrame;
                guard++;
            }

            if (panel.show !== 'band') {
                MOL.step({
                    dt, speed: molSpeed, tether: 1, damp: 9, r: 4.5,
                    box: {
                        x0: ROD.x + 7, y0: ROD.y + 7,
                        x1: ROD.x + ROD.w - 7, y1: ROD.y + ROD.h - 7,
                    },
                });
            }
        },

        values(t, panel, sol) {
            const { pr, T1v, T2v, dT, P } = sol;
            const q = P / A_ROD;
            const R = ThermalKit.thermalResistance(L_ROD, pr.mat.k, A_ROD);
            const mid = T[Math.floor(N / 2)];
            return {
                cardK: pr.mat.k >= 10 ? pr.mat.k.toFixed(0) : pr.mat.k.toFixed(2),
                cardP: Math.abs(P) >= 1 ? P.toFixed(1) : P.toExponential(2),
                cardQ: Math.abs(q) >= 1e5 ? q.toExponential(2) : q.toFixed(0),
                cardR: R >= 100 ? R.toExponential(2) : R.toFixed(2),
                cardMid: mid.toFixed(1),
                cardClock: fmtDur(physTime),
                cardTau: fmtDur(pr.drv.tau),
            };
        },

        titleText(t, panel, sol) {
            const { pr, T1v, T2v, P } = sol;
            return `🔥 ${pr.mat.name}棒　T₁ = ${T1v.toFixed(0)} °C　T₂ = ${T2v.toFixed(0)} °C`
                 + `　P = ${Math.abs(P) >= 1 ? P.toFixed(1) : P.toExponential(2)} W`
                 + `（${P >= 0 ? '→' : '←'}）`
                 + `　畫面 ${WALL_SECONDS} 秒 ≈ 真實 ${fmtDur(physTime)}`;
        },

        onReset() {
            // 兩端溫度的**低**的那一個當初始溫度，另一端在 t = 0 跳上去。
            // 這樣暫態一定從一條平線開始，也一定是往上升——不會出現「初始
            // 就比熱端熱」那種會反過來先降溫的怪起始狀態。
            const lo = Math.min(panelRef.t1, panelRef.t2);
            T = new Float64Array(N).fill(lo);
            physTime = 0;
            lastSim = 0;
        },

        draw(p, view, t, panel, sol) {
            const { pr, T1v, T2v, dT, P } = sol;
            const diag = ThermalKit.check({ alpha: pr.alpha });

            const tmin = Math.min(T1v, T2v), tmax = Math.max(T1v, T2v);
            drawScene(p, view, panel, sol, tmin, tmax);

            if (!diag.ok) {
                ThermalScene.worldBadge(p, view, 450, 420, '⚠ ' + diag.errors[0],
                                        { size: 18, col: [220, 38, 38] });
            }

            // 圖：T(x)。x 軸的世界座標是公分，不是世界單位——這一頁的
            // 橫軸是一個**物理量**，學生要讀的是「4 公分」不是「600 像素」。
            const Lcm = L_ROD * 100;
            const pts = [];
            for (let i = 0; i < N; i++) pts.push({ x: (i / (N - 1)) * Lcm, y: T[i] });
            // yTicks = 5（不是 4）：穩態最高就是 200 °C，取樣成 5 格才湊得出
            // 250 這個上限；用 4 格的話 220/4 = 55 掉進 niceMax 的 5→10 縫隙，
            // 上限會被推到 400，曲線只佔下半張圖。
            const yMax = ThermalScene.niceMax(Math.max(tmax, 1) * 1.1, 5);

            ThermalScene.drawGraph(p, view, {
                x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
                xMin: 0, xMax: Lcm, yMin: 0, yMax,
                xTicks: 4, yTicks: 5,
                xLabel: '沿棒子的位置 x', xUnit: 'cm',
                yLabel: '溫度 T', yUnit: '°C',
                plate: true,
                title: `棒子上的溫度分布（${pr.mat.name}）`,
                // 穩態是**一條直線**，兩端固定時它與 k 無關——所以這條參考線
                // 對六種材質都一樣，學生才看得出「差別在多久走到它」。
                lines: [{
                    from: { x: 0, y: T1v }, to: { x: Lcm, y: T2v },
                    col: [148, 163, 184], dash: true, label: '穩態（直線）',
                }],
                series: [{ pts, col: [37, 99, 235], r: 2.4, join: true }],
                marker: { x: Lcm / 2, y: Math.min(T[Math.floor(N / 2)], yMax), col: [220, 38, 38] },
            });

            // 熱流方向與大小。flux 用 P 對「銅、400 °C 溫差」的比值歸一化——
            // 那是這一頁能出現的最大功率，所以箭頭的滿格是有意義的。
            const PMAX = ThermalKit.heatCurrent(
                ThermalKit.MATERIALS.copper.k, A_ROD, 400, L_ROD);
            const flux = Math.min(1, Math.abs(P) / PMAX);
            ThermalScene.heatFlowArrows(p, view, ROD.x + 40, ROD.y + ROD.h + 34,
                                        ROD.x + ROD.w - 40, ROD.y + ROD.h + 34, flux,
                                        { dir: P >= 0 ? 'right' : 'left' });
            ThermalScene.worldBadge(p, view, ROD.x + ROD.w / 2, ROD.y + ROD.h + 78,
                `熱流 P = ${Math.abs(P) >= 1 ? P.toFixed(1) : P.toExponential(2)} W`
                + `　方向：${P >= 0 ? '左 → 右' : '右 → 左'}`, { size: 14, col: [234, 88, 12] });
        },
    });

    // ======================================================================
    // 畫面（吃同一份 T）
    // ======================================================================
    function drawScene(p, view, panel, sol, tmin, tmax) {
        const { pr, T1v, T2v } = sol;

        // --- 兩端的水浴 ---
        for (const [r, temp, name] of [[RES_L, T1v, 'T₁'], [RES_R, T2v, 'T₂']]) {
            const c = ThermalScene.tempColor(temp, tmin, tmax);
            p.noStroke();
            p.fill(c[0], c[1], c[2]);
            p.rect(view.toScreenX(r.x), view.toScreenY(r.y),
                   ThermalScene.L(view, r.w), ThermalScene.L(view, r.h));
            ThermalScene.strokeOn(p, [30, 41, 59], ThermalScene.L(view, 1.8, 1));
            p.noFill();
            p.rect(view.toScreenX(r.x), view.toScreenY(r.y),
                   ThermalScene.L(view, r.w), ThermalScene.L(view, r.h));
            ThermalScene.worldBadge(p, view, r.x + r.w / 2, r.y - ThermalScene.L(view, 26, 14),
                `${name} = ${temp.toFixed(0)} °C`, { size: 14, col: [30, 64, 175] });
        }

        // --- 棒子的溫度色帶 ---
        if (panel.show !== 'mol') {
            ThermalScene.drawTempBand(p, view, ROD.x, ROD.y, ROD.w, ROD.h, T, tmin, tmax);
        } else {
            p.noStroke();
            p.fill(248, 250, 252);
            p.rect(view.toScreenX(ROD.x), view.toScreenY(ROD.y),
                   ThermalScene.L(view, ROD.w), ThermalScene.L(view, ROD.h));
            ThermalScene.strokeOn(p, [30, 41, 59], ThermalScene.L(view, 1.5, 1));
            p.noFill();
            p.rect(view.toScreenX(ROD.x), view.toScreenY(ROD.y),
                   ThermalScene.L(view, ROD.w), ThermalScene.L(view, ROD.h));
        }

        // --- 分子 ---
        //
        // ⚠️ 兩種模式的上色方式**刻意不同**，不是偷懶：
        //    色帶在上面時，分子用**白色填心、深色描邊**——因為「這裡幾度」
        //    已經由它腳下那一格色帶回答了，而色階上任何一個顏色畫在它自己
        //    的底色上都是看不見的（同色疊同色）。
        //    只看分子時沒有色帶，顏色就必須由分子自己帶。抖動幅度在兩種
        //    模式裡都一樣是 √T，所以「熱的地方抖得凶」永遠看得見。
        if (panel.show !== 'band') {
            const R = ThermalScene.L(view, 4.5);
            const molOnly = panel.show === 'mol';
            for (const m of MOL.list) {
                const c = ThermalScene.tempColor(tempAt(m.x), tmin, tmax);
                const sx = view.toScreenX(m.x), sy = view.toScreenY(m.y);
                ThermalScene.strokeOn(p, [30, 41, 59], molOnly ? 1 : ThermalScene.L(view, 1.6, 1));
                p.fill(molOnly ? c[0] : 255, molOnly ? c[1] : 255, molOnly ? c[2] : 255, 235);
                p.ellipse(sx, sy, R * 2, R * 2);
            }
        }

        // --- 棒子的標註 ---
        ThermalScene.worldBadge(p, view, ROD.x + ROD.w / 2, ROD.y - 26,
            `${pr.mat.name}棒　L = 4.0 cm　A = 1.0 cm²`, { size: 15, col: [30, 41, 59] });

        // --- 溫度色階圖例 ---
        ThermalScene.tempScale(p, view, LEGEND.x, LEGEND.y, LEGEND.w, LEGEND.h, tmin, tmax,
                               { unit: '°C' });
        ThermalScene.worldBadge(p, view, LEGEND.x + LEGEND.w / 2, LEGEND.y - 20,
            '顏色 ＝ 溫度（整頁只有這一個色階）', { size: 13, col: [100, 116, 139] });
    }

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            N, L_ROD, A_ROD, WALL_SECONDS, ROD, GRAPH,
            getT: () => Array.from(T),
            tempAt,
            physTime: () => physTime,
            propsFor,
        };
    }
})();
