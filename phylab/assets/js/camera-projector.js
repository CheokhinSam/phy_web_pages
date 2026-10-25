/**
 * 📷 相機與投影機：透鏡的成像應用
 *
 * 同一個凸透鏡、同一組透鏡公式，換一個場合就變成兩種用途：
 *
 *   相機：物距 u 遠大於焦距 f（u > 2f），像距 v 略大於 f，
 *         底片上是一個倒立、縮小的實像。
 *   投影機：投影片放在 f 與 2f 之間，像距 v > 2f，
 *         屏幕上是一個倒立、放大的實像。
 *
 * 這一頁多了一個薄透鏡頁沒有的量：像屏距離 d。
 * 像距 v 是「透鏡公式說像在哪裡」，d 是「底片／屏幕實際放在哪裡」。
 * 只有 d = v 時像才清晰；d 偏離 v 時，光圈孔徑 a 會把像抹成一個
 * 直徑 b = a·|d−v|/v 的模糊圈。把 a 關小，b 跟著變小——這就是
 * 小光圈景深較大的原因，也是「對焦」和「光圈」是兩件事的原因。
 *
 * 幾何全部從 `OpticsKit.thinLensGeometry()` 來（v、M、像高、兩條作圖
 * 光線），這一頁只另外算「像屏」與「模糊圈」。所以卡片上的 v、畫面
 * 上的像平面與兩條作圖光線一定對得上。
 *
 * ==========================================================================
 * ⚠️ 作圖光線與真實孔徑是兩件事
 * ==========================================================================
 * 平行主軸那條作圖光線打在透鏡上的高度是「物頂的高度」，比真正的
 * 光圈孔徑大得多；它只是用來找像的位置，所以畫成虛線，而且只畫到
 * 像平面 v 為止。真正的光線是通過光圈上下緣的那兩條（畫得比較淡），
 * 它們在 v 會合、在像屏 d 上分開 b——模糊圈就是從這裡量出來的。
 * 如果把作圖光線一路畫到像屏，d 稍微偏離 v 時它會落在底片外面，
 * 看起來像「像跑到相機外面」，但卡片上的 b 其實很小。
 *
 * ==========================================================================
 * ⚠️ 像屏距離 d 的滑桿要涵蓋 v 的全部範圍
 * ==========================================================================
 * 投影機的 v 最小是 u=16、f=6 的 9.6 cm；底片／屏幕的 d 下限若停在
 * 10 cm，這個組合就永遠對不到焦。所以投影機的 d 從 8 cm 開始，
 * 而且步進是 0.1 cm——用 0.5 cm 的格點時，9.6 cm 只能停在 9.5 或 10，
 * 大光圈下仍然對不到焦。
 */

(function () {
    'use strict';

    const SCENE_RECT = { x0: 8, y0: 8, x1: 892, y1: 806 };
    const AXIS_Y = 430;
    const FOCUS_TOL = 0.05;        // 模糊圈 ≤ 0.05 cm 視為對焦
    const PULSE_SPEED = 220;       // 世界單位／秒

    const CAM = {
        lensX: 760, scale: 4, h: 30,
        halfH: 150, lensHalfW: 14,
        uMin: 40, uMax: 120, uDef: 80,
        fMin: 5, fMax: 12, fDef: 8,
        dMin: 4, dMax: 20, dDef: 8.9,
        aMin: 1, aMax: 6, aDef: 3,
        body: { x0: 774, x1: 852, y0: 330, y1: 530 },
        bodyLabel: '相機',
        screenLabel: '底片',
        uDimY: 620,
        dDimY: 690,
        imageBadgeY: 214,
        focusBadgeY: 600,
    };

    const PROJ = {
        lensX: 420, scale: 8, h: 3,
        halfH: 120, lensHalfW: 14,
        // 投影機的教學條件是 f < u < 2f（放大實像）。兩支滑桿如果各自
        // 獨立拉滿，會有 u ≥ 2f 的組合——那時成的是縮小實像，與「投影機」
        // 這個模式名稱矛盾。11–13.5 與 7–9 的 30 組全部滿足 f < u < 2f。
        uMin: 11, uMax: 13.5, uDef: 12,
        fMin: 7, fMax: 9, fDef: 8,
        dMin: 8, dMax: 50, dDef: 24,
        aMin: 1, aMax: 6, aDef: 3,
        body: { x0: 220, x1: 404, y0: 350, y1: 510 },
        bodyLabel: '投影機',
        screenLabel: '屏幕',
        uDimY: 570,
        dDimY: 700,
        imageBadgeY: 214,
        focusBadgeY: 620,
    };

    const LEGEND = { x: 54, y: 78, sample: 40, gap: 30 };
    const IMAGE_PLANE = { y0: 236, y1: 590 };

    const C_BODY_FILL = [241, 245, 249];
    const C_BODY_EDGE = [148, 163, 184];
    const C_SCREEN_FILL = [248, 250, 252];
    const C_SCREEN_EDGE = [203, 213, 225];
    const C_FILM = [51, 65, 85];
    const C_APERTURE = [30, 41, 59];
    const C_FOCUS = [22, 163, 74];

    // ======================================================================
    // 這一頁的狀態（純資料）
    // ======================================================================

    const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

    function num(x, def) {
        const v = typeof x === 'number' ? x : parseFloat(x);
        return Number.isFinite(v) ? v : def;
    }

    /** 模糊圈的直徑（cm）：b = a·|d−v|/v。 */
    function blurFor(a, d, v) {
        if (!(v > 0) || !Number.isFinite(v)) return Infinity;
        return Math.abs(a) * Math.abs(d - v) / v;
    }

    /**
     * 作圖光線在像屏平面 x 上的落點。
     * 出射線從 lensPoint 出發、方向 outDir；只用到 x 分量。
     */
    function rayHitX(ray, x) {
        const dx = ray.outDir.x;
        if (Math.abs(dx) < 1e-9) return { x, y: ray.lensPoint.y };
        const t = (x - ray.lensPoint.x) / dx;
        return { x, y: ray.lensPoint.y + t * ray.outDir.y };
    }

    /**
     * 通過光圈邊緣的那條光線，在像屏上的落點。
     *
     * 透鏡上一點 (lensX, yLens) 的出射線一定穿過像頂
     * (lensX + v·scale, imageTopY)；所以像屏在 d 時，只要把
     * yLens 與 imageTopY 按 d/v 內插就好。d < v 是還沒會合，
     * d > v 是已經交叉，兩種情形同一個式子。
     */
    function apertureHit(state, yLens) {
        const t = state.d / state.v;
        return {
            x: state.screenX,
            y: yLens + (state.imageTopY - yLens) * t,
        };
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = panel.mode === 'projector' ? 'projector' : 'camera';
        const cfg = mode === 'camera' ? CAM : PROJ;
        const cam = mode === 'camera';

        const u = clamp(num(panel[cam ? 'uCam' : 'uProj'],
                           cam ? CAM.uDef : PROJ.uDef), cfg.uMin, cfg.uMax);
        const f = clamp(num(panel[cam ? 'fCam' : 'fProj'],
                           cam ? CAM.fDef : PROJ.fDef), cfg.fMin, cfg.fMax);
        const d = clamp(num(panel[cam ? 'dCam' : 'dProj'],
                           cam ? CAM.dDef : PROJ.dDef), cfg.dMin, cfg.dMax);
        const a = clamp(num(panel[cam ? 'aCam' : 'aProj'], cfg.aDef),
                        cfg.aMin, cfg.aMax);

        const geo = OpticsKit.thinLensGeometry({
            type: 'convex',
            lensX: cfg.lensX,
            axisY: AXIS_Y,
            cmPerUnit: cfg.scale,
            u, f, h: cfg.h,
            scene: SCENE_RECT,
        });

        const v = geo.vSigned;
        const blurCm = blurFor(a, d, v);
        const focus = Number.isFinite(blurCm) && blurCm <= FOCUS_TOL;
        const screenX = cfg.lensX + d * cfg.scale;
        const imageX = cfg.lensX + v * cfg.scale;
        const imageTopY = geo.image.top.y;

        // 主光線（通過鏡心）在像屏上的高度；像頂一定在這條線上。
        const screenImageTopY = AXIS_Y + cfg.h * (d / u) * cfg.scale;

        const apHalf = a * cfg.scale / 2;
        const apTop = { x: cfg.lensX, y: AXIS_Y - apHalf };
        const apBot = { x: cfg.lensX, y: AXIS_Y + apHalf };
        const hits = geo.rays.map(r => rayHitX(r, screenX));

        return {
            mode, cam, cfg,
            modeLabel: cam ? '相機' : '投影機',
            u, f, d, a, v,
            geo,
            blurCm, blurW: blurCm * cfg.scale, focus,
            screenX, imageX, imageTopY, screenImageTopY,
            apTop, apBot,
            // 平行主軸的作圖光線只畫到像平面 v；通過鏡心的光線畫到像屏。
            parallelHit: rayHitX(geo.rays[0], imageX),
            centerHit: hits[1], hits,
            objectTop: geo.object.top,
        };
    }

    /** 光圈邊緣在像屏上的兩個落點；兩者的距離就是模糊圈 b。 */
    function blurBand(state) {
        return {
            top: apertureHit(state, state.apTop.y),
            bot: apertureHit(state, state.apBot.y),
        };
    }

    /** 光脈衝：沿著「物頂 → 鏡心 → 像屏上的主光線落點」走。 */
    function pulsePoint(state, t) {
        const A = state.objectTop;
        const B = { x: state.cfg.lensX, y: AXIS_Y };
        const C = state.centerHit;
        const l1 = Math.hypot(B.x - A.x, B.y - A.y);
        const l2 = Math.hypot(C.x - B.x, C.y - B.y);
        const total = l1 + l2;
        if (!(total > 0)) return null;
        let s = (t * PULSE_SPEED) % total;
        if (s < 0) s += total;
        if (s <= l1) {
            const q = l1 > 0 ? s / l1 : 1;
            return { x: A.x + (B.x - A.x) * q, y: A.y + (B.y - A.y) * q };
        }
        const q = l2 > 0 ? (s - l1) / l2 : 1;
        return { x: B.x + (C.x - B.x) * q, y: B.y + (C.y - B.y) * q };
    }

    // ======================================================================
    // 畫面小工具
    // ======================================================================

    /** 有透明度的線：`OpticsScene.line` 不吃 alpha，模糊光錐要自己畫。 */
    function faintLine(p, view, a, b, col, alpha, w) {
        p.push();
        p.stroke(col[0], col[1], col[2], alpha);
        p.strokeWeight(OpticsScene.L(view, w || 1.6, 1.2));
        p.line(view.toScreenX(a.x), view.toScreenY(a.y),
               view.toScreenX(b.x), view.toScreenY(b.y));
        p.pop();
    }

    function roundRect(p, view, box, fill, stroke, radius) {
        p.push();
        p.fill(fill[0], fill[1], fill[2]);
        p.stroke(stroke[0], stroke[1], stroke[2]);
        p.strokeWeight(OpticsScene.L(view, 2, 1.5));
        p.rect(view.toScreenX(box.x0), view.toScreenY(box.y0),
               OpticsScene.L(view, box.x1 - box.x0),
               OpticsScene.L(view, box.y1 - box.y0),
               OpticsScene.L(view, radius == null ? 10 : radius));
        p.pop();
    }

    function drawAxis(p, view) {
        const OS = OpticsScene;
        OS.dashed(p, view, { x: 40, y: AXIS_Y }, { x: 860, y: AXIS_Y },
                  OS.C_NORMAL, { w: 1.3 });
        OS.worldBadge(p, view, 50, AXIS_Y - 20, '主軸',
                      { size: 11, col: OS.C_NORMAL, align: 'left' });
    }

    /** 相機機身、鏡頭筒、底片；投影機機身、投影片、屏幕。 */
    function drawFurniture(p, view, s) {
        const OS = OpticsScene;
        const cfg = s.cfg;

        if (s.cam) {
            roundRect(p, view, cfg.body, C_BODY_FILL, C_BODY_EDGE, 12);
            // 觀景窗的小凸起，讓方塊看起來像相機
            roundRect(p, view, { x0: 800, x1: 832, y0: 312, y1: 334 },
                      C_BODY_FILL, C_BODY_EDGE, 5);

            // 底片／感光元件：一條深色鉛直線
            p.push();
            p.stroke(C_FILM[0], C_FILM[1], C_FILM[2]);
            p.strokeWeight(OS.L(view, 3.2, 2));
            p.line(view.toScreenX(s.screenX), view.toScreenY(AXIS_Y - 65),
                   view.toScreenX(s.screenX), view.toScreenY(AXIS_Y + 65));
            p.pop();

            OS.drawVerticalArrow(p, view,
                                 { x: s.geo.object.base.x, y: AXIS_Y },
                                 s.objectTop, OS.C_OBJ,
                                 { w: 4, head: 13 });
        } else {
            roundRect(p, view, cfg.body, C_BODY_FILL, C_BODY_EDGE, 12);

            // 投影片：物體就是這片小幻燈片
            const objX = s.geo.object.base.x;
            p.push();
            p.fill(219, 234, 254);
            p.stroke(OS.C_OBJ[0], OS.C_OBJ[1], OS.C_OBJ[2]);
            p.strokeWeight(OS.L(view, 2, 1.5));
            p.rect(view.toScreenX(objX - 8),
                   view.toScreenY(s.objectTop.y),
                   OS.L(view, 16), OS.L(view, cfg.h * cfg.scale),
                   OS.L(view, 3));
            p.pop();
            OS.drawVerticalArrow(p, view,
                                 { x: objX, y: AXIS_Y }, s.objectTop,
                                 OS.C_OBJ, { w: 2.6, head: 7 });

            // 屏幕：一片淺色直立板
            p.push();
            p.fill(C_SCREEN_FILL[0], C_SCREEN_FILL[1], C_SCREEN_FILL[2]);
            p.stroke(C_SCREEN_EDGE[0], C_SCREEN_EDGE[1], C_SCREEN_EDGE[2]);
            p.strokeWeight(OS.L(view, 1.6, 1));
            // 板子以 screenX 為中心：主光線與像都落在 screenX 上，
            // 像才不會被畫在板子旁邊。
            p.rect(view.toScreenX(s.screenX - 4), view.toScreenY(160),
                   OS.L(view, 8), OS.L(view, 500));
            p.pop();
        }
    }

    function drawLens(p, view, s) {
        const OS = OpticsScene;
        OS.drawThinLens(p, view, s.cfg.lensX, AXIS_Y, s.cfg.halfH, 'convex',
                        { halfW: s.cfg.lensHalfW });
        OS.worldBadge(p, view, s.cfg.lensX - 30,
                      AXIS_Y - s.cfg.halfH - 18, '凸透鏡',
                      { size: 12, col: OS.C_NORMAL, align: 'right' });
    }

    function drawRays(p, view, s) {
        const OS = OpticsScene;
        const C = OS.C_RAY;
        const parallel = s.geo.rays[0];
        const center = s.geo.rays[1];

        // 平行主軸的作圖光線：虛線，只畫到像平面 v。
        OS.line(p, view, parallel.objectPoint, parallel.lensPoint, C,
                { w: 1.7, dash: [9, 7] });
        OS.line(p, view, parallel.lensPoint, s.parallelHit, C,
                { w: 1.7, dash: [9, 7] });

        // 通過鏡心的真實光線：一路畫到像屏。
        OS.line(p, view, center.objectPoint, center.lensPoint, C,
                { w: 2.8, arrowAt: 0.55, head: 10 });
        OS.line(p, view, center.lensPoint, s.centerHit, C,
                { w: 2.8, arrowAt: 0.55, head: 10 });

        // 通過光圈上下緣的真實光線：淡一點，像屏上的距離就是模糊圈。
        for (const yLens of [s.apTop.y, s.apBot.y]) {
            const onLens = { x: s.cfg.lensX, y: yLens };
            const hit = apertureHit(s, yLens);
            faintLine(p, view, s.objectTop, onLens, C, 110, 1.5);
            faintLine(p, view, onLens, hit, C, 110, 1.5);
        }

        // 光圈孔徑：透鏡上的一段深色短線
        p.push();
        p.stroke(C_APERTURE[0], C_APERTURE[1], C_APERTURE[2]);
        p.strokeWeight(OS.L(view, 4.5, 3));
        p.line(view.toScreenX(s.cfg.lensX), view.toScreenY(s.apTop.y),
               view.toScreenX(s.cfg.lensX), view.toScreenY(s.apBot.y));
        p.pop();
    }

    /** 像屏上的像：對焦是清楚的紫箭頭，失焦是半透明的模糊帶。 */
    function drawScreenImage(p, view, s) {
        const OS = OpticsScene;
        // 相機的底片是一條線，像畫在線前面一點；投影機的屏幕是一片板，
        // 像必須落在板子的中線上。
        const x = s.cam ? s.screenX - 4 : s.screenX;
        const base = { x, y: AXIS_Y };
        const top = { x, y: s.screenImageTopY };
        const arrowPx = Math.abs(s.screenImageTopY - AXIS_Y) * view.scale;
        const head = Math.max(4, Math.min(10, arrowPx * 0.4 / (view.scale || 1)));

        if (s.focus) {
            OS.drawVerticalArrow(p, view, base, top, OS.C_IMG,
                                 { w: 3.4, head: head });
            return;
        }

        // 模糊帶：每個像點都被光圈抹成直徑 b 的圓，整支箭頭就成了一條帶。
        p.push();
        p.stroke(OS.C_IMG[0], OS.C_IMG[1], OS.C_IMG[2], 78);
        p.strokeWeight(OS.L(view, Math.max(s.blurW, 0.2), 3));
        p.strokeCap(p.ROUND);
        p.line(view.toScreenX(base.x), view.toScreenY(base.y),
               view.toScreenX(top.x), view.toScreenY(top.y));
        p.pop();

        // 模糊帶中央仍畫一條細線，看得出像的位置與方向
        p.push();
        p.stroke(OS.C_IMG[0], OS.C_IMG[1], OS.C_IMG[2], 170);
        p.strokeWeight(OS.L(view, 1.4, 1));
        p.line(view.toScreenX(base.x), view.toScreenY(base.y),
               view.toScreenX(top.x), view.toScreenY(top.y));
        p.pop();
        OS.drawDot(p, view, base.x, base.y, OS.C_IMG, 5);
    }

    function drawImagePlane(p, view, s) {
        const OS = OpticsScene;
        if (s.focus) return;
        OS.dashed(p, view,
                  { x: s.imageX, y: IMAGE_PLANE.y0 },
                  { x: s.imageX, y: IMAGE_PLANE.y1 },
                  OS.C_IMG, { w: 1.3 });
        OS.drawVerticalArrow(p, view,
                             { x: s.imageX, y: AXIS_Y },
                             { x: s.imageX, y: s.imageTopY },
                             OS.C_IMG, { w: 2.2, dash: [9, 7], head: 7 });
    }

    function drawRulers(p, view, s) {
        const OS = OpticsScene;
        const cfg = s.cfg;
        const objX = s.geo.object.base.x;
        OS.drawDimensionH(p, view, objX, cfg.lensX, cfg.uDimY,
                          `u = ${s.u.toFixed(1)} cm`, OS.C_DIM,
                          { labelDy: 28 });
        OS.drawDimensionH(p, view, cfg.lensX, s.screenX, cfg.dDimY,
                          `d = ${s.d.toFixed(1)} cm`, OS.C_DIM,
                          { labelDy: -28 });
    }

    function drawLabels(p, view, s) {
        const OS = OpticsScene;
        const cfg = s.cfg;

        if (s.cam) {
            OS.worldBadge(p, view, 740, 300, '相機',
                          { size: 13, col: OS.C_NORMAL, align: 'right' });
            OS.worldBadge(p, view, s.screenX + 12, 350, '底片',
                          { size: 11, col: OS.C_NORMAL, align: 'left' });
            OS.worldBadge(p, view,
                          s.geo.object.top.x - 14, s.geo.object.top.y + 4,
                          '物體', { size: 12, col: OS.C_OBJ, align: 'right' });
        } else {
            OS.worldBadge(p, view, 312, 332, '投影機',
                          { size: 13, col: OS.C_NORMAL });
            OS.worldBadge(p, view, s.geo.object.base.x,
                          s.geo.object.top.y - 14, '投影片',
                          { size: 11, col: OS.C_OBJ });
            OS.worldBadge(p, view, s.screenX, 142, '屏幕',
                          { size: 13, col: OS.C_NORMAL });
        }

        // 投影機的屏幕是一整片板子，狀態徽章放在板的左側（右對齊），
        // 不要壓在板上把屏幕切成兩段。
        const status = s.cam
            ? { x: s.screenX, align: undefined }
            : { x: s.screenX - 12, align: 'right' };
        if (s.focus) {
            OS.worldBadge(p, view, status.x, cfg.focusBadgeY, '對焦',
                          { size: 12, col: C_FOCUS, align: status.align });
        } else {
            OS.worldBadge(p, view, s.imageX, cfg.imageBadgeY,
                          `v = ${s.v.toFixed(1)} cm`,
                          { size: 11, col: OS.C_IMG });
            OS.worldBadge(p, view, status.x, cfg.focusBadgeY,
                          `b = ${s.blurCm.toFixed(2)} cm`,
                          { size: 11, col: OS.C_IMG, align: status.align });
        }
    }

    function legendRows(view) {
        const OS = OpticsScene;
        const gap = OS.legendRowGap(view, LEGEND.gap);
        return [
            { y: LEGEND.y, text: '物', col: OS.C_OBJ, kind: 'arrow' },
            { y: LEGEND.y + gap, text: '像', col: OS.C_IMG, kind: 'arrow' },
            { y: LEGEND.y + gap * 2, text: '像平面（v）',
              col: OS.C_IMG, kind: 'dash' },
            { y: LEGEND.y + gap * 3, text: '光線',
              col: OS.C_RAY, kind: 'line' },
            { y: LEGEND.y + gap * 4, text: '作圖輔助線',
              col: OS.C_RAY, kind: 'line', dash: [9, 7] },
        ];
    }

    function drawLegend(p, view) {
        const OS = OpticsScene;
        for (const row of legendRows(view)) {
            const x = LEGEND.x;
            if (row.kind === 'arrow') {
                OS.drawVerticalArrow(p, view,
                                     { x, y: row.y + 10 },
                                     { x, y: row.y - 10 },
                                     row.col, { w: 2.6, head: 6 });
            } else {
                const dash = row.kind === 'dash' ? [9, 7] : (row.dash || null);
                OS.line(p, view, { x, y: row.y },
                        { x: x + LEGEND.sample, y: row.y },
                        row.col, { w: 2.2, dash });
            }
            const tx = x + (row.kind === 'arrow' ? 22 : LEGEND.sample + 10);
            OS.worldBadge(p, view, tx, row.y, row.text,
                          { size: 12, col: row.col, align: 'left' });
        }
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const s = state;

        drawAxis(p, view);
        drawFurniture(p, view, s);
        drawLens(p, view, s);
        drawRays(p, view, s);
        drawImagePlane(p, view, s);
        drawScreenImage(p, view, s);
        drawRulers(p, view, s);
        drawLabels(p, view, s);
        drawLegend(p, view);

        if (panel.started) {
            const q = pulsePoint(s, t);
            if (q) OpticsScene.drawPulse(p, view, q.x, q.y, OpticsScene.C_RAY,
                                         { r: 9 });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================

    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isCamera = panel => (panel.mode || 'camera') !== 'projector';
    const isProjector = panel => panel.mode === 'projector';

    OpticsScene.run({
        formula: '\\begin{aligned}'
               + '\\frac{1}{u}+\\frac{1}{v}&=\\frac{1}{f}\\\\'
               + 'M&=-\\frac{v}{u}\\\\'
               + 'b&=a\\,\\frac{|d-v|}{v}'
               + '\\end{aligned}',
        formulaFallback: '1/u + 1/v = 1/f；M = −v/u；b = a·|d−v|/v',

        controls: {
            selects: [{
                key: 'mode', label: '應用', def: 'camera',
                // 非 live：卡片上的 v、d、b 都跟著模式換一組滑桿，
                // 切模式一定要重新 refresh()。
                options: [
                    { v: 'camera', t: '相機' },
                    { v: 'projector', t: '投影機' },
                ],
            }],
            sliders: [
                { key: 'uCam', label: '物距 u', def: 80, min: 40, max: 120,
                  step: 1, unit: 'cm', dec: 1, when: isCamera },
                { key: 'fCam', label: '焦距 f', def: 8, min: 5, max: 12,
                  step: 0.5, unit: 'cm', dec: 1, when: isCamera },
                { key: 'dCam', label: '底片距離 d', def: 8.9, min: 4, max: 20,
                  step: 0.1, unit: 'cm', dec: 1, when: isCamera },
                { key: 'aCam', label: '光圈孔徑 a', def: 3, min: 1, max: 6,
                  step: 0.5, unit: 'cm', dec: 1, when: isCamera },

                { key: 'uProj', label: '物距 u', def: 12, min: 11, max: 13.5,
                  step: 0.5, unit: 'cm', dec: 1, when: isProjector },
                { key: 'fProj', label: '焦距 f', def: 8, min: 7, max: 9,
                  step: 0.5, unit: 'cm', dec: 1, when: isProjector },
                { key: 'dProj', label: '屏幕距離 d', def: 24, min: 8, max: 50,
                  step: 0.1, unit: 'cm', dec: 1, when: isProjector },
                { key: 'aProj', label: '光圈孔徑 a', def: 3, min: 1, max: 6,
                  step: 0.5, unit: 'cm', dec: 1, when: isProjector },
            ],
        },

        cards: [
            CARD('物距 u', 'cardU', 'cm', false),
            CARD('焦距 f', 'cardF', 'cm', false),
            CARD('像距 v', 'cardV', 'cm', true),
            CARD('底片距離 d', 'cardDCam', 'cm', false, isCamera),
            CARD('屏幕距離 d', 'cardDProj', 'cm', false, isProjector),
            CARD('對焦', 'cardFocus', '', true),
            CARD('模糊圈 b', 'cardBlur', 'cm', false),
            CARD('放大率 M', 'cardM', ''),
            CARD('像高 h′', 'cardHp', 'cm'),
            CARD('像的性質', 'cardNature', ''),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, s) {
            return {
                cardU: s.u.toFixed(1),
                cardF: s.f.toFixed(1),
                cardV: s.v.toFixed(1),
                cardDCam: s.d.toFixed(1),
                cardDProj: s.d.toFixed(1),
                cardFocus: s.focus ? '是' : '否',
                cardBlur: s.blurCm.toFixed(2),
                cardM: s.geo.M.toFixed(2),
                cardHp: s.geo.hSigned.toFixed(1),
                cardNature: s.geo.nature,
            };
        },

        titleText(t, panel, s) {
            const where = s.cam ? '相機' : '投影機';
            const focus = s.focus ? '對焦' : `失焦 b = ${s.blurCm.toFixed(2)} cm`;
            return `${where}　u = ${s.u.toFixed(1)} cm`
                 + `　f = ${s.f.toFixed(1)} cm`
                 + `　v = ${s.v.toFixed(1)} cm`
                 + `　d = ${s.d.toFixed(1)} cm　${focus}`;
        },

        onFrame(t, panel) {
            // 掃描像屏距離：來回穿過像距 v，畫面就會從清楚變成模糊、再清楚。
            // v 仍然只有一個家（stateFor → thinLensGeometry），不在這裡重算。
            const s = stateFor(panel);
            const key = s.cam ? 'dCam' : 'dProj';
            const amp = s.cam ? 4 : 8;
            panel.set(key, clamp(s.v + amp * Math.sin(t * 0.8),
                                 s.cfg.dMin, s.cfg.dMax));
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
            SCENE_RECT, AXIS_Y, FOCUS_TOL, PULSE_SPEED,
            CAM, PROJ, LEGEND, IMAGE_PLANE,
            clamp, num, blurFor, rayHitX, apertureHit, stateFor,
            blurBand, pulsePoint, legendRows, drawScene,
        };
    }
})();
