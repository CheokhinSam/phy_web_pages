/**
 * 🌊 熱對流
 *
 * 這一頁做一件事：把**一層流體**的溫度場同時用四種方式顯示，而四者一致。
 *
 *   ① 溫度場      盒子裡每一點的顏色＝它的溫度（含對流的擾動）
 *   ② 示蹤粒子    被流體搬著走的點，沿著對流胞繞圈
 *   ③ U–log Ra 圖 流速對雷利數，以及那條 Ra_c = 1708 的門檻
 *   ④ 數字卡片    Ra、ΔT_c、狀態、流速、Re、Pr
 *
 * ①②④ 全部來自同一組 (k, amplitude, ΔT)，也就是同一個溫度場
 * `ThermalKit.cellTemperature`。粒子不是「做樣子在繞圈」——它跑的速度場
 * 是那個溫度場的流函數微分出來的，所以**上升的一定是熱的、下沉的一定是冷的**。
 *
 * ==========================================================================
 * ⚠️ 這一頁**不是** Navier–Stokes 求解器，文字裡也要這樣講
 * ==========================================================================
 * 它畫的是「起流」那一段的理想模樣：線性穩定分析的臨界模態
 *
 *     Ψ = A·sin(kx)·sin(πz/H)        （自動滿足四面牆的邊界條件）
 *
 * 加上一個近臨界 ε^½、遠離臨界飽和的振幅。真實的高 Ra 對流是紊流的、
 * 有羽流的、三維的，不是乾乾淨淨的滾筒。**這一頁的價值在門檻**——那個
 * Ra_c = 1708 是真的，ΔT_c ∝ L⁻³ 也是真的，而且和直覺相反（越薄的層越難滾）。
 *
 * ==========================================================================
 * ⚠️ 為什麼盒子永遠是 5:1，而且永遠有 5 個胞
 * ==========================================================================
 * 剛性邊界的臨界波長是 2.016 H（波數 3.117/H），所以**胞寬 ≈ 層厚**。
 * 盒子做成 5 倍層厚寬，就是 5 個近乎正方形的胞——這是教科書上那張圖。
 *
 * 所以層厚滑桿**不會**改變畫面裡的胞數，它改變的是「整盒流體實際有多大」
 * （寬 5L、厚 L，兩者一起變）以及 Ra、ΔT_c、流速。底下那條比例尺會把
 * 「這一盒現在是 5 mm 寬還是 15 cm 寬」講清楚。
 *
 * ==========================================================================
 * ⚠️ 時間壓縮（和熱傳導那一頁同一個理由，但這裡的倍率是「緩」的）
 * ==========================================================================
 * 流速從 0.001 mm/s（蜂蜜剛起流）到 200 mm/s（空氣厚層大溫差），差了五個
 * 數量級。照真實時間播的話，慢的那一端要盯著看兩分鐘才繞完一圈。
 *
 * 熱傳導那邊是「每一格畫面都走固定的 τ 分數」（完全壓平）。這裡不能那樣做，
 * 因為**「流得多快」本身就是這一頁要教的東西**——壓平了，水和蜂蜜看起來
 * 一樣快。所以這裡只做**半壓縮**：
 *
 *     T_cross = 2.5 s × √(U_ref / U)      繞完一圈要播幾秒
 *
 * 流速慢 16 倍的流體，畫面上只慢 4 倍（而不是慢 16 倍或一樣快）。卡片上的
 * 「已過時間」與「時間壓縮」印的是真正的數字。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 lab-scene.js）
    // ======================================================================
    const CELL   = { x: 150, y: 168, w: 600, h: 120 };   // 流體本身（5:1）
    const COLD   = { x: 150, y: 148, w: 600, h: 20 };    // 冷板（在上）
    const HOT    = { x: 150, y: 288, w: 600, h: 20 };    // 熱板（在下）
    const LEGEND = { x: 180, y: 54,  w: 540, h: 16 };
    const GRAPH  = { x: 150, y: 512, w: 600, h: 240 };
    // ⚠️ 兩種矩形的寫法**不能互換**：CELL 是 `{x,y,w,h}`（場景物件的慣用
    //    寫法），流體／粒子的映射要的是 `{x0,y0,x1,y1}`。
    const BOX    = { x0: CELL.x, y0: CELL.y, x1: CELL.x + CELL.w, y1: CELL.y + CELL.h };

    // ======================================================================
    // 物理
    // ======================================================================
    const BOX_RATIO = 5;          // 盒子寬 = 幾倍層厚
    const ROLL_ASPECT = 1.008;    // 剛性邊界的臨界波長 2.016 H ÷ 2（一個胞）
    const N_ROLL = Math.max(1, Math.round(BOX_RATIO / ROLL_ASPECT));
    const T_TOP_C = 20;           // 冷板固定 20 °C，熱板 = 20 + ΔT
    const U_REF = 0.02;           // 時間壓縮的參考速度（水 1 cm 20 K ≈ 20 mm/s）

    const FLUID_ORDER = ['water', 'air', 'glycerine', 'honey'];
    // ⚠️ 預設層厚是 3 mm（不是 1 cm），這是**為了讓溫差滑桿自己就能跨越門檻**。
    //    水在 1 公分厚時 ΔT_c 只有 0.12 K，遠低於滑桿的最小值 1 K——學生把
    //    溫差從 1 K 拉到 40 K，流體從頭到尾都在滾，這一頁的「靜止 vs 對流」
    //    就永遠演不出來，右下的 U–Ra 曲線也不會貼著橫軸走一段才折起來
    //    （md 對那張圖的說明就是這樣寫的）。3 mm 時 ΔT_c = 4.47 K 落在
    //    1..40 K 中間，滑桿一推就會看到粒子從靜止變成滾筒。
    const THICK = { min: 1, max: 30, def: 3 };     // 公釐
    const DTEMP = { min: 1, max: 40, def: 20 };    // K

    // 分子盒子／粒子的空間解析度：這一頁的盒子是 5:1，格子跟著扁
    const GRID_C = 72, GRID_R = 15;

    /**
     * 這一幀的流體性質與由此推出的全部量。滑桿一動就重算，其他地方一律讀這一個。
     *
     * ⚠️ 滑桿上的層厚是**公釐**，`ThermalKit` 只吃 SI。換算就只在這裡做一次；
     *    忘了換的症狀是 Ra 差 10⁹ 倍、而畫面上「有沒有在滾」看起來完全正確
     *    （因為反正都遠大於臨界值）。
     */
    function propsFor(panel) {
        const f = ThermalKit.FLUIDS[panel.fluid];
        const L = panel.thick / 1000;          // 公釐 → 公尺
        const dT = panel.dtemp;                // K
        const W = BOX_RATIO * L;               // 物理寬度
        const o = { beta: f.beta, nu: f.nu, alpha: f.alpha, L };
        const ra = ThermalKit.rayleigh({ beta: f.beta, dT, L, nu: f.nu, alpha: f.alpha });
        const raC = ThermalKit.RA_C;
        const amp = ThermalKit.convectionAmplitude(ra, raC);
        const U = ThermalKit.buoyantSpeed({
            beta: f.beta, dT, L, nu: f.nu, alpha: f.alpha, ra, raC,
        });
        const dTc = ThermalKit.criticalDT(o);
        // 流函數的振幅取 A = U·L/π，這樣**水平**速度的峰值剛好是 U
        // （垂直速度是它的 (L/胞寬) 倍，胞寬 ≥ 層厚時不會超過 U）
        const k = N_ROLL * Math.PI / W;
        const A = U * L / Math.PI;
        const TS = U > 0
            ? Math.min(2000, Math.max(0.05, 2 * L / Math.sqrt(U * U_REF)))
            : 0;
        return {
            f, L, dT, W, k, A, U, TS, ra, raC, amp, dTc,
            Ttop: T_TOP_C, Tbottom: T_TOP_C + dT,
        };
    }

    /** 溫度場的色階範圍：擾動最大時 T 落在 [Tb − 1.5ΔT, Tb + 0.5ΔT] 內。 */
    const tminOf = pr => pr.Tbottom - 1.5 * pr.dT;
    const tmaxOf = pr => pr.Tbottom + 0.5 * pr.dT;

    // ======================================================================
    // 狀態
    // ======================================================================
    // ⚠️ 一定要在 ThermalScene.run() **之前**宣告：run() 會同步呼叫
    //    refresh() → values()，也就是在 IIFE 還沒跑完的時候就讀它們。
    let TR = null;             // 示蹤粒子
    let lastMoving = null;     // 上一幀在不在門檻以上（換狀態要重新灑點）
    let physTime = 0;          // 已過的**真實**時間（秒）
    let lastSim = 0;           // 上一幀的畫面時間，用來算 dt
    let panelRef = null;       // ⚠️ onReset(reason) 拿不到 panel，見熱傳導那一頁

    /**
     * 粒子的初始位置：灑在**流線**上，不是隨機均勻。
     *
     * ⚠️ 隨機灑在這個流場裡會壞掉，而且壞得很安靜。
     *
     *    這一頁的流場是**穩態**的，流線就是 Ψ = A·sin(kx)·sin(πz/H) 的等值線。
     *    牆（z = 0、z = H）與胞的邊界（kx = nπ）**本身就是 Ψ = 0 的等值線**，
     *    而粒子一旦落在等值線上就再也離不開——所以隨機灑的結果是粒子全部
     *    沿著盒壁與幾條垂直線排隊，像壞掉的畫面，而 `errs` 還是 0。
     *
     *    沿著幾條代表性的流線灑點就對了：每一條都繞著胞的中心轉，畫面上
     *    是一圈一圈同心地在滾——那正是穩態流場裡粒子的**真實行為**。
     *
     * 等值線在局部座標 φ = kx − nπ ∈ [0, π] 上寫成 sin(φ)·sin(πz/H) = c，
     * 所以每一條等值線有上下兩段：
     *     z_up = (H/π)·asin(c / sin φ)，z_lo = H − z_up
     * 兩段在 sin φ = c 的地方（也就是 z = H/2、φ = asin(c) 與 π − asin(c)）接起來，
     * 形成一個封閉的環。**每個胞的形狀完全一樣**，所以 c 決定形狀、胞只負責平移。
     */
    const RINGS = [0.35, 0.62, 0.85];      // 三圈，從貼近胞邊界到貼近胞中心
    const RING_PTS = 6;                    // 每一圈（每一段弧）幾個點

    function seedStreamlines(W, L) {
        const pts = [];
        const k = N_ROLL * Math.PI / W;
        for (const c of RINGS) {
            const a = Math.asin(c);
            for (let r = 0; r < N_ROLL; r++) {
                const x0 = r * W / N_ROLL;
                for (let m = 0; m < RING_PTS; m++) {
                    const phi = a + (Math.PI - 2 * a) * (m + 0.5) / RING_PTS;
                    const x = x0 + phi / k;
                    const zu = (L / Math.PI) * Math.asin(Math.min(1, c / Math.sin(phi)));
                    pts.push({ x, z: zu }, { x, z: L - zu });
                }
            }
        }
        return pts;
    }

    // 3 圈 × 5 個胞 × 6 個點 × 上下兩段 = 180 顆，和 seedStreamlines 的長度一致。
    const N_TRACER = RINGS.length * N_ROLL * RING_PTS * 2;

    /**
     * 門檻以下**不要**沿著流線灑點。
     *
     * 流體靜止的時候粒子哪裡都不去（時間壓縮是 0，一步都不走），所以「沿著
     * 流線灑」唯一的效果就是在畫面上畫出五組**靜止的圓環**——那看起來像是
     * 「渦流存在但沒動」，正好是這一頁要學生分辨清楚的誤解。門檻以下改成
     * 隨機均勻灑，畫面就誠實地只是一群躺著不動的粒子。
     *
     * 順帶得到一個對比：跨越門檻的那一瞬間，粒子會**當場聚成滾筒**。那一下
     * 跳動不是瑕疵，它就是這一頁的結論。
     */
    function makeTracers(W, L, moving) {
        TR = ThermalScene.tracerField({
            n: N_TRACER,
            seed: moving ? seedStreamlines : null,   // null → 隨機均勻
        });
        TR.reset(W, L);
    }

    // ======================================================================
    // 數字格式化
    // ======================================================================
    const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    function sci(v) {
        if (!(Math.abs(v) > 0)) return '0';
        const e = Math.floor(Math.log10(Math.abs(v)));
        const m = v / Math.pow(10, e);
        const es = String(e).split('').map(c => c === '-' ? '⁻' : SUP[+c]).join('');
        return m.toFixed(2) + '×10' + es;
    }

    /** Ra 跨了十幾個數量級、ΔT_c 從 0.004 到 30 萬，沒有一種固定小數位能用。 */
    function fmtNum(v) {
        const a = Math.abs(v);
        if (!(a > 0)) return '0';
        if (a >= 1000 || a < 1e-3) return sci(v);
        if (a >= 1) return v.toFixed(2);
        if (a >= 0.1) return v.toFixed(4);
        return v.toFixed(5);
    }

    // ±15% 以內就當成沒壓縮。少了這段中性區，水在 1 公分、20 K 時會印出
    // 「慢動作 ×1.0」——明明就是真實時間，讀起來卻像被放慢了。
    function fmtTS(TS) {
        if (!(TS > 0)) return '—';
        if (TS >= 0.85 && TS <= 1.15) return '≈ 真實時間';
        if (TS > 1.15) return '壓縮 ×' + (TS >= 100 ? TS.toFixed(0) : TS.toFixed(1));
        return '慢動作 ×' + (1 / TS).toFixed(1);
    }

    /** 時間壓縮倍率可以到 2000，固定用秒會印出「2000.0 秒」這種讀不出來的數字。 */
    function fmtDur(s) {
        if (!(s > 0)) return '0 秒';
        if (s < 90) return s.toFixed(1) + ' 秒';
        if (s < 5400) return (s / 60).toFixed(1) + ' 分';
        return (s / 3600).toFixed(1) + ' 小時';
    }

    /**
     * 狀態：門檻以下靜止，剛跨過去是「剛起流」，再上去才滾得起來。
     *
     * ⚠️ 「紊流」的門檻不要寫得太低。雷利–貝納對流要到大約 Ra ~ 10⁸ 才真的
     *    開始紊流，這一頁的滑桿最多只到 10⁷。把 Ra = 3×10⁵ 講成「接近紊流」
     *    是錯的——那還是乾乾淨淨的滾筒。
     *
     * `short` 給卡片（欄位窄），`text` 給畫面上的標籤（可以講完整）。
     */
    function stateOf(ra, raC) {
        if (!(ra > raC)) return { short: '靜止（傳導）', text: '靜止：浮力打不過黏滯', col: [71, 85, 105] };
        const r = ra / raC;
        if (r < 3) return { short: '剛起流', text: '對流剛起流（還很慢）', col: [217, 119, 6] };
        if (r < 1000) return { short: '穩定滾動', text: '對流穩定滾動', col: [220, 38, 38] };
        return { short: '旺盛', text: '對流旺盛（接近紊流前緣）', col: [185, 28, 28] };
    }

    // ======================================================================
    // 對外
    // ======================================================================
    const PAGE = {
        formula: 'Ra = \\frac{g\\,\\beta\\,\\Delta T\\,L^{3}}{\\nu\\,\\alpha}'
               + '\\qquad Ra_c = 1708',

        formulaFallback: 'Ra = gβΔT·L³ / (να)　　Ra_c = 1708',

        controls: {
            selects: [
                { key: 'fluid', label: '流體', def: 'water', options: FLUID_ORDER.map(k => {
                      const f = ThermalKit.FLUIDS[k];
                      return { v: k, t: `${f.name}　ν = ${sci(f.nu)} m²/s` };
                  }) },
                { key: 'show', label: '顯示', def: 'both', live: true, options: [
                    { v: 'both',   t: '溫度場 ＋ 粒子' },
                    { v: 'field',  t: '只看溫度場' },
                    { v: 'tracer', t: '只看粒子（依溫度上色）' },
                    { v: 'arrows', t: '只看速度場（箭頭）' },
                ] },
            ],
            sliders: [
                { key: 'thick', label: '層厚 L', def: THICK.def, min: THICK.min, max: THICK.max,
                  step: 1, unit: 'mm', dec: 0 },
                { key: 'dtemp', label: '上下溫差 ΔT', def: DTEMP.def, min: DTEMP.min, max: DTEMP.max,
                  step: 1, unit: 'K', dec: 0 },
            ],
        },

        cards: [
            { label: '雷利數 Ra', id: 'cardRa', unit: '', highlight: true },
            { label: '臨界溫差 ΔT_c', id: 'cardDTc', unit: 'K', highlight: true },
            { label: '狀態', id: 'cardState', unit: '' },
            { label: '典型流速 U', id: 'cardU', unit: 'mm/s' },
            { label: '雷諾數 Re', id: 'cardRe', unit: '' },
            { label: '普朗特數 Pr = ν/α', id: 'cardPr', unit: '' },
            { label: '已過時間（真實）', id: 'cardClock', unit: '' },
            { label: '時間壓縮', id: 'cardTS', unit: '' },
        ],

        model(t, panel) {
            panelRef = panel;
            return propsFor(panel);
        },

        /**
         * 每一幀讓粒子沿著流場走一步。
         *
         * ⚠️ 走的是**物理時間** `dt · TS`，不是畫面時間。TS 是時間壓縮倍率，
         *    粒子因此永遠在繞圈（不管流體多慢），而卡片上的時鐘走的是真數字。
         */
        onFrame(t, panel) {
            const dt = Math.min(0.1, Math.max(0, t - lastSim));
            lastSim = t;
            const pr = propsFor(panel);
            // 跨越門檻時要重新灑點（門檻上下用的灑法不同，見 makeTracers）。
            const moving = pr.TS > 0;
            if (!TR || moving !== lastMoving) {
                makeTracers(pr.W, pr.L, moving);
                lastMoving = moving;
            }
            if (!moving) return;                   // 門檻以下：粒子不動（這是對的）
            const dphys = dt * pr.TS;
            physTime += dphys;
            TR.step({
                dt: dphys, W: pr.W, H: pr.L, trail: panel.show === 'tracer' ? 9 : 0,
                // |v| 的峰值就是 U：u 和 w 的峰值都剛好是 U，而且位置錯開，
                // 所以兩者不會同時達到最大。給 U 就不必讓模組自己戳點估。
                vmax: pr.U,
                vel: (x, z) => ThermalKit.cellVelocity({ k: pr.k, H: pr.L, A: pr.A }, x, z),
            });
        },

        values(t, panel, sol) {
            const pr = sol;
            const Re = pr.U * pr.L / pr.f.nu;
            return {
                cardRa: fmtNum(pr.ra),
                cardDTc: fmtNum(pr.dTc),
                cardState: stateOf(pr.ra, pr.raC).short,
                cardU: (pr.U * 1000).toFixed(pr.U * 1000 >= 10 ? 1 : 2),
                cardRe: Re >= 1 ? Re.toFixed(0) : Re.toFixed(3),
                cardPr: pr.f.nu / pr.f.alpha >= 1000
                    ? sci(pr.f.nu / pr.f.alpha)
                    : (pr.f.nu / pr.f.alpha).toFixed(2),
                cardClock: physTime < 90
                    ? physTime.toFixed(1) + ' 秒'
                    : (physTime / 60).toFixed(1) + ' 分',
                cardTS: fmtTS(pr.TS),
            };
        },

        titleText(t, panel, sol) {
            const pr = sol;
            const st = stateOf(pr.ra, pr.raC);
            // ⚠️ 慢動作那一支以前印的是 `1 / TS`——句子寫「畫面 1 秒 ≈ 真實 X 秒」，
            //    X 卻填了倒數。TS = 0.43 時會印出「畫面 1 秒 ≈ 真實 2.3 秒（慢動作）」：
            //    同一句話裡數字說快 2.3 倍、括號說慢動作，自己打自己。
            //    TS 的定義就是「畫面 1 秒讓物理時間前進幾秒」，所以兩個分支
            //    填的都是 TS。（卡片那張用的是倒數，但它的措辭是「慢動作 ×2.3」，
            //    講的是**慢的倍率**，那個倒數是對的。）
            const tclause = (pr.TS >= 0.85 && pr.TS <= 1.15) ? '畫面 ≈ 真實時間'
                : `畫面 1 秒 ≈ 真實 ${fmtDur(pr.TS)}${pr.TS < 0.85 ? '（慢動作）' : ''}`;
            return `🌊 熱對流　${pr.f.name}　L = ${panel.thick} mm　ΔT = ${pr.dT} K`
                 + `　Ra = ${fmtNum(pr.ra)}（Ra_c = 1708）`
                 + `　${st.text}　${tclause}`;
        },

        onReset() {
            physTime = 0;
            lastSim = 0;
            const pr = propsFor(panelRef);
            lastMoving = pr.TS > 0;
            makeTracers(pr.W, pr.L, lastMoving);
        },

        draw(p, view, t, panel, sol) {
            const pr = sol;
            const tmin = tminOf(pr), tmax = tmaxOf(pr);
            const st = stateOf(pr.ra, pr.raC);
            const diag = ThermalKit.check({ L: pr.L, alpha: pr.f.alpha });

            // --- 冷板與熱板 ---
            drawPlate(p, view, COLD, pr.Ttop, tmin, tmax,
                      `冷板　T = ${pr.Ttop.toFixed(0)} °C（固定）`);
            drawPlate(p, view, HOT, pr.Tbottom, tmin, tmax,
                      `熱板　T = ${pr.Tbottom.toFixed(0)} °C`);

            // --- 流體本身 ---
            if (panel.show !== 'tracer' && panel.show !== 'arrows') {
                drawField(p, view, pr, tmin, tmax);
                if (panel.show === 'field') drawRollLines(p, view, pr);
            } else {
                p.noStroke();
                p.fill(248, 250, 252);
                p.rect(view.toScreenX(CELL.x), view.toScreenY(CELL.y),
                       ThermalScene.L(view, CELL.w), ThermalScene.L(view, CELL.h));
            }

            // --- 粒子與速度場 ---
            if (panel.show === 'both' || panel.show === 'tracer') {
                if (!TR) makeTracers(pr.W, pr.L, pr.TS > 0);
                const molOnly = panel.show === 'tracer';
                TR.draw(p, view, {
                    box: BOX, W: pr.W, H: pr.L, r: 2.6,
                    trail: molOnly,
                    // ⚠️ 有溫度場當底時，粒子一律**白色加深色描邊**——色階上
                    //    任何一個顏色畫在自己的底色上都是看不見的（同色疊同色）。
                    //    只看粒子時沒有底色，顏色就必須由粒子自己帶。
                    colorAt: molOnly
                        ? (x, z) => ThermalScene.tempColor(
                              ThermalKit.cellTemperature({
                                  k: pr.k, H: pr.L, Tbottom: pr.Tbottom,
                                  dT: pr.dT, amplitude: pr.amp,
                              }, x, z), tmin, tmax)
                        : () => [255, 255, 255],
                    ring: molOnly ? null : [30, 41, 59],
                });
            }
            if (panel.show === 'arrows' || panel.show === 'field') {
                drawArrows(p, view, pr);
            }

            // --- 色階圖例 ---
            ThermalScene.tempScale(p, view, LEGEND.x, LEGEND.y, LEGEND.w, LEGEND.h,
                                   tmin, tmax, { unit: '°C' });
            ThermalScene.worldBadge(p, view, LEGEND.x + LEGEND.w / 2, LEGEND.y - 20,
                '顏色 ＝ 溫度（整頁只有這一個色階）', { size: 13, col: [100, 116, 139] });

            // --- 比例尺 ---
            drawScaleBar(p, view, pr);
            ThermalScene.worldBadge(p, view, CELL.x + CELL.w / 2, 368,
                `盒寬 = 5L = ${(pr.W * 100).toFixed(2)} cm　層厚 L = ${(pr.L * 1000).toFixed(0)} mm`
                + `　對流胞 ${N_ROLL} 個（胞寬 ≈ 層厚）`, { size: 12, col: [100, 116, 139] });

            // --- 狀態 ---
            ThermalScene.worldBadge(p, view, CELL.x + CELL.w / 2, 402, st.text,
                                    { size: 16, col: st.col });
            if (pr.ra > pr.raC) {
                ThermalScene.worldBadge(p, view, CELL.x + CELL.w / 2, 430,
                    `ΔT = ${pr.dT} K 是門檻 ΔT_c = ${fmtNum(pr.dTc)} K 的 `
                    + `${(pr.ra / pr.raC).toFixed(1)} 倍`, { size: 12, col: st.col });
            } else {
                ThermalScene.worldBadge(p, view, CELL.x + CELL.w / 2, 430,
                    `ΔT = ${pr.dT} K 不到門檻 ΔT_c = ${fmtNum(pr.dTc)} K ——`
                    + ' 熱只能靠傳導慢慢滲上去', { size: 12, col: st.col });
            }

            if (!diag.ok) {
                ThermalScene.worldBadge(p, view, 450, 470, '⚠ ' + diag.errors[0],
                                        { size: 16, col: [220, 38, 38] });
            }

            drawUdGraph(p, view, pr);
        },
    };

    // ======================================================================
    // 畫面（全部吃同一份 pr）
    // ======================================================================

    /** 熱板／冷板：固體，顏色就是它的溫度。 */
    function drawPlate(p, view, r, T, tmin, tmax, label) {
        const c = ThermalScene.tempColor(T, tmin, tmax);
        p.noStroke();
        p.fill(c[0], c[1], c[2]);
        p.rect(view.toScreenX(r.x), view.toScreenY(r.y),
               ThermalScene.L(view, r.w), ThermalScene.L(view, r.h));
        ThermalScene.strokeOn(p, [30, 41, 59], ThermalScene.L(view, 1.8, 1));
        p.noFill();
        p.rect(view.toScreenX(r.x), view.toScreenY(r.y),
               ThermalScene.L(view, r.w), ThermalScene.L(view, r.h));
        // 熱板下面塞了比例尺、狀態、門檻三條標籤，標籤間距要和它們對分，
        // 所以熱板的標籤放得比冷板近一點（冷板上面只有色階圖例，空得很）。
        const above = r.y < CELL.y;
        ThermalScene.worldBadge(p, view, r.x + r.w / 2,
            above ? r.y - ThermalScene.L(view, 20, 12) : r.y + r.h + ThermalScene.L(view, 14, 9),
            label, { size: 13, col: [30, 64, 175] });
    }

    /**
     * 溫度場：一格一格的顏色。
     *
     * ⚠️ 網格密度（72×15）和「盒子裡有幾個胞」無關——格子是畫布的事，胞是
     *    物理的事。格子太粗的話，盒寬 5 公分、胞寬 1 公分時每個胞只剩 4 格，
     *    看起來會像馬賽克而不是流場。
     */
    function drawField(p, view, pr, tmin, tmax) {
        const cw = CELL.w / GRID_C, ch = CELL.h / GRID_R;
        const px = view.toScreenX(CELL.x), py = view.toScreenY(CELL.y);
        const pw = ThermalScene.L(view, cw), ph = ThermalScene.L(view, ch);
        p.noStroke();
        for (let j = 0; j < GRID_R; j++) {
            const z = (j + 0.5) / GRID_R * pr.L;
            for (let i = 0; i < GRID_C; i++) {
                const x = (i + 0.5) / GRID_C * pr.W;
                const T = ThermalKit.cellTemperature({
                    k: pr.k, H: pr.L, Tbottom: pr.Tbottom,
                    dT: pr.dT, amplitude: pr.amp,
                }, x, z);
                const c = ThermalScene.tempColor(T, tmin, tmax);
                p.fill(c[0], c[1], c[2]);
                p.rect(px + pw * i, py + ph * j, pw + 1, ph + 1);
            }
        }
        ThermalScene.strokeOn(p, [30, 41, 59], ThermalScene.L(view, 1.8, 1));
        p.noFill();
        p.rect(view.toScreenX(CELL.x), view.toScreenY(CELL.y),
               ThermalScene.L(view, CELL.w), ThermalScene.L(view, CELL.h));
    }

    /** 胞的邊界（只畫在「只看溫度場」模式，那個模式最需要看出胞的形狀）。 */
    function drawRollLines(p, view, pr) {
        for (let m = 1; m < N_ROLL; m++) {
            const x = CELL.x + CELL.w * m / N_ROLL;
            ThermalScene.dashed(p, view, x, CELL.y, x, CELL.y + CELL.h,
                                [203, 213, 225], { w: 1.5 });
        }
    }

    /**
     * 速度場：格子上的箭頭，長度 ∝ 當地速率。
     *
     * ⚠️ 方向一定要先**換到世界座標**再正規化。物理座標的 z 是向上的、世界
     *    座標的 y 是向下的（要取負號），而且盒子的長寬比不是 1（600 × 120
     *    對上 5L × L）——兩件事都要過，否則箭頭指的方向會偏掉。
     */
    function drawArrows(p, view, pr) {
        // 20 × 4：盒子的世界長寬比就是 5:1，所以每個格子剛好是正方形
        // ——也就剛好是「一個胞裡有 4 × 4 支箭頭」，這個密度才看得出**迴圈**。
        // 原本用 10 × 4 是一個胞只有 2 支，畫面上只有「左邊向上、右邊向下」，
        // 看不出它是一個封閉的環。
        const GC = 20, GR = 4;
        if (!(pr.U > 0)) return;
        const cells = [];
        let mx = 0;
        for (let j = 0; j < GR; j++) {
            for (let i = 0; i < GC; i++) {
                const x = (i + 0.5) / GC * pr.W, z = (j + 0.5) / GR * pr.L;
                const v = ThermalKit.cellVelocity({ k: pr.k, H: pr.L, A: pr.A }, x, z);
                const vx = v.u * (CELL.w / pr.W);
                const vy = -v.w * (CELL.h / pr.L);
                const sp = Math.hypot(vx, vy);
                mx = Math.max(mx, sp);
                cells.push({ x, z, vx, vy, sp });
            }
        }
        // 世界單位，最長的箭頭。格子是 600/20 = 30 單位見方，所以箭頭不能
        // 超過約 26，不然會插進隔壁格子、整個速度場糊成一團。
        const len = 26;
        for (const c of cells) {
            const f = mx > 0 ? c.sp / mx : 0;
            if (f < 0.04) continue;
            const ux = c.vx / c.sp, uy = c.vy / c.sp;
            const wx = CELL.x + (c.x / pr.W) * CELL.w;
            const wy = CELL.y + CELL.h - (c.z / pr.L) * CELL.h;
            const l = len * (0.25 + 0.75 * f);
            ThermalScene.arrow(p, view,
                wx - ux * l / 2, wy - uy * l / 2, ux * l, uy * l,
                ThermalScene.tempColor(
                    ThermalKit.cellTemperature({
                        k: pr.k, H: pr.L, Tbottom: pr.Tbottom,
                        dT: pr.dT, amplitude: pr.amp,
                    }, c.x, c.z), tminOf(pr), tmaxOf(pr)),
                { w: 2, head: 8 });
        }
        ThermalScene.strokeOn(p, [30, 41, 59], ThermalScene.L(view, 1.8, 1));
        p.noFill();
        p.rect(view.toScreenX(CELL.x), view.toScreenY(CELL.y),
               ThermalScene.L(view, CELL.w), ThermalScene.L(view, CELL.h));
    }

    /** 比例尺：一條線加兩端的短豎線，講清楚「這一盒實際上多大」。 */
    function drawScaleBar(p, view, pr) {
        const y = 348;
        ThermalScene.strokeOn(p, [100, 116, 139], ThermalScene.L(view, 1.5, 1));
        p.line(view.toScreenX(CELL.x), view.toScreenY(y),
               view.toScreenX(CELL.x + CELL.w), view.toScreenY(y));
        for (const x of [CELL.x, CELL.x + CELL.w]) {
            p.line(view.toScreenX(x), view.toScreenY(y - 5),
                   view.toScreenX(x), view.toScreenY(y + 5));
        }
    }

    /**
     * 圖：流速 U 對 log₁₀ Ra，沿著**溫差滑桿**那一條路徑畫。
     *
     * ⚠️ y 軸的「流速」在門檻以下是**嚴格 0**，所以曲線會貼在橫軸上走一段
     *    才折起來——那道折角就是門檻。這比畫一條垂直線更有說服力：學生看到
     *    的是「同一個流體，只是溫差一直加上去，加到某個值就突然開始動」。
     */
    function drawUdGraph(p, view, pr) {
        const pts = [];
        let uMax = 0;
        for (let i = 0; i <= 40; i++) {
            const dT = DTEMP.min + (DTEMP.max - DTEMP.min) * i / 40;
            const ra = ThermalKit.rayleigh({
                beta: pr.f.beta, dT, L: pr.L, nu: pr.f.nu, alpha: pr.f.alpha,
            });
            const u = ThermalKit.buoyantSpeed({
                beta: pr.f.beta, dT, L: pr.L, nu: pr.f.nu, alpha: pr.f.alpha,
                ra, raC: pr.raC,
            }) * 1000;
            uMax = Math.max(uMax, u);
            pts.push({ x: Math.log10(Math.max(1e-12, ra)), y: u });
        }

        // ⚠️ x 軸是 log₁₀Ra，**刻度一定要落在整數上**：drawGraph 的刻度文字
        //    會被 trim() 四捨五入（`trim(3.5)` 印出「4」），非整數的刻度會
        //    變成「格線在騙人」。所以 lo/hi 取整數，格數再挑一個能整除跨度的。
        const lc = Math.log10(pr.raC);
        let lo = Math.floor(Math.min(pts[0].x, lc - 0.45));
        let hi = Math.ceil(Math.max(pts[pts.length - 1].x, lc + 0.45));
        let xTicks = 0;
        for (const t of [5, 4, 6, 3]) {
            if ((hi - lo) % t === 0 && (hi - lo) / t <= 2) { xTicks = t; break; }
        }
        if (!xTicks) {
            while ((hi - lo) % 4 !== 0) hi++;
            xTicks = 4;
        }
        const yMax = ThermalScene.niceMax(Math.max(uMax, 1e-3) * 1.15, 5);

        ThermalScene.drawGraph(p, view, {
            x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
            xMin: lo, xMax: hi, yMin: 0, yMax,
            xTicks, yTicks: 5,
            xLabel: '雷利數 log₁₀ Ra', xUnit: '',
            yLabel: '典型流速 U', yUnit: 'mm/s',
            plate: true,
            title: `流速對雷利數（${pr.f.name}，層厚 ${(pr.L * 1000).toFixed(0)} mm）`,
            lines: [{
                from: { x: lc, y: 0 }, to: { x: lc, y: yMax },
                col: [148, 163, 184], dash: true, label: 'Ra_c = 1708',
            }],
            series: [{ pts, col: [37, 99, 235], r: 2, join: true }],
            marker: {
                x: Math.max(lo, Math.min(hi, Math.log10(Math.max(1e-12, pr.ra)))),
                y: Math.min(pr.U * 1000, yMax), col: [220, 38, 38],
            },
        });
    }

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    // ⚠️ 這個守衛不能拿掉：`verify-thermal.js` 要把這一頁整支抓進 Node，直接
    //    呼叫 seedStreamlines() 去斷言「粒子有沒有真的沿著流線走」。沒有守衛的話
    //    node 一讀檔就會死在 ThermalScene.run() 找不到 document。
    //    （畫面的部分在 Node 裡完全不執行，只借這一頁的**物理**出去驗。）
    if (typeof document !== 'undefined') ThermalScene.run(PAGE);

    if (typeof window !== 'undefined') {
        window.__page = {
            CELL, GRAPH, N_ROLL, propsFor, tminOf, tmaxOf, stateOf, sci, fmtNum,
            seedStreamlines, RINGS, RING_PTS, N_TRACER,
            physTime: () => physTime,
            tracerCount: () => (TR ? TR.list.length : 0),
            tracerPos: () => (TR ? TR.list.map(m => [m.x, m.z]) : []),
        };
    }
})();
