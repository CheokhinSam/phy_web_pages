/**
 * ⚡ 歐姆定律
 *
 * 一條迴路：電池 → 安培計 → 滑動變阻器 → 待測電阻 R → 回電池。
 * 伏特計並聯在 R 的兩端。右邊的 V–I 圖上**每一點都是一次真實的量測**：
 * 就是伏特計與安培計當下讀到的那兩個數，由 CircuitKit 解出來的。
 *
 * ⚠️ 這裡的電路是**一份資料**（NODES + parts），畫圖與求解吃的是同一份。
 *    舊版 ohms-law.js 的 V–I 圖是 31 個預先算好的點 y = v/totalR 鋪出來的
 *    理論線，跟當下的電路無關——拉電壓滑桿它不會動，而 markdown 卻宣稱
 *    「即時追蹤」。現在圖上的點只可能來自 solve()，這一類錯誤在結構上
 *    不可能再發生。
 *
 * ⚠️ 圖畫在 p5 畫布上（CircuitScene.drawGraph），不是 PhysicsUtils.createChart
 *    ——後者是**時間序列**（pushData(t, v)，x 軸只能是時間），畫不了
 *    「x 軸是電壓」的圖。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 circuit-scene.js）
    // ======================================================================
    // 電路：一個矩形。左邊是電池，上面是安培計＋滑動變阻器，右邊是待測
    // 電阻，伏特計再往外掛一條並聯支路。
    //
    //   TL ──[A1]── TM ──[RH]── TR ── TRv        ← 上：量電流、調電流
    //   │                       │        │
    //  [bat]                   [R1]     [V1]      ← 右：待測電阻與它的電壓
    //   │                       │        │
    //   BL ───────────────────── BR ── BRv        ← 下：回電池
    const NODES = {
        TL:  { x: 250, y: 120 },
        TM:  { x: 400, y: 120 },
        TR:  { x: 560, y: 120 },
        TRv: { x: 660, y: 120 },
        BRv: { x: 660, y: 330 },
        BR:  { x: 560, y: 330 },
        BL:  { x: 250, y: 330 },
    };
    const R_INT = 0.5;          // 電池內電阻，固定值

    function circuitFor(panel) {
        return {
            ground: 'BL',
            nodes: NODES,
            parts: [
                // from 是 + 端：電流從 TL 流出，順時針繞一圈
                { id: 'bat', kind: 'battery',   from: 'TL',  to: 'BL',  emf: panel.emf, r: R_INT },
                { id: 'A1',  kind: 'ammeter',   from: 'TL',  to: 'TM' },
                { id: 'RH',  kind: 'rheostat',  from: 'TM',  to: 'TR',  R: panel.Rh },
                { id: 'R1',  kind: 'resistor',  from: 'TR',  to: 'BR',  R: panel.Rload },
                { id: 'V1',  kind: 'voltmeter', from: 'TRv', to: 'BRv' },
                { id: 'w1',  kind: 'wire',      from: 'TR',  to: 'TRv' },
                { id: 'w2',  kind: 'wire',      from: 'BRv', to: 'BR' },
                { id: 'w3',  kind: 'wire',      from: 'BR',  to: 'BL' },
            ],
        };
    }

    // ======================================================================
    // V–I 圖
    // ======================================================================
    const GX = 250, GY = 440, GW = 410, GH = 270;
    // 兩軸上限要涵蓋滑桿的**整個**範圍，不然點會跑出圖外；但也不能開太大，
    // 否則直線只佔左下角一小段，斜率看不出來。實測極值：
    //   最大 V = ε·R/(R+r) = 8×20/20.5 = 7.81 V（R 最大、Rh = 0）
    //   最大 I = ε/(R+r)   = 8/4.5     = 1.78 A（R 最小、Rh = 0）
    // 所以 8 V × 2.0 A 剛好，預設參數下也用到 71% 的寬度。
    const XV_MAX = 8;           // 電壓軸上限（V）
    const YI_MAX = 2.0;         // 電流軸上限（A）

    // 量測點。滑桿範圍是刻意挑的：全部組合都落在這兩個軸之內。
    let pts = [];
    let seen = new Set();       // 去重——自動掃描來回走，同一個工作點會經過兩次
    let plotR = null;           // 這些點是在哪一顆待測電阻上量的

    function clearPlot() {
        pts.length = 0;         // 保持同一個陣列參考，series 才不用重建
        seen.clear();
        plotR = null;
    }

    /**
     * 落一個量測點。**這就是這頁的核心**：圖上的每一個點都對應一次真實的
     * (V, I) 讀數，不是先鋪好的理論線。
     *
     * 換待測電阻就重新開始——不同的電阻是不同的線，疊在同一張圖上會變成
     * 一團看不出所以然的東西。換電池電壓則沿用（同一顆電阻，只是工作點
     * 在線上跑）。
     */
    function sample(panel, sol) {
        if (!sol.ok) return;
        if (plotR !== panel.Rload) { clearPlot(); plotR = panel.Rload; }
        const V = Math.abs(sol.partV.R1 || 0);
        const I = Math.abs(sol.partI.A1 || 0);
        const key = V.toFixed(4) + ',' + I.toFixed(4);
        if (seen.has(key)) return;
        seen.add(key);
        pts.push({ x: V, y: I });
    }

    // ======================================================================
    // 啟動
    // ======================================================================
    CircuitScene.run({
        formula: 'V = I \\cdot R',
        formulaFallback: 'V = I R',

        controls: {
            selects: [
                { key: 'carrier', label: '顯示什麼在流動', def: 'current', live: true,
                  options: [
                      { v: 'current',  t: '傳統電流（藍，正電荷方向）' },
                      { v: 'electron', t: '電子流（橘，與電流相反）' },
                      { v: 'both',     t: '兩者並排' },
                  ] },
            ],
            sliders: [
                { key: 'emf',   label: '電池電壓 ε',   min: 2, max: 8,  step: 0.5, def: 6,  unit: 'V', dec: 1 },
                { key: 'Rload', label: '待測電阻 R',   min: 4, max: 20, step: 1,   def: 10, unit: 'Ω', dec: 0 },
                { key: 'Rh',    label: '滑動變阻器 Rh', min: 0, max: 20, step: 1,   def: 10, unit: 'Ω', dec: 0 },
            ],
        },

        cards: [
            { label: '伏特計 V',   id: 'cardV', unit: 'V', highlight: true },
            { label: '安培計 I',   id: 'cardI', unit: 'A', highlight: true },
            { label: 'R = V / I',  id: 'cardR', unit: 'Ω' },
            { label: '功率 P',     id: 'cardP', unit: 'W' },
            { label: '電荷 Q = It', id: 'cardQ', unit: 'C' },
            { label: '通電時間',   id: 'cardT', unit: 's' },
        ],

        circuit: (t, panel) => circuitFor(panel),

        /**
         * 跑起來之後，滑動變阻器自己來回掃一遍——圖上的線就一顆一顆長出來。
         * 手動拉滑桿也一樣會落點（onSample 在面板變動時也會被呼叫），
         * 只是自動掃描比較容易看出「這些點連起來是一條直線」。
         */
        onFrame(t, panel) {
            const rg = panel.range('Rh');
            if (!rg) return;
            const period = 10;                              // 秒
            const u = (t % period) / period;
            const tri = u < 0.5 ? u * 2 : (1 - u) * 2;      // 0 → 1 → 0
            const snap = Math.round((rg.min + (rg.max - rg.min) * tri) / rg.step) * rg.step;
            if (Math.abs(snap - panel.Rh) > 1e-9) panel.set('Rh', snap);
        },

        onSample: (t, panel, sol) => sample(panel, sol),

        onReset(reason) {
            if (reason === 'start' || reason === 'reset') clearPlot();
        },

        values(t, panel, sol) {
            const V = Math.abs(sol.partV.R1 || 0);
            const I = Math.abs(sol.partI.A1 || 0);
            return {
                cardV: V.toFixed(2),
                cardI: I.toFixed(3),
                // V/I 自己就是一個量測：不管滑桿怎麼動，這張卡片都該是 10.00
                cardR: (I > 1e-9 ? V / I : 0).toFixed(2),
                cardP: (V * I).toFixed(3),
                cardQ: (I * t).toFixed(2),
                cardT: t.toFixed(1),
            };
        },

        titleText(t, panel, sol) {
            if (!sol.ok) return '⚠ ' + sol.reason;
            const V = Math.abs(sol.partV.R1 || 0);
            const I = Math.abs(sol.partI.A1 || 0);
            const R = I > 1e-9 ? V / I : 0;
            return `V = ${V.toFixed(2)} V　I = ${I.toFixed(3)} A　R = V / I = ${R.toFixed(2)} Ω`;
        },

        draw(p, view, t, panel, sol, C) {
            CircuitScene.drawCircuit(p, view, C, sol, {
                t: t,
                carrier: panel.carrier,
                iref: 0.4,
                speed: 44,
                badges: [
                    { id: 'A1', text: '安培計', dy: -48, size: 13 },
                    { id: 'RH', text: `Rh = ${panel.Rh} Ω`, dy: -48, size: 13 },
                    { id: 'R1', text: `R = ${panel.Rload} Ω`, dx: -52, align: 'right', size: 14 },
                    { id: 'V1', text: '伏特計', dx: 44, align: 'left', size: 13 },
                ],
            });

            if (!sol.ok) {
                CircuitScene.badge(p, view, 450, 560, '⚠ ' + sol.reason,
                                   { size: 18, col: CircuitScene.C_HOT });
                return;
            }

            const V = Math.abs(sol.partV.R1 || 0);
            const I = Math.abs(sol.partI.A1 || 0);

            // 理論線 V = I·R。斜率 1/R 就是「這顆電阻的電阻值」的倒數——
            // 換一顆電阻，斜率就變。端點要夾在量程內，不然線會畫出座標軸。
            const xEnd = Math.min(XV_MAX, YI_MAX * panel.Rload);

            CircuitScene.drawGraph(p, view, {
                x: GX, y: GY, w: GW, h: GH,
                xMin: 0, xMax: XV_MAX, yMin: 0, yMax: YI_MAX,
                xTicks: 4, yTicks: 4,
                xLabel: '伏特計讀數 V', xUnit: 'V',
                yLabel: '安培計讀數 I', yUnit: 'A',
                title: 'V–I 圖：每一點都是一次真實讀數',
                lines: [{
                    from: { x: 0, y: 0 }, to: { x: xEnd, y: xEnd / panel.Rload },
                    col: [148, 163, 184], dash: true,
                    label: `V = I·R（R = ${panel.Rload} Ω）`,
                }],
                series: [{ pts: pts, col: [37, 99, 235], r: 3.5 }],
                marker: { x: V, y: I, col: [220, 38, 38] },
            });
        },
    });

    // 讓 verify-electricity.js 能把**這一頁真正的電路**抓去斷言（短路掃描、
    // V–I 每一點等於 solve() 的輸出）。沒有這個出口，驗證就只能自己再抄一份
    // 電路——而抄錯的那一份正是舊版出錯的地方，驗它等於沒驗。
    // 純 Node 環境沒有 window，所以要有守衛。
    if (typeof window !== 'undefined') {
        window.__page = {
            circuitFor, NODES,
            // 這一頁的 (V, I) 是量在哪兩個元件上、以及哪個滑桿是「待測電阻」。
            // 驗證端由此得知「掃哪些滑桿時圖上的點屬於同一條線」。
            probes: { V: 'R1', I: 'A1', load: 'Rload' },
        };
    }
})();
