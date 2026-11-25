/**
 * 📈 位移時間圖 — 觀察 x-t 圖的形狀，理解「圖形的斜率 = 速度」
 *
 * 力學圖表三部曲之一（04 速度時間圖、17 加速度時間圖）。
 * 這頁要學生看到的是：x-t 圖的**斜率就是速度**——斜直線代表等速、
 * 往上彎代表越來越快、變平代表停下來、往下彎代表往回走。
 *
 * 場景、鏡頭、圖表框、運動模式、控制面板都在 motion-scene.js，
 * 三頁共用同一套運動，同一個模式在三張圖上才對得起來。
 * 這裡只留這頁獨有的：x-t 曲線 + 斜率三角形。
 */

// ==========================================================================
// 這頁的縱軸是「位移」，所以 x-t 圖強調的是斜率
// ==========================================================================
function initDisplacementTimeGraph() {
    MotionScene.run({

        formula: 'v = \\frac{\\Delta x}{\\Delta t} \\qquad x = v_0 t + \\tfrac{1}{2}at^2',
        formulaFallback: 'v = Δx / Δt　　x = v₀t + ½at²',

        titleLeft: 'x-t 圖   DISPLACEMENT-TIME',
        titleRight: 't (s)   x (m)',

        cards: [
            { label: '時間 TIME',      id: 'cardTime',  unit: 's',    highlight: true },
            { label: '位移 X',         id: 'cardX',     unit: 'm',    highlight: true },
            { label: '速度 VEL',       id: 'cardV',     unit: 'm/s' },
            { label: '加速度 ACC',     id: 'cardA',     unit: 'm/s²' },
            { label: '平均速度',       id: 'cardAvgV',  unit: 'm/s' },
            // 這一格和「速度 VEL」永遠相同，是故意的：卡片本身就是
            // 「斜率 = 速度」這個等式的證據，學生會自己發現兩格一模一樣。
            { label: '圖形斜率 Δx/Δt', id: 'cardSlope', unit: 'm/s' },
        ],

        yOf: s => s.x,

        values: (s, panel) => ({
            cardTime:  s.t.toFixed(2),
            cardX:     s.x.toFixed(2),
            cardV:     s.v.toFixed(2),
            cardA:     s.a.toFixed(1),
            cardAvgV:  (s.t > 0.05 ? s.x / s.t : 0).toFixed(2),
            cardSlope: s.v.toFixed(2),
        }),

        titleText: (mode) => {
            switch (mode) {
                case 'constant':   return '等速運動：x-t 圖是斜直線，斜率固定 → 速度不變';
                case 'uniform':    return '等加速度：斜率越來越大 → 速度越來越快，圖形往上彎';
                case 'decelerate': return '等減速：斜率越來越小，車子停下來後變成水平線 → 速度為 0';
                case 'staged':     return '分段變速：斜率由正轉負 → 車子往回走，最後煞停變回水平';
                default:           return '';
            }
        },

        plot: (p, view, g, s, panel) => {
            // 取樣密度跟著實際像素走，一個取樣點負責約 2 px
            const px = (MotionScene.GRAPH_R - MotionScene.GRAPH_L) * view.scale;
            const steps = Math.min(600, Math.max(2, Math.ceil(px / 2)));

            if (s.t > 0) {
                const pts = MotionScene.samplePath(panel.mode, panel.v0, panel.a, s.t,
                                                   st => st.x, steps);
                if (pts.length > 1) MotionScene.curve(p, view, pts, g, [37, 99, 235]);
            }

            // 斜率三角形：斜率用解析的瞬時速度，不是有限差分——
            // 等加速度的 x-t 是拋物線，割線和切線差一截，標出來的數字
            // 會和旁邊卡片上的「速度」對不起來。
            if (s.t > 0.3) {
                MotionScene.slopeTriangle(p, view, g, {
                    t: g.nowT(s.t),
                    y: s.x,
                    slope: s.v,
                    label: `斜率 = Δx/Δt = ${s.v.toFixed(1)} m/s`,
                });
                MotionScene.marker(p, view, g.tToX(g.nowT(s.t)), g.yToPx(s.x));
            }
        },
    });
}

initDisplacementTimeGraph();
