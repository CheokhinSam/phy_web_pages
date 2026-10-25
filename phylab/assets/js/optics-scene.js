/**
 * 🔭 OpticsScene — 光學的畫面工具（鏡面、光線、角度弧、眼睛、尺標）
 *
 * 搭配 optics-kit.js（純物理、沒有 DOM）使用，光學十七頁共用。這一支只負責
 * 把頁面算出來的世界座標畫成光學圖：平面鏡與球面鏡弧、鏡背的斜線、法線、
 * 光線、角度弧、物與像的箭頭、眼睛、距離尺標。
 *
 * 版面骨架（控制面板、數據卡片、底部標題列、p5 生命週期）不在這裡，它在
 * `lab-scene.js`。這一支和 `magnetic-scene.js` 是同一個位置：只有題材的
 * 繪圖，沒有生命週期。
 *
 * ==========================================================================
 * ⚠️ 為什麼這一支沒有 p5 生命週期（而且必須繼續沒有）
 * ==========================================================================
 * `patch-site.py` 會 glob `_site/phylab/assets/js/*-scene.js`，凡是原始碼裡
 * 出現「建立 p5 實例」那一行的模組就要交出三個錨點字串。純繪圖模組沒有
 * 那個生命週期，所以會被跳過——判定方式是純文字比對，**連註解提到那個
 * 字串都會誤判**。要講這件事就用中文講，不要把那行程式抄進來。
 *
 * ==========================================================================
 * ⚠️ 標籤吃世界座標
 * ==========================================================================
 * `LabScene.badge()` 的第二、三個參數是**畫布像素**。光學頁面手上全部是
 * 世界座標，所以一律走 `worldBadge()`。直接呼叫 `badge()` 的症狀是「畫面
 * 中央只差幾十像素，靠邊時整顆標籤被裁掉」，而且不會有任何錯誤。
 */
var OpticsScene = (function () {
    'use strict';

    const {
        WORLD_W, WORLD_H, TITLE_TOP,
        strokeOn, L, fmt, badge,
    } = LabScene;

    // 場景的可畫區域：下緣在底部黑條上緣，不是 WORLD_H。
    const SCENE = { x0: 8, y0: 8, x1: WORLD_W - 8, y1: TITLE_TOP - 6 };

    // ======================================================================
    // 配色（沿用 style guide 的色盤）
    // ======================================================================
    const C_RAY = [245, 158, 11];        // 光線：琥珀色
    const C_RAY_SOFT = [251, 191, 36];   // 虛線／反向延長線
    const C_NORMAL = [100, 116, 139];    // 法線：灰
    const C_MIRROR = [30, 41, 59];       // 鏡面：近黑
    const C_HATCH = [148, 163, 184];     // 鏡背斜線
    const C_OBJ = [37, 99, 235];         // 物：藍
    const C_IMG = [139, 92, 246];        // 像：紫
    const C_EYE = [22, 163, 74];         // 眼：綠
    const C_ANGLE1 = [37, 99, 235];      // 入射角弧：藍
    const C_ANGLE2 = [22, 163, 74];      // 反射角弧：綠
    const C_DIM = [148, 163, 184];       // 尺標
    const C_LABEL = [30, 64, 175];       // 一般數值標籤

    // ======================================================================
    // 基本圖元
    // ======================================================================

    /** 白底標籤，**吃世界座標**（見檔頭）。 */
    function worldBadge(p, view, x, y, text, o) {
        badge(p, view, view.toScreenX(x), view.toScreenY(y), text, o);
    }

    /**
     * 圖例列距（世界單位）。
     *
     * 徽章的字級有像素下限（`badge` 的 `L(view, size, 9)`），所以畫面縮到
     * 1100px 時，30 個世界單位的列距只剩 ~18px，而徽章本身仍有 ~15px 高
     * ——四列圖例會黏成一整塊。列距改成「至少 20 個螢幕像素」的世界長度，
     * 寬畫面時仍然是原本的 30，窄畫面時自動拉開。
     */
    function legendRowGap(view, base, minPx) {
        const floor = minPx == null ? 20 : minPx;
        return Math.max(base, floor / view.scale);
    }

    /**
     * 箭頭（螢幕座標）：**（x, y）就是箭尖**，dx, dy 只需要方向。
     *
     * 箭頭整個三角形都在箭尖後面，所以「線的終點」＝「箭尖」，
     * 長度才不會被箭頭偷偷加長。畫線的那一端要把箭桿縮到三角形底邊，
     * 否則箭桿會從三角形尖端穿出去（見 line() 與 arrowShaftEnd()）。
     */
    const ARROW_LEN = 1.4;      // 三角形全長 = size × ARROW_LEN
    const ARROW_HALF = 0.6;     // 三角形半寬 = size × ARROW_HALF

    function arrowHead(p, view, x, y, dx, dy, size, col) {
        const m = Math.hypot(dx, dy) || 1;
        const ux = dx / m, uy = dy / m;
        const px = -uy, py = ux;
        const s = L(view, size);
        const bx = x - ux * s * ARROW_LEN;
        const by = y - uy * s * ARROW_LEN;
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.triangle(x, y,
                   bx + px * s * ARROW_HALF, by + py * s * ARROW_HALF,
                   bx - px * s * ARROW_HALF, by - py * s * ARROW_HALF);
    }

    /**
     * 箭桿應該停在哪裡（螢幕座標）：箭尖往後退到三角形底邊再縮一點點，
     * 讓線和填色三角形有一點重疊，不會出現髮絲般的縫。
     */
    function arrowShaftEnd(view, tipX, tipY, ux, uy, size) {
        const back = L(view, size) * ARROW_LEN * 0.94;
        return { x: tipX - ux * back, y: tipY - uy * back };
    }

    /**
     * 一條線（世界座標）。
     * @param {object} o
     *   o.w       線寬（世界單位）
     *   o.dash    [實線, 間隙]；有值就畫虛線
     *   o.arrowAt 0～1，沿線放一個箭頭（入射／反射光線用）
     *   o.arrowEnd true：箭頭放在終點（向量用）
     */
    function line(p, view, a, b, col, o) {
        o = o || {};
        const ctx = p.drawingContext;
        const x1 = view.toScreenX(a.x), y1 = view.toScreenY(a.y);
        const x2 = view.toScreenX(b.x), y2 = view.toScreenY(b.y);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ux = len > 0 ? (x2 - x1) / len : 1;
        const uy = len > 0 ? (y2 - y1) / len : 0;

        // 有箭頭的那一端：箭尖釘在終點，箭桿只畫到三角形底邊。
        // 不縮的話箭桿會從三角形尖端穿出去，看起來像箭頭「超出」線段。
        let shaftX2 = x2, shaftY2 = y2, drawShaft = true;
        if (o.arrowEnd) {
            const end = arrowShaftEnd(view, x2, y2, ux, uy, o.head || 11);
            const back = Math.hypot(x2 - end.x, y2 - end.y);
            if (len <= back * 1.02) drawShaft = false;
            shaftX2 = end.x;
            shaftY2 = end.y;
        }

        p.push();
        strokeOn(p, col, L(view, o.w || 2.5, 1.5));
        if (o.dash && ctx.setLineDash) {
            ctx.setLineDash([L(view, o.dash[0] || 9, 4), L(view, o.dash[1] || 7, 3)]);
        }
        if (drawShaft) p.line(x1, y1, shaftX2, shaftY2);
        if (ctx.setLineDash) ctx.setLineDash([]);

        const dx = b.x - a.x, dy = b.y - a.y;
        if (o.arrowAt != null) {
            const f = o.arrowAt;
            arrowHead(p, view,
                      view.toScreenX(a.x + dx * f), view.toScreenY(a.y + dy * f),
                      dx, dy, o.head || 11, col);
        }
        if (o.arrowEnd) {
            arrowHead(p, view, x2, y2, dx, dy, o.head || 11, col);
        }
        p.pop();
    }

    function dashed(p, view, a, b, col, o) {
        line(p, view, a, b, col, Object.assign({ dash: [9, 7], w: 1.5 }, o || {}));
    }

    // ======================================================================
    // 鏡面
    // ======================================================================

    /** 水平鏡面：鏡面在 y，背面（斜線）在下方。 */
    function drawMirrorH(p, view, x1, x2, y, o) {
        o = o || {};
        const gap = o.gap || 24, depth = o.depth || 22, slant = o.slant || -14;
        p.push();
        strokeOn(p, o.hatchCol || C_HATCH, L(view, 1.4, 1));
        for (let x = x1 + 8; x < x2; x += gap) {
            p.line(view.toScreenX(x), view.toScreenY(y),
                   view.toScreenX(x + slant), view.toScreenY(y + depth));
        }
        strokeOn(p, o.col || C_MIRROR, L(view, o.w || 5, 3));
        p.line(view.toScreenX(x1), view.toScreenY(y),
               view.toScreenX(x2), view.toScreenY(y));
        // 反射面那一側的細亮線，讓「哪一面是鏡面」一眼看得出來
        strokeOn(p, [226, 232, 240], L(view, 1.2, 1));
        p.line(view.toScreenX(x1), view.toScreenY(y - 3),
               view.toScreenX(x2), view.toScreenY(y - 3));
        p.pop();
    }

    /** 垂直鏡面：鏡面在 x，背面（斜線）在右方。 */
    function drawMirrorV(p, view, x, y1, y2, o) {
        o = o || {};
        const gap = o.gap || 22, depth = o.depth || 16, slant = o.slant || 16;
        p.push();
        strokeOn(p, o.hatchCol || C_HATCH, L(view, 1.4, 1));
        for (let y = y1 + 8; y < y2; y += gap) {
            p.line(view.toScreenX(x), view.toScreenY(y),
                   view.toScreenX(x + slant), view.toScreenY(y - depth));
        }
        strokeOn(p, o.col || C_MIRROR, L(view, o.w || 5, 3));
        p.line(view.toScreenX(x), view.toScreenY(y1),
               view.toScreenX(x), view.toScreenY(y2));
        strokeOn(p, [226, 232, 240], L(view, 1.2, 1));
        p.line(view.toScreenX(x - 3), view.toScreenY(y1),
               view.toScreenX(x - 3), view.toScreenY(y2));
        p.pop();
    }

    /**
     * 水平介面：上下兩層介質的淡色底，以及那一條介面線。
     * 兩層的顏色只是「這裡是另一種介質」的提示，不代表特定的折射率——
     * 哪一層是介質 1、哪一層是介質 2 由頁面依光的方向決定。
     */
    function drawInterfaceH(p, view, x1, x2, y, o) {
        o = o || {};
        const topCol = o.topCol || [219, 234, 254];
        const botCol = o.botCol || [254, 243, 199];
        const topAlpha = o.topAlpha == null ? 46 : o.topAlpha;
        const botAlpha = o.botAlpha == null ? 46 : o.botAlpha;
        const S = SCENE;

        p.push();
        p.noStroke();
        p.fill(topCol[0], topCol[1], topCol[2], topAlpha);
        p.rect(view.toScreenX(S.x0), view.toScreenY(S.y0),
               view.toScreenX(S.x1) - view.toScreenX(S.x0),
               view.toScreenY(y) - view.toScreenY(S.y0));
        p.fill(botCol[0], botCol[1], botCol[2], botAlpha);
        p.rect(view.toScreenX(S.x0), view.toScreenY(y),
               view.toScreenX(S.x1) - view.toScreenX(S.x0),
               view.toScreenY(S.y1) - view.toScreenY(y));
        p.pop();

        p.push();
        strokeOn(p, o.col || C_MIRROR, L(view, o.w || 3, 2));
        p.line(view.toScreenX(x1), view.toScreenY(y),
               view.toScreenX(x2), view.toScreenY(y));
        p.pop();
    }

    /**
     * 球面鏡的弧面：鏡頂在 (mirrorX, axisY)，半高 half，曲率半徑 radius。
     * 凹面鏡的弧在鏡頂左邊、凸面鏡在右邊；背面（斜線）一律在右邊。
     *
     * 弧的 x 由 `OpticsKit.sphericalArcX()` 算出來——和光線幾何共用同一支
     * 純函式，不在這裡另外寫一份圓的參數式。
     */
    function drawMirrorArc(p, view, mirrorX, axisY, radius, half, type, o) {
        o = o || {};
        const gapDepth = o.depth || 17;
        const h = Math.min(half, radius * 0.98);
        const n = 48;
        const yAt = i => axisY - h + (2 * h) * i / n;
        const xAt = y => OpticsKit.sphericalArcX(type, mirrorX, axisY, radius, y);

        // 背面的斜線
        p.push();
        strokeOn(p, o.hatchCol || C_HATCH, L(view, 1.4, 1));
        for (let i = 2; i < n; i += 4) {
            const y = yAt(i), x = xAt(y);
            p.line(view.toScreenX(x), view.toScreenY(y),
                   view.toScreenX(x + gapDepth), view.toScreenY(y - gapDepth * 0.7));
        }
        p.pop();

        // 鏡面本體
        p.push();
        p.noFill();
        strokeOn(p, o.col || C_MIRROR, L(view, o.w || 5, 3));
        p.beginShape();
        for (let i = 0; i <= n; i++) {
            p.vertex(view.toScreenX(xAt(yAt(i))), view.toScreenY(yAt(i)));
        }
        p.endShape();
        p.pop();

        // 反射面那一側的細亮線
        p.push();
        p.noFill();
        strokeOn(p, [226, 232, 240], L(view, 1.2, 1));
        p.beginShape();
        for (let i = 0; i <= n; i++) {
            const y = yAt(i);
            p.vertex(view.toScreenX(xAt(y) - 3), view.toScreenY(y));
        }
        p.endShape();
        p.pop();
    }

    /**
     * 薄透鏡（垂直擺放，主軸水平）。
     * 凸透鏡：中央厚、兩端尖；凹透鏡：中央薄、上下有厚度。
     * 只用世界座標計算，和光線幾何共用同一個 lensX 與 axisY。
     */
    function drawThinLens(p, view, x, axisY, halfH, type, o) {
        o = o || {};
        const halfW = o.halfW == null ? 17 : o.halfW;
        const col = o.col || C_MIRROR;
        const fillCol = o.fill || [219, 234, 254];
        const gx = v => view.toScreenX(v), gy = v => view.toScreenY(v);

        p.push();
        p.noStroke();
        p.fill(fillCol[0], fillCol[1], fillCol[2], o.alpha == null ? 150 : o.alpha);
        p.beginShape();
        if (type === 'concave') {
            p.vertex(gx(x - halfW), gy(axisY - halfH));
            p.vertex(gx(x + halfW), gy(axisY - halfH));
            p.bezierVertex(gx(x + halfW * 0.35), gy(axisY - halfH * 0.45),
                           gx(x + halfW * 0.35), gy(axisY + halfH * 0.45),
                           gx(x + halfW), gy(axisY + halfH));
            p.vertex(gx(x - halfW), gy(axisY + halfH));
            p.bezierVertex(gx(x - halfW * 0.35), gy(axisY + halfH * 0.45),
                           gx(x - halfW * 0.35), gy(axisY - halfH * 0.45),
                           gx(x - halfW), gy(axisY - halfH));
        } else {
            p.vertex(gx(x), gy(axisY - halfH));
            p.bezierVertex(gx(x - halfW * 1.5), gy(axisY - halfH * 0.45),
                           gx(x - halfW * 1.5), gy(axisY + halfH * 0.45),
                           gx(x), gy(axisY + halfH));
            p.bezierVertex(gx(x + halfW * 1.5), gy(axisY + halfH * 0.45),
                           gx(x + halfW * 1.5), gy(axisY - halfH * 0.45),
                           gx(x), gy(axisY - halfH));
        }
        p.endShape(p.CLOSE);
        p.pop();

        p.push();
        p.noFill();
        strokeOn(p, col, L(view, o.w || 3, 2));
        p.beginShape();
        if (type === 'concave') {
            p.vertex(gx(x - halfW), gy(axisY - halfH));
            p.vertex(gx(x + halfW), gy(axisY - halfH));
            p.bezierVertex(gx(x + halfW * 0.35), gy(axisY - halfH * 0.45),
                           gx(x + halfW * 0.35), gy(axisY + halfH * 0.45),
                           gx(x + halfW), gy(axisY + halfH));
            p.vertex(gx(x - halfW), gy(axisY + halfH));
            p.bezierVertex(gx(x - halfW * 0.35), gy(axisY + halfH * 0.45),
                           gx(x - halfW * 0.35), gy(axisY - halfH * 0.45),
                           gx(x - halfW), gy(axisY - halfH));
        } else {
            p.vertex(gx(x), gy(axisY - halfH));
            p.bezierVertex(gx(x - halfW * 1.5), gy(axisY - halfH * 0.45),
                           gx(x - halfW * 1.5), gy(axisY + halfH * 0.45),
                           gx(x), gy(axisY + halfH));
            p.bezierVertex(gx(x + halfW * 1.5), gy(axisY + halfH * 0.45),
                           gx(x + halfW * 1.5), gy(axisY - halfH * 0.45),
                           gx(x), gy(axisY - halfH));
        }
        p.endShape();
        p.pop();
    }

    // ======================================================================
    // 法線與角度弧
    // ======================================================================

    function drawNormal(p, view, a, b, o) {
        dashed(p, view, a, b, (o && o.col) || C_NORMAL, { w: (o && o.w) || 1.6 });
    }

    /**
     * 角度弧。a0、a1 是 p5 的角度（弧度，0 在 +x，因為 y 向下而順時針增加）。
     * 標籤放在角平分線上、半徑 r + 28 的位置。
     */
    function drawAngleArc(p, view, O, a0, a1, r, col, label, o) {
        o = o || {};
        const cx = view.toScreenX(O.x), cy = view.toScreenY(O.y);
        const R = L(view, r);
        p.push();
        p.noFill();
        strokeOn(p, col, L(view, o.w || 2.2, 1.5));
        p.arc(cx, cy, R * 2, R * 2, a0, a1);
        p.pop();

        if (label) {
            const mid = (a0 + a1) / 2;
            worldBadge(p, view,
                       O.x + (r + 28) * Math.cos(mid),
                       O.y + (r + 28) * Math.sin(mid),
                       label, { size: 14, col });
        }
    }

    /** 直角記號：在 (x, y) 畫一個轉向 (sx, sy) 的小方塊。 */
    function drawRightAngle(p, view, x, y, sx, sy, size, col) {
        const c = col || C_DIM;
        const s = size || 13;
        const a = { x: x + sx * s, y: y };
        const b = { x: x + sx * s, y: y + sy * s };
        const d = { x: x, y: y + sy * s };
        line(p, view, { x, y }, a, c, { w: 1.3 });
        line(p, view, a, b, c, { w: 1.3 });
        line(p, view, b, d, c, { w: 1.3 });
    }

    // ======================================================================
    // 物、像、眼睛
    // ======================================================================

    /** 垂直箭頭：從 base 到 top；虛線或實線由 o.dash 決定。 */
    function drawVerticalArrow(p, view, base, top, col, o) {
        line(p, view, base, top, col, Object.assign(
            { w: 4, arrowEnd: true, head: 12 }, o || {}));
        p.push();
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.ellipse(view.toScreenX(base.x), view.toScreenY(base.y),
                  L(view, 9, 4), L(view, 9, 4));
        p.pop();
    }

    /** 眼睛：一個杏仁形＋瞳孔，讓「光線最後去哪裡」看得見。 */
    function drawEye(p, view, x, y, o) {
        o = o || {};
        const cx = view.toScreenX(x), cy = view.toScreenY(y);
        const w = L(view, o.w || 76), h = L(view, o.h || 44);
        p.push();
        p.noFill();
        strokeOn(p, C_EYE, L(view, 2.2, 1.5));
        p.beginShape();
        p.vertex(cx - w / 2, cy);
        p.quadraticVertex(cx, cy - h, cx + w / 2, cy);
        p.quadraticVertex(cx, cy + h, cx - w / 2, cy);
        p.endShape(p.CLOSE);

        p.noStroke();
        p.fill(255);
        p.ellipse(cx, cy, L(view, 30, 12), L(view, 30, 12));
        p.fill(C_EYE[0], C_EYE[1], C_EYE[2]);
        p.ellipse(cx, cy, L(view, 16, 8), L(view, 16, 8));
        p.fill(15, 23, 42);
        p.ellipse(cx, cy, L(view, 7, 4), L(view, 7, 4));
        p.pop();

        if (o.label !== false) {
            worldBadge(p, view, x, y - (o.labelDy || 48), o.label || '眼',
                       { size: 13, col: C_EYE });
        }
    }

    // ======================================================================
    // 尺標
    // ======================================================================

    /**
     * 水平距離尺標：從 x1 到 x2，畫在 y。延伸虛線從 extY 拉下來。
     * 兩端都有箭頭（向外），標籤置中放在尺的上方。
     */
    function drawDimensionH(p, view, x1, x2, y, label, col, o) {
        o = o || {};
        const c = col || C_DIM;
        const dir = Math.sign(x2 - x1) || 1;

        // 延伸線（從物的底部拉到尺標）
        if (o.extY != null) {
            dashed(p, view, { x: x1, y: o.extY }, { x: x1, y: y + 8 }, c, { w: 1.1 });
            dashed(p, view, { x: x2, y: o.extY }, { x: x2, y: y + 8 }, c, { w: 1.1 });
        }

        // 尺標本體：兩端各留一個箭頭的長度，箭尖才是 x1／x2。
        const sx1 = view.toScreenX(x1), sx2 = view.toScreenX(x2);
        const sy = view.toScreenY(y);
        const back = L(view, 10) * ARROW_LEN * 0.94;
        p.push();
        strokeOn(p, c, L(view, 1.8, 1));
        if (Math.abs(sx2 - sx1) > back * 2.04) {
            const sgn = Math.sign(sx2 - sx1) || 1;
            p.line(sx1 + sgn * back, sy, sx2 - sgn * back, sy);
        }
        p.pop();
        // 向外箭頭，尖端就是兩端的量測點
        arrowHead(p, view, sx1, sy, -dir, 0, 10, c);
        arrowHead(p, view, sx2, sy, dir, 0, 10, c);
        // 端點小刻度
        line(p, view, { x: x1, y: y - 7 }, { x: x1, y: y + 7 }, c, { w: 1.2 });
        line(p, view, { x: x2, y: y - 7 }, { x: x2, y: y + 7 }, c, { w: 1.2 });

        if (label) {
            // 兩條尺標（u 與 v）通常貼得很近，標籤要能一上一下錯開，
            // 否則 u = 4 cm 時兩顆徽章會疊在一起——而畫面其他地方完全正常。
            const dy = o.labelDy == null ? -28 : o.labelDy;
            worldBadge(p, view, (x1 + x2) / 2, y + dy, label,
                       { size: 13, col: c, align: o.labelAlign || 'center' });
        }
    }

    /** 一個小圓點：鏡面上的反射點、物與像的底部都用得到。 */
    function drawDot(p, view, x, y, col, r) {
        p.push();
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.ellipse(view.toScreenX(x), view.toScreenY(y),
                  L(view, r || 7, 4), L(view, r || 7, 4));
        p.pop();
    }

    // ======================================================================
    // 光脈衝（START 之後沿著光路跑的那顆亮點）
    // ======================================================================

    function drawPulse(p, view, x, y, col, o) {
        o = o || {};
        const cx = view.toScreenX(x), cy = view.toScreenY(y);
        const r = o.r || 9;
        p.push();
        p.noStroke();
        for (let i = 3; i >= 1; i--) {
            p.fill(col[0], col[1], col[2], 26 * i);
            p.ellipse(cx, cy, L(view, r * (1 + i * 1.1)), L(view, r * (1 + i * 1.1)));
        }
        p.fill(255, 255, 255);
        p.ellipse(cx, cy, L(view, r * 1.35), L(view, r * 1.35));
        p.fill(col[0], col[1], col[2]);
        p.ellipse(cx, cy, L(view, r), L(view, r));
        p.pop();
    }

    // ======================================================================
    // 對外介面
    // ======================================================================
    return {
        // lab-scene 的東西轉出，頁面只要記住 OpticsScene 一個名字
        strokeOn, L, fmt, badge,
        worldBadge, legendRowGap,
        run: LabScene.run,
        drawTitleBar: LabScene.drawTitleBar,
        drawGraph: LabScene.drawGraph,
        WORLD_W, WORLD_H, TITLE_TOP,
        SCENE,

        C_RAY, C_RAY_SOFT, C_NORMAL, C_MIRROR, C_HATCH,
        C_OBJ, C_IMG, C_EYE, C_ANGLE1, C_ANGLE2, C_DIM, C_LABEL,

        arrowHead, arrowShaftEnd, ARROW_LEN, line, dashed, drawDot,
        drawMirrorH, drawMirrorV, drawMirrorArc, drawInterfaceH,
        drawThinLens,
        drawNormal, drawAngleArc, drawRightAngle,
        drawVerticalArrow, drawEye, drawDimensionH, drawPulse,
    };
})();
