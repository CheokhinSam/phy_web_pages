/**
 * 🌊 水波的干涉 — 兩根針各自送出一圈一圈的圓形波，疊起來的地方有的方向
 * 一直在動，有的方向幾乎不動。
 *
 * 畫面是一座造波水槽的俯視圖，那一整片顏色**不是貼圖**——它是兩個**點波源**
 * 的場，一個格子一個格子疊出來的：
 *
 *     u(P, t) = cos(ωt − k·r₁ − φ₁)/√r₁ + cos(ωt − k·r₂ − φ₂)/√r₂
 *
 * 看得到的三件事：
 *
 *   1. **有些方向一直是亮的。** 到兩根針的距離差 Δr 剛好是整數個波長的方向，
 *      兩列波永遠同相抵達，那裡的水一直在動（**腹線**）；差半個波長的方向
 *      永遠反相，幾乎不動（**節線**）。
 *   2. **兩根針拉遠，條紋就變密。** d ÷ λ 決定有幾條腹線、它們張開幾度。
 *   3. **相位反過來，腹線與節線整個對調**——連正中央那一條都會從腹線變成
 *      節線。
 *
 * ⚠️ 這一頁的波源是**針尖**（等向的點），和 27 繞射的「開口」不一樣。開口
 *    上的取樣點帶 Kirchhoff 傾斜因子、而且分散在一段寬度上，亮紋會被拉離開
 *    嚴格的等相差位置（那一頁因此**刻意不畫**雙曲線）；針尖沒有這些，所以
 *    這一頁畫的就是 Δr 的精確等值線。
 *
 * ⚠️ **但精確的「Δr = mλ」不等於「眼睛看到最亮的那條」。** 振幅是
 *    1/√r₁ 與 1/√r₂ 疊出來的，波源附近衰減得快，脊線會被這股衰減往內拉
 *    （水槽深處實測最多差 0.1 公尺，也就是 11 個像素）。這也是為什麼滑桿
 *    的 d **從 120 公分起跳**：d 小的時候最外側那條腹線幾乎垂直往上跑，
 *    衰減主導一切，脊線會偏離到 1 公尺以上——那已經不是「畫得準不準」，
 *    而是那組參數根本看不出干涉圖樣。細節見 WI_D_MIN 的說明。
 *
 * ⚠️ 這一頁**沒有慢動作**：水深 16 公分的水槽裡 v = √(gh) ≈ 1.25 m/s，
 *    波長 0.3–0.9 公尺、週期 0.24–0.72 秒，本來就是肉眼跟得上的速度。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// --------------------------------------------------------------------------
// 水槽和 27 繞射那一頁**同一個尺寸**（8.0 公尺 × 6.6 公尺、110 世界單位/公尺），
// 兩頁可以並排比較，wavelengthBracket 也是同一個尺度。
// ==========================================================================
const WI_X0 = 70;              // 水槽左緣（世界 x）
const WI_X1 = 950;             // 水槽右緣
const WI_M  = 8.0;             // 水槽實際寬度（公尺）
const WI_U  = (WI_X1 - WI_X0) / WI_M;             // 110 世界單位 / 公尺

const WI_Y0 = 36;              // 水槽上緣（世界 y）
const WI_Y1 = 762;             // 水槽下緣
const WI_MID_Y = (WI_Y0 + WI_Y1) / 2;             // 水槽中線＝水面高度 0
const WI_HALF_M = ((WI_Y1 - WI_Y0) / 2) / WI_U;   // 3.30 公尺（水槽半高）

// 兩根針插在這一條線上（距水槽左緣）。留在左邊 1.4 公尺是刻意的：針是
// **點波源**，波往四面八方走，所以針的左邊真的有波往回跑——那是畫面上唯一
// 看得到「圓形波不是只有右半邊」的地方。
const WI_SRC_M  = 1.4;
const WI_TIP_R  = 0.075;       // 針尖點的半徑（公尺）
// 曲線取樣到這裡為止（公尺，距波源線）。留 0.1 公尺是因為水槽的框線本身有
// 半個線寬，貼著畫會被框線吃掉一角。
const WI_DEEP_M   = WI_M - WI_SRC_M - 0.1;   // 6.5 公尺
const WI_LAM_Y    = 795;       // 波長括號的世界 y（水槽下緣 762 與標題列 812 之間）
const WI_LAM_X0   = 0.35;      // 波長括號的左端（公尺）
const WI_LEG_M    = 2.30;      // 圖例從這裡開始（公尺）——必須排在波長括號右邊，
                               // 而且要留得下最右邊那一串字（見 wiLegendRow）

// 顏色＝水面高低（和 27 同一張表，見 wave-scene.js 的 waterRamp）。
const WI_RAMP = WaveScene.waterRamp;

// 腹線與節線的顏色。橙＝「這裡一直在動」，灰＝「這裡幾乎不動」——
// 和色階的橙（波峰）**不是同一個橙的用途**，所以線比色階深一階。
const WI_BRIGHT_COL = [234, 88, 12];
const WI_MUTE_COL  = [100, 116, 139];   // 圖例最後那一串灰色的字
const WI_DARK_COL   = [100, 116, 139];

// 水槽底下那一排圖例。**這一排就是畫面上看到的那一排**——寬度由
// `wiLegendRow()` 真的量出來，驗證器再用自己的尺重量一次（㊱i）。
//
// ⚠️ 三項的文字都刻意短。這一排**只有一行、而且不換行**，而最窄的那個
//    尺度（850 × 314 的畫布，scale = 0.3489）把整個世界壓到只剩 349 個
//    像素寬、水槽右緣在 582 px。第一版把 `Δr = mλ` 也寫在這裡（三串字
//    共 23.4 em）：字級與色塊都有像素下限，縮不下去，最後那一串
//    「藍＝波谷、橙＝波峰」被畫布裁掉 **27.6 像素**——而 `errs=0`、
//    卡片全對、腹線照樣畫得出來、顏色圖例也還在（這是 ㉖ 抓到的）。
//    `Δr` 的式子左側公式框已經有了，這裡只要回答「哪一條線是哪一條」。
const WI_LEG_ITEMS = [
    { col: WI_BRIGHT_COL, dash: false, line: true,  text: '腹線' },
    { col: WI_DARK_COL,   dash: true,  line: true,  text: '節線' },
    { col: WI_MUTE_COL,   dash: false, line: false, text: '藍＝波谷、橙＝波峰' },
];


const WI_LAM_MIN = 30, WI_LAM_MAX = 90, WI_LAM_DEF = 50;    // cm

/**
 * 兩根針的距離。**下限 120 公分是量出來的，不是口味。**
 *
 * 腹線畫的是精確的 Δr = mλ 等值線，而水面上最亮的脊線會被 1/√r 的衰減
 * 往內拉一點。跑遍整個滑桿框量「脊線離雙曲線多遠」，最壞的一筆是
 * **λ = 85、d = 100 反相時的 0.155 公尺**；d 從 120 公分起跳之後降到
 * **0.10 公尺（11 個像素）**，而同一條剖面上相鄰兩條腹線至少隔 0.67 公尺
 * （73 個像素）——也就是說，畫上去的線永遠落在它自己那一條亮帶裡面。
 *
 * d 再小的話最外側那條腹線幾乎垂直往上跑（d = 30、λ = 50 反相時張角 56°），
 * 整條剖面由衰減主導，脊線會偏到 1 公尺以上。那時候畫面上根本沒有「fan 開
 * 的條紋」可以看，畫幾條線都一樣沒有意義——與其畫一張看不出干涉的干涉圖，
 * 不如把滑桿從有意義的地方開始。
 */
const WI_D_MIN = 120, WI_D_MAX = 300, WI_D_DEF = 150;       // cm

// ==========================================================================
// 這一頁的物理
// --------------------------------------------------------------------------
// 卡片、畫面、標題列共用同一份，驗證器也從 window.__page 讀它
// （見 .github/scripts/headless/README.md）。
// ==========================================================================

/**
 * 波程差 = order·λ 的那幾條線有哪些 order。
 *
 * 兩根針之間的最大波程差就是 d，所以 `order ≥ d ÷ λ` 的線**不存在**
 * （那條線在無窮遠處），這個迴圈自然就停在 d ÷ λ。
 *
 * `shift` 是「哪一種差算腹線」：同相時腹線在 Δr = mλ（shift = 0），
 * 反相時整個往後挪半步，腹線跑到 Δr = (m + ½)λ（shift = 0.5），節線反過來。
 */
function wiOrders(shift, lam, d) {
    const D = d / lam;
    const orders = [];
    // ⚠️ 減 1e-9 是為了 d ÷ λ 剛好是整數（例如 d = 150、λ = 50）的那一格：
    //    order = D 的線在無窮遠處，不可以畫、也不可以數進來，而浮點除法
    //    給的 D 可能是 3.0000000000000004。**這裡是唯一可以補償的地方**——
    //    locusY 用的是同一條不等式但不含補償，所以補償過頭會讓兩邊分家。
    for (let m = 0; m + shift < D - 1e-9; m++) orders.push(m + shift);
    return orders;
}

function wiModel(t, panel) {
    const lam = panel.lam / 100, d = panel.d / 100;
    const anti = panel.phase === 'anti';
    // ⚠️ 場源清單由 wave-tank.js 的 needles() 產生。**wallX 就是波源線**，
    //    和 27 的障礙物同一個名字——norm() 與 table() 的 maxAbs 都以它為
    //    基準，針尖另外叫一個名字的話，兩個數字遲早會分家。
    const P = { lam, d, wallX: WI_SRC_M, needles: true, anti };
    const off = anti ? 0.5 : 0;

    const bright = wiOrders(off, lam, d);
    const dark = wiOrders(0.5 - off, lam, d);

    // 最內側那一條腹線的方向：課本的 d·sinθ = λ（反相時是 d·sinθ = λ/2）。
    // 那是**遠場**的方向，也就是雙曲線的漸近線——不是它在水槽裡的樣子。
    const pos = bright.filter(q => q > 0);
    const sinT = pos.length ? pos[0] * lam / d : null;
    const ok = sinT != null && sinT <= 1;

    return {
        lam, d, anti, off, P, bright, dark,
        brightCount: wiLineCount(bright),
        darkCount: wiLineCount(dark),
        // 沒有的時候是 null，不是 0——那是真的結論（一條都排不出來）。
        firstSin: ok ? sinT : null,
        firstDeg: ok ? Math.asin(sinT) * 180 / Math.PI : null,
        freq: WaveTank.V / lam,
        show: panel.lines,                       // 'both' | 'bright' | 'dark' | 'none'
    };
}

/** 一組 order 在水槽裡畫成幾條線：order = 0 是正中央那一條，其餘都是 ±一對。 */
function wiLineCount(orders) {
    return orders.reduce((n, q) => n + (q === 0 ? 1 : 2), 0);
}

/**
 * 把一組 order 取樣成世界座標的折線——**畫面上那幾條線就是這一份資料**。
 *
 * ⚠️ 只畫波源線**右邊**那半（X ≥ 0）。完整的等相差線其實左右對稱地延伸到
 *    針的後面，但那一半擠在 1.4 公尺寬的角落裡、而且和條紋扇形的方向相反，
 *    畫上去只是把畫面塞滿。
 *
 * ⚠️ 折線在**離開水槽上／下緣的那一點就結束**（`locusY` 回 null），標籤就
 *    貼在那個端點上。這樣每一條畫出來的線都剛好有一個標籤，而且標籤自然
 *    沿著水槽邊緣散開：張角大的停在左右兩側的上下緣，張角小的走到右緣。
 *    （畫成一條固定的垂直標線的話，張角大的那幾條根本到不了那條線——實測
 *    只有 44% 的腹線碰得到右緣的標線，標籤數和卡片上的條數會對不起來。）
 *
 * ⚠️ X 用**均勻**取樣就夠了：這條曲線的斜率從頂點的 0 慢慢增加到
 *    sinθ = order·λ/d，最大不超過 1（45°），沒有「幾乎垂直」的那一段。
 */
function wiCurves(m, orders) {
    const out = [];
    const N = 240;
    for (const order of orders) {
        // order = 0 是正中央那一條：兩個分支重合在 y = 0，畫一條就好。
        for (const sg of (order === 0 ? [1] : [1, -1])) {
            const pts = [];
            for (let i = 0; i <= N; i++) {
                const X = WI_DEEP_M * i / N;
                // ⚠️ yMax 就是水槽半高，**不可以多給**。多給 0.3 公尺的話
                //    折線會爬到水槽外面，而標籤是貼在**折線末端**的——
                //    於是那幾張牌子的文字跟著跑到世界矩形外面被裁掉一角，
                //    畫面上只是「有一張牌子的字少了上半截」（㉖ 抓到的）。
                //    `locusY` 在解超過 yMax 時直接回 null，所以折線會**準確
                //    停在水槽邊緣**，不需要靠裁切去補。
                const Y = WaveTank.locusY(m.d, m.lam, order, X, WI_HALF_M);
                if (Y == null) break;      // 出去了就不會再回來（Y 隨 X 單調增加）
                pts.push([WI_SRC_M + X, sg * Y]);
            }
            if (pts.length > 1) out.push({ order, sign: sg, pts });
        }
    }
    return out;
}

/** `Δ = 2λ` 這種標籤。order = 0 是正中央那一條，寫「Δ = 0」。 */
function wiOrderLabel(order) {
    if (order === 0) return 'Δ = 0';
    return `Δ = ${order % 1 === 0 ? order : order.toFixed(1)}λ`;
}

function initWaveInterference() {
    // 上一次算過的場與雙曲線。兩者都**與時間無關**，只在參數變動時重算一次。
    let cache = { key: '', tbl: null, curves: null };
    let tmpCnv = null, tmpCtx = null, tmpImg = null;

    // 水槽座標（公尺）→ 畫面像素。x 直接用 WaveScene 的 ropeX——水槽寬度與
    // 尺度是刻意和繩子那幾頁對齊的，wavelengthBracket 才會落在同一條線上。
    const gx = (view, m) => WaveScene.ropeX(view, m);
    const gy = (view, m) => view.toScreenY(WI_MID_Y - m * WI_U);

    WaveScene.run({

        formula: '\\begin{aligned} \\text{腹線}\\;&\\Delta r = m\\lambda \\\\ '
               + '\\text{節線}\\;&\\Delta r = \\left(m + \\tfrac{1}{2}\\right)\\lambda \\end{aligned}',
        formulaFallback: '腹線　Δr = mλ　／　節線　Δr = (m + ½)λ',

        controls: {
            selects: [
                { key: 'phase', label: '兩根針的相位', def: 'same', options: [
                    { v: 'same', t: '同相（一起上、一起下）' },
                    { v: 'anti', t: '反相（一根上時另一根下）' },
                ] },
                { key: 'lines', label: '輔助線', def: 'both', options: [
                    { v: 'both',   t: '腹線 ＋ 節線' },
                    { v: 'bright', t: '只看腹線' },
                    { v: 'dark',   t: '只看節線' },
                    { v: 'none',   t: '都不畫' },
                ] },
            ],
            sliders: [
                { key: 'lam', label: '波長 <i>λ</i>',        unit: 'cm',
                  min: WI_LAM_MIN, max: WI_LAM_MAX, step: 5, def: WI_LAM_DEF },
                { key: 'd',   label: '兩根針的距離 <i>d</i>', unit: 'cm',
                  min: WI_D_MIN,   max: WI_D_MAX,   step: 10, def: WI_D_DEF },
            ],
        },

        // ⚠️ 這一頁拉滑桿**不停動畫**（keepLive）：整頁的重點就是「一邊拖 d、
        //    一邊看條紋長出來」，每拖一格就停下來要學生重按一次開始，那件事
        //    就看不成了。（27 繞射那一頁沒有宣告，所以它會停——兩頁的差別
        //    是刻意的。）
        keepLive: ['lam', 'd', 'phase', 'lines'],

        cards: [
            { label: '動畫時間',        id: 'cardTime',   unit: 's',   highlight: true },
            { label: 'd ÷ λ（關鍵）',   id: 'cardRatio',  unit: '倍',  highlight: true },
            { label: '波長 λ',          id: 'cardLam',    unit: 'cm' },
            { label: '兩根針的距離 d',  id: 'cardD',      unit: 'cm' },
            { label: '相位差',          id: 'cardPhase',  unit: '°' },
            { label: '腹線條數',        id: 'cardBright', unit: '條' },
            { label: '節線條數',        id: 'cardDark',   unit: '條' },
            { label: '最內側腹線夾角 θ₁', id: 'cardTheta', unit: '°' },
            { label: '頻率 f = v ÷ λ',  id: 'cardF',      unit: 'Hz' },
            { label: '波速 v = √(gh)',  id: 'cardV',      unit: 'm/s' },
        ],

        values(t, panel) {
            const m = wiModel(t, panel);
            return {
                cardTime: t.toFixed(2),
                cardRatio: (m.d / m.lam).toFixed(2),
                cardLam: (m.lam * 100).toFixed(0),
                cardD: (m.d * 100).toFixed(0),
                cardPhase: m.anti ? '180' : '0',
                cardBright: String(m.brightCount),
                cardDark: String(m.darkCount),
                cardTheta: m.firstDeg == null ? '沒有' : m.firstDeg.toFixed(1),
                cardF: m.freq.toFixed(2),
                cardV: WaveTank.V.toFixed(2),
            };
        },

        titleText(t, panel) {
            const m = wiModel(t, panel);
            if (t < 0.05) {
                return '兩根針插在水裡上下振動，各自送出一圈一圈的圓形波——'
                     + '看它們疊在一起的地方：有些方向一直在動，有些方向幾乎不動。';
            }
            if (m.anti) {
                return `兩根針反相（相位差 180°）：腹線與節線整個對調——`
                     + `正中央那條從腹線變成節線，腹線剩下 ${m.brightCount} 條、節線 ${m.darkCount} 條`;
            }
            return `d ÷ λ = ${(m.d / m.lam).toFixed(2)}：波程差可以是 0 到 ${(m.d * 100).toFixed(0)} 公分之間的每一個值`
                 + `——Δr = mλ 的 ${m.brightCount} 條腹線就是這樣排出來的（最內側在 ±${m.firstDeg == null ? '—' : m.firstDeg.toFixed(0)}°）`;
        },

        draw(p, view, t, panel) {
            const m = wiModel(t, panel);
            const key = `${panel.lam}|${panel.d}|${panel.phase}`;
            if (cache.key !== key) cache = buildCache(m, key);

            paintField(p, view, t, cache.tbl);
            drawTank(p, view);
            drawCurves(p, view, m, cache);
            drawOrderTags(p, view, m, cache);
            drawSources(p, view, m);
            drawLegend(p, view);

            // 波長括號放在水槽底下那一條空帶（762–812）。擺進水槽裡的話
            // 它會壓在條紋上——而那正是這一頁要學生看的東西。
            WaveScene.wavelengthBracket(p, view, WI_LAM_X0, WI_LAM_X0 + m.lam, WI_LAM_Y,
                `λ = ${(m.lam * 100).toFixed(0)} cm`, { size: 15 });
        },
    });

    // ======================================================================
    // 場：一張與時間無關的複數表，每一幀只是把它整體旋轉
    // ======================================================================

    function buildCache(m, key) {
        // 網格間距跟著波長走：一個波長至少 5 格，圓弧才不會有稜角；但也不必
        // 細過 2 個世界單位——再細畫布上也看不出來，只是白算。
        const step = Math.max(m.lam / 5, 2 / WI_U);
        const nx = Math.max(24, Math.round(WI_M / step) + 1);
        const ny = Math.max(24, Math.round(WI_HALF_M * 2 / step) + 1);
        const tbl = WaveTank.table(m.P, {
            x0: 0, y0: -WI_HALF_M,
            dx: WI_M / (nx - 1), dy: WI_HALF_M * 2 / (ny - 1),
            nx, ny,
        });

        // 雙曲線也與時間無關，所以在這裡算一次就好——每一幀重算的話，
        // 光是那些二分法就要跑掉幾毫秒。
        return {
            key, tbl,
            curves: { bright: wiCurves(m, m.bright), dark: wiCurves(m, m.dark) },
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
        // 不是絕對亮度（波源附近的振幅本來就大得多）。
        const gain = 1 / Math.max(1.0, tbl.maxAbs);
        const om = WaveTank.omega(tbl.lam);
        const ct = Math.cos(om * t), st = Math.sin(om * t);
        const px = tmpImg.data;

        for (let i = 0, j = 0; i < n; i++, j += 4) {
            let v = (tbl.re[i] * ct + tbl.im[i] * st) * gain;
            if (v > 1) v = 1; else if (v < -1) v = -1;
            const c = ((v + 1) * 127.5) | 0;
            px[j]     = WI_RAMP[c * 3];
            px[j + 1] = WI_RAMP[c * 3 + 1];
            px[j + 2] = WI_RAMP[c * 3 + 2];
            px[j + 3] = 255;
        }
        tmpCtx.putImageData(tmpImg, 0, 0);

        // ⚠️ 用 `p.push()`／`p.pop()`，**不要**用 `ctx.save()`／`ctx.restore()`
        //    ——理由見 `drawCurve` 上面那一段。
        p.push();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tmpCnv,
            gx(view, 0), view.toScreenY(WI_Y0),
            gx(view, WI_M) - gx(view, 0),
            view.toScreenY(WI_Y1) - view.toScreenY(WI_Y0));
        p.pop();
    }

    function drawTank(p, view) {
        p.noFill();
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(3, 1.5));
        p.rect(gx(view, 0), view.toScreenY(WI_Y0),
               gx(view, WI_M) - gx(view, 0),
               view.toScreenY(WI_Y1) - view.toScreenY(WI_Y0));
    }

    /**
     * 腹線與節線。兩組曲線都要**裁進水槽**——它們在波源附近會爬出水槽
     * 上緣，不裁的話會畫到水槽外面的白邊上，看起來像貼紙沒對齊。
     */
    function drawCurves(p, view, m, c) {
        const ctx = p.drawingContext;
        const showBright = m.show === 'both' || m.show === 'bright';
        const showDark   = m.show === 'both' || m.show === 'dark';
        if (!showBright && !showDark) return;

        p.push();
        ctx.beginPath();
        // ⚠️ 裁切框是**螢幕像素**，而且左右兩緣要跟 `drawTank` 畫的那個框
        //    用同一個來源（`gx`）。第一版這裡寫成 `gx(view, WI_X0 + m)`——
        //    `gx` 吃的是**公尺**，多加了 70 之後裁切框整塊飛到畫布外，
        //    **一條腹線都畫不出來**，而卡片、標籤、水槽框、色階全部照常，
        //    沒有任何錯誤訊息（這是 ㉖ 抓到的）。
        ctx.rect(gx(view, 0), view.toScreenY(WI_Y0),
                 gx(view, WI_M) - gx(view, 0),
                 view.toScreenY(WI_Y1) - view.toScreenY(WI_Y0));
        ctx.clip();

        // 節線先畫（虛線、灰的），腹線壓在上面——腹線才是這一頁的主角。
        if (showDark) for (const cv of c.curves.dark) drawCurve(p, view, cv.pts, WI_DARK_COL, true);
        if (showBright) for (const cv of c.curves.bright) drawCurve(p, view, cv.pts, WI_BRIGHT_COL, false);
        p.pop();
    }

    /** 一條折線。⚠️ `noFill()` 必須在自己這一支裡、且在 `beginShape()` 之前
     *  ——p5 的 `endShape()` 不帶參數時描邊不閉合，但填色照樣會把路徑填滿，
     *  繼承到上一個函式留下的填色的話，整條雙曲線會變成一塊實心色塊。
     *
     * ⚠️ 這裡**一定**要用 `p.push()`／`p.pop()`，不能用
     *    `ctx.save()`／`ctx.restore()`——**這是實際踩過的坑，而且只有截圖看得出來**。
     *
     *    p5 1.9 的快取是這樣的（`p5.min.js` 的 `_setStroke`／`_getStroke`）：
     *
     *        _setStroke(e) { e !== this._cachedStrokeStyle
     *                        && (this.drawingContext.strokeStyle = e,
     *                            this._cachedStrokeStyle = e) }
     *
     *    ——p5 只在「顏色和快取不一樣」的時候才真的寫進畫布。而
     *    `ctx.restore()` 會把畫布狀態倒回存檔的那一刻（＝上一支函式留下的
     *    顏色），**p5 的快取卻動也不動**。於是下一條線如果和上一條同色，
     *    p5 就認為「已經設好了」而跳過賦值，畫布上留著的是還原回來的那個
     *    顏色——第二條以後的腹線全部被畫成水槽框的淡藍灰（203,213,225）。
     *
     *    症狀：**第一條是對的，第二條以後全錯**（每一組顏色只有「和上一條
     *    不同」的那一條僥倖正確），`errs=0`、卡片全對、標籤顏色也對（標籤是
     *    自己 `fill()` 的）——只有截圖逐條看線的顏色才看得出來。
     *    `p.push()`／`p.pop()` 除了存還原畫布，還會把 p5 自己的快取一起
     *    重新同步（`pop` 裡就是 `_cachedStrokeStyle = drawingContext.strokeStyle`），
     *    所以它是唯一安全的寫法。 */
    function drawCurve(p, view, pts, col, dashed) {
        const ctx = p.drawingContext;
        p.push();
        if (dashed) ctx.setLineDash([view.len(10, 5), view.len(8, 4)]);
        p.noFill();
        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(dashed ? view.len(2.2, 1.1) : view.len(2.8, 1.4));
        p.beginShape();
        for (const q of pts) p.vertex(gx(view, q[0]), gy(view, q[1]));
        p.endShape();
        p.pop();
    }

    /**
     * 每一條腹線的末端貼一張 `Δ = mλ`。位置就是**折線的最後一點**——曲線
     * 從那裡離開水槽，所以標籤自然沿著水槽邊緣排開：張角大的停在上下緣、
     * 張角小的走到右緣。一張標籤對一條線，不會有多畫或少畫的問題。
     *
     * 只有腹線貼標籤：課本的 Δr = mλ 講的就是腹線那一組，而兩組都貼的話
     * 牌子的數量直接加倍（λ = 30、d = 300 時就會從 10 張變 20 張）。
     * 節線的 Δr = (m + ½)λ 由圖例那條灰虛線負責。
     *
     * ⚠️ 兩張白底牌**疊在一起就看不見了**，而畫面上不會有任何錯誤訊息、
     *    卡片也全對。λ 小、d 大的時候水槽右緣會擠上十張牌（λ = 30、d = 300
     *    時間距只有 73 個像素），所以這裡逐張檢查「有沒有壓到已經放好的
     *    牌子」，壓到就只留下那條線。**這一類缺陷只有截圖看得出來**（陷阱九），
     *    所以讓開的判斷要能被驗證器單獨呼叫——見 wiPickTags()。
     */
    function drawOrderTags(p, view, m, c) {
        if (m.show !== 'both' && m.show !== 'bright') return;
        const size = view.len(13, 8);
        p.textSize(size);
        p.textStyle(p.BOLD);

        const tags = c.curves.bright.map(cv => ({
            tag: wiOrderLabel(cv.order),
            x: gx(view, cv.pts[cv.pts.length - 1][0]),
            y: gy(view, cv.pts[cv.pts.length - 1][1]),
            col: WI_BRIGHT_COL,
        }));
        for (const t of tags) {
            t.w = p.textWidth(t.tag) + view.len(10, 6);
            t.h = size * 1.7;
        }
        for (const t of wiPickTags(tags, gx(view, WI_M), view.len(5, 3))) {
            const bx = Math.min(t.x, gx(view, WI_M)) - t.w;   // 牌子一律往左長
            const by = t.y - t.h / 2;
            p.noStroke();
            p.fill(255);
            p.rect(bx, by, t.w, t.h);
            p.fill(t.col[0], t.col[1], t.col[2]);
            p.text(t.tag, bx + view.len(5, 3), t.y);
        }
    }

    /** 兩根針，以及它們之間的距離 d。 */
    function drawSources(p, view, m) {
        const sx = gx(view, WI_SRC_M);

        // d 的量測括號畫在針的左邊（波往回跑的那一側），標籤是白底牌，
        // 壓在條紋上也讀得到。
        WaveScene.vBracket(p, view, sx - view.len(34, 20),
            gy(view, m.d / 2), gy(view, -m.d / 2),
            `d = ${(m.d * 100).toFixed(0)} cm`, WI_BRIGHT_COL);

        for (const c of WaveTank.centers(m.P)) {
            const yy = gy(view, c);
            p.noStroke();
            p.fill(255);
            p.circle(sx, yy, view.len(WI_TIP_R * 2 * WI_U, 9) + view.len(4, 2));
            p.fill(15, 23, 42);
            p.circle(sx, yy, view.len(WI_TIP_R * 2 * WI_U, 7));
        }
    }

    /**
     * 底部那一條空帶（水槽下緣到標題列之間）的圖例：兩條說明線的長相，
     * 以及顏色的意思。波長括號在最左邊（0.35 公尺起，最長到 1.25 公尺），
     * 所以這一串從 WI_LEG_M 開始——`wiLegendFits()` 在算的就是那個「不會撞到」。
     *
     * ⚠️ 排版完全交給模組層的 `wiLegendRow()`，這裡只負責把算出來的位置
     *    畫出來。第一版把「往右推多少」寫在這一支裡面，驗證器進不來——
     *    而它的症狀是**最右邊那一串字被畫布裁掉**，`errs=0`、卡片全對、
     *    水槽框和條紋都好端端的（這是 ㉖ 抓到的）。
     */
    function drawLegend(p, view) {
        const size = view.len(13, 8);
        p.textSize(size);
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.CENTER);

        const y = view.toScreenY(WI_LAM_Y);
        const row = wiLegendRow((s) => p.textWidth(s), gx(view, WI_LEG_M), size,
                                view.len(34, 20), view.len(8, 4), view.len(20, 10));

        for (const it of row) {
            if (it.kind === 'line') {
                const ctx = p.drawingContext;
                p.push();
                if (it.dash) ctx.setLineDash([view.len(10, 5), view.len(8, 4)]);
                p.stroke(it.col[0], it.col[1], it.col[2]);
                p.strokeWeight(it.dash ? view.len(2.2, 1.1) : view.len(2.8, 1.4));
                p.line(it.x, y, it.x + it.w, y);
                p.pop();
            } else {
                p.noStroke();
                p.fill(it.col[0], it.col[1], it.col[2]);
                p.text(it.text, it.x, y);
            }
        }
    }
}

/**
 * 水槽底下那一條圖例的排版——**畫出來的那幾塊就是這一份資料**。
 *
 * `measure` 是「一段字多寬」的函式（畫面傳 `p.textWidth`，驗證器傳自己的
 * 保守估計），所以兩邊算的是同一條式子，不會各算一份。
 *
 * ⚠️ 每一項的寬度都要**真的**問出來。這裡是這一頁唯一一排「一直往右長、
 *    沒有換行」的東西，而它被畫布裁掉時沒有任何症狀（陷阱九）。
 *
 * `items` 是最後一個參數、預設是 `WI_LEG_ITEMS`——只有驗證器會傳（㊱i 的
 * 反面要餵一個更長的字串，證明「排得下」不是因為這一排本來就短）。
 */
function wiLegendRow(measure, x0, size, seg, gapMid, gapEnd, items) {
    const out = [];
    let x = x0;
    for (const it of (items || WI_LEG_ITEMS)) {
        if (it.line) {
            out.push({ kind: 'line', col: it.col, dash: it.dash, x, w: seg });
            x += seg + gapMid;
        }
        const w = measure(it.text);
        out.push({ kind: 'text', col: it.col, text: it.text, x, w });
        x += w + gapEnd;
    }
    return out;
}

/**
 * 標籤要貼哪些、貼在哪裡——**畫面上那幾張牌子就是這一份資料**。
 *
 * 位置是折線的末端（曲線離開水槽的地方），所以標籤自然沿著水槽邊緣排開。
 * 由右往左放；凡是有機會壓到已經放好的牌子的，直接跳過（只留線不留字）。
 * 判斷用**矩形相交**，不是「離上一個多遠」——標籤沿著兩條邊排，兩個方向
 * 都要讓。
 */
function wiPickTags(tags, tankRight, padX) {
    const out = [], placed = [];
    const sorted = tags.slice().sort((a, b) => (b.x - a.x) || (a.y - b.y));
    for (const t of sorted) {
        const bx = Math.min(t.x, tankRight) - t.w, by = t.y - t.h / 2;
        const box = [bx, by, bx + t.w, by + t.h];
        if (placed.some(q => box[0] < q[2] && box[2] > q[0]
                          && box[1] < q[3] && box[3] > q[1])) continue;
        placed.push(box);
        out.push(Object.assign({ bx: bx + padX, by, w: t.w, h: t.h }, t));
    }
    return out;
}

/**
 * 圖例的起點離波長括號夠遠嗎？——括號最長到 `WI_LAM_X0 + λ_max`。
 *
 * 這是「A 不該撞到 B」那條規矩的**前半**：那條斷言只有在兩者本來就會靠得
 * 很近的時候才有意義。λ 上限改小、或圖例往左搬，這條就會變紅——它是一條
 * 真的會叫的斷言，不是安慰劑（陷阱二十）。
 */
function wiLegendFits(lamMaxCm, legendM, gapM) {
    return legendM - (WI_LAM_X0 + lamMaxCm / 100) >= gapM;
}

initWaveInterference();

// 匯出這一頁的常數，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    WI_X0, WI_X1, WI_M, WI_U, WI_Y0, WI_Y1, WI_MID_Y, WI_HALF_M,
    WI_SRC_M, WI_TIP_R, WI_DEEP_M, WI_LAM_Y, WI_LAM_X0, WI_LEG_M,
    WI_LAM_MIN, WI_LAM_MAX, WI_LAM_DEF,
    WI_D_MIN, WI_D_MAX, WI_D_DEF,
    WI_BRIGHT_COL, WI_DARK_COL,
    // 色階只是別名。匯出它是為了讓驗證器能用 `===` 問一句
    // 「這就是 wave-scene.js 那一張嗎」——比對數值的話，抄一份也過。
    WI_RAMP,
    wiOrders, wiLineCount, wiOrderLabel, wiModel, wiCurves,
    WI_LEG_ITEMS, WI_MUTE_COL,
    wiPickTags, wiLegendFits, wiLegendRow,
};
