/**
 * ⚙️ 機械效率
 *
 * 這一頁要打破全章最頑強的一個直覺：**學會「滑輪組省力」之後，學生會覺得
 * 「那我也省了功」。**
 *
 * 畫面上並排兩條堆疊長條，總高度就是總功。切法不同（下面綠色的是有用功、
 * 上面紅色的是額外功），但**只要沒有摩擦，兩條的總高度一模一樣**——換 n、
 * 換繞法、換滑輪顆數，長條的總高度都動不了。省力不省功，是一條長度。
 *
 * 這一頁還有一個更漂亮的結論：
 *
 *     理想（無摩擦）時 η = W有用 / W總 = Gh / (G + G動)h = G / (G + G動)
 *
 * **和 n 無關、和 h 也無關。** 把 n 從 2 拉到 5、把物體從 5 cm 拉到 40 cm，
 * 效率一動也不動——學生以為「滑輪越多效率越差」，這條式子直接推翻它。
 *
 * 那什麼時候 n 才有影響？**把摩擦打開。** η = G/(G + G動 + n·f)，只有這時候
 * n 才進到分母。摩擦是 n 的唯一入口——右邊那張圖會從一條水平線變成往下的斜線。
 */

var Efficiency = (function () {
    'use strict';

    const Kit = MachineKit;
    const Sc = MachineScene;

    // ======================================================================
    // 邏輯世界（900 × 900）
    // ======================================================================
    const RR = 20;                 // 滑輪半徑（這一頁的滑輪畫小一點，讓位給長條）
    const RX0 = 96;                // 最左邊那條承擔繩段的 x
    const RCEIL = 60;              // 天花板下緣
    const RMY = 260;               // 動滑輪輪心的起始高度

    // ⚠️ **這一頁有兩個長度尺度，各自只有一個家。**
    //      · 物理用公尺（功的帳本：W = F·s，s 與 h 都是公尺）
    //      · 畫面用世界單位
    //    `toWorld` 是唯一的換算，而且只給「滑輪會動的那個量」用。
    //    長條的高度用的是另一個尺度（`barScale`，每焦耳幾個世界單位），
    //    它從兩條長條的最大值反推，所以長條永遠塞得進版面。
    const WORLD_PER_M = 100;
    const RISE_SCALE = 60;         // 畫面比例：1 公尺的上升畫成幾個世界單位
    const toWorld = m => m * RISE_SCALE;

    const BAR_X1 = 396, BAR_X2 = 520, BAR_W = 76, BAR_BASE = 640;
    const BAR_TOP = 120;           // 長條最高只能到這裡
    // ⚠️ **GRAPH.x 要留給 drawGraph 的縱軸標題。** 它畫在 `GRAPH.x − L(view,40)`
    //    （40 個**畫布**像素，換算回世界大約 50），所以 648 的話標題會落在
    //    x ≈ 598——正好壓在右邊那條長條（右緣 596）上。往右挪到 664 才閃開。
    const GRAPH = { x: 664, y: 130, w: 200, h: 220 };
    const NOTE_Y = 750;

    // ======================================================================
    // 滑桿
    // ======================================================================
    const N_OPTS = [2, 3, 4, 5];
    const H_MIN = 5, H_MAX = 40, H_DEF = 25;           // 物體上升（公分）
    const G_MIN = 100, G_MAX = 800, G_DEF = 400;       // 牛頓
    const GM_MIN = 0, GM_MAX = 160, GM_DEF = 60;       // 動滑輪＋框重
    const F_MIN = 0, F_MAX = 60, F_DEF = 0;            // 摩擦阻力
    const N_REF = 2;                                   // 對照組的段數（固定不變）

    // ======================================================================
    // 「開始 START」要動的東西
    // ----------------------------------------------------------------------
    // ⚠️ **這一頁原本沒有 `onFrame`，所以開始鍵按下去整張畫布文風不動。**
    //    詳細說明見 `lever.js` 的同一段註解；`verify-machines.js` ⑭ 在守這件事。
    //
    // 跑起來的是**摩擦**，不是高度。理由：這一頁的長條高度是**正規化過的**
    // （`barScale()` 讓比較高的那一條剛好頂到 `BAR_TOP`），而 W有 與 W總 都
    // 和 h 成正比——所以拉 h 的話兩條長條會**等比例伸長，看起來完全沒動**，
    // 只有滑輪組會平移 `RISE_SCALE × h` 那麼一點點（整個 h 範圍只有 21 個
    // 世界單位，比滑輪的間距 22 還小）。**拉 h 是一個看起來像壞掉的動畫。**
    //
    // 摩擦就不一樣了：它是唯一會讓兩條長條**分家**的量。f 從 0 拉起來，
    // 紅色那截自己長出來、對照組那條虛線當場被甩開、右邊那張圖從水平
    // 轉成斜的——這一頁的兩句話（省力不省功、摩擦是 n 唯一的入口）都看得到。
    const FRIC_SPEED = 20;                 // 每秒幾牛頓
    let lastT = 0;                         // onFrame 用的上一個時間戳
    let panelRef = null;                   // onReset 要用

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

    // ======================================================================
    // 狀態
    // ======================================================================
    // ⚠️ **兩個 n 走的是同一支 `ledger`**，而且 `h` 一模一樣——這樣「總功
    //    不隨 n 改變」才是真的比出來的，不是宣稱的。有摩擦時它會改變，
    //    那也正是這一頁要教的第二件事。
    function stateOf(panel) {
        const nReq = parseInt(panel.n, 10);
        const h = panel.hCm / 100;                     // 公尺
        const G = panel.G, Gm = panel.Gm, f = panel.f;

        const s = nReq * h;
        const now = Kit.ledger(nReq, G, Gm, f, s);
        const ref = Kit.ledger(N_REF, G, Gm, f, N_REF * h);

        // 畫面上的滑輪組（同一條繩子、同一支 threadRope）
        const rig0 = Kit.rigFor(nReq, { r: RR, x0: RX0, ceilY: RCEIL, my: RMY, gap: 22 });
        const rig = Kit.liftRig(rig0, toWorld(h));
        const path = Kit.threadRope(nReq, rig, Kit.handYAt(rig, nReq, toWorld(s)));
        const strands = Kit.supportingSegs(path, rig);

        return { nReq, h, G, Gm, f, now, ref, rig0, rig, path, strands };
    }

    /** 長條的尺度：兩條裡比較高的那一條剛好頂到 BAR_TOP。 */
    function barScale(pr) {
        const top = Math.max(pr.now.Wt, pr.ref.Wt);
        return top > 0 ? (BAR_BASE - BAR_TOP) / top : 1;
    }

    function sumLine(pr) {
        const t = pr.now;
        return `W有 = Gh = ${t.Wu.toFixed(1)} J　　W額 = G動·h + f·s = ${t.We.toFixed(1)} J`
             + `　　W總 = ${t.Wt.toFixed(1)} J`;
    }

    // ======================================================================
    // 畫面
    // ======================================================================
    function drawScene(p, view, t, panel, pr) {
        const { rig, path, strands, now, ref } = pr;

        // ---- 滑輪組（小尺寸，只為了交代「這是哪一組機械」）----
        const span = { l: rig.x0 - rig.r - 30, r: rig.strandX(pr.nReq - 1) + rig.r + 30 };
        Sc.drawCeiling(p, view, span.l, span.r, RCEIL);
        for (const q of rig.fixed) Sc.drawMount(p, view, q.x, RCEIL, q.y, rig.r);
        Sc.drawFrame(p, view, rig);
        for (const q of rig.fixed) Sc.drawPulley(p, view, q.x, q.y, rig.r);
        for (const q of rig.movable) Sc.drawPulley(p, view, q.x, q.y, rig.r);
        Sc.drawRope(p, view, path, strands, { numberSize: 12, bandTop: 14, bandBot: 8 });
        if (rig.tie) {
            Sc.drawTie(p, view, rig.tie.x, rig.tie.y, '固定端',
                { dx: -16, dy: 2, align: 'right', size: 12, r: 6 });
        }
        const lx = Sc.loadX(rig);
        Sc.drawHook(p, view, lx, rig.frameBot, rig.frameBot + 22);
        Sc.drawLoad(p, view, lx, rig.frameBot + 22 + 26, 62, 52,
            { label: `${pr.G.toFixed(0)} N`, size: 14 });
        Sc.label(p, view, (span.l + span.r) / 2, RCEIL + 330,
            `${pr.nReq} 段繩子`, Sc.C_PIVOT, { size: 15 });
        // 這一頁不畫手：繩子的自由端停在那裡就好（焦點在下面的長條）
        Sc.label(p, view, path.free.x, path.free.y + (pr.nReq % 2 ? -30 : 30),
            '手拉', Sc.C_HAND, { size: 13 });

        // ---- 兩條堆疊長條 ----
        // ⚠️ **數字一律排在長條「底下」，不要掛在旁邊。** 兩條長條的中心只差
        //    124 個世界單位，而「F = 100.0 N　s = 1.00 m」這種字串有 130 寬——
        //    排在旁邊的話兩條的標籤會在中間撞在一起，而**畫面不會報錯**。
        //    排在下面的短行（10 個字上下）各自待在 76 寬的欄位裡，不會碰。
        const k = barScale(pr);
        const drawBar = (x, led, name) => {
            const top = Sc.drawStackBar(p, view, x, BAR_BASE, BAR_W, [
                { v: led.Wu, col: Sc.C_WORK, label: `W有 ${led.Wu.toFixed(0)} J` },
                { v: led.We, col: Sc.C_EXTRA, label: led.We > 0 ? `W額 ${led.We.toFixed(0)} J` : '' },
            ], '', { scale: k });
            const cx = x + BAR_W / 2;
            Sc.label(p, view, cx, BAR_BASE + 26, name, Sc.C_PIVOT, { size: 15 });
            Sc.label(p, view, cx, BAR_BASE + 48, `W總 ${led.Wt.toFixed(0)} J`,
                Sc.C_PIVOT, { size: 13 });
            Sc.label(p, view, cx, BAR_BASE + 68,
                `η ${(led.eta * 100).toFixed(1)}%`, Sc.C_WORK, { size: 13 });
            Sc.label(p, view, cx, BAR_BASE + 88,
                `F ${led.F.toFixed(0)} N·s ${led.s.toFixed(2)} m`, Sc.C_OFF, { size: 12 });
            return top;
        };
        const top1 = drawBar(BAR_X1, ref, `n = ${N_REF}（對照組）`);
        const top2 = drawBar(BAR_X2, now, `n = ${pr.nReq}（現在這一組）`);

        // ---- 這一頁的畫龍點睛：對照組的頂端拉一條水平虛線過來 ----
        // 沒有摩擦時它**正好貼齊**右邊那條的頂端（兩條的總功相等）；把摩擦
        // 拉起來之後右邊那條會高出虛線，高出來的那一截就是多做的 f·s。
        // **這條線就是「省力不省功」**——不用任何文字說明也看得出來。
        Sc.dash(p, view, [8, 5]);
        Sc.strokeOn(p, Sc.C_PIVOT, Sc.L(view, 2, 1));
        Sc.lineW(p, view, BAR_X1 - 22, top1, BAR_X2 + BAR_W + 22, top1);
        if (Math.abs(top2 - top1) > 2) {
            // 有摩擦時多出來的那一截——把它單獨框出來
            Sc.strokeOn(p, Sc.C_EXTRA, Sc.L(view, 2, 1));
            Sc.lineW(p, view, BAR_X2 - 22, top2, BAR_X2 + BAR_W + 22, top2);
        }
        Sc.dash(p, view, null);

        // ---- 說明 ----
        Sc.label(p, view, 60, NOTE_Y, sumLine(pr), Sc.C_PIVOT,
            { size: 17, align: p.LEFT });
        Sc.label(p, view, 60, NOTE_Y + 30,
            pr.f > 0
              ? `有摩擦：W額 多了 f·s = ${pr.f.toFixed(0)} × ${now.s.toFixed(2)} = `
                + `${(pr.f * now.s).toFixed(1)} J，n 愈大 s 愈長 → 效率愈低`
              : `沒有摩擦時兩條長條的總高度一模一樣——`
                + `換 n，F 掉下去、s 升上來，乘起來還是 ${now.Wt.toFixed(0)} J`,
            Sc.C_OFF, { size: 15, align: p.LEFT });
    }

    // ======================================================================
    // 圖表：η 對 n
    // ======================================================================
    function drawGraphOf(p, view, pr) {
        const { G, Gm, f, h } = pr;
        // η(n) = G / (G + G動 + n·f)；f = 0 時是一條水平線
        const ETA = n => {
            const e = Kit.ledger(n, G, Gm, f, n * h);
            return e.eta * 100;
        };
        const pts = [];
        for (let n = 1; n <= 6 + 1e-9; n += 0.1) pts.push({ x: n, y: ETA(n) });
        const yMax = 104;
        LabScene.drawGraph(p, view, {
            x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
            xMin: 1, xMax: 6, yMin: 0, yMax,
            xTicks: 5, yTicks: 4,
            xLabel: '段數', xUnit: 'n',
            yLabel: '機械效率', yUnit: '%',
            title: '機械效率 η 對段數 n',
            series: [{ pts, col: f > 0 ? Sc.C_EXTRA : Sc.C_WORK, r: 0, join: true }],
            marker: { x: pr.nReq, y: pr.now.eta * 100, col: Sc.C_PIVOT },
            lines: [{ from: { x: pr.nReq, y: 0 }, to: { x: pr.nReq, y: pr.now.eta * 100 },
                      col: Sc.C_NAIVE, dash: true }],
        });
        const cx = GRAPH.x + GRAPH.w / 2;
        Sc.label(p, view, cx, GRAPH.y + GRAPH.h + 62,
            f > 0 ? '有摩擦：n 愈多，繩子滑過的距離愈長，效率就愈低'
                  : '沒有摩擦時這是一條水平線：η 和 n 完全無關',
            f > 0 ? Sc.C_EXTRA : Sc.C_WORK, { size: 13 });
        Sc.label(p, view, cx, GRAPH.y + GRAPH.h + 84,
            '把摩擦滑桿從 0 拉起來，這條線當場從平的變成斜的', Sc.C_OFF, { size: 13 });
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    LabScene.run({
        // ⚠️ 左欄公式框在 1100px 時只有約 183px 寬，KaTeX display 模式不換行。
        //    所以拆成三行、標註自己一行，不要接在式子後面。**壓在 180px 以內。**
        formula: '\\begin{aligned}'
               + '\\eta &= \\frac{W_{有}}{W_{總}} \\\\[3pt]'
               + '&= \\frac{Gh}{Gh + G_{動}h + f\\,s} \\\\[3pt]'
               + 'f = 0 &\\Rightarrow \\eta = \\frac{G}{G + G_{動}}'
               + '\\end{aligned}',
        formulaFallback: 'η = W有/W總；無摩擦時 η = G/(G+G動)，和 n、h 都無關',

        controls: {
            selects: [
                { key: 'n', label: '繩子繞成幾段', def: '4',
                  options: N_OPTS.map(v => ({ v: String(v), t: `${v} 段繩子` })) },
            ],
            sliders: [
                { key: 'hCm', label: '物體上升 h', def: H_DEF,
                  min: H_MIN, max: H_MAX, step: 1, unit: 'cm', dec: 0 },
                { key: 'G', label: '物重 G', def: G_DEF,
                  min: G_MIN, max: G_MAX, step: 20, unit: 'N', dec: 0 },
                { key: 'Gm', label: '動滑輪＋框重 G動', def: GM_DEF,
                  min: GM_MIN, max: GM_MAX, step: 10, unit: 'N', dec: 0 },
                { key: 'f', label: '摩擦阻力 f', def: F_DEF,
                  min: F_MIN, max: F_MAX, step: 5, unit: 'N', dec: 0 },
            ],
        },

        cards: [
            { label: '段數 n', id: 'cardN', unit: '段' },
            { label: '機械效率 η', id: 'cardEta', unit: '%', highlight: true },
            { label: '有用功 W有', id: 'cardWu', unit: 'J', highlight: true },
            { label: '額外功 W額', id: 'cardWe', unit: 'J' },
            { label: '總功 W總', id: 'cardWt', unit: 'J' },
            { label: '手的拉力 F', id: 'cardF', unit: 'N' },
            { label: '繩端移動 s', id: 'cardS', unit: 'm' },
            { label: '物體上升 h', id: 'cardH', unit: 'm' },
        ],

        model(t, panel) {
            panelRef = panel;
            return stateOf(panel);
        },

        onFrame(t, panel) {
            const dt = clamp(t - lastT, 0, 0.1);
            lastT = t;
            if (dt <= 0) return;
            if (panel.f >= F_MAX) return;
            panel.set('f', Math.min(F_MAX, panel.f + FRIC_SPEED * dt));
        },

        onReset(reason) {
            lastT = 0;
            if (reason === 'reset' && panelRef) panelRef.set('f', F_DEF);
        },

        values(t, panel, _sol, pr) {
            const u = pr.now;
            return {
                cardN: String(pr.nReq),
                cardEta: (u.eta * 100).toFixed(1),
                cardWu: u.Wu.toFixed(1),
                cardWe: u.We.toFixed(1),
                cardWt: u.Wt.toFixed(1),
                cardF: u.F.toFixed(1),
                cardS: u.s.toFixed(2),
                cardH: pr.h.toFixed(2),
            };
        },

        titleText(t, panel, pr) {
            const u = pr.now, r = pr.ref;
            return `機械效率　n = ${pr.nReq} 段　η = ${(u.eta * 100).toFixed(1)}%　`
                 + `W總 = ${u.Wt.toFixed(1)} J　（對照組 n = ${N_REF}：`
                 + `W總 = ${r.Wt.toFixed(1)} J）`;
        },

        draw(p, view, t, panel, pr) {
            drawScene(p, view, t, panel, pr);
            drawGraphOf(p, view, pr);
        },
    });

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            RR, RX0, RCEIL, RMY, WORLD_PER_M, RISE_SCALE, toWorld,
            BAR_X1, BAR_X2, BAR_W, BAR_BASE, BAR_TOP, GRAPH, NOTE_Y, N_REF,
            N_OPTS, H_MIN, H_MAX, H_DEF, G_MIN, G_MAX, G_DEF,
            GM_MIN, GM_MAX, GM_DEF, F_MIN, F_MAX, F_DEF,
            FRIC_SPEED,
            stateOf, barScale, sumLine, clamp,
        };
    }
})();
