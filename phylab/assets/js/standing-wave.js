/**
 * 🪢 駐波與諧音 — 兩端固定時，只有特定的波長活得住
 *
 * 這頁要學生看到四件事：
 *   1. 兩端固定時，波長被繩長鎖死：L = nλ/2，只有 λ = 2L/n 這幾個值
 *      能在繩上留下穩定的圖形。其他的波長會互相干涉、抵銷掉。
 *   2. 圖形**不會跑**——波峰波谷停在原地上下跳，這就是「駐」波。
 *   3. **節點永遠不動**（振幅 0），腹點振幅最大。節點間距剛好是 λ/2。
 *   4. 駐波不是新的波，它就是兩個反向行進波疊加出來的：
 *      y = (A/2)sin(kx−ωt) + (A/2)sin(kx+ωt) = A sin(kx)cos(ωt)。
 *      下面那條 lane 就是這個分解。
 *
 * 另外可以做「一端固定、一端自由」的對照：那時候 L = (2n−1)λ/4，
 * 只有**奇數倍**的頻率能共振——這就是為什麼同樣一根管子，一端開口
 * 和兩端封閉吹出來的音高不一樣。
 *
 * 場景、波的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const SW_L = 8.0;              // 繩長（公尺），兩端固定在 0 與 8
const SW_LANE_MODE = 300;      // 駐波
const SW_LANE_DECO = 620;      // 分解成兩個行進波

const SW_AMP_C = 13;           // 垂直放大：世界單位 / 公分（最大振幅 6 cm → ±78）

function initStandingWave() {
    const T = 16, MU = 0.25;   // v = 8.00 m/s

    /**
     * 這一頁的駐波。
     *
     * 兩端固定時 k = nπ/L（繩長裡剛好塞進 n 個半波長）；
     * 一端自由時 k = (2n−1)π/(2L)（只塞得進奇數個四分之一波長）。
     * ω 不能亂給——它由 v 和 k 綁死：ω = vk = 2πf。
     */
    function buildMode(panel) {
        const m = WaveScene.medium(T, MU);
        const freeEnd = panel.endType === 'free';
        const k = freeEnd ? (2 * panel.n - 1) * Math.PI / (2 * SW_L)
                          : panel.n * Math.PI / SW_L;
        const w = m.v * k;
        const lambda = 2 * Math.PI / k;
        const y = (x, t) => panel.A * Math.sin(k * x) * Math.cos(w * t);
        // 兩個反向行進波，振幅各是腹點的一半，相加剛好等於 y
        const right = WaveScene.traveling({ A: panel.A / 2, k, v: m.v, dir: +1, x0: 0 });
        const left  = WaveScene.traveling({ A: panel.A / 2, k, v: m.v, dir: -1, x0: 0 });
        const nodeCount = freeEnd ? panel.n : panel.n + 1;
        const harmonic = freeEnd ? 2 * panel.n - 1 : panel.n;
        return { m, k, w, lambda, y, right, left, freeEnd, nodeCount, harmonic };
    }

    WaveScene.run({

        formula: 'y = A\\sin(kx)\\cos(\\omega t) \\qquad L = n\\frac{\\lambda}{2}',
        formulaFallback: 'y = A sin(kx) cos(ωt)　　L = n λ/2',

        controls: {
            selects: [
                {
                    key: 'endType', label: '兩端怎麼固定', def: 'fixed',
                    options: [
                        { v: 'fixed', t: '兩端都固定' },
                        { v: 'free', t: '左端固定、右端自由' },
                    ],
                },
            ],
            sliders: [
                { key: 'n', label: '模式 <i>n</i>', unit: '', min: 1, max: 5, step: 1, def: 2, dec: 0 },
                { key: 'A', label: '腹點振幅 <i>A</i>', unit: 'cm', min: 1, max: 6, step: 0.5, def: 4, dec: 1 },
            ],
        },

        cards: [
            { label: '時間 TIME',     id: 'cardTime',      unit: 's',   highlight: true },
            { label: '波速 V',        id: 'cardV',         unit: 'm/s', highlight: true },
            { label: '模式 N',        id: 'cardMode',      unit: '' },
            { label: '諧音倍數',      id: 'cardHarmonic',  unit: '倍' },
            { label: '波長 Λ',        id: 'cardLambda',    unit: 'm' },
            { label: '頻率 F',        id: 'cardF',         unit: 'Hz' },
            { label: '腹點振幅',      id: 'cardAntinode',  unit: 'cm' },
            { label: '節點數',        id: 'cardNodes',     unit: '個' },
        ],

        values(t, panel) {
            const { m, lambda, harmonic, nodeCount } = buildMode(panel);
            return {
                cardTime:     t.toFixed(2),
                cardV:        m.v.toFixed(2),
                cardMode:     String(panel.n),
                cardHarmonic: String(harmonic),
                cardLambda:   lambda.toFixed(2),
                cardF:        (m.v / lambda).toFixed(2),
                // 腹點振幅就是兩個行進波振幅相加：A/2 + A/2 = A
                cardAntinode: panel.A.toFixed(1),
                cardNodes:    String(nodeCount),
            };
        },

        titleText(t, panel) {
            const { m, lambda, freeEnd, harmonic } = buildMode(panel);
            const f = m.v / lambda;
            if (t < 0.05) {
                const rule = freeEnd ? 'L = (2n−1)λ/4' : 'L = nλ/2';
                return `${rule}：波長被繩長鎖死成 λ = ${lambda.toFixed(2)} m，`
                     + `弦上剛好留下 ${freeEnd ? '奇數個' : panel.n + ' 個'}半波長——按下開始，繩子只會原地上下跳`;
            }
            if (freeEnd) {
                return `一端自由：只有奇數倍頻率能共振，這是第 ${harmonic} 諧音（λ = 4L/${harmonic} = ${lambda.toFixed(2)} m，`
                     + `f = ${f.toFixed(2)} Hz）——右端是腹點，動得最厲害`;
            }
            return `兩端固定：L = ${panel.n}×λ/2 → λ = ${lambda.toFixed(2)} m，f = ${f.toFixed(2)} Hz；`
                 + `節點永遠不動、相鄰節點間距剛好 λ/2 = ${(lambda / 2).toFixed(2)} m`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const { m, k, lambda, y, right, left, freeEnd } = buildMode(panel);
            const nodeCount = freeEnd ? panel.n : panel.n + 1;

            // ------------------------------------------------------------
            // lane 0：駐波
            // ------------------------------------------------------------
            drawEndpointAt(p, view, 0, SW_LANE_MODE, 'fixed', 0);
            drawEndpointAt(p, view, SW_L, SW_LANE_MODE, freeEnd ? 'free' : 'fixed',
                           freeEnd ? y(SW_L, t) : 0);

            TS.drawBaseline(p, view, SW_LANE_MODE);

            // 振幅包絡線：繩子只會在這個信封裡面上上下下
            drawEnvelope(p, view, panel.A, k);

            TS.drawWave(p, view, TS.sample(y, 0, SW_L, t, lambda),
                { baseY: SW_LANE_MODE, ampScale: SW_AMP_C, color: [15, 23, 42], weight: 5 });
            TS.drawLaneLabel(p, view, SW_LANE_MODE, '駐波', [15, 23, 42]);

            // 節點：永遠不動的點
            const nodeX = m => (freeEnd ? m * SW_L / (panel.n - 0.5) : m * SW_L / panel.n);
            p.noStroke();
            p.fill(220, 38, 38);
            for (let i = 0; i < nodeCount; i++) {
                p.circle(TS.ropeX(view, nodeX(i)), view.toScreenY(SW_LANE_MODE), view.len(17, 8));
            }
            p.noStroke();
            p.fill(220, 38, 38);
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('紅點 = 節點，永遠不動', TS.ropeX(view, 0) + view.len(14, 7),
                   view.toScreenY(SW_LANE_MODE + 96));

            // λ/2 括號：標在相鄰兩個節點之間
            if (nodeCount >= 2) {
                const a = nodeX(0), b = nodeX(1);
                if (b <= SW_L + 1e-9) {
                    TS.wavelengthBracket(p, view, a, b, SW_LANE_MODE - 108,
                        `相鄰節點間距 = λ/2 = ${(lambda / 2).toFixed(2)} m`,
                        { color: [220, 38, 38], above: true, size: 15 });
                }
            }

            // 腹點標記
            const antiX = freeEnd ? SW_L : SW_L / (2 * panel.n);
            if (!freeEnd) {
                TS.valueBadge(p, view, TS.ropeX(view, antiX),
                    view.toScreenY(SW_LANE_MODE - SW_AMP_C * panel.A - 30),
                    `腹點振幅 ${panel.A.toFixed(1)} cm`, { size: 14, stroke: [22, 163, 74], fillColor: [21, 128, 61] });
            }

            // ------------------------------------------------------------
            // lane 1：分解成兩個反向行進波
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, SW_LANE_DECO);
            TS.drawWave(p, view, TS.sample(right, 0, SW_L, t, lambda),
                { baseY: SW_LANE_DECO, ampScale: SW_AMP_C, color: [147, 197, 253], weight: 2.5, dash: 9 });
            TS.drawWave(p, view, TS.sample(left, 0, SW_L, t, lambda),
                { baseY: SW_LANE_DECO, ampScale: SW_AMP_C, color: [253, 186, 116], weight: 2.5, dash: 9 });
            TS.drawWave(p, view, TS.sample((x, tt) => right(x, tt) + left(x, tt), 0, SW_L, t, lambda),
                { baseY: SW_LANE_DECO, ampScale: SW_AMP_C, color: [15, 23, 42], weight: 3 });

            TS.drawLaneLabel(p, view, SW_LANE_DECO, '分解', [100, 116, 139]);
            TS.drawTravelArrow(p, view, SW_L * 0.25, SW_LANE_DECO - 120, +1, '往右', [147, 197, 253]);
            TS.drawTravelArrow(p, view, SW_L * 0.75, SW_LANE_DECO - 120, -1, '往左', [253, 186, 116]);
            p.noStroke();
            p.fill(100, 116, 139);
            p.textSize(view.len(14, 8));
            p.textStyle(p.NORMAL);
            p.textAlign(p.CENTER, p.TOP);
            p.text('兩個行進波相加 = 上面那條駐波',
                   TS.ropeX(view, SW_L / 2), view.toScreenY(SW_LANE_DECO + 118));
        },
    });

    /** 振幅包絡：±A sin(kx) 的兩條淡虛線。 */
    function drawEnvelope(p, view, A, k) {
        const ctx = p.drawingContext;
        ctx.save();
        ctx.setLineDash([view.len(8, 3), view.len(7, 3)]);
        // ⚠️ p5 的 endShape() 不帶參數時「不閉合」只影響描邊，填色仍然會
        //    把路徑自動閉合後填滿。這裡不關掉 fill 的話，上下兩條包絡各自
        //    被填成一塊透鏡，兩塊疊起來剛好是 ±A|sin(kx)| 的實心區域——
        //    看起來就像繩子被畫成一大條深色香蕉，而不是一條線。
        //    （繼承到的 fill 是 drawEndpoint 留下的 (30,41,59)。）
        p.noFill();
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(2, 1));
        for (const sign of [+1, -1]) {
            p.beginShape();
            for (let i = 0; i <= 120; i++) {
                const x = SW_L * i / 120;
                const env = sign * A * Math.abs(Math.sin(k * x));
                p.vertex(WaveScene.ropeX(view, x),
                         view.toScreenY(WaveScene.laneY(SW_LANE_MODE, SW_AMP_C, env)));
            }
            p.endShape();
        }
        ctx.restore();
    }

    /**
     * 端點。自由端要跟著繩子跑——那裡本來就是腹點，畫在平衡位置上
     * 會完全誤導（看起來像釘住了）。
     */
    function drawEndpointAt(p, view, xm, baseY, type, disp) {
        if (type === 'fixed') {
            WaveScene.drawEndpoint(p, view, xm, baseY, 'fixed');
            return;
        }
        const sx = WaveScene.ropeX(view, xm);
        const sy = view.toScreenY(WaveScene.laneY(baseY, SW_AMP_C, disp));
        const h = view.len(70, 30);
        p.stroke(100, 116, 139);
        p.strokeWeight(view.len(4, 2));
        p.line(sx + view.len(10, 5), view.toScreenY(baseY - h), sx + view.len(10, 5), view.toScreenY(baseY + h));
        p.noFill();
        p.stroke(37, 99, 235);
        p.strokeWeight(view.len(5, 2));
        p.circle(sx, sy, view.len(26, 12));
        p.noStroke();
        p.fill(37, 99, 235);
        p.textSize(view.len(15, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.CENTER);
        p.text('自由端', sx + view.len(20, 9), view.toScreenY(baseY + h));
    }
}

initStandingWave();
