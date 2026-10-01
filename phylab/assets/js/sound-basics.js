/**
 * 🔊 聲音的產生與傳播 — 聲音是「空氣的疏密」在跑，不是空氣在跑
 *
 * 這頁要看到三件事：
 *   1. 喇叭在左端前後振動，把空氣擠成**一密一疏**的條紋往前推。條紋跑得
 *      很快，但**空氣本身沒有跑掉**——每一顆質點只在自己的位置附近來回。
 *   2. 聲音需要介質。切到「真空」：喇叭還是在動，條紋卻一條都送不出去。
 *   3. 聲速由介質決定：空氣 340、水 1500、鋼 5000 m/s。同一根管子，介質
 *      一換，波長差了好幾倍——因為 v = fλ，而 f 由波源決定、不隨介質變。
 *
 * ⚠️ **這一頁是慢動作。** 真實的聲波在 8 公尺的管子裡只花 23 毫秒就跑完了
 *    （340 m/s），照真實速度播放會是一閃而過的殘影。所以畫面上的時間慢了
 *    170 倍——這是全頁唯一不是真值的量，卡片上、標題列上、內文裡都寫清楚。
 *    其餘的數字（聲速、頻率、波長、週期）全部是真的。
 *
 * 場景骨架、縱波的繪圖、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const SB_TUBE_Y  = 480;        // 管子（空氣）的中心線
const SB_TUBE_H  = 78;         // 管壁的半高
const SB_AMP_C   = 4;          // 縱波的橫向放大：世界單位 / 公分
const SB_BAND    = 56;         // 密部色帶的半高（要小於管壁，條紋才在管子裡）

// ⚠️ **管子不從 x = 0 開始。** ropeX(view, 0) 就是繩子的左端（世界 x = 70），
//    喇叭畫在那裡的話，它的錐體（約 98 個世界單位寬）會整支被推到畫布外，
//    而**畫面上只是少了一顆喇叭，不會有任何錯誤**。所以空氣柱從 1.0 m 起畫，
//    左邊那 1.0 m（＝110 個世界單位）讓給喇叭。波源仍然在 x = 0（錐體表面），
//    所以波前的位置是「從喇叭算起」的距離。
const SB_X0 = 1.0;             // 空氣柱的左端（公尺）
const SB_X1 = 8.0;             // 空氣柱的右端（公尺）

// ⚠️ 質點數、半徑與頻率上限是**一起決定的**，不能各自調：
//    ‧ 一個波長至少要有 8 顆質點，疏密才看得出來 → 質點數有下限
//    ‧ 相鄰質點的間距要大於直徑，否則整排糊成一條實線 → 質點數有上限
//    ‧ 相鄰質點的最大相對位移 A·k·Δx·ampScale 必須小於間距，
//      否則質點會穿過彼此（verify-waves.js 對這組參數有最壞情況斷言）
//    ⚠️ 上限**要用最窄的縮放尺度（1100px）算**：view.len 有像素下限，
//       半徑在小畫布上不會跟著縮，間距卻會——1060px 時 36 顆的間距是
//       11.1px，直徑 9.6px，只剩 14% 的餘裕，再密就糊成一條線。
//    36 顆 × 半徑 4，在 f = 100–180 Hz、A ≤ 3 cm 之下三條都還有餘裕。
const SB_BEADS   = 36;
const SB_DOT_R   = 4;

const SB_SPK_Y   = 330;        // 「喇叭（波源）」標籤的高度
const SB_WALL_Y  = 592;        // 「管壁」標籤的高度
const SB_BADGE_Y = 660;        // 密部／疏部徽章的高度

// 慢動作倍率。挑 170 是量出來的：8 m ÷ 340 m/s = 23.5 ms 的真實時間，
// 放大 170 倍之後是 4.0 秒——剛好看得完一趟。這個數字要讓**最慢的介質**
// 看得舒服，於是快的介質就會「咻一下就過去」，而那個對比正是要教的東西。
const SB_SLOW = 170;

// 聲速是真的。真空沒有介質可以振動，所以 v = 0，而且什麼都傳不出去。
//
// ⚠️ 這張表放在**模組層級**、不在 initSoundBasics() 裡面，而且要從
//    window.__page 匯出：卡片、標題列、畫面三處都查這一份，驗證器也要讀它。
//    藏在 init 函式裡的話，`loadPage()` 只看得到匯出的常數，340 / 1500 / 5000
//    這三個數字（這一頁唯一不能算錯的東西）就**沒有任何守門員**。
const MEDIA = {
    air:   { v: 340,  name: '空氣', on: true },
    water: { v: 1500, name: '水',   on: true },
    steel: { v: 5000, name: '鋼',   on: true },
    vac:   { v: 0,    name: '真空', on: false },
};

/** 這一刻選中的介質。查表的**唯一**入口——三處各自寫一次就是等著漏一處。 */
function sbMedium(panel) { return MEDIA[panel.medium] || MEDIA.air; }

function initSoundBasics() {
    WaveScene.run({

        formula: 'v = f\\lambda',
        formulaFallback: 'v = f λ　（聲速由介質決定）',

        controls: {
            selects: [
                {
                    key: 'medium', label: '介質（決定聲速）', def: 'air',
                    options: [
                        { v: 'air',   t: '空氣　v = 340 m/s' },
                        { v: 'water', t: '水　　v = 1500 m/s' },
                        { v: 'steel', t: '鋼　　v = 5000 m/s' },
                        { v: 'vac',   t: '真空　沒有介質' },
                    ],
                },
            ],
            sliders: [
                { key: 'f', label: '頻率 <i>f</i>' , unit: 'Hz', min: 100, max: 180, step: 5, def: 120 },
                { key: 'A', label: '振幅 <i>A</i>', unit: 'cm', min: 1, max: 3, step: 0.5, def: 2, dec: 1 },
            ],
        },

        cards: [
            { label: '慢動作時間',           id: 'cardTime',   unit: 's',   highlight: true },
            { label: '聲速 V（介質決定）',   id: 'cardV',      unit: 'm/s', highlight: true },
            { label: '真實世界經過的時間',   id: 'cardReal',   unit: 'ms' },
            { label: '頻率 F（波源決定）',   id: 'cardF',      unit: 'Hz' },
            { label: '波長 Λ',               id: 'cardLam',    unit: 'm' },
            { label: '週期 T = 1/f',         id: 'cardPeriod', unit: 'ms' },
            { label: '波前已經跑了',         id: 'cardFront',  unit: 'm' },
            { label: '介質',                 id: 'cardMed',    unit: '' },
        ],

        values(t, panel) {
            const md = sbMedium(panel);
            const tp = t / SB_SLOW;                     // 真實經過的時間
            return {
                cardTime:   t.toFixed(2),
                cardV:      md.v.toFixed(0),
                // 慢動作跑 4 秒鐘，真實世界裡只過了 23 毫秒——這個對比本身就是
                // 「聲音有多快」最直接的證據。
                cardReal:   (tp * 1000).toFixed(1),
                cardF:      panel.f.toFixed(0),
                cardLam:    md.on ? (md.v / panel.f).toFixed(2) : '—',
                cardPeriod: (1000 / panel.f).toFixed(1),
                cardFront:  md.on ? Math.min(WaveScene.ROPE_M, md.v * tp).toFixed(2) : '0.00',
                cardMed:    md.name,
            };
        },

        titleText(t, panel) {
            const md = sbMedium(panel);
            const tp = t / SB_SLOW;
            if (t < 0.05) {
                return `喇叭開始前後振動，把空氣擠成一密一疏——按下開始，`
                     + `注意看空氣本身有沒有被推走`;
            }
            if (!md.on) {
                return `真空裡沒有介質可以振動——喇叭還是在動，但一個疏密條紋都送不出去，`
                     + `所以真空聽不到聲音`;
            }
            const front = md.v * tp;
            if (front < WaveScene.ROPE_M) {
                return `疏密條紋在${md.name}裡以 ${md.v} m/s 前進，距離喇叭已經 ${front.toFixed(2)} m`
                     + `——真實世界裡這件事只花了 ${(tp * 1000).toFixed(1)} 毫秒`
                     + `（畫面上是慢動作 ×${SB_SLOW}）`;
            }
            return `f = ${panel.f.toFixed(0)} Hz 不隨介質改變，v = ${md.v} m/s 由介質決定`
                 + `——所以 λ = v ÷ f = ${(md.v / panel.f).toFixed(2)} m`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const md = sbMedium(panel);
            const A = panel.A;
            const tp = t / SB_SLOW;                  // 真實時間
            const lam = md.on ? md.v / panel.f : Infinity;
            const k = md.on ? TS.waveNumber(panel.f, md.v) : 0;

            // 真空：v = 0，位移恆為 0。這一支撐起「沒有介質就傳不出去」。
            const disp = !md.on
                ? (() => 0)
                : TS.traveling({
                    A, k, v: md.v, dir: +1, x0: 0,
                    env: u => (u > 0 ? 0 : 1),        // 波前還沒到就是 0
                  });

            const sx0 = TS.ropeX(view, SB_X0);
            const sx1 = TS.ropeX(view, SB_X1);
            const sy = view.toScreenY(SB_TUBE_Y);
            const wallH = view.len(SB_TUBE_H, 36);

            // ------------------------------------------------------------
            // 管子
            // ------------------------------------------------------------
            p.noStroke();
            p.fill(248, 250, 252);
            p.rect(sx0, sy - wallH, sx1 - sx0, wallH * 2);
            p.stroke(203, 213, 225);
            p.strokeWeight(view.len(3, 1.5));
            p.line(sx0, sy - wallH, sx1, sy - wallH);
            p.line(sx0, sy + wallH, sx1, sy + wallH);
            p.noStroke();
            p.fill(148, 163, 184);
            p.textSize(view.len(13, 8));
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.CENTER);
            p.text('管壁', sx0, view.toScreenY(SB_WALL_Y));

            // ------------------------------------------------------------
            // 疏密條紋與質點
            // ------------------------------------------------------------
            TS.drawCompression(p, view, disp, tp, {
                baseY: SB_TUBE_Y, ampScale: SB_AMP_C, n: SB_BEADS,
                x0m: SB_X0, x1m: SB_X1,
                color: [37, 99, 235], radius: SB_DOT_R, band: SB_BAND,
                highlight: { index: Math.round(SB_BEADS / 2), color: [239, 68, 68] },
            });

            // ------------------------------------------------------------
            // 喇叭：它的位置就是波源在這一刻的位移
            // ------------------------------------------------------------
            // 喇叭連真空裡都在動——真空那一段要靠「喇叭還在動、管子裡卻
            // 紋風不動」才看得出問題不在波源，而在沒有介質。
            const push = (md.on ? disp(0, tp) : A * Math.sin(TS.omega(panel.f) * tp)) * SB_AMP_C;
            const coneX = sx0;
            const coneW = view.len(58, 26), coneH = view.len(52, 24);
            p.noStroke();
            p.fill(30, 41, 59);
            p.quad(coneX - coneW, sy - coneH * 1.5,
                   coneX - coneW * 0.25 + push, sy - coneH * 0.55,
                   coneX - coneW * 0.25 + push, sy + coneH * 0.55,
                   coneX - coneW, sy + coneH * 1.5);
            p.fill(71, 85, 105);
            p.rect(coneX - coneW * 2.1, sy - coneH * 0.75, coneW * 0.9, coneH * 1.5);
            p.noStroke();
            p.fill(30, 41, 59);
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.text('喇叭（波源）', coneX - coneW * 1.55, view.toScreenY(SB_SPK_Y));

            // ------------------------------------------------------------
            // 波前的位置
            // ------------------------------------------------------------
            if (md.on) {
                const front = Math.min(SB_X1, md.v * tp);
                if (front > SB_X0 + 0.05 && front < SB_X1 - 0.02) {
                    const fx = TS.ropeX(view, front);
                    const ctx = p.drawingContext;
                    ctx.save();
                    ctx.setLineDash([view.len(9, 4), view.len(7, 3)]);
                    p.stroke(239, 68, 68);
                    p.strokeWeight(view.len(3, 1.5));
                    p.line(fx, sy - wallH, fx, sy + wallH);
                    ctx.restore();
                    TS.valueBadge(p, view, fx, view.toScreenY(SB_TUBE_Y - SB_TUBE_H - 32),
                        `波前 ${front.toFixed(2)} m`,
                        { size: 14, stroke: [239, 68, 68], fillColor: [185, 28, 28] });
                }
            }

            // ------------------------------------------------------------
            // 密部／疏部
            // ------------------------------------------------------------
            // 位移 y = A sin(k(x − v·t))，應變 ∂y/∂x = Ak cos(k(x − v·t))。
            // **應變最負**的地方被擠得最緊 → k(x − v·t) = π 是密部；
            // 應變最正的地方拉得最開 → = 0 是疏部。站在真正的極值上，
            // 不要寫死比例——介質一換 λ 就變了。
            const mid = (SB_X0 + SB_X1) / 2;
            const badgeY = view.toScreenY(SB_BADGE_Y);
            if (!md.on) {
                TS.valueBadge(p, view, TS.ropeX(view, mid), badgeY,
                    '沒有任何疏密條紋——真空裡沒有東西可以振動',
                    { size: 16, stroke: [239, 68, 68], fillColor: [185, 28, 28] });
            } else {
                // 候選是「整條波列上所有應變極值」，取離管子中點最近的那一個。
                // ⚠️ j 要掃得夠寬：λ 大（鋼、水）的時候管子裡擠不進幾個極值，
                //    只掃 j = 0..2 會在切到鋼的時候整個徽章不見，而**畫面不會報錯**。
                const pick = (phase, avoid) => {
                    let best = null, bestD = Infinity;
                    for (let j = -8; j <= 8; j++) {
                        const x = md.v * tp + (phase + 2 * Math.PI * j) / k;
                        if (x < SB_X0 + 0.5 || x > SB_X1 - 0.5) continue;
                        // 密部與疏部只差 λ/2，f 拉高的時候兩個徽章會疊在一起
                        if (avoid != null && Math.abs(x - avoid) < 0.55) continue;
                        const d = Math.abs(x - mid);
                        if (d < bestD) { bestD = d; best = x; }
                    }
                    return best;
                };
                const xc = pick(Math.PI, null);
                const xr = pick(0, xc);
                if (xc != null && xr != null) {
                    TS.valueBadge(p, view, TS.ropeX(view, xc), badgeY, '密部',
                        { size: 15, stroke: [37, 99, 235], fillColor: [29, 78, 216] });
                    TS.valueBadge(p, view, TS.ropeX(view, xr), badgeY, '疏部',
                        { size: 15, stroke: [148, 163, 184], fillColor: [100, 116, 139] });
                } else {
                    // 波長比管子長的時候，整條管子裡擠不進一個完整的疏密循環。
                    // 這不是「壞掉」，是 λ 太大的時候真的會發生的事——講出來。
                    TS.valueBadge(p, view, TS.ropeX(view, mid), badgeY,
                        `λ = ${lam.toFixed(2)} m 比管子（7 m）還長——整條管子幾乎一起疏、一起密`,
                        { size: 15, stroke: [148, 163, 184], fillColor: [71, 85, 105] });
                }
            }
        },
    });
}

initSoundBasics();

// 匯出這一頁的常數，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    SB_TUBE_Y, SB_TUBE_H, SB_AMP_C, SB_BAND, SB_BEADS, SB_DOT_R,
    SB_X0, SB_X1, SB_SPK_Y, SB_WALL_Y, SB_BADGE_Y, SB_SLOW,
    // 這一頁的物理：聲速表是唯一不能算錯的東西，驗證器直接讀它。
    MEDIA, sbMedium,
};
