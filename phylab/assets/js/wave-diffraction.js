/**
 * 🌊 水波的繞射 — 開口窄到和波長差不多，波就會往四面八方散開
 *
 * 這一頁是一座造波水槽：左邊送來平直的波，中間一道障礙物，右邊是牆後的世界。
 * 畫面上那一整片顏色**不是貼圖**——它是惠更斯原理一個點一個點疊出來的：
 * 開口上的每一個點都是一個新的點波源，各自發出圓形波，疊加起來就是繞射
 * 圖樣。看得到的三件事：
 *
 *   1. **開口愈窄，散得愈開。** 把開口拉到和波長差不多寬，波一穿過就往
 *      所有方向散開、牆後面整個都是亮的；把開口拉寬，波幾乎照直線前進，
 *      牆後面留下一道「影子」，繞射只剩很小的角度。
 *   2. **兩個開口會疊出條紋。** 「兩開口中心距」從 0 慢慢拉大（0 就是一個
 *      開口），第二個開口長出來之後牆後開始出現一明一暗的條紋——亮紋出現
 *      在兩波相差整數個波長的方向上。
 *   3. **條紋的位置由 d 和 λ 決定，條紋的亮暗由開口寬決定。** 這正是
 *      d·sinθ = mλ 與 a·sinθ = λ 兩條式子在做的事。
 *
 * ⚠️ 這一頁**沒有慢動作**：水深 16 公分的水槽裡 v = √(gh) ≈ 1.25 m/s，
 *    波長 0.4–1.6 公尺、週期 0.3–1.3 秒，本來就是肉眼跟得上的速度，
 *    畫面上每一個數字都是真的。
 *
 * ⚠️ 條紋的位置是**從場本身量出來的**（WaveTank.tracks / peaks），不是用
 *    課本那條式子畫上去的。障礙物附近條紋會彎開——課本的 d·sinθ = mλ 是
 *    遠處的漸近線，照它畫一條直線的話，那條線會當著學生的面和條紋錯開
 *    十幾個像素，而條紋本身完全正確。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// --------------------------------------------------------------------------
// 水槽刻意做成 8.0 公尺寬，世界尺度因此剛好是 110 世界單位/公尺——和繩子
// 那幾頁（wave-scene.js）的 X_SCALE 一模一樣，wavelengthBracket 可以直接用。
// ==========================================================================
const WD_X0 = 70;              // 水槽左緣（世界 x）
const WD_X1 = 950;             // 水槽右緣
const WD_M  = 8.0;             // 水槽實際寬度（公尺）
const WD_U  = (WD_X1 - WD_X0) / WD_M;             // 110 世界單位 / 公尺

const WD_Y0 = 36;              // 水槽上緣（世界 y）
const WD_Y1 = 762;             // 水槽下緣
const WD_MID_Y = (WD_Y0 + WD_Y1) / 2;             // 水槽中線＝水面高度 0
const WD_HALF_M = ((WD_Y1 - WD_Y0) / 2) / WD_U;   // 3.30 公尺（水槽半高）

const WD_WALL_M = 3.2;         // 障礙物距水槽左緣（公尺）
const WD_WALL_T = 5;           // 障礙物的半厚（世界單位）
const WD_EDGE_M = WD_M - 0.1;  // 量條紋的那條剖面線（公尺）
const WD_DEPTH_M = WD_EDGE_M - WD_WALL_M;         // 障礙物到剖面線的深度（4.7 m）

const WD_LAM_Y = 795;          // 波長括號的世界 y（水槽下緣 762 與標題列 812 之間）

// ⚠️ **開口寬上限 200 cm 不是隨便挑的。** 課本的 a·sinθ = λ 是**遠場**的
//    結果，而遠場要水槽深度遠大於 a²/λ——這個水槽只有 4.7 公尺深。
//    開口拉到 4 公尺時菲涅耳數 a²/(λ·X) 會到 8 以上，那條式子就不再描述
//    眼前這座水槽了（量到的第一暗紋會跑到 2.94 m，課本說 1.21 m）。
//    上限 200 cm 讓 40–160 cm 的波長都還留在遠場附近（最壞的角落是
//    λ = 40、a = 200，N_F = 2.1，實測角度差 0.6°）。
//    驗證器直接讀這四個數字去掃整個框——**寫成常數才不會哪天有人把滑桿
//    放寬而驗證器還在掃舊的框**。
const WD_LAM_MIN = 40, WD_LAM_MAX = 160;      // cm
const WD_A_MIN   = 40, WD_A_MAX   = 200;      // cm

// 顏色＝水面高低：橙＝波峰、白＝水面、藍＝波谷（和 07/08 兩頁的藍橘一致）。
// 振幅先開根號再上色——不然|位移|小的時候整片都停在白色附近，什麼都看不到。
const WD_RAMP = (() => {
    const LO = [37, 99, 235], MID = [248, 250, 252], HI = [234, 88, 12];
    const a = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
        const u = i / 127.5 - 1;
        const to = u < 0 ? LO : HI;
        const q = Math.sqrt(Math.abs(u));
        for (let c = 0; c < 3; c++) {
            a[i * 3 + c] = Math.round(MID[c] + (to[c] - MID[c]) * q);
        }
    }
    return a;
})();

// ==========================================================================
// 這一頁的物理
// --------------------------------------------------------------------------
// 卡片、畫面、標題列共用同一份，驗證器也從 window.__page 讀它
// （見 .github/scripts/headless/README.md）。
// ==========================================================================
function wdModel(t, panel) {
    const lam = panel.lam / 100, a = panel.a / 100, d = panel.d / 100;
    const P = { lam, a, d, wallX: WD_WALL_M };

    // ⚠️ 「開口總寬」不等於滑桿上的 a：中心距 d 比 a 小的時候兩個開口在
    //    幾何上是**相連的**（d = 0 更是完全重合），牆上真正的缺口只有一個，
    //    而且比 a 還寬。卡片、繞射角度、惠更斯取樣全部用真正的那個寬度。
    const gaps = WaveTank.gaps(P);
    const aEff = WaveTank.openWidth(P);
    const single = gaps.length === 1;

    // 兩條課本上的式子。sin 值超出範圍時回 null——那不是「算不出來」，
    // 是**那條線真的不存在**（見 WaveTank 的說明）。
    const darkSin = single ? WaveTank.firstDarkSin({ lam, a: aEff }) : null;
    const brightSin = single ? null : WaveTank.fringeSin(P, 1);

    return {
        lam, a, d, aEff, single, gaps, P,
        ratio: lam / aEff,                        // 開口比波長：這一頁的主角
        darkSin, brightSin,
        darkDeg:   darkSin   == null ? null : Math.asin(darkSin) * 180 / Math.PI,
        brightDeg: brightSin == null ? null : Math.asin(brightSin) * 180 / Math.PI,
        freq: WaveTank.V / lam,
    };
}

function initWaveDiffraction() {
    // 上一次算過的場。網格與惠更斯疊加只在參數變動時重算一次；
    // 每一幀要做的只是把複數振幅轉成瞬時高度（見 WaveTank.table）。
    let cache = { key: '', tbl: null, tracks: null, ticks: null };
    let tmpCnv = null, tmpCtx = null, tmpImg = null;

    // 水槽座標（公尺）→ 畫面像素。x 直接用 WaveScene 的 ropeX——水槽寬度
    // 與尺度是刻意對齊的，wavelengthBracket 畫出來的括號才會落在同一條線上。
    const gx = (view, m) => WaveScene.ropeX(view, m);
    const gy = (view, m) => view.toScreenY(WD_MID_Y - m * WD_U);

    WaveScene.run({

        formula: '\\begin{aligned} a\\sin\\theta_1 &= \\lambda \\\\ d\\sin\\theta &= m\\lambda \\end{aligned}',
        formulaFallback: 'a sinθ₁ = λ　／　d sinθ = mλ',

        controls: {
            sliders: [
                { key: 'lam', label: '波長 <i>λ</i>',          unit: 'cm',
                  min: WD_LAM_MIN, max: WD_LAM_MAX, step: 10, def: 50 },
                // 上限為什麼是 200 cm：見上面的 WD_A_MAX。
                { key: 'a',   label: '開口寬 <i>a</i>',        unit: 'cm',
                  min: WD_A_MIN, max: WD_A_MAX, step: 10, def: 150 },
                { key: 'd',   label: '兩開口中心距 <i>d</i>',  unit: 'cm', min: 0,  max: 500, step: 10, def: 0 },
            ],
        },

        cards: [
            { label: '動畫時間',           id: 'cardTime',   unit: 's',   highlight: true },
            { label: 'λ ÷ 開口總寬（關鍵）', id: 'cardRatio',  unit: '倍',  highlight: true },
            { label: '波長 λ',             id: 'cardLam',    unit: 'cm' },
            { label: '開口總寬 a',         id: 'cardA',      unit: 'cm' },
            { label: '兩開口中心距 d',     id: 'cardD',      unit: 'cm' },
            { label: '第一暗紋夾角 θ₁',    id: 'cardDark',   unit: '°' },
            { label: '第一亮紋夾角 θ₁',    id: 'cardBright', unit: '°' },
            { label: '頻率 f = v ÷ λ',     id: 'cardF',      unit: 'Hz' },
            { label: '波速 v = √(gh)',     id: 'cardV',      unit: 'm/s' },
        ],

        values(t, panel) {
            const m = wdModel(t, panel);
            return {
                cardTime: t.toFixed(2),
                cardRatio: m.ratio.toFixed(2),
                cardLam: (m.lam * 100).toFixed(0),
                cardA: (m.aEff * 100).toFixed(0),
                cardD: (m.d * 100).toFixed(0),
                // 沒有的時候寫「沒有」，不要留一個空白的格子——那是真的結論。
                cardDark: m.single
                    ? (m.darkDeg == null ? '沒有' : m.darkDeg.toFixed(1))
                    : '兩個開口',
                cardBright: m.single
                    ? '單一開口'
                    : (m.brightDeg == null ? '沒有' : m.brightDeg.toFixed(1)),
                cardF: m.freq.toFixed(2),
                cardV: WaveTank.V.toFixed(2),
            };
        },

        titleText(t, panel) {
            const m = wdModel(t, panel);
            if (t < 0.05) {
                return '水波從左邊平直地打過來，穿過障礙物上的開口——'
                     + '看牆後面那一邊：波是照直線穿過去，還是往四面八方散開？';
            }
            if (m.single) {
                if (m.darkSin == null) {
                    return `λ ÷ a = ${m.ratio.toFixed(2)}：開口比波長還窄，波一穿過就往所有方向散開`
                         + `——牆後面整個都是亮的，一道暗紋都沒有（a·sinθ = λ 沒有解）`;
                }
                if (m.ratio >= 0.55) {
                    return `λ ÷ a = ${m.ratio.toFixed(2)}：中央亮帶很寬，第一道暗紋在 ±${m.darkDeg.toFixed(0)}°`
                         + `——把開口再拉窄一點，它就連暗紋都沒有了`;
                }
                return `λ ÷ a = ${m.ratio.toFixed(2)}：開口比波長寬得多，波幾乎照直線前進`
                     + `——牆後面留下一道「影子」，繞射只剩下 ±${m.darkDeg.toFixed(0)}° 這麼小的角度`;
            }
            if (m.brightDeg == null) {
                return `兩個開口相距 ${(m.d * 100).toFixed(0)} cm，但波長比它還長`
                     + `（d·sinθ = mλ 沒有解）——兩組圓形波疊起來分不出亮暗`;
            }
            return `兩個開口相距 d = ${(m.d * 100).toFixed(0)} cm，各自送出一組圓形波`
                 + `——相差整數個波長的方向就是亮紋：中央那條是 Δ = 0（正前方），`
                 + `第一對在 ±${m.brightDeg.toFixed(0)}°（Δ = λ）`;
        },

        draw(p, view, t, panel) {
            const m = wdModel(t, panel);
            const key = `${panel.lam}|${panel.a}|${panel.d}`;
            if (cache.key !== key) cache = buildCache(m, key);

            paintField(p, view, t, cache.tbl);
            drawTank(p, view);
            drawBarrier(p, view, m);
            drawFront(p, view, m);
            drawPattern(p, view, m, cache);

            // 波長括號放在**水槽底下**那一條空帶（762–812）。擺進水槽裡的話
            // 它會壓在條紋上——白色底的標籤還讀得到，但括號本身的線和端點
            // 會混進藍橘條紋裡，而那正是這一頁要學生看的東西。
            WaveScene.wavelengthBracket(p, view, 0.35, 0.35 + m.lam, WD_LAM_Y,
                `λ = ${(m.lam * 100).toFixed(0)} cm`, { size: 15 });
        },
    });

    // ======================================================================
    // 場：一張與時間無關的複數表，每一幀只是把它整體旋轉
    // ======================================================================

    function buildCache(m, key) {
        // 網格間距跟著波長走：一個波長至少 5 格，條紋才不會有稜角；但也不必
        // 細過 2 個世界單位——再細畫布上也看不出來，只是白算。
        const step = Math.max(m.lam / 5, 2 / WD_U);
        const nx = Math.max(24, Math.round(WD_M / step) + 1);
        const ny = Math.max(24, Math.round(WD_HALF_M * 2 / step) + 1);
        const tbl = WaveTank.table(m.P, {
            x0: 0, y0: -WD_HALF_M,
            dx: WD_M / (nx - 1), dy: WD_HALF_M * 2 / (ny - 1),
            nx, ny,
        });

        // 條紋的脊線與右緣的刻度都是**從場本身量出來的**。一個開口的頁面
        // 要看的是暗紋（波散開之後，哪裡反而靜下來），兩個開口看的是亮紋。
        const kind = m.single ? 'min' : 'max';
        const frac = m.single ? 0.5 : 0.35;
        const xs = [];
        for (let i = 0; i < 16; i++) {
            xs.push(WD_WALL_M + 0.45 + (WD_DEPTH_M - 0.45) * i / 15);
        }
        const prof = WaveTank.lineProfile(m.P, WD_EDGE_M, -WD_HALF_M, WD_HALF_M, 161);

        return {
            key, tbl,
            tracks: WaveTank.tracks(m.P, xs, WD_HALF_M, kind, frac),
            ticks: WaveTank.peaks(prof, frac, kind),
        };
    }

    /**
     * 把水域畫成一張低解析度的圖，再放大貼到水槽的矩形上。
     *
     * ⚠️ 真正貴的是 buildCache()，而它只在參數變動時跑。這裡每一幀每一格
     *    只做兩個乘法和兩個加法——這是這一頁跑得動的原因。
     */
    function paintField(p, view, t, tbl) {
        const ctx = p.drawingContext;
        const n = tbl.nx * tbl.ny;
        if (!tmpCnv) {
            tmpCnv = document.createElement('canvas');
            tmpCtx = tmpCnv.getContext('2d');
        }
        if (tmpCnv.width !== tbl.nx || tmpCnv.height !== tbl.ny) {
            tmpCnv.width = tbl.nx;
            tmpCnv.height = tbl.ny;
            tmpImg = tmpCtx.createImageData(tbl.nx, tbl.ny);
        }

        // 每一組參數各自正規化到最亮處：要看的是條紋的疏密與方向，
        // 不是絕對亮度（開口窄的時候，能量本來就只過得去那麼多）。
        const gain = 1 / Math.max(1.0, tbl.maxAbs);
        const om = WaveTank.omega(tbl.lam);
        const ct = Math.cos(om * t), st = Math.sin(om * t);
        const px = tmpImg.data;

        for (let i = 0, j = 0; i < n; i++, j += 4) {
            let v = (tbl.re[i] * ct + tbl.im[i] * st) * gain;
            if (v > 1) v = 1; else if (v < -1) v = -1;
            const c = ((v + 1) * 127.5) | 0;
            px[j]     = WD_RAMP[c * 3];
            px[j + 1] = WD_RAMP[c * 3 + 1];
            px[j + 2] = WD_RAMP[c * 3 + 2];
            px[j + 3] = 255;
        }
        tmpCtx.putImageData(tmpImg, 0, 0);

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tmpCnv,
            gx(view, 0), view.toScreenY(WD_Y0),
            gx(view, WD_M) - gx(view, 0),
            view.toScreenY(WD_Y1) - view.toScreenY(WD_Y0));
        ctx.restore();
    }

    function drawTank(p, view) {
        p.noFill();
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(3, 1.5));
        p.rect(gx(view, 0), view.toScreenY(WD_Y0),
               gx(view, WD_M) - gx(view, 0),
               view.toScreenY(WD_Y1) - view.toScreenY(WD_Y0));
    }

    // ======================================================================
    // 障礙物：牆＝「開口以外的地方」，照 WaveTank.gaps() 排出來
    // ======================================================================
    function drawBarrier(p, view, m) {
        const wx = gx(view, WD_WALL_M);
        const half = view.len(WD_WALL_T, 3);
        p.noStroke();
        p.fill(30, 41, 59);
        let prev = -WD_HALF_M;
        for (const g of m.gaps) {
            bar(prev, g.y0);
            prev = g.y1;
        }
        bar(prev, WD_HALF_M);

        function bar(y0, y1) {
            if (y1 - y0 < 1e-6) return;
            p.rect(wx - half, gy(view, y1), half * 2, gy(view, y0) - gy(view, y1));
        }
    }

    // ======================================================================
    // 牆前面：入射波的方向、開口的尺寸標註、顏色圖例
    // ======================================================================
    function drawFront(p, view, m) {
        // 入射方向：兩支箭頭。牆前面只有平直波，本來就很空。
        p.stroke(100, 116, 139);
        p.strokeWeight(view.len(3, 1.5));
        for (const ym of [2.62, 1.85]) {
            const x0 = gx(view, 0.25), x1 = gx(view, 1.95);
            const y = gy(view, ym);
            p.line(x0, y, x1, y);
            p.line(x1, y, x1 - view.len(13, 7), y - view.len(8, 4));
            p.line(x1, y, x1 - view.len(13, 7), y + view.len(8, 4));
        }
        p.noStroke();
        p.fill(100, 116, 139);
        p.textSize(view.len(14, 8));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.CENTER);
        p.text('入射的平直水波', gx(view, 0.25), gy(view, 3.05));

        // 顏色圖例
        const lx = gx(view, 0.3), lw = gx(view, 2.0) - lx, ly = gy(view, -2.55);
        const lh = view.len(26, 12);
        p.noStroke();
        for (let i = 0; i < 64; i++) {
            const c = (i / 63 * 255) | 0;
            p.fill(WD_RAMP[c * 3], WD_RAMP[c * 3 + 1], WD_RAMP[c * 3 + 2]);
            p.rect(lx + lw * i / 64, ly - lh / 2, lw / 64 + 1, lh);
        }
        p.fill(100, 116, 139);
        p.textSize(view.len(13, 8));
        p.textAlign(p.LEFT, p.TOP);
        p.text('藍＝波谷', lx, ly + lh / 2 + view.len(6, 3));
        p.textAlign(p.RIGHT, p.TOP);
        p.text('橙＝波峰', lx + lw, ly + lh / 2 + view.len(6, 3));
        p.textAlign(p.LEFT, p.CENTER);
        p.text('顏色＝這一刻的水面高低', lx + lw + view.len(16, 8), ly);

        // 開口的尺寸：a 貼著牆的左側，d 再往左一點
        const wxs = gx(view, WD_WALL_M);
        for (let i = 0; i < m.gaps.length; i++) {
            const g = m.gaps[i];
            vBracket(p, view, wxs - 34, gy(view, g.y0), gy(view, g.y1),
                i === 0 ? `a = ${((g.y1 - g.y0) * 100).toFixed(0)} cm` : null,
                [37, 99, 235]);
        }
        if (m.gaps.length === 2) {
            const c0 = (m.gaps[0].y0 + m.gaps[0].y1) / 2;
            const c1 = (m.gaps[1].y0 + m.gaps[1].y1) / 2;
            vBracket(p, view, wxs - 110, gy(view, c1), gy(view, c0),
                `d = ${(m.d * 100).toFixed(0)} cm`, [234, 88, 12]);
        }

        p.textAlign(p.RIGHT, p.BOTTOM);
        p.fill(30, 41, 59);
        p.text('障礙物', wxs - view.len(10, 6), gy(view, WD_HALF_M - 0.12));
    }

    /** 一支鉛直的量測括號（一條線 + 兩端的箭頭 + 中間的標籤）。 */
    function vBracket(p, view, x, yTop, yBot, label, col) {
        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(view.len(2, 1));
        p.line(x, yTop, x, yBot);
        for (const e of [[yTop, 1], [yBot, -1]]) {
            p.line(x, e[0], x - view.len(9, 5), e[0] + e[1] * view.len(9, 5));
            p.line(x, e[0], x + view.len(9, 5), e[0] + e[1] * view.len(9, 5));
        }
        if (!label) return;
        const size = view.len(14, 8);
        p.noStroke();
        p.textSize(size);
        p.textStyle(p.BOLD);
        const tw = p.textWidth(label);
        const mid = (yTop + yBot) / 2;
        p.fill(255);
        p.rect(x - tw / 2 - view.len(5, 3), mid - size / 2 - view.len(4, 2),
               tw + view.len(10, 6), size + view.len(8, 4));
        p.fill(col[0], col[1], col[2]);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(label, x, mid);
    }

    // ======================================================================
    // 牆後面：條紋、右緣的刻度、以及那一句結論
    // ======================================================================
    function drawPattern(p, view, m, c) {
        // 條紋：一串點沿著亮紋（或暗紋）排——位置是從場裡量出來的
        const col = m.single ? [100, 116, 139] : [234, 88, 12];
        p.noStroke();
        p.fill(col[0], col[1], col[2], 220);
        for (const q of c.tracks) {
            p.circle(gx(view, q.x), gy(view, q.y), view.len(7, 3.5));
        }

        // 右緣的刻度。兩個開口時順便把「這是第幾條」標出來——那個 m
        // 不是數出來的，是**量出來的**：這一條到兩個開口的距離差除以 λ。
        //
        // ⚠️ 一個開口時**只有最靠近中線的那一對**能標「第 1 暗紋」。曾經
        //    每一條都標「第 1 暗紋」——開口拉到 200 cm、λ = 50 cm 的時候
        //    畫面上有兩對暗紋，兩對都寫著「第 1」，而 errs=0、卡片也對。
        //    「最裡面那條就是第一道暗紋」不需要遠場近似就成立，所以照
        //    |y| 最小的一對標；更外面那幾條只標「暗紋」——課本的「第 m 暗紋」
        //    在開口大的時候本來就對不上（見上面 sliders 的說明），硬標一個
        //    號碼會給出看起來很精確、其實沒意義的數字。
        const ex = gx(view, WD_EDGE_M);
        const dxm = WD_EDGE_M - WD_WALL_M;
        let innerAbs = Infinity;
        for (const q of c.ticks) innerAbs = Math.min(innerAbs, Math.abs(q.y));
        p.strokeWeight(view.len(2, 1));
        for (const q of c.ticks) {
            p.stroke(col[0], col[1], col[2]);
            p.line(ex, gy(view, q.y), ex + view.len(16, 9), gy(view, q.y));
            p.noStroke();
            p.textSize(view.len(13, 8));
            p.textStyle(p.BOLD);
            p.textAlign(p.RIGHT, p.CENTER);
            let tag;
            if (m.single) {
                tag = Math.abs(Math.abs(q.y) - innerAbs) < 1e-9 ? '第 1 暗紋' : '暗紋';
            } else {
                const r1 = Math.hypot(dxm, q.y - m.d / 2);
                const r2 = Math.hypot(dxm, q.y + m.d / 2);
                const order = Math.round(Math.abs(r2 - r1) / m.lam);
                tag = order === 0 ? 'Δ = 0' : `Δ = ${order}λ`;
            }
            const ty = gy(view, q.y);
            p.fill(255);
            p.rect(ex - view.len(96, 52), ty - view.len(11, 6),
                   view.len(92, 50), view.len(22, 12));
            p.fill(col[0], col[1], col[2]);
            p.text(tag, ex - view.len(8, 4), ty);
        }

        // 一個開口、而且 λ ≥ a：那個結論沒有別的地方可以講
        if (m.single && m.darkSin == null) {
            WaveScene.valueBadge(p, view, gx(view, WD_WALL_M + WD_DEPTH_M / 2),
                gy(view, WD_HALF_M - 0.5),
                'λ ≥ a：沒有暗紋，牆後面整個都是亮的',
                { size: 15, stroke: [239, 68, 68], fillColor: [185, 28, 28] });
        }
    }
}

initWaveDiffraction();

// 匯出這一頁的常數，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    WD_X0, WD_X1, WD_M, WD_U, WD_Y0, WD_Y1, WD_MID_Y, WD_HALF_M,
    WD_WALL_M, WD_WALL_T, WD_EDGE_M, WD_DEPTH_M, WD_LAM_Y,
    // 滑桿的框。「卡片上的 asin(λ/a) 配得上畫面上的暗紋」那條斷言掃的就是它。
    WD_LAM_MIN, WD_LAM_MAX, WD_A_MIN, WD_A_MAX,
    model: wdModel,
};
