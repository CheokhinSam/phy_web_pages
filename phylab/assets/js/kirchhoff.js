/**
 * 🔀 基爾霍夫定律
 *
 * 雙迴路、兩顆電池、三顆電阻——這是「不能用串並聯化簡」的最小電路。
 * 中間那一支的電流方向會隨 ε₁、ε₂ 改變，是是非題而不是算術題。
 *
 *      P ─[A1]─ Pa ─[R1]─ Q ─[A2]─ Qb ─[R2]─ R
 *      │                   │                  │
 *    [E1]                 [A3]               [E2]      ← 兩顆的 ＋ 端相反：
 *      │                   │                  │          E1 的 ＋ 在上、E2 的在下
 *      S ────── w1 ─────── T ────── w2 ────── U
 *                        (接地)
 *
 *   ΣI = 0（電荷守恆）：流進節點的電荷必須全部流出去，不然節點會累積電荷。
 *   ΣV = 0（能量守恆）：繞一圈回到原點，位能變化必須是零。
 *
 * ⚠️ 這頁的電流**從頭到尾都要保留正負號**，不能取絕對值。
 *    安培計的指針只讀得到大小，但這裡的賣點正是「中間那一支會反向」——
 *    把 I₃ 取絕對值，迴路方程式在反向的那一半參數範圍裡就會寫錯，
 *    而且錯得很安靜（答案從 0 變成 2·I₃R₃，畫面照樣畫得出來）。
 *    卡片給的是大小（電表讀數），方程式給的是帶號的值，兩者分開。
 *
 * ⚠️ 迴路的 ΣV 用的是**各元件自己的定律**（電阻用 I·R、電池用 ε − I·r），
 *    不是把 partV 加起來。求解器把電池拆成「理想電源 + 內電阻」兩個支路，
 *    內電阻那一支不在頁面看到的 parts 裡，直接加 partV 不會是零。
 *    把 Ir 明明白白寫進方程式，才是學生拿伏特計繞一圈會量到的東西。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 circuit-scene.js）
    // ======================================================================
    const NODES = {
        P:  { x: 260, y: 160 }, Pa: { x: 400, y: 160 },
        Q:  { x: 520, y: 160 }, Qb: { x: 650, y: 160 }, R: { x: 780, y: 160 },
        Qa: { x: 520, y: 290 },
        S:  { x: 260, y: 440 }, T:  { x: 520, y: 440 }, U: { x: 780, y: 440 },
    };

    // 固定那幾顆。不放滑桿是為了讓側欄留給 ε₁、ε₂、R₃——只有這三個會
    // 改變電路的**行為**（ε 決定推力、R₃ 決定中間那一支好不好走）。
    const R1 = 4, R2 = 6, RINT = 0.5;

    function circuitFor(panel) {
        return {
            ground: 'T',
            nodes: NODES,
            parts: [
                // 電池的 from 是 + 端，符號會在那一側標「+」。
                { id: 'E1', kind: 'battery', from: 'P', to: 'S', emf: panel.emf1, r: RINT },
                // ⚠️ E2 的 + 在**下面**（from 是 U），和 E1 相反。這不是畫錯，
                //    是這一頁能成立的前提：兩顆電池若都把 + 放在上面，它們就
                //    都在「把電流推進節點 Q」，I₃ 恆為由上往下，永遠不會反向
                //    ——那這一頁就只剩套公式，沒有是非題了。+ 放在下面之後，
                //    兩顆在 R3 上互相對抗，ε₂ > 1.5·ε₁ 時 I₃ 就整支掉頭。
                { id: 'E2', kind: 'battery', from: 'U', to: 'R', emf: panel.emf2, r: RINT },
                { id: 'A1', kind: 'ammeter', from: 'P',  to: 'Pa' },
                { id: 'R1', kind: 'resistor', from: 'Pa', to: 'Q', R: R1 },
                { id: 'A2', kind: 'ammeter', from: 'Q',  to: 'Qb' },
                { id: 'R2', kind: 'resistor', from: 'Qb', to: 'R', R: R2 },
                { id: 'A3', kind: 'ammeter', from: 'Q',  to: 'Qa' },
                { id: 'R3', kind: 'resistor', from: 'Qa', to: 'T', R: panel.R3 },
                { id: 'w1', kind: 'wire', from: 'S', to: 'T' },
                { id: 'w2', kind: 'wire', from: 'T', to: 'U' },
            ],
        };
    }

    // ======================================================================
    // 兩個定律，寫成「用電表量得到」的形式
    // ======================================================================
    /**
     * 三個支路的電流。
     *
     * 安培計的讀數永遠是正的，所以卡片給大小；但 KCL／KVL 要帶號才寫得對。
     * 支路裡 A1 和 R1 方向一致（P→Pa→Q），A2 和 R2 一致（Q→Qb→R），
     * A3 和 R3 一致（Q→Qa→T），所以每個支路讀一顆就夠了。
     *
     * `into` 是「以流入節點 Q 為正」重寫的三個電流：A1 本來就流向 Q 取正，
     * A2、A3 的 from 端在 Q 上（是流出的）取負。
     */
    function branches(sol) {
        const a1 = sol.partI.A1 || 0;   // 方向 P→Pa：正值 = 流進 Q
        const a2 = sol.partI.A2 || 0;   // 方向 Q→Qb：正值 = 離開 Q
        const a3 = sol.partI.A3 || 0;   // 方向 Q→Qa：正值 = 離開 Q
        return {
            I1: Math.abs(a1), I2: Math.abs(a2), I3: Math.abs(a3),
            s1: a1, s2: -a2, s3: -a3,
            sum: a1 - a2 - a3,
            a1: a1, a2: a2, a3: a3,
        };
    }

    /**
     * 左迴路 P → Pa → Q → Qa → T → S → P 的 ΣV。
     * 沿著行進方向累加「電壓降」，繞一圈回到原點必須是 0：
     *   P→Pa  A1  0 Ω                    → 0
     *   Pa→Q  R1  I(Pa→Q)·R1
     *   Q→Qa  A3  0 Ω                    → 0
     *   Qa→T  R3  I(Qa→T)·R3
     *   T→S   w1  0 Ω                    → 0
     *   S→P   E1  逆著 from→to 走過電池   → −(ε₁ − I(P→S)·r)
     *
     * A1 與 R1 同向、A3 與 R3 同向，所以電流直接沿用支路的值。
     * 全部帶號——I₃ 反向時這一式仍然成立。
     */
    function kvlLeft(sol, panel) {
        const b = branches(sol);
        const Ib = sol.partI.E1 || 0;
        return b.a1 * R1 + b.a3 * panel.R3 - (panel.emf1 - Ib * RINT);
    }

    /**
     * 右迴路 R → Qb → Q → Qa → T → U → R 的 ΣV。
     *   R→Qb R2  逆著 Qb→R 走（A2 與 R2 同向） → −I(Q→Qb)·R2
     *   Qb→Q A2  0 Ω                            → 0
     *   Q→Qa A3  0 Ω                            → 0
     *   Qa→T R3  I(Qa→T)·R3
     *   T→U  w2  0 Ω                            → 0
     *   U→R  E2  順著 from→to 走過電池 → ε₂ − I(U→R)·r
     */
    function kvlRight(sol, panel) {
        const b = branches(sol);
        const Ib = sol.partI.E2 || 0;
        return (panel.emf2 - Ib * RINT) + b.a3 * panel.R3 - b.a2 * R2;
    }

    /** 三顆電阻總共吃掉多少功率。電流平方，所以不必管方向。 */
    function totalP(sol, panel) {
        const b = branches(sol);
        return b.a1 * b.a1 * R1 + b.a2 * b.a2 * R2 + b.a3 * b.a3 * panel.R3;
    }

    /** 帶號顯示：+0.545 / −0.091（用真正的減號，讀起來才不像連字號） */
    function fmtS(v, d) {
        const s = Math.abs(v).toFixed(d == null ? 3 : d);
        return (v < 0 ? '−' : '+') + s;
    }

    /** 殘差顯示：−1e−17 不要印成「-0.0000」 */
    function fmtResid(v, d) {
        const s = Math.abs(v) < 5e-5 ? 0 : v;
        return (s < 0 ? '−' : '') + Math.abs(s).toFixed(d == null ? 4 : d);
    }

    // ======================================================================
    // 啟動
    // ======================================================================
    CircuitScene.run({
        formula: '\\sum I = 0, \\qquad \\sum V = 0',
        formulaFallback: 'ΣI = 0，ΣV = 0',

        controls: {
            sliders: [
                // 預設值刻意讓 ε₂ 落在最低、ε₁ 在中間：學生第一個動作一定是
                // 把 ε₂ 往上拉，而那一拉就會經過 I₃ = 0 然後反向。
                { key: 'emf1', label: '左電池 ε₁', min: 2, max: 12, step: 0.5, def: 6, unit: 'V', dec: 1 },
                { key: 'emf2', label: '右電池 ε₂', min: 2, max: 12, step: 0.5, def: 2, unit: 'V', dec: 1 },
                { key: 'R3',   label: '中間電阻 R₃', min: 2, max: 40, step: 1,  def: 6, unit: 'Ω', dec: 0 },
            ],
        },

        cards: [
            { label: '左上支路 I₁',  id: 'cardI1',  unit: 'A' },
            { label: '右上支路 I₂',  id: 'cardI2',  unit: 'A' },
            { label: '中間支路 I₃',  id: 'cardI3',  unit: 'A', highlight: true },
            { label: '節點 Q 的 ΣI', id: 'cardKcl', unit: 'A', highlight: true },
            { label: '左迴路的 ΣV',  id: 'cardKvl', unit: 'V' },
            { label: '三電阻總功率', id: 'cardP',   unit: 'W' },
        ],

        circuit: (t, panel) => circuitFor(panel),

        values(t, panel, sol) {
            if (!sol.ok) {
                return { cardI1: '—', cardI2: '—', cardI3: '—',
                         cardKcl: '—', cardKvl: '—', cardP: '—' };
            }
            const b = branches(sol);
            return {
                // 電表讀數＝大小，方向在畫面上的電流點與黑條文字裡
                cardI1: b.I1.toFixed(3),
                cardI2: b.I2.toFixed(3),
                cardI3: b.I3.toFixed(3),
                // 這一格永遠是 0——它是**被解出來的**，不是被規定的
                cardKcl: fmtResid(b.sum),
                cardKvl: fmtResid(kvlLeft(sol, panel)),
                cardP: totalP(sol, panel).toFixed(3),
            };
        },

        titleText(t, panel, sol) {
            if (!sol.ok) return '⚠ ' + sol.reason;
            const b = branches(sol);
            // 「打平」要用**相對**門檻。固定門檻（例如 5e-4 A）永遠不會觸發：
            // 滑桿是 0.5 V 一格，跨過平衡點時 I₃ 最小只掉到 ~0.008 A，
            // 於是那一格會印出「由下往上 0.016 A」這種把雜訊講成方向的話。
            const flat = b.I3 < 0.02 * Math.max(b.I1, b.I2);
            const dir = flat ? '兩邊幾乎打平，中間沒有電流'
                      : b.a3 > 0 ? '由上往下（Q → T）' : '由下往上（T → Q）';
            return `中間支路 I₃ = ${b.I3.toFixed(3)} A，方向 ${dir}　`
                 + `（ε₁ = ${panel.emf1} V，ε₂ = ${panel.emf2} V）`;
        },

        draw(p, view, t, panel, sol, C) {
            CircuitScene.drawCircuit(p, view, C, sol, {
                t: t,
                carrier: 'current',
                iref: 0.5,
                speed: 40,
                autometer: true,
                badges: [
                    { id: 'E1', text: `ε₁ = ${panel.emf1} V`, dx: -52, align: 'right', size: 13 },
                    // 兩顆的極性相反，所以 E2 要標出來——不然「都是 ε = 幾 V」
                    // 會讓人以為它們在合作，而這頁的重點是它們在對抗。
                    { id: 'E2', text: `ε₂ = ${panel.emf2} V（＋在下）`, dx: -52, align: 'right', size: 13 },
                    // 電阻值放在導線**下方**：上方那一排在 y=114 已經被
                    // 三顆安培計的讀數佔走了，疊上去會互相蓋掉。
                    { id: 'R1', text: `${R1} Ω`, dy: 44, size: 13 },
                    { id: 'R2', text: `${R2} Ω`, dy: 44, size: 13 },
                    { id: 'R3', text: `${panel.R3} Ω`, dx: 48, align: 'left', size: 13 },
                ],
            });

            if (!sol.ok) {
                CircuitScene.badge(p, view, 450, 640, '⚠ ' + sol.reason,
                                   { size: 18, col: CircuitScene.C_HOT });
                return;
            }

            const b = branches(sol);
            const Ib1 = sol.partI.E1 || 0;
            const Ib2 = sol.partI.E2 || 0;
            const lSum = kvlLeft(sol, panel);
            const rSum = kvlRight(sol, panel);

            // 兩個定律的即時算式，用電表上真的會讀到的數字寫出來。
            // 帶號：電流反向時字串會自己變成「+ (−0.455)」，不必改程式。
            const lines = [
                { col: [37, 99, 235], bold: true,
                  text: `ΣI = 0（節點 Q，流入為正）：${fmtS(b.s1)} ${fmtS(b.s2)} ${fmtS(b.s3)}`
                      + ` = ${fmtResid(b.sum)} A` },
                { col: [71, 85, 105], bold: false,
                  text: `ΣV = 0（左迴路）：I₁R₁ + I₃R₃ − (ε₁ − I·r) = `
                      + `${fmtS(b.a1 * R1)} ${fmtS(b.a3 * panel.R3)} `
                      + `− ${(panel.emf1 - Ib1 * RINT).toFixed(3)} = ${fmtResid(lSum)} V` },
                { col: [71, 85, 105], bold: false,
                  text: `ΣV = 0（右迴路）：(ε₂ − I·r) + I₃R₃ − I₂R₂ = `
                      + `${(panel.emf2 - Ib2 * RINT).toFixed(3)} `
                      + `${fmtS(b.a3 * panel.R3)} ${fmtS(-b.a2 * R2)} = ${fmtResid(rSum)} V` },
                { col: [148, 163, 184], bold: false,
                  text: '把 ε₂ 一路拉大：I₃ 會先縮到 0（兩顆電池打平），再整支掉頭。' },
            ];

            p.noStroke();
            let y = 566;
            for (const L of lines) {
                p.fill(L.col[0], L.col[1], L.col[2]);
                p.textSize(view.len(L.bold ? 15 : 13, L.bold ? 10 : 9));
                p.textStyle(L.bold ? p.BOLD : p.NORMAL);
                p.textAlign(p.LEFT, p.TOP);
                p.text(L.text, view.toScreenX(110), view.toScreenY(y));
                y += L.bold ? 36 : 32;
            }
        },
    });

    // 驗證出口：verify-electricity.js 用它斷言
    // ① 每個節點的 ΣI = 0（用 solve() 的 nodeV 反推每支路電流再驗一次）
    // ② 兩個迴路的 ΣV = 0，而且是在**電流反向**的情況下也成立
    // ③ ΣP 收支平衡（三顆電阻吃的 = 兩顆電池淨給的）
    // ④ 把 ε₂ 調大可以讓 I₃ 真的換方向——這一條最能證明「不是套絕對值」
    if (typeof window !== 'undefined') {
        window.__page = {
            circuitFor, NODES, branches, kvlLeft, kvlRight, totalP, R1, R2, RINT,
            probes: { I1: 'A1', I2: 'A2', I3: 'A3' },
        };
    }
})();
