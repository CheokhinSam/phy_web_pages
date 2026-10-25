/**
 * 🧊 比熱容量與潛熱
 *
 * 把一個物質從初始溫度一路加熱到最後，畫出它的**加熱曲線**（溫度對能量）。
 * 三個要推翻的直覺：
 *
 *   ① 「一直加熱溫度就會一直上升」。錯——熔化與沸騰時能量一直進，
 *      溫度**不動**。曲線上有兩段水平線，那不是畫錯了。
 *   ② 「沸騰那一段跟其他段差不多長」。錯得離譜——對水來說，把 100 g
 *      的水從 100 °C 全部燒成蒸氣要 226 kJ，是把它從 0 °C 加熱到
 *      100 °C（41.9 kJ）的 **5.4 倍**，佔整條曲線的 **73%**。
 *      右邊那本「能量帳本」就是為了讓這件事一眼看出來而存在的。
 *   ③ 「比熱容量只是課本上的一個數字」。銅的比熱是水的 1/11，
 *      同樣的能量讓銅升溫 11 倍——換物質下拉就會看到曲線整個被壓扁。
 *
 * ⚠️ 這一頁的圖**不是累積出來的**，是先用 `ThermalKit.heatingSegments()`
 *    把整條曲線算出來，再讓一個紅點沿著它走。和熱輻射那一頁相反
 *    （那邊是一次一步積分出來的）。這樣做的理由是這一頁的教學重點是
 *    **形狀**——兩段水平線的相對長度——而那要整條曲線都看到才看得出來。
 *    曲線的「已走過」部分用實色畫，未來的部分用淡灰畫，兩者都在圖上。
 *
 * ⚠️ 分子動畫（`moleculeField`）是**純函式**：只吃「已熔化比例、已汽化
 *    比例、加熱進度、時間」，不碰任何模組狀態。所以 verify-thermal.js
 *    可以直接斷言「固體只在小範圍內振動、氣體全部在液面之上」——
 *    這一頁的視覺宣稱因此是可以被測的，不是只有截圖能看。
 */

var HeatCapacity = (function () {
    'use strict';

    const Kit = ThermalKit;

    // ======================================================================
    // 版面（世界座標 900×900）
    // ======================================================================
    const BEAKER = { x0: 150, x1: 372, top: 110, bot: 440 };

    // 燒杯內部：分子的活動範圍。x 讓開右邊的溫度計，z 是玻璃杯的內緣。
    const MOL_X0 = 172, MOL_X1 = 300;
    const Z_TOP = 130, Z_BOT = 424;
    const H_INT = Z_BOT - Z_TOP;        // 內部高度

    // ⚠️ 三個相態**共用整個燒杯**，用高度分配，而不是各自佔一塊固定的區域。
    //    固定區域的寫法在極端狀態下會露餡：全部是蒸氣的時候下半杯空著，
    //    看起來像畫壞了（氣體應該填滿容器）。
    //    現在：固體是沉在杯底的一塊晶格，流體（液體＋氣體）佔它上面的全部
    //    空間，兩者再按汽化比例上下分。任何比例都會把燒杯填滿，而且
    //    **各相的高度本身就是組成比例**。
    const SOLID_DY = 22;                // 晶格列距（固定，所以剩下的冰不會跟著滑）
    const SOLID_ROWS = 6;               // 八分滿的冰堆共幾列
    const N_MOL = 48;                   // 燒杯裡的分子數
    const MOL_COLS = 8;                 // 固體晶格一行幾個

    const clamp01 = v => Math.max(0, Math.min(1, v));

    /**
     * 冰堆的頂端。冰塊隨熔化**從上緣**變矮，列距固定，
     * 所以剩下來的分子一直待在原地——只有最上面那幾列消失。
     */
    function pileTopZ(mf) {
        return Z_BOT - 8 - SOLID_ROWS * SOLID_DY * (1 - clamp01(mf));
    }

    /** 流體（液體＋氣體）能到達的最低高度——冰堆的頂端，或杯底。 */
    function fluidBottom(mf) {
        return Math.max(Z_TOP + 24, pileTopZ(mf));
    }

    /**
     * 液面：氣體與凝結相的分界，世界座標的高度。
     *
     * 也是分子動畫的分區依據——氣體只出現在它上面，固體與液體只出現在
     * 它下面。所以「氣體在液面之上」這句話是可測的（見 verify-thermal.js ⑦）。
     */
    function surfaceZ(mf, vf) {
        const v = clamp01(vf);
        return Z_TOP + v * (fluidBottom(mf) - Z_TOP);
    }

    const TH_X = 332, TH_BULB_Y = 418, TH_H = 290;

    const PLATE = { x0: 130, x1: 392, y: 448, h: 24 };
    // ⚠️ 加熱箭頭與它的標籤都必須**完全落在加熱板和圖之間**（472..540）。
    //    箭頭最長 28、標籤約 18 高，所以底端放在 500、標籤放在 522——
    //    再往下就會壓到圖的上緣，而症狀只是「標籤浮在圖表上」。
    const ARROW_Y = 500;                // 加熱箭頭的底端
    const P_MAX = 2000;                 // 加熱功率滑桿的上限（W）

    const LEDGER = { x: 466, right: 814, y0: 150, rowH: 56, barW: 300, barH: 15 };

    const GRAPH = { x: 150, y: 540, w: 600, h: 230 };

    // ======================================================================
    // 物理
    // ======================================================================
    // ⚠️ 每一個物質的加熱範圍都是**挑過的**，不是隨便填：要跨過它自己的
    //    相變點，而且上下限要湊成圖上整數的刻度（見 RANGES 的註解）。
    //    - 水      -20 → 130   跨熔點 0 與沸點 100（兩段水平線都有）
    //    - 銅       20 → 1220  只跨熔點 1085，**沒有沸騰段**（沸點 2562）
    //    - 鉛       20 → 400   只跨熔點 327.5
    //    - 酒精   -150 → 100   跨熔點 −114.1 與沸點 78.3
    // ⚠️ 縱軸的上限一定要**嚴格大於** Tmax。相等的話曲線的終點正好貼在圖的
    //    上緣，而 drawGraph 的游標是一個往下的 V 字形，會整個畫到框外——
    //    看起來像標記飛出了圖表。每一組的刻度間距都要是整數（理由見
    //    kJAxis 的註解）。
    const RANGES = {
        water:   { T0: -20,  Tmax: 130,  yMin: -20,  yMax: 160,  yTicks: 6 },   // step 30
        copper:  { T0: 20,   Tmax: 1220, yMin: 0,    yMax: 1250, yTicks: 5 },   // step 250
        lead:    { T0: 20,   Tmax: 400,  yMin: 0,    yMax: 500,  yTicks: 5 },   // step 100
        alcohol: { T0: -150, Tmax: 100,  yMin: -150, yMax: 150,  yTicks: 6 },   // step 50
    };

    const SUB_ORDER = ['water', 'copper', 'lead', 'alcohol'];

    const SPEEDS = [
        { v: '1',  t: '×1　真實時間' },
        { v: '5',  t: '×5　畫面 1 秒 = 5 秒' },
        { v: '15', t: '×15　畫面 1 秒 = 15 秒' },
        { v: '60', t: '×60　畫面 1 秒 = 1 分鐘' },
    ];

    const MASS = { min: 50, max: 500, def: 100, step: 10 };   // 公克
    const POWER = { min: 100, max: P_MAX, def: 800, step: 50 };  // W

    /** 相態的顏色。三個相態各一個，整頁（分子、帳本、圖）都用這一份。 */
    const PHASE_COL = {
        solid:  [37, 99, 235],
        liquid: [13, 148, 136],
        gas:    [234, 88, 12],
    };
    /** 帳本每一段的顏色。相變段（melt / boil）另外給，好和升溫段分開。 */
    const SEG_COL = {
        solid:  [37, 99, 235],
        melt:   [147, 51, 234],
        liquid: [13, 148, 136],
        boil:   [234, 88, 12],
        gas:    [190, 24, 93],
    };

    // 模組狀態
    let addQ = 0;              // 已經加進去的能量（J）
    let physTime = 0;          // 真實加熱時間（秒）
    let lastSim = 0;
    let panelRef = null;       // ⚠️ onReset(reason) 拿不到 panel，見熱傳導那一頁

    function reset(panel) {
        addQ = 0;
        physTime = 0;
        lastSim = 0;
    }

    /**
     * 能量軸的刻度：**整數**步長。
     *
     * ⚠️ 這不是潔癖。`drawGraph` 的 `trim()` 對 ≥10 的值用 `toFixed(0)`，
     *    所以刻度值是 62.5 的話會印成「63」——格線畫在 62.5、標籤寫 63，
     *    圖上多出一組對不上的**假刻度**。整數步長是唯一安全的做法。
     *    在 4 / 5 / 6 三種刻度數裡挑「曲線填得最滿」的那個。
     */
    function kJAxis(totalKJ) {
        let best = null;
        for (const ticks of [4, 5, 6]) {
            const raw = totalKJ / ticks;
            const pow = Math.pow(10, Math.floor(Math.log10(raw)));
            const n = raw / pow;                       // 1 ≤ n < 10
            const nice = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
            const step = Math.max(1, Math.round(nice));
            const max = step * ticks;
            if (max < totalKJ) continue;
            const slack = max / totalKJ;
            if (!best || slack < best.slack) best = { step, max, ticks, slack };
        }
        return best || { step: 1, max: Math.max(1, Math.ceil(totalKJ)), ticks: 4, slack: 1 };
    }

    /** 這個物質在這個範圍下的全部能量預算。 */
    function budgetFor(panel) {
        const sub = Kit.SUBSTANCES[panel.sub] || Kit.SUBSTANCES.water;
        const R = RANGES[panel.sub] || RANGES.water;
        const m = panel.mass / 1000;                   // 公克 → 公斤
        return { sub, R, m, b: Kit.heatingSegments(sub, { m, T0: R.T0, Tmax: R.Tmax }) };
    }

    /** 面板 + 目前的 addQ → 一份算好的東西，畫面與卡片都吃它。 */
    function propsFor(panel) {
        const { sub, R, m, b } = budgetFor(panel);
        const Q = Math.min(Math.max(0, addQ), b.total);
        const st = Kit.stateAt(b, Q);
        const speed = parseFloat(panel.speed) || 1;
        const P = panel.power;

        // 熔化／汽化的**質量比**（stateAt 給的是公斤，這裡換成 0..1 的比例，
        // 分子動畫要的是比例）。
        const mf = m > 0 ? st.melted / m : 0;
        const vf = m > 0 ? st.vaporised / m : 0;

        // 加熱進度：0 是起點、1 是整條曲線走完。分子振動的振幅用它。
        const heatFrac = b.total > 0 ? Q / b.total : 0;

        return {
            sub, R, m, b, Q, st, speed, P, mf, vf, heatFrac,
            kJ: kJAxis(b.total / 1000),
            totalS: P > 0 ? b.total / P : 0,           // 這個功率下要加熱幾秒
            maxSpan: b.segs.reduce((a, s) => Math.max(a, s.span), 1),
            done: Q >= b.total,
        };
    }

    // ======================================================================
    // 分子動畫（純函式）
    // ======================================================================
    /** 一個固定的偽隨機數（0..1）。同一個 i 永遠得到同一個值。 */
    function hash01(i) {
        const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        return s - Math.floor(s);
    }

    /**
     * 燒杯裡的分子。
     *
     * 三種相態的**運動方式**才是這一頁要講的：
     *   ‧ 固體（方形）：綁在晶格上，只在原地小幅度振動
     *   ‧ 液體（圓形）：可以互相滑動，但在液面以下、不會離開液體
     *   ‧ 氣體（圓形）：自由飛行，而且**全部在液面之上**
     *
     * 分子的數量按質量比分配，所以「冰塊變少、水變多」是看得出來的。
     *
     * @param {{mf:number, vf:number, heatFrac:number}} o
     * @param {number} t  畫面時間（秒）。用畫面時間而不是物理時間，是因為
     *                    ×60 的時候分子不該跟著變成一片模糊。
     * @returns {Array<{x:number,z:number,kind:string,amp:number}>}
     */
    function moleculeField(o, t) {
        // --- 數量：先分氣體，剩下的按熔化比例分液體與固體 ---
        let nGas = Math.round(N_MOL * o.vf);
        let nLiq = Math.round(N_MOL * o.mf) - nGas;
        if (nLiq < 0) nLiq = 0;
        if (nGas + nLiq > N_MOL) nGas = N_MOL - nLiq;
        const nSol = Math.max(0, N_MOL - nGas - nLiq);

        // 振幅：固體隨溫度（也就是加熱進度）變大，液體固定，氣體最大。
        const ampSolid = 1.0 + 2.6 * Math.max(0, Math.min(1, o.heatFrac));

        const out = [];
        let solIdx = 0, liqIdx = 0, gasIdx = 0;

        // 三個區域：氣體在液面之上、液體在液面與冰堆之間、固體在杯底。
        // 液面是唯一的邊界，所以「氣體在液面之上」是可測的。
        const zSurf = surfaceZ(o.mf, o.vf);
        const zFloor = fluidBottom(o.mf);
        const dx = (MOL_X1 - MOL_X0) / MOL_COLS;

        for (let i = 0; i < N_MOL; i++) {
            const kind = i < nGas ? 'gas' : (i < nGas + nLiq ? 'liquid' : 'solid');
            let x, z, amp = 0;

            if (kind === 'solid') {
                // 晶格：一行 MOL_COLS 個，**由杯底往上**填。
                // ⚠️ 列距固定用 SOLID_DY、起點固定在杯底，不是依目前的固體
                //    數量重新分配——否則冰在熔化的時候整個晶格會跟著重排、
                //    慢慢往下滑，看起來像整塊冰在掉，而不是「上面那幾排化掉了」。
                const col = solIdx % MOL_COLS;
                const row = Math.floor(solIdx / MOL_COLS);
                x = MOL_X0 + (col + 0.5) * dx;
                z = Z_BOT - 8 - (row + 0.5) * SOLID_DY;
                // 兩個不同頻率，所以看起來是「抖」而不是「來回走一直線」
                x += ampSolid * Math.sin(t * 5.1 + hash01(solIdx) * 6.283);
                z += ampSolid * Math.sin(t * 6.7 + hash01(solIdx + 97) * 6.283);
                amp = ampSolid;
                solIdx++;
            } else if (kind === 'liquid') {
                // 液體的帶狀區域：從液面往下到冰堆的頂端。
                // ⚠️ 上緣留 12 個單位，比抖動振幅 7 大——否則分子晃一晃
                //    就跑到液面之上，而「液體在液面之下」是會被抓的斷言。
                const h1 = hash01(liqIdx + 11), h2 = hash01(liqIdx + 53);
                x = MOL_X0 + h1 * (MOL_X1 - MOL_X0);
                z = zSurf + 12 + h2 * Math.max(0, zFloor - zSurf - 14);
                x += 9 * Math.sin(t * 1.9 + h1 * 6.283);
                z += 7 * Math.sin(t * 2.3 + h2 * 6.283);
                amp = 9;
                liqIdx++;
            } else {
                const h1 = hash01(gasIdx + 7), h2 = hash01(gasIdx + 131);
                // 往上飄，到頂就回到下面（mod 1）。
                // ⚠️ 活動範圍用**比例**取 [Z_TOP, 液面] 的 5%～85%，不是固定的
                //    上下限：氣體只剩一點點的時候液面會貼到杯頂，固定上下限
                //    會整個翻過去、把氣體畫到液面**下面**（驗證 ⑦ 會抓到）。
                const span = Math.max(0, zSurf - Z_TOP);
                const zHi = Z_TOP + 0.05 * span;
                const zLo = Z_TOP + 0.85 * span;
                const rise = ((t * 0.35 + h1) % 1 + 1) % 1;
                z = zLo - rise * (zLo - zHi);
                x = MOL_X0 + h2 * (MOL_X1 - MOL_X0)
                    + 11 * Math.sin(t * 3.1 + h2 * 6.283);
                amp = 11;
                gasIdx++;
            }
            out.push({ x, z, kind, amp });
        }
        return out;
    }

    // ======================================================================
    // 小工具
    // ======================================================================
    function fmtKJ(j) {
        const k = j / 1000;
        return k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(2);
    }

    function fmtClock(s) {
        if (s < 90) return s.toFixed(1) + ' 秒';
        if (s < 5400) return (s / 60).toFixed(1) + ' 分鐘';
        return (s / 3600).toFixed(2) + ' 小時';
    }

    function fmtSpeed(panel) {
        const v = parseFloat(panel.speed) || 1;
        if (v <= 1) return '真實時間';
        if (v < 60) return `真實 ${v} 秒`;
        return `真實 ${(v / 60).toFixed(0)} 分鐘`;
    }

    // ======================================================================
    // 畫面
    // ======================================================================
    function drawBeaker(p, view, pr) {
        const x0 = view.toScreenX(BEAKER.x0), x1 = view.toScreenX(BEAKER.x1);
        const yt = view.toScreenY(BEAKER.top), yb = view.toScreenY(BEAKER.bot);
        const wl = ThermalScene.L(view, 3, 1.5);
        const col = [100, 116, 139];

        // 玻璃杯身：杯子是開口朝上的 U 形，所以只畫三條邊
        p.noFill();
        ThermalScene.strokeOn(p, col, wl);
        p.beginShape();
        p.vertex(x0, yt);
        p.vertex(x0, yb);
        p.vertex(x1, yb);
        p.vertex(x1, yt);
        p.endShape();

        // 液面：氣體與凝結相的分界，位置由分子動畫的同一條公式給出。
        // 整杯都是冰的時候沒有液面，所以只在有氣體的時候畫這條線。
        // ⚠️ 標籤放**左邊**：右邊是溫度計（TH_X = 332），放右邊會疊上去。
        if (pr.vf > 0.001) {
            const zs = surfaceZ(pr.mf, pr.vf);
            ThermalScene.dashed(p, view, BEAKER.x0 + 10, zs, BEAKER.x1 - 10, zs,
                                PHASE_COL.gas, { w: 2 });
            ThermalScene.worldBadge(p, view, MOL_X0 + 40, zs - 15, '液面',
                                    { size: 11, col: PHASE_COL.gas });
        }

        // 加熱板
        p.noStroke();
        p.fill(51, 65, 85);
        p.rect(view.toScreenX(PLATE.x0), view.toScreenY(PLATE.y),
               view.len(PLATE.x1 - PLATE.x0), view.len(PLATE.h), view.len(4, 2));

        // 下面的加熱箭頭：長度 ∝ 功率（長度才是功率，這是這一頁一致的編碼）
        const f = Math.max(0, Math.min(1, pr.P / P_MAX));
        const len = 8 + 20 * f;
        for (let i = 0; i < 5; i++) {
            const ax = PLATE.x0 + (i + 0.5) * (PLATE.x1 - PLATE.x0) / 5;
            ThermalScene.arrow(p, view, ax, ARROW_Y, 0, -len,
                               [220, 38, 38], { w: 2.5, head: 9 });
        }
        ThermalScene.worldBadge(p, view, 261, ARROW_Y + 22,
                                `加熱功率 ${pr.P} W`, { size: 12, col: [220, 38, 38] });

        // 溫度計插在燒杯裡：球泡沉在底部、管子伸出液面
        ThermalScene.drawThermometer(p, view, TH_X, TH_BULB_Y, TH_H,
                                     pr.st.T, pr.R.yMin, pr.R.yMax,
                                     { bulb: 12, tube: 11, label: false, dec: 0 });
    }

    function drawMolecules(p, view, pr, t) {
        const field = moleculeField(pr, t);
        p.noStroke();
        for (const m of field) {
            const col = PHASE_COL[m.kind];
            const x = view.toScreenX(m.x), z = view.toScreenY(m.z);
            p.fill(col[0], col[1], col[2]);
            if (m.kind === 'solid') {
                // 方形＝綁在晶格上；圓形＝可以跑
                const s = view.len(7, 3);
                p.rect(x - s / 2, z - s / 2, s, s, view.len(1));
            } else {
                p.ellipse(x, z, view.len(m.kind === 'gas' ? 6 : 7, 3));
            }
        }
    }

    function drawLedger(p, view, pr) {
        const L0 = LEDGER;
        ThermalScene.worldBadge(p, view, L0.x + 60, 118, '能量帳本', { size: 15, col: [15, 23, 42] });
        ThermalScene.worldBadge(p, view, L0.right - 92, 118,
                                `總共 ${fmtKJ(pr.b.total)} kJ`, { size: 13, col: [100, 116, 139] });

        const segs = pr.b.segs;
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const y = L0.y0 + i * L0.rowH;
            const col = SEG_COL[s.id] || [100, 116, 139];
            const pct = pr.b.total > 0 ? s.span / pr.b.total : 0;

            // 這一格走完了沒：整段在 Q 之前就是實色，正在跑的是部分填滿
            const fill = pr.Q >= s.Q1 ? 1 : (pr.Q <= s.Q0 ? 0 : (pr.Q - s.Q0) / s.span);

            // ⚠️ 標籤要標出「哪一段」，不然學生不知道曲線上的水平線是哪一格。
            const tail = s.kind === 'latent' ? '（相變，溫度不動）' : '';
            ThermalScene.worldBadge(p, view, L0.x + 4, y,
                                    `${i + 1}. ${s.label}${tail}`,
                                    { size: 12, col, align: 'left' });
            ThermalScene.worldBadge(p, view, L0.right - 4, y,
                                    `${fmtKJ(s.span)} kJ　${(pct * 100).toFixed(1)}%`,
                                    { size: 12, col: [71, 85, 105], align: 'right' });

            // 長條：長度 ∝ 這一段的能量，填滿的部分 ∝ 這一格走了多少
            const bx = view.toScreenX(L0.x), by = view.toScreenY(y + 24);
            const bw = view.len(L0.barW), bh = view.len(L0.barH);
            const frac = pr.maxSpan > 0 ? s.span / pr.maxSpan : 0;
            // ⚠️ 留一個最小可見寬度。加熱固體只佔總能量的 1.3%，比例尺上
            //    是 5.6 個世界單位——畫出來就是「這一段不見了」，看起來
            //    像程式的 bug，而不是「這一段很小」。精確的數字在右邊的
            //    kJ 與 % 上，長條只負責讓大小關係看得出來。
            const full = Math.max(view.len(4, 2), bw * frac);

            p.noStroke();
            p.fill(226, 232, 240);
            p.rect(bx, by, full, bh, view.len(3, 1));
            if (fill > 0) {
                p.fill(col[0], col[1], col[2]);
                p.rect(bx, by, full * fill, bh, view.len(3, 1));
            }
            p.noFill();
            ThermalScene.strokeOn(p, [203, 213, 225], view.len(1.2, 1));
            p.rect(bx, by, full, bh, view.len(3, 1));
        }

        // 合計列
        const ty = L0.y0 + segs.length * L0.rowH;
        const allDone = pr.b.total > 0 ? pr.Q / pr.b.total : 0;
        ThermalScene.worldBadge(p, view, L0.x + 4, ty,
                                `已加入 ${fmtKJ(pr.Q)} kJ`,
                                { size: 13, col: pr.done ? [22, 163, 74] : [15, 23, 42], align: 'left' });
        ThermalScene.worldBadge(p, view, L0.right - 4, ty,
                                `以 ${pr.P} W 加熱需 ${fmtClock(pr.totalS)}`,
                                { size: 12, col: [100, 116, 139], align: 'right' });
        const bx = view.toScreenX(L0.x), by = view.toScreenY(ty + 24);
        const bw = view.len(L0.barW), bh = view.len(L0.barH);
        p.noStroke();
        p.fill(226, 232, 240);
        p.rect(bx, by, bw, bh, view.len(3, 1));
        p.fill(allDone >= 1 ? 22 : 15, allDone >= 1 ? 163 : 23, allDone >= 1 ? 74 : 42);
        p.rect(bx, by, bw * Math.min(1, allDone), bh, view.len(3, 1));
    }

    function drawGraph(p, view, pr) {
        const xs = pr.b.segs;
        // 整條曲線（淡灰，當作「這一頁算出來的預測」）
        const full = Kit.heatingCurve(pr.b, 240).map(q => ({ x: q.Q / 1000, y: q.T }));
        // 已經走過的部分（實色）
        const mine = full.filter(q => q.x <= pr.Q / 1000)
                         .concat([{ x: pr.Q / 1000, y: pr.st.T }]);

        // 熔點與沸點的參考線，只在範圍內才畫
        const lines = [];
        for (const [T, label] of [[pr.sub.Tfus, '熔點'], [pr.sub.Tvap, '沸點']]) {
            if (T > pr.R.yMin && T < pr.R.yMax) {
                lines.push({ from: { x: 0, y: T }, to: { x: pr.kJ.max, y: T },
                             col: [148, 163, 184], dash: true,
                             label: `${label} ${T} °C` });
            }
        }

        ThermalScene.drawGraph(p, view, {
            x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
            xMin: 0, xMax: pr.kJ.max,
            yMin: pr.R.yMin, yMax: pr.R.yMax,
            xTicks: pr.kJ.ticks, yTicks: pr.R.yTicks,
            xLabel: '加入的能量', xUnit: 'kJ',
            yLabel: '溫度', yUnit: '°C',
            title: `${pr.sub.name} ${panelMassText(pr)} 的加熱曲線`,
            lines,
            series: [
                { pts: full, col: [203, 213, 225], r: 0, join: true },
                { pts: mine, col: SEG_COL[pr.st.seg.id] || [15, 23, 42], r: 0, join: true },
            ],
            marker: { x: Math.min(pr.kJ.max, pr.Q / 1000), y: pr.st.T, col: [220, 38, 38] },
        });
    }

    function panelMassText(pr) {
        return `${(pr.m * 1000).toFixed(0)} g`;
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    ThermalScene.run({
        // ⚠️ 兩個公式要疊成兩行。用 `\\qquad` 並排的話整條比面板寬，
        //    KaTeX 不會自己縮，第二個公式會被右邊界切掉——症狀只是
        //    「公式少了一半」，其他一切正常。
        formula: '\\begin{aligned}'
               + 'Q &= m\\,c\\,\\Delta T \\\\[2pt]'
               + 'Q &= m\\,L'
               + '\\end{aligned}',
        formulaFallback: 'Q = mcΔT　　Q = mL',

        controls: {
            selects: [
                { key: 'sub', label: '物質', def: 'water',
                  options: SUB_ORDER.map(k => ({ v: k, t: `${Kit.SUBSTANCES[k].name}（c = ${Kit.SUBSTANCES[k].cLiquid}）` })) },
                // live: true → 換播放速度**不會**清掉進度。已經加進去的能量
                // 不會因為你按快轉就跑掉——換的是看法，不是實驗條件。
                { key: 'speed', label: '時間壓縮', def: '15', live: true, options: SPEEDS },
            ],
            sliders: [
                { key: 'mass', label: '質量 m', def: MASS.def,
                  min: MASS.min, max: MASS.max, step: MASS.step, unit: 'g', dec: 0 },
                { key: 'power', label: '加熱功率 P', def: POWER.def,
                  min: POWER.min, max: POWER.max, step: POWER.step, unit: 'W', dec: 0 },
            ],
        },

        cards: [
            { label: '已加入能量', id: 'cardQ', unit: 'kJ', highlight: true },
            { label: '溫度', id: 'cardT', unit: '°C', highlight: true },
            { label: '相態', id: 'cardPhase', unit: '' },
            // 相變中沒有「比熱容量」這個概念（溫度不動），所以卡片要說
            // 「相變中」而不是硬印一個 c——那會讓人以為那一段也在用 mcΔT。
            { label: '這一段的比熱 c', id: 'cardC', unit: 'J/(kg·K)' },
            { label: '已熔化', id: 'cardMelted', unit: 'g' },
            { label: '已汽化', id: 'cardVap', unit: 'g' },
            { label: '加熱時間', id: 'cardClock', unit: '' },
        ],

        model(t, panel) {
            panelRef = panel;
            return propsFor(panel);
        },

        /**
         * 每一幀把能量往前加。
         *
         * ⚠️ 走的是**物理時間** `dt · speed`：能量是真的加進去的，快轉只是
         *    讓畫面跑快一點。所以 Q = P · (物理時間)，不需要另外積分。
         */
        onFrame(t, panel) {
            const dt = Math.min(0.1, Math.max(0, t - lastSim));
            lastSim = t;
            const pr = propsFor(panel);
            // 走完就停。不停的話時鐘會繼續跑，而圖和卡片都已經到頂了
            // ——兩邊在講不同的時間。停下來之後橫幅會換成結束訊息。
            if (pr.done) return;
            const span = dt * pr.speed;
            const remain = (pr.b.total - pr.Q) / (pr.P > 0 ? pr.P : 1);
            const step = Math.min(span, remain);
            if (!(step > 0)) return;
            addQ += pr.P * step;
            physTime += step;
        },

        values(t, panel, pr) {
            const lat = pr.st.seg.kind === 'latent';
            return {
                cardQ: (pr.Q / 1000).toFixed(1),
                cardT: pr.st.T.toFixed(1),
                cardPhase: pr.st.phase,
                cardC: lat ? '相變中' : pr.st.seg.c.toFixed(0),
                cardMelted: (pr.st.melted * 1000).toFixed(1),
                cardVap: (pr.st.vaporised * 1000).toFixed(1),
                cardClock: fmtClock(physTime),
            };
        },

        titleText(t, panel, pr) {
            return `${pr.sub.name}　${(pr.m * 1000).toFixed(0)} g　${pr.P} W`
                 + `　畫面 1 秒 ≈ ${fmtSpeed(panel)}`
                 + `　${pr.st.phase}　${pr.st.T.toFixed(1)} °C`;
        },

        onReset() { reset(panelRef); },

        draw(p, view, t, panel, pr) {
            // --- 頂部橫幅 ---
            const msg = pr.done
                ? `✅ ${pr.sub.name} 加熱完成——總共用了 ${fmtKJ(pr.b.total)} kJ`
                  + `（按重設 RESET 換物質或質量再跑）`
                : pr.Q <= 0
                  ? '按開始 START：能量從下面進去，看溫度什麼時候會停下來不動'
                  : `${pr.st.phase}　已經加入 ${fmtKJ(pr.Q)} kJ`;
            ThermalScene.worldBadge(p, view, 450, 56, msg,
                { size: 14, col: pr.done ? [22, 163, 74] : [100, 116, 139] });

            drawBeaker(p, view, pr);
            drawMolecules(p, view, pr, t);
            drawLedger(p, view, pr);
            drawGraph(p, view, pr);
        },
    });

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    // ⚠️ 這個守衛不能拿掉：verify-thermal.js 會把這一頁整支抓進 Node，
    //    直接呼叫 moleculeField() / propsFor() / kJAxis() 去斷言，
    //    還有 PAGE.onFrame 跑幾百幀看 Q 有沒有停在總能量上。
    if (typeof document !== 'undefined') reset({ sub: 'water', mass: MASS.def, power: POWER.def });
    if (typeof window !== 'undefined') {
        window.__page = {
            GRAPH, BEAKER, MOL_X0, MOL_X1, Z_TOP, Z_BOT, H_INT,
            SOLID_DY, SOLID_ROWS, N_MOL, MOL_COLS,
            surfaceZ, pileTopZ, fluidBottom,
            RANGES, SUB_ORDER, PHASE_COL, SEG_COL, SPEEDS,
            MASS, POWER, P_MAX, TH_X, TH_H,
            propsFor, budgetFor, kJAxis, moleculeField, hash01,
            fmtKJ, fmtClock, fmtSpeed,
            physTime: () => physTime,
            addedQ: () => addQ,
        };
    }
})();
