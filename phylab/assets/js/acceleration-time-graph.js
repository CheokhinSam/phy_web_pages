/**
 * 📈 加速度時間圖 — 觀察 a-t 圖的形狀，理解「圖下面積 = 速度變化 Δv」
 *
 * 力學圖表三部曲的第三個（03 位移時間圖、04 速度時間圖）。
 * 學生最常搞混的是：等加速度運動的 a-t 圖是「水平線」不是斜線，
 * 以及 a-t 圖下面積代表的是速度變化量，不是位移。
 *
 * 場景、鏡頭、圖表框、運動模式、控制面板都在 motion-scene.js，
 * 三頁共用同一套運動，同一個模式在三張圖上才對得起來。
 */

function initAccelerationTimeGraph() {
    MotionScene.run({

        formula: '\\Delta v = S_{a\\text{-}t} \\qquad v = v_0 + \\Delta v',
        formulaFallback: 'Δv = 圖下面積　　v = v₀ + Δv',

        titleLeft: 'a-t 圖   ACCELERATION-TIME',
        titleRight: 't (s)   a (m/s²)',

        cards: [
            { label: '時間 TIME',   id: 'cardTime',  unit: 's',     highlight: true },
            { label: '加速度 ACC',  id: 'cardA',     unit: 'm/s²',  highlight: true },
            { label: '速度 VEL',    id: 'cardV',     unit: 'm/s' },
            { label: '速度變化 Δv', id: 'cardDv',    unit: 'm/s' },
            { label: '位移 X',      id: 'cardX',     unit: 'm' },
            { label: '平均加速度',  id: 'cardAvgA',  unit: 'm/s²' },
        ],

        yOf: s => s.a,

        values: (s, panel) => {
            const dv = s.v - panel.v0;
            return {
                cardTime: s.t.toFixed(2),
                cardA:    s.a.toFixed(1),
                cardV:    s.v.toFixed(2),
                cardDv:   dv.toFixed(2),
                cardX:    s.x.toFixed(2),
                cardAvgA: (s.t > 0.05 ? dv / s.t : 0).toFixed(2),
            };
        },

        titleText: (mode) => {
            switch (mode) {
                case 'constant':   return '等速運動：a = 0，圖形貼在零線上，面積為 0 → 速度完全不變';
                case 'uniform':    return '等加速度：a 固定 → a-t 圖是水平線（不是斜線！），面積 = 速度增加量';
                case 'decelerate': return '等減速：水平線在零線下方，車子停下來後 a 跳回 0 → 變成階梯';
                case 'staged':     return '分段變速：每個轉折就是換一次加速度；正負面積相加 = 總速度變化';
                default:           return '';
            }
        },

        plot: (p, view, g, s, panel) => {
            if (s.t <= 0) return;

            // 階梯路線是精確的（不取樣），因為 a 是分段常數
            const pts = MotionScene.stepPath(panel.mode, panel.v0, panel.a, s.t);

            // 面積：正值藍、負值紅。分段模式會同時出現兩種顏色。
            MotionScene.fillSignedArea(p, view, pts, g,
                                       [37, 99, 235, 42], [239, 68, 68, 42]);
            MotionScene.curve(p, view, pts, g, [37, 99, 235]);

            // 面積的數值標在最大那塊著色區的中心，底下墊白底藍框的標籤，
            // 否則在分段模式會壓到零線和階梯的垂直線而看不清楚。
            const area = MotionScene.accelAreaAt(panel.mode, panel.v0, panel.a, s.t);
            const dom = MotionScene.dominantArea(pts);
            if (dom) {
                MotionScene.valueBadge(p, view, g.tToX(dom.t), g.yToPx(dom.y / 2),
                                       `面積 = Δv = ${area.toFixed(1)} m/s`,
                                       { size: 16, minSize: 9 });
            }

            MotionScene.marker(p, view, g.tToX(g.nowT(s.t)), g.yToPx(s.a));
        },
    });
}

initAccelerationTimeGraph();
