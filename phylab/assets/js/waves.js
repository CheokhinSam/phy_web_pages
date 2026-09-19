/**
 * 🌊 橫波與縱波 — 質點振動的方向，和波前進的方向成什麼關係？
 *
 * 這是波動學的第一頁，要建立一個非常容易被跳過的區別：
 * **波往前跑，但質點沒有跟著跑。**
 *
 *   橫波：質點上下振動，方向**垂直**於波的傳播方向（繩波、水波、光）
 *   縱波：質點左右振動，方向**平行**於波的傳播方向（聲波、彈簧波）
 *
 * 兩條 lane 吃同一組介質、同一個頻率、同一個振幅，所以波速、波長、週期
 * 完全一樣——差別**只在質點怎麼動**。並排放在一起才對得起來。
 *
 * 右邊有一張卡片是「追蹤質點的平衡位置」：它從頭到尾不會變。這是
 * 「質點只在原處振動」最直接的證據，比任何文字說明都清楚。
 *
 * 版面：
 *   橫波 lane — 波形曲線 + 質點。橫波的質點本來就在曲線上，所以珠點
 *               直接畫在曲線上，一個點都不差。
 *   縱波 lane — 質點沿著基線左右移動。看點是**相鄰質點的間距**：
 *               擠在一起就是密部，拉開就是疏部。所以這一條的珠點畫得
 *               比上面大、間距也放寬，讓「擠」和「鬆」看得出來。
 *
 * ⚠️ 縱波的位移在畫面上是**誇大**的。真實的縱波位移只有波長的千分之幾，
 *    照 1:1 畫會完全看不到，所以橫向另外用了一組放大倍率（WV_LONG_C）。
 *    這一點內文有寫，畫面上也標了。既然要在同一張圖裡用兩種比例，
 *    就得明白講出來，否則學生會以為縱波的質點真的會跑那麼遠。
 *
 * 場景、波形數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const WV_LANE_T = 300;         // 橫波的平衡位置（最大振幅 4 cm × 20 = ±80）
const WV_LANE_L = 620;         // 縱波的平衡位置

const WV_AMP_C  = 20;          // 橫波的垂直放大：世界單位 / 公分
const WV_LONG_C = 4;           // 縱波的橫向放大：世界單位 / 公分
                               // ⚠️ 這個數字有上限。相鄰質點的最大相對位移
                               //    是 A·k·Δx·WV_LONG_C，必須小於間距，否則
                               //    質點會穿過彼此。A=4cm、f=1.8Hz、v=2.4m/s
                               //    的最壞情況是間距的 0.69 倍（見 verify-waves.js）。

const WV_DOTS_T = 48;          // 橫波的質點數
const WV_DOTS_L = 32;          // 縱波的質點數（少一點、大一點，才看得出疏密）

const WV_TRACK_T = 12;         // 追蹤的橫波質點索引 → 平衡位置 2.0 m
const WV_TRACK_L = 20;         // 追蹤的縱波質點索引 → 平衡位置 5.0 m

const WV_ARROW_Y = 168;        // 橫波「波往右跑」箭頭的高度
const WV_LARROW_Y = 478;       // 縱波「波往右跑」箭頭的高度

function initWavesSimulation() {
    // 介質決定波速——不是波源。同一個波源（同一個 f）放進不同介質，
    // 波速與波長都會變，但頻率不會。三個選項就是同一條繩子的三種張力。
    const MEDIA = {
        slack: { v: 2.4, name: '鬆軟的彈簧' },
        rope:  { v: 4.0, name: '一般的繩子' },
        tight: { v: 6.4, name: '拉緊的繩子' },
    };

    /** 雙向箭頭。用來標「質點只在這個範圍裡來回」。 */
    function doubleArrow(p, view, x1, y1, x2, y2, color) {
        const head = view.len(11, 5);
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        p.stroke(color[0], color[1], color[2]);
        p.strokeWeight(view.len(3, 1.5));
        p.line(x1, y1, x2, y2);
        p.noStroke();
        p.fill(color[0], color[1], color[2]);
        for (const [ex, ey, s] of [[x2, y2, -1], [x1, y1, +1]]) {
            p.triangle(ex, ey,
                       ex + s * head * ux - head * 0.5 * uy, ey + s * head * uy + head * 0.5 * ux,
                       ex + s * head * ux + head * 0.5 * uy, ey + s * head * uy - head * 0.5 * ux);
        }
    }

    WaveScene.run({

        // 左欄只有約 250 px 寬，display mode 的公式再加 \\text 一定會爆框。
        // 中文說明放卡片標籤（「波速 V（介質決定）」），公式盒只留式子。
        formula: 'v = f\\lambda',
        formulaFallback: 'v = fλ',

        controls: {
            selects: [
                {
                    key: 'medium', label: '介質（決定波速）', def: 'slack',
                    options: [
                        { v: 'slack', t: '鬆軟的彈簧　v = 2.4 m/s' },
                        { v: 'rope',  t: '一般的繩子　v = 4.0 m/s' },
                        { v: 'tight', t: '拉緊的繩子　v = 6.4 m/s' },
                    ],
                },
            ],
            sliders: [
                { key: 'f', label: '頻率 <i>f</i>', unit: 'Hz', min: 0.5, max: 1.8, step: 0.1, def: 1.2, dec: 1 },
                { key: 'A', label: '振幅 <i>A</i>', unit: 'cm', min: 1, max: 4, step: 0.5, def: 3, dec: 1 },
            ],
        },

        cards: [
            { label: '時間 TIME',            id: 'cardTime',  unit: 's',   highlight: true },
            { label: '波速 V（介質決定）',   id: 'cardV',     unit: 'm/s', highlight: true },
            { label: '頻率 F',               id: 'cardF',     unit: 'Hz' },
            { label: '週期 T',               id: 'cardT',     unit: 's' },
            { label: '波長 Λ',               id: 'cardLambda', unit: 'm' },
            { label: '橫波質點位移 Y',       id: 'cardY',     unit: 'cm' },
            { label: '縱波質點位移 Ξ',       id: 'cardXi',    unit: 'cm' },
            { label: '追蹤質點的平衡位置',   id: 'cardAnchor', unit: 'm' },
        ],

        values(t, panel) {
            const m = MEDIA[panel.medium] || MEDIA.slack;
            const lam = m.v / panel.f;
            const k = WaveScene.waveNumber(panel.f, m.v);
            // 兩個追蹤質點吃同一條波，但站在不同的 x，所以相位不同。
            // 這兩個數字會一起上下、但不會同相——順便解釋了「波是空間上
            // 有相位差的振動」。
            const xT = WaveScene.ROPE_M * WV_TRACK_T / WV_DOTS_T;
            const xL = WaveScene.ROPE_M * WV_TRACK_L / WV_DOTS_L;
            const disp = x => panel.A * Math.sin(k * (x - m.v * t));

            return {
                cardTime:   t.toFixed(2),
                cardV:      m.v.toFixed(2),
                cardF:      panel.f.toFixed(1),
                cardT:      (1 / panel.f).toFixed(2),
                cardLambda: lam.toFixed(2),
                cardY:      disp(xT).toFixed(2),
                cardXi:     disp(xL).toFixed(2),
                // 這張卡片從頭到尾都是同一個數字。它不變，就是重點。
                cardAnchor: `${xT.toFixed(2)} / ${xL.toFixed(2)}`,
            };
        },

        titleText(t, panel) {
            const m = MEDIA[panel.medium] || MEDIA.slack;
            const lam = m.v / panel.f;
            const front = m.v * t;                 // 波前已經跑到哪裡

            if (t < 0.05) {
                return `同一個波源、同一條介質：上面是橫波，下面是縱波——按下開始，`
                     + `只盯著橘色那顆質點看它會不會被波帶走`;
            }
            if (front < WaveScene.ROPE_M) {
                return `波前已經跑到 ${front.toFixed(2)} m，波形以 ${m.v.toFixed(2)} m/s 前進`
                     + `——但質點只在原地來回振動，一個都沒有跟著跑`;
            }
            return `v = fλ：f = ${panel.f.toFixed(1)} Hz、λ = ${lam.toFixed(2)} m、`
                 + `v = ${m.v.toFixed(2)} m/s；兩種波的波速一樣，只有質點動的方向不同`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const m = MEDIA[panel.medium] || MEDIA.slack;
            const lam = m.v / panel.f;
            const k = TS.waveNumber(panel.f, m.v);
            const A = panel.A;

            // 同一條波餵給兩條 lane。env 讓波前是乾淨的：u > 0 代表波還沒到。
            const wv = TS.traveling({
                A, k, v: m.v, dir: +1, x0: 0,
                env: u => (u > 0 ? 0 : 1),
            });

            const xTrackT = TS.ROPE_M * WV_TRACK_T / WV_DOTS_T;
            const xTrackL = TS.ROPE_M * WV_TRACK_L / WV_DOTS_L;

            // ================================================================
            // 橫波
            // ================================================================
            TS.drawBaseline(p, view, WV_LANE_T);
            TS.drawWave(p, view, TS.sample(wv, 0, TS.ROPE_M, t, lam),
                { baseY: WV_LANE_T, ampScale: WV_AMP_C, color: [147, 197, 253], weight: 3 });
            TS.drawBeads(p, view, wv, t, {
                baseY: WV_LANE_T, ampScale: WV_AMP_C, n: WV_DOTS_T,
                color: [37, 99, 235], radius: 6,
                highlight: { index: WV_TRACK_T, color: [234, 88, 12] },
            });
            TS.drawLaneLabel(p, view, WV_LANE_T, '橫波', [37, 99, 235]);

            TS.drawTravelArrow(p, view, 1.1, WV_ARROW_Y, +1,
                `波形以 ${m.v.toFixed(2)} m/s 往右跑`, [148, 163, 184]);

            // 質點振動方向：從平衡位置到它現在的位置，畫一支雙向箭頭
            const yT = wv(xTrackT, t);
            const sxT = TS.ropeX(view, xTrackT);
            const syT = view.toScreenY(TS.laneY(WV_LANE_T, WV_AMP_C, yT));
            const baseT = view.toScreenY(WV_LANE_T);
            doubleArrow(p, view, sxT, baseT, sxT, syT, [234, 88, 12]);
            // 「⊥／∥」直接寫進徽章裡，不另外飄一行文字。原本那兩行自由文字
            // 分別撞上 λ 括號和疏部徽章——而徽章本來就寫著「上下振動」／
            // 「左右振動」，方向已經講白了，多一行只是多一個碰撞來源。
            TS.valueBadge(p, view, sxT + view.len(16, 8), syT - view.len(26, 13),
                `⊥ 上下振動 ${yT >= 0 ? '+' : ''}${yT.toFixed(1)} cm`, { size: 15 });

            // 波長括號
            if (0.3 + lam <= TS.ROPE_M - 0.3) {
                TS.wavelengthBracket(p, view, 0.3, 0.3 + lam, WV_LANE_T + 100,
                    `λ = ${lam.toFixed(2)} m`, { color: [37, 99, 235], above: false });
            }

            // ================================================================
            // 縱波
            // ================================================================
            TS.drawBaseline(p, view, WV_LANE_L);
            TS.drawLaneLabel(p, view, WV_LANE_L, '縱波', [234, 88, 12]);
            TS.drawTravelArrow(p, view, 1.1, WV_LARROW_Y, +1,
                `波形以 ${m.v.toFixed(2)} m/s 往右跑`, [148, 163, 184]);

            // 質點位置 = 平衡位置 + 位移。位移是**橫向**的，所以直接加在 x 上。
            // 間距比 1 小的地方就是密部；用「實際畫出來的間距」上色，不要去算
            // 解析的應變——這樣不管波形長怎樣，顏色都跟眼睛看到的一致。
            const eqGapW = (TS.ROPE_M / WV_DOTS_L) * TS.X_SCALE;
            const beads = [];
            for (let i = 0; i <= WV_DOTS_L; i++) {
                const xe = TS.ROPE_M * i / WV_DOTS_L;
                beads.push({ xe, xi: wv(xe, t) });
            }
            for (let i = 0; i < beads.length - 1; i++) {
                const a = beads[i], b = beads[i + 1];
                const xa = TS.ropeX(view, a.xe) + a.xi * WV_LONG_C;
                const xb = TS.ropeX(view, b.xe) + b.xi * WV_LONG_C;
                const bunch = 1 - (xb - xa) / eqGapW;         // > 0 = 擠在一起
                const alpha = Math.max(0, Math.min(1, bunch)) * 0.34;
                if (alpha < 0.01) continue;
                const halfH = view.len(30, 14);
                p.noStroke();
                p.fill(234, 88, 12, alpha * 255);
                p.rect(xa, view.toScreenY(WV_LANE_L) - halfH,
                       xb - xa, halfH * 2);
            }
            for (const b of beads) {
                const sx = TS.ropeX(view, b.xe) + b.xi * WV_LONG_C;
                const sy = view.toScreenY(WV_LANE_L);
                const isTracked = Math.abs(b.xe - xTrackL) < 1e-9;
                p.noStroke();
                if (isTracked) {
                    p.fill(234, 88, 12);
                    p.circle(sx, sy, view.len(26, 12));
                    p.fill(255);
                    p.circle(sx, sy, view.len(11, 5));
                } else {
                    p.fill(234, 88, 12);
                    p.circle(sx, sy, view.len(15, 7));
                }
            }

            // 密部／疏部：站在真正的壓縮點上，不是固定的 25% / 75%。
            // ξ = A sin(k(x − vt))、應變 ∂ξ/∂x = Ak cos(k(x − vt))。
            // 間距變成 Δx(1 + ∂ξ/∂x)，所以**應變為負**的地方才是擠在一起的密部。
            // 徽章的位置：每隔 λ 就重複一次，所以不缺候選，挑一個最好的就好。
            //   1. 一定要在繩子裡（留 0.5 m 邊界，徽章本身有寬度）
            //   2. 離追蹤質點 0.9 m 以上——那裡的上下兩列已經被
            //      「∥ 左右振動」徽章佔住，擺過去一定疊字
            //   3. 其餘的挑最靠近繩子中點的，視線最順
            // ⚠️ 候選數量要看 λ：λ 大（v 大、f 小）時繩子上只有兩三個密部，
            //    原本寫死 j < 3 會在 v = 6.4、f = 1.8 的組合下全部落空，
            //    「密部」徽章就整個不見了。多找幾個再挑。
            const syL = view.toScreenY(WV_LANE_L);
            const badgeY = syL + view.len(64, 31);
            const pickNear = (fn, skipTrack, avoid) => {
                let best = null, bestD = Infinity;
                for (let j = 0; j < 8; j++) {
                    const x = fn(j);
                    if (x < 0.5 || x > TS.ROPE_M - 0.5) continue;
                    if (skipTrack && Math.abs(x - xTrackL) <= 0.9) continue;
                    // 密部與疏部只差 λ/2，λ 短的時候兩個徽章會疊在一起，
                    // 所以第二個要避開第一個已經佔掉的位置。
                    if (avoid != null && Math.abs(x - avoid) <= 0.8) continue;
                    const d = Math.abs(x - TS.ROPE_M / 2);
                    if (d < bestD) { bestD = d; best = x; }
                }
                return best;
            };
            const comp = j => m.v * t - (j + 0.5) * lam;   // 應變 = −1 → 密部
            const rare = j => m.v * t - j * lam;           // 應變 = +1 → 疏部
            const xc = pickNear(comp, true, null) ?? pickNear(comp, false, null);
            if (xc != null) {
                TS.valueBadge(p, view, TS.ropeX(view, xc), badgeY,
                    '密部', { size: 14, stroke: [234, 88, 12], fillColor: [194, 65, 12] });
            }
            const xr = pickNear(rare, true, xc) ?? pickNear(rare, false, xc);
            if (xr != null) {
                TS.valueBadge(p, view, TS.ropeX(view, xr), badgeY,
                    '疏部', { size: 14, stroke: [148, 163, 184], fillColor: [100, 116, 139] });
            }

            // 追蹤質點的振動範圍（橫向的雙向箭頭）
            const xiL = wv(xTrackL, t);
            const sxL = TS.ropeX(view, xTrackL);
            const nowL = sxL + xiL * WV_LONG_C;
            doubleArrow(p, view, sxL, syL, nowL, syL, [234, 88, 12]);
            TS.valueBadge(p, view, nowL + view.len(18, 9), syL - view.len(30, 15),
                `∥ 左右振動 ${xiL >= 0 ? '+' : ''}${xiL.toFixed(1)} cm`, { size: 15 });

            // 縱波也用波長括號標一次：兩個相鄰的密部距離就是 λ。
            // 這比在紙上量波形更有說服力——學生在畫面上真的量得到。
            let found = 0;
            for (let j = 0; j < 4 && found === 0; j++) {
                const x1 = m.v * t - (j + 0.5) * lam;
                const x2 = x1 - lam;
                if (x2 < 0.4) continue;
                TS.wavelengthBracket(p, view, x2, x1, WV_LANE_L - 75,
                    `相鄰密部距離 = λ = ${lam.toFixed(2)} m`,
                    { color: [234, 88, 12], above: true, size: 15 });
                found = 1;
            }
        },
    });
}

initWavesSimulation();
