/**
 * 🔋 電動勢與內電阻
 *
 * 課綱指定實驗「測定電源的內電阻」：改變外電阻，讀每一次的 (I, V)，
 * 連起來是一條直線——
 *
 *     V = ε − I·r
 *
 * 截距就是電動勢 ε（I = 0 時的端電壓，也就是開路電壓），
 * 斜率就是 −r（內電阻）。這頁把「數據處理」變成看得見的東西：
 * 按開始之後外電阻自己來回掃，點一個一個落上去。
 *
 * ⚠️ 端電壓直接讀 sol.partV.bat 就好，它就是**端電壓**，不是電動勢。
 *    求解器把電池拆成「理想電源 + 串聯 r」兩個支路，但理想電源接的是
 *    **內部節點**（__r0_bat），不是頁面看到的 to；而 partV 一律用
 *    V[from] − V[to] 這個**對外的**兩個端點去算，所以內電阻上的 Ir 已經
 *    被算進去了。實測：ε = 6、I = 0.4444、r = 0.5 → partV.bat = 5.7778
 *    = 6 − 0.2222，和 nodeV.TL − nodeV.BL 逐位相同。
 *
 *    （電動勢 ε 是滑桿給的 panel.emf，不是量出來的——它正是 V−I 圖的
 *    **截距**。差額 Ir 就是斜率造成的下降，兩者在畫面上分開顯示。）
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 circuit-scene.js）
    // ======================================================================
    //  VL ──────[V1]────── VLb      ← 伏特計在**最左邊**，直接跨在電池兩端
    //   │                    │
    //   └──┬── …  TL ─[A1]─ TM ─[RH]─ TR
    //      │         │                  │
    //    [bat]                        (w 下潛)
    //      │         │                  │
    //      └──────── BL ────────────── BR
    //
    // 伏特計要量「電池的端電壓」，所以它的兩端必須**直接**接到 TL 和 BL。
    // 掛到迴路上的任何其他地方（例如 TR、BR 之間）量到的是別的東西。
    // 把它擺在電池左邊，兩條水平短線接過去，就不會壓到上面的元件列。
    const NODES = {
        VL:  { x: 120, y: 120 }, TL: { x: 200, y: 120 },
        TM:  { x: 390, y: 120 }, TR: { x: 560, y: 120 },
        VLb: { x: 120, y: 400 }, BL: { x: 200, y: 400 }, BR: { x: 560, y: 400 },
    };

    function circuitFor(panel) {
        return {
            ground: 'BL',
            nodes: NODES,
            parts: [
                { id: 'bat', kind: 'battery',   from: 'TL', to: 'BL', emf: panel.emf, r: panel.r },
                { id: 'A1',  kind: 'ammeter',   from: 'TL', to: 'TM' },
                { id: 'RH',  kind: 'rheostat',  from: 'TM', to: 'TR', R: panel.Rext },
                { id: 'V1',  kind: 'voltmeter', from: 'VL', to: 'VLb' },
                { id: 'w1',  kind: 'wire',      from: 'VL',  to: 'TL' },
                { id: 'w2',  kind: 'wire',      from: 'VLb', to: 'BL' },
                { id: 'w3',  kind: 'wire',      from: 'TR',  to: 'BR' },
                { id: 'w4',  kind: 'wire',      from: 'BR',  to: 'BL' },
            ],
        };
    }

    // ======================================================================
    // V–I 圖
    // ======================================================================
    const GX = 230, GY = 470, GW = 440, GH = 280;
    const XV_I = 6;             // 電流軸上限（A）：最大 ε/(r+R) = 12/(1+1) = 6
    const YV_MAX = 12;          // 電壓軸上限（V）：最大就是 ε 的上限

    let pts = [];
    let seen = new Set();

    function clearPlot() { pts.length = 0; seen.clear(); }

    /** 落一個量測點：端電壓與電流都是當下解出來的，不是鋪好的理論線。 */
    function sample(sol) {
        if (!sol.ok) return;
        const V = terminalV(sol);
        const I = Math.abs(sol.partI.A1 || 0);
        const key = I.toFixed(5) + ',' + V.toFixed(5);
        if (seen.has(key)) return;
        seen.add(key);
        pts.push({ x: I, y: V });
    }

    /**
     * 端電壓 = 電池兩個端點的電位差 = ε − Ir。
     *
     * 這裡寫成節點電位差而不是 sol.partV.bat，只是因為頁面要量的就是
     * 「伏特計跨在 TL 與 BL 上讀到什麼」——伏特計接的就是這兩個節點。
     * 兩者數值逐位相同（partV 也是用對外端點算的），寫 nodeV 純粹是
     * 讓程式對應到畫面上那顆錶。**不要**改成讀 partV 就以為是 ε 了。
     */
    function terminalV(sol) {
        return Math.abs((sol.nodeV.TL || 0) - (sol.nodeV.BL || 0));
    }

    // ======================================================================
    // 啟動
    // ======================================================================
    let lastRext = null;        // 畫出來的點屬於哪一組 (ε, r)——換了就要重畫

    CircuitScene.run({
        formula: 'V = \\varepsilon - I r',
        formulaFallback: 'V = ε − I r',

        controls: {
            sliders: [
                { key: 'emf',  label: '電動勢 ε',   min: 4, max: 12, step: 0.5, def: 9, unit: 'V', dec: 1 },
                { key: 'r',    label: '內電阻 r',   min: 1, max: 4,  step: 0.5, def: 2, unit: 'Ω', dec: 1 },
                { key: 'Rext', label: '外電阻 R',   min: 1, max: 20, step: 1,   def: 8, unit: 'Ω', dec: 0 },
            ],
        },

        cards: [
            { label: '電動勢 ε',        id: 'cardEmf', unit: 'V' },
            { label: '端電壓 V',        id: 'cardV',   unit: 'V', highlight: true },
            { label: '內電阻壓降 I·r',  id: 'cardIr',  unit: 'V', highlight: true },
            { label: '電流 I',          id: 'cardI',   unit: 'A' },
            { label: '輸出功率 P = VI', id: 'cardP',   unit: 'W' },
            { label: '效率 V/ε',        id: 'cardEff', unit: '%' },
        ],

        circuit: (t, panel) => circuitFor(panel),

        /**
         * 外電阻自己來回掃，V–I 直線就一顆一顆長出來。和 01 歐姆定律
         * 同一個手法，但這裡掃的是 R、畫的是 (I, V)，斜率是 −r。
         */
        onFrame(t, panel) {
            const rg = panel.range('Rext');
            if (!rg) return;
            const u = (t % 12) / 12;
            const tri = u < 0.5 ? u * 2 : (1 - u) * 2;
            const snap = Math.round((rg.min + (rg.max - rg.min) * tri) / rg.step) * rg.step;
            if (Math.abs(snap - panel.Rext) > 1e-9) panel.set('Rext', snap);
        },

        onSample(t, panel, sol) {
            // ε 或 r 一變就是「換了一顆電池」——舊的點不屬於這條線了
            const key = panel.emf + '|' + panel.r;
            if (key !== lastRext) { lastRext = key; clearPlot(); }
            sample(sol);
        },

        onReset(reason) {
            if (reason === 'start' || reason === 'reset') clearPlot();
        },

        values(t, panel, sol) {
            if (!sol.ok) {
                return { cardEmf: panel.emf.toFixed(1), cardV: '—', cardIr: '—',
                         cardI: '—', cardP: '—', cardEff: '—' };
            }
            const V = terminalV(sol);
            const I = Math.abs(sol.partI.A1 || 0);
            // ⚠️ 壓降要用**流過電池的**電流（partI.bat），不是安培計的讀數。
            //    伏特計（1 MΩ）也跨在電池上，它那一支的電流同樣流過內電阻，
            //    同樣造成 Ir。用 I_A1 算的話 V + Ir 會比 ε 少 ~1e-5 V。
            //    兩者的差約 V/1e6 ≈ 1e-5 A，卡片上（3 位小數）看不出來。
            const Ir = Math.abs(sol.partI.bat || 0) * panel.r;
            return {
                cardEmf: panel.emf.toFixed(2),
                cardV: V.toFixed(2),
                // V + Ir 應該永遠等於 ε——這兩張 highlighted 卡片相加就是上面那張
                cardIr: Ir.toFixed(2),
                cardI: I.toFixed(3),
                cardP: (V * I).toFixed(3),
                cardEff: (V / panel.emf * 100).toFixed(1),
            };
        },

        titleText(t, panel, sol) {
            if (!sol.ok) return '⚠ ' + sol.reason;
            const V = terminalV(sol);
            const I = Math.abs(sol.partI.A1 || 0);
            const Ir = Math.abs(sol.partI.bat || 0) * panel.r;
            return `ε = ${panel.emf.toFixed(1)} V　I = ${I.toFixed(3)} A　`
                 + `V = ε − Ir = ${V.toFixed(2)} V　(Ir = ${Ir.toFixed(2)} V)`;
        },

        draw(p, view, t, panel, sol, C) {
            CircuitScene.drawCircuit(p, view, C, sol, {
                t: t,
                carrier: 'current',
                iref: 1.5,
                speed: 44,
                badges: [
                    { id: 'A1', text: '安培計', dy: -46, size: 13 },
                    { id: 'RH', text: `R = ${panel.Rext} Ω`, dy: -46, size: 13 },
                    { id: 'V1', text: '伏特計', dy: -46, size: 13 },
                    { id: 'bat', text: `ε = ${panel.emf} V　r = ${panel.r} Ω`, dx: 62, align: 'left', size: 13 },
                ],
            });

            if (!sol.ok) {
                CircuitScene.badge(p, view, 450, 620, '⚠ ' + sol.reason,
                                   { size: 18, col: CircuitScene.C_HOT });
                return;
            }

            // 理論線 V = ε − Ir，畫到 V = 0 為止（短路點 I = ε/r）
            const isc = panel.emf / panel.r;
            const iEnd = Math.min(XV_I, isc);
            const slopeCol = [148, 163, 184];

            CircuitScene.drawGraph(p, view, {
                x: GX, y: GY, w: GW, h: GH,
                xMin: 0, xMax: XV_I, yMin: 0, yMax: YV_MAX,
                xTicks: 3, yTicks: 4,
                xLabel: '電流 I', xUnit: 'A',
                yLabel: '端電壓 V', yUnit: 'V',
                title: `V–I 圖：截距 = ε = ${panel.emf.toFixed(1)} V，斜率 = −r = ${(-panel.r).toFixed(1)}`,
                lines: [
                    { from: { x: 0, y: panel.emf }, to: { x: iEnd, y: panel.emf - iEnd * panel.r },
                      col: slopeCol, dash: true, label: `V = ε − Ir` },
                    // 截距那一點：I = 0 時的端電壓就是電動勢
                    { from: { x: 0, y: panel.emf }, to: { x: 0, y: 0 },
                      col: [220, 38, 38], dash: false },
                ],
                series: [{ pts: pts, col: [37, 99, 235], r: 3.5 }],
                marker: { x: Math.abs(sol.partI.A1 || 0), y: terminalV(sol), col: [220, 38, 38] },
            });
        },
    });

    // 驗證出口：verify-electricity.js 用它斷言 V = ε − Ir、
    // 圖上每一點都等於 solve() 的輸出，以及「ε 或 r 一變就清圖」。
    if (typeof window !== 'undefined') {
        window.__page = {
            circuitFor, NODES, terminalV,
            probes: { V: 'V1', I: 'A1', total: 'A1' },
        };
    }
})();
