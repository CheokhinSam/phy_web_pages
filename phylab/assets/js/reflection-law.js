/**
 * 🪞 光的反射定律
 *
 * 這一頁只做一件事：讓「入射角」是可以動的，然後看反射角怎麼跟著它。
 * 入射光線、反射光線、法線、兩個角度弧、右側六張卡片全部來自
 * `OpticsKit.reflectionGeometry()`——畫面與數字沒有第二份真相。
 *
 * ==========================================================================
 * ⚠️ 角度標籤為什麼住在左上角的圖例，而不是貼著角度弧
 * ==========================================================================
 * 兩個角 θ₁、θ₂ 的數值放在左上角，顏色和兩條角度弧一致。這不是排版偏好，
 * 是幾何上沒有更好的位置：
 *
 *   - 貼在角平分線上：θ₁ 很小（甚至 0°）時平分線貼著法線（半徑 240 時離法線
 *     只有約 10 個世界單位），徽章整個壓在虛線法線上；θ₁ = 20° 時平分線又
 *     剛好和光線重合，徽章直接蓋住光線。
 *   - 往角的外側挪：θ₁ 接近 85° 時，外側的位置會掉到鏡面以下（畫面外）。
 *   - 任何「半徑 × 角度」的連續公式都救不了：θ₁ < 2Δ 時，角扇形比徽章還窄，
 *     扇形裡面**不存在**同時離開法線與光線 Δ 的位置。
 *
 * 所以標籤固定在左上角那塊空地（所有角度、兩個方向都碰不到任何線），
 * 用顏色對應弧；卡片上的 θ₁、θ₂ 也還是同一組數字。角度弧本身不掛文字，
 * 拉滑桿時就不會出現「文字壓線」或「文字突然跳邊」這兩種症狀。
 *
 * ==========================================================================
 * ⚠️ 「光路可逆」不是把畫面左右翻過來
 * ==========================================================================
 * 反向模式畫的是**同一組光線**，只把箭頭與脈衝的方向反過來：光從原本的
 * 反射線那一端射入，沿著同一條路徑回到原本的入射線那一端。如果改成把
 * 幾何左右翻轉，學生看到的會是「另一組實驗」，而不是「同一條路徑倒著走」。
 */
(function () {
    'use strict';

    const O = { x: 450, y: 600 };
    const LEN = 360;
    const MIRROR = { x1: 70, x2: 830, y: 600 };
    const NORMAL_TOP = { x: O.x, y: O.y - LEN };
    const ARC_R = 118;
    const LEGEND_X = 56;           // 左上角圖例（見檔頭）
    const LEGEND_Y = { incident: 76, reflected: 124 };
    const RAY_LABEL_F = 0.78;      // 光線名稱放在 78% 的位置
    const PULSE_SPEED = 250;       // 世界單位／秒

    const DEG = Math.PI / 180;

    // ======================================================================
    // 這一頁的狀態（純資料，Node 餵得進來）
    // ======================================================================

    /**
     * @param {object} panel  { theta, dir }
     * @returns {object} state
     *   g         OpticsKit.reflectionGeometry() 的結果
     *   reverse   true = 光從原本的反射線那一端射入
     *   sides     incident / reflected 各在法線的哪一側（−1 左、+1 右）
     *   ends      左端、右端的世界座標
     *   angleFor  side → 從 O 指向該端點的方向角（弧度）
     */
    function stateFor(panel) {
        const theta = panel && panel.theta != null ? panel.theta : 40;
        const reverse = !!(panel && panel.dir === 'reverse');
        const g = OpticsKit.reflectionGeometry(theta, { O, len: LEN });
        const sides = {
            incident: reverse ? 1 : -1,
            reflected: reverse ? -1 : 1,
        };
        const th = g.theta1Deg * DEG;
        return {
            g, reverse, thetaDeg: g.theta1Deg,
            sides,
            ends: { [-1]: g.P, 1: g.Q },
            angleFor: side => -Math.PI / 2 + side * th,
        };
    }

    /** 某一個角（incident／reflected）的弧與圖例文字。 */
    function angleMark(state, which) {
        const side = state.sides[which];
        const a = state.angleFor(side);
        const normal = -Math.PI / 2;
        const arc = side < 0 ? { a0: a, a1: normal } : { a0: normal, a1: a };
        return {
            side, rayAngle: a, arc,
            text: (which === 'incident' ? 'θ₁ = ' : 'θ₂ = ')
                + state.g.theta1Deg.toFixed(0) + '°',
        };
    }

    /** 圖例的位置：固定在世界座標，和角度、方向都無關（理由見檔頭）。 */
    function legendAnchor(which) {
        return { x: LEGEND_X, y: LEGEND_Y[which], align: 'left' };
    }

    /** 光線名稱的錨點：沿著光線 78% 處，往遠離法線的方向推 16 個單位。 */
    function rayLabelAnchor(state, which) {
        const side = state.sides[which];
        const end = state.ends[side];
        const pt = OpticsKit.lerp(O, end, RAY_LABEL_F);
        return {
            x: pt.x + side * 16,
            y: pt.y,
            align: side < 0 ? 'right' : 'left',
            text: which === 'incident' ? '入射光線' : '反射光線',
        };
    }

    /** 光脈衝在這一刻的位置。t 從 START 之後開始累積。 */
    function pulsePoint(state, t) {
        const L = state.g.pathLen;
        let phase = (t * PULSE_SPEED) % L;
        if (phase < 0) phase += L;
        // 正向：P → O → Q；反向：Q → O → P（同一條路徑倒著走）
        const s = state.reverse ? L - phase : phase;
        return OpticsKit.reflectionPointAt(state.g, s);
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const g = state.g;
        const OS = OpticsScene;

        // 鏡面與法線
        OS.drawMirrorH(p, view, MIRROR.x1, MIRROR.x2, MIRROR.y);
        OS.drawNormal(p, view, O, NORMAL_TOP, { w: 1.8 });

        // 兩條光線。箭頭方向就是光的行進方向，所以反向模式只要把
        // 「誰是入射端」換掉，箭頭自己會跟著反過來。
        const incStart = state.ends[state.sides.incident];
        const refEnd = state.ends[state.sides.reflected];
        OS.line(p, view, incStart, O, OS.C_RAY,
                { w: 3, arrowAt: 0.60, head: 12 });
        OS.line(p, view, O, refEnd, OS.C_RAY,
                { w: 3, arrowAt: 0.55, head: 12 });

        // 兩個角度弧（顏色與右側卡片一致）
        const mkInc = angleMark(state, 'incident');
        const mkRef = angleMark(state, 'reflected');
        OS.drawAngleArc(p, view, O, mkInc.arc.a0, mkInc.arc.a1, ARC_R,
                        OS.C_ANGLE1, null);
        OS.drawAngleArc(p, view, O, mkRef.arc.a0, mkRef.arc.a1, ARC_R,
                        OS.C_ANGLE2, null);

        // 角度圖例（固定在左上角，理由見檔頭）
        const lgInc = legendAnchor('incident');
        const lgRef = legendAnchor('reflected');
        OS.worldBadge(p, view, lgInc.x, lgInc.y, mkInc.text,
                      { size: 14, col: OS.C_ANGLE1, align: lgInc.align });
        OS.worldBadge(p, view, lgRef.x, lgRef.y, mkRef.text,
                      { size: 14, col: OS.C_ANGLE2, align: lgRef.align });

        // 光線名稱
        const li = rayLabelAnchor(state, 'incident');
        const lr = rayLabelAnchor(state, 'reflected');
        OS.worldBadge(p, view, li.x, li.y, li.text,
                      { size: 13, col: OS.C_RAY, align: li.align });
        OS.worldBadge(p, view, lr.x, lr.y, lr.text,
                      { size: 13, col: OS.C_RAY, align: lr.align });

        // 標籤：鏡面與法線
        OS.worldBadge(p, view, 770, 640, '平面鏡', { size: 13, col: OS.C_NORMAL });
        OS.worldBadge(p, view, O.x, NORMAL_TOP.y - 30, '法線',
                      { size: 13, col: OS.C_NORMAL });

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
        formula: '\\theta_1 = \\theta_2',
        formulaFallback: 'θ₁ = θ₂',

        controls: {
            selects: [
                { key: 'dir', label: '光的方向', def: 'forward', live: true, options: [
                    { v: 'forward', t: '正向：由入射線射向鏡面' },
                    { v: 'reverse', t: '反向：由反射線射回' },
                ] },
            ],
            sliders: [
                { key: 'theta', label: '入射角 θ₁', def: 40, min: 0, max: 85,
                  step: 1, unit: '°', dec: 1 },
            ],
        },

        cards: [
            CARD('入射角 θ₁', 'cardTheta1', '°', true),
            CARD('反射角 θ₂', 'cardTheta2', '°', true),
            CARD('入射線與鏡面夾角', 'cardMirror1', '°'),
            CARD('反射線與鏡面夾角', 'cardMirror2', '°'),
            CARD('兩光線夾角', 'cardBetween', '°'),
            CARD('偏向角', 'cardDeviation', '°'),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, sol) {
            const g = sol.g;
            const th = g.theta1Deg;
            return {
                cardTheta1: th.toFixed(1),
                cardTheta2: g.theta2Deg.toFixed(1),
                cardMirror1: (90 - th).toFixed(1),
                cardMirror2: (90 - th).toFixed(1),
                cardBetween: (2 * th).toFixed(1),
                cardDeviation: (180 - 2 * th).toFixed(1),
            };
        },

        titleText(t, panel, sol) {
            const g = sol.g;
            const how = sol.reverse
                ? '反向入射：光沿同一條路徑折返'
                : g.theta1Deg < 0.05
                    ? '正向入射：兩條光線沿同一條法線、方向相反'
                    : '正向入射：兩條光線分居法線兩側';
            return `反射定律　θ₁ = θ₂ = ${g.theta1Deg.toFixed(0)}°　${how}`;
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
            O, LEN, MIRROR, NORMAL_TOP, ARC_R, LEGEND_X, LEGEND_Y,
            RAY_LABEL_F, PULSE_SPEED,
            stateFor, angleMark, legendAnchor, rayLabelAnchor, pulsePoint,
            drawScene,
        };
    }
})();
