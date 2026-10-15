/**
 * 簡單機械的畫面工具（人教版八年級下冊 第十二章：槓桿／滑輪／滑輪組／
 * 機械效率）。
 *
 * 這個檔案裡**沒有任何物理**，只有畫筆。所有數字都從 `machine-kit.js` 來：
 * 力臂、繩子怎麼繞、段數、F、s、h、功、η 全部是 kit 算好的，這裡的工作
 * 只是把它們畫成看得懂的東西。
 *
 * ⚠️ 這個檔案裡沒有 `new p5(`，所以 `patch-site.py` 掃到它會**跳過**它
 *    （回報「純繪圖模組，沒有 p5 生命週期，跳過」）。這是預期的，不是補丁
 *    失敗——`thermal-scene.js` 也是同一個模式。p5 生命週期唯一的主人是
 *    `lab-scene.js`。
 *
 * ⚠️ `LabScene.badge()` 吃的是**畫布像素**，不是世界座標。這裡一律走
 *    `MachineScene.worldBadge()`（吃世界座標、內部換算）。這一條在磁學那
 *    一組燒過一次：文字愈靠邊偏愈多，最後整個被裁掉，而所有數值斷言照樣
 *    全過、`errs` 是 0。
 */
var MachineScene = (function () {
    'use strict';

    // ==================================================================
    // 調色盤
    // ==================================================================
    // 繩子有兩種顏色，這是這一組的教學重點：**算進 n 的繩段是藍的，
    // 不算的是灰的**。學生不必再從一張靜態圖裡猜哪幾段要數。
    const C_ROPE  = [146, 64, 14];    // 繩子本體（滑輪上的圓弧）
    const C_ON    = [37, 99, 235];    // 承擔重物的繩段（要被數進 n 的那些）
    const C_OFF   = [148, 163, 184];  // 不承擔重物的（例如垂到手上的自由端）
    const C_TIE   = [21, 128, 61];    // 繩子的固定端
    const C_LOAD  = [51, 65, 85];     // 重物
    const C_CEIL  = [100, 116, 139];  // 天花板與支架
    const C_FORCE = [220, 38, 38];    // 力
    const C_ARM   = [21, 128, 61];    // 力臂
    const C_NAIVE = [148, 163, 184];  // 「天真的距離」——只用來對照
    const C_PIVOT = [15, 23, 42];     // 支點
    const C_WHEEL = [71, 85, 105];    // 滑輪、輪軸
    const C_HAND  = [217, 119, 6];    // 手
    const C_BEAM  = [120, 113, 108];  // 桿
    const C_WORK  = [22, 163, 74];    // 有用功
    const C_EXTRA = [220, 38, 38];    // 額外功
    const C_PAPER = [252, 252, 253];

    // ==================================================================
    // 底層工具
    // ==================================================================

    /** 世界長度 → 像素（帶下限，小畫布上才不會縮到看不見） */
    const L = (view, n, min) => view.len(n, min);

    function strokeOn(p, col, w) {
        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(w);
    }

    function fillOn(p, col) {
        p.fill(col[0], col[1], col[2]);
    }

    /**
     * 虛線的開關。p5 沒有 setLineDash，要走 drawingContext。
     * `pat` 是世界單位的 dash 長度，`null` 表示回到實線。
     */
    function dash(p, view, pat) {
        p.drawingContext.setLineDash(pat ? pat.map(v => L(view, v, 2)) : []);
    }

    /**
     * 白底藍框的數值標籤。**吃世界座標**（`LabScene.badge()` 吃畫布像素，
     * 由這裡換算）。
     */
    function worldBadge(p, view, x, y, text, o) {
        LabScene.badge(p, view, view.toScreenX(x), view.toScreenY(y), text, o);
    }

    /** 置中的粗體字，不帶底框。 */
    function label(p, view, x, y, text, col, o) {
        o = o || {};
        p.noStroke();
        fillOn(p, col);
        p.textAlign(o.align || p.CENTER, o.baseline || p.CENTER);
        p.textStyle(p.BOLD);
        p.textSize(L(view, o.size || 15, 8));
        p.text(text, view.toScreenX(x), view.toScreenY(y));
    }

    /** 世界座標的矩形（左上角 + 寬高）。 */
    function rectW(p, view, x, y, w, h) {
        p.rect(view.toScreenX(x), view.toScreenY(y), L(view, w), L(view, h));
    }

    /** 世界座標的圓。 */
    function circleW(p, view, x, y, r) {
        p.ellipse(view.toScreenX(x), view.toScreenY(y), L(view, r * 2), L(view, r * 2));
    }

    /** 世界座標的直線。 */
    function lineW(p, view, x1, y1, x2, y2) {
        p.line(view.toScreenX(x1), view.toScreenY(y1),
               view.toScreenX(x2), view.toScreenY(y2));
    }

    // ==================================================================
    // 天花板與支架
    // ==================================================================

    /**
     * 天花板：一條實心橫樑 + 上方的斜線（建築圖的「固定端」畫法）。
     *
     * ⚠️ **`y` 是橫樑的「下緣」，不是上緣。** 橫樑佔 `[y − th, y]`。
     *    掛在天花板上的東西（繩子的固定端、定滑輪的吊架）接的都是下緣，
     *    所以要對齊的是 `y` 而不是 `y + th`；舊版把 `y` 當上緣，結果繩頭
     *    的綠點浮在橫樑的上邊、吊架整支埋在橫樑裡。
     */
    function drawCeiling(p, view, x1, x2, y, o) {
        o = o || {};
        const th = o.th == null ? 11 : o.th;
        const step = L(view, 20, 9);

        const sx = view.toScreenX(x1), ex = view.toScreenX(x2);
        const sy = view.toScreenY(y);
        const t = L(view, th);
        // 斜線畫在橫樑上方（sy − t 往上），讀起來是「固定在天上」
        strokeOn(p, C_CEIL, L(view, 2, 1));
        for (let x = sx - t; x < ex; x += step) {
            const xa = Math.max(x, sx);
            p.line(xa, sy - t, Math.min(x + t, ex), sy - 2 * t);
        }
        p.noStroke();
        fillOn(p, C_CEIL);
        p.rect(sx, sy - t, ex - sx, t);       // 橫樑：下緣在 sy
    }

    /**
     * 定滑輪的吊架：從天花板收斂到輪子頂點的一個三角形。
     *
     * 頂點恰好落在輪子的最高點 `cy − r`，也就是繩子繞過去的那一點，所以
     * 支架的兩條邊**永遠在繩弧的上方**（`u = |x−cx|/(r/2)` 時支架在
     * `cy−r−4(1−u)`、繩弧在 `cy−√(r²−(ru/2)²)`，前者恆 ≤ 後者）。
     * 畫在繩子之前，重疊也會被蓋掉。
     */
    function drawMount(p, view, cx, ceilY, cy, r, o) {
        o = o || {};
        const yTop = ceilY - (o.th == null ? 10 : o.th);   // 收進橫樑裡一點，接得起來
        p.noStroke();
        fillOn(p, C_CEIL);
        const hw = Math.max(r * 0.5, 14);
        const apex = cy - r - L(view, 2, 1);               // 收到輪子的最高點
        p.beginShape();
        p.vertex(view.toScreenX(cx - hw), view.toScreenY(yTop));
        p.vertex(view.toScreenX(cx + hw), view.toScreenY(yTop));
        p.vertex(view.toScreenX(cx), view.toScreenY(apex));
        p.endShape(p.CLOSE);
    }

    // ==================================================================
    // 滑輪
    // ==================================================================

    /**
     * 一顆滑輪。繩子繞在**半徑 r** 的圓上（切點就在 x ± r，沒有根號），
     * 所以這裡畫的圓就是繩子真正貼著的那一圈。
     */
    function drawPulley(p, view, cx, cy, r, o) {
        o = o || {};
        const col = o.col || C_WHEEL;
        const X = view.toScreenX(cx), Y = view.toScreenY(cy), R = L(view, r);

        p.noStroke();
        p.fill(C_PAPER[0], C_PAPER[1], C_PAPER[2]);
        p.ellipse(X, Y, R * 2, R * 2);
        p.noFill();
        strokeOn(p, col, L(view, o.w || 4, 2));
        p.ellipse(X, Y, R * 2, R * 2);
        // 繩槽
        strokeOn(p, col, L(view, 1.4, 1));
        p.ellipse(X, Y, R * 1.5, R * 1.5);
        // 輪軸
        p.noStroke();
        fillOn(p, col);
        p.ellipse(X, Y, L(view, 9, 3), L(view, 9, 3));
    }

    /**
     * 動滑輪組的軛（yoke）。
     *
     * 只是「動滑輪是被一個框兜住的」這句話的示意：一條下橫樑 + 兩側短短的
     * 立板。刻意**不畫上橫樑**——繩頭（n 為奇數時）綁在那個高度，畫一條橫樑
     * 會和繩子打架。
     *
     * ⚠️ **立板要長到 `frameTop`。** 這不是排版偏好，是這一頁的教學重點：
     *    `rigFor()` 定義 `frameTop = my − r − 14` 是**框的上緣**，而 n 為奇數
     *    時繩子的固定端就綁在 `(frameL, frameTop)`——`verify-machines.js` 有
     *    一條斷言逐字寫著「固定端在動滑輪框的上緣」。立板若只長到輪心附近
     *    （舊版是 `yTop = yb − (r + 8)`，等於 `my + 4`），那顆綠點就會**浮在
     *    半空中**、框上沒有東西可以綁。而畫面只會安靜地少一段立板：
     *    `errs=0`、段數照樣數得對、驗證器也全過（陷阱九）——**驗證器斷言的是
     *    `tie.y` 等於 `frameTop`，畫不畫得出來它管不到。**
     *
     * ⚠️ **立板要整片落在繩段的外側**：立板的厚度是 `th`，所以左立板必須
     *    從 `frameL − th − 6` 起算才不會壓到最左邊那條繩（`frameL`）。
     *    舊版寫 `frameL − 10` 配 `th = 12`，立板右緣跑到 `frameL + 2`，
     *    剛好穿過繩子——而繩子是後畫的，所以畫面看起來只是「繩子壓在框上」，
     *    不會有任何錯誤訊息。頂端的內折也是一樣的理由拿掉的。
     *
     * ⚠️ 立板的右緣是 `frameR + gap + th`。`pulley-systems.js` 的兩條起點
     *    參考線（h 與 s 的虛線）是從框的右邊拉出去的，起點必須在這條線
     *    右邊——立板長高之後就不再是「反正 yTop 在那條線下面」了。
     */
    function drawFrame(p, view, rig, o) {
        o = o || {};
        if (!rig.movable || !rig.movable.length) return;
        const th = 12, gap = 6;
        const yb = rig.my + rig.r + 12;
        const xl = rig.frameL - th - gap, xr = rig.frameR + gap;
        const yTop = rig.frameTop;

        p.noStroke();
        fillOn(p, o.col || C_WHEEL);
        rectW(p, view, xl, yb, (xr + th) - xl, th);   // 下橫樑
        rectW(p, view, xl, yTop, th, yb - yTop);      // 左立板
        rectW(p, view, xr, yTop, th, yb - yTop);      // 右立板
    }

    /** 繩子的固定端：一個綠點 + 標籤。 */
    function drawTie(p, view, x, y, text, o) {
        o = o || {};
        p.noStroke();
        fillOn(p, C_TIE);
        circleW(p, view, x, y, o.r || 8);
        p.noFill();
        strokeOn(p, [255, 255, 255], L(view, 2, 1));
        circleW(p, view, x, y, o.r || 8);
        if (text) {
            worldBadge(p, view, x + (o.dx == null ? 0 : o.dx),
                y + (o.dy == null ? -26 : o.dy), text,
                { col: C_TIE, size: o.size || 14, align: o.align });
        }
    }

    // ==================================================================
    // 繩子
    // ==================================================================

    /**
     * 畫一條繩子。`path` 是 `MachineKit.threadRope()`／`threadSingle()` 的
     * 輸出，`strands` 是 `supportingSegs()` 的輸出。
     *
     * 兩遍畫法：
     *   ① 整條繩子（含繞過滑輪的圓弧）先用繩色畫一次——這是「一條連續的繩子」
     *   ② 被數進 n 的那些**直線段**加粗改成藍色，並標上 ①②③
     *
     * 圓弧永遠是繩色：它繞在滑輪上，不是「承擔重物」的那一段。學生要數的
     * 就是那些垂直的藍線——那是幾何事實，不是示意圖。
     */
    function drawRope(p, view, path, strands, o) {
        o = o || {};
        const onAt = {};
        for (const g of (strands || [])) onAt[g.at] = g;
        const w = L(view, o.w || 7, 3);

        // ① 整條繩子
        p.noFill();
        for (const s of path.segs) {
            if (s.kind === 'line') {
                strokeOn(p, C_ROPE, w);
                lineW(p, view, s.a.x, s.a.y, s.b.x, s.b.y);
            } else {
                strokeOn(p, C_ROPE, w);
                arcW(p, view, s);
            }
        }

        // ② 承擔重物的繩段
        for (let k = 0; k < path.segs.length; k++) {
            const s = path.segs[k];
            if (s.kind !== 'line') continue;
            if (onAt[k]) {
                strokeOn(p, C_ON, w);
                lineW(p, view, s.a.x, s.a.y, s.b.x, s.b.y);
            } else if (s.free) {
                // 自由端：垂到手上、不承擔重物的那一小截
                strokeOn(p, C_OFF, w * 0.8);
                lineW(p, view, s.a.x, s.a.y, s.b.x, s.b.y);
            }
        }

        // ③ 編號。每一段擺在**自己那一段**的中點（再夾進滑輪之間的帶狀區域），
        //    所以編號永遠貼在它所屬的繩段上。不是所有繩段都一樣長——n 為奇數
        //    時自由端那一條比別人短，擺在同一個高度會整顆浮到繩子外面。
        if (o.number !== false && strands && strands.length) {
            const bandTop = path.rig.fy + (o.bandTop == null ? 40 : o.bandTop);
            const bandBot = path.rig.my - (o.bandBot == null ? 20 : o.bandBot);
            for (const g of strands) {
                const mid = (g.seg.upper.y + g.seg.lower.y) / 2;
                const y = Math.max(bandTop, Math.min(bandBot, mid));
                worldBadge(p, view, g.seg.lower.x, y, String(g.no),
                    { col: C_ON, size: o.numberSize || 16 });
            }
        }
    }

    /** 一段圓弧。`half` 或 `a0`/`a1`（畫布弧度：0 = 向右，順時針為正）。 */
    function arcW(p, view, s) {
        const a0 = s.a0 != null ? s.a0 : (s.half === 'bottom' ? 0 : Math.PI);
        const a1 = s.a1 != null ? s.a1 : (s.half === 'bottom' ? Math.PI : Math.PI * 2);
        const X = view.toScreenX(s.c.x), Y = view.toScreenY(s.c.y), R = L(view, s.r);
        // p5 的 arc 預設是 PIE（會填成一塊扇形），一定要指定 OPEN。
        p.arc(X, Y, R * 2, R * 2, a0, a1, p.OPEN);
    }

    /** 自由端上那個「不計」的灰標籤。 */
    function drawFreeHint(p, view, x, y, text, o) {
        o = o || {};
        worldBadge(p, view, x + (o.dx == null ? 0 : o.dx), y + (o.dy == null ? 0 : o.dy),
            text || '不計', { col: C_OFF, size: o.size || 14 });
    }

    // ==================================================================
    // 重物與手
    // ==================================================================

    function drawLoad(p, view, x, y, w, h, o) {
        o = o || {};
        const X = view.toScreenX(x), Y = view.toScreenY(y);
        const W = L(view, w), H = L(view, h);
        const r = L(view, 5, 2);

        p.noStroke();
        fillOn(p, o.col || C_LOAD);
        p.rect(X - W / 2, Y - H / 2, W, H, r);
        // 斜紋：讓它讀起來是「一個有重量的東西」而不是色塊。
        // ⚠️ 斜紋要壓在標籤底下、而且不能搶走標籤的對比——用底色稍微亮一階
        //    就好（[85,105,135]）。用淺灰（[203,213,225]）的話白色標籤字
        //    會和斜紋糊在一起，「400 N」在縮圖上幾乎讀不出來。
        strokeOn(p, o.hatch || [84, 104, 134], L(view, 1.6, 1));
        const step = L(view, 16, 6);
        for (let d = -H; d < W; d += step) {
            const x1 = X - W / 2 + Math.max(0, d);
            const y1 = Y - H / 2 + Math.max(0, -d);
            const x2 = X - W / 2 + Math.min(W, d + H);
            const y2 = Y - H / 2 + Math.min(H, H + d);
            p.line(x1, y1, x2, y2);
        }
        if (o.label) {
            // 文字底下墊一塊底色，斜紋再多也讀得清楚（不墊的話白色字壓在
            // 斜紋上會斷成好幾截）。
            p.noStroke();
            fillOn(p, o.col || C_LOAD);
            const tw = L(view, 3.9 * o.label.length + 14, 0);
            const thh = L(view, 22, 8);
            p.rect(X - tw / 2, Y - thh / 2, tw, thh, L(view, 4, 2));
            label(p, view, x, y, o.label, [248, 250, 252], { size: o.size || 17 });
        }
    }

    /** 從框底／輪軸垂下來掛住重物的鉤子。 */
    function drawHook(p, view, x, yFrom, yTo, o) {
        o = o || {};
        strokeOn(p, o.col || C_LOAD, L(view, 4, 2));
        p.noFill();
        lineW(p, view, x, yFrom, x, yTo);
    }

    /**
     * 手。一個拳頭 + 三道指節。
     *
     * ⚠️ **偶數段的手在下面、奇數段的手在上面**——這不是排版選擇，是繩子
     * 繞法的直接後果（見 `MachineKit.rigFor`）。所以這支不吃方向，畫出來的
     * 拳頭在哪裡由上層決定；拳頭本身不分上下。
     */
    function drawHand(p, view, x, y, o) {
        o = o || {};
        const size = L(view, o.size || 36, 14);
        const X = view.toScreenX(x), Y = view.toScreenY(y);

        p.noStroke();
        fillOn(p, C_HAND);
        p.rect(X - size / 2, Y - size * 0.42, size, size * 0.84, size * 0.34);
        strokeOn(p, [180, 83, 9], L(view, 1.6, 1));
        for (let k = 1; k <= 3; k++) {
            const yy = Y - size * 0.42 + k * size * 0.21;
            p.line(X - size * 0.44, yy, X + size * 0.44, yy);
        }
        if (o.label) {
            worldBadge(p, view, x, y + (o.dy == null ? 40 : o.dy), o.label,
                { col: C_HAND, size: o.size2 || 14 });
        }
    }

    // ==================================================================
    // 力與量測
    // ==================================================================

    /**
     * 力箭頭。`angle` 和 `MachineKit.armOf()` 同一套約定：
     * **從豎直向下算起**，0 = 正下方，正的角度往 +x 偏。
     * 長度是世界單位，同一個比例尺畫出來的箭頭才可以直接比長短。
     */
    function drawForceArrow(p, view, x, y, len, angle, text, col, o) {
        o = o || {};
        col = col || C_FORCE;
        const dx = Math.sin(angle), dy = Math.cos(angle);
        const sx = view.toScreenX(x), sy = view.toScreenY(y);
        const tx = view.toScreenX(x + dx * len), ty = view.toScreenY(y + dy * len);
        const head = L(view, o.head || 17, 7);
        const ang = Math.atan2(ty - sy, tx - sx);
        const body = Math.max(0, Math.hypot(tx - sx, ty - sy) - head * 0.88);

        strokeOn(p, col, L(view, o.w || 4, 2));
        p.line(sx, sy, sx + Math.cos(ang) * body, sy + Math.sin(ang) * body);
        p.push();
        p.noStroke();
        fillOn(p, col);
        p.translate(sx + Math.cos(ang) * body, sy + Math.sin(ang) * body);
        p.rotate(ang);
        p.triangle(0, -head * 0.44, 0, head * 0.44, head, 0);
        p.pop();

        if (text) {
            worldBadge(p, view, x + dx * (len + (o.tip || 26)),
                y + dy * (len + (o.tip || 26)), text,
                { col, size: o.size || 15 });
        }
    }

    /**
     * **力臂**：從支點到力作用線的垂直距離。這一支就是這一頁的教學重點。
     *
     * 畫三樣東西：
     *   · 力作用線本身（細灰虛線，往兩端延伸——「距離是量到這條線」）
     *   · 支點到垂足（綠色粗虛線，這是力臂）
     *   · 垂足上的直角記號（證明它是垂直的，不是隨手畫的）
     *
     * 垂足與長度都來自 `MachineKit.armFoot()`／`armOf()`，所以畫出來的線長
     * 和標在旁邊的數字必然一致。
     */
    function drawArm(p, view, pivot, point, angle, text, o) {
        o = o || {};
        const foot = MachineKit.armFoot(pivot, point, angle);
        const dx = Math.sin(angle), dy = Math.cos(angle);
        const ext = o.ext == null ? 90 : o.ext;
        const col = o.col || C_ARM;

        // 力作用線
        dash(p, view, [7, 6]);
        strokeOn(p, C_NAIVE, L(view, 1.6, 1));
        lineW(p, view, point.x - dx * ext, point.y - dy * ext,
            point.x + dx * ext, point.y + dy * ext);
        dash(p, view, null);

        // 力臂：支點 → 垂足
        dash(p, view, [8, 5]);
        strokeOn(p, col, L(view, 3, 1.5));
        lineW(p, view, pivot.x, pivot.y, foot.x, foot.y);
        dash(p, view, null);

        // 直角記號
        const ax = foot.x - pivot.x, ay = foot.y - pivot.y;
        const alen = Math.hypot(ax, ay);
        if (alen > 1e-6) {
            const ux = ax / alen, uy = ay / alen;
            const t = o.mark == null ? 15 : o.mark;
            strokeOn(p, col, L(view, 2, 1));
            p.noFill();
            lineW(p, view, foot.x + ux * t, foot.y + uy * t,
                foot.x + ux * t + dx * t, foot.y + uy * t + dy * t);
            lineW(p, view, foot.x + dx * t, foot.y + dy * t,
                foot.x + ux * t + dx * t, foot.y + uy * t + dy * t);
        }

        if (text) {
            worldBadge(p, view, (pivot.x + foot.x) / 2 + (o.ox || 0),
                (pivot.y + foot.y) / 2 + (o.oy || 0), text,
                { col, size: o.size || 15 });
        }
        return foot;
    }

    /** 支點：頂點朝上的三角形 + 底下的斜線。 */
    function drawFulcrum(p, view, x, y, o) {
        o = o || {};
        const s = o.size || 26;
        const X = view.toScreenX(x), Y = view.toScreenY(y);
        const S = L(view, s), h = S * 0.92;

        p.noStroke();
        fillOn(p, C_PIVOT);
        p.triangle(X, Y, X - S * 0.62, Y + h, X + S * 0.62, Y + h);
        strokeOn(p, C_PIVOT, L(view, 2, 1));
        const step = L(view, 9, 3);
        for (let d = -S * 0.66; d < S * 0.66; d += step) {
            p.line(X + d, Y + h, X + d + L(view, 8, 3), Y + h + L(view, 8, 3));
        }
    }

    /** 桿（槓桿、秤桿）。世界座標的兩端點。 */
    function drawBeam(p, view, x1, x2, y, o) {
        o = o || {};
        const th = o.th || 13;
        p.noStroke();
        fillOn(p, o.col || C_BEAM);
        rectW(p, view, x1, y - th / 2, x2 - x1, th);
        strokeOn(p, [87, 83, 78], L(view, 1.4, 1));
        p.noFill();
        rectW(p, view, x1, y - th / 2, x2 - x1, th);
    }

    /** 掛在桿上的重物：鉤子 + 方塊 + 標籤。 */
    function drawWeight(p, view, x, beamY, w, h, text, o) {
        o = o || {};
        drawHook(p, view, x, beamY, beamY + 20);
        drawLoad(p, view, x, beamY + 20 + h / 2, w, h, { label: text, col: o.col });
    }

    /** 秤桿上的刻度。等距——這正是這一頁要展示的事。 */
    function drawScaleTicks(p, view, beamY, ticks, o) {
        o = o || {};
        for (const t of ticks) {
            const len = t.major ? 20 : 12;
            strokeOn(p, C_PIVOT, L(view, t.major ? 2.4 : 1.4, 1));
            lineW(p, view, t.x, beamY - 6, t.x, beamY - 6 - len);
            if (t.major && t.label != null) {
                label(p, view, t.x, beamY - 34, String(t.label), C_PIVOT, { size: 13 });
            }
        }
        if (o.unit) {
            label(p, view, ticks[ticks.length - 1].x + 30, beamY - 34, o.unit,
                C_PIVOT, { size: 13 });
        }
    }

    /**
     * 垂直尺標：兩端有箭頭的量測線，標籤擺在中間。
     *
     * 滑輪組那一頁會**同時**畫 s 與 h 兩條。兩條並排跑，s = n·h 就當場看得出來。
     */
    function drawRuler(p, view, x, y1, y2, text, col, o) {
        o = o || {};
        col = col || C_PIVOT;
        const X = view.toScreenX(x);
        const a = view.toScreenY(Math.min(y1, y2)), b = view.toScreenY(Math.max(y1, y2));
        const head = L(view, 11, 4);

        strokeOn(p, col, L(view, 2.4, 1));
        // 上下端的小橫線（「量到這裡為止」）
        p.line(X - L(view, 12, 4), a, X + L(view, 12, 4), a);
        p.line(X - L(view, 12, 4), b, X + L(view, 12, 4), b);
        if (b - a > head * 2.5) {
            p.line(X, a, X, b);
            p.push();
            p.noStroke();
            fillOn(p, col);
            p.triangle(X - head * 0.5, a + head, X + head * 0.5, a + head, X, a);
            p.triangle(X - head * 0.5, b - head, X + head * 0.5, b - head, X, b);
            p.pop();
        }
        if (text) {
            worldBadge(p, view, x + (o.dx == null ? 0 : o.dx),
                (y1 + y2) / 2 + (o.dy || 0), text,
                { col, size: o.size || 15, align: o.align });
        }
    }

    // ==================================================================
    // 功的堆疊長條（機械效率）
    // ==================================================================

    /**
     * 把功畫成長條。`parts` 是 `[{v, col, label}]`，由下往上疊。
     *
     * **長度就是功**：兩條長條並排時，總高度一樣、切法不一樣，
     * 「省力不省功」就從一句話變成看得見的長度。
     */
    function drawStackBar(p, view, x, yBase, w, parts, unit, o) {
        o = o || {};
        const scale = o.scale || 1;
        let y = yBase;
        const X = view.toScreenX(x), W = L(view, w);

        for (const part of parts) {
            if (part.v <= 0) continue;
            const H = L(view, part.v * scale);
            p.noStroke();
            fillOn(p, part.col);
            p.rect(X, view.toScreenY(y) - H, W, H);
            strokeOn(p, [255, 255, 255], L(view, 1.6, 1));
            p.noFill();
            p.rect(X, view.toScreenY(y) - H, W, H);
            if (part.label && H > L(view, 16, 8)) {
                label(p, view, x + w / 2, y - part.v * scale / 2, part.label,
                    [255, 255, 255], { size: 14 });
            }
            if (part.side) {
                label(p, view, x + w + 8, y - part.v * scale / 2, part.side,
                    part.col, { size: 14, align: p.LEFT });
            }
            y -= part.v * scale;
        }
        // 基準線
        strokeOn(p, C_PIVOT, L(view, 2, 1));
        lineW(p, view, x - 14, yBase, x + w + 14, yBase);
        if (unit) {
            label(p, view, x + w / 2, yBase + 22, unit, C_PIVOT, { size: 14 });
        }
        return y;
    }

    // ==================================================================
    // 版面小工具（頁面會用到的幾個位置查詢）
    // ==================================================================

    /** 重物掛在哪一個 x：動滑輪的平均位置（不是框的中心）。 */
    function loadX(rig) {
        if (!rig.movable || !rig.movable.length) {
            return rig.loadEnd ? rig.loadEnd.x : (rig.frameL + rig.frameR) / 2;
        }
        let s = 0;
        for (const q of rig.movable) s += q.x;
        return s / rig.movable.length;
    }

    return {
        // 調色盤
        C_ROPE, C_ON, C_OFF, C_TIE, C_LOAD, C_CEIL, C_FORCE, C_ARM, C_NAIVE,
        C_PIVOT, C_WHEEL, C_HAND, C_BEAM, C_WORK, C_EXTRA,
        // 底層
        L, strokeOn, fillOn, dash, worldBadge, label, rectW, circleW, lineW,
        // 天花板與滑輪
        drawCeiling, drawMount, drawPulley, drawFrame, drawTie,
        // 繩子
        drawRope, drawFreeHint, arcW,
        // 重物與手
        drawLoad, drawHook, drawHand,
        // 力與量測
        drawForceArrow, drawArm, drawFulcrum, drawBeam, drawWeight,
        drawScaleTicks, drawRuler,
        // 功
        drawStackBar,
        // 版面
        loadX,
    };
})();
