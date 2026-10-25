/**
 * 💡 串聯電路與並聯電路
 *
 * 兩顆**電阻不同**的燈泡，切換串聯／並聯，看電流與電壓怎麼分配。
 *
 * 這頁的賣點是燈泡的**亮度 ∝ 功率**，而兩種接法下「哪一顆比較亮」的答案
 * 剛好相反：
 *
 *   串聯：I 相同 → P = I²R → **電阻大的比較亮**
 *   並聯：V 相同 → P = V²/R → **電阻小的比較亮**
 *
 * 把「誰比較亮」和「電阻誰大」並排看，P = I²R 與 P = V²/R 這兩個寫法
 * 就不再只是公式，而是同一件事的兩面。
 *
 * ⚠️ 舊版 series-parallel.js 的並聯圖在頂端有一條導線把左右兩條軌直接
 *    接通（繞過所有燈泡），畫出來是短路、算出來的卻是理想並聯。重寫時
 *    把「不可以有 0Ω 迴路」寫成了通則斷言（verify-electricity.js ⑫），
 *    掃過每一頁的每一份電路——這一頁正是當初的苦主。
 */
(function () {
    'use strict';

    // ======================================================================
    // 兩種接法各自的版面
    // ======================================================================
    // 兩個模式的**節點表完全不一樣**（並聯有兩條軌，串聯只有一條迴路），
    // 所以 circuitFor() 直接回傳當下那一個，不需要硬湊共用座標。
    //
    // 每個伏特計都掛在自己的一對「降下點」上（TMa／TRd／TSd），不是直接
    // 從燈泡節點斜拉過去——斜拉會讓曼哈頓走線壓到燈泡身上。

    const SERIES = {
        ground: 'BL',
        nodes: {
            TL:  { x: 200, y: 120 }, TM:  { x: 340, y: 120 },
            TR:  { x: 540, y: 120 }, TS:  { x: 730, y: 120 },
            TMa: { x: 340, y: 300 }, TRd: { x: 540, y: 300 }, TSd: { x: 730, y: 300 },
            V1a: { x: 400, y: 300 }, V1b: { x: 470, y: 300 },
            V2a: { x: 600, y: 300 }, V2b: { x: 680, y: 300 },
            BL:  { x: 200, y: 420 }, BB:  { x: 730, y: 420 },
        },
    };

    const PARALLEL = {
        ground: 'BL',
        nodes: {
            TL:  { x: 200, y: 120 }, TM:  { x: 330, y: 120 },
            N1T: { x: 460, y: 120 }, N2T: { x: 620, y: 120 }, TR: { x: 760, y: 120 },
            BL:  { x: 200, y: 400 }, N1B: { x: 460, y: 400 },
            N2B: { x: 620, y: 400 }, TRB: { x: 760, y: 400 },
        },
    };

    function seriesParts(panel) {
        return [
            { id: 'bat', kind: 'battery', from: 'TL', to: 'BL', emf: panel.emf, r: 1 },
            { id: 'A1',  kind: 'ammeter', from: 'TL', to: 'TM' },
            // heat: 0 → 電阻固定（R = R0）。真燈泡是會變的（鎢絲正溫度係數），
            // 但這一頁要看的是「分配」，電阻跟著功率跑會把重點糊掉。
            // 燈泡會變的那一面留給〈📈 非歐姆元件的 I–V 特性〉。
            { id: 'L1',  kind: 'bulb', from: 'TM', to: 'TR', R0: panel.R1, heat: 0 },
            { id: 'L2',  kind: 'bulb', from: 'TR', to: 'TS', R0: panel.R2, heat: 0 },
            // 兩個伏特計，各自併在燈泡兩端
            { id: 'w1', kind: 'wire', from: 'TM',  to: 'TMa' },
            { id: 'w2', kind: 'wire', from: 'TMa', to: 'V1a' },
            { id: 'V1', kind: 'voltmeter', from: 'V1a', to: 'V1b' },
            { id: 'w3', kind: 'wire', from: 'V1b', to: 'TRd' },
            { id: 'w4', kind: 'wire', from: 'TR',  to: 'TRd' },
            { id: 'w5', kind: 'wire', from: 'TRd', to: 'V2a' },
            { id: 'V2', kind: 'voltmeter', from: 'V2a', to: 'V2b' },
            { id: 'w6', kind: 'wire', from: 'V2b', to: 'TSd' },
            { id: 'w7', kind: 'wire', from: 'TS',  to: 'TSd' },
            { id: 'w8', kind: 'wire', from: 'TSd', to: 'BB' },
            { id: 'w9', kind: 'wire', from: 'BB',  to: 'BL' },
        ];
    }

    function parallelParts(panel) {
        return [
            { id: 'bat', kind: 'battery', from: 'TL', to: 'BL', emf: panel.emf, r: 1 },
            { id: 'A1',  kind: 'ammeter', from: 'TL', to: 'TM' },
            // 上軌：TM → N1T → N2T → TR。兩個燈泡從上軌垂下來接到底軌。
            { id: 'w1',  kind: 'wire', from: 'TM',  to: 'N1T' },
            { id: 'L1',  kind: 'bulb', from: 'N1T', to: 'N1B', R0: panel.R1, heat: 0 },
            { id: 'w2',  kind: 'wire', from: 'N1T', to: 'N2T' },
            { id: 'L2',  kind: 'bulb', from: 'N2T', to: 'N2B', R0: panel.R2, heat: 0 },
            { id: 'w3',  kind: 'wire', from: 'N2T', to: 'TR' },
            // 電壓計量的是兩條軌之間的電位差——也就是每一顆燈泡的電壓
            { id: 'V1',  kind: 'voltmeter', from: 'TR', to: 'TRB' },
            // 下軌：BL → N1B → N2B → TRB
            { id: 'w4',  kind: 'wire', from: 'BL',  to: 'N1B' },
            { id: 'w5',  kind: 'wire', from: 'N1B', to: 'N2B' },
            { id: 'w6',  kind: 'wire', from: 'N2B', to: 'TRB' },
        ];
    }

    function circuitFor(panel) {
        const layout = panel.topology === 'parallel' ? PARALLEL : SERIES;
        return {
            ground: layout.ground,
            nodes: layout.nodes,
            parts: panel.topology === 'parallel' ? parallelParts(panel) : seriesParts(panel),
        };
    }

    const isPar = panel => panel.topology === 'parallel';

    // ======================================================================
    // 啟動
    // ======================================================================
    CircuitScene.run({
        formula: 'P = I^2 R \\;=\\; \\dfrac{V^2}{R}',
        formulaFallback: 'P = I²R = V²/R',

        controls: {
            selects: [
                { key: 'topology', label: '接法', def: 'series',
                  options: [
                      { v: 'series',   t: '串聯（一顆接一顆）' },
                      { v: 'parallel', t: '並聯（兩顆並排）' },
                  ] },
            ],
            sliders: [
                { key: 'R1',  label: '燈泡 1 電阻 R₁', min: 2, max: 20, step: 1, def: 4,  unit: 'Ω', dec: 0 },
                { key: 'R2',  label: '燈泡 2 電阻 R₂', min: 2, max: 20, step: 1, def: 12, unit: 'Ω', dec: 0 },
                { key: 'emf', label: '電池電壓 ε',     min: 3, max: 12, step: 0.5, def: 6, unit: 'V', dec: 1 },
            ],
        },

        cards: [
            { label: '燈泡 1 電流 I₁', id: 'cardI1', unit: 'A' },
            { label: '燈泡 2 電流 I₂', id: 'cardI2', unit: 'A' },
            { label: '燈泡 1 電壓 V₁', id: 'cardV1', unit: 'V' },
            { label: '燈泡 2 電壓 V₂', id: 'cardV2', unit: 'V' },
            { label: '總電流 I',      id: 'cardIt', unit: 'A', highlight: true },
            { label: '等效電阻 R_eq', id: 'cardReq', unit: 'Ω', highlight: true },
        ],

        circuit: (t, panel) => circuitFor(panel),

        values(t, panel, sol) {
            if (!sol.ok) {
                return { cardI1: '—', cardI2: '—', cardV1: '—', cardV2: '—',
                         cardIt: '—', cardReq: '—' };
            }
            const I1 = Math.abs(sol.partI.L1 || 0), I2 = Math.abs(sol.partI.L2 || 0);
            const V1 = Math.abs(sol.partV.L1 || 0), V2 = Math.abs(sol.partV.L2 || 0);
            const It = Math.abs(sol.partI.A1 || 0);
            // 等效電阻用「電池**端電壓** ÷ 總電流」量——不是另外填一條公式，
            // 是真的一顆一顆燈泡解出來的結果。串聯會是 R₁+R₂，並聯會是
            // R₁R₂/(R₁+R₂)，不需要頁面自己判斷接法。
            //
            // 端電壓：取電池兩個端點的電位差。sol.partV.bat **也是**同一個數
            // （求解器雖然把電池拆成「理想電源 + 串聯內電阻 r」兩個支路，但
            // 理想電源接的是內部節點，partV 仍是用對外的兩個端點算的），
            // 這裡寫 nodeV 只是因為伏特計接的就是 TL 與 BL 這兩點。
            // ⚠️ 電動勢 ε 是 panel.emf 那個滑桿值，不是 partV.bat——差額才是 Ir。
            const Vt = (sol.nodeV.TL || 0) - (sol.nodeV.BL || 0);
            const Req = It > 1e-12 ? Math.abs(Vt) / It : 0;
            return {
                cardI1: I1.toFixed(3), cardI2: I2.toFixed(3),
                cardV1: V1.toFixed(2), cardV2: V2.toFixed(2),
                cardIt: It.toFixed(3), cardReq: Req.toFixed(2),
            };
        },

        titleText(t, panel, sol) {
            if (!sol.ok) return '⚠ ' + sol.reason;
            const I1 = Math.abs(sol.partI.L1 || 0), I2 = Math.abs(sol.partI.L2 || 0);
            const V1 = Math.abs(sol.partV.L1 || 0), V2 = Math.abs(sol.partV.L2 || 0);
            if (isPar(panel)) {
                return `並聯　V₁ = V₂ = ${V1.toFixed(2)} V　`
                     + `I₁ + I₂ = ${(I1 + I2).toFixed(3)} A　V 相同、I 按 1/R 分`;
            }
            return `串聯　I₁ = I₂ = ${I1.toFixed(3)} A　`
                 + `V₁ + V₂ = ${(V1 + V2).toFixed(2)} V　I 相同、V 按 R 分`;
        },

        draw(p, view, t, panel, sol, C) {
            const bulbRef = 4;      // 功率 → 亮度的參考值

            CircuitScene.drawCircuit(p, view, C, sol, {
                t: t,
                carrier: 'current',
                iref: 0.4,
                speed: 42,
                bulbRef: bulbRef,
                // 安培計、伏特計的讀數自動標在頭上（與 06、07 兩頁一致）。
                autometer: true,
                // ⚠️ 燈泡標籤一律擺在燈泡**正上方**，兩種接法都一樣。
                //    並聯時原本寫成「L1 往左、L2 往右」（dx: ±38），理由是
                //    怕兩顆燈泡的標籤在水平方向撞在一起——但往右推的那一個
                //    會直接壓到右邊 V1 伏特計的圓圈上，把「V」整個蓋掉。
                //    （V1 在 TR–TRB 這一支，x = 760，圓圈左緣剛好在 760 − 24
                //    ＝ 736；L2 在 x = 620，加上 dx 38 之後標籤從 658 起算，
                //    再往右延伸約 90 個世界單位就跨過 736 了。）
                //    往上擺就沒有這個問題：三顆標籤在 y = 214 排成一列，
                //    水平間距分別是 115 與 95 個世界單位，都不會重疊。
                badges: [
                    { id: 'L1', text: `R₁ = ${panel.R1} Ω`, dy: -46, size: 13 },
                    { id: 'L2', text: `R₂ = ${panel.R2} Ω`, dy: -46, size: 13 },
                ],
            });

            if (!sol.ok) {
                CircuitScene.badge(p, view, 450, 660, '⚠ ' + sol.reason,
                                   { size: 18, col: CircuitScene.C_HOT });
                return;
            }

            // 每一顆燈泡的功率，標在亮度旁邊。功率大的那顆看起來比較亮——
            // 這一行字就是為了讓學生把「亮」和「P」直接連起來。
            const rows = [
                { id: 'L1', R: panel.R1 },
                { id: 'L2', R: panel.R2 },
            ];
            let y = 620;
            p.noStroke();
            p.fill(15, 23, 42);
            p.textSize(view.len(15, 10));
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.TOP);
            p.text(isPar(panel) ? '並聯：V 相同 → P = V²/R，電阻小的比較亮'
                                : '串聯：I 相同 → P = I²R，電阻大的比較亮',
                   view.toScreenX(150), view.toScreenY(560));
            for (const r of rows) {
                const V = Math.abs(sol.partV[r.id] || 0);
                const I = Math.abs(sol.partI[r.id] || 0);
                const P = V * I;
                p.fill(71, 85, 105);
                p.textSize(view.len(14, 9));
                p.textStyle(p.NORMAL);
                p.text(`${r.id === 'L1' ? '燈泡 1' : '燈泡 2'}　R = ${r.R} Ω　`
                     + `V = ${V.toFixed(2)} V　I = ${I.toFixed(3)} A　`
                     + `P = ${P.toFixed(3)} W`,
                       view.toScreenX(150), view.toScreenY(y));
                y += 30;
            }
        },
    });

    // 驗證出口：verify-electricity.js 會拿 SERIES/PARALLEL 兩份電路去掃短路、
    // 驗證串聯的 I 處處相同、並聯的 V 處處相同，以及「誰比較亮」的方向。
    if (typeof window !== 'undefined') {
        window.__page = {
            circuitFor, SERIES, PARALLEL,
            probes: { total: 'A1', R1: 'R1', R2: 'R2', emf: 'emf', topology: 'topology' },
        };
    }
})();
