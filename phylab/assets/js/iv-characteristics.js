/**
 * 📈 非歐姆元件的 I–V 特性曲線
 *
 * 四種元件，同一套量測：金屬、鎢絲燈泡、二極體、熱敏電阻。
 *
 * 課綱的指定實驗「比較歐姆與非歐姆導體的 V–I 圖」：只有**金屬**是直線，
 * 其他三種都不是。而「電阻」這個詞對非歐姆元件只在**某一點**有意義——
 * 圖上任意一點的 V/I 都算得出一個數，但那個數會隨工作點跑。
 *
 * ⚠️ 電壓掃描一定要**跨過負值**（−6 V → +6 V）。二極體的逆向特性和順向
 *    完全是兩回事，只掃正半邊的話看不到「單向導通」這件事——而那是這頁
 *    最想給學生看的一張圖。
 *
 * ⚠️ 四個元件的電流尺度差很多（二極體順向 ~1.8 A、熱敏電阻 ~0.07 A），
 *    所以縱軸上限是**每個元件各自的**，不然熱敏電阻會被壓成一條貼著軸的線。
 *    橫軸則固定 ±6 V，四張圖才比得出「誰是直線」。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 circuit-scene.js）
    // ======================================================================
    //   TL ─[A1]─ TM ───[DUT]─── TR ──w3── BRr
    //    │          │              │            │
    //  [bat]       w1             w2           w4
    //    │          │              │            │
    //   BL ──────  TMv ──[V1]── TRv ────────  BR
    //
    // ⚠️ 伏特計要跨在**待測元件自己的兩個節點**（TM、TR）上。
    //    舊版把 V1 接在 VL–VLb，而那兩點經 w1/w2 分別連到 TL、BL——也就
    //    是**電池的兩個端子**，不是待測元件的兩端（見下方 parts 的註解）。
    const NODES = {
        TL:  { x: 170, y: 120 }, TM:  { x: 350, y: 120 },
        TR:  { x: 560, y: 120 }, BRr: { x: 730, y: 120 },
        TMv: { x: 350, y: 250 }, TRv: { x: 560, y: 250 },
        BL:  { x: 170, y: 400 }, BR:  { x: 730, y: 400 },
    };
    const R_INT = 1.0;
    const V_SWEEP = 6;          // 掃描電壓上限（±）

    /**
     * 四種待測元件。`imax` 是這一張圖的縱軸上限——刻意每個元件不同，
     * 因為它們的電流差了兩個數量級。`note` 是卡片上要講的那句物理。
     */
    const DEVICES = {
        metal: {
            name: '金屬線', part: { kind: 'resistor', R: 10 }, imax: 0.8,
            ohmic: true,
        },
        bulb: {
            name: '鎢絲燈泡', part: { kind: 'bulb', R0: 4, heat: 0.42 }, imax: 0.8,
            ohmic: false,
        },
        diode: {
            name: '二極體', part: { kind: 'diode' }, imax: 2.0,
            ohmic: false,
        },
        thermistor: {
            name: '熱敏電阻', part: { kind: 'thermistor' }, imax: 0.08,
            ohmic: false,
        },
    };

    function dev(panel) { return DEVICES[panel.device] || DEVICES.metal; }

    function circuitFor(panel) {
        return {
            ground: 'BL',
            nodes: NODES,
            parts: [
                { id: 'bat', kind: 'battery',   from: 'TL', to: 'BL', emf: panel.emf, r: R_INT },
                { id: 'A1',  kind: 'ammeter',   from: 'TL', to: 'TM' },
                Object.assign({ id: 'DUT', from: 'TM', to: 'TR' }, dev(panel).part),
                // ⚠️ V1 和 DUT 接在**同一對節點**（TM、TR）之間，這才是並聯的
                //    定義——量到的才是待測元件自己的電壓。
                //    舊版是 w1: VL→TL、w2: VLb→BL，V1 因此跨在 TL–BL 上，
                //    也就是**電池的端電壓**。因為 A1 是 0 Ω、而整個迴路除了
                //    待測元件沒有別的東西，兩個數字**剛好一樣**，所以畫面、
                //    卡片、曲線全都是對的——錯的只有那條線接在哪裡。
                //    一旦 A1 有了內阻（真實安培計就是這樣），V1 讀到的就會
                //    是電池端電壓而不是 DUT 電壓，這頁的整條曲線跟著錯誤。
                //    「畫的電路」和「算的電路」必須是同一份資料，這正是這頁
                //    用求解器的理由；接錯節點等於把那個理由丟掉。
                { id: 'w1',  kind: 'wire',      from: 'TM',  to: 'TMv' },
                { id: 'V1',  kind: 'voltmeter', from: 'TMv', to: 'TRv' },
                { id: 'w2',  kind: 'wire',      from: 'TR',  to: 'TRv' },
                // 回電池的路（w3→w4→w5）保持**純導線**，不要穿過任何錶
                { id: 'w3',  kind: 'wire',      from: 'TR',  to: 'BRr' },
                { id: 'w4',  kind: 'wire',      from: 'BRr', to: 'BR' },
                { id: 'w5',  kind: 'wire',      from: 'BR',  to: 'BL' },
            ],
        };
    }

    // ======================================================================
    // I–V 圖
    // ======================================================================
    const GX = 250, GY = 460, GW = 420, GH = 280;

    let pts = [];
    let seen = new Set();
    let plotDev = null;

    function clearPlot() { pts.length = 0; seen.clear(); }

    function sample(panel, sol) {
        if (!sol.ok) return;
        if (plotDev !== panel.device) { clearPlot(); plotDev = panel.device; }
        const V = sol.partV.DUT || 0;
        const I = sol.partI.DUT || 0;
        const key = V.toFixed(4) + ',' + I.toFixed(5);
        if (seen.has(key)) return;
        seen.add(key);
        pts.push({ x: V, y: I });
    }

    /** 電阻可能橫跨 6 個數量級（二極體逆向 ~10 MΩ），大字要換單位才讀得出來 */
    function fmtR(R) {
        if (R == null || !isFinite(R)) return '∞';
        const a = Math.abs(R);
        if (a >= 1e6) return (R / 1e6).toFixed(2) + ' M';
        if (a >= 1e3) return (R / 1e3).toFixed(2) + ' k';
        return R.toFixed(2);
    }

    // ======================================================================
    // 啟動
    // ======================================================================
    CircuitScene.run({
        formula: 'R = \\dfrac{V}{I} \\;\\text{只在該點有意義}',
        formulaFallback: 'R = V / I（只在該點有意義）',

        controls: {
            selects: [
                { key: 'device', label: '待測元件', def: 'metal',
                  options: [
                      { v: 'metal',      t: '金屬線（歐姆）' },
                      { v: 'bulb',       t: '鎢絲燈泡（越熱越大）' },
                      { v: 'diode',      t: '二極體（單向）' },
                      { v: 'thermistor', t: '熱敏電阻（越熱越小）' },
                  ] },
            ],
            sliders: [
                { key: 'emf', label: '電源電壓 ε', min: -V_SWEEP, max: V_SWEEP, step: 0.25, def: 0, unit: 'V', dec: 2 },
            ],
        },

        cards: [
            { label: '電壓 V',   id: 'cardV', unit: 'V' },
            { label: '電流 I',   id: 'cardI', unit: 'A', highlight: true },
            { label: 'R = V / I', id: 'cardR', unit: 'Ω', highlight: true },
            { label: '功率 P',   id: 'cardP', unit: 'W' },
            { label: '待測元件', id: 'cardDev', unit: '' },
            { label: '狀態',     id: 'cardState', unit: '' },
        ],

        circuit: (t, panel) => circuitFor(panel),

        /**
         * 電壓自己從 −6 V 掃到 +6 V 再回來，I–V 曲線就一點一點被描出來。
         * 負半邊不能省——二極體的逆向特性全在那裡。
         */
        onFrame(t, panel) {
            const rg = panel.range('emf');
            if (!rg) return;
            const period = 16;
            const u = (t % period) / period;
            const tri = u < 0.5 ? u * 2 : (1 - u) * 2;          // 0 → 1 → 0
            const snap = Math.round((rg.min + (rg.max - rg.min) * tri) / rg.step) * rg.step;
            if (Math.abs(snap - panel.emf) > 1e-9) panel.set('emf', snap);
        },

        onSample: (t, panel, sol) => sample(panel, sol),

        onReset(reason) {
            if (reason === 'reset') { clearPlot(); plotDev = null; }
        },

        values(t, panel, sol) {
            const d = dev(panel);
            if (!sol.ok) {
                return { cardV: '—', cardI: '—', cardR: '—', cardP: '—',
                         cardDev: d.name, cardState: '—' };
            }
            const V = sol.partV.DUT || 0;
            const I = sol.partI.DUT || 0;
            // 電流太小的時候 V/I 是 0/0，硬算會噴出一個沒有意義的巨大數字
            const R = Math.abs(I) > 1e-9 ? V / I : null;
            return {
                cardV: V.toFixed(3),
                cardI: I.toFixed(5),
                cardR: fmtR(R),
                cardP: (V * I).toFixed(4),
                cardDev: d.name,
                cardState: stateOf(panel, sol, R),
            };
        },

        titleText(t, panel, sol) {
            const d = dev(panel);
            if (!sol.ok) return '⚠ ' + sol.reason;
            const V = sol.partV.DUT || 0;
            const I = sol.partI.DUT || 0;
            const R = Math.abs(I) > 1e-9 ? V / I : null;
            return `${d.name}　V = ${V.toFixed(3)} V　I = ${I.toFixed(5)} A　`
                 + `R = V/I = ${fmtR(R)} Ω${d.ohmic ? '（定值）' : '（隨工作點變）'}`;
        },

        draw(p, view, t, panel, sol, C) {
            const d = dev(panel);

            CircuitScene.drawCircuit(p, view, C, sol, {
                t: t,
                carrier: 'current',
                iref: d.imax * 0.6,
                speed: 44,
                badges: [
                    { id: 'A1', text: '安培計', dy: -46, size: 13 },
                    { id: 'DUT', text: d.name, dy: -46, size: 14 },
                    { id: 'V1', text: '伏特計', dy: -46, size: 13 },
                    { id: 'bat', text: `ε = ${panel.emf.toFixed(2)} V`, dx: 62, align: 'left', size: 13 },
                ],
            });

            if (!sol.ok) {
                CircuitScene.badge(p, view, 450, 640, '⚠ ' + sol.reason,
                                   { size: 18, col: CircuitScene.C_HOT });
                return;
            }

            const V = sol.partV.DUT || 0;
            const I = sol.partI.DUT || 0;
            const im = d.imax;

            CircuitScene.drawGraph(p, view, {
                x: GX, y: GY, w: GW, h: GH,
                xMin: -V_SWEEP, xMax: V_SWEEP, yMin: -im, yMax: im,
                xTicks: 4, yTicks: 4,
                xLabel: '元件電壓 V', xUnit: 'V',
                yLabel: '元件電流 I', yUnit: 'A',
                title: d.ohmic ? '金屬：I 對 V 是直線（歐姆元件）'
                               : `${d.name}：不是直線——R = V/I 隨工作點在變`,
                lines: [
                    // 兩條穿過原點的主軸。drawGraph 的軸畫在**邊界**上，
                    // 有正負號的圖一定要自己補這兩條，不然原點會跑到角落。
                    { from: { x: 0, y: -im }, to: { x: 0, y: im }, col: [100, 116, 139] },
                    { from: { x: -V_SWEEP, y: 0 }, to: { x: V_SWEEP, y: 0 }, col: [100, 116, 139] },
                ],
                series: [{ pts: pts, col: [37, 99, 235], r: 3 }],
                marker: { x: V, y: I, col: [220, 38, 38] },
            });
        },
    });

    /** 卡片上那句話：這個元件現在處在什麼狀態 */
    function stateOf(panel, sol, R) {
        const I = sol.partI.DUT || 0;
        const V = sol.partV.DUT || 0;
        switch (panel.device) {
            case 'metal':
                return '歐姆元件（R 不變）';
            case 'bulb':
                // R0 = 4；量到的 R 明顯比 4 大就代表燈絲已經燒紅了
                return R == null ? '—' : (R > 6 ? '燈絲熾熱（R 已上升）' : '燈絲偏冷');
            case 'thermistor':
                return R == null ? '—' : (R < 90 ? '發熱中（R 下降）' : '接近室溫');
            case 'diode':
                if (V < -0.1) return '逆向偏壓：幾乎不導通';
                if (Math.abs(I) < 1e-4) return '尚未超過 0.6 V 導通電壓';
                return '順向導通';
            default:
                return '—';
        }
    }

    // 驗證出口：verify-electricity.js 用它斷言
    // ① 金屬的 I–V 是直線（V/I 在每一點都一樣）
    // ② 燈泡的 R 隨功率單調上升、熱敏電阻單調下降
    // ③ 二極體逆向電流 ~0、順向要超過 0.6 V 才起來
    // ④ 圖上每一點都等於當下 solve() 的輸出
    if (typeof window !== 'undefined') {
        window.__page = {
            circuitFor, NODES, DEVICES, V_SWEEP,
            probes: { V: 'DUT', I: 'DUT', device: 'device' },
        };
    }
})();
