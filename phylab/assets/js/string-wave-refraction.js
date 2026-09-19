/**
 * 🪢 繩波的折射與透射 — 換一段繩子，波速變、波長變，但頻率不變
 *
 * 一維的繩波沒有二維的「方向偏折」（Snell 定律要二維才成立，水波那兩頁
 * 講過了）。一維真正該看的是另一組東西：
 *
 *   1. 繩子接到另一段線密度不同的繩子時，張力不變、波速改變。
 *   2. **頻率由波源決定，跨介面不變**——介面兩側每秒被抖動的次數當然一樣。
 *   3. 既然 v 變了、f 不變，由 v = fλ 可知**波長必須跟著變**，λ₁/λ₂ = v₁/v₂。
 *   4. 波不會全部透射：一部分反射回去、一部分透射過去，
 *      r = (Z₁−Z₂)/(Z₁+Z₂)，而且 1 + r = τ、P_in = P_re + P_tr。
 *
 * 畫面上兩條 lane：上面是實際的繩子（左段與右段不同色），下面是分解——
 * 入射、反射、透射各自畫出來。分解那條會把入射波一路畫到繩子右端去，
 * 那是「如果沒有接點，它本來會繼續走」的虛像，拿來和透射波對照
 * 就可以一眼看出波長變了、但每秒的起伏次數沒變。
 *
 * 波形有兩種模式，切換的是**看到的是哪一件事**：
 *   單一脈衝（預設）— 一個脈衝撞上接點，當場裂成兩個：一個反射回去
 *                      （振幅 ×|r|，μ₁ < μ₂ 時相位反轉），一個透射過去
 *                      （振幅 ×τ，在空間上被壓窄 v₂/v₁ 倍）。脈衝沒有
 *                      「波長」可言，所以 λ 與 f 的卡片與標註會收起來。
 *   連續波        — 看的是波長：λ₁/λ₂ = v₁/v₂，但 f 兩側一模一樣。
 * 兩者共用 scatter() 的同一條式子，只是把波形函式換掉（見 wave-scene.js）。
 *
 * 場景、波的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
// 接點的位置（公尺）。刻意偏右：左段是波速快的那一段，λ₁ 也最長，
// 接點若擺在 3.2 m，λ₁（預設 2.98 m）幾乎和整段一樣長，波長括號
// 根本放不下——而「波長變了」正是這一頁的主角。擺到 4.2 m 之後
// 左段塞得進 1.4 個 λ₁、右段剛好 2 個 λ₂，兩邊都看得出週期性。
const WD_XJ = 4.2;
const WD_LANE_ROPE = 300;      // 實際繩子的平衡位置
const WD_LANE_DECO = 620;      // 分解（入射／反射／透射）的平衡位置

const WD_X0_PULSE = 0.5;       // 脈衝的起點（公尺）

// 左段的最大位移是 (1+|r|)A，最壞情況 1.42 × 4 cm = 5.7 cm
const WD_AMP_C = 14;           // 垂直放大：世界單位 / 公分

function initStringWaveRefraction() {
    const T = 4;               // 兩段繩子張力相同（接在一起，拉力當然一樣）

    function buildWaves(panel) {
        const m1 = WaveScene.medium(T, panel.mu1);
        const m2 = WaveScene.medium(T, panel.mu2);
        const co = WaveScene.coefficients(m1, m2);
        const isPulse = panel.shape === 'pulse';
        const x0 = isPulse ? WD_X0_PULSE : 0;
        const sc = WaveScene.scatter({
            A: panel.A, v1: m1.v, v2: m2.v, xj: WD_XJ, x0,
            r: co.r, tau: co.tau,
            shape: isPulse ? WaveScene.pulseShape(panel.width)
                           : WaveScene.waveShape(panel.f, m1.v),
        });
        // 取樣密度跟著**最短**的空間尺度走。連續波看最短波長；脈衝看壓縮
        // 得最窄的那一個——透射段的引數裡帶了 v₁/v₂，所以脈衝在空間上會
        // 被壓窄 v₂/v₁ 倍，取樣若只跟著第一段的寬度走，最窄的那個脈衝就
        // 會被畫成折線。係數與 06 的 panel.width / 4 一致（06 沒有第二段，
        // 比值恆為 1）。
        //
        // 這個值在滑桿範圍內會撞上 sample() 的 1600 點上限，而那是好事：
        // 上限在 8 m 上等於 5 mm 的間距，最窄的脈衝（w = 0.2、v₂/v₁ = 0.41）
        // 也還有十幾個點，比任何更細的取樣都看不出差別，只是白算。
        const scale = isPulse
            ? panel.width * Math.min(1, m2.v / m1.v) / 4
            : Math.min(m1.v / panel.f, m2.v / panel.f);
        return { m1, m2, co, sc, isPulse, x0, scale };
    }

    WaveScene.run({

        formula: 'r = \\frac{v_2 - v_1}{v_1 + v_2} \\qquad f \\text{ 不變} \\qquad \\frac{\\lambda_1}{\\lambda_2} = \\frac{v_1}{v_2}',
        formulaFallback: 'r = (v₂−v₁)/(v₁+v₂)　f 不變　λ₁/λ₂ = v₁/v₂',

        controls: {
            selects: [
                {
                    key: 'shape', label: '波形', def: 'pulse',
                    options: [
                        { v: 'pulse', t: '單一脈衝' },
                        { v: 'wave',  t: '連續波' },
                    ],
                },
            ],
            sliders: [
                { key: 'mu1', label: '第一段線密度 <i>μ</i>₁', unit: 'kg/m', min: 0.10, max: 0.60, step: 0.05, def: 0.20, dec: 2 },
                { key: 'mu2', label: '第二段線密度 <i>μ</i>₂', unit: 'kg/m', min: 0.10, max: 0.60, step: 0.05, def: 0.50, dec: 2 },
                { key: 'A',   label: '振幅 <i>A</i>', unit: 'cm', min: 1, max: 4, step: 0.5, def: 3, dec: 1 },
                { key: 'width', label: '脈衝寬度 <i>w</i>（脈衝用）', unit: 'm', min: 0.2, max: 0.9, step: 0.05, def: 0.5, dec: 2 },
                { key: 'f',   label: '頻率 <i>f</i>（連續波用）', unit: 'Hz', min: 0.8, max: 2.5, step: 0.1, def: 1.5, dec: 1 },
            ],
        },

        cards: [
            { label: '時間 TIME',        id: 'cardTime',    unit: 's',   highlight: true },
            { label: '第一段波速 V₁',    id: 'cardV1',      unit: 'm/s', highlight: true },
            { label: '第二段波速 V₂',    id: 'cardV2',      unit: 'm/s' },
            { label: '第一段波長 Λ₁',    id: 'cardLambda1', unit: 'm' },
            { label: '第二段波長 Λ₂',    id: 'cardLambda2', unit: 'm' },
            { label: '頻率 F（兩側相同）', id: 'cardF',     unit: 'Hz' },
            { label: '入射振幅',         id: 'cardAinc',    unit: 'cm' },
            { label: '反射振幅',         id: 'cardAref',    unit: 'cm' },
            { label: '透射振幅',         id: 'cardAtr',     unit: 'cm' },
            { label: '反射係數 R',       id: 'cardR',       unit: '' },
            { label: '反射能量比',       id: 'cardEref',    unit: '%' },
        ],

        values(t, panel) {
            const { m1, m2, co, isPulse } = buildWaves(panel);
            // 脈衝模式沒有「波長」可言——一個脈衝不是週期性的東西，
            // 填數字會誤導。卡片留著（版面不跳動）但內容換成破折號。
            const NA = '—';
            return {
                cardTime:    t.toFixed(2),
                cardV1:      m1.v.toFixed(2),
                cardV2:      m2.v.toFixed(2),
                cardLambda1: isPulse ? NA : (m1.v / panel.f).toFixed(2),
                cardLambda2: isPulse ? NA : (m2.v / panel.f).toFixed(2),
                cardF:       isPulse ? NA : panel.f.toFixed(1),
                // 振幅三個數字：入射看設定，反射與透射看係數——
                // 「一部分反射、一部分透射」在這三張卡片上直接讀得出來。
                cardAinc:    panel.A.toFixed(2),
                cardAref:    Math.abs(co.r * panel.A).toFixed(2),
                cardAtr:     (co.tau * panel.A).toFixed(2),
                cardR:       co.r.toFixed(3),
                // 能量通量 P = Zω²A²/2，所以反射帶走的比例就是 r²
                cardEref:    (co.r * co.r * 100).toFixed(1),
            };
        },

        titleText(t, panel) {
            const { m1, m2, co, sc, isPulse } = buildWaves(panel);
            // ⚠️ 用 scatter 算出來的 tj，不要自己寫 WD_XJ / v₁。脈衝是從
            //    x₀ = 0.5 m 出發的，抵達接點的時刻比連續波早了 0.5/v₁。
            const tj = sc.tj;
            const pct = (co.r * co.r * 100).toFixed(0);
            const rAbs = Math.abs(co.r);
            const wr = m2.v / m1.v;        // 脈衝寬度的變化倍率 = v₂/v₁

            // ⚠️ 標題是單行不換行的，字級會自動縮到塞得下（見 drawTitleBar），
            //    但縮字是備援、不是常態。這裡每一句都控制在 45 個全形字以內。
            if (isPulse) {
                if (t < 0.05) {
                    return '一個脈衝跑向接點——按下開始，看它怎麼裂成兩個';
                }
                if (t < tj) {
                    return `脈衝以 v₁ = ${m1.v.toFixed(2)} m/s 前進，還沒到接點`;
                }
                return `反射 ${(rAbs * 100).toFixed(0)}%（${co.r < 0 ? '上下反轉' : '不反轉'}）、`
                     + `透射 ${(co.tau * 100).toFixed(0)}%（寬度 × ${wr.toFixed(2)}）`;
            }

            const l1 = m1.v / panel.f, l2 = m2.v / panel.f;
            if (t < 0.05) {
                return '兩段繩子張力一樣、粗細不同——按下開始，看波跑到接點時會怎樣';
            }
            if (t < tj) {
                return `波以 v₁ = ${m1.v.toFixed(2)} m/s 前進，還沒到接點`;
            }
            if (m2.v > m1.v) {
                return `v ${m1.v.toFixed(2)} → ${m2.v.toFixed(2)} m/s（變快），`
                     + `λ ${l1.toFixed(2)} → ${l2.toFixed(2)} m（變長），f 不變`;
            }
            return `v ${m1.v.toFixed(2)} → ${m2.v.toFixed(2)} m/s（變慢），`
                 + `λ ${l1.toFixed(2)} → ${l2.toFixed(2)} m（變短），f 不變；`
                 + `${pct}% 能量反射`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const { m1, m2, co, sc, isPulse, scale } = buildWaves(panel);
            const inc = sc.incident, ref = sc.reflected, tr = sc.transmitted;
            const real = sc.total;
            const l1 = m1.v / panel.f, l2 = m2.v / panel.f;
            // 取樣密度：連續波跟著最短波長走，脈衝跟著最窄的脈衝走。
            // 兩者都在 buildWaves 裡算好了。
            const lam = scale;

            // ------------------------------------------------------------
            // lane 0：實際的繩子
            // ------------------------------------------------------------
            TS.drawJunction(p, view, WD_XJ, WD_LANE_ROPE, 110, {
                label: `接在這裡　μ ${panel.mu1.toFixed(2)} → ${panel.mu2.toFixed(2)} kg/m`,
            });
            TS.drawBaseline(p, view, WD_LANE_ROPE);
            TS.drawWave(p, view, TS.sample(real, 0, TS.ROPE_M, t, lam),
                { baseY: WD_LANE_ROPE, ampScale: WD_AMP_C, color: [15, 23, 42], weight: 5 });
            TS.drawBeads(p, view, real, t,
                { baseY: WD_LANE_ROPE, ampScale: WD_AMP_C, n: 26, color: [148, 163, 184], radius: 4 });
            TS.drawLaneLabel(p, view, WD_LANE_ROPE, '繩子', [15, 23, 42]);

            // 兩側的波速標在各自那一段的上方
            TS.valueBadge(p, view, TS.ropeX(view, WD_XJ / 2),
                view.toScreenY(WD_LANE_ROPE - 132),
                `v₁ = ${m1.v.toFixed(2)} m/s`, { size: 15 });
            TS.valueBadge(p, view, TS.ropeX(view, (WD_XJ + TS.ROPE_M) / 2),
                view.toScreenY(WD_LANE_ROPE - 132),
                `v₂ = ${m2.v.toFixed(2)} m/s`, { size: 15, stroke: [22, 163, 74], fillColor: [21, 128, 61] });

            // 波長括號：放得下才畫（λ₁ 常常比左段還長）。脈衝沒有波長可言，
            // 這一格改標「反射／透射各拿走多少振幅」——脈衝模式的重點。
            if (isPulse) {
                TS.valueBadge(p, view, TS.ropeX(view, 0.25),
                    view.toScreenY(WD_LANE_ROPE - 78),
                    `入射振幅 ${panel.A.toFixed(1)} cm`, { size: 15, align: 'left' });
                TS.valueBadge(p, view, TS.ropeX(view, TS.ROPE_M) - view.len(12, 6),
                    view.toScreenY(WD_LANE_ROPE - 78),
                    `透射振幅 ${(co.tau * panel.A).toFixed(1)} cm`, { size: 15, align: 'right',
                      stroke: [22, 163, 74], fillColor: [21, 128, 61] });
                TS.valueBadge(p, view, TS.ropeX(view, 0.25),
                    view.toScreenY(WD_LANE_ROPE + 78),
                    `反射振幅 ${Math.abs(co.r * panel.A).toFixed(1)} cm`
                        + `（${co.r < 0 ? '反轉' : '不反轉'}）`,
                    { size: 15, align: 'left', stroke: [234, 88, 12], fillColor: [194, 65, 12] });
            } else {
                if (0.25 + l1 <= WD_XJ - 0.1) {
                    TS.wavelengthBracket(p, view, 0.25, 0.25 + l1, WD_LANE_ROPE - 78,
                        `λ₁ = ${l1.toFixed(2)} m`, { color: [37, 99, 235], above: true });
                }
                if (WD_XJ + 0.25 + l2 <= TS.ROPE_M) {
                    TS.wavelengthBracket(p, view, WD_XJ + 0.25, WD_XJ + 0.25 + l2, WD_LANE_ROPE + 78,
                        `λ₂ = ${l2.toFixed(2)} m`, { color: [22, 163, 74], above: false });
                }
            }

            // ------------------------------------------------------------
            // lane 1：分解——入射、反射、透射
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, WD_LANE_DECO);
            // 入射波一路畫到右端：那是虛像，用來對照透射波的波長
            TS.drawWave(p, view, TS.sample(inc, 0, TS.ROPE_M, t, lam),
                { baseY: WD_LANE_DECO, ampScale: WD_AMP_C, color: [147, 197, 253], weight: 2.5, dash: 9 });
            // 反射波只存在於接點左邊
            TS.drawWave(p, view, TS.sample(ref, 0, WD_XJ, t, lam),
                { baseY: WD_LANE_DECO, ampScale: WD_AMP_C, color: [234, 88, 12], weight: 3, dash: 7 });
            TS.drawWave(p, view, TS.sample(tr, WD_XJ, TS.ROPE_M, t, lam),
                { baseY: WD_LANE_DECO, ampScale: WD_AMP_C, color: [22, 163, 74], weight: 3.5, dash: 7 });

            // 接點的垂直線（貫穿分解 lane）
            const ctx = p.drawingContext;
            ctx.save();
            ctx.setLineDash([view.len(9, 4), view.len(7, 3)]);
            p.stroke(30, 41, 59);
            p.strokeWeight(view.len(3, 1.5));
            p.line(TS.ropeX(view, WD_XJ), view.toScreenY(WD_LANE_DECO - 92),
                   TS.ropeX(view, WD_XJ), view.toScreenY(WD_LANE_DECO + 92));
            ctx.restore();

            TS.drawLaneLabel(p, view, WD_LANE_DECO, '分解', [100, 116, 139]);

            // 三個分量的色標
            const badgeY = WD_LANE_DECO + 128;
            TS.valueBadge(p, view, TS.ropeX(view, 1.1), view.toScreenY(badgeY),
                '入射（虛像畫到右端）', { size: 14, stroke: [147, 197, 253], fillColor: [30, 64, 175] });
            TS.valueBadge(p, view, TS.ropeX(view, 2.4), view.toScreenY(badgeY - 70),
                '反射（只存在於接點左邊）', { size: 15, stroke: [234, 88, 12], fillColor: [194, 65, 12] });
            TS.valueBadge(p, view, TS.ropeX(view, 6.6), view.toScreenY(badgeY),
                '透射', { size: 15, stroke: [22, 163, 74], fillColor: [21, 128, 61] });

            // 接點右邊的波長看得出來變了嗎？直接標一條「同一個 f」的提醒；
            // 脈衝模式沒有 f 可言，改成「脈衝被壓窄幾倍」——同一件事的脈衝版。
            TS.valueBadge(p, view, TS.ropeX(view, TS.ROPE_M) - view.len(12, 6),
                view.toScreenY(WD_LANE_DECO - 128),
                isPulse
                    ? `脈衝寬度 × ${(m2.v / m1.v).toFixed(2)}（= v₂/v₁）`
                    : `f 兩側都是 ${panel.f.toFixed(1)} Hz`,
                { size: 15, align: 'right' });
        },
    });
}

initStringWaveRefraction();
