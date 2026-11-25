/**
 * 🔉 聲波的位移波與壓力波 — 同一股疏密，兩種畫法
 *
 * 這一頁要看到三件事：
 *   1. 聲波是縱波，但**同一股疏密**可以畫成兩條曲線：上面那條是空氣質點
 *      前後移動的距離（把縱波畫成橫波，課本畫的就是這一條），下面那條是
 *      壓力變化（向上＝高於大氣壓＝密部）。
 *   2. 兩條曲線**永遠差四分之一個波長**：位移為 0 的地方，壓力正好最大
 *      （密部）或最小（疏部）；反過來，位移最大的地方壓力變化是 0。
 *      紅色的垂直虛線把這兩件事連起來，虛線的兩端各有一顆點。
 *   3. 下面那條**不是另外畫的**——它是上面那條的空間導數：
 *      p ∝ −∂s/∂x。位移的斜率愈陡，壓力變化愈大。所以頻率拉高時
 *      （k = 2πf/v 變大）位移振幅沒變，壓力波卻跟著長高。
 *
 * ⚠️ **這一頁也是慢動作**（和 23 聲音的產生同一組數字：×170）。真實的
 *    120 Hz 聲音一秒振動 120 次，照真實速度播放只會看到一團糊掉的殘影。
 *    畫面上的時間慢了 170 倍，頻率、波長、聲速三個數字都是真的。
 *
 * 場景骨架、波形數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const SDP_V = 340;             // 聲速（空氣，真值）
const SDP_SLOW = 170;          // 慢動作倍率（與 23 相同，兩頁的「時間」才對得起來）

// ⚠️ 空氣柱不從 x = 0 開始。ropeX(view, 0) 就是世界 x = 70，那裡要留給
//    兩條 lane 的標籤（「位移 s」「壓力變化 p」畫在柱子左邊的左邊）——
//    從 0 起畫的話標籤會被推到畫布外，而畫面上只是少兩個字，不會報錯。
const SDP_X0 = 0.7;            // 空氣柱的左端（公尺）
const SDP_X1 = 8.0;            // 空氣柱的右端（公尺）

const SDP_LANE_S = 300;        // 上軌：位移的平衡線
const SDP_LANE_P = 630;        // 下軌：壓力變化的平衡線

// 垂直比例。兩條 lane 的「滿格」都留給滑桿的最大值：
//   上軌 33 世界單位/公分 × 3 cm = 99
//   下軌 100 世界單位 × (A/3) × (f/180) = 100（在 A = 3、f = 180 時）
// 下軌多乘一個 f 不是為了好看：壓力振幅 ∝ A·k ∝ A·f，這是 ∂s/∂x 帶下來的。
const SDP_AMP_C = 33;          // 上軌：世界單位 / 公分
const SDP_AMP_P = 100;         // 下軌：世界單位 / 「滿格」壓力

const SDP_F_MIN = 100, SDP_F_MAX = 180;
const SDP_A_MIN = 1,   SDP_A_MAX = 3;

// 色帶（密部／疏部）與四條註解的垂直位置。由上而下互不相交：
//   195 色帶上緣 → 201 上軌曲線最高 → 300 上軌平衡線 → 389 上軌曲線最低
//   → 462 λ/4 括號 → 530 下軌曲線最高 → 630 下軌平衡線 → 730 下軌曲線最低
//   → 752 下軌徽章 → 788 底部說明 → 812 標題列
const SDP_BAND_T = 195, SDP_BAND_B = 732;
const SDP_TOP_Y = 165;         // 上軌那兩顆徽章（在上軌曲線上方，不在帶子裡）
const SDP_BOT_Y = 752;         // 下軌那兩顆徽章
const SDP_MID_Y = 462;         // λ/4 括號（畫在兩軌之間那段空白）
const SDP_LEGEND_Y = 788;      // 底部那一行說明

/**
 * 這一頁的全部物理——**模組層級**，因為驗證器只進得到 `window.__page`
 * 匯出的東西（README 陷阱十九）。
 *
 * 位移 s(x, t) = A·sin(k(x − v·t))，正 = 質點往右（+x）。
 * 壓力變化由位移的**空間導數**導出：兩個相鄰質點原本相距 dx，位移之後
 * 變成 dx·(1 + ∂s/∂x)——∂s/∂x 是負的就是被擠緊了（密部），所以
 *
 *     p = −B·∂s/∂x = −B·A·k·cos(k(x − v·t))
 *
 * 這裡把 B（體積彈性模數）當成 1，p 的單位是「相對於自己的最大值」，
 * 卡片與畫面上都不宣稱帕斯卡——這一頁要看的關係只有相位與正負號。
 * 相位約定和 23 聲音的產生一致（同一根管子、同一個喇叭）。
 */
function sdpField(panel) {
    const v = SDP_V;
    const f = panel.f;
    const k = WaveScene.waveNumber(f, v);      // 2πf/v
    const lam = v / f;
    const A = panel.A;
    const s = (x, t) => A * Math.sin(k * (x - v * t));
    const p = (x, t) => -A * k * Math.cos(k * (x - v * t));
    const pMax = A * k;                        // 壓力變化的振幅（相對值）
    return { v, f, k, lam, A, s, p, pMax };
}

/**
 * 「位移為零」的所有位置——也就是**壓力極值**的位置，這一頁唯一一份。
 *
 * s = 0 ⟺ k(x − v·t) = mπ ⟺ x = v·t + m·λ/2。m 是偶數時 cos = +1，
 * p = −A·k 是最小 → 疏部；m 是奇數時 p = +A·k 是最大 → 密部。
 * 兩家族交替出現，相距 λ/2。
 *
 * ⚠️ 這一支和 wave-scene.js 的 `strainExtremumX` 算的是同一族位置，但
 *    那一支只回傳「離 anchor 最近的一個」、而且帶著波前與避讓條件；
 *    這一頁要的是**全部**（每一條虛線都要畫），而且管子裡沒有波前
 *    （聲音早就充滿整根管子了）。所以由位移的零點自己推，公式只寫一次。
 */
function sdpZeros(F, t, x0, x1) {
    const out = [];
    const half = F.lam / 2;
    const m0 = Math.ceil((x0 - F.v * t) / half);
    const m1 = Math.floor((x1 - F.v * t) / half);
    for (let m = m0; m <= m1; m++) {
        out.push({
            x: F.v * t + m * half,
            m,
            kind: (Math.abs(m % 2) === 0) ? '疏部' : '密部',
        });
    }
    return out;
}

/** 離管子中點最近的那一個「位移為零」的位置。kind 省略時兩個家族都算。 */
function sdpPick(F, t, x0, x1, kind) {
    const mid = (x0 + x1) / 2;
    let best = null, bd = Infinity;
    for (const z of sdpZeros(F, t, x0, x1)) {
        if (kind && z.kind !== kind) continue;
        const d = Math.abs(z.x - mid);
        if (d < bd) { bd = d; best = z; }
    }
    return best;
}

/**
 * 位移的極值（腹點）位置：x = v·t + λ/4 + m·λ/2——所以它離最近的
 * 「位移為零」剛好 λ/4。回傳的是 xc 旁邊那一個，兩者一起把「四分之一
 * 波長的偏移」變成量得出來的距離。找不到（太靠邊）就回 null。
 */
function sdpAntinodeNear(F, t, xc, x0, x1) {
    for (const dir of [+1, -1]) {
        const x = xc + dir * F.lam / 4;
        if (x >= x0 + F.lam / 8 && x <= x1 - F.lam / 8) return x;
    }
    return null;
}

/** 下軌的垂直比例：世界單位 / 「滿格」壓力。滑桿一動，兩軌一起長高。 */
function sdpPScale(panel) {
    return SDP_AMP_P * (panel.A / SDP_A_MAX) * (panel.f / SDP_F_MAX);
}

function initSoundPressure() {
    WaveScene.run({

        // 左欄公式框在 1100px 時內寬只有 183–198px：這一條是 132px 左右，
        // 塞得下。display 模式不會自動換行，所以長的式子一律自己拆行。
        formula: 'p \\propto -\\frac{\\partial s}{\\partial x}',
        formulaFallback: 'p ∝ −∂s/∂x　（壓力變化是位移的空間導數）',

        controls: {
            sliders: [
                { key: 'f', label: '頻率 <i>f</i>', unit: 'Hz', min: SDP_F_MIN, max: SDP_F_MAX, step: 5, def: 120 },
                { key: 'A', label: '振幅 <i>A</i>', unit: 'cm', min: SDP_A_MIN, max: SDP_A_MAX, step: 0.5, def: 2, dec: 1 },
            ],
        },

        cards: [
            { label: '慢動作時間',              id: 'cardTime',  unit: 's',   highlight: true },
            { label: '聲速 V（介質決定）',      id: 'cardV',     unit: 'm/s', highlight: true },
            { label: '頻率 F',                  id: 'cardF',     unit: 'Hz' },
            { label: '波長 Λ',                  id: 'cardLam',   unit: 'm' },
            { label: '四分之一波長 Λ/4',        id: 'cardShift', unit: 'm' },
            { label: '位移振幅 A',              id: 'cardA',     unit: 'cm' },
            { label: '壓力振幅 ÷ 位移振幅',     id: 'cardRatio', unit: '1/m' },
            { label: '壓力最大處的位移',        id: 'cardZero',  unit: 'cm' },
        ],

        values(t, panel) {
            const F = sdpField(panel);
            const tr = t / SDP_SLOW;
            const z = sdpPick(F, tr, SDP_X0, SDP_X1, '密部');
            return {
                cardTime:  t.toFixed(2),
                cardV:     F.v.toFixed(0),
                cardF:     panel.f.toFixed(0),
                cardLam:   F.lam.toFixed(2),
                // 兩軌的相位差就是四分之一個波長。它不隨時間變——這正是
                // 「永遠維持」的意思，所以這一張卡片怎麼看都是同一個數字。
                cardShift: (F.lam / 4).toFixed(2),
                cardA:     panel.A.toFixed(1),
                // p_max / s_max = k = 2πf/v。頻率愈高，同樣的位移振幅
                // 對應的壓力變化愈大——∂s/∂x 帶下來的。
                cardRatio: F.k.toFixed(2),
                // 站在壓力最大的位置上量位移：永遠是 0.00。這張卡片不會動，
                // 而它不動就是這一頁的重點。
                cardZero:  z ? Math.abs(F.s(z.x, tr)).toFixed(2) : '—',
            };
        },

        titleText(t, panel) {
            const F = sdpField(panel);
            if (t < 0.05) {
                return `同一股疏密有兩種畫法：上面是質點的位移，下面是壓力變化`
                     + `（由位移的斜率算出來）——按下開始，注意紅色虛線的兩端`;
            }
            const z = sdpPick(F, t / SDP_SLOW, SDP_X0, SDP_X1, '密部');
            if (!z) {
                return `λ = ${F.lam.toFixed(2)} m 比管子還長——整根管子幾乎一起疏、一起密`;
            }
            return `位移為 0 的地方，壓力正好最大（密部）——兩條波永遠差 λ/4 = `
                 + `${(F.lam / 4).toFixed(2)} m；f = ${panel.f.toFixed(0)} Hz 讓 `
                 + `k = 2πf/v = ${F.k.toFixed(2)} 1/m，這就是壓力波比位移波高幾倍`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const F = sdpField(panel);
            const tr = t / SDP_SLOW;                 // 真實時間（慢動作還原）
            const x0 = SDP_X0, x1 = SDP_X1;
            const zeros = sdpZeros(F, tr, x0, x1);
            const pScale = sdpPScale(panel);
            const mid = (x0 + x1) / 2;

            // ------------------------------------------------------------
            // 密部／疏部色帶：以「位移為零」為中心，各佔半個波長
            // ------------------------------------------------------------
            // 色帶跨越兩條 lane——它們是**同一根管子**裡的同一股疏密，
            // 只是上下兩軌用不同的量在描述它。
            const half = F.lam / 2;
            for (const z of zeros) {
                const a = Math.max(x0, z.x - half / 2);
                const b = Math.min(x1, z.x + half / 2);
                if (b - a <= 0) continue;
                const dense = z.kind === '密部';
                const col = dense ? [37, 99, 235] : [148, 163, 184];
                p.noStroke();
                p.fill(col[0], col[1], col[2], dense ? 26 : 22);
                p.rect(TS.ropeX(view, a), view.toScreenY(SDP_BAND_T),
                       TS.ropeX(view, b) - TS.ropeX(view, a),
                       view.toScreenY(SDP_BAND_B) - view.toScreenY(SDP_BAND_T));
            }

            // 空氣柱的兩端：一條淺灰的界線，說明「管子到這裡為止」
            p.stroke(203, 213, 225);
            p.strokeWeight(view.len(3, 1.5));
            for (const xm of [x0, x1]) {
                p.line(TS.ropeX(view, xm), view.toScreenY(SDP_BAND_T),
                       TS.ropeX(view, xm), view.toScreenY(SDP_BAND_B));
            }

            // ------------------------------------------------------------
            // 兩軌的平衡線
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, SDP_LANE_S, x0, x1);
            TS.drawBaseline(p, view, SDP_LANE_P, x0, x1);

            // ------------------------------------------------------------
            // 垂直虛線：把「位移為零」和「壓力極值」連起來
            // ------------------------------------------------------------
            // 畫在曲線之前，虛線才不會蓋住兩條曲線的線身；兩端的圓點
            // 之後再補（那時候才畫在曲線上面）。
            const ctx = p.drawingContext;
            // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
            p.push();
            ctx.setLineDash([view.len(9, 4), view.len(7, 3)]);
            p.stroke(239, 68, 68);
            p.strokeWeight(view.len(2.5, 1.2));
            const dotY = new Map();
            for (const z of zeros) {
                const py = TS.laneY(SDP_LANE_P, pScale, z.kind === '密部' ? +1 : -1);
                dotY.set(z.x, py);
                p.line(TS.ropeX(view, z.x), view.toScreenY(SDP_LANE_S),
                       TS.ropeX(view, z.x), view.toScreenY(py));
            }
            p.pop();

            // ------------------------------------------------------------
            // 上軌：位移
            // ------------------------------------------------------------
            TS.drawWave(p, view, TS.sample(F.s, x0, x1, tr, F.lam),
                { baseY: SDP_LANE_S, ampScale: SDP_AMP_C, color: [37, 99, 235], weight: 4 });
            TS.drawLaneLabel(p, view, SDP_LANE_S, '位移 s', [37, 99, 235]);

            // ------------------------------------------------------------
            // 下軌：壓力變化 = 位移的空間導數
            // ------------------------------------------------------------
            // 傳進去的 y 已經正規化成 ±1（除以 pMax），所以 ampScale 就是
            // 「滿格」對應的世界單位——和 sdpPScale 同一個數字。
            const pNorm = (x, tt) => F.p(x, tt) / F.pMax;
            TS.drawWave(p, view, TS.sample(pNorm, x0, x1, tr, F.lam),
                { baseY: SDP_LANE_P, ampScale: pScale, color: [15, 23, 42], weight: 4 });
            TS.drawLaneLabel(p, view, SDP_LANE_P, '壓力 p', [15, 23, 42]);

            // ------------------------------------------------------------
            // 兩端的圓點：上軌落在平衡線上，下軌落在波峰／波谷上
            // ------------------------------------------------------------
            p.noStroke();
            for (const z of zeros) {
                const dense = z.kind === '密部';
                p.fill(220, 38, 38);
                p.circle(TS.ropeX(view, z.x), view.toScreenY(SDP_LANE_S), view.len(15, 7));
                p.fill(dense ? 29 : 100, dense ? 78 : 116, dense ? 216 : 139);
                p.circle(TS.ropeX(view, z.x), view.toScreenY(dotY.get(z.x)), view.len(15, 7));
            }

            // ------------------------------------------------------------
            // 四分之一波長：位移為零 ↔ 位移最大
            // ------------------------------------------------------------
            const zc = sdpPick(F, tr, x0, x1, '密部');
            const xa = zc ? sdpAntinodeNear(F, tr, zc.x, x0, x1) : null;
            if (zc && xa != null) {
                const lo = Math.min(zc.x, xa), hi = Math.max(zc.x, xa);
                TS.wavelengthBracket(p, view, lo, hi, SDP_MID_Y,
                    `相隔 λ/4 = ${(F.lam / 4).toFixed(2)} m`,
                    { color: [220, 38, 38], size: 15 });

                // 腹點上的小綠點：位移最大、而壓力變化是 0
                p.noStroke();
                p.fill(22, 163, 74);
                p.circle(TS.ropeX(view, xa),
                         view.toScreenY(TS.laneY(SDP_LANE_S, SDP_AMP_C, F.s(xa, tr))),
                         view.len(15, 7));
                p.fill(100, 116, 139);
                p.circle(TS.ropeX(view, xa), view.toScreenY(SDP_LANE_P), view.len(13, 6));
            }

            // ------------------------------------------------------------
            // 四顆徽章：兩兩一組，各自往虛線的**外側**長出去
            // ------------------------------------------------------------
            // ⚠️ 兩組之間只隔 λ/4——f = 180 Hz 時是 0.47 m，在 1100px 的畫面上
            //    只有 23 個像素，而一張牌就有 45 個像素寬。置中的話兩張牌
            //    一定疊在一起。往外長（xc 那組背對腹點、腹點那組背對 xc）
            //    的話兩張牌的間隙永遠是「8 像素 + λ/4 的像素寬」——正的，
            //    寬度再寬也撞不到，不必去量。
            //    腹點在左邊時整組反過來，否則換成 xc 那張牌往腹點身上長。
            if (zc && xa != null) {
                const flip = xa < zc.x;
                const aC = flip ? 'left' : 'right';
                const aA = flip ? 'right' : 'left';
                const off = view.len(8, 4);
                const sxC = TS.ropeX(view, zc.x) + (flip ? off : -off);
                const sxA = TS.ropeX(view, xa) + (flip ? -off : off);
                TS.valueBadge(p, view, sxC, view.toScreenY(SDP_TOP_Y), '位移 = 0',
                    { size: 15, align: aC, stroke: [220, 38, 38], fillColor: [185, 28, 28] });
                TS.valueBadge(p, view, sxC, view.toScreenY(SDP_BOT_Y), '密部：壓力最大',
                    { size: 15, align: aC, stroke: [37, 99, 235], fillColor: [29, 78, 216] });
                TS.valueBadge(p, view, sxA, view.toScreenY(SDP_TOP_Y), '位移最大',
                    { size: 15, align: aA, stroke: [22, 163, 74], fillColor: [21, 128, 61] });
                TS.valueBadge(p, view, sxA, view.toScreenY(SDP_BOT_Y), '壓力 = 0',
                    { size: 15, align: aA, stroke: [100, 116, 139], fillColor: [71, 85, 105] });
            }

            // ------------------------------------------------------------
            // 底部說明
            // ------------------------------------------------------------
            p.noStroke();
            p.fill(100, 116, 139);
            p.textSize(view.len(14, 8));
            p.textStyle(p.NORMAL);
            p.textAlign(p.CENTER, p.CENTER);
            p.text('藍色帶 = 密部（高壓）　灰色帶 = 疏部（低壓）　紅色虛線 = 位移為零處',
                   TS.ropeX(view, mid), view.toScreenY(SDP_LEGEND_Y));
        },
    });
}

initSoundPressure();

// 匯出這一頁的常數與物理模型，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    SDP_V, SDP_SLOW, SDP_X0, SDP_X1,
    SDP_LANE_S, SDP_LANE_P, SDP_AMP_C, SDP_AMP_P,
    SDP_F_MIN, SDP_F_MAX, SDP_A_MIN, SDP_A_MAX,
    SDP_BAND_T, SDP_BAND_B, SDP_TOP_Y, SDP_BOT_Y, SDP_MID_Y, SDP_LEGEND_Y,
    // 這一頁的全部物理：位移場、壓力場（= 位移的空間導數）、
    // 「位移為零」的位置、以及下軌的垂直比例。
    sdpField, sdpZeros, sdpPick, sdpAntinodeNear, sdpPScale,
};
