/**
 * 🪞 全反射與臨界角
 *
 * 這一頁是折射定律的續集：光由光密介質射向光疏介質時，折射角恆大於入射角；
 * 入射角增加到臨界角 θC 之後，折射光線消失，光全部反射回原介質。
 *
 * 畫面上的入射線、反射線、折射線、反角弧、臨界角弧與右側六張卡片全部
 * 來自 `OpticsKit.refractionGeometry()`；反射線只是把入射方向對法線做
 * 鏡射，不是另外湊一條線。
 *
 * ==========================================================================
 * ⚠️ 預設狀態必須看得到折射光線
 * ==========================================================================
 * 玻璃 → 空氣的臨界角是 asin(1/1.5) ≈ 41.8°，預設入射角 35° 在臨界角
 * 以下，所以一進頁面先看到「入射 ＋ 反射 ＋ 折射」三條線；把 θ₁ 拉過
 * 41.8° 才剩下入射與反射。若預設就落在全反射，學生第一眼看不到「折射
 * 角變大、最後消失」的過程，這一頁的教學重點就不見了。
 *
 * ==========================================================================
 * ⚠️ 反射線永遠畫出來
 * ==========================================================================
 * 即使沒有全反射，介面上也有一部分光被反射（部分反射）。這一頁把反射線
 * 一直畫著，全反射只是「折射線消失、反射線留下」——不是「反射線突然
 * 出現」。脈衝走的路徑也是入射段接反射段，全反射與否都一樣。
 */

(function () {
    'use strict';

    const O = { x: 450, y: 470 };
    const LEN = 330;
    const INTERFACE = { x1: 70, x2: 830, y: 470 };
    const NORMAL_TOP = 52;
    const NORMAL_BOT = 782;
    const ARC_R = 118;
    const CRIT_R = 146;                  // 臨界角弧：比 θ₁、θ₂ 的弧大一號
    const LEGEND_X = 64;
    const LEGEND_Y = { incident: 78, critical: 126, out: 174 };
    const RAY_LABEL_F = 0.72;
    const MEDIUM_LABEL = {
        top: { x: 862, y: 56, align: 'right' },
        bottom: { x: 88, y: 760, align: 'left' },
    };
    const PULSE_SPEED = 250;             // 世界單位／秒

    // 這一頁的介質排列固定：上方是光密介質（入射介質），下方是光疏介質。
    const TOP_IS_DENSE = true;

    // ======================================================================
    // 這一頁的狀態（純資料，Node 餵得進來）
    // ======================================================================

    function stateFor(panel) {
        panel = panel || {};
        const n1 = panel.n1 == null ? 1.50 : panel.n1;
        const n2 = panel.n2 == null ? 1.00 : panel.n2;
        const theta = panel.theta == null ? 35 : panel.theta;
        const g = OpticsKit.refractionGeometry(theta, {
            O, n1, n2, from: 'top',
            len1: LEN, len2: LEN, lenRefl: LEN,
        });
        return { g };
    }

    /**
     * 入射角**正好等於**臨界角。
     *
     * `refractionGeometry()` 的全反射判準是嚴格大於（θ₁ > θC）：等號時
     * 折射線沿介面掠射，仍然存在，只是 θ₂ = 90°。這個狀態要單獨講，
     * 不能歸進「折射 θ₁ < θC」，也不能提早說成全反射。
     */
    function atCritical(g) {
        return g.criticalDeg != null && !g.tir
            && Math.abs(g.theta1Deg - g.criticalDeg) < 1e-9;
    }

    /** 某一個角的弧與圖例文字。 */
    function angleMark(state, which) {
        const g = state.g;
        let end, normalAngle, theta, name;
        if (which === 'incident') {
            end = g.P;
            normalAngle = -Math.PI / 2;
            theta = g.theta1Deg;
            name = 'θ₁';
        } else {
            end = g.Q;
            normalAngle = Math.PI / 2;
            theta = g.theta2Deg;
            name = 'θ₂';
        }
        const rayAngle = end
            ? Math.atan2(end.y - O.y, end.x - O.x)
            : normalAngle;
        return {
            rayAngle,
            normalAngle,
            arc: {
                a0: Math.min(rayAngle, normalAngle),
                a1: Math.max(rayAngle, normalAngle),
            },
            text: theta == null
                ? `${name}　無折射光線`
                : `${name} = ${theta.toFixed(1)}°`,
        };
    }

    /** 左上角圖例：固定座標，和角度、狀態都無關。 */
    function legendAnchor(which) {
        return { x: LEGEND_X, y: LEGEND_Y[which], align: 'left' };
    }

    /**
     * 介質區域標籤。上方是入射介質 n₁、下方是折射介質 n₂；一般情況上方
     * 較密。n₁ = n₂ = 1.33 是可達到的設定，那時兩層一樣密，不能寫「光密／
     * 光疏」——所以標籤跟著實際的 n 值說話。
     */
    function mediumLabel(which, state) {
        const m = MEDIUM_LABEL[which];
        const g = state && state.g;
        const topDense = !g || g.n1 > g.n2;
        const equal = g && Math.abs(g.n1 - g.n2) < 1e-12;
        let text;
        if (equal) {
            text = which === 'top' ? '介質　n₁' : '介質　n₂';
        } else if (which === 'top') {
            text = topDense ? '光密介質　n₁' : '光疏介質　n₁';
        } else {
            text = topDense ? '光疏介質　n₂' : '光密介質　n₂';
        }
        return { x: m.x, y: m.y, align: m.align, text };
    }

    /** 三條光線的名稱錨點；折射線不存在時回傳 null。 */
    function rayLabelAnchor(state, which) {
        const g = state.g;
        if (which === 'refracted' && !g.Q) return null;
        let a, b, side;
        if (which === 'incident') {
            a = g.P; b = O; side = g.incidentSide;
        } else if (which === 'reflected') {
            a = O; b = g.R; side = g.reflectedSide;
        } else {
            a = O; b = g.Q; side = g.refractedSide;
        }
        const pt = OpticsKit.lerp(a, b, RAY_LABEL_F);
        return {
            x: pt.x + side * 16,
            y: pt.y,
            align: side < 0 ? 'right' : 'left',
            text: which === 'incident' ? '入射光線'
                : which === 'reflected' ? '反射光線' : '折射光線',
        };
    }

    /**
     * 臨界角弧：從法線（朝上）量到**入射線那一側**（左上），張角就是 θC。
     * 入射線在左上方，所以弧也在左上方；畫到右邊（介面朝右）量的是
     * 90° − θC，不是臨界角。
     */
    function criticalMark(state) {
        const g = state.g;
        if (g.criticalDeg == null) return null;
        const thC = g.criticalDeg * Math.PI / 180;
        return {
            a0: -Math.PI / 2 - thC,
            a1: -Math.PI / 2,
            r: CRIT_R,
            text: `θC = ${g.criticalDeg.toFixed(1)}°`,
        };
    }

    /** 光脈衝在這一刻的位置：入射段接反射段。 */
    function pulsePoint(state, t) {
        const L = state.g.reflectionPathLen;
        let phase = (t * PULSE_SPEED) % L;
        if (phase < 0) phase += L;
        return OpticsKit.refractionReflectionPointAt(state.g, phase);
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const g = state.g;
        const OS = OpticsScene;

        // 介質、介面與法線
        OS.drawInterfaceH(p, view, INTERFACE.x1, INTERFACE.x2, INTERFACE.y);
        OS.drawNormal(p, view, { x: O.x, y: NORMAL_TOP },
                      { x: O.x, y: NORMAL_BOT }, { w: 1.8 });

        // 入射線與反射線（反射線永遠存在）
        OS.line(p, view, g.P, O, OS.C_RAY, { w: 3, arrowAt: 0.60, head: 12 });
        OS.line(p, view, O, g.R, OS.C_RAY, { w: 3, arrowAt: 0.55, head: 12 });

        // 折射線：只有 θ₁ < θC 才存在
        if (g.Q) {
            OS.line(p, view, O, g.Q, OS.C_RAY,
                    { w: 3, arrowAt: 0.55, head: 12 });
        }

        // θ₁、θ₂ 的弧
        const mkInc = angleMark(state, 'incident');
        OS.drawAngleArc(p, view, O, mkInc.arc.a0, mkInc.arc.a1, ARC_R,
                        OS.C_ANGLE1, null);
        if (g.Q) {
            const mkOut = angleMark(state, 'refracted');
            OS.drawAngleArc(p, view, O, mkOut.arc.a0, mkOut.arc.a1, ARC_R,
                            OS.C_ANGLE2, null);
        }

        // 臨界角弧（紫色、半徑大一號，才不會和 θ₂ 的弧黏在一起）
        const cm = criticalMark(state);
        if (cm) {
            OS.drawAngleArc(p, view, O, cm.a0, cm.a1, cm.r,
                            OS.C_IMG, null);
        }

        // 左上角圖例
        const rows = [
            { which: 'incident', text: mkInc.text, col: OS.C_ANGLE1 },
            { which: 'critical', text: cm ? cm.text : '沒有臨界角',
              col: OS.C_IMG },
            { which: 'out',
              text: g.tir ? 'θ₂　無折射光線' : angleMark(state, 'refracted').text,
              col: OS.C_ANGLE2 },
        ];
        for (const row of rows) {
            const a = legendAnchor(row.which);
            OS.worldBadge(p, view, a.x, a.y, row.text,
                          { size: 14, col: row.col, align: a.align });
        }

        // 光線名稱
        for (const which of ['incident', 'reflected', 'refracted']) {
            const a = rayLabelAnchor(state, which);
            if (!a) continue;
            OS.worldBadge(p, view, a.x, a.y, a.text,
                          { size: 13, col: OS.C_RAY, align: a.align });
        }

        // 介質標籤
        for (const which of ['top', 'bottom']) {
            const m = mediumLabel(which, state);
            const n = which === 'top' ? g.n1 : g.n2;
            OS.worldBadge(p, view, m.x, m.y,
                          m.text + ' = ' + n.toFixed(2),
                          { size: 13, col: OS.C_LABEL, align: m.align });
        }

        // 狀態徽章：全反射時紫、折射時綠、臨界（掠射）時紫
        OS.worldBadge(p, view, 862, 104,
                      g.tir ? '全反射' : atCritical(g) ? '臨界（掠射）' : '折射',
                      { size: 14, col: g.tir ? OS.C_IMG : OS.C_ANGLE2,
                        align: 'right' });

        // 法線與介面
        OS.worldBadge(p, view, O.x, 30, '法線',
                      { size: 13, col: OS.C_NORMAL });
        OS.worldBadge(p, view, 88, 438, '介面',
                      { size: 13, col: OS.C_NORMAL, align: 'left' });

        // 入射點
        OS.drawDot(p, view, O.x, O.y, OS.C_NORMAL, 6);

        // 光脈衝
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
        formula: '\\sin\\theta_C=\\frac{n_2}{n_1}',
        formulaFallback: 'sin θC = n₂ / n₁',

        controls: {
            sliders: [
                { key: 'n1', label: '光密介質 n₁', def: 1.50, min: 1.33, max: 2.42,
                  step: 0.01, unit: '', dec: 2 },
                { key: 'n2', label: '光疏介質 n₂', def: 1.00, min: 1.00, max: 1.33,
                  step: 0.01, unit: '', dec: 2 },
                { key: 'theta', label: '入射角 θ₁', def: 35, min: 0, max: 89,
                  step: 1, unit: '°', dec: 0 },
            ],
        },

        cards: [
            CARD('入射角 θ₁', 'cardTheta1', '°', true),
            CARD('臨界角 θC', 'cardCritical', '°'),
            CARD('折射角 θ₂', 'cardTheta2', '°'),
            CARD('n₁ sin θ₁', 'cardLhs', ''),
            CARD('n₂', 'cardN2', ''),
            CARD('光的去向', 'cardState', '', true),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, sol) {
            const g = sol.g;
            return {
                cardTheta1: g.theta1Deg.toFixed(1),
                cardCritical: g.criticalDeg == null ? '—'
                    : g.criticalDeg.toFixed(1),
                cardTheta2: g.tir ? '—' : g.theta2Deg.toFixed(1),
                cardLhs: (g.n1 * Math.sin(g.theta1Deg * Math.PI / 180)).toFixed(3),
                cardN2: g.n2.toFixed(2),
                cardState: g.tir ? '全反射'
                    : atCritical(g) ? '臨界（掠射）' : '折射',
            };
        },

        titleText(t, panel, sol) {
            const g = sol.g;
            if (g.tir) {
                return `全反射　θ₁ = ${g.theta1Deg.toFixed(1)}°`
                     + ` > θC = ${g.criticalDeg.toFixed(1)}°`
                     + '　光全部反射回光密介質';
            }
            const crit = g.criticalDeg == null ? '—'
                : g.criticalDeg.toFixed(1);
            if (atCritical(g)) {
                return `臨界　θ₁ = θC = ${g.theta1Deg.toFixed(1)}°`
                     + '　折射線沿介面（θ₂ = 90°）';
            }
            return `折射　θ₁ = ${g.theta1Deg.toFixed(1)}°`
                 + ` < θC = ${crit}°`
                 + `　θ₂ = ${g.theta2Deg.toFixed(1)}°`;
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
            O, LEN, INTERFACE, NORMAL_TOP, NORMAL_BOT, ARC_R, CRIT_R,
            LEGEND_X, LEGEND_Y, RAY_LABEL_F, MEDIUM_LABEL, PULSE_SPEED,
            TOP_IS_DENSE,
            stateFor, angleMark, legendAnchor, mediumLabel, rayLabelAnchor,
            criticalMark, atCritical, pulsePoint, drawScene,
        };
    }
})();
