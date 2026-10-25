/**
 * 💧 光的折射與折射定律
 *
 * 這一頁把「光從一種介質進入另一種介質」變成可以動的實驗：拖動兩層介質的
 * 折射率與入射角，看折射光線怎麼偏折。入射光線、折射光線、法線、兩個角度
 * 弧、介質標籤與右側六張卡片全部來自 `OpticsKit.refractionGeometry()`——
 * 畫面和數字沒有第二份真相。
 *
 * ==========================================================================
 * ⚠️ n₁、n₂ 跟著光線的角色，不跟著畫面上下
 * ==========================================================================
 * 介質 1 是**入射介質**、介質 2 是**折射介質**，和教材的 θ₁、θ₂ 一致。
 * 把「光的方向」切到由下方射入時，介質 1 的區域、標籤與 n₁ 一起搬到介面
 * 下方；介質 2 搬到上方。如果把 n₁ 固定成「上方介質」，切換方向之後
 * 「n₁ 是入射介質」這句話就不成立了，卡片上的相對折射率也會跟著失去意義。
 *
 * ==========================================================================
 * ⚠️ 這一頁的入射角上限是 40°
 * ==========================================================================
 * 滑桿的 n₁、n₂ 都在 1.00～1.50 之間，θ₁ 上限 40° 時
 * n₁ sin θ₁ ≤ 1.50 × sin 40° = 0.964 < n₂，所以每一次都有折射光線，
 * 不會走進全反射。全反射需要另一組教學重點（臨界角、光密到光疏），
 * 不在這一頁混進來。
 *
 * ==========================================================================
 * ⚠️ 角度數字住在左上角的固定圖例
 * ==========================================================================
 * 和反射定律那一頁同一個理由：角度小的時候，角平分線會貼著法線；
 * 角度大的時候，往角外側挪又會掉出畫面。任何「半徑 × 角度」的連續公式
 * 都會在某一端失效。所以 θ₁、θ₂ 的數值固定在左上角，用顏色對應兩條弧。
 */

(function () {
    'use strict';

    const O = { x: 450, y: 470 };
    const LEN = 330;
    const INTERFACE = { x1: 70, x2: 830, y: 470 };
    const NORMAL_TOP = 52;
    const NORMAL_BOT = 782;
    const ARC_R = 118;
    const LEGEND_X = 64;                 // 左上角圖例（見檔頭）
    const LEGEND_Y = { incident: 78, refracted: 126 };
    const RAY_LABEL_F = 0.78;            // 光線名稱放在 78% 的位置
    // 介質標籤放在光線掃不到的兩個角落：上層右上、下層左下。
    // 直覺上「兩顆都靠右」最整齊，但折射線在 θ₂ 小的時候會一路走到
    // 右下角（Q 的 y 可以到 768），右下那顆標籤一定被穿過。
    const MEDIUM_LABEL_X = { top: 862, bottom: 88 };
    const MEDIUM_LABEL_Y = { top: 56, bottom: 760 };
    // n = 1 時的光脈衝速度（世界單位／秒）。介質內速度 = PULSE_SPEED / n，
    // 所以脈衝進入較密的介質會慢下來——右側兩張「光速 v₁／v₂」卡片講的
    // 就是這件事，畫面不能讓脈衝用同一個速度穿過兩個介面。
    const PULSE_SPEED = 250;

    const DEG = Math.PI / 180;

    // ======================================================================
    // 這一頁的狀態（純資料，Node 餵得進來）
    // ======================================================================

    /**
     * @param {object} panel  { n1, n2, theta, dir }
     * @returns {object} state
     *   g         OpticsKit.refractionGeometry() 的結果
     *   fromTop   true = 光由上方介質射入
     */
    function stateFor(panel) {
        panel = panel || {};
        const n1 = panel.n1 == null ? 1.00 : panel.n1;
        const n2 = panel.n2 == null ? 1.50 : panel.n2;
        const theta = panel.theta == null ? 40 : panel.theta;
        const fromTop = panel.dir !== 'bottom';
        const g = OpticsKit.refractionGeometry(theta, {
            O, n1, n2,
            from: fromTop ? 'top' : 'bottom',
            len1: LEN, len2: LEN,
        });
        return { g, fromTop };
    }

    /** 某一個角（incident／refracted）的弧與圖例文字。 */
    function angleMark(state, which) {
        const g = state.g;
        const end = which === 'incident' ? g.P : g.Q;
        const normalAngle = which === 'incident'
            ? (g.fromTop ? -Math.PI / 2 : Math.PI / 2)
            : (g.fromTop ? Math.PI / 2 : -Math.PI / 2);
        const rayAngle = Math.atan2(end.y - O.y, end.x - O.x);
        const theta = which === 'incident' ? g.theta1Deg : g.theta2Deg;
        return {
            rayAngle,
            normalAngle,
            arc: {
                a0: Math.min(rayAngle, normalAngle),
                a1: Math.max(rayAngle, normalAngle),
            },
            text: (which === 'incident' ? 'θ₁ = ' : 'θ₂ = ')
                + theta.toFixed(1) + '°',
        };
    }

    /** 圖例的位置：固定在世界座標，和角度、方向都無關（理由見檔頭）。 */
    function legendAnchor(which) {
        return { x: LEGEND_X, y: LEGEND_Y[which], align: 'left' };
    }

    /** 介質區域標籤：頁面依光線角色選介質 1 或介質 2。 */
    function mediumLabel(state, which) {
        const g = state.g;
        const side = which === 'incident'
            ? g.incidentMediumSide : g.refractedMediumSide;
        const n = which === 'incident' ? g.n1 : g.n2;
        return {
            x: MEDIUM_LABEL_X[side],
            y: MEDIUM_LABEL_Y[side],
            side,
            align: side === 'top' ? 'right' : 'left',
            // 標籤只寫「介質 1／2」與折射率。入射／折射的角色由卡片上的
            // 「入射介質 n₁」「折射介質 n₂」與光線名稱負責；把角色也塞進
            // 這一顆標籤，會讓它在窄畫面變得太寬、伸進下層的光線裡。
            text: (which === 'incident' ? '介質 1' : '介質 2')
                + '　' + (which === 'incident' ? 'n₁' : 'n₂')
                + ' = ' + n.toFixed(2),
        };
    }

    /** 光線名稱的錨點：沿著光線 78% 處，往遠離法線的方向推 16 個單位。 */
    function rayLabelAnchor(state, which) {
        const g = state.g;
        const a = which === 'incident' ? g.P : O;
        const b = which === 'incident' ? O : g.Q;
        const pt = OpticsKit.lerp(a, b, RAY_LABEL_F);
        const side = which === 'incident' ? g.incidentSide : g.refractedSide;
        return {
            x: pt.x + side * 16,
            y: pt.y,
            align: side < 0 ? 'right' : 'left',
            text: which === 'incident' ? '入射光線' : '折射光線',
        };
    }

    /** 脈衝走完入射段＋折射段所需的時間（兩段速度不同）。 */
    function travelTimeFor(g) {
        const len2 = g.tir ? 0 : g.len2;
        return g.len1 * g.n1 / PULSE_SPEED + len2 * g.n2 / PULSE_SPEED;
    }

    /** 光脈衝在這一刻的位置。t 從 START 之後開始累積。 */
    function pulsePoint(state, t) {
        const g = state.g;
        const t1 = g.len1 * g.n1 / PULSE_SPEED;   // 入射段（介質 n₁）
        const total = travelTimeFor(g);
        let tt = t % total;
        if (tt < 0) tt += total;
        // 介質內速度 = PULSE_SPEED / n：同一段時間在較密的介質走得更短。
        const phase = tt <= t1
            ? tt * PULSE_SPEED / g.n1
            : g.len1 + (tt - t1) * PULSE_SPEED / g.n2;
        return OpticsKit.refractionPointAt(g, Math.min(phase, g.pathLen));
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const g = state.g;
        const OS = OpticsScene;

        // 兩層介質、介面與法線
        OS.drawInterfaceH(p, view, INTERFACE.x1, INTERFACE.x2, INTERFACE.y);
        OS.drawNormal(p, view, { x: O.x, y: NORMAL_TOP },
                      { x: O.x, y: NORMAL_BOT }, { w: 1.8 });

        // 兩條光線。箭頭方向就是光的行進方向。
        OS.line(p, view, g.P, O, OS.C_RAY, { w: 3, arrowAt: 0.60, head: 12 });
        OS.line(p, view, O, g.Q, OS.C_RAY, { w: 3, arrowAt: 0.55, head: 12 });

        // 兩個角度弧（顏色與右側卡片一致）
        const mkInc = angleMark(state, 'incident');
        const mkRef = angleMark(state, 'refracted');
        OS.drawAngleArc(p, view, O, mkInc.arc.a0, mkInc.arc.a1, ARC_R,
                        OS.C_ANGLE1, null);
        OS.drawAngleArc(p, view, O, mkRef.arc.a0, mkRef.arc.a1, ARC_R,
                        OS.C_ANGLE2, null);

        // 角度圖例（固定在左上角，理由見檔頭）
        const lgInc = legendAnchor('incident');
        const lgRef = legendAnchor('refracted');
        OS.worldBadge(p, view, lgInc.x, lgInc.y, mkInc.text,
                      { size: 14, col: OS.C_ANGLE1, align: lgInc.align });
        OS.worldBadge(p, view, lgRef.x, lgRef.y, mkRef.text,
                      { size: 14, col: OS.C_ANGLE2, align: lgRef.align });

        // 光線名稱
        const li = rayLabelAnchor(state, 'incident');
        const lr = rayLabelAnchor(state, 'refracted');
        OS.worldBadge(p, view, li.x, li.y, li.text,
                      { size: 13, col: OS.C_RAY, align: li.align });
        OS.worldBadge(p, view, lr.x, lr.y, lr.text,
                      { size: 13, col: OS.C_RAY, align: lr.align });

        // 介質標籤：介質 1 永遠是入射介質，介質 2 永遠是折射介質。
        for (const which of ['incident', 'refracted']) {
            const m = mediumLabel(state, which);
            OS.worldBadge(p, view, m.x, m.y, m.text,
                          { size: 13, col: OS.C_LABEL, align: m.align });
        }

        // 法線與介面
        OS.worldBadge(p, view, O.x, 30, '法線',
                      { size: 13, col: OS.C_NORMAL });
        OS.worldBadge(p, view, 88, 438, '介面',
                      { size: 13, col: OS.C_NORMAL, align: 'left' });

        // 入射點
        OS.drawDot(p, view, O.x, O.y, OS.C_NORMAL, 6);

        // 光脈衝（按下 START 才會出現）
        if (panel.started) {
            const q = pulsePoint(state, t);
            OS.drawPulse(p, view, q.x, q.y, OS.C_RAY, { r: 10 });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight) => ({ label, id, unit, highlight });

    OpticsScene.run({
        formula: '\\begin{aligned}'
            + 'n_1\\sin\\theta_1 &= n_2\\sin\\theta_2 \\\\'
            + '\\frac{\\sin\\theta_1}{\\sin\\theta_2} &= \\frac{n_2}{n_1}'
            + '\\end{aligned}',
        formulaFallback: 'n₁ sin θ₁ = n₂ sin θ₂',

        controls: {
            selects: [
                { key: 'dir', label: '光的方向', def: 'top', live: true, options: [
                    { v: 'top', t: '由上方介質射入' },
                    { v: 'bottom', t: '由下方介質射入' },
                ] },
            ],
            sliders: [
                { key: 'n1', label: '入射介質 n₁', def: 1.00, min: 1.00, max: 1.50,
                  step: 0.01, unit: '', dec: 2 },
                { key: 'n2', label: '折射介質 n₂', def: 1.50, min: 1.00, max: 1.50,
                  step: 0.01, unit: '', dec: 2 },
                { key: 'theta', label: '入射角 θ₁', def: 40, min: 0, max: 40,
                  step: 1, unit: '°', dec: 0 },
            ],
        },

        cards: [
            CARD('入射角 θ₁', 'cardTheta1', '°', true),
            CARD('折射角 θ₂', 'cardTheta2', '°', true),
            CARD('n₁ sin θ₁ = n₂ sin θ₂', 'cardSnell', ''),
            CARD('相對折射率 n₂/n₁', 'cardRelative', ''),
            CARD('光速 v₁', 'cardV1', '×10⁸ m/s'),
            CARD('光速 v₂', 'cardV2', '×10⁸ m/s'),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, sol) {
            const g = sol.g;
            return {
                cardTheta1: g.theta1Deg.toFixed(1),
                cardTheta2: g.theta2Deg.toFixed(1),
                cardSnell: (g.n1 * Math.sin(g.theta1Deg * DEG)).toFixed(3),
                cardRelative: g.relativeIndex.toFixed(2),
                cardV1: (g.speed1 / 1e8).toFixed(2),
                cardV2: (g.speed2 / 1e8).toFixed(2),
            };
        },

        titleText(t, panel, sol) {
            const g = sol.g;
            const bend = g.bend === 'toward' ? '折射線偏向法線'
                : g.bend === 'away' ? '折射線偏離法線'
                : '折射線不偏折';
            return `折射定律　θ₁ = ${g.theta1Deg.toFixed(1)}°`
                + ` → θ₂ = ${g.theta2Deg.toFixed(1)}°　${bend}`;
        },

        draw(p, view, t, panel, sol) {
            drawScene(p, view, t, panel, sol);
        },
    });

    // ======================================================================
    // 給驗證器（與自動掃描）的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            O, LEN, INTERFACE, NORMAL_TOP, NORMAL_BOT, ARC_R,
            LEGEND_X, LEGEND_Y, RAY_LABEL_F, MEDIUM_LABEL_X, MEDIUM_LABEL_Y,
            PULSE_SPEED,
            stateFor, angleMark, legendAnchor, mediumLabel, rayLabelAnchor,
            pulsePoint, travelTimeFor, drawScene,
        };
    }
})();
