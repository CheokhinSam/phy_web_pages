/**
 * ⚖️ 槓桿與力臂
 *
 * 這一頁只有一個教學目標：**力臂是「支點到力作用線的垂直距離」，不是
 * 「支點到作用點的距離」。**
 *
 * 這句話在課本上是一行定義，在這裡是一個可以親手轉出來的現象：把「手那一邊
 * 的施力方向」滑桿從 0° 轉到 70°，**作用點一個字都沒動**（它就在秤桿上，
 * 由 `armR` 決定），但畫面上的綠色力臂虛線明顯縮短、$l_2$ 的讀數當場掉下來、
 * 手要出的力跟著變大。左邊掛著的重物永遠豎直向下，所以它的力臂就等於
 * 「支點到作用點」——兩邊一對照，差別就出來了。
 *
 * 畫面上的每一條虛線、每一個 $l$ 的讀數、每一次平衡判斷，全部來自
 * `MachineKit.armOf()` 這一支——畫的和算的是同一個數，所以「虛線變短了但
 * 數字沒動」這種事在結構上不可能發生。
 *
 * 第二個模式是**桿秤**（對應人教版 2024 版第 2 節「跨學科實踐：制作简易杆秤」）：
 * 同一個平衡條件的另一個長相。秤砣位置與物重成正比，所以刻度是**等距**的，
 * 而空盤時秤砣的位置就是「定盤星」。
 *
 * ⚠️ **這一頁刻意沒有圖表。** 世界只有 900 寬、槓桿橫跨 x[86, 814]，
 *    `drawGraph` 又永遠畫一塊不透明的底板（`lab-scene.js`），所以右邊
 *    x[620, 900] 塞不下任何不重疊的圖表。這一頁原本有一張，而且它正好蓋在
 *    **代表手的 F₂ 力箭頭和它的標籤**上面——學生看到的畫面裡從頭到尾沒有
 *    「手」，只有一條斷掉的綠色虛線和右邊在跳的卡片。四頁兄弟都刻意把場景
 *    關在 `GRAPH.x` 左邊，只有這一頁讓場景鑽到圖表底下。
 *    圖表的內容本身也不需要：模式 A 是 F₂–l₂ 雙曲線（八年級不畫這個），
 *    模式 B 的「等價刻度」秤桿上已經畫了。
 */

var Lever = (function () {
    'use strict';

    const Kit = MachineKit;
    const Sc = MachineScene;

    // ======================================================================
    // 邏輯世界（900 × 900）
    // ======================================================================
    const WORLD = 900;                     // 世界邊長（LabScene 的 WORLD_W）
    const PIVOT = { x: 450, y: 470 };      // 支點（翹翹板）
    const ARM_MIN = 40, ARM_MAX = 340;     // 作用點離支點的距離（公分）
    const F_SCALE = 0.26;                  // 每 1 N 畫多長（世界單位）
    const F2_DRAW_MAX = 900;               // 箭頭長度的上限（牛頓）
    const NOTE_Y = 740;                    // 底部那一行旁白
    const NOTE_TOP = NOTE_Y - 16;          // 旁白那一行的上緣（箭頭不准越過）
    const EDGE = 6;                        // 離世界邊界的邊距

    // 力箭頭與它的標籤（世界單位）
    // ⚠️ `ARROW_TIP` 必須等於 `MachineScene.drawForceArrow` 的 `o.tip || 26`。
    //    `LABEL_HALF` / `LABEL_H` 是**保守**的標籤半寬半高，兩個地方都用它：
    //    畫的時候拿它把標籤夾回世界裡，驗證的時候用 `verify-machines.js` 的
    //    `boxAt()` 反過來算一次——那個模型比實測寬約 1.3 倍，所以算出來還在
    //    世界裡，畫面上就一定在（實際值：scale 0.5 時「F₂ = 39160 N」的
    //    保守半寬是 70.5，實測約 57）。
    const ARROW_TIP = 26;
    const LABEL_HALF = 74, LABEL_H = 17;

    // 桿秤
    // ⚠️ **`PAN_ARM` 與 `BOB_FIX` 是一組，改一個一定要重算「秤量」。**
    //     定盤星 zero = 秤盤重 × PAN_ARM / 秤砣重
    //     每公斤走 perKg = PAN_ARM / 秤砣重
    //     秤量 maxRead = (BEAM_END − zero) / perKg
    //    這一組（60、1.2、0.3）給出 zero = 15 cm、每公斤 50 cm、秤量 6.5 kg，
    //    剛好蓋住「物重」滑桿的 0–5 kg。原本的（180、0.5）秤量只有 0.64 kg
    //    ——滑桿拉到 1 kg 以上秤砣就頂到底、讀數凍住，看起來像壞掉，
    //    其實是那支秤真的只能秤到那裡。
    const PAN_ARM = 60;                    // 秤盤離提紐的距離（公分）
    const BEAM_END = 340;                  // 秤桿最遠能到的地方（公分）
    const SY = 520;                        // 秤桿的高度

    // 桿秤的提紐（支點）與「提紐（支點）」那一顆標籤。
    // ⚠️ **靠右對齊是必要的，不是排版偏好**——定盤星只離提紐 15 公分
    //    （畫面上 13 個像素），兩顆都置中的話整顆疊在一起，見 `drawBar` 的註解。
    //    文字的內容與字級都放在這裡，是因為 `verify-machines.js` 要用**同一份**
    //    字串量寬度；字串寫在 `drawBar` 裡、驗證器自己再打一次，兩邊就會漂。
    const BAR_PIVOT_X = 300;                       // 提紐（支點）的 x
    const PIVOT_LAB_TEXT = '提紐（支點）', PIVOT_LAB_SIZE = 14;
    //      `DX` 不只決定標籤讓多開，也決定指示線的起點——線要從標籤右緣斜上
    //      到提紐，途中會經過定盤星徽章框的左下角。44 是在**窄畫布**
    //      （scale 0.5，徽章被 `L()` 的下限撐寬、左緣跑到 277）實算出來的下限，
    //      再小 1 公分線就伸進徽章裡——`verify-machines.js` ⑬b 在兩個尺度各量一次。
    const PIVOT_LAB_DX = 44, PIVOT_LAB_DY = -50;   // 相對提紐（負 = 左、上）
    const ZERO_BADGE_TEXT = '定盤星', ZERO_BADGE_SIZE = 13, ZERO_BADGE_DY = -52;

    // ⚠️ 公分 ↔ 世界單位：這一頁 1 公分 = 1 世界單位，只是比例尺。
    const toWorld = cm => cm;

    // ======================================================================
    // 滑桿
    // ======================================================================
    const A_MIN = 40, A_MAX = 340;
    const A_DEF_L = 100, A_DEF_R = 200;                // 兩邊的起始力臂（公分）
    const F1_MIN = 50, F1_MAX = 800, F1_DEF = 300;     // 重物（N）
    const ANG_MIN = 0, ANG_MAX = 80, ANG_DEF = 0;      // 力的方向（度，從豎直向下算）
    const M_MIN = 0, M_MAX = 5, M_DEF = 2;             // 物重（公斤）
    const L_MIN = 0, L_MAX = BEAM_END, L_DEF = 180;    // 秤砣位置（公分）
    const BOB_FIX = 1.2, PAN_FIX = 0.3;                // 秤砣重／秤盤重（kg，固定）

    // ======================================================================
    // 「開始 START」要動的東西
    // ----------------------------------------------------------------------
    // ⚠️ **這一頁原本沒有 `onFrame`，所以開始鍵按下去整張畫布文風不動。**
    //    `model(t, panel)` 不看 `t`、`draw` 也不看 `t`，時間一直跑、畫面一直
    //    是同一張——而 `errs=0`、卡片有數字、爆框 0，
    //    **在瀏覽器裡完全看不出來有任何不對**（看截圖也一樣，因為它就是一張
    //    正確的靜態圖）。只有真的去按那顆按鈕，或是把 t=0 與跑完之後的畫布
    //    逐位元組比對，才會發現。
    //    `verify-machines.js` ⑭ 現在會把每一頁的 `onFrame` 真的跑幾百幀，
    //    斷言**卡片上的數字必須改變**——那正是學生看到的東西。
    //
    // 兩個模式各有一個「跑起來會自己動」的量：
    //   · 翹翹板：手的施力方向一路轉斜。作用點一個字都沒動，力臂自己縮短，
    //     F₂ 自己漲上去——這一頁的殺手級畫面，讓它自己演一遍。
    //   · 桿秤：秤砣自己滑到平衡的位置就停下來。停下來的地方就是讀數，
    //     所以動畫的終點**就是答案**。
    const ANG_SPEED = 24;                  // 每秒幾度

    // ⚠️ **動畫停在 70°，滑桿卻可以拉到 80°。** 動畫的終點是學生的第一印象，
    //    要選在「力臂明顯縮短、F₂ 明顯變大，但兩顆標籤都還讀得清楚」的地方：
    //    θ = 80° 時 l₂ 只剩 0.17 倍，綠線縮成一顆點，F₂ 衝到四位數。
    //    滑桿本身拉得到 80°——`fitArrow()` / `arrowLabelAt()` 會把箭頭和標籤
    //    都夾在世界裡，所以拉到底也只會看到「長度封頂」而不是被裁掉半截。
    //    （原本這個 70 是為了「標籤會飛出畫布」而設的，現在那個理由由
    //      `fitArrow()` 接管了；留下來的理由是畫面好不好讀。）
    const ANG_RUN_MAX = 70;
    const BOB_SPEED = 90;                  // 每秒幾公分
    let lastT = 0;                         // onFrame 用的上一個時間戳
    let panelRef = null;                   // onReset 要用

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

    // ======================================================================
    // 箭頭防裁切
    // ----------------------------------------------------------------------
    // ⚠️ **畫布外的東西不會報錯，只會靜靜地不見**（README 陷阱九）。
    //    F₂ = F₁l₁/l₂ 在力臂短的時候可以衝到幾千牛，照著比例畫會整支戳出
    //    畫布——而滑桿本來就拉得到那些參數：
    //
    //        armL  armR  F₁   θ    標籤右緣（世界座標，世界寬 900）
    //        100   200   300  80°  956.8   ← 滑桿拉得到的範圍內就已經爆了
    //        100   340   800  70°  1042.5
    //        340   340   800  80°  1106.1
    //
    //    分成兩件事各自夾住，理由不一樣：
    //      · `fitArrow()` 夾的是**箭頭本身**——它沒有標籤可以被夾回來，
    //        戳出去就是戳出去了，所以只能縮短。
    //      · `arrowLabelAt()` 夾的是**標籤的位置**——標籤是一顆白底徽章，
    //        平移一下還是讀得懂，所以不縮短箭頭，只把它挪回世界裡。
    // ======================================================================

    /**
     * 箭頭本身留在世界裡（**不含標籤**）。
     * @param {number} ang 弧度，0 = 豎直向下（與 `drawForceArrow` 同一個約定）
     * @returns {number} 夾完的長度；`lenMax` 以內、且不戳出四周
     */
    function fitArrow(x, y, ang, lenMax) {
        const dx = Math.sin(ang), dy = Math.cos(ang);
        let len = lenMax;
        if (dx > 1e-9) len = Math.min(len, (WORLD - EDGE - x) / dx);
        if (dx < -1e-9) len = Math.min(len, (x - EDGE) / -dx);
        if (dy > 1e-9) len = Math.min(len, (NOTE_TOP - y) / dy);
        if (dy < -1e-9) len = Math.min(len, (y - EDGE) / -dy);
        return Math.max(0, len);
    }

    /**
     * 力的標籤掛在哪裡：尖端再過去 `ARROW_TIP`，但整顆夾在世界（與旁白那一行）
     * 之內。`MachineScene.drawForceArrow` 內部就是畫在這個位置，所以這裡的
     * 算式必須和它逐步相同（README 陷阱十七：幾何輔助函式要照著繪製碼重算）。
     */
    function arrowLabelAt(x, y, ang, len, halfW, halfH) {
        const hw = halfW == null ? LABEL_HALF : halfW;
        const hh = halfH == null ? LABEL_H : halfH;
        const cx = x + Math.sin(ang) * (len + ARROW_TIP);
        const cy = y + Math.cos(ang) * (len + ARROW_TIP);
        return { x: clamp(cx, EDGE + hw, WORLD - EDGE - hw),
                 y: clamp(cy, EDGE + hh, NOTE_TOP - hh) };
    }

    /**
     * 桿秤的「提紐（支點）」標籤與它那條指示線（世界座標）。
     *
     * ⚠️ 放在這裡而不是寫死在 `drawBar` 裡，是因為 `verify-machines.js` 要拿
     * **同一組數字**去斷言「提紐的標籤沒有蓋到定盤星的徽章」。兩邊各寫一份
     * 就會漂——而漂掉的症狀正是這一組數字要防的那個（見 `drawBar` 的註解）。
     */
    function barPivotMark() {
        const px = BAR_PIVOT_X;
        return {
            text: PIVOT_LAB_TEXT, size: PIVOT_LAB_SIZE,
            tx: px - PIVOT_LAB_DX, ty: SY + PIVOT_LAB_DY,
            // 指示線從標籤右緣拉到提紐，**起點不能離標籤太遠**：它往上斜的途中
            // 會經過定盤星徽章框的左下角（徽章在窄畫布上更寬），拉太開就被蓋掉。
            line: { x0: px - PIVOT_LAB_DX + 2, y0: SY + PIVOT_LAB_DY,
                    x1: px - 4, y1: SY - 15 },
        };
    }

    /** 桿秤：現在這個物重，秤砣該停在哪裡（夾在秤桿的範圍內）。 */
    function bobTarget(panel) {
        return clamp(stateOf(panel).sy.posOf(panel.m), L_MIN, L_MAX);
    }

    // ======================================================================
    // 狀態
    // ======================================================================
    function stateOf(panel) {
        const mode = panel.mode;

        if (mode === 'lever') {
            // 左邊掛重物、右邊用手壓。左邊的作用點在支點左邊，所以 arm 給負的
            // ——`armOf()` 取的是垂距的絕對值，負號只決定它在哪一側。
            //
            // ⚠️ **左邊的角度固定是 0，而且必須明寫出來。** 掛著的重物本來就
            //    豎直向下，讓它斜只是為了湊兩邊對稱；但 `drawArm()` 會吃
            //    `pr.angL`，少一個欄位就是 `Math.sin(undefined)` = NaN——
            //    canvas 對 NaN 路徑**靜默不畫**，l₁ 的虛線、作用線、直角記號
            //    會一起消失，而 `errs=0`。所以這裡回傳 `angL: 0`，不是不回傳。
            const angL = 0;
            const angR = panel.angR * Kit.DEG;
            const st = Kit.leverState({
                pivot: PIVOT,
                left:  { arm: -panel.armL, angle: angL, F: panel.F1 },
                right: { arm:  panel.armR, angle: angR },
            });
            return { mode, st, angL, angR, angRdeg: panel.angR, F1: panel.F1 };
        }

        // 桿秤：提紐是支點，秤盤固定在一側，秤砣在另一側滑動
        const sy = Kit.steelyardState({
            panArm: PAN_ARM, mBob: BOB_FIX, mPan: PAN_FIX,
            beamEnd: BEAM_END,
        });
        const reading = sy.readingOf(panel.l);
        return { mode, sy, l: panel.l, m: panel.m,
                 reading, balanced: Math.abs(reading - panel.m) < 0.02 };
    }

    // ======================================================================
    // 底部那一行旁白
    // ----------------------------------------------------------------------
    // ⚠️ **就只有一行，而且是動態組出來的**（F₂ 可以是四位數）。世界寬 900、
    //    scale 0.5 時字級被 `L(view, 17, 8)` 的下限撐住，換算回世界單位是
    //    17，所以一行大約有 46 個全形字的預算——**多兩個字就整行溢出畫布外，
    //    而沒有人會知道**。`verify-machines.js` 的 ⑭ 有一條斷言，用它的
    //    `textW()` 在極端參數 × 兩個縮放尺度各量一次。
    // ======================================================================
    function leverNarration(pr) {
        const s = pr.st;
        if (pr.angRdeg < 0.5) {
            return `θ = 0°　力豎直向下，力臂就是支點到作用點：`
                 + `l₁ = ${s.l1.toFixed(0)} cm　l₂ = ${s.l2.toFixed(0)} cm`;
        }
        // 箭頭長度封頂時老實說一聲——不然學生會拿兩支箭頭的長度去比，
        // 而那時候長度已經不代表力的大小了。
        const cap = s.F2 > F2_DRAW_MAX ? '（箭頭畫到這裡為止）' : '';
        return `θ = ${pr.angRdeg.toFixed(0)}°　作用點沒動，力臂縮到 ${s.l2.toFixed(0)} cm`
             + ` → 手要出 ${s.F2.toFixed(0)} N${cap}`;
    }

    function barNarration(pr) {
        const sy = pr.sy;
        return `定盤星 ${sy.zero.toFixed(0)} cm（空盤時秤砣的位置）`
             + `　每 1 kg 秤砣走 ${sy.perKg.toFixed(0)} cm → 刻度等距`;
    }

    // ======================================================================
    // 畫面：翹翹板與撬棒
    // ======================================================================
    function drawLever(p, view, t, panel, pr) {
        const s = pr.st;
        const pl = { x: PIVOT.x - panel.armL, y: PIVOT.y };
        const prr = { x: PIVOT.x + panel.armR, y: PIVOT.y };

        // 桿與支點
        Sc.drawBeam(p, view, PIVOT.x - ARM_MAX - 24, PIVOT.x + ARM_MAX + 24, PIVOT.y);
        Sc.drawFulcrum(p, view, PIVOT.x, PIVOT.y, { size: 30 });

        // 力臂（虛線 + 直角記號）——畫面與數字都來自 armOf
        Sc.drawArm(p, view, PIVOT, pl, pr.angL, `l₁ = ${s.l1.toFixed(0)}`,
            { col: Sc.C_ARM });
        Sc.drawArm(p, view, PIVOT, prr, pr.angR, `l₂ = ${s.l2.toFixed(0)}`,
            { col: Sc.C_ARM });

        // 作用點
        for (const q of [pl, prr]) {
            Sc.strokeOn(p, Sc.C_PIVOT, Sc.L(view, 2, 1));
            p.noFill();
            Sc.circleW(p, view, q.x, q.y, 5);
        }

        // ---- 重物那一邊：豎直向下，長度照 F₁ ----
        // 「支點到作用點」那條灰色的對照線**不畫**：作用點就在秤桿上，所以
        // 那條線永遠和秤桿重疊，畫了也看不見（這正是重點——它從頭到尾沒動，
        // 動的只有綠色那條力臂）。數字留在右邊的卡片上。
        const f1Text = `F₁ = ${pr.F1.toFixed(0)} N`;
        const f1Len = fitArrow(pl.x, pl.y + 6, pr.angL, pr.F1 * F_SCALE);
        Sc.drawForceArrow(p, view, pl.x, pl.y + 6, f1Len, pr.angL, '', Sc.C_LOAD);
        const f1At = arrowLabelAt(pl.x, pl.y + 6, pr.angL, f1Len);
        Sc.worldBadge(p, view, f1At.x, f1At.y, f1Text, { col: Sc.C_LOAD, size: 15 });

        // ---- 手那一邊：方向可以轉斜，長度照 F₂（兩支同一個比例尺）----
        const f2Text = `F₂ = ${s.F2.toFixed(0)} N`;
        const f2Len = fitArrow(prr.x, prr.y + 6, pr.angR,
            Math.min(s.F2, F2_DRAW_MAX) * F_SCALE);
        Sc.drawForceArrow(p, view, prr.x, prr.y + 6, f2Len, pr.angR, '', Sc.C_FORCE);
        const f2At = arrowLabelAt(prr.x, prr.y + 6, pr.angR, f2Len);
        Sc.worldBadge(p, view, f2At.x, f2At.y, f2Text, { col: Sc.C_FORCE, size: 15 });

        // 結論
        Sc.worldBadge(p, view, PIVOT.x, 150,
            `${s.kind}槓桿　　l₁ : l₂ = ${s.ratio.toFixed(2)}`, { col: Sc.C_PIVOT, size: 16 });

        Sc.label(p, view, 60, NOTE_Y, leverNarration(pr), Sc.C_PIVOT,
            { size: 17, align: p.LEFT });
    }

    // ======================================================================
    // 畫面：桿秤
    // ======================================================================
    function drawBar(p, view, t, panel, pr) {
        const sy = pr.sy;
        const px = BAR_PIVOT_X;               // 提紐（支點）的 x
        const panX = px - PAN_ARM;            // 秤盤那一側
        const beamL = px - PAN_ARM - 40, beamR = px + BEAM_END + 20;

        // 秤桿
        Sc.drawBeam(p, view, beamL, beamR, SY, { th: 14 });
        Sc.drawFulcrum(p, view, px, SY - 8, { size: 22 });

        // 提紐（支點）
        // ⚠️ **這兩顆標籤不能都置中畫在秤桿上方。** 定盤星固定在提紐右邊
        //    `sy.zero`（= 15 公分，常數、不隨任何滑桿變）而已，而秤桿在畫面上
        //    每公分只有 0.89 個畫布像素——15 公分等於 13 個像素。兩顆置中會直接
        //    疊在一起：實測「提紐（支點）」的右半邊整個被「定盤星」的徽章蓋掉，
        //    畫面上只剩「提紐 定盤星」黏成一團，看起來像在標同一個東西。
        //    而這一節要教的**正好是相反的**——零刻度不在提紐底下。
        //    所以提紐（支點）改成靠右對齊讓到左邊，再拉一條指示線指回提紐。
        const mk = barPivotMark();
        Sc.strokeOn(p, Sc.C_PIVOT, Sc.L(view, 2, 1));
        Sc.lineW(p, view, mk.line.x0, mk.line.y0, mk.line.x1, mk.line.y1);
        Sc.label(p, view, mk.tx, mk.ty, mk.text,
            Sc.C_PIVOT, { size: mk.size, align: p.RIGHT });

        // 秤盤與重物
        Sc.drawHook(p, view, panX, SY + 7, SY + 64);
        Sc.strokeOn(p, Sc.C_LOAD, Sc.L(view, 3, 1)); p.noFill();
        Sc.lineW(p, view, panX - 62, SY + 64, panX + 62, SY + 64);
        Sc.lineW(p, view, panX - 62, SY + 64, panX - 40, SY + 40);
        Sc.lineW(p, view, panX + 62, SY + 64, panX + 40, SY + 40);
        Sc.drawLoad(p, view, panX, SY + 100, 76, 58,
            { label: `${pr.m.toFixed(1)} kg` });

        // 秤砣（滑動的）
        const bx = px + pr.l;
        Sc.drawWeight(p, view, bx, SY, 44, 40, '砣', { col: Sc.C_HAND });

        // 定盤星
        const zx = px + sy.zero;
        Sc.strokeOn(p, Sc.C_TIE, Sc.L(view, 2.4, 1));
        Sc.lineW(p, view, zx, SY - 22, zx, SY + 22);
        Sc.worldBadge(p, view, zx, SY + ZERO_BADGE_DY, ZERO_BADGE_TEXT,
            { col: Sc.C_TIE, size: ZERO_BADGE_SIZE });

        // 刻度：等距，因為秤砣位置和物重成正比
        const ticks = [];
        for (let m = 0; m <= 5; m += 0.5) {
            const x = px + sy.posOf(m);
            if (x > beamR - 6) break;
            ticks.push({ x, major: m === Math.round(m), label: m === Math.round(m) ? m : null });
        }
        Sc.drawScaleTicks(p, view, SY, ticks, { unit: 'kg' });

        // 平衡與否
        Sc.worldBadge(p, view, px + 120, 250,
            pr.balanced ? '平衡 ✓' : (pr.reading > pr.m ? '秤砣要往左移' : '秤砣要往右移'),
            { col: pr.balanced ? Sc.C_TIE : Sc.C_FORCE, size: 17 });

        Sc.label(p, view, 60, NOTE_Y, barNarration(pr), Sc.C_PIVOT,
            { size: 17, align: p.LEFT });
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const LEVER_ONLY = pn => pn.mode === 'lever';
    const BAR_ONLY = pn => pn.mode === 'bar';

    LabScene.run({
        formula: 'F_1\\,l_1 = F_2\\,l_2',
        formulaFallback: 'F₁ · l₁ = F₂ · l₂（力臂是垂直距離）',

        // ⚠️ 滑桿與卡片是**一次全部長出來**的（`buildPanel` 沒有條件式過濾、
        //    `createDataCards` 一次換掉整個 grid），「屬於哪一個模式」只能靠
        //    `when(panel)` 在長完之後收掉——見 `lab-scene.js` 的 `syncVisibility()`。
        //    這一頁的 `when` 只看 `mode`，而 `mode` 是下拉、一定會走
        //    `change()`；**依賴滑桿「值」的 `when` 不會在動畫期間更新**
        //    （`panel.set()` 不觸發 `change()`），要加的時候得先想清楚。
        controls: {
            selects: [
                { key: 'mode', label: '看哪一種槓桿', def: 'lever',
                  options: [
                      { v: 'lever', t: '翹翹板與撬棒' },
                      { v: 'bar', t: '桿秤（跨學科實踐）' },
                  ] },
            ],
            sliders: [
                // ── 翹翹板與撬棒：4 個 ──
                { key: 'armL', label: '重物的力臂位置 l₁', def: A_DEF_L,
                  min: A_MIN, max: A_MAX, step: 10, unit: 'cm', dec: 0,
                  when: LEVER_ONLY },
                { key: 'armR', label: '手的力臂位置 l₂', def: A_DEF_R,
                  min: A_MIN, max: A_MAX, step: 10, unit: 'cm', dec: 0,
                  when: LEVER_ONLY },
                { key: 'angR', label: '手那一邊的施力方向（從豎直向下算）', def: ANG_DEF,
                  min: ANG_MIN, max: ANG_MAX, step: 5, unit: '°', dec: 0,
                  when: LEVER_ONLY },
                { key: 'F1', label: '重物 F₁', def: F1_DEF,
                  min: F1_MIN, max: F1_MAX, step: 25, unit: 'N', dec: 0,
                  when: LEVER_ONLY },
                // ── 桿秤：2 個 ──
                { key: 'm', label: '秤盤上的物重', def: M_DEF,
                  min: M_MIN, max: M_MAX, step: 0.1, unit: 'kg', dec: 1,
                  when: BAR_ONLY },
                { key: 'l', label: '秤砣的位置', def: L_DEF,
                  min: L_MIN, max: L_MAX, step: 5, unit: 'cm', dec: 0,
                  when: BAR_ONLY },
            ],
        },

        // 13 張卡片，7 + 6，每一張都帶 `when`——任一模式只看得到其中一組。
        // ⚠️ **清單本身不隨模式變動**（合併清單 + `when`，不是兩個陣列）：
        //    `createDataCards` 只換一次 innerHTML，而且驗證器把 `o.cards`
        //    當靜態陣列用了好幾次。
        // ⚠️ 一張卡片只有一個標籤、一個單位，所以**跨模式共用一張卡片是不可
        //    能的**——`cardF1`（N）與 `cardM`（kg）就是這樣分開的。
        cards: [
            // 翹翹板與撬棒（7）
            { label: '力臂 l₁（重物）', id: 'cardL1', unit: 'cm',
              highlight: true, when: LEVER_ONLY },
            { label: '力臂 l₂（手）', id: 'cardL2', unit: 'cm',
              highlight: true, when: LEVER_ONLY },
            { label: '重物 F₁', id: 'cardF1', unit: 'N', when: LEVER_ONLY },
            { label: '手要出 F₂', id: 'cardF2', unit: 'N', when: LEVER_ONLY },
            { label: 'F₁ · l₁', id: 'cardT1', unit: 'N·cm', when: LEVER_ONLY },
            { label: 'F₂ · l₂', id: 'cardT2', unit: 'N·cm', when: LEVER_ONLY },
            { label: '支點到手的距離（不是力臂）', id: 'cardNaive', unit: 'cm',
              when: LEVER_ONLY },
            // 桿秤（6）
            { label: '秤盤上的物重', id: 'cardM', unit: 'kg', when: BAR_ONLY },
            { label: '秤砣位置', id: 'cardL', unit: 'cm', when: BAR_ONLY },
            { label: '秤砣讀數', id: 'cardRead', unit: 'kg',
              highlight: true, when: BAR_ONLY },
            { label: '定盤星', id: 'cardZero', unit: 'cm', when: BAR_ONLY },
            { label: '每 1 kg 秤砣走多遠', id: 'cardPerKg', unit: 'cm', when: BAR_ONLY },
            { label: '平衡？', id: 'cardBal', unit: '',
              highlight: true, when: BAR_ONLY },
        ],

        model(t, panel) {
            panelRef = panel;
            return stateOf(panel);
        },

        onFrame(t, panel) {
            const dt = clamp(t - lastT, 0, 0.1);
            lastT = t;
            if (dt <= 0) return;

            if (panel.mode === 'bar') {
                const target = bobTarget(panel);
                // 一次最多走到目標，不要越過——秤砣會停在平衡點上，不會來回抖。
                const lo = Math.min(panel.l, target), hi = Math.max(panel.l, target);
                if (hi - lo < 0.5) return;
                const step = panel.l < target ? BOB_SPEED * dt : -BOB_SPEED * dt;
                panel.set('l', clamp(panel.l + step, lo, hi));
                return;
            }

            if (panel.angR >= ANG_RUN_MAX) return;
            panel.set('angR', Math.min(ANG_RUN_MAX, panel.angR + ANG_SPEED * dt));
        },

        onReset(reason) {
            lastT = 0;
            if (reason !== 'reset' || !panelRef) return;
            if (panelRef.mode === 'bar') panelRef.set('l', L_DEF);
            else panelRef.set('angR', ANG_DEF);
        },

        // 每一張卡片都要填到（連現在看不到的也要），否則切模式的那一瞬間
        // 卡片會是空的。
        values(t, panel, _sol, pr) {
            if (pr.mode === 'lever') {
                const s = pr.st;
                return {
                    cardL1: s.l1.toFixed(0), cardL2: s.l2.toFixed(0),
                    cardF1: pr.F1.toFixed(0), cardF2: s.F2.toFixed(0),
                    cardT1: s.torque1.toFixed(0), cardT2: s.torque2.toFixed(0),
                    cardNaive: s.d2.toFixed(0),
                    cardM: '—', cardL: '—', cardRead: '—', cardZero: '—',
                    cardPerKg: '—', cardBal: '—',
                };
            }
            return {
                cardL1: '—', cardL2: '—', cardF1: '—', cardF2: '—',
                cardT1: '—', cardT2: '—', cardNaive: '—',
                cardM: pr.m.toFixed(1), cardL: pr.l.toFixed(0),
                cardRead: pr.reading.toFixed(2),
                cardZero: pr.sy.zero.toFixed(0),
                cardPerKg: pr.sy.perKg.toFixed(0),
                cardBal: pr.balanced ? '平衡 ✓' : '不平衡',
            };
        },

        titleText(t, panel, pr) {
            if (pr.mode === 'lever') {
                const s = pr.st;
                return `槓桿　l₁ = ${s.l1.toFixed(0)} cm　l₂ = ${s.l2.toFixed(0)} cm　`
                     + `F₁ = ${pr.F1.toFixed(0)} N　→　手要出 F₂ = ${s.F2.toFixed(0)} N`
                     + `　（${s.kind}槓桿）`;
            }
            return `桿秤　物重 ${pr.m.toFixed(1)} kg　秤砣位置 ${pr.l.toFixed(0)} cm　`
                 + `讀數 ${pr.reading.toFixed(2)} kg`
                 + `　（${pr.balanced ? '平衡 ✓' : '還沒平衡'}）`;
        },

        draw(p, view, t, panel, pr) {
            if (pr.mode === 'lever') drawLever(p, view, t, panel, pr);
            else drawBar(p, view, t, panel, pr);
        },
    });

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            WORLD, PIVOT, ARM_MIN, ARM_MAX, F_SCALE, F2_DRAW_MAX,
            NOTE_Y, NOTE_TOP, EDGE, ARROW_TIP, LABEL_HALF, LABEL_H,
            PAN_ARM, BEAM_END, SY, toWorld,
            BAR_PIVOT_X, PIVOT_LAB_DX, PIVOT_LAB_DY, PIVOT_LAB_TEXT, PIVOT_LAB_SIZE,
            ZERO_BADGE_TEXT, ZERO_BADGE_SIZE, ZERO_BADGE_DY,
            A_MIN, A_MAX, A_DEF_L, A_DEF_R, F1_MIN, F1_MAX, F1_DEF,
            ANG_MIN, ANG_MAX, ANG_DEF,
            M_MIN, M_MAX, M_DEF, BOB_FIX, PAN_FIX, L_MIN, L_MAX, L_DEF,
            ANG_SPEED, ANG_RUN_MAX, BOB_SPEED,
            stateOf, leverNarration, barNarration, bobTarget, clamp,
            fitArrow, arrowLabelAt, barPivotMark,
        };
    }
})();
