/**
 * 🔦 光的直線傳播：影與針孔成像
 *
 * 兩個模式共用同一句話：光走直線。
 *
 *   影      —— 光源是一個有上下緣的長條，物體是一個不透明的長條。
 *              光源上每一點都在屏幕上投下一個「物體的影子」，全部疊起來
 *              就是半影；只有每一點都擋住的地方才是本影。
 *
 *   針孔    —— 物體上每一點發出的光只有一小束能穿過孔，在屏幕上分別成像。
 *              像倒立、大小是 h′ = h·v/u；孔徑不是零，所以每個點都攤成
 *              一個直徑 b = a(u+v)/u 的模糊圈。
 *
 * ==========================================================================
 * ⚠️ 影的三條邊界是同一個投影係數 k 算出來的
 * ==========================================================================
 * 光源在 SRC_X、物體在 OBJ_X、屏幕在 SCREEN_X，k 是「光源→屏幕」與
 * 「光源→物體」的距離比。光源半高 sw、物體半高 ow（世界單位）時：
 *
 *   影的外緣（半影外側）  = k·ow + (k−1)·sw
 *   本影邊界              = k·ow − (k−1)·sw
 *
 * 本影寬度是 2(k·ow − (k−1)·sw)，小於零就代表沒有本影——整個影子都是
 * 半影。點光源（sw = 0）時兩條邊界重合，本影＝影子。
 * 這三條邊界與畫面上四條「光源邊緣→物體邊緣→屏幕」的光線是同一組數字。
 *
 * ==========================================================================
 * ⚠️ 針孔的像高與模糊圈也是同一組相似三角形
 * ==========================================================================
 * 物距 u、屏距 v、物高 h、孔徑 a：
 *
 *   h′ = h · v/u
 *   b  = a · (u+v)/u
 *
 * 孔徑愈大，像愈亮但愈模糊；孔徑趨近 0 時 b→0，像最清楚（但也最暗）。
 * 卡片上的「模糊比 b/h′」就是這兩個數字的比值。
 */

(function () {
    'use strict';

    const AXIS_Y = 400;
    const SCENE = { x0: 8, y0: 8, x1: 892, y1: 806 };

    // 影模式：光源、物體、屏幕的位置（世界座標）
    const SRC_X = 160;
    const OBJ_X = 460;
    const SCREEN_X = 820;
    const CM = 20;                    // 1 cm = 20 個世界單位

    // 針孔模式：孔徑所在平面、水平與鉛直的尺度
    const APERTURE_X = 480;
    const PIN_CM_X = 12;              // 水平：1 cm = 12 個世界單位
    const PIN_CM_Y = 20;              // 鉛直：1 cm = 20 個世界單位

    const LEGEND = { x: 54, y: 76, gap: 30 };

    const C_SOURCE = [245, 158, 11];
    const C_SHADOW = [30, 41, 59];
    const C_PENUMBRA = [148, 163, 184];
    const C_WALL = [51, 65, 85];
    const C_SCREEN = [226, 232, 240];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    // ======================================================================
    // 純物理
    // ======================================================================

    /**
     * 影：回傳光源、物體、屏幕上的三條邊界，以及四條邊界光線。
     * 所有 y 都是世界座標，寬度另外換算成 cm。
     */
    function shadowGeometry(srcHalf, objHalf) {
        const s = clamp(num(srcHalf, 1.0), 0, 4);
        const o = clamp(num(objHalf, 3.0), 1.5, 5.5);
        const sw = s * CM;
        const ow = o * CM;

        const k = (SCREEN_X - SRC_X) / (OBJ_X - SRC_X);
        const topPen = AXIS_Y - k * ow - (k - 1) * sw;
        const topUmb = AXIS_Y - k * ow + (k - 1) * sw;
        const botUmb = AXIS_Y + k * ow - (k - 1) * sw;
        const botPen = AXIS_Y + k * ow + (k - 1) * sw;

        const umbraW = Math.max(0, 2 * (k * ow - (k - 1) * sw)) / CM;
        const totalW = 2 * (k * ow + (k - 1) * sw) / CM;
        const penW = Math.max(0, totalW - umbraW);
        const umbraExists = k * ow > (k - 1) * sw + 1e-9;

        const srcTopY = AXIS_Y - sw;
        const srcBotY = AXIS_Y + sw;
        const objTopY = AXIS_Y - ow;
        const objBotY = AXIS_Y + ow;

        // 一條「光源邊緣 → 物體邊緣 → 屏幕」的光線；回傳三個點。
        function ray(py, oy) {
            const endY = py + (oy - py) * k;
            return {
                a: { x: SRC_X, y: py },
                b: { x: OBJ_X, y: oy },
                c: { x: SCREEN_X, y: endY },
            };
        }

        const rays = [
            ray(srcTopY, objTopY),   // 打到本影上緣
            ray(srcTopY, objBotY),   // 打到影的外緣下緣
            ray(srcBotY, objTopY),   // 打到影的外緣上緣
            ray(srcBotY, objBotY),   // 打到本影下緣
        ];

        return {
            srcHalf: s, objHalf: o, k,
            srcTopY, srcBotY, objTopY, objBotY,
            topPen, topUmb, botUmb, botPen,
            umbraW, totalW, penW, umbraExists,
            rays,
            srcToObj: (OBJ_X - SRC_X) / CM,
            objToScreen: (SCREEN_X - OBJ_X) / CM,
        };
    }

    /**
     * 針孔：回傳物體、孔徑、屏幕的位置，以及像高、放大率與模糊圈。
     * 孔徑 a 與物高 h 都是 cm；像是倒立的，畫在軸的下方。
     */
    function pinholeGeometry(objH, u, v, aperture) {
        const h = clamp(num(objH, 4), 2, 6);
        const uu = clamp(num(u, 18), 12, 24);
        const vv = clamp(num(v, 18), 12, 24);
        const a = clamp(num(aperture, 0.6), 0.2, 2);

        const objX = APERTURE_X - uu * PIN_CM_X;
        const screenX = APERTURE_X + vv * PIN_CM_X;

        const objTopY = AXIS_Y - h * PIN_CM_Y;
        const hImage = h * vv / uu;
        const imageTopY = AXIS_Y + hImage * PIN_CM_Y;
        const blur = a * (uu + vv) / uu;
        const blurW = blur * PIN_CM_Y;
        const gap = a * PIN_CM_Y;

        const apertureTop = AXIS_Y - gap / 2;
        const apertureBot = AXIS_Y + gap / 2;
        const imageBlurTop = imageTopY - blurW / 2;
        const imageBlurBot = imageTopY + blurW / 2;
        const baseBlurTop = AXIS_Y - blurW / 2;
        const baseBlurBot = AXIS_Y + blurW / 2;

        // 物體頂點與底點各自穿過孔的上下緣，在屏幕上張開一個模糊圈。
        function cone(py) {
            return {
                a: { x: objX, y: py },
                top: { x: APERTURE_X, y: apertureTop },
                bot: { x: APERTURE_X, y: apertureBot },
                topEnd: { x: screenX, y: py + (apertureTop - py) * (screenX - objX) / (APERTURE_X - objX) },
                botEnd: { x: screenX, y: py + (apertureBot - py) * (screenX - objX) / (APERTURE_X - objX) },
            };
        }

        return {
            objH: h, u: uu, v: vv, aperture: a,
            objX, screenX,
            objTopY, objBaseY: AXIS_Y,
            imageH: hImage, imageTopY, imageBaseY: AXIS_Y,
            blur, blurW, gap,
            apertureTop, apertureBot,
            imageBlurTop, imageBlurBot,
            baseBlurTop, baseBlurBot,
            magnification: vv / uu,
            blurRatio: blur / hImage,
            tipCone: cone(objTopY),
            baseCone: cone(AXIS_Y),
        };
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = panel.mode === 'pinhole' ? 'pinhole' : 'shadow';
        return {
            mode,
            shadow: shadowGeometry(panel.srcHalf, panel.objHalf),
            pinhole: pinholeGeometry(panel.objH, panel.u, panel.v, panel.aperture),
        };
    }

    function legendRows(state) {
        if (state.mode === 'pinhole') {
            return [
                { text: '黃線：物體頂點與底點穿過孔的光', col: C_SOURCE },
                { text: '紫：屏幕上的像（倒立）', col: [139, 92, 246] },
                { text: '孔徑愈小，像愈清楚', col: C_WALL },
            ];
        }
        return [
            { text: '黃線：光源邊緣 → 物體邊緣 → 屏幕', col: C_SOURCE },
            { text: '深灰：本影　淺灰：半影', col: C_WALL },
            { text: '光源愈大，半影愈寬', col: C_WALL },
        ];
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawRay(p, view, a, b, alpha, w) {
        p.push();
        p.stroke(C_SOURCE[0], C_SOURCE[1], C_SOURCE[2], alpha);
        p.strokeWeight(OpticsScene.L(view, w == null ? 1.3 : w, 1));
        p.line(view.toScreenX(a.x), view.toScreenY(a.y),
               view.toScreenX(b.x), view.toScreenY(b.y));
        p.pop();
    }

    function drawAxis(p, view) {
        OpticsScene.dashed(p, view, { x: 34, y: AXIS_Y }, { x: 878, y: AXIS_Y },
                           [203, 213, 225], { w: 1.2, dash: [10, 10] });
    }

    function drawSource(p, view, g) {
        const x = view.toScreenX(SRC_X);
        const yTop = view.toScreenY(g.srcTopY);
        const yBot = view.toScreenY(g.srcBotY);
        const halfW = OpticsScene.L(view, 13, 7);

        p.push();
        p.noStroke();
        // 光暈：三層由大到小的琥珀色。
        for (let i = 3; i >= 1; i--) {
            p.fill(C_SOURCE[0], C_SOURCE[1], C_SOURCE[2], 22 * i);
            p.rect(x - halfW * (1 + i * 0.55), yTop - halfW * i,
                   halfW * 2 * (1 + i * 0.55), (yBot - yTop) + halfW * 2 * i,
                   halfW);
        }
        p.fill(C_SOURCE[0], C_SOURCE[1], C_SOURCE[2]);
        p.rect(x - halfW, yTop, halfW * 2, yBot - yTop, halfW);
        p.fill(255, 245, 210);
        if (yBot - yTop < 2) {
            p.ellipse(x, (yTop + yBot) / 2, halfW, halfW);
        } else {
            p.rect(x - halfW * 0.4, yTop + 2, halfW * 0.8, yBot - yTop - 4, halfW * 0.4);
        }
        p.pop();

        OpticsScene.worldBadge(p, view, SRC_X, g.srcTopY - 34,
                              g.srcHalf < 1e-9 ? '點光源' : '光源',
                              { size: 13, col: C_SOURCE });
    }

    function drawObjectBar(p, view, g) {
        const x = view.toScreenX(OBJ_X);
        const yTop = view.toScreenY(g.objTopY);
        const yBot = view.toScreenY(g.objBotY);
        const halfW = OpticsScene.L(view, 12, 6);

        p.push();
        p.noStroke();
        p.fill(C_SHADOW[0], C_SHADOW[1], C_SHADOW[2]);
        p.rect(x - halfW, yTop, halfW * 2, yBot - yTop, halfW);
        p.pop();

        OpticsScene.worldBadge(p, view, OBJ_X - 26, g.objBotY + 30, '物體',
                              { size: 13, col: C_SHADOW, align: 'right' });
    }

    function drawScreenBands(p, view, g) {
        const x0 = view.toScreenX(SCREEN_X);
        const x1 = view.toScreenX(SCREEN_X + 18);
        const y = v => view.toScreenY(v);

        // 屏幕本體
        p.push();
        p.noStroke();
        p.fill(255);
        p.rect(x0, view.toScreenY(SCENE.y0), x1 - x0, view.toScreenY(SCENE.y1) - view.toScreenY(SCENE.y0));
        p.stroke(C_SCREEN[0], C_SCREEN[1], C_SCREEN[2]);
        p.strokeWeight(OpticsScene.L(view, 2, 1));
        p.noFill();
        p.rect(x0, view.toScreenY(SCENE.y0), x1 - x0, view.toScreenY(SCENE.y1) - view.toScreenY(SCENE.y0));
        p.pop();

        // 半影與本影
        p.push();
        p.noStroke();
        p.fill(C_PENUMBRA[0], C_PENUMBRA[1], C_PENUMBRA[2], 120);
        if (g.umbraExists) {
            p.rect(x0, y(g.topPen), x1 - x0, y(g.topUmb) - y(g.topPen));
            p.rect(x0, y(g.botUmb), x1 - x0, y(g.botPen) - y(g.botUmb));
            p.fill(C_SHADOW[0], C_SHADOW[1], C_SHADOW[2], 215);
            p.rect(x0, y(g.topUmb), x1 - x0, y(g.botUmb) - y(g.topUmb));
        } else {
            // 沒有本影：整片都是半影，中央只是「比較暗」。
            p.rect(x0, y(g.topPen), x1 - x0, y(g.botPen) - y(g.topPen));
        }
        p.pop();

        // 屏幕標籤放在右側，避開影子那幾條線。
        OpticsScene.worldBadge(p, view, SCREEN_X + 34, SCENE.y0 + 46, '屏幕',
                              { size: 13, col: C_WALL, align: 'left' });
    }

    function drawShadow(p, view, state) {
        const g = state.shadow;
        drawAxis(p, view);

        for (const r of g.rays) {
            drawRay(p, view, r.a, r.c, 95, 1.3);
        }
        drawSource(p, view, g);
        drawObjectBar(p, view, g);
        drawScreenBands(p, view, g);

        OpticsScene.drawDimensionH(p, view, SRC_X, OBJ_X, 750,
                                   `${g.srcToObj.toFixed(0)} cm`, C_WALL,
                                   { extY: AXIS_Y + 120, labelDy: -26 });
        OpticsScene.drawDimensionH(p, view, OBJ_X, SCREEN_X, 750,
                                   `${g.objToScreen.toFixed(0)} cm`, C_WALL,
                                   { extY: AXIS_Y + 120, labelDy: -26 });
    }

    function drawPinholeBarrier(p, view, g) {
        const x = view.toScreenX(APERTURE_X);
        const yTop = view.toScreenY(SCENE.y0);
        const yGapTop = view.toScreenY(g.apertureTop);
        const yGapBot = view.toScreenY(g.apertureBot);
        const yBot = view.toScreenY(SCENE.y1);
        const w = OpticsScene.L(view, 8, 4);

        p.push();
        p.noStroke();
        p.fill(C_WALL[0], C_WALL[1], C_WALL[2]);
        p.rect(x - w / 2, yTop, w, yGapTop - yTop);
        p.rect(x - w / 2, yGapBot, w, yBot - yGapBot);
        p.pop();

        OpticsScene.worldBadge(p, view, APERTURE_X, SCENE.y0 + 44, '針孔',
                              { size: 13, col: C_WALL });
        OpticsScene.worldBadge(p, view, APERTURE_X + 26, AXIS_Y - 42,
                              `孔徑 a = ${g.aperture.toFixed(1)} cm`,
                              { size: 12, col: C_WALL, align: 'left' });
    }

    function drawPinholeScreen(p, view, g) {
        const x0 = view.toScreenX(g.screenX);
        const x1 = view.toScreenX(g.screenX + 18);
        const y = v => view.toScreenY(v);

        p.push();
        p.noStroke();
        p.fill(255);
        p.rect(x0, view.toScreenY(SCENE.y0), x1 - x0,
               view.toScreenY(SCENE.y1) - view.toScreenY(SCENE.y0));
        p.stroke(C_SCREEN[0], C_SCREEN[1], C_SCREEN[2]);
        p.strokeWeight(OpticsScene.L(view, 2, 1));
        p.noFill();
        p.rect(x0, view.toScreenY(SCENE.y0), x1 - x0,
               view.toScreenY(SCENE.y1) - view.toScreenY(SCENE.y0));
        p.pop();

        // 模糊圈：像的每一個點都攤成一個高度 b 的亮帶。
        p.push();
        p.noStroke();
        p.fill(139, 92, 246, 55);
        p.rect(x0, y(Math.min(g.baseBlurTop, g.imageBlurTop)),
               x1 - x0, y(Math.max(g.baseBlurBot, g.imageBlurBot))
                          - y(Math.min(g.baseBlurTop, g.imageBlurTop)));
        p.pop();
    }

    function drawPinhole(p, view, state) {
        const g = state.pinhole;
        drawAxis(p, view);
        drawPinholeScreen(p, view, g);

        // 物體頂點與底點的光錐（四條邊界線）
        for (const c of [g.tipCone, g.baseCone]) {
            drawRay(p, view, c.a, c.topEnd, 90, 1.2);
            drawRay(p, view, c.a, c.botEnd, 90, 1.2);
        }

        // 物體：一支向上的箭頭
        OpticsScene.drawVerticalArrow(p, view,
            { x: g.objX, y: g.objBaseY },
            { x: g.objX, y: g.objTopY }, OpticsScene.C_OBJ,
            { w: 4, arrowEnd: true, head: 12 });
        OpticsScene.worldBadge(p, view, g.objX, g.objTopY - 30, '物體',
                              { size: 13, col: OpticsScene.C_OBJ });

        // 像：一支向下的箭頭（倒立）
        OpticsScene.drawVerticalArrow(p, view,
            { x: g.screenX, y: g.imageBaseY },
            { x: g.screenX, y: g.imageTopY }, OpticsScene.C_IMG,
            { w: 4, arrowEnd: true, head: 12 });
        OpticsScene.worldBadge(p, view, g.screenX + 34, g.imageTopY + 30, '像',
                              { size: 13, col: OpticsScene.C_IMG, align: 'left' });

        drawPinholeBarrier(p, view, g);

        // 模糊圈 b 的尺標：貼在像的頂端右側
        const bx = g.screenX + 34;
        OpticsScene.line(p, view,
            { x: bx, y: g.imageBlurTop }, { x: bx, y: g.imageBlurBot },
            C_WALL, { w: 1.5 });
        OpticsScene.line(p, view,
            { x: bx - 8, y: g.imageBlurTop }, { x: bx + 8, y: g.imageBlurTop },
            C_WALL, { w: 1.5 });
        OpticsScene.line(p, view,
            { x: bx - 8, y: g.imageBlurBot }, { x: bx + 8, y: g.imageBlurBot },
            C_WALL, { w: 1.5 });
        OpticsScene.worldBadge(p, view, bx + 12,
                              (g.imageBlurTop + g.imageBlurBot) / 2,
                              `b = ${g.blur.toFixed(1)} cm`,
                              { size: 12, col: C_WALL, align: 'left' });

        OpticsScene.drawDimensionH(p, view, g.objX, APERTURE_X, 750,
                                   `u = ${g.u.toFixed(0)} cm`, C_WALL,
                                   { extY: AXIS_Y + 120, labelDy: -26 });
        OpticsScene.drawDimensionH(p, view, APERTURE_X, g.screenX, 750,
                                   `v = ${g.v.toFixed(0)} cm`, C_WALL,
                                   { extY: AXIS_Y + 120, labelDy: -26 });
    }

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;
        if (state.mode === 'pinhole') {
            drawPinhole(p, view, state);
        } else {
            drawShadow(p, view, state);
        }

        const rows = legendRows(state);
        const gap = OS.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OS.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                          rows[i].text, { size: 12, col: rows[i].col, align: 'left' });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isShadow = p => p.mode !== 'pinhole';
    const isPinhole = p => p.mode === 'pinhole';

    OpticsScene.run({
        formula: 'h\'=\\frac{v}{u}h',
        formulaFallback: "h′ = (v/u) h",

        controls: {
            selects: [{
                key: 'mode', label: '模式', def: 'shadow', live: true,
                options: [
                    { v: 'shadow', t: '影（本影與半影）' },
                    { v: 'pinhole', t: '針孔成像' },
                ],
            }],
            sliders: [
                { key: 'srcHalf', label: '光源半高', def: 1.0, min: 0, max: 4,
                  step: 0.1, unit: 'cm', dec: 1, when: isShadow },
                { key: 'objHalf', label: '物體半高', def: 3.0, min: 1.5, max: 5.5,
                  step: 0.1, unit: 'cm', dec: 1, when: isShadow },
                { key: 'objH', label: '物體高度 h', def: 4.0, min: 2, max: 6,
                  step: 0.1, unit: 'cm', dec: 1, when: isPinhole },
                { key: 'u', label: '物距 u', def: 18, min: 12, max: 24,
                  step: 0.5, unit: 'cm', dec: 1, when: isPinhole },
                { key: 'v', label: '屏幕距離 v', def: 18, min: 12, max: 24,
                  step: 0.5, unit: 'cm', dec: 1, when: isPinhole },
                { key: 'aperture', label: '孔徑 a', def: 0.6, min: 0.2, max: 2,
                  step: 0.1, unit: 'cm', dec: 1, when: isPinhole },
            ],
        },

        cards: [
            CARD('光源半高', 'cardSrcHalf', 'cm', false, isShadow),
            CARD('物體半高', 'cardObjHalf', 'cm', false, isShadow),
            CARD('影的總寬度', 'cardShadowW', 'cm', true, isShadow),
            CARD('本影寬度', 'cardUmbraW', 'cm', true, isShadow),
            CARD('半影寬度（兩側合計）', 'cardPenW', 'cm', false, isShadow),
            CARD('有沒有本影', 'cardUmbra', '', false, isShadow),

            CARD('物體高度 h', 'cardPH', 'cm', false, isPinhole),
            CARD('物距 u', 'cardPU', 'cm', false, isPinhole),
            CARD('屏幕距離 v', 'cardPV', 'cm', false, isPinhole),
            CARD('像高 h′', 'cardPImage', 'cm', true, isPinhole),
            CARD('放大率 m = v/u', 'cardPM', '', false, isPinhole),
            CARD('孔徑 a', 'cardPAperture', 'cm', false, isPinhole),
            CARD('模糊直徑 b', 'cardPBlur', 'cm', true, isPinhole),
            CARD('模糊比 b/h′', 'cardPSharp', '', false, isPinhole),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            const sh = g.shadow;
            const ph = g.pinhole;
            return {
                cardSrcHalf: sh.srcHalf.toFixed(1),
                cardObjHalf: sh.objHalf.toFixed(1),
                cardShadowW: sh.totalW.toFixed(1),
                cardUmbraW: sh.umbraW.toFixed(1),
                cardPenW: sh.penW.toFixed(1),
                cardUmbra: sh.umbraExists ? '有' : '沒有（全區都是半影）',

                cardPH: ph.objH.toFixed(1),
                cardPU: ph.u.toFixed(1),
                cardPV: ph.v.toFixed(1),
                cardPImage: ph.imageH.toFixed(2),
                cardPM: ph.magnification.toFixed(2),
                cardPAperture: ph.aperture.toFixed(1),
                cardPBlur: ph.blur.toFixed(2),
                cardPSharp: ph.blurRatio.toFixed(2),
            };
        },

        titleText(t, panel, g) {
            if (g.mode === 'pinhole') {
                const ph = g.pinhole;
                return `h = ${ph.objH.toFixed(1)} cm　u = ${ph.u.toFixed(0)} cm`
                     + `　v = ${ph.v.toFixed(0)} cm　h′ = ${ph.imageH.toFixed(2)} cm`
                     + `　b = ${ph.blur.toFixed(2)} cm`;
            }
            const sh = g.shadow;
            return `光源半高 = ${sh.srcHalf.toFixed(1)} cm`
                 + `　物體半高 = ${sh.objHalf.toFixed(1)} cm`
                 + `　本影 = ${sh.umbraW.toFixed(1)} cm`
                 + `　影總寬 = ${sh.totalW.toFixed(1)} cm`;
        },

        onFrame(t, panel) {
            if (panel.mode === 'pinhole') {
                // 物距來回掃：像的大小與模糊圈會一起變。
                panel.set('u', clamp(18 + 6 * Math.sin(t * 0.55), 12, 24));
            } else {
                // 光源由點光源長成有大小：本影縮小、半影變寬，最後消失。
                panel.set('srcHalf', clamp(2 + 2 * Math.sin(t * 0.7), 0, 4));
            }
        },

        draw(p, view, t, panel, sol) {
            drawScene(p, view, t, panel, sol);
        },
    });

    // ======================================================================
    // 給驗證器的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            AXIS_Y, SCENE, SRC_X, OBJ_X, SCREEN_X, CM,
            APERTURE_X, PIN_CM_X, PIN_CM_Y, LEGEND,
            C_SOURCE, C_SHADOW, C_PENUMBRA, C_WALL, C_SCREEN,
            clamp, shadowGeometry, pinholeGeometry, stateFor, legendRows,
            drawScene,
        };
    }
})();
