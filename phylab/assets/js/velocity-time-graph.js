/**
 * 📈 速度時間圖 — 觀察 v-t 圖的形狀，理解「斜率 = 加速度、面積 = 位移」
 *
 * 力學圖表三部曲之一（03 位移時間圖、17 加速度時間圖）。
 * 這頁有兩個教學重點，所以畫面上也有兩個視覺重點：
 *   斜率三角形 → 斜率是加速度
 *   面積著色   → 面積是位移（正藍負紅，穿過時間軸就換色）
 *
 * 場景、鏡頭、圖表框、運動模式、控制面板都在 motion-scene.js，
 * 三頁共用同一套運動，同一個模式在三張圖上才對得起來。
 */

function initVelocityTimeGraph() {
    MotionScene.run({

        formula: 'a = \\frac{\\Delta v}{\\Delta t} \\qquad \\Delta x = S_{v\\text{-}t}',
        formulaFallback: 'a = Δv / Δt　　Δx = v-t 圖下面積',

        titleLeft: 'v-t 圖   VELOCITY-TIME',
        titleRight: 't (s)   v (m/s)',

        cards: [
            { label: '時間 TIME',    id: 'cardTime',   unit: 's',    highlight: true },
            { label: '速度 VEL',     id: 'cardV',      unit: 'm/s',  highlight: true },
            { label: '加速度 ACC',   id: 'cardA',      unit: 'm/s²' },
            { label: '位移 X',       id: 'cardX',      unit: 'm' },
            // 這一格和「位移 X」永遠相同，是故意的：卡片本身就是
            // 「面積 = 位移」這個等式的證據。
            { label: '圖下面積',     id: 'cardArea',   unit: 'm' },
            { label: '平均速度',     id: 'cardAvgV',   unit: 'm/s' },
        ],

        yOf: s => s.v,

        values: (s, panel) => ({
            cardTime: s.t.toFixed(2),
            cardV:    s.v.toFixed(2),
            cardA:    s.a.toFixed(1),
            cardX:    s.x.toFixed(2),
            cardArea: MotionScene.velocityAreaAt(panel.mode, panel.v0, panel.a, s.t).toFixed(2),
            cardAvgV: (s.t > 0.05 ? s.x / s.t : 0).toFixed(2),
        }),

        titleText: (mode) => {
            switch (mode) {
                case 'constant':   return '等速運動：v-t 圖是水平線，斜率為 0 → 加速度為 0；面積 = 位移';
                case 'uniform':    return '等加速度：斜直線的斜率固定 → 加速度不變；面積 = 位移';
                case 'decelerate': return '等減速：v 一路降到 0 就貼在時間軸上 → 車子靜止，位移不再增加';
                case 'staged':     return '分段變速：斜率換一次就是換一次加速度；穿過時間軸面積變負，最後回到 0';
                default:           return '';
            }
        },

        plot: (p, view, g, s, panel) => {
            const px = (MotionScene.GRAPH_R - MotionScene.GRAPH_L) * view.scale;
            const steps = Math.min(600, Math.max(2, Math.ceil(px / 2)));

            if (s.t > 0) {
                const pts = MotionScene.samplePath(panel.mode, panel.v0, panel.a, s.t,
                                                   st => st.v, steps);
                if (pts.length > 1) {
                    // 面積：正值藍、負值紅。曲線穿過時間軸時要分色，
                    // 否則「負面積 = 負位移」在畫面上完全看不出來。
                    MotionScene.fillSignedArea(p, view, pts, g,
                                               [37, 99, 235, 42], [239, 68, 68, 42]);
                    MotionScene.curve(p, view, pts, g, [37, 99, 235]);
                }

                // 面積數值標在最大那塊著色區的中心，底下墊白底藍框的標籤，
                // 否則會壓到網格和曲線。
                const area = MotionScene.velocityAreaAt(panel.mode, panel.v0, panel.a, s.t);
                const dom = MotionScene.dominantArea(pts);
                if (dom && Math.abs(area) > 0.05) {
                    MotionScene.valueBadge(p, view, g.tToX(dom.t), g.yToPx(dom.y / 2),
                                           `面積 = 位移 = ${area.toFixed(1)} m`,
                                           { size: 16, minSize: 9 });
                }
            }

            // 斜率三角形：斜率 = 瞬時加速度。等速模式 a = 0，三角形高度為 0，
            // slopeTriangle() 會自己跳過不畫。
            if (s.t > 0.3) {
                MotionScene.slopeTriangle(p, view, g, {
                    t: g.nowT(s.t),
                    y: s.v,
                    slope: s.a,
                    label: `斜率 = Δv/Δt = ${s.a.toFixed(1)} m/s²`,
                });
                MotionScene.marker(p, view, g.tToX(g.nowT(s.t)), g.yToPx(s.v));
            }
        },
    });
}

initVelocityTimeGraph();
