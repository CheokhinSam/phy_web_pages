/**
 * 🪢 繩波的產生與傳播 — 波是「擾動的傳播」，不是「物質的搬運」
 *
 * 這頁要學生看到三件事：
 *   1. 手在左端上下抖，繩子上出現一個往右跑的波形。**繩子本身沒有跑掉**，
 *      每一顆珠點都只在原地上下動。
 *   2. 波速 v = √(T/μ) 由繩子（張力、線密度）決定，**不是由手決定**。
 *      手抖得快只會讓波長變短，波跑得一樣快。
 *   3. v = fλ 這條關係怎麼從畫面讀出來：波速 = 波長 × 頻率。
 *
 * 場景、波的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 * 這裡只留這頁獨有的：會動的繩波 + 那一顆被追蹤的珠點的時間圖。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const SWB_ROPE_Y   = 300;      // 繩子的平衡位置（上下各留 96 給最大振幅）
const SWB_AMP_C     = 12;      // 垂直放大：世界單位 / 公分（最大振幅 8 cm → ±96）
const SWB_BRACKET_Y = 118;     // 波長標註的高度
const SWB_ARROW_Y   = 72;      // 「波往右跑」箭頭的高度

const SWB_GRAPH_T = 470;       // 珠點時間圖的上緣
const SWB_GRAPH_B = 760;       // 下緣
const SWB_GRAPH_AMP = 7;       // 時間圖的垂直放大（世界單位 / 公分）
const SWB_WINDOW  = 8;         // 時間圖的時間窗（秒）

const SWB_BEAD_M = 2.4;        // 被追蹤的珠點位置（公尺）

function initStringWaveBasics() {
    // 珠點的索引：把繩子 N 等分，取最接近 SWB_BEAD_M 的那一顆
    const BEAD_N = 24;
    const beadIndex = Math.round(SWB_BEAD_M / WaveScene.ROPE_M * BEAD_N);
    const beadX = WaveScene.ROPE_M * beadIndex / BEAD_N;

    /**
     * 繩子在 x（公尺）、t（秒）時的位移（公分）。
     *
     * 波前（front）之後的繩子還沒被擾動到，位移是 0——這一條撐起
     * 「波需要時間傳過去」的教學點，也是下面時間圖裡「珠點一開始不動」
     * 的原因。
     */
    function makeWave(A, k, v) {
        return function (x, t) {
            const front = v * t;
            if (x > front) return 0;
            // sin(k(vt − x))：向右行進，且波源（x = 0）從 0 開始往上
            return A * Math.sin(k * (v * t - x));
        };
    }

    WaveScene.run({

        formula: 'v = \\sqrt{\\dfrac{T}{\\mu}} \\qquad v = f\\lambda',
        formulaFallback: 'v = √(T/μ)　　v = f λ',

        controls: {
            sliders: [
                { key: 'T', label: '張力 <i>T</i>', unit: 'N', min: 2, max: 12, step: 0.5, def: 4 },
                { key: 'mu', label: '線密度 <i>μ</i>', unit: 'kg/m', min: 0.10, max: 0.60, step: 0.05, def: 0.25, dec: 2 },
                { key: 'f', label: '頻率 <i>f</i>（手抖多快）', unit: 'Hz', min: 0.3, max: 1.5, step: 0.05, def: 0.8, dec: 2 },
                { key: 'A', label: '振幅 <i>A</i>', unit: 'cm', min: 1, max: 8, step: 0.5, def: 4, dec: 1 },
            ],
        },

        cards: [
            { label: '時間 TIME',        id: 'cardTime',   unit: 's',      highlight: true },
            { label: '波速 V',           id: 'cardV',      unit: 'm/s',    highlight: true },
            { label: '波長 Λ',           id: 'cardLambda', unit: 'm' },
            { label: '頻率 F',           id: 'cardF',      unit: 'Hz' },
            { label: '週期 T = 1/f',     id: 'cardPeriod', unit: 's' },
            { label: '振幅 A',           id: 'cardAmp',    unit: 'cm' },
            { label: '波前位置',         id: 'cardFront',  unit: 'm' },
            { label: '波傳到珠點沒',     id: 'cardArrived', unit: '' },
        ],

        values(t, panel) {
            const m = WaveScene.medium(panel.T, panel.mu);
            return {
                cardTime:    t.toFixed(2),
                cardV:       m.v.toFixed(2),
                cardLambda:  (m.v / panel.f).toFixed(2),
                cardF:       panel.f.toFixed(2),
                cardPeriod:  (1 / panel.f).toFixed(2),
                cardAmp:     panel.A.toFixed(1),
                cardFront:   Math.min(WaveScene.ROPE_M, m.v * t).toFixed(2),
                cardArrived: (m.v * t >= beadX) ? '已到達' : '還沒',
            };
        },

        titleText(t, panel) {
            const m = WaveScene.medium(panel.T, panel.mu);
            if (t < 0.05) {
                return '還沒開始：按下「開始」，手開始上下抖，波才會從左端跑出來';
            }
            if (m.v * t < beadX) {
                return `波前還在路上（走了 ${(m.v * t).toFixed(2)} m）——紅珠點連動都還沒動`;
            }
            return `波速 v = √(T/μ) = ${m.v.toFixed(2)} m/s 由繩子決定；`
                 + `改 f 只改波長 λ = ${(m.v / panel.f).toFixed(2)} m，改不了 v`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const m = TS.medium(panel.T, panel.mu);
            const lambda = m.v / panel.f;
            const k = TS.waveNumber(panel.f, m.v);
            const y = makeWave(panel.A, k, m.v);

            // ------------------------------------------------------------
            // 上半：會動的繩子
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, SWB_ROPE_Y);

            const ropePts = TS.sample(y, 0, TS.ROPE_M, t, lambda);
            TS.drawWave(p, view, ropePts, {
                baseY: SWB_ROPE_Y, ampScale: SWB_AMP_C,
                color: [37, 99, 235], weight: 4,
            });

            // 被追蹤的珠點：畫一條垂直虛線穿過它，說明它只上下動
            const beadSX = TS.ropeX(view, beadX);
            const beadSY = view.toScreenY(SWB_ROPE_Y - y(beadX, t) * SWB_AMP_C);
            const ctx = p.drawingContext;
            ctx.save();
            ctx.setLineDash([view.len(7, 3), view.len(6, 3)]);
            p.stroke(239, 68, 68);
            p.strokeWeight(view.len(1.5, 1));
            const span = 8 * SWB_AMP_C + 20;      // 最大振幅再留一點餘裕
            p.line(beadSX, view.toScreenY(SWB_ROPE_Y - span),
                   beadSX, view.toScreenY(SWB_ROPE_Y + span));
            ctx.restore();

            TS.drawBeads(p, view, y, t, {
                baseY: SWB_ROPE_Y, ampScale: SWB_AMP_C, n: BEAD_N,
                color: [148, 163, 184], radius: 5,
                highlight: { index: beadIndex, color: [239, 68, 68] },
            });

            // 波源：左端那隻手
            const handSY = view.toScreenY(SWB_ROPE_Y - y(0, t) * SWB_AMP_C);
            p.noStroke();
            p.fill(30, 41, 59);
            p.circle(TS.ropeX(view, 0), handSY, view.len(24, 11));
            p.fill(251, 191, 36);
            p.textSize(view.len(14, 8));
            p.textStyle(p.BOLD);
            p.textAlign(p.RIGHT, p.CENTER);
            p.text('波源', TS.ropeX(view, 0) - view.len(16, 8), handSY);

            // 波長標註：從 x = 0 起算一個 λ（若波前還沒到就標在波前之前）
            if (m.v * t > lambda * 0.35) {
                const end = Math.min(lambda, m.v * t);
                TS.wavelengthBracket(p, view, 0, end, SWB_BRACKET_Y,
                    `λ = ${lambda.toFixed(2)} m`, { color: [37, 99, 235] });
            }

            // 「波往右跑」的箭頭
            if (m.v * t > 0.4) {
                TS.drawTravelArrow(p, view, TS.ROPE_M * 0.55, SWB_ARROW_Y, 1,
                    `波以 v = ${m.v.toFixed(2)} m/s 前進`, [239, 68, 68]);
            }

            // ------------------------------------------------------------
            // 下半：被追蹤珠點的「位移–時間」圖
            // ------------------------------------------------------------
            drawBeadGraph(p, view, t, y, beadX, panel);
        },
    });

    /**
     * 紅珠點的位移-時間圖。
     *
     * 時間窗固定 8 秒（不隨 f 縮放）。若讓窗寬跟著 f 跑，改頻率時整張圖
     * 看起來一模一樣，「頻率變了」就完全看不出來——而那正是這張圖要講的事。
     *
     * 波還沒傳到珠點之前，圖上是一條貼在零線上的平線：珠點根本沒動。
     * 這條平線是「波需要時間傳過去」最直接的證據。
     */
    function drawBeadGraph(p, view, t, y, xm, panel) {
        const TS = WaveScene;
        const gl = TS.ropeX(view, 0), gr = TS.ropeX(view, TS.ROPE_M);
        const gt = view.toScreenY(SWB_GRAPH_T), gb = view.toScreenY(SWB_GRAPH_B);
        const zeroY = (gt + gb) / 2;

        p.noStroke();
        p.fill(250, 250, 250);
        p.rect(gl, gt, gr - gl, gb - gt);
        p.noFill();
        p.stroke(226, 232, 240);
        p.strokeWeight(1);
        p.rect(gl, gt, gr - gl, gb - gt);

        // 零線
        p.stroke(148, 163, 184);
        p.strokeWeight(view.len(2, 1));
        p.line(gl, zeroY, gr, zeroY);

        // 標題
        p.noStroke();
        p.fill(100, 116, 139);
        p.textSize(view.len(15, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text('紅珠點的位移-時間圖   DISPLACEMENT vs TIME', gl, gt - view.len(7, 4));
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text(`最近 ${SWB_WINDOW} 秒   t (s)`, gr, gt - view.len(7, 4));

        // 時間軸：τ ∈ [t − WINDOW, t]，用時間刻度標
        const tOf = px => t - SWB_WINDOW + (px - gl) / (gr - gl) * SWB_WINDOW;
        const xOf = tt => gl + (tt - (t - SWB_WINDOW)) / SWB_WINDOW * (gr - gl);

        p.stroke(241, 245, 249);
        p.strokeWeight(1);
        for (let i = 0; i <= 8; i++) {
            const xx = gl + (gr - gl) * i / 8;
            p.line(xx, gt, xx, gb);
        }
        p.noStroke();
        p.fill(148, 163, 184);
        p.textSize(view.len(13, 8));
        p.textStyle(p.NORMAL);
        p.textAlign(p.CENTER, p.TOP);
        for (let i = 0; i <= 8; i++) {
            const tt = t - SWB_WINDOW + SWB_WINDOW * i / 8;
            if (tt >= -1e-9) p.text(`${tt.toFixed(1)}`, gl + (gr - gl) * i / 8, gb + view.len(6, 3));
        }

        // 曲線：只畫模擬真正跑過、而且波已經傳到珠點之後的部分
        const ctx = p.drawingContext;
        ctx.save();
        ctx.beginPath();
        ctx.rect(gl, gt, gr - gl, gb - gt);
        ctx.clip();

        p.noFill();
        p.stroke(37, 99, 235);
        p.strokeWeight(view.len(3, 2));
        const N = 260;
        let drawing = false;
        for (let i = 0; i <= N; i++) {
            const tt = tOf(gl + (gr - gl) * i / N);
            if (tt < 0) continue;                 // 模擬還沒開始
            if (!drawing) { p.beginShape(); drawing = true; }
            p.vertex(xOf(tt), zeroY - y(xm, tt) * SWB_GRAPH_AMP);
        }
        if (drawing) p.endShape();

        // 目前這一刻的點
        p.noStroke();
        p.fill(239, 68, 68);
        p.circle(xOf(t), zeroY - y(xm, t) * SWB_GRAPH_AMP, view.len(13, 6));
        ctx.restore();

        // 一個週期的括號：標在圖的右端
        const period = 1 / panel.f;
        if (t > period) {
            const x0 = xOf(t - period), x1 = xOf(t);
            const by = gb - view.len(20, 10);
            p.stroke(217, 119, 6);
            p.strokeWeight(view.len(2, 1));
            p.line(x0, by, x1, by);
            p.line(x0, by - view.len(7, 4), x0, by + view.len(7, 4));
            p.line(x1, by - view.len(7, 4), x1, by + view.len(7, 4));
            p.noStroke();
            p.fill(217, 119, 6);
            p.textSize(view.len(14, 8));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.text(`一個週期 T = 1/f = ${period.toFixed(2)} s`, (x0 + x1) / 2, by - view.len(6, 3));
        }
    }
}

initStringWaveBasics();
