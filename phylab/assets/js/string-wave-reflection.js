/**
 * 🪢 繩波的反射 — 固定端會把波「上下翻過來」，自由端不會
 *
 * 這頁要學生看到兩件事：
 *   1. 波撞到**固定端**反彈回來時，波形上下反轉：上去的脈衝回來變成
 *      下去的。端點從頭到尾不動。
 *   2. 波撞到**自由端**反彈回來時，波形原封不動：上去的回來還是上去的。
 *      端點是整條繩子上動得最厲害的地方。
 *
 * 兩者的差別可以一句話講完：**端點能不能動，決定反射要不要反轉。**
 * 這也解釋了為什麼 08 的駐波兩端一定是節點——那裡是固定端。
 *
 * 畫面上有兩條 lane：上面是實際的繩子（合成），下面是分解——
 * 入射波與反射波各自畫出來。分解那條 lane 會把入射波畫到端點右邊去，
 * 那是「如果沒有端點，它本來會繼續走」的虛像，用來對照反射波的形狀。
 *
 * 場景、波的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const SR_END = 6.0;            // 端點的位置（公尺）。繩子只到這裡為止，
                               // 6.0～8.0 那段空白留給入射波的虛像。
const SR_LANE_ROPE = 300;      // 實際繩子的平衡位置
const SR_LANE_DECO = 620;      // 分解（入射／反射）的平衡位置

const SR_AMP_C = 11;           // 垂直放大：世界單位 / 公分
                               // 自由端反彈的瞬間位移會到 2A，3.5 cm × 2 × 11 = 77

const SR_X0_PULSE = 0.5;       // 脈衝的起點（公尺）

function initStringWaveReflection() {
    const T = 4, MU = 0.25;    // v = 4.00 m/s

    /**
     * 這一頁的波。入射與反射都由 wave-scene 的 scatter() 產生，
     * 端點就是它的「界面」：固定端 r = −1、自由端 r = +1。
     */
    function buildWaves(panel) {
        const m = WaveScene.medium(T, MU);
        const r = panel.endType === 'free' ? 1 : -1;
        const isPulse = panel.shape === 'pulse';
        const x0 = isPulse ? SR_X0_PULSE : 0;
        const sc = WaveScene.scatter({
            A: panel.A, v1: m.v, v2: m.v, xj: SR_END, x0, r, tau: 1 + r,
            shape: isPulse ? WaveScene.pulseShape(panel.width)
                           : WaveScene.waveShape(panel.f, m.v),
        });
        // 取樣密度：跟著最短的空間尺度走
        const scale = isPulse ? panel.width / 4 : m.v / panel.f;
        return { m, r, sc, isPulse, x0, scale };
    }

    WaveScene.run({

        // 左欄只有約 250 px 寬。原本寫成 `-1 \text{（固定端）}`，全角括號
        // 讓式子寬到爆框（截圖可見右邊被切掉）。去掉括號、縮短間距就會過。
        formula: 'r = \\frac{Z_1 - Z_2}{Z_1 + Z_2} \\quad -1\\text{ 固定端} \\quad +1\\text{ 自由端}',
        formulaFallback: '固定端 r = −1（相位反轉）　自由端 r = +1（不反轉）',

        controls: {
            selects: [
                {
                    key: 'endType', label: '端點是哪一種', def: 'fixed',
                    options: [
                        { v: 'fixed', t: '固定端（釘在牆上）' },
                        { v: 'free', t: '自由端（套在光滑桿上）' },
                    ],
                },
                {
                    key: 'shape', label: '波形', def: 'pulse',
                    options: [
                        { v: 'pulse', t: '單一脈衝' },
                        { v: 'wave', t: '連續波' },
                    ],
                },
            ],
            sliders: [
                { key: 'A', label: '振幅 <i>A</i>', unit: 'cm', min: 1, max: 3.5, step: 0.5, def: 2.5, dec: 1 },
                { key: 'width', label: '脈衝寬度 <i>w</i>', unit: 'm', min: 0.3, max: 1.2, step: 0.1, def: 0.6 },
                { key: 'f', label: '頻率 <i>f</i>（連續波用）', unit: 'Hz', min: 0.2, max: 1.2, step: 0.05, def: 0.5, dec: 2 },
            ],
        },

        cards: [
            { label: '時間 TIME',     id: 'cardTime',  unit: 's',   highlight: true },
            { label: '波速 V',        id: 'cardV',     unit: 'm/s', highlight: true },
            { label: '端點類型',      id: 'cardEnd',   unit: '' },
            { label: '反射係數 R',    id: 'cardR',     unit: '' },
            { label: '入射振幅',      id: 'cardA',     unit: 'cm' },
            { label: '反射振幅',      id: 'cardAref',  unit: 'cm' },
            { label: '端點位移',      id: 'cardYend',  unit: 'cm' },
            { label: '狀態',          id: 'cardState', unit: '' },
        ],

        values(t, panel) {
            const { m, r, sc, isPulse, x0 } = buildWaves(panel);
            const tArrive = (SR_END - x0) / m.v;
            const yEnd = sc.incident(SR_END, t) + sc.reflected(SR_END, t);

            let state;
            if (t < tArrive) {
                state = '還沒到端點';
            } else if (isPulse) {
                state = (t > tArrive + SR_END / m.v) ? '已經離開' : '正在反射';
            } else {
                state = '持續反射中';
            }

            return {
                cardTime: t.toFixed(2),
                cardV:    m.v.toFixed(2),
                cardEnd:  panel.endType === 'free' ? '自由端' : '固定端',
                cardR:    r > 0 ? '+1' : '−1',
                cardA:    panel.A.toFixed(1),
                cardAref: Math.abs(r * panel.A).toFixed(1),
                cardYend: yEnd.toFixed(2),
                cardState: state,
            };
        },

        titleText(t, panel) {
            const { m, sc, isPulse, x0 } = buildWaves(panel);
            const tArrive = (SR_END - x0) / m.v;
            const fixed = panel.endType !== 'free';

            if (t < 0.05) {
                return isPulse
                    ? `脈衝以 ${m.v.toFixed(2)} m/s 往右跑，端點是${fixed ? '固定端' : '自由端'}——按下開始，看它反彈回來的樣子`
                    : `連續波以 ${m.v.toFixed(2)} m/s 往右跑，端點是${fixed ? '固定端' : '自由端'}——看它在端點堆出什麼圖形`;
            }
            if (t < tArrive) {
                return `脈衝還在路上，再 ${((tArrive - t) * m.v).toFixed(2)} m 就撞到端點——注意下面那條虛線是入射波`;
            }
            if (fixed) {
                return isPulse
                    ? `撞上固定端：反射波上下反轉（波峰變波谷），端點全程不動——這正是 r = −1 的意思`
                    : `固定端是節點：入射波和反射波在這裡永遠一上一下互相抵銷，繩子再也沒有波跑出來`;
            }
            return isPulse
                ? `撞上自由端：反射波原封不動（波峰回來還是波峰），端點衝到將近兩倍振幅——r = +1`
                : `自由端是腹點：入射波和反射波在這裡同相，端點振幅變成兩倍——繩子看起來像在「甩尾」`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const { m, sc, isPulse, x0 } = buildWaves(panel);
            const fixed = panel.endType !== 'free';
            const tArrive = (SR_END - x0) / m.v;

            const inc = sc.incident, ref = sc.reflected;
            const sum = (x, tt) => inc(x, tt) + ref(x, tt);
            const scale = isPulse ? panel.width / 4 : m.v / panel.f;

            // ------------------------------------------------------------
            // 端點（畫在兩條 lane 之間，貫穿）
            // ------------------------------------------------------------
            TS.drawEndpoint(p, view, SR_END, SR_LANE_ROPE, fixed ? 'fixed' : 'free');
            TS.drawEndpoint(p, view, SR_END, SR_LANE_DECO, fixed ? 'fixed' : 'free');

            // ------------------------------------------------------------
            // lane 0：實際的繩子（入射 + 反射）
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, SR_LANE_ROPE, 0, SR_END);
            TS.drawWave(p, view, TS.sample(sum, 0, SR_END, t, scale),
                { baseY: SR_LANE_ROPE, ampScale: SR_AMP_C, color: [15, 23, 42], weight: 5 });
            TS.drawLaneLabel(p, view, SR_LANE_ROPE, '繩子', [15, 23, 42]);
            // 珠點只鋪到端點為止。不傳 x1m 的話會一路鋪到 8 m，
            // 在牆的右邊留一排浮著的灰點，看起來像繩子還繼續延伸。
            TS.drawBeads(p, view, sum, t,
                { baseY: SR_LANE_ROPE, ampScale: SR_AMP_C, n: 20,
                  x0m: 0, x1m: SR_END, color: [148, 163, 184], radius: 4 });

            // 端點位移：固定端固定是 0.00，自由端會衝到兩倍
            const yEnd = sum(SR_END, t);
            TS.valueBadge(p, view, TS.ropeX(view, SR_END) - view.len(34, 16),
                view.toScreenY(SR_LANE_ROPE + 96),
                `端點位移 ${yEnd.toFixed(2)} cm`, { size: 15, align: 'right' });

            // ------------------------------------------------------------
            // lane 1：分解——入射波與反射波各自畫
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, SR_LANE_DECO);
            TS.drawWave(p, view, TS.sample(inc, 0, TS.ROPE_M, t, scale),
                { baseY: SR_LANE_DECO, ampScale: SR_AMP_C, color: [37, 99, 235], weight: 3, dash: 8 });
            TS.drawWave(p, view, TS.sample(ref, 0, TS.ROPE_M, t, scale),
                { baseY: SR_LANE_DECO, ampScale: SR_AMP_C, color: [234, 88, 12], weight: 3, dash: 8 });

            // 端點右邊那段是入射波的「虛像」：沒有端點的話它本來會這樣走過去
            p.stroke(226, 232, 240);
            p.strokeWeight(view.len(1.5, 1));
            p.line(TS.ropeX(view, SR_END), view.toScreenY(SR_LANE_DECO - 90),
                   TS.ropeX(view, SR_END), view.toScreenY(SR_LANE_DECO + 90));
            p.noStroke();
            p.fill(148, 163, 184);
            p.textSize(view.len(13, 8));
            p.textStyle(p.NORMAL);
            p.textAlign(p.LEFT, p.TOP);
            p.text('入射波的虛像 →', TS.ropeX(view, SR_END) + view.len(8, 4),
                   view.toScreenY(SR_LANE_DECO - 96));

            TS.drawLaneLabel(p, view, SR_LANE_DECO, '分解', [100, 116, 139]);
            TS.valueBadge(p, view, TS.ropeX(view, 1.2),
                view.toScreenY(SR_LANE_DECO - 52), '入射波', { size: 15, stroke: [37, 99, 235], fillColor: [37, 99, 235] });
            if (t > tArrive) {
                TS.valueBadge(p, view, TS.ropeX(view, 1.2),
                    view.toScreenY(SR_LANE_DECO + 52), '反射波',
                    { size: 15, stroke: [234, 88, 12], fillColor: [234, 88, 12] });
            }

            // ------------------------------------------------------------
            // 方向箭頭
            // ------------------------------------------------------------
            if (t < tArrive) {
                TS.drawTravelArrow(p, view, Math.min(m.v * t, SR_END - 0.6), SR_LANE_ROPE - 128, +1,
                    fixed ? '撞上固定端會反轉' : '撞上自由端不反轉', [100, 116, 139]);
            } else if (isPulse) {
                TS.drawTravelArrow(p, view, Math.max(SR_END - m.v * (t - tArrive), 1.2), SR_LANE_ROPE - 128, -1,
                    `反射波往回跑 ${m.v.toFixed(2)} m/s`, [234, 88, 12]);
            } else {
                TS.drawTravelArrow(p, view, SR_END - 1.4, SR_LANE_ROPE - 128, -1,
                    '反射波往回跑', [234, 88, 12]);
            }
        },
    });
}

initStringWaveReflection();
