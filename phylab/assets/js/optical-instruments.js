/**
 * 🔬 光學儀器（顯微鏡／開普勒望遠鏡）
 *
 * 這一頁把「兩片凸透鏡」接起來：第一片（物鏡）先把物體成像，第二片
 * （目鏡）再把那個像當成物體，當成放大鏡使用。兩次成像都遵守
 * 1/u + 1/v = 1/f，但兩次的物距、焦距與像的性質不同，所以分開算。
 *
 * ==========================================================================
 * ⚠️ 這一頁的公式與符號沿用薄透鏡那一頁
 * ==========================================================================
 * u 取正；v > 0 是實像（透鏡後），v < 0 是虛像（透鏡前）；
 * f > 0 是凸透鏡；M = −v/u。物鏡的像 A′B′ 是目鏡的物，所以目鏡的
 * 物距是 u₂ = 目鏡位置 − A′B′ 的位置。
 *
 * 顯微鏡：物在物鏡的 f₁ 與 2f₁ 之間 → A′B′ 放大、倒立、實像；
 *         A′B′ 落在目鏡焦距內（u₂ < f₂）→ A″B″ 放大、虛像。
 * 望遠鏡：物在遠處，平行光經物鏡後在焦平面成倒立、縮小的實像 A′B′；
 *         A′B′ 落在目鏡焦距內 → A″B″ 放大、虛像。視角放大率在目鏡處
 *         量，是 f₁/u₂（u₂ = 0.7 f₂），不是理想值 f₁/f₂——後者要虛像
 *         在無限遠才成立。
 *
 * ==========================================================================
 * ⚠️ 「正立」是相對的：目鏡把 A′B′ 放大成正立的虛像
 * ==========================================================================
 * 目鏡是放大鏡，它成的虛像與 A′B′ 同方向。可是 A′B′ 本身已經相對原物
 * 倒立，所以 A″B″ 相對原物仍然是倒立。畫面把 A′B′ 與 A″B″ 都畫在軸的
 * 下方，讓這件事一眼看得出來；卡片寫「相對原物倒立」。
 *
 * ==========================================================================
 * ⚠️ 光線是連續的，不是兩段各自作圖
 * ==========================================================================
 * 物鏡的兩條作圖光線（平行主軸、過鏡心）在 A′B′ 相交後繼續前進，
 * 打到目鏡上；目鏡再把這兩條光線折射出去。虛像的反向延長線從目鏡上的
 * 入射點往左拉回 A″B″，所以四条線段（物→物鏡、物鏡→目鏡、目鏡→右、
 * 目鏡→虛像）全部共用同一組端點。這樣「像在哪裡」和「光從哪裡來」
 * 才不會各說各話。
 */

(function () {
    'use strict';

    const AXIS_Y = 440;
    const SCALE = 20;              // 1 cm = 20 個世界單位
    const SCENE_RECT = { x0: 38, y0: 40, x1: 884, y1: 780 };
    const X_START = 70;            // 望遠鏡平行光的起點
    const X_END = 824;             // 出射光線的右端（眼睛之前）
    const PULSE_SPEED = 320;       // 世界單位／秒
    const LEGEND = { x: 56, y: 62, gap: 31 };
    const LENS_LABEL_Y = 252;

    const MICRO_X_OBJ = 360;       // 物鏡
    const MICRO_X_EYE = 680;       // 目鏡
    const MICRO_F_OBJ = 2.5;       // 物鏡焦距（短）
    const MICRO_H = 1.0;           // 物高（cm）
    const MICRO_HALF_H = 120;      // 兩片透鏡的孔徑半高

    const TELE_X_OBJ = 280;
    const TELE_THETA_DEG = 6;      // 遠處物體對應的入射角
    const TELE_INSIDE = 0.7;       // A′B′ 落在目鏡焦距內 0.7 f₂ 處
    const TELE_HALF_H = 110;

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    function pathLength(segments) {
        let sum = 0;
        for (const s of segments) {
            sum += Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
        }
        return sum;
    }

    /** 沿著折線走 s 個世界單位，回傳所在點。 */
    function pointOnSegments(segments, s) {
        let remain = s;
        for (const seg of segments) {
            const dx = seg.b.x - seg.a.x;
            const dy = seg.b.y - seg.a.y;
            const len = Math.hypot(dx, dy);
            if (len <= 1e-9) continue;
            if (remain <= len) {
                const t = remain / len;
                return { x: seg.a.x + dx * t, y: seg.a.y + dy * t };
            }
            remain -= len;
        }
        const last = segments[segments.length - 1];
        return last ? { x: last.b.x, y: last.b.y } : null;
    }

    /**
     * 把「入射段 ＋ 透鏡後段」接成一條光線，再從目鏡上的入射點往右
     * 畫到 X_END。虛像在左邊，所以出射光線的方向是「遠離虛像」。
     */
    function makeRay(tag, incoming, objective, finalPoint, endX) {
        const hitEye = objective.b;
        const dx = hitEye.x - finalPoint.x;
        const dy = hitEye.y - finalPoint.y;
        const t = dx > 1e-9 ? (endX - hitEye.x) / dx : 0;
        const end = { x: endX, y: hitEye.y + dy * t };
        const segments = [
            { a: incoming.a, b: incoming.b },
            { a: objective.a, b: objective.b },
            { a: hitEye, b: end },
        ];
        return {
            tag,
            incoming: [incoming.a, incoming.b],
            objective: [objective.a, objective.b],
            eye: [hitEye, end],
            extension: [hitEye, finalPoint],
            hitEye, end, finalPoint,
            segments,
            totalLen: pathLength(segments),
        };
    }

    // ======================================================================
    // 顯微鏡
    // ======================================================================

    function microscopeState(panel) {
        const u = clamp(num(panel.u, 3.4), 3.1, 3.5);
        const fEye = clamp(num(panel.fEyeMicro, 12), 10, 14);
        const fObj = MICRO_F_OBJ;
        const h = MICRO_H;

        // 物鏡：物在 f₁ 與 2f₁ 之間，成放大倒立實像。
        const v1 = u * fObj / (u - fObj);
        const M1 = -v1 / u;
        const xI = MICRO_X_OBJ + v1 * SCALE;
        const hI = M1 * h;
        const yI = AXIS_Y - hI * SCALE;

        // 目鏡：A′B′ 是它的物，落在焦距內，成放大虛像。
        const u2 = (MICRO_X_EYE - xI) / SCALE;
        const v2 = u2 * fEye / (u2 - fEye);
        const M2 = -v2 / u2;
        const xFinal = MICRO_X_EYE + v2 * SCALE;
        const hFinal = M2 * hI;
        const yFinal = AXIS_Y - hFinal * SCALE;

        const yObjTop = AXIS_Y - h * SCALE;
        const objTop = { x: MICRO_X_OBJ - u * SCALE, y: yObjTop };
        const objBase = { x: objTop.x, y: AXIS_Y };
        const fObjRight = { x: MICRO_X_OBJ + fObj * SCALE, y: AXIS_Y };
        const lensAim = { x: MICRO_X_OBJ, y: yObjTop };
        const lensCenter = { x: MICRO_X_OBJ, y: AXIS_Y };

        // 平行主軸的光線：物頂 → 物鏡 → 過 F₁′。
        const slopeA = (AXIS_Y - yObjTop) / (fObj * SCALE);
        const hitA = {
            x: MICRO_X_EYE,
            y: AXIS_Y + slopeA * (MICRO_X_EYE - fObjRight.x),
        };
        // 過鏡心的光線：方向不變。
        const slopeB = (AXIS_Y - yObjTop) / (u * SCALE);
        const hitB = {
            x: MICRO_X_EYE,
            y: AXIS_Y + slopeB * (MICRO_X_EYE - MICRO_X_OBJ),
        };

        const finalPoint = { x: xFinal, y: yFinal };
        const rayA = makeRay('A', { a: objTop, b: lensAim },
                             { a: lensAim, b: hitA }, finalPoint, X_END);
        const rayB = makeRay('B', { a: objTop, b: lensCenter },
                             { a: lensCenter, b: hitB }, finalPoint, X_END);

        return {
            instrument: 'microscope',
            label: '顯微鏡',
            xObj: MICRO_X_OBJ,
            xEye: MICRO_X_EYE,
            xI, xFinal, yI, yFinal,
            fObj, fEye, u, h, v1, v2, u2,
            M1, M2, Mtotal: M1 * M2,
            objHalfH: MICRO_HALF_H, eyeHalfH: MICRO_HALF_H,
            object: { base: objBase, top: objTop },
            intermediate: {
                base: { x: xI, y: AXIS_Y },
                top: { x: xI, y: yI },
                real: true,
            },
            final: {
                base: { x: xFinal, y: AXIS_Y },
                top: { x: xFinal, y: yFinal },
                real: false,
            },
            intermediatePoint: { x: xI, y: yI },
            rays: [rayA, rayB],
        };
    }

    // ======================================================================
    // 開普勒望遠鏡
    // ======================================================================

    function telescopeState(panel) {
        const fObj = clamp(num(panel.fObjTele, 10), 8, 12);
        const fEye = clamp(num(panel.fEyeTele, 3), 2, 4);
        const theta = TELE_THETA_DEG * Math.PI / 180;
        const tanTheta = Math.tan(theta);

        // 遠處物體：平行光經物鏡後在焦平面交會。
        const xI = TELE_X_OBJ + fObj * SCALE;
        const yI = AXIS_Y + fObj * SCALE * tanTheta;
        const xEye = xI + TELE_INSIDE * fEye * SCALE;
        const u2 = (xEye - xI) / SCALE;
        const v2 = u2 * fEye / (u2 - fEye);
        const M2 = -v2 / u2;
        const xFinal = xEye + v2 * SCALE;
        const hI = -(yI - AXIS_Y) / SCALE;
        const hFinal = M2 * hI;
        const yFinal = AXIS_Y - hFinal * SCALE;

        const finalPoint = { x: xFinal, y: yFinal };
        const lensHeights = [AXIS_Y - 80, AXIS_Y - 30];
        const rays = lensHeights.map((yLens, i) => {
            const start = {
                x: X_START,
                y: yLens - tanTheta * (TELE_X_OBJ - X_START),
            };
            const lensPoint = { x: TELE_X_OBJ, y: yLens };
            const t = (xEye - TELE_X_OBJ) / (xI - TELE_X_OBJ);
            const hitEye = {
                x: xEye,
                y: yLens + (yI - yLens) * t,
            };
            return makeRay(String.fromCharCode(65 + i),
                           { a: start, b: lensPoint },
                           { a: lensPoint, b: hitEye },
                           finalPoint, X_END);
        });

        return {
            instrument: 'telescope',
            label: '開普勒望遠鏡',
            xObj: TELE_X_OBJ,
            xEye,
            xI, xFinal, yI, yFinal,
            fObj, fEye,
            u: Infinity,
            h: null,
            v1: fObj,
            v2, u2,
            M1: null,
            M2,
            // 視角放大率在目鏡處量：A′B′ 在 0.7 f₂，所以虛像在目鏡左邊
            // |v₂| = 2.33 f₂ 處，張角 = |h″|/|v₂| = f₁ tanθ / u₂。
            // 課本的 f₁/f₂ 是「虛像在無限遠」的理想值；這一頁把虛像畫
            // 出來，所以卡片要用實際值，並在標題註明 u₂ = 0.7 f₂。
            angularM: fObj / u2,
            angularMIdeal: fObj / fEye,
            objHalfH: TELE_HALF_H, eyeHalfH: TELE_HALF_H,
            object: null,
            intermediate: {
                base: { x: xI, y: AXIS_Y },
                top: { x: xI, y: yI },
                real: true,
            },
            final: {
                base: { x: xFinal, y: AXIS_Y },
                top: { x: xFinal, y: yFinal },
                real: false,
            },
            intermediatePoint: { x: xI, y: yI },
            rays,
        };
    }

    function stateFor(panel) {
        panel = panel || {};
        return panel.instrument === 'telescope'
            ? telescopeState(panel)
            : microscopeState(panel);
    }

    // ======================================================================
    // 卡片、標題與圖例
    // ======================================================================

    function cardValues(st) {
        if (st.instrument === 'microscope') {
            return {
                cardInstrument: '顯微鏡',
                cardU: st.u.toFixed(1),
                cardFObj: st.fObj.toFixed(1),
                cardFEye: st.fEye.toFixed(1),
                cardV1: st.v1.toFixed(1),
                cardM: `×${Math.abs(st.Mtotal).toFixed(1)}`,
                cardNature: '倒立、放大虛像',
            };
        }
        return {
            cardInstrument: '開普勒望遠鏡',
            cardU: '∞',
            cardFObj: st.fObj.toFixed(1),
            cardFEye: st.fEye.toFixed(1),
            cardV1: st.v1.toFixed(1),
            cardAngular: `×${st.angularM.toFixed(1)}`,
            cardNature: '倒立、放大虛像',
        };
    }

    function titleTextOf(st) {
        if (st.instrument === 'microscope') {
            return `顯微鏡　f₁ = ${st.fObj.toFixed(1)} cm、`
                 + `f₂ = ${st.fEye.toFixed(1)} cm　`
                 + `總放大率 ×${Math.abs(st.Mtotal).toFixed(1)}`;
        }
        return `開普勒望遠鏡　f₁ = ${st.fObj.toFixed(1)} cm、`
             + `f₂ = ${st.fEye.toFixed(1)} cm　`
             + `視角放大率 ×${st.angularM.toFixed(1)}`
             + `（A′B′ 在 ${TELE_INSIDE} f₂）`;
    }

    /** 左上角圖例。顏色用 OpticsScene 的常數名稱，畫的時候才對應。 */
    function legendRows(st) {
        const micro = st.instrument === 'microscope';
        return [
            {
                text: micro ? '顯微鏡：物鏡 f₁ 短、目鏡 f₂ 長'
                            : '開普勒望遠鏡：物鏡 f₁ 長、目鏡 f₂ 短',
                col: 'C_NORMAL',
            },
            {
                text: micro ? '物鏡：倒立、放大實像（像投影機）'
                            : '物鏡：倒立、縮小實像（像照相機）',
                col: 'C_OBJ',
            },
            {
                text: '目鏡：正立、放大虛像（像放大鏡）',
                col: 'C_IMG',
            },
            {
                text: '最終像相對原物倒立',
                col: 'C_IMG',
            },
            {
                text: '紫色：A′B′ 實像、A″B″ 虛像',
                col: 'C_IMG',
            },
            {
                text: '示範圖，比例已放大',
                col: 'C_DIM',
            },
        ];
    }

    /**
     * 兩個像的標籤位置。
     *
     * 只寫「A′B′」「A″B″」——「中間像／虛像」交給左上角圖例。兩個像在
     * 某些參數下只差 17 個世界單位，長標籤會互相蓋住，其中一條的箭頭
     * 也會從另一張標籤中間穿過去。標籤貼在箭頭尖端下方，往遠離另一條
     * 箭頭的一側放；顯微鏡與望遠鏡的目鏡位置不同，所以兩頁的左右相反：
     *
     *   顯微鏡：A′B′ 在右、A″B″ 在左（A′B′ 右邊留給目鏡的空間夠）
     *   望遠鏡：A′B′ 在左、A″B″ 在右（A′B′ 右邊就是目鏡，放左邊才不壓鏡）
     */
    function imageLabelAnchors(st) {
        const micro = st.instrument === 'microscope';
        const gap = micro ? 12 : 18;
        return {
            intermediate: {
                text: 'A′B′',
                x: micro ? st.xI + gap : st.xI - gap,
                y: st.yI + 24,
                align: micro ? 'left' : 'right',
            },
            final: {
                text: 'A″B″',
                x: micro ? st.xFinal - gap : st.xFinal + gap,
                y: st.yFinal + 38,
                align: micro ? 'right' : 'left',
            },
        };
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;

        // 主軸
        OS.dashed(p, view, { x: 60, y: AXIS_Y }, { x: 860, y: AXIS_Y },
                  OS.C_NORMAL, { w: 1.3 });
        OS.worldBadge(p, view, 64, AXIS_Y - 18, '主軸',
                      { size: 12, col: OS.C_NORMAL, align: 'left' });

        // 兩片凸透鏡（先畫，光線疊上去）
        OS.drawThinLens(p, view, state.xObj, AXIS_Y, state.objHalfH, 'convex',
                        { halfW: 20 });
        OS.drawThinLens(p, view, state.xEye, AXIS_Y, state.eyeHalfH, 'convex',
                        { halfW: 20 });
        OS.worldBadge(p, view, state.xObj, LENS_LABEL_Y, '物鏡',
                      { size: 13, col: OS.C_NORMAL, align: 'center' });
        OS.worldBadge(p, view, state.xEye, LENS_LABEL_Y, '目鏡',
                      { size: 13, col: OS.C_NORMAL, align: 'center' });
        OS.worldBadge(p, view, state.xObj, 286,
                      `f₁ = ${state.fObj.toFixed(1)} cm`,
                      { size: 11, col: OS.C_DIM, align: 'center' });
        OS.worldBadge(p, view, state.xEye, 286,
                      `f₂ = ${state.fEye.toFixed(1)} cm`,
                      { size: 11, col: OS.C_DIM, align: 'center' });

        // 光線：入射 → 物鏡 → 目鏡 → 出射；虛線拉回虛像。
        for (const ray of state.rays) {
            OS.line(p, view, ray.incoming[0], ray.incoming[1], OS.C_RAY,
                    { w: 2.6, arrowAt: 0.55, head: 10 });
            OS.line(p, view, ray.objective[0], ray.objective[1], OS.C_RAY,
                    { w: 2.6, arrowAt: 0.55, head: 10 });
            OS.line(p, view, ray.eye[0], ray.eye[1], OS.C_RAY,
                    { w: 2.6, arrowAt: 0.55, head: 10 });
            OS.dashed(p, view, ray.extension[0], ray.extension[1],
                      OS.C_RAY_SOFT, { w: 1.5 });
            OS.drawDot(p, view, ray.objective[0].x, ray.objective[0].y,
                       OS.C_RAY, 5);
            OS.drawDot(p, view, ray.hitEye.x, ray.hitEye.y, OS.C_RAY, 5);
        }

        // 物（只有顯微鏡有實際的物）
        if (state.object) {
            OS.drawVerticalArrow(p, view, state.object.base, state.object.top,
                                 OS.C_OBJ, { w: 4, head: 13 });
            OS.worldBadge(p, view, state.object.top.x - 14,
                          state.object.top.y - 18, '物 AB',
                          { size: 12, col: OS.C_OBJ, align: 'right' });
        }

        // 中間像 A′B′：實像，實線。
        OS.drawVerticalArrow(p, view, state.intermediate.base,
                             state.intermediate.top, OS.C_IMG,
                             { w: 3.2, head: 11 });
        // 最終像 A″B″：虛像，虛線。
        OS.drawVerticalArrow(p, view, state.final.base, state.final.top,
                             OS.C_IMG, { dash: [9, 7], w: 4, head: 13 });

        // 兩張標籤：短字＋左右錯開，避免其中一條箭頭穿過另一張標籤。
        const marks = imageLabelAnchors(state);
        for (const key of ['intermediate', 'final']) {
            const m = marks[key];
            OS.worldBadge(p, view, m.x, m.y, m.text,
                          { size: 11, col: OS.C_IMG, align: m.align });
        }

        // 望遠鏡的入射光是平行光，沒有實際的物箭頭。
        if (state.instrument === 'telescope') {
            OS.worldBadge(p, view, X_START + 8, 310,
                          '平行光（來自遠處物體）',
                          { size: 12, col: OS.C_NORMAL, align: 'left' });
        }

        // 左上角圖例
        for (let i = 0; i < legendRows(state).length; i++) {
            const row = legendRows(state)[i];
            OS.worldBadge(p, view, LEGEND.x, LEGEND.y + i * LEGEND.gap,
                          row.text,
                          { size: 12, col: OS[row.col], align: 'left' });
        }

        // 光脈衝
        if (panel && panel.started) {
            for (let i = 0; i < state.rays.length; i++) {
                const q = pulsePoint(state, t, i);
                if (q) OS.drawPulse(p, view, q.x, q.y, OS.C_RAY, { r: 9 });
            }
        }
    }

    function pulsePoint(state, t, i) {
        const ray = state.rays[i] || state.rays[0];
        if (!ray || !(ray.totalLen > 0)) return null;
        let s = (t * PULSE_SPEED + i * 0.5 * ray.totalLen) % ray.totalLen;
        if (s < 0) s += ray.totalLen;
        return pointOnSegments(ray.segments, s);
    }

    // ======================================================================
    // 頁面
    // ======================================================================

    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });

    OpticsScene.run({
        formula: '\\frac{1}{u}+\\frac{1}{v}=\\frac{1}{f}',
        formulaFallback: '1/u + 1/v = 1/f',

        controls: {
            selects: [{
                key: 'instrument', label: '光學儀器', def: 'microscope',
                live: true,
                options: [
                    { v: 'microscope', t: '顯微鏡' },
                    { v: 'telescope', t: '開普勒望遠鏡' },
                ],
            }],
            sliders: [
                { key: 'u', label: '物距 u₁', def: 3.4, min: 3.1, max: 3.5,
                  step: 0.1, unit: 'cm', dec: 1,
                  when: p => p.instrument !== 'telescope' },
                { key: 'fEyeMicro', label: '目鏡焦距 f₂', def: 12,
                  min: 10, max: 14, step: 1, unit: 'cm', dec: 1,
                  when: p => p.instrument !== 'telescope' },
                { key: 'fObjTele', label: '物鏡焦距 f₁', def: 10,
                  min: 8, max: 12, step: 1, unit: 'cm', dec: 1,
                  when: p => p.instrument === 'telescope' },
                { key: 'fEyeTele', label: '目鏡焦距 f₂', def: 3,
                  min: 2, max: 4, step: 1, unit: 'cm', dec: 1,
                  when: p => p.instrument === 'telescope' },
            ],
        },

        cards: [
            CARD('儀器', 'cardInstrument', ''),
            CARD('物距 u₁', 'cardU', 'cm'),
            CARD('物鏡焦距 f₁', 'cardFObj', 'cm', true),
            CARD('目鏡焦距 f₂', 'cardFEye', 'cm', true),
            CARD('中間像位置 v₁', 'cardV1', 'cm'),
            CARD('總放大率', 'cardM', '', false,
                 p => p.instrument === 'microscope'),
            CARD('視角放大率', 'cardAngular', '', false,
                 p => p.instrument === 'telescope'),
            CARD('最終像（相對原物）', 'cardNature', ''),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            return cardValues(g);
        },

        titleText(t, panel, g) {
            return titleTextOf(g);
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
            AXIS_Y, SCALE, SCENE_RECT, X_START, X_END,
            PULSE_SPEED, LEGEND, LENS_LABEL_Y,
            MICRO_X_OBJ, MICRO_X_EYE, MICRO_F_OBJ, MICRO_H, MICRO_HALF_H,
            TELE_X_OBJ, TELE_THETA_DEG, TELE_INSIDE, TELE_HALF_H,
            microscopeState, telescopeState, stateFor,
            cardValues, titleTextOf, legendRows, imageLabelAnchors, pulsePoint,
            pointOnSegments, drawScene,
        };
    }
})();
