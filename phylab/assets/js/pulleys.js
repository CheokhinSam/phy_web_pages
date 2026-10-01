/**
 * 🎡 定滑輪與動滑輪
 *
 * 滑輪組那頁的前提是「一段繩子張力處處相等、而 n 段繩子分擔重物」。這一頁
 * 把它拆回最小的兩塊：**一顆定滑輪（n = 1）**與**一顆動滑輪（n = 2）**。
 *
 * 兩頁用的是**同一支數段數的程式**（`MachineKit.countStrands`）——單一滑輪
 * 與滑輪組不是兩套程式，是同一套的兩個極端。所以「定滑輪 n = 1、動滑輪
 * n = 2」不是這一頁寫死的常數，是繩子的幾何算出來的。
 *
 * 兩個模式各自要講一句話：
 *
 *   ① **定滑輪：不省力，但可以改變力的方向。**
 *      拉繩的角度怎麼轉，F 的讀數一動也不動——因為兩條拉力的作用線都切於
 *      同一個圓，兩個力臂都是 r（畫面上的綠色虛線就是那兩條半徑）。
 *      定滑輪是一個**等臂槓桿**，這句話在這裡是看得見的幾何。
 *
 *   ② **動滑輪：省一半的力，但要多拉一倍的距離。**
 *      支點在**繩子離開滑輪的那個切點**，不在輪心——這是學生最常搞錯的
 *      地方。支點到物體的作用線是 r，到手的施力線是 2r，所以是 2:1 的槓桿，
 *      F = G/2；而手走 s，物體只升 s/2。
 */

var Pulleys = (function () {
    'use strict';

    const Kit = MachineKit;
    const Sc = MachineScene;

    // ======================================================================
    // 邏輯世界（900 × 900）
    // ======================================================================
    const R = 38;                  // 滑輪半徑（用 kit 的 PULLEY_R）
    // ⚠️ **場景要擺在畫布正中央，這不是排版偏好、是「這張圖畫完了沒有」的問題。**
    //
    //    邏輯世界是 900 寬，而它是 `lab-scene.js` 的 `WORLD_W`——**磁學五頁共用
    //    同一個世界，不是這一頁能設的**。這一頁的機構從說明文字的左緣到 s 徽章
    //    的右緣只佔掉大約 500 個世界單位，所以整組擺在哪裡是一個自由的選擇；
    //    原本的 `CX = 300` 讓它靠左，右邊三分之一全空，讀起來像一張沒畫完的圖。
    //
    //    平移量是**量出來的，不是估的**：把畫布的像素掃一遍、取非白像素的邊界框
    //    （`_site/bbox.html` 那支探針），兩個模式在 1600 px 與 1100 px 下的場景
    //    中心都落在世界 x ≈ 300，而畫布中心是 450——所以整組 +150。
    //    `CX` 與 `RULER_X` **必須一起移**（兩者相差 200 是尺標那一帶的既有版面），
    //    只移一個的話尺標的連接虛線會跟著 `CX` 跑、整條尺標留在原地。
    //
    //    ⚠️ **底部那兩行旁白不動**（`Sc.label(p, view, 60, NOTE_Y, …)`）。
    //    它不是「場景的一部分」而是**整張畫布寬的說明**：1100 px 時它已經寫到
    //    世界 x = 812（窄畫布上 `label` 的字級下限讓整串字換算回世界單位變寬），
    //    再往右推就直接頂出畫布。留在 60 讀起來是「比圖更寬的一行說明」，
    //    不是偏一邊——⑬ 的每一條淨空斷言也都是相對 `CX` 寫的，平移不影響它們。
    const CX = 450;                // 滑輪輪心
    const CEIL_Y = 96;             // 天花板下緣
    const GAP = 30;                // 繩頂到天花板的淨空
    const LOAD_Y0 = 620;           // 定滑輪：重物（繩尾）的起始高度
    const MY0 = 560;               // 動滑輪：輪心的起始高度
    // ⚠️ **h 和 s 兩條尺標共用同一根柱子**（動滑輪模式時），不是並排的兩條。
    //
    //    併成一柱的**理由是幾何上的必然，不是排版偏好**：h 尺標的下端固定在
    //    `MY0`（輪心的起始高度），s 尺標的上端固定在 `handY0`（手的起始高度），
    //    而動滑輪模式 s = 2h，所以 h 的最高點只到 `MY0 − sW/2`——**兩條在 y 上
    //    永遠不可能相交**，兩顆量測徽章也才有固定的落點（見 `H_BADGE_Y` 與
    //    `S_BADGE_DY` 的 ⚠️）。
    //    `verify-machines.js` ⑬ 第一條斷言守的就是那個「永不相交」。
    const RULER_X = 650;           // h 與 s 尺標共用的 x（＝ CX + 200，跟場景一起平移）
    const NOTE_Y = 736;

    // ⚠️ 公尺 ↔ 世界單位的唯一換算（同 pulley-systems.js）。
    const WORLD_PER_M = 100;
    const toWorld = m => m * WORLD_PER_M;
    const toMetre = cm => cm / 100;

    // ======================================================================
    // 滑桿
    // ======================================================================
    const S_MIN = 0, S_MAX = 160, S_DEF = 60;         // 公分（拉了多少繩子）
    const G_MIN = 100, G_MAX = 800, G_DEF = 400;      // 牛頓
    const GM_MIN = 0, GM_MAX = 160, GM_DEF = 60;      // 動滑輪＋框的重
    const F_MIN = 0, F_MAX = 60, F_DEF = 0;           // 摩擦
    const ANG_MIN = -60, ANG_MAX = 60, ANG_DEF = 0;   // 拉繩方向（度）
    const PULL_SPEED = 42;                            // 自動拉繩：公分／秒

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

    // ======================================================================
    // 狀態
    // ======================================================================
    // ⚠️ **F 一律由 `MachineKit` 的帳本推出來，不另外寫公式。**
    //    定滑輪走 `fixedPulleyState`（n = 1、不計 G動）、動滑輪走
    //    `movablePulleyState`（n = 2）。兩者都經過同一支 `ledger`，所以
    //    「W總 = F·s」是恆等式、η 的定義全站一致。
    function stateOf(panel) {
        const mode = panel.mode;
        const s = toMetre(panel.sCm);
        const sW = toWorld(s);
        const G = panel.G, Gm = panel.Gm, f = panel.f;
        const ang = (mode === 'fixed' ? panel.ang : 0) * Kit.DEG;

        if (mode === 'fixed') {
            // n = 1：手拉出多少，物體就升高多少。`liftRig` 只推得動
            // `movable`／`loadEnd`，這一組兩者都沒有一顆會動的滑輪，
            // 所以定滑輪原地不動、只有繩尾（載重）升上去。
            const rig0 = Kit.singleRig('fixed',
                { r: R, cx: CX, ceilY: CEIL_Y, gap: GAP, loadY: LOAD_Y0 });
            const rig = Kit.liftRig(rig0, sW);
            const path = Kit.threadSingle(rig, { angle: ang, s: sW });
            const strands = Kit.supportingSegs(path, rig);
            const st = Kit.fixedPulleyState({ G, f, s });
            return { mode, s, sW, G, Gm, f, ang, rig0, rig, path, strands, st,
                     tie: rig.tie };
        }

        // n = 2：動滑輪隨物體上升 h = s/2，手往上拉 s。
        const rig0 = Kit.singleRig('movable',
            { r: R, cx: CX, ceilY: CEIL_Y, my: MY0 });
        const rig = Kit.liftRig(rig0, sW / 2);
        const path = Kit.threadSingle(rig, { s: sW });
        const strands = Kit.supportingSegs(path, rig);
        const st = Kit.movablePulleyState({ G, Gm, f, s });
        return { mode, s, sW, G, Gm, f, ang: 0, rig0, rig, path, strands, st,
                 tie: rig0.tie };
    }

    /** 底部那行：這一頁的答案。 */
    function sumLine(pr) {
        const st = pr.st;
        if (pr.mode === 'fixed') {
            return `n = ${st.n} 段　定滑輪不省力：F = G = ${st.F.toFixed(0)} N`
                 + `　（拉的方向怎麼轉都一樣）`;
        }
        return `n = ${st.n} 段　動滑輪省一半：F = (G + G動) ÷ 2`
             + ` = (${pr.G.toFixed(0)} + ${pr.Gm.toFixed(0)}) ÷ 2 = ${st.F.toFixed(1)} N`;
    }

    function loadTopOf(pr) {
        if (pr.mode === 'fixed') return pr.rig.loadEnd.y;
        return pr.rig.frameBot + 22;
    }
    function loadXOf(pr) {
        return pr.mode === 'fixed' ? pr.rig.loadX : pr.rig.cx;
    }

    // ======================================================================
    // 畫面
    // ======================================================================
    function drawScene(p, view, t, panel, pr) {
        const { rig, path, strands, st } = pr;
        const fixed = pr.mode === 'fixed';

        // ---- 天花板 ----
        const half = fixed ? 150 : 170;
        Sc.drawCeiling(p, view, CX - half, CX + half, CEIL_Y);
        for (const q of rig.fixed) Sc.drawMount(p, view, q.x, CEIL_Y, q.y, rig.r);

        // ---- 動滑輪的框（只有動滑輪模式有）----
        if (!fixed) Sc.drawFrame(p, view, rig, { frameL: rig.cx - rig.r,
                                                 frameR: rig.cx + rig.r });

        // ---- 滑輪 ----
        for (const q of rig.fixed) Sc.drawPulley(p, view, q.x, q.y, rig.r);
        for (const q of rig.movable) Sc.drawPulley(p, view, q.x, q.y, rig.r);

        // ---- 繩子 ----
        Sc.drawRope(p, view, path, strands);

        // ---- 固定端（只有動滑輪模式：繩頭綁在天花板上）----
        if (!fixed && rig.tie) {
            Sc.drawTie(p, view, rig.tie.x, rig.tie.y, '固定端',
                { dx: -20, dy: 2, align: 'right' });
        }

        // ---- 重物 ----
        const lx = loadXOf(pr);
        // 定滑輪的重物直接掛在繩尾上（繩尾就是箱子的上緣，不必再畫鉤子）；
        // 動滑輪的重物掛在框的下橫樑，中間留一小段鉤子。
        if (!fixed) Sc.drawHook(p, view, lx, rig.frameBot, loadTopOf(pr) + 32);
        Sc.drawLoad(p, view, lx, loadTopOf(pr) + 32, 76, 64,
            { label: `${pr.G.toFixed(0)} N` });

        // ---- 手 ----
        const hand = path.free;
        Sc.drawHand(p, view, hand.x, hand.y, {
            label: fixed ? `F = ${st.F.toFixed(0)} N` : `F = ${st.F.toFixed(1)} N`,
            dy: fixed ? 46 : -46,
        });

        // ---- 本質疊圖：把滑輪看成槓桿 ----
        // ⚠️ **一定要畫在最後（繩子與手之後）。** 「疊圖」是把滑輪重新看成槓桿的
        //    那一層，學生要讀的是它上面的字；畫在繩子之前的話，繩子與手上的
        //    標籤會蓋掉它——而**畫面不會報錯、`errs` 是 0、爆框是 0**，只是有幾個
        //    字看不見（陷阱九）。舊版就是畫在繩子之前，`l₂ = r` 的 `r` 被繩子
        //    蓋掉、動滑輪那句「等臂槓桿」被手上的標籤蓋掉。
        if (fixed) drawEqualArm(p, view, pr);
        else drawTwoToOneArm(p, view, pr);

        // ---- 量測 ----
        if (fixed) drawFixedRuler(p, view, pr);
        else drawMovableRulers(p, view, pr);
    }

    /**
     * 本質疊圖的註解只能放在**繩子外側的兩條垂直帶**上。
     *
     * ⚠️ 這不是排版偏好。滑輪半徑 38、輪心在 `CX`，所以兩條繩子分別垂在
     *    `CX ∓ 38`；`l₁ = r` 這種標籤連框寬約 68 世界單位。把它擺在輪心附近
     *    （舊版就是）會出現兩件事，而且**兩件都不會報錯**：
     *      · 兩顆標籤在動滑輪模式下只差 19 個世界單位，直接疊在一起，
     *        兩邊的 `r` 都被對方的框蓋掉，剩下「l₂ = 」「l₁ = 2」；
     *      · 橫跨到繩子上的部分被**後畫的繩子**蓋掉。
     *    所以兩個標籤一律退到繩子外面，而且退到動滑輪的框（外緣在 `CX ∓ 61`）
     *    外面——那個框兩種模式都可能出現，退了才不會有一種模式對不上。
     */
    // ⚠️ `R + 76` 不夠。定滑輪的自由端會隨 `ang` 往右下方斜出去，`ang = 60°`
    //    時它在標籤左緣的高度只比標籤底部低 4 個世界單位——而 `LabScene.badge`
    //    在小畫布上會把字級夾到 9 px（見 `verify-machines.js` ⑬ 的量測：
    //    視窗 1100 px 時 scale = 0.5，徽章換算回世界單位是名目的 1.29 倍），
    //    真正的淨空是負的。退到 `R + 96` 之後同一處有 12 個世界單位。
    const NOTE_DX = R + 96;              // 力臂標籤中心離輪心多遠（＝ CX ± 134）
    const NOTE_DY = 22;                  // 力臂標籤比力臂高多少
    const CAPTION_X = CX - R - 60;       // 說明文字靠右對齊在這一條（＝ CX − 98）
    const CAPTION_DY0 = 34;              // 第一排離力臂多遠
    const CAPTION_LEAD = 22;             // 行距
    // 動滑輪模式的兩顆量測徽章（見 `drawMovableRulers` 的 ⚠️）
    // ⚠️ `MY0 + 26` 不夠。`drawRuler` 會把尺標的字母徽章掛在**中點**上，
    //    而 h = 0 時尺標是退化的（上下端都在 `MY0`），中點就是 `MY0`——
    //    正好和量測徽章差 26，而窄畫布上兩顆徽章各高 30。退到 `+40` 之後
    //    最壞情況（h = 0）還有 10 個世界單位。h 越大中點越往上跑，
    //    所以 h = 0 就是最壞的那一檔。
    const H_BADGE_Y = MY0 + 40;          // h 徽章掛在 h 尺標固定的下端之下
    const S_BADGE_DY = 40;               // s 徽章離 s 尺標會動的那一端多遠

    // 兩組說明的**文字本身**也放在這裡，不是寫在 `caption(...)` 的呼叫點上。
    // 理由和上面那三行一樣：`verify-machines.js` ⑬ 要用這幾串字去量保守外框
    // （全形 1 em／數字 0.62 em／空白 0.35 em），量到的寬度必須是**真的畫出去
    // 的那一串**。寫成第二份字串的話，改了一邊、驗證器量的還是舊的那一串，
    // 而畫面上只會安靜地多出幾個被裁掉的字。
    const CAPTION_FIXED = ['兩個力臂都是半徑 r', '→ 等臂槓桿 → F = G'];
    const CAPTION_MOVABLE = ['支點在繩子的切點上', '不在輪心 → 2:1 的槓桿', '→ F = G / 2'];

    /** 定滑輪 = 等臂槓桿。
     *
     * 兩條拉力的作用線都切於同一個圓，所以**兩個力臂都是半徑 r**——畫面上
     * 就是兩條從輪心連到切點的綠色虛線。角度怎麼轉，這兩條永遠等長，這正是
     * 「F 與拉繩方向無關」的幾何長相。
     */
    function drawEqualArm(p, view, pr) {
        const { rig, path, ang } = pr;
        const c = { x: rig.cx, y: rig.cy };
        const r = rig.r;
        const loadPt = path.pts[1];              // 左切點（載重那一側）
        const tx = rig.cx + r * Math.cos(ang), ty = rig.cy - r * Math.sin(ang);

        // 兩條力臂（虛線）
        Sc.dash(p, view, [6, 5]);
        Sc.strokeOn(p, Sc.C_ARM, Sc.L(view, 2.2, 1));
        Sc.lineW(p, view, c.x, c.y, loadPt.x, loadPt.y);
        Sc.lineW(p, view, c.x, c.y, tx, ty);
        Sc.dash(p, view, null);

        // 支點
        Sc.drawFulcrum(p, view, c.x, c.y, { size: 16 });

        Sc.worldBadge(p, view, c.x - NOTE_DX, c.y - NOTE_DY,
            'l₁ = r', { col: Sc.C_ARM, size: 14 });
        Sc.worldBadge(p, view, c.x + NOTE_DX, c.y - NOTE_DY,
            'l₂ = r', { col: Sc.C_ARM, size: 14 });
        caption(p, view, c.y, CAPTION_FIXED);
    }

    /** 動滑輪 = 2:1 的槓桿。支點在繩子離開滑輪的那個切點，不在輪心。 */
    function drawTwoToOneArm(p, view, pr) {
        const { rig } = pr;
        const r = rig.r;
        // 支點：繩子從左邊垂下來離開滑輪的那個切點
        const piv = { x: rig.cx - r, y: rig.my };
        const loadPt = { x: rig.cx, y: rig.my };        // 物體：輪軸
        const handPt = { x: rig.cx + r, y: rig.my };    // 手：右切點

        Sc.dash(p, view, [6, 5]);
        Sc.strokeOn(p, Sc.C_ARM, Sc.L(view, 2.2, 1));
        Sc.lineW(p, view, piv.x, piv.y, handPt.x, handPt.y);   // 2r
        Sc.lineW(p, view, piv.x, piv.y, loadPt.x, loadPt.y);   // r
        Sc.dash(p, view, null);
        Sc.drawFulcrum(p, view, piv.x, piv.y, { size: 16 });

        // ⚠️ 兩個標籤**要左右分開**：`piv`、`loadPt`、`handPt` 兩兩只差 38 個
        //    世界單位，標籤連框寬 68——擺在同一個 x 附近一定疊（舊版就是，兩顆
        //    都在輪心附近，於是「l₂ = 」和「l₁ = 2」貼在一起、兩個 `r` 都不見）。
        //    退到 `CX ∓ NOTE_DX` 之後兩顆相距 228，中間隔著整個滑輪。
        Sc.worldBadge(p, view, CX - NOTE_DX, piv.y - NOTE_DY,
            'l₂ = r', { col: Sc.C_ARM, size: 14 });
        Sc.worldBadge(p, view, CX + NOTE_DX, piv.y - NOTE_DY,
            'l₁ = 2r', { col: Sc.C_ARM, size: 14 });
        caption(p, view, piv.y, CAPTION_MOVABLE);
    }

    /**
     * 疊圖右邊那段說明。**靠右對齊在滑輪左邊的空白帶**（右緣 `CX − 60`）：
     * 中央 76 個世界單位是兩條繩子夾出來的走廊，在那裡橫放一句 15 級的中文
     * 一定壓到繩子——舊版把整句擺在輪心正下方，句子穿過繩子、穿過動滑輪的
     * 框、還蓋掉「400 N」的標籤。
     */
    function caption(p, view, y0, lines) {
        lines.forEach((s, i) => {
            Sc.label(p, view, CAPTION_X, y0 + CAPTION_DY0 + i * CAPTION_LEAD, s, Sc.C_ARM,
                { size: 15, align: p.RIGHT });
        });
    }

    /** 定滑輪：只有 h 一條尺標，因為 s = h。 */
    function drawFixedRuler(p, view, pr) {
        const { rig, st } = pr;
        const hFrom = LOAD_Y0, hTo = rig.loadEnd.y;

        Sc.dash(p, view, [7, 6]);
        Sc.strokeOn(p, Sc.C_FORCE, Sc.L(view, 1.6, 1));
        Sc.lineW(p, view, rig.cx + rig.r + 40, hFrom, RULER_X + 14, hFrom);
        Sc.dash(p, view, null);

        Sc.drawRuler(p, view, RULER_X, hFrom, hTo, 'h', Sc.C_FORCE, { oy: 0 });
        Sc.worldBadge(p, view, RULER_X, hTo - 26,
            `h = ${(st.h * 100).toFixed(0)} cm`, { col: Sc.C_FORCE, size: 14 });

        Sc.label(p, view, 60, NOTE_Y, sumLine(pr), Sc.C_PIVOT,
            { size: 17, align: p.LEFT });
        Sc.label(p, view, 60, NOTE_Y + 30,
            `s ÷ h = ${st.sOverH.toFixed(2)}　（繩子拉出 ${(st.s * 100).toFixed(0)} cm，`
            + `物體就升高 ${(st.h * 100).toFixed(0)} cm）　·　定滑輪不省功`,
            Sc.C_OFF, { size: 15, align: p.LEFT });
    }

    /** 動滑輪：h 與 s 兩條尺標並排，比永遠是 1 : 2。 */
    function drawMovableRulers(p, view, pr) {
        const { rig, st } = pr;
        const hFrom = MY0, hTo = rig.my;
        const sFrom = rig.handY0, sTo = rig.handY0 - pr.sW;

        Sc.dash(p, view, [7, 6]);
        Sc.strokeOn(p, Sc.C_FORCE, Sc.L(view, 1.6, 1));
        Sc.lineW(p, view, rig.cx + rig.r + 40, hFrom, RULER_X + 14, hFrom);
        Sc.strokeOn(p, Sc.C_ON, Sc.L(view, 1.6, 1));
        Sc.lineW(p, view, rig.cx + rig.r + 40, sFrom, RULER_X + 14, sFrom);
        Sc.dash(p, view, null);

        Sc.drawRuler(p, view, RULER_X, hFrom, hTo, 'h', Sc.C_FORCE, { oy: 0 });
        Sc.drawRuler(p, view, RULER_X, sFrom, sTo, 's', Sc.C_ON, { oy: 0 });

        // ⚠️ 兩顆量測徽章**不能**都掛在尺標「會動的那一端」上：
        //     · h 尺標的下端固定在 `MY0`，上端才是會動的 `hTo`。掛在上端的話，
        //       它會一直停在力臂標籤下面 4 個世界單位（`hTo − 26` vs `hTo − 22`），
        //       而兩顆的寬度加起來比它們的間距還大——**窄畫布上直接疊在一起**
        //       （視窗 1100 px 時的世界尺度是 0.5，見 `verify-machines.js` ⑬）。
        //       掛在固定的下端 `MY0 + 26` 就拉開了 52 個世界單位。
        //     · s 尺標的上端固定在 `handY0`，下端的 `sTo` 才是會動的。徽章留在
        //       上端附近沒錯，但要退到 `sTo − 40`：尺標自己的 `'s'` 字母徽章
        //       掛在中點，`s = 0` 時兩顆只差 40 個世界單位，而徽章高 30。
        Sc.worldBadge(p, view, RULER_X, H_BADGE_Y,
            `h = ${(st.h * 100).toFixed(0)} cm`, { col: Sc.C_FORCE, size: 14 });
        Sc.worldBadge(p, view, RULER_X, sTo - S_BADGE_DY,
            `s = ${(st.s * 100).toFixed(0)} cm`, { col: Sc.C_ON, size: 14 });

        Sc.label(p, view, 60, NOTE_Y, sumLine(pr), Sc.C_PIVOT,
            { size: 17, align: p.LEFT });
        Sc.label(p, view, 60, NOTE_Y + 30,
            `s ÷ h = ${st.sOverH.toFixed(2)}　（手多拉一倍的繩子，物體只升一半）`
            + `　·　動滑輪和它的框也一起被提起來，所以要算進 G動`,
            Sc.C_OFF, { size: 15, align: p.LEFT });
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    let panelRef = null;
    const G_t = { last: 0 };

    LabScene.run({
        // ⚠️ 左欄公式框在 1100px 時只有約 183px 寬，KaTeX display 模式不換行。
        //    兩條式子寫成兩行、`s` 的關係另外一行，才塞得進去（原本用 \qquad
        //    接在後面會寬到 250px）。**壓在 180px 以內。**
        formula: '\\begin{aligned}'
               + '\\text{定滑輪}\\;& F = G,\\quad s = h \\\\[3pt]'
               + '\\text{動滑輪}\\;& F = \\frac{G + G_{動}}{2} \\\\[3pt]'
               + '&\\quad s = 2h'
               + '\\end{aligned}',
        formulaFallback: '定滑輪 F = G, s = h　　動滑輪 F = (G+G動)/2, s = 2h',

        controls: {
            selects: [
                { key: 'mode', label: '看哪一種滑輪', def: 'movable',
                  options: [
                      { v: 'movable', t: '動滑輪（會跟著物體跑）' },
                      { v: 'fixed', t: '定滑輪（掛在天花板）' },
                  ] },
            ],
            sliders: [
                { key: 'sCm', label: '繩子拉出多遠 s', def: S_DEF,
                  min: S_MIN, max: S_MAX, step: 2, unit: 'cm', dec: 0 },
                { key: 'G', label: '物重 G', def: G_DEF,
                  min: G_MIN, max: G_MAX, step: 20, unit: 'N', dec: 0 },
                // ⚠️ **兩支滑桿各屬於一個模式，用 `when` 收起來**（見 `lab-scene.js`
                //    的 `syncVisibility`）。留著另一模式的那一支，學生會去拉一個
                //    **對畫面完全沒有影響**的滑桿——那比沒有這支滑桿更糟。
                //    兩者的物理本來就是分開的：定滑輪不吃 G動（`fixedPulleyState`
                //    把 G動 寫死成 0），動滑輪不看拉繩方向（`stateOf` 直接強制 0），
                //    所以收起來不會讓任何一個數字改變。
                { key: 'Gm', label: '動滑輪＋框重 G動（定滑輪不計）', def: GM_DEF,
                  min: GM_MIN, max: GM_MAX, step: 10, unit: 'N', dec: 0,
                  when: p => p.mode !== 'fixed' },
                { key: 'f', label: '摩擦阻力 f', def: F_DEF,
                  min: F_MIN, max: F_MAX, step: 5, unit: 'N', dec: 0 },
                { key: 'ang', label: '拉繩的方向（只有定滑輪用得到）', def: ANG_DEF,
                  min: ANG_MIN, max: ANG_MAX, step: 5, unit: '°', dec: 0,
                  when: p => p.mode === 'fixed' },
            ],
        },

        cards: [
            { label: '段數 n', id: 'cardN', unit: '段', highlight: true },
            { label: '手的拉力 F', id: 'cardF', unit: 'N', highlight: true },
            { label: '物重 G', id: 'cardG', unit: 'N' },
            // ⚠️ 卡片跟著它的滑桿一起收。留一張「動滑輪重 G動」的卡片、而控制它的
            //    滑桿已經消失，是同一件事只講一半——而且那一格數字在定滑輪模式
            //    下不影響任何東西（`fixedPulleyState` 不看它），看起來卻像有影響。
            { label: '動滑輪重 G動', id: 'cardGm', unit: 'N',
              when: p => p.mode !== 'fixed' },
            { label: '物體上升 h', id: 'cardH', unit: 'cm' },
            { label: '繩子拉出 s', id: 'cardS', unit: 'cm' },
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
            const next = Math.min(S_MAX, panel.sCm + dt * PULL_SPEED);
            if (next !== panel.sCm) panel.set('sCm', next);
        },

        values(t, panel, _sol, pr) {
            const st = pr.st;
            return {
                cardN: String(st.n),
                cardF: st.F.toFixed(pr.mode === 'fixed' ? 0 : 1),
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
            const name = pr.mode === 'fixed' ? '定滑輪' : '動滑輪';
            return `${name}　n = ${st.n} 段　G = ${pr.G.toFixed(0)} N　`
                 + `F = ${st.F.toFixed(1)} N　h = ${(st.h * 100).toFixed(0)} cm　`
                 + `s = ${(st.s * 100).toFixed(0)} cm`
                 + `　（物重的 ${(st.ratio * 100).toFixed(0)}%）`;
        },

        draw(p, view, t, panel, pr) {
            drawScene(p, view, t, panel, pr);
        },
    });

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            R, CX, CEIL_Y, GAP, LOAD_Y0, MY0, RULER_X, NOTE_Y,
            NOTE_DX, NOTE_DY, CAPTION_X, CAPTION_DY0, CAPTION_LEAD,
            H_BADGE_Y, S_BADGE_DY, CAPTION_FIXED, CAPTION_MOVABLE,
            WORLD_PER_M, toWorld, toMetre,
            S_MIN, S_MAX, S_DEF, G_MIN, G_MAX, G_DEF,
            GM_MIN, GM_MAX, GM_DEF, F_MIN, F_MAX, F_DEF,
            ANG_MIN, ANG_MAX, ANG_DEF, PULL_SPEED,
            stateOf, sumLine, loadTopOf, loadXOf, clamp,
        };
    }
})();
