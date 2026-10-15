/**
 * 🏗️ 滑輪組
 *
 * 這一頁要解決的是「滑輪組為什麼難」裡最根的那一個：**n 從哪裡來。**
 *
 * 課本給一張靜止的圖，學生只能硬背「有幾段繩子」。這裡不是——繩子是
 * `MachineKit.threadRope(n, rig)` **繞出來**的，而顯示的力是
 * `MachineKit.pulleyState(path, …)` **從那條繞出來的繩子把段數數回來**
 * 再算的。所以「畫面上數得到 3 段、卡片卻寫 G/2」在結構上不可能發生。
 *
 * 畫面上作了三件事讓 n 變成看得見的東西：
 *
 *   ① **承擔重物的繩段著藍色並編號 ①②③…**，不承擔的灰掉標「不計」。
 *      n 不再是背下來的數字，是畫面上橫著數過去得到的個數。
 *   ② **兩個尺標同時跑**：物體上升 h、繩端移動 s。拉的時候兩條一起長，
 *      長度比永遠是 1 : n，`s = n·h` 當場看得出來。
 *   ③ **奇動偶定畫在綁繩點上**：n 是偶數，繩子的固定端在天花板；n 是奇數，
 *      綁在動滑輪的框上。切換 n 的时候繩子整條重繞，綁繩點自己跳過去。
 *
 * 還有一件事只有把 n 畫出來才講得清楚：**力的分母是「幾段繩子」，不是
 * 「幾顆滑輪」。** 兩顆滑輪的滑輪組可以繞成 2 段也可以繞成 3 段
 * （n = 2 需要 1 定 1 動；n = 3 也是 1 定 1 動，只是繩頭改綁在動滑輪上），
 * 所以「兩個滑輪省一半」和「兩個滑輪省三分之二」都是對的。
 */

var PulleySystems = (function () {
    'use strict';

    const Kit = MachineKit;
    const Sc = MachineScene;

    // ======================================================================
    // 邏輯世界（900 × 900）
    // ======================================================================
    // 這一頁的座標全部是世界單位。滑輪半徑 30 世界單位、相鄰繩段間隔 2r = 60。
    const R = 30;              // 滑輪半徑
    // ⚠️ **X0 / H_RULER_X / S_RULER_X 是「整組一起動」的三個常數，要移就三個
    //    一起移。** 它們的**相對距離**才是版面：`H_RULER_X = X0 + 372`、
    //    `S_RULER_X = X0 + 448`，而 h/s 的起點虛線是從 `frameR + 26`
    //    （跟著 X0 走）拉到各自尺標的右邊 14。只動其中一個，虛線就會穿過
    //    立板或尺規；三個一起動則整組等比平移，一條線都不會歪。
    //
    //    這一頁原本是 `X0 = 112`，整組偏左、右邊三分之一是空的（2026-09
    //    使用者回報）。**邏輯世界是 `lab-scene.js` 的 `WORLD_W = 900`**——
    //    那一組是磁學那五頁共用的，不是這一頁能設的（`LabScene.run()` 既
    //    沒有世界尺寸、也沒有偏移量的選項），所以只能自己平移。
    //
    //    +130 不是估的：場景的名目左緣是 `X0 − R − 46`（天花板，與 n 無關）、
    //    右緣是 s 徽章的右緣（`S_RULER_X ± 半寬`，也與 n 無關），平移前後
    //    各量一次取中點，讓它落在世界中心 450。`verify-machines.js` ⑮ 是
    //    這件事的守門員（正面 ＋ 反面），改這裡之前先看它。
    const X0 = 242;            // 最左邊那條承擔繩段的 x（＝第一顆滑輪的左切點）
    const CEIL_Y = 96;         // 天花板的下緣
    const GAP = 30;            // 繩頂到天花板下緣的淨空：留一點才畫得出吊架
    const MY0 = 470;           // 動滑輪輪心的初始高度

    // 兩個尺標。h 量物體上升、s 量繩端移動，刻意並排，長度比才看得出來。
    const H_RULER_X = 614;
    const S_RULER_X = 690;
    // 底部說明區的第一行。**這三個常數（MY0 / S_MAX / NOTE_Y）是綁在一起的**：
    // 偶數 n 的手從 `MY0 + 20` 出發往下走 S_MAX，它的標籤再往下 42，所以
    // 說明區必須低於 `MY0 + 20 + S_MAX + 42 + 20`；而標題列在 812，所以
    // 兩行說明又不能更低。動其中一個之前先看 verify-machines.js 的版面斷言。
    const NOTE_Y = 736;

    // ⚠️ 公尺 ↔ 世界單位。**這一頁只有這兩個函式做換算。**
    //    畫面上 100 世界單位當作 1 公尺（只是畫圖的比例尺，不是滑輪真的
    //    那麼大）。尺標的長度、重物抬高的量、繩端移動的量全部從這裡出去，
    //    所以 h 與 s 的比例不會因為換算而走鐘。
    const WORLD_PER_M = 100;
    const toWorld = m => m * WORLD_PER_M;
    const toMetre = cm => cm / 100;

    // ======================================================================
    // 滑桿範圍
    // ======================================================================
    const N_OPTS = [2, 3, 4, 5];
    // ⚠️ S_MAX 不是隨便選的。**n 是奇數時手往上跑**（自由端從動滑輪往上離開，
    //    所以它的下端點才會落在動滑輪上、才會被數進 n），而天花板就在上面，
    //    能走的距離比偶數 n 少。手往上跑了 s，重物也上升了 s/n，所以手的
    //    絕對高度是 `MY0 − 84 − s(1 + 1/n)`——n = 3 最吃緊。180 是讓 n = 3
    //    在最遠處仍然留得下拳頭與「往上拉」標籤的上限（`verify-machines.js`
    //    有一條斷言把這件事釘住，改 S_MAX 之前先看它）。
    const S_MIN = 0, S_MAX = 180, S_DEF = 80;        // 公分
    const G_MIN = 100, G_MAX = 800, G_DEF = 400;     // 牛頓
    const GM_MIN = 0, GM_MAX = 160, GM_DEF = 60;     // 動滑輪＋框的重
    const F_MIN = 0, F_MAX = 60, F_DEF = 0;          // 摩擦
    const PULL_SPEED = 45;                           // 自動拉繩：公分／秒

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

    // ======================================================================
    // 這一頁的狀態
    // ======================================================================
    // ⚠️ **段數只有一個來源：`st.n`，它是從畫出來的那條繩子數回來的。**
    //    `nReq`（滑桿要的）只用來決定「繩子要繞幾段」與「抬高多少」——
    //    抬高的量不影響段數（`verify-machines.js` ④ 用一堆不同的 s 驗過），
    //    所以這裡沒有循環論證：繞 → 數 → 用數到的。
    function stateOf(panel) {
        const nReq = parseInt(panel.n, 10);
        const s = toMetre(panel.sCm);                   // 公尺（物理用）
        const sW = toWorld(s);                          // 世界單位（畫面用）
        const G = panel.G, Gm = panel.Gm, f = panel.f;

        const rig0 = Kit.rigFor(nReq, { r: R, x0: X0, ceilY: CEIL_Y, my: MY0, gap: GAP });
        const rig = Kit.liftRig(rig0, sW / nReq);
        const path = Kit.threadRope(nReq, rig, Kit.handYAt(rig, nReq, sW));
        const strands = Kit.supportingSegs(path, rig);
        const st = Kit.pulleyState(path, rig, G, Gm, f, s);

        // ⚠️ `freeSeg` 是「垂到手上、不承擔重物」的那一小截。奇數 n 的那一段
        //    **同時**是編號最大的承擔段（它往上離開動滑輪，下端點是切點），
        //    所以它在 `strands` 裡、畫成藍的——灰掉「不計」的只有偶數 n。
        //    （見 `MachineKit.supportingSegs` 的檔頭，那是這件事的唯一依據。）
        const freeSeg = path.segs.find(g => g.kind === 'line' && g.free) || null;

        return { nReq, s, sW, G, Gm, f, rig0, rig, path, strands, freeSeg, st };
    }

    /** 這一頁的算式，畫在畫面下方——「n 是分母」這句話的實體。 */
    function sumLine(st) {
        return `${st.n} 段繩子分擔 ${(st.Wt / st.h).toFixed(0)} N`
             + `　→　手的力 F = ${(st.Wt / st.h).toFixed(0)} ÷ ${st.n}`
             + ` = ${st.F.toFixed(1)} N`;
    }

    /** 天花板要畫多寬：把整組滑輪包起來就好。 */
    function ceilSpan(rig) {
        return { l: rig.x0 - rig.r - 46, r: rig.strandX(rig.n - 1) + rig.r + 46 };
    }

    function loadTopOf(rig) { return rig.frameBot + 22; }

    // ======================================================================
    // 畫面
    // ======================================================================
    function drawScene(p, view, t, panel, pr) {
        const { rig, path, strands, st } = pr;
        const span = ceilSpan(rig);
        const even = st.n % 2 === 0;

        // ---- 天花板與定滑輪的吊架 ----
        Sc.drawCeiling(p, view, span.l, span.r, CEIL_Y);
        for (const q of rig.fixed) {
            Sc.drawMount(p, view, q.x, CEIL_Y, q.y, rig.r);
        }

        // ---- 軛（動滑輪的框）----
        Sc.drawFrame(p, view, rig);

        // ---- 滑輪 ----
        for (const q of rig.fixed) Sc.drawPulley(p, view, q.x, q.y, rig.r);
        for (const q of rig.movable) Sc.drawPulley(p, view, q.x, q.y, rig.r);

        // ---- 繩子（編號就是 supportingSegs 的編號）----
        Sc.drawRope(p, view, path, strands);

        // ---- 自由端上那個「不計」----
        // ⚠️ **只有偶數 n 該畫，這不是選擇而是事實。** 奇數 n 的自由端是
        //    從最後一顆**動**滑輪往上離開的，它的下端點正好落在切點上——那一段
        //    **真的在承擔重物**，會被數進 n（畫面上就是編號最大的那一段，藍的）。
        //    偶數 n 的自由端從最後一顆定滑輪垂下來到手上，手上不是著力點，
        //    所以它不承擔任何東西——畫面把它灰掉，這裡把「不計」兩個字補上。
        //    少了這一行，畫面只是**安靜地少一個標籤**：`errs=0`、段數照樣數得對、
        //    `verify-machines.js` 也全過（陷阱九）。但這一頁的文案寫著自由端
        //    「是灰色的，標著「不計」」，所以它不能省。
        //
        // ⚠️ **條件是 `even`，不是 `!even`。** 這兩邊寫反的話，奇數 n 會在最上面
        //    那一段（明明是藍的、算進 n 的）旁邊標上「不計」——一句當場自打臉的
        //    話，而段數、F、errs、爆框全部照常。`verify-machines.js` ⑪ 有一條
        //    斷言從 kit 那一側釘住「自由端是不是承擔段」的奇偶關係，改這裡之前
        //    先看它。
        if (even && pr.freeSeg) {
            const mid = (pr.freeSeg.a.y + pr.freeSeg.b.y) / 2;
            const bandTop = rig.fy + 40, bandBot = rig.my - 20;
            Sc.drawFreeHint(p, view, pr.freeSeg.a.x,
                Math.max(bandTop, Math.min(bandBot, mid)), '不計',
                { dx: 30, size: 13 });
        }

        // ---- 固定端 ----
        // ⚠️ 綁繩點附近**不能放大字**。繩頭就落在整組滑輪的正中央，往左右
        //    任一方向鋪字都會壓到繩段（半徑 8 的綠點本身沒問題，但一行 14
        //    級的中文寬 100 多，附近一定有一條繩）。所以只留「固定端」三個字、
        //    掛在綠點的左邊，奇動偶定那句話搬到畫面下方的說明區。
        Sc.drawTie(p, view, rig.tie.x, rig.tie.y, '固定端',
            { dx: -20, dy: 2, align: 'right' });

        // ---- 重物 ----
        const lx = Sc.loadX(rig);
        Sc.drawHook(p, view, lx, rig.my + rig.r + 12, loadTopOf(rig));
        Sc.drawLoad(p, view, lx, loadTopOf(rig) + 32, 76, 64,
            { label: `${pr.G.toFixed(0)} N` });

        // ---- 手 ----
        const hand = path.free;
        Sc.drawHand(p, view, hand.x, hand.y,
            { label: even ? '往下拉' : '往上拉', dy: even ? 42 : -42 });

        // ---- 兩個尺標 ----
        drawRulers(p, view, pr);
    }

    /**
     * h 尺標與 s 尺標。
     *
     * ⚠️ 兩條尺標的長度都是從 `st`（物理量）換算出來的，**不是**從畫面
     *    幾何量的。所以尺標的長度必然等於卡片上的數字；反過來說，
     *    `verify-machines.js` 會斷言「物體在畫面上真的升高了 st.h」——
     *    兩邊互相釘住，誰都跑不掉。
     */
    function drawRulers(p, view, pr) {
        const { rig, st } = pr;
        const even = st.n % 2 === 0;

        // 重物抬高的起點與終點（用動滑輪輪心當基準，重物掛在框上）
        const hFrom = MY0, hTo = rig.my;
        // 繩端的起點與終點
        const sFrom = Kit.handYAt(pr.rig, st.n, 0);
        const sTo = Kit.handYAt(pr.rig, st.n, toWorld(st.s));

        // 起點的參考線（虛線，從滑輪組拉過來）。
        // ⚠️ **起點要在軛的右立板右邊**：立板佔 `frameR + 6 … frameR + 18`
        //    （`MachineScene.drawFrame`），而 `hFrom = MY0` 與 `sFrom` 兩個
        //    高度**都落在立板的高度範圍內**（立板上緣是 `frameTop`）。原本
        //    寫 `frameR + 14` 會從立板裡面穿出來，只是因為舊版立板很短、
        //    `hFrom` 剛好高出它 4 個世界單位才沒被看見。`frameR + 26` 是
        //    `18` 再加 8 的餘裕。改立板之前先看這裡。
        const DASH_X0 = rig.frameR + 26;
        // ⚠️ **兩條要不同顏色**：`hFrom` 與 `sFrom` 只差 `my + 20 − MY0`，
        //    在 n 大的時候會幾乎疊在一起（n = 5 只差 20 世界單位），兩條都畫
        //    灰色就會糊成一條——而它們量的明明是兩件不同的事。各自跟著自己的
        //    尺標上色，學生才分得出「上面那條是 h 的起點、下面那條是 s 的起點」。
        Sc.dash(p, view, [7, 6]);
        Sc.strokeOn(p, Sc.C_FORCE, Sc.L(view, 1.6, 1));
        Sc.lineW(p, view, DASH_X0, hFrom, H_RULER_X + 14, hFrom);
        Sc.strokeOn(p, Sc.C_ON, Sc.L(view, 1.6, 1));
        Sc.lineW(p, view, DASH_X0, sFrom, S_RULER_X + 14, sFrom);
        Sc.dash(p, view, null);

        Sc.drawRuler(p, view, H_RULER_X, hFrom, hTo, 'h', Sc.C_FORCE,
            { oy: 0 });
        Sc.drawRuler(p, view, S_RULER_X, sFrom, sTo, 's', Sc.C_ON, { oy: 0 });

        // 尺標的兩端各掛一個數值。
        // ⚠️ **兩個標籤一律掛在尺標的「外面」**：h 尺標由下往上長（`hFrom`
        //    是原點、`hTo` 是現在的位置），所以 h 的標籤在 `hTo` 之上；s 尺標
        //    的方向看 n 的奇偶（偶數往下拉、奇數往上拉），所以 s 的標籤跟著
        //    尺標的長出去的那一端走。擺在尺標「裡面」的話標籤會蓋掉尺規的
        //    箭頭，讀起來像尺規斷掉了。
        Sc.worldBadge(p, view, H_RULER_X, hTo - 26, `h = ${(st.h * 100).toFixed(0)} cm`,
            { col: Sc.C_FORCE, size: 14 });
        Sc.worldBadge(p, view, S_RULER_X, sTo + (even ? 26 : -26),
            `s = ${(st.s * 100).toFixed(0)} cm`, { col: Sc.C_ON, size: 14 });

        // ---- 底部說明區（兩行）----
        // 第一行是這一頁的答案；第二行把「奇動偶定」接在 s/h 的後面。
        // ⚠️ 奇動偶定**不能**寫在綁繩點旁邊：繩頭落在整組滑輪的正中央，
        //    一行中文寬 100 多，往左往右都一定壓到繩段（見 drawScene）。
        Sc.label(p, view, 60, NOTE_Y, sumLine(st), Sc.C_PIVOT,
            { size: 17, align: p.LEFT });
        Sc.label(p, view, 60, NOTE_Y + 30,
            `s ÷ h = ${st.sOverH.toFixed(2)}　（${st.n} 段繩子，手就得多拉 ${st.n} 倍）`
            + (even ? `　·　固定端綁在天花板（n 是偶數）`
                    : `　·　固定端綁在動滑輪的框上（n 是奇數）`),
            Sc.C_OFF, { size: 15, align: p.LEFT });
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    let panelRef = null;
    /** 上一幀的時間。自動拉繩要算 dt，重設時歸零。 */
    const G_t = { last: 0 };

    LabScene.run({
        formula: '\\begin{aligned}'
               + 'F &= \\frac{G + G_{動}}{n} + f \\\\[3pt]'
               + 's &= n\\,h'
               + '\\end{aligned}',
        formulaFallback: 'F = (G + G動)/n + f　　s = n·h',

        controls: {
            selects: [
                { key: 'n', label: '繩子繞成幾段', def: '3',
                  options: N_OPTS.map(v => ({ v: String(v), t: `${v} 段繩子` })) },
            ],
            sliders: [
                { key: 'sCm', label: '手拉了多遠 s', def: S_DEF,
                  min: S_MIN, max: S_MAX, step: 2, unit: 'cm', dec: 0 },
                { key: 'G', label: '物重 G', def: G_DEF,
                  min: G_MIN, max: G_MAX, step: 20, unit: 'N', dec: 0 },
                { key: 'Gm', label: '動滑輪＋框重 G動', def: GM_DEF,
                  min: GM_MIN, max: GM_MAX, step: 10, unit: 'N', dec: 0 },
                { key: 'f', label: '摩擦阻力 f', def: F_DEF,
                  min: F_MIN, max: F_MAX, step: 5, unit: 'N', dec: 0 },
            ],
        },

        cards: [
            { label: '段數 n', id: 'cardN', unit: '段', highlight: true },
            { label: '手的拉力 F', id: 'cardF', unit: 'N', highlight: true },
            { label: '物重 G', id: 'cardG', unit: 'N' },
            { label: '動滑輪重 G動', id: 'cardGm', unit: 'N' },
            { label: '物體上升 h', id: 'cardH', unit: 'cm' },
            { label: '繩端移動 s', id: 'cardS', unit: 'cm' },
            { label: 's ÷ h', id: 'cardRatio', unit: '' },
            { label: 'F ÷ G（力剩幾成）', id: 'cardSave', unit: '' },
        ],

        model(t, panel) {
            panelRef = panel;
            return stateOf(panel);
        },

        onFrame(t, panel) {
            const dt = clamp(t - (G_t.last || 0), 0, 0.1);
            G_t.last = t;
            if (dt <= 0) return;
            // 放手讓它跑：手一直拉，繩端 s 一直增加。
            // 拉到底就停住——學生就看得到「拉到底之後 h 和 s 各自到哪裡」。
            const next = Math.min(S_MAX, panel.sCm + dt * PULL_SPEED);
            if (next !== panel.sCm) panel.set('sCm', next);
        },

        values(t, panel, _sol, pr) {
            const st = pr.st;
            return {
                cardN: String(st.n),
                cardF: st.F.toFixed(1),
                cardG: pr.G.toFixed(0),
                cardGm: pr.Gm.toFixed(0),
                cardH: (st.h * 100).toFixed(0),
                cardS: (st.s * 100).toFixed(0),
                cardRatio: st.sOverH.toFixed(2),
                cardSave: (st.ratio * 100).toFixed(0) + '%',
            };
        },

        onReset(reason) {
            G_t.last = 0;
            if (reason === 'reset' && panelRef) panelRef.set('sCm', S_DEF);
        },

        titleText(t, panel, pr) {
            const st = pr.st;
            return `滑輪組　n = ${st.n} 段　G = ${pr.G.toFixed(0)} N　`
                 + `G動 = ${pr.Gm.toFixed(0)} N　F = ${st.F.toFixed(1)} N`
                 + `　（物重的 ${(st.ratio * 100).toFixed(0)}%）`;
        },

        draw(p, view, t, panel, pr) {
            drawScene(p, view, t, panel, pr);
        },
    });

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    // ⚠️ 出口掛在 `window.__page`：verify-machines.js 用
    //    `loadModule(file, 'window.__page', {...})` 把這一頁抓進 Node，
    //    讀的就是這個名字。`window` 是驗證腳本餵進來的空物件，碰不到真的 DOM。
    if (typeof window !== 'undefined') {
        window.__page = {
            R, X0, CEIL_Y, GAP, MY0, H_RULER_X, S_RULER_X, NOTE_Y,
            WORLD_PER_M, toWorld, toMetre,
            N_OPTS, S_MIN, S_MAX, S_DEF, G_MIN, G_MAX, G_DEF,
            GM_MIN, GM_MAX, GM_DEF, F_MIN, F_MAX, F_DEF, PULL_SPEED,
            stateOf, sumLine, ceilSpan, loadTopOf, clamp,
        };
    }
})();
