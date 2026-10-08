/**
 * 🎯 水平拋射 — 水平方向等速，豎直方向自由落體
 *
 * 這一頁只有一個教學目標，而且是兩句話：
 *
 *     水平方向：**等速**（vₓ = v₀，從頭到尾不變）
 *     豎直方向：**自由落體**（v_y = gt，愈來愈快）
 *     兩者互不影響——所以「同時釋放的一顆自由落體」和拋體**同時落地**
 *
 * 這三句話在畫面上是三組各自獨立的證據，全部同一組數字算出來：
 *
 *   ① **閃光點**：等時距的殘影。水平的間距處處相同（等速），豎直的間距
 *      一個比一個大（加速）。對照地上那把尺，每個點都往前推 v₀Δt。
 *   ② **兩顆球**：一顆被水平推出去、一顆放手讓它掉。兩顆永遠同高，
 *      而且同一瞬間落地——落地的時刻只由 h 決定，和一開始推多快無關。
 *   ③ **分量箭頭**：每個閃光點上掛著一綠一紫兩支箭頭。綠的每一支都一樣長
 *      （vₓ 不變），紫的一支比一支長（v_y 遞增）。合速度必落在軌跡的切線上
 *      ——因為它本來就是那兩支的和。
 *
 * ⚠️ **時間只從一個地方來**：`at(v0, h, t)`。畫面、卡片、底部黑條全部讀
 *    它的回傳值，所以「畫的位置」和「卡片上的數字」在結構上不可能分家
 *    （和電學的 `solve()`、簡單機械的 `countStrands()` 是同一條規矩）。
 *    落地之後 `t` 被夾在 T：球停在地上、閃光點全部留著，最後那一幀
 *    就是完整的答案圖。
 *
 * ⚠️ **x 與 y 共用同一個 `SCALE`（一公尺 18 個世界單位）。** 分成兩個
 *    尺度的症狀是「拋物線看起來對、但它不是這條拋物線」——斜率、落地角、
 *    切線全部會偏，而**沒有任何數字會不對**（卡片上的 x、y、T、R 都是
 *    公尺，和畫面尺度無關）。驗證器 ③ 用「切線方向 = 速度方向」守這件事：
 *    兩個尺度一分家，那一條當場變紅。
 *
 * ⚠️ **畫面上的文字標籤只有兩顆固定徽章 ＋ 兩顆跟著球的徽章，這是量出來的。**
 *    1100 px 的視窗下畫布只有 450 px（scale 0.5），一顆徽章的字級會撞到
 *    9 px 的下限、換算回世界單位是名目的 1.29 倍——「v₀ = 12.0 m/s」在那個
 *    尺度下寬 143 個世界單位（世界的 16%）。所以：
 *      · 「放手讓它掉」「同時落地」「水平投影」這些**不掛徽章**，改寫進底部
 *        黑條的旁白（那裡永遠不會和任何東西相撞）；
 *      · 球的兩顆徽章有**明確的不相交條件**（`VY_LABEL_MIN`），由驗證器 ⑥
 *        用保守外框在兩個尺度各量一次。
 *    徽章疊在一起的畫面**不會有任何症狀**（`errs=0`、卡片全對），只能靠
 *    這一類斷言或截圖看出來（README 陷阱二十）。
 *
 * ⚠️ **紫箭頭不准插進地面。** 落地那一刻 v_y = gT 最大（19.8 m/s → 63 個
 *    世界單位），而球就貼在地上——照畫的話箭頭會穿過地面、壓過尺的刻度數字。
 *    判準寫在 `vyArrowFits()`：箭尖落到地面以下就不畫（連標籤一起）。
 *    這一類缺陷 `errs=0`、卡片全對，只有截圖看得出來，而且**只在最後幾幀**。
 *
 * 幾何、控制項、卡片、p5 生命週期都在 `lab-scene.js`（LabScene.run）。
 */

var HorizontalProjectile = (function () {
    'use strict';

    const Sc = LabScene;

    // ======================================================================
    // 邏輯世界（900 × 900，沿用 LabScene 的那一組）
    // ======================================================================
    const WORLD = 900;             // 世界邊長（LabScene 的 WORLD_W）
    const GROUND_Y = 700;          // 地面（世界 y）
    const X0 = 170;                // 拋出點：桌緣、也是球心的起始 x
    const SCALE = 18;              // 一公尺幾個世界單位（x 與 y **必須**同一個）
    const G = 9.8;                 // 重力加速度（m/s²）
    const BALL_R = 8;              // 球半徑（世界單位）
    const DOT_R = 5.5;             // 閃光點半徑
    const RULER_X1 = 870;          // 尺與等時距輔助線的右端
    const V_ARROW = 3.2;           // 速度箭頭：一 (m/s) 畫幾個世界單位

    // 版面常數（徽章位置全部由純函式算出來，驗證器 ⑥ 有東西可以餵）
    const LAUNCH_LABEL_DY = 62;    // v₀ 徽章在拋出點上方多遠
    const LAUNCH_LABEL_SIZE = 14;
    const BALL_LABEL_DY = 24;      // vₓ 徽章在球上方多遠
    const BALL_LABEL_DX = 36;      // v_y 徽章在球右方多遠
    const BALL_LABEL_SIZE = 13;
    const VY_LABEL_MIN = 24;       // 紫箭頭短於這個長度就不掛標籤（否則貼在球上）
    const BALL_LABEL_HALF = 52;    // 球徽章的保守半寬（最小尺度下最寬的那一顆）
    const RANGE_Y = GROUND_Y + 64; // 射程括號
    const RANGE_LABEL_SIZE = 14;
    const GROUND_CLEAR = 8;        // 箭尖離地面至少留這麼多，免得壓到刻度

    // ----------------------------------------------------------------------
    // 桌子：桌面 ＋ 一支置中的桌腳
    // ----------------------------------------------------------------------
    // ⚠️ **桌腳刻意置中、不靠右緣。** 右邊要留一條淨空給「放手讓它掉」的
    //    對照球（`DROP_X`），不然球是落在**桌腳裡面**的——那張畫面裡球會
    //    穿過桌腳往下掉，而 `errs=0`、卡片全對、閃光點也對，只有截圖看得出
    //    來。`DROP_X` 擺在淨空的正中央（左右各 19 個世界單位），而球的
    //    半徑是 8：所以它離桌腳、也離拋出點都還有餘裕（驗證器 ⑫ 在量）。
    const SLAB_L = X0 - 96;        // 桌面左緣（桌寬 96）
    const SLAB_H = 9;              // 桌面厚度
    const LEG_W = 20;              // 桌腳寬
    const LEG_CX = X0 - 48;        // 桌腳中心＝桌面正中央
    const DROP_X = X0 - 19;        // 對照球落下的那條鉛直線

    // ======================================================================
    // 滑桿範圍
    // ----------------------------------------------------------------------
    // 上下限是**量出來的**，不是口味：最大值代進去之後，落地點落在
    // x = 838（世界右緣 900、尺畫到 870），拋出點在 y = 160（世界頂端 0）。
    // 只要有人把上限往上開，球就會從世界右邊飛出去——而畫面上只是
    // 「球不見了」，沒有錯誤訊息（README 陷阱九）。
    // 驗證器 ⑤ 把四個角落都代進去量一次。
    // ======================================================================
    const H_MIN = 5, H_MAX = 30, H_DEF = 20;      // 拋出高度（公尺）
    const V0_MIN = 4, V0_MAX = 15, V0_DEF = 12;   // 水平初速度（公尺／秒）
    const ST_MIN = 0.2, ST_MAX = 0.6, ST_DEF = 0.25;   // 閃光間隔（秒）

    // ======================================================================
    // 配色
    // ----------------------------------------------------------------------
    // 綠＝水平分量、紫＝豎直分量：和 09 拋體運動模擬、以及 style guide 的
    // 「綠色：水平分量／紫色：垂直分量」一致。兩頁講同一件事，顏色就不該換。
    // ======================================================================
    const C_PROJ = [37, 99, 235];      // 拋體（藍）
    const C_VX   = [22, 163, 74];      // 水平分量 vₓ（綠）
    const C_VY   = [139, 92, 246];     // 豎直分量 v_y（紫）
    const C_DROP = [100, 116, 139];    // 自由落下的對照球（灰）
    const C_DOT  = [234, 88, 12];      // 閃光點（橙）
    const C_PATH = [203, 213, 225];    // 未來的軌跡（淡）
    const C_INK  = [15, 23, 42];
    const C_MUTE = [148, 163, 184];

    // ======================================================================
    // 純物理（Node 直接讀得到，沒有 DOM、沒有 p5）
    // ======================================================================

    /** 落地時間：只由高度決定，**和 v₀ 無關**——這一頁的頭號宣稱。 */
    function flightTime(h) { return Math.sqrt(2 * h / G); }

    /** 水平射程：v₀ × T。 */
    function range(v0, h) { return v0 * flightTime(h); }

    /**
     * 這一刻的狀態。`t` 一律先夾進 [0, T]——落地之後球就停在地上，
     * 卡片也停在最後那一組數字（那正是這一頁要學生記下來的答案）。
     */
    function at(v0, h, t) {
        const T = flightTime(h);
        const tc = t < 0 ? 0 : (t > T ? T : t);
        return {
            t: tc, T,
            x: v0 * tc,                 // 水平位移（公尺）
            y: 0.5 * G * tc * tc,       // 下落高度（公尺）
            vx: v0,                     // 水平速度：常數
            vy: G * tc,                 // 豎直速度：= gt
            v: Math.sqrt(v0 * v0 + G * tc * G * tc),
            landed: t >= T,
        };
    }

    /**
     * 閃光時刻（不含 t = 0，那是拋出的那一點）。**間隔恆為 dt**——
     * 這一份清單就是「等時距」這四個字的定義，畫面只能照它畫。
     */
    function strobeTimes(h, dt) {
        const T = flightTime(h);
        const out = [];
        for (let k = 1; k * dt <= T + 1e-9; k++) out.push(k * dt);
        return out;
    }

    /** 相鄰兩個閃光點（含拋出點）的間距，水平與豎直各一組。 */
    function gaps(v0, h, dt) {
        const dx = [], dy = [];
        let prevX = 0, prevY = 0;
        for (const ts of strobeTimes(h, dt)) {
            const a = at(v0, h, ts);
            dx.push(a.x - prevX);
            dy.push(a.y - prevY);
            prevX = a.x;
            prevY = a.y;
        }
        return { dx, dy };
    }

    // ---- 公尺 → 世界座標（**同一個 SCALE**，兩軸不准各用一個）----
    function worldX(xm) { return X0 + xm * SCALE; }

    /**
     * ⚠️ 這一支吃的**不是** `at().y`。`at().y` 是「已經掉了多少公尺」，
     *    這一支吃的是「離地還有多少公尺」——兩者差一個 `h - …`。
     *    餵錯的症狀是球從地面起飛、往上升，而**卡片上每一個數字都對**
     *    （卡片讀的是 `at()`，本來就沒錯），只有截圖看得出來。
     */
    function worldY(heightM) { return GROUND_Y - heightM * SCALE; }

    function spotAt(v0, h, t) {
        const a = at(v0, h, t);
        return { x: worldX(a.x), y: worldY(h - a.y) };
    }

    /**
     * 球是**踩在地面上**的，不是陷進去的：球心最低只到「地面往上一個半徑」。
     * `spotAt` 是物理的終點（t = T 時球心正好落在地面線上），把它直接拿去
     * 畫，落地那一刻就會有半顆球陷進地面、還蓋掉尺的刻度數字。
     *
     * ⚠️ 這是**畫的位置**，不是物理的位置：`spotAt` 一個字都不動（驗證器 ③
     *    的切線與「終點在地面上」量的是它）。所以「球心畫在哪裡」只能有這
     *    一個家——徽章、分量箭頭、閃光點全部走 `ballSpot`，否則徽章會浮在
     *    球上方 8 個世界單位，而畫面上只是「標籤稍微偏高」，看不出來。
     */
    function restOnGround(y, r) { return Math.min(y, GROUND_Y - r); }

    function ballSpot(v0, h, t, r) {
        const q = spotAt(v0, h, t);
        return { x: q.x, y: restOnGround(q.y, r) };
    }

    function launchYOf(h) { return worldY(h); }
    function landingXOf(v0, h) { return worldX(range(v0, h)); }

    // ======================================================================
    // 畫面幾何（純函式）
    // ----------------------------------------------------------------------
    // ⚠️ 這些是「畫在哪裡」的唯一來源，`draw()` 只准呼叫它們、不准自己再算
    //    一份。驗證器 ⑥ 就是拿它們量徽章會不會撞在一起（README 陷阱十九：
    //    `window.__page` 是一份明列的清單，所以這幾支必須匯出）。
    // ======================================================================

    /** 紫箭頭（含標籤）畫不畫得下：箭尖落在地面以下就不畫。 */
    function vyArrowFits(wy, vyUnits) { return wy + vyUnits <= GROUND_Y - GROUND_CLEAR; }

    function launchLabel(v0, h) {
        return {
            x: X0 + v0 * V_ARROW / 2 + 10,
            y: launchYOf(h) - LAUNCH_LABEL_DY,
            text: `v₀ = ${v0.toFixed(1)} m/s`,
            size: LAUNCH_LABEL_SIZE,
            col: C_VX,
        };
    }

    function rangeLabel(v0, h) {
        return {
            x: (X0 + landingXOf(v0, h)) / 2,
            y: RANGE_Y,
            text: `射程 R = ${range(v0, h).toFixed(1)} m`,
            size: RANGE_LABEL_SIZE,
            col: C_INK,
        };
    }

    /**
     * 球上掛的兩顆徽章。`v_y` 那顆可能不存在（null），條件有兩個：
     * 箭頭畫得下（不插進地面）、而且夠長（不然標籤會貼在球上，
     * 和 vₓ 那顆疊在一起）。
     *
     * ⚠️ 兩個 x 都要**夾在世界裡面**。球飛到最右邊（v₀ = 15、h = 30）時
     *    `q.x` 已經到 838，而最小尺度下一顆徽章半寬 46 個世界單位——
     *    不夾的話標籤的右緣會落在世界外 8 個單位，被畫布裁掉半個字。
     *    `BALL_LABEL_HALF` 是「最寬的那一顆在最小尺度下的保守半寬」，
     *    由驗證器 ⑥ 用量到的字寬反過來斷言它夠大（不夠大就變紅）。
     */
    function ballLabels(v0, h, t) {
        const a = at(v0, h, t);
        const q = ballSpot(v0, h, t, BALL_R);
        const lx = a.vx * V_ARROW, ly = a.vy * V_ARROW;
        const vyOK = vyArrowFits(q.y, ly);
        const clampX = x => Math.min(Math.max(x, BALL_LABEL_HALF), WORLD - BALL_LABEL_HALF);
        return {
            q, a, lx, ly, vyOK,
            vx: {
                x: clampX(q.x + lx / 2), y: q.y - BALL_LABEL_DY,
                text: `vₓ ${a.vx.toFixed(1)}`, size: BALL_LABEL_SIZE, col: C_VX,
            },
            vy: (vyOK && ly >= VY_LABEL_MIN) ? {
                x: clampX(q.x + BALL_LABEL_DX), y: q.y + ly / 2,
                text: `v_y ${a.vy.toFixed(1)}`, size: BALL_LABEL_SIZE, col: C_VY,
            } : null,
        };
    }

    // ======================================================================
    // 繪圖小工具（全部吃**世界座標**，像素換算只發生在裡面）
    // ======================================================================

    function fillW(p, view, col, a) {
        p.fill(col[0], col[1], col[2], a == null ? 255 : a);
    }
    function strokeW(p, view, col, w, a) {
        p.stroke(col[0], col[1], col[2], a == null ? 255 : a);
        p.strokeWeight(w);
    }

    /** 世界座標的矩形（兩點順序不拘）。 */
    function rectW(p, view, x1, y1, x2, y2) {
        const sx = view.toScreenX(Math.min(x1, x2));
        const sy = view.toScreenY(Math.min(y1, y2));
        p.rect(sx, sy, view.len(Math.abs(x2 - x1)), view.len(Math.abs(y2 - y1)));
    }

    /** 虛線（`setLineDash` 不屬於 p5 的設色快取，見 README 陷阱二十九）。 */
    function dashW(p, view, x1, y1, x2, y2, col, w, a, pattern) {
        const ctx = p.drawingContext;
        const on = !!ctx.setLineDash;
        if (on) ctx.setLineDash(pattern || [view.len(9, 4), view.len(7, 3)]);
        strokeW(p, view, col, w, a);
        p.line(view.toScreenX(x1), view.toScreenY(y1),
               view.toScreenX(x2), view.toScreenY(y2));
        if (on) ctx.setLineDash([]);
    }

    /** 箭頭（世界座標）。長度不足就不畫——免得留下一顆看不出方向的點。 */
    function arrowW(p, view, x1, y1, x2, y2, col, w, a) {
        const ax = view.toScreenX(x1), ay = view.toScreenY(y1);
        const bx = view.toScreenX(x2), by = view.toScreenY(y2);
        const dx = bx - ax, dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 4) return;
        const head = Math.min(len * 0.45, view.len(14, 8));
        const ang = Math.atan2(dy, dx);
        strokeW(p, view, col, w, a);
        p.line(ax, ay, bx - head * Math.cos(ang), by - head * Math.sin(ang));
        p.noStroke();
        fillW(p, view, col, a);
        p.triangle(bx, by,
            bx - head * Math.cos(ang - 0.42), by - head * Math.sin(ang - 0.42),
            bx - head * Math.cos(ang + 0.42), by - head * Math.sin(ang + 0.42));
    }

    /** 白底彩框的數值標籤。`Sc.badge()` 吃的是**畫布像素**，這裡幫忙換算。 */
    function badgeW(p, view, wx, wy, text, o) {
        Sc.badge(p, view, view.toScreenX(wx), view.toScreenY(wy), text, o);
    }

    /** 一顆球：實心圓 + 白環 + 一點高光。 */
    function ballW(p, view, wx, wy, r, col, a) {
        const sx = view.toScreenX(wx), sy = view.toScreenY(wy);
        p.noStroke();
        fillW(p, view, col, a);
        p.ellipse(sx, sy, view.len(r * 2), view.len(r * 2));
        if (a != null && a < 255) return;
        p.noFill();
        p.stroke(255);
        p.strokeWeight(view.len(3, 1.5));
        p.ellipse(sx, sy, view.len(r * 2 + 2), view.len(r * 2 + 2));
        p.noStroke();
        p.fill(255, 255, 255, 150);
        p.ellipse(sx - view.len(r * 0.3), sy - view.len(r * 0.3),
                  view.len(r * 0.62), view.len(r * 0.62));
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    /** 地面、地上的尺、桌子、以及左邊那條高度括號。 */
    function drawStage(p, view, h) {
        const launchY = launchYOf(h);

        // 地面
        p.noStroke();
        fillW(p, view, [226, 232, 240]);
        rectW(p, view, 40, GROUND_Y, RULER_X1, GROUND_Y + 10);
        strokeW(p, view, C_INK, view.len(2.5, 1.5));
        p.line(view.toScreenX(40), view.toScreenY(GROUND_Y),
               view.toScreenX(RULER_X1), view.toScreenY(GROUND_Y));

        // 地上的尺：原點在拋出點，每一公尺一小格、每五公尺標一次數字。
        // 學生要「數」水平間距時數的就是這把尺——所以小格必須是一公尺，
        // 不能為了畫面乾淨改成兩公尺（那樣「等距」就只能用眼睛估）。
        p.textStyle(p.NORMAL);
        for (let m = 1; worldX(m) <= RULER_X1; m++) {
            const x = worldX(m);
            const major = m % 5 === 0;
            strokeW(p, view, major ? C_INK : C_MUTE, view.len(major ? 2 : 1, 1));
            p.line(view.toScreenX(x), view.toScreenY(GROUND_Y),
                   view.toScreenX(x), view.toScreenY(GROUND_Y + (major ? 13 : 6)));
            if (major && m <= 35) {
                p.noStroke();
                fillW(p, view, C_MUTE);
                p.textSize(view.len(13, 8));
                p.textAlign(p.CENTER, p.TOP);
                p.text(String(m), view.toScreenX(x), view.toScreenY(GROUND_Y + 15));
            }
        }
        p.noStroke();
        fillW(p, view, C_MUTE);
        p.textSize(view.len(13, 8));
        p.textAlign(p.LEFT, p.TOP);
        p.text('m', view.toScreenX(RULER_X1) + view.len(8), view.toScreenY(GROUND_Y + 15));

        // 桌子：桌面 + 一支置中的桌腳（桌面頂在球心下方 BALL_R 處，
        // 球才像「擺在桌上」）。桌腳置中，右邊那條淨空留給對照球，
        // 見檔頭的常數說明。
        const slabTop = launchY + BALL_R;
        const legL = LEG_CX - LEG_W / 2, legR = LEG_CX + LEG_W / 2;
        p.noStroke();
        fillW(p, view, [226, 232, 240]);
        rectW(p, view, legL, slabTop + SLAB_H, legR, GROUND_Y);
        fillW(p, view, [203, 213, 225]);
        rectW(p, view, SLAB_L, slabTop, X0, slabTop + SLAB_H);
        strokeW(p, view, C_INK, view.len(2, 1.5));
        p.noFill();
        rectW(p, view, legL, slabTop + SLAB_H, legR, GROUND_Y);
        rectW(p, view, SLAB_L, slabTop, X0, slabTop + SLAB_H);

        // 高度 h：左邊那條括號。上面的數字住在滑桿旁邊（畫面這裡不再掛徽章
        // ——那顆徽章在 1100 px 的尺度下會貼到世界左緣，見檔頭）。
        const bx = 62;
        dashW(p, view, bx, launchY, bx, GROUND_Y, C_MUTE, view.len(1.6, 1));
        strokeW(p, view, C_MUTE, view.len(1.6, 1));
        for (const yy of [launchY, GROUND_Y]) {
            p.line(view.toScreenX(bx - 9), view.toScreenY(yy),
                   view.toScreenX(bx + 9), view.toScreenY(yy));
        }
    }

    /** 整條軌跡（淡虛線）＋ 已經走過的那一段（實線）。 */
    function drawPath(p, view, st) {
        const steps = 90;
        const ctx = p.drawingContext;
        if (ctx.setLineDash) ctx.setLineDash([view.len(8, 4), view.len(8, 4)]);
        p.noFill();
        strokeW(p, view, C_PATH, view.len(2.2, 1.4));
        p.beginShape();
        for (let i = 0; i <= steps; i++) {
            const q = spotAt(st.v0, st.h, st.T * i / steps);
            p.vertex(view.toScreenX(q.x), view.toScreenY(q.y));
        }
        p.endShape();
        if (ctx.setLineDash) ctx.setLineDash([]);

        if (st.now > 1e-6) {
            p.noFill();
            strokeW(p, view, C_PROJ, view.len(3, 1.8));
            p.beginShape();
            const n = Math.max(2, Math.ceil(steps * st.now / st.T));
            for (let i = 0; i <= n; i++) {
                const q = spotAt(st.v0, st.h, st.now * i / n);
                p.vertex(view.toScreenX(q.x), view.toScreenY(q.y));
            }
            p.endShape();
        }
    }

    /** 分量箭頭：一支綠的（水平）、一支紫的（豎直），起點都在 (wx, wy)。 */
    function drawComponents(p, view, a, wx, wy, alpha, w) {
        const lx = a.vx * V_ARROW, ly = a.vy * V_ARROW;
        if (lx > 1) arrowW(p, view, wx, wy, wx + lx, wy, C_VX, w, alpha);
        // 紫箭頭插進地面就不畫（落地那一刻會穿過地面壓到尺的數字）
        if (ly > 1 && vyArrowFits(wy, ly)) {
            arrowW(p, view, wx, wy, wx, wy + ly, C_VY, w, alpha);
        }
    }

    /** 閃光點：等時距的殘影。拋出的那一點也算一顆，不然第一段沒有起點。 */
    function drawDots(p, view, st) {
        ballW(p, view, worldX(0), restOnGround(launchYOf(st.h), DOT_R), DOT_R, C_DOT);
        for (const ts of st.dots) {
            const q = ballSpot(st.v0, st.h, ts, DOT_R);
            ballW(p, view, q.x, q.y, DOT_R, C_DOT);
        }
    }

    /**
     * 等時距輔助線（只在「只看閃光點」模式）：每個閃光點各拉一條水平、
     * 一條鉛直。鉛直的落點對著地上的尺，一眼看得出「每一格都一樣寬」；
     * 水平的那些數的是「每一格掉了多少」，一段比一段大。
     */
    function drawStrobeGrid(p, view, st) {
        for (const ts of st.dots) {
            const q = ballSpot(st.v0, st.h, ts, DOT_R);
            dashW(p, view, q.x, q.y, RULER_X1, q.y, C_MUTE, view.len(1.4, 1), 110);
        }
        for (const ts of st.dots) {
            const q = ballSpot(st.v0, st.h, ts, DOT_R);
            dashW(p, view, q.x, q.y, q.x, GROUND_Y, C_DOT, view.len(1.4, 1), 120);
        }
    }

    /**
     * 「放手讓它掉」的那一顆：**三種模式都畫**。
     *
     * 它是這一頁最直接的證據——那條水平虛線把它和拋體連起來，兩顆永遠同高，
     * 所以同一瞬間落地。只畫在分解模式的話，學生在預設畫面裡根本找不到它，
     * 而說明文字從第一段就在講「旁邊還有一顆球被放手」（文案承諾的東西
     * 畫面上一定要有，README 陷阱三十一）。
     *
     * 它落在 `DROP_X`（桌腳右邊那條淨空的正中央），所以和拋體的路徑
     * 不會有任何交集——球只會往右飛，對照球只在左邊那條鉛直線上。
     *
     * ⚠️ **那一條鉛直的虛線不是裝飾。** 對照球放手之後先穿過那塊 9 個世界
     *    單位厚的桌面（球直徑 16），掉到 `f = 25`（h = 20 時是 t ≈ 0.53 s）
     *    才整顆離開桌面的下緣；而虛線的長度就是「掉了多少」——它要長過球
     *    直徑才不被球蓋住，所以 `f < 16`（t < 0.43 s）之前它整條躲在球後面。
     *    這件事是量出來的：**它救不了最早那幾幀**，而那幾幀的正確讀法本來
     *    就是「球還擱在桌面上」——t = 0 那一幀拍的就是這個，球的下緣正好
     *    貼在桌面上。它救的是剩下的 1.5 秒：有了它，兩顆球之間的**水平**
     *    虛線（位移）和這一條**鉛直**虛線（下落）就在對照球那裡圍成一個
     *    直角，那個直角就是這一頁要教的兩個分量；而且對照球的路徑從此是
     *    一條看得見的直線（拋體那條是彎的）。
     *    上端固定在放手的那一點，所以它量的是「掉了多少」，不會伸到地面下。
     */
    function drawTwin(p, view, st) {
        const q = ballSpot(st.v0, st.h, st.now, BALL_R);
        dashW(p, view, DROP_X, launchYOf(st.h), DROP_X, q.y, C_DROP, view.len(1.6, 1), 170);
        dashW(p, view, DROP_X, q.y, q.x, q.y, C_DROP, view.len(1.6, 1), 170);
        ballW(p, view, DROP_X, q.y, BALL_R, C_DROP);
    }

    /**
     * 「只看分解」模式多畫一顆地面上的一維分身：水平投影（空心藍圈）。
     * 它只沿地面等速前進，和放手讓它掉的那一顆一橫一豎，而真球永遠
     * 落在這兩條線的交點上。
     */
    function drawProjection(p, view, st) {
        const q = ballSpot(st.v0, st.h, st.now, BALL_R);
        const gy = restOnGround(GROUND_Y, BALL_R - 1);
        dashW(p, view, q.x, q.y, q.x, gy, C_PROJ, view.len(1.6, 1), 150);
        strokeW(p, view, C_PROJ, view.len(3, 1.8), 190);
        p.noFill();
        p.ellipse(view.toScreenX(q.x), view.toScreenY(gy),
                  view.len((BALL_R - 1) * 2), view.len((BALL_R - 1) * 2));
    }

    /** 射程括號：從拋出點量到落地點。 */
    function drawRange(p, view, st) {
        const lab = rangeLabel(st.v0, st.h);
        const col = st.landed ? C_INK : C_MUTE;
        dashW(p, view, X0, RANGE_Y, st.landingX, RANGE_Y, col, view.len(1.8, 1.2), 230);
        strokeW(p, view, col, view.len(1.8, 1.2), 230);
        for (const xx of [X0, st.landingX]) {
            p.line(view.toScreenX(xx), view.toScreenY(RANGE_Y - 8),
                   view.toScreenX(xx), view.toScreenY(RANGE_Y + 8));
        }
        badgeW(p, view, lab.x, lab.y, lab.text, { size: lab.size, col: lab.col });
    }

    /** 拋出點那一支綠箭頭：標出「一開始推多快」。它釘在原地不動。 */
    function drawLaunch(p, view, st) {
        const y0 = launchYOf(st.h);
        arrowW(p, view, X0, y0, X0 + st.v0 * V_ARROW, y0, C_VX, view.len(3.4, 2), 255);
        const lab = launchLabel(st.v0, st.h);
        badgeW(p, view, lab.x, lab.y, lab.text, { size: lab.size, col: lab.col });
    }

    /** 球上的兩支分量、合速度、以及兩顆數值徽章。 */
    function drawBallArrows(p, view, st) {
        const L = ballLabels(st.v0, st.h, st.now);
        drawComponents(p, view, L.a, L.q.x, L.q.y, 255, view.len(4, 2.4));
        // 合速度：和分量共用同一個箭頭尺度，所以它必然落在軌跡的切線上
        if (L.vyOK) {
            arrowW(p, view, L.q.x, L.q.y, L.q.x + L.lx, L.q.y + L.ly,
                   C_INK, view.len(2, 1.4), 90);
        }
        badgeW(p, view, L.vx.x, L.vx.y, L.vx.text, { size: L.vx.size, col: L.vx.col });
        if (L.vy) badgeW(p, view, L.vy.x, L.vy.y, L.vy.text, { size: L.vy.size, col: L.vy.col });
    }

    // ======================================================================
    // 組裝
    // ======================================================================

    Sc.run({
        formula: '\\begin{aligned} v_x &= v_0 \\\\ v_y &= g\\,t \\\\ '
               + 'T &= \\sqrt{\\dfrac{2h}{g}} \\end{aligned}',
        formulaFallback: 'vₓ = v₀　v_y = gt　T = √(2h/g)',

        controls: {
            selects: [
                {
                    key: 'view', label: '畫面　', def: 'full', live: true,
                    options: [
                        { v: 'full', t: '完整：軌跡、閃光點、兩顆球、分量' },
                        { v: 'dots', t: '只看閃光點：等時距的間距' },
                        { v: 'decomp', t: '只看分解：兩個方向各自的一維運動' },
                    ],
                },
            ],
            sliders: [
                { key: 'v0', label: '水平初速度 v₀', unit: 'm/s',
                  min: V0_MIN, max: V0_MAX, step: 0.5, def: V0_DEF },
                { key: 'h', label: '拋出高度 h', unit: 'm',
                  min: H_MIN, max: H_MAX, step: 1, def: H_DEF },
                // 閃光間隔只在看得到閃光點的模式裡有意義（分解模式沒有閃光點）
                { key: 'strobe', label: '閃光間隔', unit: 's',
                  min: ST_MIN, max: ST_MAX, step: 0.05, def: ST_DEF,
                  when: pn => pn.view !== 'decomp' },
            ],
        },

        cards: [
            { label: '時間 t',        id: 'cardTime', unit: 's',   highlight: true },
            { label: '水平位移 X',    id: 'cardX',    unit: 'm' },
            { label: '下落高度 Y',    id: 'cardY',    unit: 'm' },
            { label: '水平速度 vₓ',   id: 'cardVx',   unit: 'm/s', highlight: true },
            { label: '豎直速度 v_y',  id: 'cardVy',   unit: 'm/s' },
            { label: '合速度 v',      id: 'cardV',    unit: 'm/s' },
            { label: '落地時間 T',    id: 'cardT',    unit: 's' },
            { label: '水平射程 R',    id: 'cardR',    unit: 'm' },
        ],

        model(t, panel) {
            const v0 = panel.v0, h = panel.h, dt = panel.strobe;
            const a = at(v0, h, t);
            return {
                v0, h, dt,
                T: a.T, R: range(v0, h),
                now: a.t, x: a.x, y: a.y, vx: a.vx, vy: a.vy, v: a.v,
                landed: a.landed,
                launchY: launchYOf(h),
                landingX: landingXOf(v0, h),
                dots: strobeTimes(h, dt).filter(ts => ts <= a.t + 1e-9),
            };
        },

        values(t, panel, sol, st) {
            return {
                cardTime: st.now.toFixed(2),
                cardX: st.x.toFixed(2),
                cardY: st.y.toFixed(2),
                cardVx: st.vx.toFixed(1),
                cardVy: st.vy.toFixed(1),
                cardV: st.v.toFixed(1),
                cardT: st.T.toFixed(2),
                cardR: st.R.toFixed(2),
            };
        },

        titleText(t, panel, st) {
            if (panel.view === 'dots') {
                return `閃光間隔 ${st.dt.toFixed(2)} s　水平每一格都是 `
                     + `${(st.vx * st.dt).toFixed(2)} m（等速）　`
                     + `豎直每一格愈來愈大（自由落體）`;
            }
            if (panel.view === 'decomp') {
                return `水平投影（藍圈）沿地面等速前進　自由落下（灰球）愈掉愈快　`
                     + `真球永遠在兩者的交點上，t = ${st.T.toFixed(2)} s 同時落地`;
            }
            if (st.landed) {
                return `落地 t = ${st.T.toFixed(2)} s，水平射程 ${st.R.toFixed(1)} m　`
                     + `兩顆球同時落地——落地時刻只由 h = ${st.h.toFixed(0)} m 決定`;
            }
            return `水平 vₓ = ${st.vx.toFixed(1)} m/s（從頭到尾不變）　`
                 + `豎直 v_y = ${st.vy.toFixed(1)} m/s（一直變大）　`
                 + `落地 t = ${st.T.toFixed(2)} s　射程 ${st.R.toFixed(1)} m`;
        },

        draw(p, view, t, panel, st) {
            const mode = panel.view;
            drawStage(p, view, st.h);
            drawPath(p, view, st);
            drawTwin(p, view, st);        // 三種模式都有（見 drawTwin 的說明）

            if (mode === 'dots') drawStrobeGrid(p, view, st);
            if (mode !== 'decomp') drawDots(p, view, st);

            // 每個閃光點上掛一組分量箭頭：綠的每一支都一樣長、紫的一支比
            // 一支長。這一組就是「水平等速、豎直加速」最直接的證據。
            if (mode === 'full') {
                for (const ts of st.dots) {
                    const q = spotAt(st.v0, st.h, ts);
                    drawComponents(p, view, at(st.v0, st.h, ts), q.x, q.y,
                                   view.len(120, 60), view.len(2.4, 1.5));
                }
            }

            if (mode === 'decomp') drawProjection(p, view, st);
            drawRange(p, view, st);
            drawLaunch(p, view, st);
            drawBallArrows(p, view, st);

            // 球畫在最上層，才不會被閃光點或輔助線蓋掉
            const ball = ballSpot(st.v0, st.h, st.now, BALL_R);
            ballW(p, view, ball.x, ball.y, BALL_R, C_PROJ);
        },
    });

    // ======================================================================
    // 給 headless 探針與驗證器的出口
    // ----------------------------------------------------------------------
    // README 陷阱十九：這是一份**明列的**清單，所以新增一條斷言之前，
    // 先確認要量的東西真的在這裡。幾何（徽章畫在哪裡）也必須在這裡，
    // 不然驗證器只能自己再算一份——那正是「兩份各自算」的溫床。
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            WORLD, GROUND_Y, X0, SCALE, G, BALL_R, DOT_R, RULER_X1, V_ARROW,
            LAUNCH_LABEL_DY, LAUNCH_LABEL_SIZE, BALL_LABEL_DY, BALL_LABEL_DX,
            BALL_LABEL_SIZE, VY_LABEL_MIN, BALL_LABEL_HALF, RANGE_Y,
            RANGE_LABEL_SIZE, GROUND_CLEAR,
            SLAB_L, SLAB_H, LEG_W, LEG_CX, DROP_X,
            H_MIN, H_MAX, H_DEF, V0_MIN, V0_MAX, V0_DEF, ST_MIN, ST_MAX, ST_DEF,
            C_PROJ, C_VX, C_VY, C_DROP, C_DOT, C_PATH,
            flightTime, range, at, strobeTimes, gaps,
            worldX, worldY, spotAt, restOnGround, ballSpot, launchYOf, landingXOf,
            vyArrowFits, launchLabel, rangeLabel, ballLabels,
        };
    }
})();
