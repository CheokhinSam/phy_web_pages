/**
 * 🔥 電功率與電能
 *
 * 三個寫法，一個量：
 *
 *   P = V·I = I²R = V²/R
 *
 * 右邊三張卡片同時顯示這三個算法。它們永遠相等——不是巧合，是同一個量
 * 換一個角度看。選哪一個純粹看「哪個量是固定的」：串聯用 I²R、並聯用
 * V²/R、只知道電壓電流就用 VI。
 *
 * 再往下是電能與電費：E = P·t，一度電 = 1 kWh。最後是保險絲——電流超過
 * 額定值就當場熔斷、電路開路、所有讀數歸零，按「重設」才復原。
 *
 * ⚠️ 保險絲的判斷寫在 onSample（拿到 sol 之後），不是 onFrame（解電路之前）
 *    ——onFrame 的時候這一幀的電流還不知道。所以熔斷會慢一幀，這剛好也是
 *    真實的因果順序：先有過大的電流，保險絲才斷。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 circuit-scene.js）
    // ======================================================================
    //   TL ─[F1]─ TF ─[A1]─ TM ────[RW]──── TR      ← 上：保險絲、電流、電器
    //   │                    │               │
    //  [bat]               (w2 下潛)      (w1 下潛)
    //   │                    │               │
    //   │                 TMd ────[V1]──── TRd      ← 伏特計**並聯**在電器兩端
    //   │                                    │
    //   BL ──────────── BRe ─────────────────┘
    //
    // ⚠️ 伏特計一定要有自己的下潛支路（TMd／TRd）。第一版把 V1 接在
    //    「TR → 右邊 → 回來」的**迴路上**，結果 V1 和電器串聯——電流被
    //    1 MΩ 卡住，整個電路只剩 1.2×10⁻⁵ A，電器形同沒接。
    //    並聯＝兩個元件接在**同一對節點**之間，不是接在迴路上。
    const NODES = {
        TL:  { x: 190, y: 140 }, TF: { x: 330, y: 140 },
        TM:  { x: 470, y: 140 }, TR: { x: 650, y: 140 },
        TMd: { x: 400, y: 290 }, TRd: { x: 650, y: 290 },
        BL:  { x: 190, y: 500 }, BRe: { x: 650, y: 500 },
    };
    const R_INT = 1.0;
    const RATE = 1.2;               // 電費：每度電（kWh）1.2 元

    /**
     * 保險絲熔斷與否是這一頁自己的狀態（不是滑桿）。放在模組層級，
     * circuitFor() 直接讀它——所以「畫的電路」和「算的電路」看到的是
     * 同一個 blown。
     */
    let blown = false;
    let energy = 0;                 // 累積電能（焦耳）
    let lastT = 0;

    function circuitFor(panel) {
        return {
            ground: 'BL',
            nodes: NODES,
            parts: [
                { id: 'bat', kind: 'battery',   from: 'TL',  to: 'BL', emf: panel.emf, r: R_INT },
                { id: 'F1',  kind: 'fuse',      from: 'TL',  to: 'TF', rating: panel.rating, blown: blown },
                { id: 'A1',  kind: 'ammeter',   from: 'TF',  to: 'TM' },
                { id: 'RW',  kind: 'resistor',  from: 'TM',  to: 'TR', R: panel.Rapp },
                // 伏特計的兩條下潛支路。bend 'v' 是「先垂直離開 from 再轉」，
                // 這樣它從 TM 直直往下、再橫向接到 TMd，不會壓到上面的元件列。
                { id: 'w1',  kind: 'wire',      from: 'TR',  to: 'TRd' },
                { id: 'w2',  kind: 'wire',      from: 'TM',  to: 'TMd', bend: 'v' },
                { id: 'V1',  kind: 'voltmeter', from: 'TMd', to: 'TRd' },
                { id: 'w3',  kind: 'wire',      from: 'TRd', to: 'BRe' },
                { id: 'w4',  kind: 'wire',      from: 'BRe', to: 'BL' },
            ],
        };
    }

    // ======================================================================
    // 電流表（顯示現在離熔斷還有多遠）
    // ======================================================================
    const GAUGE = { x: 190, y: 590, w: 580, h: 26 };

    function drawGauge(p, view, I, rating) {
        const gx = view.toScreenX(GAUGE.x), gy = view.toScreenY(GAUGE.y);
        const gw = view.len(GAUGE.w), gh = view.len(GAUGE.h);
        const full = rating * 1.6;          // 滿刻度 = 額定值的 1.6 倍
        const frac = Math.min(1, Math.abs(I) / full);

        p.noStroke();
        p.fill(241, 245, 249);
        p.rect(gx, gy, gw, gh);
        p.fill(blown ? [220, 38, 38] : [37, 99, 235]);
        p.rect(gx, gy, gw * frac, gh);

        // 額定值的位置：一條紅線，越過它就會斷
        const rx = gx + gw * (rating / full);
        p.stroke(220, 38, 38);
        p.strokeWeight(view.len(3, 2));
        p.line(rx, gy - view.len(6), rx, gy + gh + view.len(6));
        p.noStroke();

        p.fill(15, 23, 42);
        p.textSize(view.len(13, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text(`電流 I = ${Math.abs(I).toFixed(3)} A`, gx, gy - view.len(8));
        p.fill(220, 38, 38);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text(`額定 ${rating} A`, rx, gy - view.len(8));
        p.fill(100, 116, 139);
        p.textStyle(p.NORMAL);
        p.textSize(view.len(12, 8));
        p.textAlign(p.LEFT, p.TOP);
        p.text('滿刻度 ' + full.toFixed(1) + ' A', gx, gy + gh + view.len(6));
    }

    // ======================================================================
    // 啟動
    // ======================================================================
    CircuitScene.run({
        formula: 'P = VI = I^2R = \\dfrac{V^2}{R}',
        formulaFallback: 'P = VI = I²R = V²/R',

        controls: {
            selects: [
                // ⚠️ def 要跟 options 同一型別（都是字串）。寫 def: 3 的話
                //    這一格宣告的預設值不屬於它自己的任何一個選項——瀏覽器
                //    靠 .value = 3 隱式轉成 "3" 才沒出事，但那是在依賴一個
                //    沒人寫下來的巧合。驗證腳本會直接抓到這件事。
                { key: 'rating', label: '保險絲額定電流', def: '3',
                  options: [
                      { v: '1', t: '1 A' },
                      { v: '2', t: '2 A' },
                      { v: '3', t: '3 A' },
                      { v: '5', t: '5 A' },
                      { v: '8', t: '8 A' },
                  ] },
            ],
            sliders: [
                { key: 'emf',  label: '電源電壓 ε', min: 6, max: 24, step: 1, def: 12, unit: 'V', dec: 0 },
                { key: 'Rapp', label: '電器電阻 R', min: 2, max: 40, step: 1, def: 10, unit: 'Ω', dec: 0 },
            ],
        },

        cards: [
            // 三張全開 highlight，不是漏了哪一張：這一頁的賣點就是「三個算式
            // 是同一個量」，三張並排長得一樣才是那句話的視覺版本。只挑兩張
            // 亮反而暗示有一個是主角、另一個是配角。
            { label: 'P = V I',   id: 'cardPvi',  unit: 'W', highlight: true },
            { label: 'P = I²R',   id: 'cardPi2r', unit: 'W', highlight: true },
            { label: 'P = V²/R',  id: 'cardPv2r', unit: 'W', highlight: true },
            { label: '電流 I',    id: 'cardI', unit: 'A' },
            { label: '累積電能 E = Pt', id: 'cardE', unit: 'J' },
            { label: '用 1 小時的電費', id: 'cardCost', unit: '元' },
        ],

        circuit: (t, panel) => {
            // 選單回傳的是字串，額定值要轉成數字
            const p = Object.assign({}, panel, { rating: parseFloat(panel.rating) });
            return circuitFor(p);
        },

        /**
         * 熔斷判斷與電能累積都在這裡（拿到 sol 之後）。
         * 面板一變也會被呼叫，但那個時候 t 沒動，dt = 0，不會累積。
         */
        onSample(t, panel, sol) {
            const dt = t - lastT;
            lastT = t;
            if (!sol.ok || dt <= 0 || dt > 0.5) return;

            const V = Math.abs(sol.partV.RW || 0);
            const Iapp = Math.abs(sol.partI.RW || 0);      // 電器裡的電流
            const Ifuse = Math.abs(sol.partI.F1 || 0);     // 保險絲看到的**總**電流
            const rating = parseFloat(panel.rating);

            energy += V * Iapp * dt;    // 電器消耗的電能

            // 保險絲燒不燒看的是流過它自己的電流（＝主線總電流，含伏特計那支）
            if (!blown && Ifuse > rating + 1e-9) {
                blown = true;           // 下一幀的電路就是開路了
            }
        },

        onReset() {
            blown = false;
            energy = 0;
            lastT = 0;
        },

        values(t, panel, sol) {
            if (!sol.ok || blown) {
                // 熔斷之後電路開路，功率歸零；電費也就沒了。
                return {
                    cardPvi: '0.00', cardPi2r: '0.00', cardPv2r: '0.00',
                    cardI: '0.000',
                    cardE: energy.toFixed(1),
                    cardCost: '0.000',
                };
            }
            const V = Math.abs(sol.partV.RW || 0);
            // ⚠️ 用**電器自己的**電流（partI.RW），不是安培計的讀數。
            //    安培計在主線上，它量到的還包含伏特計那一支偷走的 ~V/1MΩ。
            //    那一支不流過電器、也不在電器裡發熱，算進來的話 P=VI 會比
            //    P=V²/R 大 1e-5——三個寫法就對不起來了。
            const I = Math.abs(sol.partI.RW || 0);
            const R = panel.Rapp;
            return {
                // 三個寫法，同一個量。卡片並排就是為了看它們一模一樣。
                cardPvi:  (V * I).toFixed(3),
                cardPi2r: (I * I * R).toFixed(3),
                cardPv2r: (V * V / R).toFixed(3),
                cardI: I.toFixed(3),
                cardE: energy.toFixed(1),
                // 電費要累積到看得見的位數得連續用一小時，所以這一格是
                // 「照這個功率用一小時」的預估，不是這幾秒鐘的累積。
                cardCost: (V * I / 1000 * RATE).toFixed(3),
            };
        },

        titleText(t, panel, sol) {
            if (blown) {
                return `⚠ 保險絲熔斷（額定 ${panel.rating} A）——電路開路，按「重設」復原`;
            }
            if (!sol.ok) return '⚠ ' + sol.reason;
            const V = Math.abs(sol.partV.RW || 0);
            const I = Math.abs(sol.partI.RW || 0);
            return `V = ${V.toFixed(2)} V　I = ${I.toFixed(3)} A　`
                 + `P = ${(V * I).toFixed(2)} W　${(V * I / 1000).toFixed(4)} kWh/小時`;
        },

        draw(p, view, t, panel, sol, C) {
            const I = sol.ok ? Math.abs(sol.partI.A1 || 0) : 0;
            const rating = parseFloat(panel.rating);

            CircuitScene.drawCircuit(p, view, C, sol, {
                t: t,
                carrier: 'current',
                iref: 2,
                speed: 40,
                badges: [
                    { id: 'F1', text: '保險絲', dy: -46, size: 13 },
                    { id: 'A1', text: '安培計', dy: -46, size: 13 },
                    { id: 'RW', text: `電器 R = ${panel.Rapp} Ω`, dy: -46, size: 14 },
                    { id: 'V1', text: '伏特計（並聯）', dy: -48, size: 13 },
                ],
            });

            drawGauge(p, view, I, rating);

            if (blown) {
                CircuitScene.badge(p, view, 480, 690,
                                   `⚠ 電流超過 ${rating} A，保險絲熔斷`,
                                   { size: 19, col: CircuitScene.C_HOT });
            } else if (!sol.ok) {
                CircuitScene.badge(p, view, 480, 690, '⚠ ' + sol.reason,
                                   { size: 18, col: CircuitScene.C_HOT });
            }
        },
    });

    // 驗證出口：三個功率寫法必須在任何滑桿組合下都相等（這是這頁的核心宣稱），
    // 以及「電流超過額定值就熔斷」。
    if (typeof window !== 'undefined') {
        window.__page = {
            circuitFor, NODES, RATE,
            state: () => ({ blown, energy }),
            setBlown: v => { blown = v; },
            probes: { V: 'RW', I: 'A1', total: 'A1' },
        };
    }
})();
