/**
 * 🪞 平面鏡成像
 *
 * 這一頁的教學本體是「像在哪裡、有多大」，而這兩個問題的答案都從
 * `OpticsKit.planeMirrorGeometry()` 來：物與像的座標、兩條光線在鏡面上的
 * 反射點、u／v／h／h′ 全部是同一份幾何。
 *
 * ==========================================================================
 * ⚠️ 虛像不是「畫在鏡子後面的另一個物」
 * ==========================================================================
 * 畫面右邊那支紫色虛線箭頭是**反射光線的反向延長線交會出來的點**，不是
 * 另外畫一個對稱的物體。兩條黃色實線從物的頂端與底端射到鏡面，再反射進入
 * 眼睛；把反射線**往鏡後延長**（虛線），它們剛好交在像的頂端與底端。
 * 所以像的位置是「眼睛順著反射光看回去」的結果——光其實沒有走到鏡後。
 *
 * 這也是為什麼 `planeMirrorGeometry()` 先用 `mirrorImage()` 算出對稱點，
 * 再把「像點 → 眼睛」連線與鏡面的交點當成反射點：反射定律自動成立，
 * 不需要在畫面上另外湊角度。
 *
 * ==========================================================================
 * ⚠️ 兩把尺標一定要錯開
 * ==========================================================================
 * u 與 v 的尺標都以鏡面為一端，u = 4 cm 時兩條線各只有 72 個世界單位寬，
 * 而「u = 4.0 cm」的徽章比這還寬。兩顆標籤放在同一條水平線上一定會疊在
 * 一起——所以 u 的標籤在上、v 的標籤在下（`labelDy`），垂直錯開 62 個
 * 世界單位。這個偏移不是排版喜好，是量出來的。
 */
(function () {
    'use strict';

    const MIRROR_X = 480;
    const MIRROR_TOP = 110;
    const MIRROR_BOTTOM = 650;
    const BASE_Y = 580;
    const SCALE = 18;              // 1 cm = 18 個世界單位
    const EYE = { x: 160, y: 310 };
    const DIM_Y = 690;
    const PULSE_SPEED = 260;       // 世界單位／秒

    // ======================================================================
    // 這一頁的狀態（純資料）
    // ======================================================================

    function stateFor(panel) {
        const u = panel && panel.u != null ? panel.u : 10;
        const h = panel && panel.h != null ? panel.h : 7;
        return OpticsKit.planeMirrorGeometry({
            mirrorX: MIRROR_X,
            baseY: BASE_Y,
            cmPerUnit: SCALE,
            u, h,
            eye: EYE,
            objectSide: -1,
        });
    }

    /** 兩條距離尺標的資料。標籤一上一下，理由見檔頭。 */
    function dimensionMarks(state) {
        return {
            u: {
                x1: state.object.base.x, x2: MIRROR_X, y: DIM_Y,
                label: `u = ${state.u.toFixed(1)} cm`, labelDy: -30,
            },
            v: {
                x1: MIRROR_X, x2: state.image.base.x, y: DIM_Y,
                label: `v = ${state.imageDistanceCm.toFixed(1)} cm`, labelDy: 32,
            },
        };
    }

    /**
     * 物與像的標籤位置：物在箭頭左側、像在箭頭右側，垂直置中。
     *
     * ⚠️ 不能放在「頂端上方」——眼睛比物的頂端高的時候（預設就是），
     *    反射光線會從物頂上方斜穿過去。u = 4、h = 10 時，反射線在
     *    x = 408 的 y 是 367，而「物」的徽章中心正好在 y = 370：整個字
     *    壓在光線上，而 `errs=0`、卡片全對。放在側面就沒有這個問題。
     */
    function objectLabel(state) {
        return {
            x: state.object.top.x - 34,
            y: (state.object.top.y + state.object.base.y) / 2,
            align: 'right', text: '物',
        };
    }

    function imageLabel(state) {
        return {
            x: state.image.top.x + 34,
            y: (state.image.top.y + state.image.base.y) / 2,
            align: 'left', text: '虛像',
        };
    }

    /** 第 i 條光線上的脈衝位置。兩條光線錯開半個週期，才不會同步得死板。 */
    function pulsePoint(state, t, i) {
        const ray = state.rays[i] || state.rays[0];
        if (!ray || !(ray.totalLen > 0)) return null;
        let s = (t * PULSE_SPEED + i * 0.5 * ray.totalLen) % ray.totalLen;
        if (s < 0) s += ray.totalLen;
        return OpticsKit.rayPointAt(ray, s);
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;

        // 鏡面
        OS.drawMirrorV(p, view, MIRROR_X, MIRROR_TOP, MIRROR_BOTTOM);

        // 物像連線（底端）：一條水平虛線，與鏡面垂直
        OS.dashed(p, view, state.object.base, state.image.base, OS.C_DIM,
                  { w: 1.3 });
        OS.drawRightAngle(p, view, MIRROR_X, BASE_Y, -1, -1, 15, OS.C_DIM);

        // 距離尺標（在場景下方，最後畫也壓不到東西）
        const dm = dimensionMarks(state);
        OS.drawDimensionH(p, view, dm.u.x1, dm.u.x2, dm.u.y, dm.u.label,
                          OS.C_DIM, { extY: BASE_Y, labelDy: dm.u.labelDy });
        OS.drawDimensionH(p, view, dm.v.x1, dm.v.x2, dm.v.y, dm.v.label,
                          OS.C_DIM, { extY: BASE_Y, labelDy: dm.v.labelDy });

        // 反射光線的反向延長線（虛線）——它們交於像點
        for (const ray of state.rays) {
            OS.dashed(p, view, ray.imagePoint, ray.mirrorPoint, OS.C_RAY_SOFT,
                      { w: 1.6 });
        }

        // 虛像（紫色虛線箭頭）
        OS.drawVerticalArrow(p, view, state.image.base, state.image.top,
                             OS.C_IMG, { dash: [9, 7], w: 3.5, head: 12 });

        // 入射與反射光線（黃色實線，箭頭指向光的前進方向）
        for (const ray of state.rays) {
            OS.line(p, view, ray.objectPoint, ray.mirrorPoint, OS.C_RAY,
                    { w: 2.8, arrowAt: 0.55, head: 11 });
            OS.line(p, view, ray.mirrorPoint, ray.eye, OS.C_RAY,
                    { w: 2.8, arrowAt: 0.55, head: 11 });
        }

        // 物（藍色實線箭頭）
        OS.drawVerticalArrow(p, view, state.object.base, state.object.top,
                             OS.C_OBJ, { w: 4, head: 13 });

        // 鏡面上的兩個反射點
        for (const ray of state.rays) {
            OS.drawDot(p, view, ray.mirrorPoint.x, ray.mirrorPoint.y,
                       OS.C_RAY, 7);
        }

        // 眼睛
        OS.drawEye(p, view, state.eye.x, state.eye.y, { label: '眼' });

        // 標籤
        const ol = objectLabel(state), il = imageLabel(state);
        OS.worldBadge(p, view, ol.x, ol.y, ol.text,
                      { size: 13, col: OS.C_OBJ, align: ol.align });
        OS.worldBadge(p, view, il.x, il.y, il.text,
                      { size: 13, col: OS.C_IMG, align: il.align });
        OS.worldBadge(p, view, MIRROR_X + 28, 84, '平面鏡',
                      { size: 13, col: OS.C_NORMAL, align: 'left' });

        // 光脈衝
        if (panel.started) {
            for (let i = 0; i < state.rays.length; i++) {
                const q = pulsePoint(state, t, i);
                if (q) OS.drawPulse(p, view, q.x, q.y, OS.C_RAY, { r: 9 });
            }
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight) => ({ label, id, unit, highlight });

    OpticsScene.run({
        formula: "u = v,\\quad h' = h",
        formulaFallback: "u = v，h′ = h",

        controls: {
            sliders: [
                { key: 'u', label: '物距 u', def: 10, min: 4, max: 15,
                  step: 0.5, unit: 'cm', dec: 1 },
                { key: 'h', label: '物高 h', def: 7, min: 3, max: 10,
                  step: 0.5, unit: 'cm', dec: 1 },
            ],
        },

        cards: [
            CARD('物距 u', 'cardU', 'cm', true),
            CARD('像距 v', 'cardV', 'cm', true),
            CARD('物高 h', 'cardH', 'cm'),
            CARD('像高 h′', 'cardHp', 'cm'),
            CARD('放大率 M', 'cardM', ''),
            CARD('物像連線與鏡面夾角', 'cardAxis', '°'),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, sol) {
            const g = sol;
            return {
                cardU: g.u.toFixed(1),
                cardV: g.imageDistanceCm.toFixed(1),
                cardH: g.h.toFixed(1),
                cardHp: (g.imageHeightUnits / g.scale).toFixed(1),
                cardM: g.magnification.toFixed(2),
                cardAxis: g.axisAngleDeg.toFixed(0),
            };
        },

        titleText(t, panel, sol) {
            return `平面鏡成像　u = v = ${sol.imageDistanceCm.toFixed(1)} cm`
                 + `　h′ = h = ${(sol.imageHeightUnits / sol.scale).toFixed(1)} cm`
                 + '　（虛像在鏡後）';
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
            MIRROR_X, MIRROR_TOP, MIRROR_BOTTOM, BASE_Y, SCALE, EYE,
            DIM_Y, PULSE_SPEED,
            stateFor, dimensionMarks, objectLabel, imageLabel, pulsePoint,
            drawScene,
        };
    }
})();
