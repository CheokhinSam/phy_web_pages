/**
 * 🪢 波的疊加與干涉 — 兩條波相遇時，位移直接相加
 *
 * 這頁要學生看到三件事：
 *   1. 兩條波在同一條繩子上相遇時，**同一個位置的位移直接相加**。
 *      正 + 正 = 更大，正 + 負 = 抵消。這就是疊加原理。
 *   2. 相遇之後兩條波**各自保持原狀**繼續前進，好像什麼都沒發生過。
 *      疊加不是碰撞，沒有誰把誰撞歪。
 *   3. 波可以「穿過」彼此——這是波和粒子最不一樣的地方。
 *
 * 版面是三條 lane：脈衝 A、脈衝 B、以及它們的和。
 * 第三條 lane 上同時畫出兩條淡的虛線（就是上面兩條平移下來），
 * 讓「黑線 = 藍線 + 橘線」變成可以直接用眼睛驗證的事。
 *
 * 場景、波的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
// 三條 lane 不平均分配高度：合成波那一條的振幅是兩者之和，必須更高。
const WSP_LANE_A   = 245;      // 脈衝 A 的平衡位置（振幅最大 5 cm → ±55）
const WSP_LANE_B   = 435;      // 脈衝 B
const WSP_LANE_SUM = 660;      // 合成波（最大 10 cm → ±110）

const WSP_AMP_C = 11;          // 垂直放大：世界單位 / 公分

const WSP_XA = 0.7;            // 脈衝 A 的起點（公尺）
const WSP_XB = 7.3;            // 脈衝 B 的起點（公尺）
const WSP_MEET = 4.0;          // 相遇點（剛好在中間）

const WSP_ARROW_Y = 150;       // 「往右／往左」箭頭的高度
const WSP_MEET_Y  = 92;        // 「相遇點」標籤的高度（要留在箭頭上面，兩者會撞）

function initWaveSuperposition() {
    // 兩條波在同一條繩子上，所以介質相同、波速相同。
    // 刻意挑慢一點的繩子，讓「相遇 → 分開」有大約 4 秒可以看。
    const T = 2, MU = 0.5;

    WaveScene.run({

        formula: 'y(x,t) = y_1(x,t) + y_2(x,t)',
        formulaFallback: 'y(x,t) = y₁(x,t) + y₂(x,t)　（疊加原理）',

        controls: {
            sliders: [
                { key: 'A1', label: '脈衝 <i>A</i> 振幅', unit: 'cm', min: 0.5, max: 5, step: 0.5, def: 3, dec: 1 },
                { key: 'A2', label: '脈衝 <i>B</i> 振幅', unit: 'cm', min: 0.5, max: 5, step: 0.5, def: 3, dec: 1 },
                { key: 'width', label: '脈衝寬度 <i>w</i>', unit: 'm', min: 0.3, max: 1.2, step: 0.1, def: 0.6 },
            ],
            selects: [
                {
                    key: 'sign2', label: '脈衝 B 是正還是負', def: '1',
                    options: [
                        { v: '1', t: '正脈衝（向上）' },
                        { v: '-1', t: '負脈衝（向下）' },
                    ],
                },
            ],
        },

        cards: [
            { label: '時間 TIME',        id: 'cardTime',  unit: 's',   highlight: true },
            { label: '波速 V',           id: 'cardV',     unit: 'm/s', highlight: true },
            { label: '脈衝 A 振幅',      id: 'cardA1',    unit: 'cm' },
            { label: '脈衝 B 振幅',      id: 'cardA2',    unit: 'cm' },
            { label: '脈衝寬度 W',       id: 'cardWidth', unit: 'm' },
            { label: '兩脈衝間距',       id: 'cardGap',   unit: 'm' },
            { label: '完全重疊時位移',   id: 'cardPeak',  unit: 'cm' },
            { label: '狀態',             id: 'cardState', unit: '' },
        ],

        values(t, panel) {
            const m = WaveScene.medium(T, MU);
            const sgn = parseFloat(panel.sign2);
            const A2 = panel.A2 * sgn;
            const xA = WSP_XA + m.v * t;
            const xB = WSP_XB - m.v * t;
            const gap = Math.abs(xB - xA);
            const tm = (WSP_XB - WSP_XA) / (2 * m.v);

            let state;
            if (gap > 3 * panel.width) {
                state = t < tm ? '還沒相遇' : '已經分開';
            } else {
                state = '正在重疊';
            }

            return {
                cardTime:  t.toFixed(2),
                cardV:     m.v.toFixed(2),
                cardA1:    panel.A1.toFixed(1),
                cardA2:    A2.toFixed(1),
                cardWidth: panel.width.toFixed(1),
                cardGap:   gap.toFixed(2),
                // 兩個高斯脈衝的中心重合時，該點的位移就是兩個振幅相加
                cardPeak:  (panel.A1 + A2).toFixed(1),
                cardState: state,
            };
        },

        titleText(t, panel) {
            const m = WaveScene.medium(T, MU);
            const xA = WSP_XA + m.v * t, xB = WSP_XB - m.v * t;
            const gap = Math.abs(xB - xA);
            const sgn = parseFloat(panel.sign2);
            const sum = panel.A1 + panel.A2 * sgn;

            if (t < 0.05) {
                return `兩條脈衝正對著跑過來，波速都是 ${m.v.toFixed(2)} m/s——按下開始，看它們相遇時會發生什麼事`;
            }
            if (gap > 3 * panel.width) {
                return t < (WSP_XB - WSP_XA) / (2 * m.v)
                    ? `兩條脈衝還離 ${gap.toFixed(2)} m——注意看下面那條合成波，它現在就是兩條加起來`
                    : `兩條脈衝已經分開，各自繼續前進——形狀和相遇前完全一樣`;
            }
            if (Math.abs(sum) < 0.05) {
                return `兩條脈衝完全重疊，一上一下剛好抵銷——繩子這一瞬間是平的，但能量還在繩子上`;
            }
            return `兩條脈衝正在重疊：同一點的位移直接相加，${panel.A1.toFixed(1)} ${sgn > 0 ? '+' : '−'} ${panel.A2.toFixed(1)} = ${sum.toFixed(1)} cm`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const m = TS.medium(T, MU);
            const sgn = parseFloat(panel.sign2);
            const w = panel.width;

            const pa = TS.pulse({ A: panel.A1, width: w, v: m.v, dir: +1, x0: WSP_XA });
            const pb = TS.pulse({ A: panel.A2 * sgn, width: w, v: m.v, dir: -1, x0: WSP_XB });
            const total = (x, tt) => pa(x, tt) + pb(x, tt);

            const arms = Math.min(w, 1) / 4;       // 取樣密度：跟著脈衝寬度走

            // ------------------------------------------------------------
            // lane A：脈衝 A
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, WSP_LANE_A);
            TS.drawWave(p, view, TS.sample(pa, 0, TS.ROPE_M, t, arms),
                { baseY: WSP_LANE_A, ampScale: WSP_AMP_C, color: [37, 99, 235], weight: 4 });
            TS.drawLaneLabel(p, view, WSP_LANE_A, '脈衝 A', [37, 99, 235]);
            TS.drawTravelArrow(p, view, WSP_XA + m.v * t, WSP_ARROW_Y, +1,
                `A 以 ${m.v.toFixed(2)} m/s 往右`, [37, 99, 235]);

            // 脈衝寬度的括號（跟著 A 跑）。
            // 畫在 lane A **下面**：上面那條被「A 往右跑」的箭頭佔走了，
            // 兩個標籤疊在同一個高度會糊成一團。
            const xA = WSP_XA + m.v * t;
            if (xA > w * 1.6 && xA < TS.ROPE_M - w * 1.6) {
                TS.wavelengthBracket(p, view, xA - w, xA + w, WSP_LANE_A + 82,
                    `寬度 w = ${w.toFixed(1)} m`, { color: [37, 99, 235], above: true });
            }

            // ------------------------------------------------------------
            // lane B：脈衝 B
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, WSP_LANE_B);
            TS.drawWave(p, view, TS.sample(pb, 0, TS.ROPE_M, t, arms),
                { baseY: WSP_LANE_B, ampScale: WSP_AMP_C, color: [234, 88, 12], weight: 4 });
            TS.drawLaneLabel(p, view, WSP_LANE_B, '脈衝 B', [234, 88, 12]);
            TS.drawTravelArrow(p, view, WSP_XB - m.v * t, WSP_LANE_B + 78, -1,
                `B 以 ${m.v.toFixed(2)} m/s 往左`, [234, 88, 12]);

            // ------------------------------------------------------------
            // lane SUM：合成波，底下墊著兩條淡虛線
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, WSP_LANE_SUM);
            TS.drawWave(p, view, TS.sample(pa, 0, TS.ROPE_M, t, arms),
                { baseY: WSP_LANE_SUM, ampScale: WSP_AMP_C, color: [147, 197, 253], weight: 2, dash: 7 });
            TS.drawWave(p, view, TS.sample(pb, 0, TS.ROPE_M, t, arms),
                { baseY: WSP_LANE_SUM, ampScale: WSP_AMP_C, color: [253, 186, 116], weight: 2, dash: 7 });
            TS.drawWave(p, view, TS.sample(total, 0, TS.ROPE_M, t, arms),
                { baseY: WSP_LANE_SUM, ampScale: WSP_AMP_C, color: [15, 23, 42], weight: 5 });
            TS.drawLaneLabel(p, view, WSP_LANE_SUM, 'A + B', [15, 23, 42]);

            // 相遇點：一條貫穿三條 lane 的垂直虛線
            const ctx = p.drawingContext;
            ctx.save();
            ctx.setLineDash([view.len(9, 4), view.len(7, 3)]);
            p.stroke(203, 213, 225);
            p.strokeWeight(view.len(2, 1));
            p.line(TS.ropeX(view, WSP_MEET), view.toScreenY(WSP_MEET_Y + 16),
                   TS.ropeX(view, WSP_MEET), view.toScreenY(WSP_LANE_SUM + 130));
            ctx.restore();
            p.noStroke();
            p.fill(148, 163, 184);
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.TOP);
            p.text('相遇點', TS.ropeX(view, WSP_MEET), view.toScreenY(WSP_MEET_Y));

            // 合成波現在的最大位移：直接標在合成那條 lane 上
            const xAnow = WSP_XA + m.v * t, xBnow = WSP_XB - m.v * t;
            const gap = Math.abs(xBnow - xAnow);
            if (gap < 3 * w) {
                const xm = (xAnow + xBnow) / 2;
                const ym = total(xm, t);
                TS.valueBadge(p, view, TS.ropeX(view, xm),
                    view.toScreenY(TS.laneY(WSP_LANE_SUM, WSP_AMP_C, ym) - 26),
                    `${ym >= 0 ? '+' : ''}${ym.toFixed(1)} cm`, { size: 17 });
            }
        },
    });
}

initWaveSuperposition();
