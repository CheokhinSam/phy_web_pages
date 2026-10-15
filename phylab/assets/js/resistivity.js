/**
 * 🧵 電阻的影響因素
 *
 * 一根電阻線的電阻是哪來的？這頁給兩個完全不同的答案，而且兩個必須相等：
 *
 *   ① R = ρL/A          —— 只看這根線自己的材料與幾何
 *   ② R = V / I         —— 只看伏特計與安培計的讀數
 *
 * 兩張卡片並排，不管你把哪一個滑桿怎麼拉，兩個數字永遠一樣。這就是
 * 「電阻是元件自己的性質」最直接的意思：它不從 V 或 I 來，V 和 I 反而
 * 是被它決定的。
 *
 * 下半部是微觀畫面：電子在晶格之間鑽。**長度**決定路上有幾排障礙、
 * **截面積**決定同時有幾條路可以走、**電阻率**決定障礙有多密。R = ρL/A
 * 這條公式的三個因子，在那張圖裡各有一個對應的東西。
 *
 * ⚠️ 微觀畫面的漂移速度是**從解出來的電流換算的**（v ∝ I/A），不是讓
 *    電子自己在電場裡加速跑出來的。理由：電路那邊的 I 是 solve() 算的，
 *    如果微觀畫面自己跑一套，兩邊會各說各話——正是舊版實驗「畫的電路」
 *    與「算的電路」分家的老毛病。寧可讓畫面跟著電表走。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 circuit-scene.js）
    // ======================================================================
    //   TL ──[A1]── TM ────[RW]──── TR ──w0── TRr
    //   │          │                 │         │
    //  [bat]      w1                w2        w4
    //   │          │                 │         │
    //   BL ────────┴────── w5 ───────┴─────── BRr
    //              │                 │
    //            TMv ─────[V1]───── TRv
    //
    // 伏特計掛在 TMv–TRv 上，而 TMv 只經由 w1 接到 TM、TRv 只經由 w2 接到 TR，
    // 所以 V1 和 RW 接的是**同一對節點**——這是並聯的定義。
    const NODES = {
        TL:  { x: 230, y: 120 },
        TM:  { x: 410, y: 120 },
        TR:  { x: 580, y: 120 },
        TRr: { x: 760, y: 120 },
        TMv: { x: 410, y: 255 },
        TRv: { x: 580, y: 255 },
        BRr: { x: 760, y: 330 },
        BL:  { x: 230, y: 330 },
    };
    const R_INT = 1.0;          // 電池內電阻

    // 材料：電阻率 ρ（Ω·mm²/m）
    const MATERIALS = {
        copper:   { name: '銅',   rho: 0.017 },
        iron:     { name: '鐵',   rho: 0.10  },
        nichrome: { name: '鎳鉻', rho: 1.10  },
    };

    /** 這根線的電阻：R = ρL/A。L 用公尺、A 用平方公釐，ρ 的單位就剛好是 Ω。 */
    function resistanceOf(panel) {
        const m = MATERIALS[panel.material] || MATERIALS.nichrome;
        return m.rho * panel.L / panel.A;
    }

    /**
     * 電阻的顯示格式。
     *
     * ⚠️ 不能固定兩位小數。這裡的 R 橫跨五個數量級——鎳鉻長線 550 Ω、
     *    銅短粗線 0.025 Ω——兩位小數在低端會把 0.025 印成「0.02」、
     *    0.017 印成「0.02」，看起來像 20~40% 的誤差，而這一頁從頭到尾
     *    都在講「左邊那格和右邊那格是同一個數」。
     *
     * ⚠️ 還有一個更陰險的：0.425 在二進位裡存成 0.42499999999999998，
     *    而量出來的值是 0.42500000000000004——兩個數差一個位元，可是
     *    四捨五入的方向相反，toFixed(2) 會印出「0.43」和「0.42」。
     *    兩位有效位數也一樣有這種進位邊界，只有**多給幾位**才能讓
     *    最後那個位元的差別落在印出來的位數之外。下面依大小給位數，
     *    小電阻多給幾位（那裡的相對誤差才看得出來）。
     */
    function fmtR(R) {
        if (!isFinite(R)) return '∞';
        const a = Math.abs(R);
        if (a >= 100) return R.toFixed(1);
        if (a >= 10)  return R.toFixed(2);
        if (a >= 1)   return R.toFixed(3);
        return R.toPrecision(3);        // 0.0250、0.0170
    }

    function circuitFor(panel) {
        return {
            ground: 'BL',
            nodes: NODES,
            parts: [
                { id: 'bat', kind: 'battery',   from: 'TL',  to: 'BL', emf: panel.emf, r: R_INT },
                { id: 'A1',  kind: 'ammeter',   from: 'TL',  to: 'TM' },
                // 待測線就是一個電阻，電阻值由上面那條公式給——不是另外填的常數
                { id: 'RW',  kind: 'resistor',  from: 'TM',  to: 'TR', R: resistanceOf(panel) },
                // ⚠️⚠️ 伏特計必須和 RW 接在**同一對節點**（TM、TR）之間。
                //    舊版把 V1 擺在「TR→TRv→BRv→BR」那條回電池的路上，於是
                //    整條迴路只剩伏特計（1 MΩ）導通，電流從 0.26 A 掉到 µA。
                //    而兩張卡片照樣「相等」——因為 V 就等於 I·R，V/I 恆等於
                //    R，跟電路有沒有接對無關。錯得完全不聲不響。
                //    這裡用 w1／w2 各一條導線把 TMv、TRv 接回 TM、TR，
                //    回電池的路（w0→w4→w5）則保持**純導線**。
                { id: 'w1',  kind: 'wire',      from: 'TM',  to: 'TMv' },
                // ⚠️ 這一頁的伏特計內阻開到 1e9 Ω（預設是 1e6）。
                //    伏特計不是理想的，它自己會吃一點電流，量到的就成了
                //    RW ∥ V1，而不是 RW：R_meas = R/(1 + R/1e6)。待測線最大
                //    550 Ω，那個誤差是 550²/1e6 = 0.30 Ω——小數第二位就看得到，
                //    於是「兩張卡片永遠相等」這句在極端參數下當場變成假的
                //    （550.00 vs 549.70）。
                //    「電錶內阻造成的量測誤差」是第 04、05 頁的主題，不是這一頁；
                //    這一頁要展示的是 R 是元件自己的性質，所以讓伏特計退到
                //    背景去。開到 1e9 之後最大殘差 3e-4 Ω，兩張卡片就真的相等。
                { id: 'V1',  kind: 'voltmeter', from: 'TMv', to: 'TRv', R: 1e9 },
                { id: 'w2',  kind: 'wire',      from: 'TR',  to: 'TRv' },
                { id: 'w0',  kind: 'wire',      from: 'TR',  to: 'TRr' },
                { id: 'w4',  kind: 'wire',      from: 'TRr', to: 'BRr' },
                { id: 'w5',  kind: 'wire',      from: 'BRr', to: 'BL' },
            ],
        };
    }

    // ======================================================================
    // 微觀畫面
    // ======================================================================
    const BOX = { x: 120, y: 415, w: 660, h: 300 };

    let sites = [];             // 正離子（晶格）
    let elec = [];              // 自由電子

    /**
     * 排出晶格。
     *
     * 三個因子各管一件事：**L** 管縱向有幾排（路有多長）、**A** 管橫向有幾排
     * （同時有幾條路可走）、**ρ** 管這些格子裡有幾成真的站著一顆離子。
     *
     * ⚠️ 密度一定要寫成「每個格子按機率留下」，不能寫成「總數上限」。
     *    舊版是 `for (c…) for (r…) { if (sites.length < n) push }`，而 n 是
     *    NSITE × ρ 的比例——看起來很合理，實際上**永遠輪不到 n 發揮**：
     *    格子數 cols×rows 才是真正的上限。預設參數下（L=2、A=0.1）格子只有
     *    12 格，而三種材料的 n 分別是 11、20、46，**全部都被截到 12**。
     *    於是拉「材料」滑桿把鎳鉻換成銅（ρ 差 65 倍），畫面上那 12 顆灰點
     *    一顆都不會少——而旁邊的文字正寫著「ρ 越大障礙越密」。
     *
     *    改成逐格擲骰子之後，預設參數下三種材料分別是 32／11／5 顆，
     *    一眼就看得出來。
     *
     * 抖動與存留都用 (c, r) 算出來的雜湊，不用 Math.random()：同樣的參數
     * 每次重排結果都一樣，不會每幀閃動。
     */
    function layoutLattice(panel) {
        const m = MATERIALS[panel.material] || MATERIALS.nichrome;
        // 沿線方向幾排 ∝ L：線越長，路上越多排
        const cols = Math.max(3, Math.round(6 + panel.L * 1.2));
        // 橫向幾排 ∝ √A：線越粗，可以走的通道越多
        const rows = Math.max(2, Math.round(2 + Math.sqrt(panel.A) * 5));
        // 每個格子站著一顆離子的機率 ∝ ρ。ρ 差 65 倍，開 0.45 次方壓縮才
        // 看得出三種材料的差別，不然銅會稀疏到幾乎整片空白。
        const keep = Math.min(1, Math.pow(m.rho / MATERIALS.nichrome.rho, 0.45));

        sites = [];
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                const h = ((c * 53 + r * 37) % 89) / 89;   // 這一格站不站
                if (h > keep) continue;
                const jx = ((c * 37 + r * 53) % 11) / 11 - 0.5;
                const jy = ((c * 61 + r * 29) % 13) / 13 - 0.5;
                sites.push({
                    x: BOX.x + BOX.w * (c + 1) / (cols + 1) + jx * 16,
                    y: BOX.y + BOX.h * (r + 1) / (rows + 1) + jy * 14,
                    r: 6 + keep * 2,
                });
            }
        }
    }

    function seedElectrons() {
        elec = [];
        for (let i = 0; i < 60; i++) {
            elec.push({
                x: BOX.x + Math.random() * BOX.w,
                y: BOX.y + 12 + Math.random() * (BOX.h - 24),
                vy: 0, cool: 0,
            });
        }
    }

    /**
     * 電子往前走一步。
     *
     * 漂移速度 v ∝ I/A —— 這正是 v = I/(nqA)：電流固定時，線越粗，電子
     * 走得越慢。碰撞只是把電子隨機彈開一下（打亂它的橫向位置），平均下來
     * 不改變漂移量，所以畫面永遠跟得上電表上的 I。
     */
    function stepElectrons(dt, I, A) {
        const drift = Math.min(120, 26 * I / Math.max(A, 0.02)) * dt;
        for (const e of elec) {
            e.cool = Math.max(0, e.cool - dt);
            e.x -= (e.cool > 0 ? drift * 0.25 : drift);
            e.y += e.vy * dt;
            e.vy *= 0.94;
            if (e.cool <= 0) {
                for (const s of sites) {
                    const dx = e.x - s.x, dy = e.y - s.y;
                    if (dx * dx + dy * dy < (s.r + 6) * (s.r + 6)) {
                        // 撞上了：往隨機方向彈開，並凍住一小段時間（走得慢）
                        const a = Math.random() * Math.PI * 2;
                        e.vy = Math.cos(a) * 70;
                        e.y += Math.sin(a) * 5;
                        e.cool = 0.05 + Math.random() * 0.10;
                        break;
                    }
                }
            }
            if (e.y < BOX.y + 8) { e.y = BOX.y + 8; e.vy = Math.abs(e.vy); }
            if (e.y > BOX.y + BOX.h - 8) { e.y = BOX.y + BOX.h - 8; e.vy = -Math.abs(e.vy); }
            if (e.x < BOX.x) e.x += BOX.w;           // 從右邊再進來
            if (e.x > BOX.x + BOX.w) e.x -= BOX.w;
        }
    }

    function drawMicro(p, view, panel, I) {
        const m = MATERIALS[panel.material] || MATERIALS.nichrome;
        const bx = view.toScreenX(BOX.x), by = view.toScreenY(BOX.y);
        const bw = view.len(BOX.w), bh = view.len(BOX.h);

        p.noStroke();
        p.fill(248, 250, 252);
        p.rect(bx, by, bw, bh);
        p.noFill();
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(1.5, 1));
        p.rect(bx, by, bw, bh);
        p.noStroke();

        // 晶格（正離子）——ρ 越大越密
        for (const s of sites) {
            const r = view.len(s.r * 0.9, 2);
            p.fill(100, 116, 139);
            p.ellipse(view.toScreenX(s.x), view.toScreenY(s.y), r * 2, r * 2);
        }

        // 電子（帶負電，往**左**跑）。RW 是 TM→TR，傳統電流在線裡是左→右，
        // 所以電子流反向＝右→左。和上面電路圖的藍點方向是一致的。
        for (const e of elec) {
            const r = view.len(4.2, 2);
            p.fill(234, 88, 12);
            p.ellipse(view.toScreenX(e.x), view.toScreenY(e.y), r * 2, r * 2);
        }

        // 標題與說明
        p.noStroke();
        p.fill(15, 23, 42);
        p.textSize(view.len(15, 10));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text(`微觀：${m.name}線　ρ = ${m.rho} Ω·mm²/m`, bx, by - view.len(10));
        p.textStyle(p.NORMAL);
        p.textSize(view.len(12, 8));
        p.fill(100, 116, 139);
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text(`灰點是晶格　橘點是電子（往左，和電流相反）`,
               bx + bw, by - view.len(10));

        // 長度／截面積的尺標
        p.textAlign(p.LEFT, p.TOP);
        p.fill(71, 85, 105);
        p.textSize(view.len(12, 8));
        p.text(`L = ${panel.L.toFixed(1)} m　A = ${panel.A.toFixed(2)} mm²`, bx, by + bh + view.len(8));
        p.textAlign(p.RIGHT, p.TOP);
        p.fill(37, 99, 235);
        p.textStyle(p.BOLD);
        p.text(`I = ${Math.abs(I).toFixed(3)} A`, bx + bw, by + bh + view.len(8));
    }

    // ======================================================================
    // 啟動
    // ======================================================================
    let builtFor = null;

    CircuitScene.run({
        formula: 'R = \\rho \\dfrac{L}{A}',
        formulaFallback: 'R = ρ L / A',

        controls: {
            selects: [
                { key: 'material', label: '材料（電阻率 ρ）', def: 'nichrome',
                  options: [
                      { v: 'copper',   t: '銅　ρ = 0.017' },
                      { v: 'iron',     t: '鐵　ρ = 0.10' },
                      { v: 'nichrome', t: '鎳鉻 ρ = 1.10' },
                  ] },
            ],
            sliders: [
                { key: 'L',   label: '線長 L',     min: 0.5, max: 10, step: 0.5, def: 2,   unit: 'm',     dec: 1 },
                { key: 'A',   label: '截面積 A',   min: 0.02, max: 0.5, step: 0.01, def: 0.1, unit: 'mm²', dec: 2 },
                { key: 'emf', label: '電池電壓 ε', min: 2,  max: 12, step: 0.5, def: 6,   unit: 'V',     dec: 1 },
            ],
        },

        cards: [
            { label: 'R = ρL/A', id: 'cardRgeo',  unit: 'Ω', highlight: true },
            { label: 'R = V / I', id: 'cardRmeas', unit: 'Ω', highlight: true },
            { label: '電壓 V',   id: 'cardV', unit: 'V' },
            { label: '電流 I',   id: 'cardI', unit: 'A' },
            { label: '長度 L',   id: 'cardL', unit: 'm' },
            { label: '截面積 A', id: 'cardA', unit: 'mm²' },
        ],

        circuit: (t, panel) => circuitFor(panel),

        /**
         * 幾何一變就重排晶格。用一個簽章比對，避免每幀重建
         * （重建會讓電子每次都被重新分配，看起來像在閃爍）。
         *
         * ⚠️ 放在 onSample 而不是 onFrame。onFrame **只在跑起來時**才會被呼叫，
         *    所以擺在那裡的話，按下 START 之前晶格是空的、電子一個都沒有——
         *    畫面上只看得到一個空框。onSample 在 `refresh()` 裡也會被叫一次，
         *    那是 p5 啟動之前，所以第一幀就有東西。
         *
         * ⚠️ 種電子這一行不能省。seedElectrons() 定義了卻沒有人呼叫，
         *    `elec` 永遠是空陣列，**40 顆電子一顆都不會畫出來**，而圖例還
         *    大剌剌寫著「橘點是電子」。沒有任何錯誤、沒有爆版，整頁縮圖
         *    看起來也完全正常——只有把微觀那一塊裁下來放大才看得到。
         */
        onSample(t, panel, sol) {
            const sig = `${panel.material}|${panel.L}|${panel.A}`;
            if (sig !== builtFor) {
                builtFor = sig;
                layoutLattice(panel);
                if (!elec.length) seedElectrons();
            }
        },

        onReset() {
            builtFor = null;
        },

        values(t, panel, sol) {
            const Rg = resistanceOf(panel);
            const V = Math.abs(sol.partV.RW || 0);
            const I = Math.abs(sol.partI.A1 || 0);
            return {
                cardRgeo:  fmtR(Rg),
                // 這一格是量出來的。它和左邊那一格永遠相等——這頁的重點。
                cardRmeas: fmtR(I > 1e-12 ? V / I : 0),
                cardV: V.toFixed(2),
                cardI: I.toFixed(4),
                cardL: panel.L.toFixed(1),
                cardA: panel.A.toFixed(2),
            };
        },

        titleText(t, panel, sol) {
            if (!sol.ok) return '⚠ ' + sol.reason;
            const m = MATERIALS[panel.material] || MATERIALS.nichrome;
            const I = Math.abs(sol.partI.A1 || 0);
            return `${m.name}線　R = ρL/A = ${fmtR(resistanceOf(panel))} Ω　`
                 + `V/I = ${fmtR(I > 1e-12 ? Math.abs(sol.partV.RW || 0) / I : 0)} Ω`;
        },

        draw(p, view, t, panel, sol, C) {
            const V = sol.ok ? Math.abs(sol.partV.RW || 0) : 0;
            const I = sol.ok ? Math.abs(sol.partI.A1 || 0) : 0;

            // 微觀圖先畫（它在下半部，不與電路重疊）
            if (sol.ok) stepElectrons(1 / 60, I, panel.A);
            drawMicro(p, view, panel, I);

            CircuitScene.drawCircuit(p, view, C, sol, {
                t: t,
                carrier: 'current',
                iref: 0.3,
                speed: 40,
                badges: [
                    { id: 'A1', text: '安培計', dy: -46, size: 13 },
                    { id: 'RW', text: `${(MATERIALS[panel.material] || {}).name || ''}線`, dy: -46, size: 14 },
                    // 伏特計標在**上方**（往 U 字裡面放）：下方 y = 301 雖然還
                    // 碰不到 y = 330 的回電池下軌，但會讓「V1 到底接在哪」看起來
                    // 像是接到下軌去。擺在上面就落在 TMv–TRv 這個 U 字的中間，
                    // 一眼看得出它是跨在兩條垂直導線之間。
                    { id: 'V1', text: '伏特計', dy: -46, size: 13 },
                ],
            });

            if (!sol.ok) {
                CircuitScene.badge(p, view, 450, 370, '⚠ ' + sol.reason,
                                   { size: 18, col: CircuitScene.C_HOT });
            }
        },
    });

    // 驗證出口：verify-electricity.js 需要**這一頁真正的** ρ、L、A、R 與電路，
    // 才能斷言「R = V/I」和「R = ρL/A」在任何滑桿組合下都相等。
    if (typeof window !== 'undefined') {
        window.__page = {
            circuitFor, NODES, MATERIALS, resistanceOf,
            probes: { V: 'RW', I: 'A1' },
        };
    }
})();
