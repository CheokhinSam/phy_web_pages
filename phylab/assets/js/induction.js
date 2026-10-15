/**
 * 🔄 電磁感應與楞次定律
 *
 * 一條磁鐵來回推過一個線圈。畫面上有三件事要同時看得見：
 *
 *   1. **磁通量 Φ 在變**——圖上那條藍線（每幀真的用 MagneticKit 積分出來）
 *   2. **感應電動勢 ε = −N dΦ/dt**——紅線。ε 最大的地方正好是 Φ 穿過零的地方，
 *      因為「變化最快」和「量最大」是兩件事
 *   3. **楞次定律**——線圈的左端會變成什麼極，看 ε 的正負。磁鐵靠近時它推斥，
 *      離開時它吸引。線圈上下緣那兩排 ⊙／⊗ 就是感應電流的方向
 *
 * ==========================================================================
 * ⚠️ 這一頁是磁學裡**唯一直接呼叫 MagneticKit 磁通函式**的頁面
 * ==========================================================================
 * 場源一定要帶 `u`（1 世界單位等於幾公尺）。忘了填的話磁力線的形狀完全
 * 正確、卡片上的 mV 和 V 卻整組錯掉——圖對，數字錯，肉眼檢查抓不到。
 * verify-magnetism ⑩（數值）與 ⑪（頁面層）各有一條在盯。
 *
 * ⚠️ **匝數 N 只能乘一次。** kit 有兩支很像的函式：
 *      fluxThroughCoil(...)     單圈的 Φ，單位 Wb
 *      coilFlux(...)            ＝ N × Φ（磁通連鎖）
 *    而 inducedEmf(fluxAt, t, N) 自己會再乘一次 N。所以
 *      inducedEmf(coilFlux-based, t, N)  →  N²  ← **錯**
 *      inducedEmf(fluxThroughCoil-based, t, N)  →  正確
 *    這一頁用下面這一個，`fluxAt()` 只回傳**單圈**的磁通。
 *    verify-magnetism ⑤b 有一條數值斷言在盯這件事（ε 對 N 必須**線性**；
 *    餵 coilFlux 進去會變成 N 倍）——沒有用靜態掃描，因為這一頁的磁通函式
 *    是 `x => fluxAt(x, panel)`，字面上根本看不到 `coilFlux` 三個字。
 */

// ==========================================================================
// 邏輯世界（世界單位；1 世界單位 = 0.5 mm，見 U）
// ==========================================================================
const WORLD_W = 900;
const WORLD_H = 900;
const TAU = Math.PI * 2;

const U = 5e-4;                     // 一個座標單位等於幾公尺 → 1 單位 = 0.5 mm

const COIL_CX = 520, COIL_CY = 286; // 線圈的圓心
const COIL_R = 112;                 // 線圈半徑 → 5.6 cm
// 畫出來的圈數。**和滑桿的 N 無關**——N = 400 的線圈不會畫成 400 個橢圓，
// 那只是一團橘色。這裡固定畫 7 圈，讀者看的是「這是一顆線圈」。
const COIL_DRAW_TURNS = 7;

const MAG_LEN = 190, MAG_H = 34;    // 磁鐵 9.5 cm 長
// 線圈電阻（Ω）。刻意**不用 1.0**：R = 1 會讓「感應電動勢 ε」和「感應電流 I」
// 兩張卡片永遠顯示同一個數字，看起來像壞掉，也讓學生以為這兩個量是同一個東西。
const COIL_RES = 2.0;

const T_END = 6;                    // 圖表的橫軸（秒）
// ⚠️ `x` 不可以小於 ~70。drawGraph 把 y 軸標題畫在「繪圖區左緣 **再往左 40
//    個畫布像素**」（lab-scene.js:223），那是像素不是世界單位。畫布越寬、
//    縮放越大，世界座標的 40 就越不足抵掉那 40 像素——x = 34 時標題整條被
//    裁到畫布外，**畫面上只是少了一行字，不會有任何錯誤**。
const GRAPH = { x: 70, y: 546, w: 426, h: 214 };
const READ = { x: 528, y: 520, w: 352, h: 262 };

const C_MAGNET_N = [239, 68, 68];
const C_MAGNET_S = [37, 99, 235];
const C_FLUX = [37, 99, 235];       // Φ：藍，和 S 極同色系
const C_EMF = [220, 38, 38];        // ε：紅

const fmt = (v, d) => (Math.abs(v) < 1e-30 ? 0 : v).toFixed(d == null ? 2 : d);

// ==========================================================================
// 物理
// ==========================================================================
// ⚠️ **N 極不可以掃到線圈的平面附近。**
//
//    這一頁的磁鐵是**兩個磁極**的模型（見 magnetic-kit 的 magnetPoles），
//    每個極的場是 1/r²。極點一旦逼到線圈平面的附近，Φ 在那一小段時間裡
//    變化得極快——**Φ 本身還是連續的**（實測：磁鐵位置差 0.1 個世界單位，
//    Φ 平滑地走過去，沒有跳格），但 dΦ/dt 會衝到其餘地方的 **50 倍**。
//
//    而這一頁的圖是拿 ε 除以**自己的峰值**去畫的。有一個 50 倍的尖峰，
//    整條紅線就被壓成一條貼在零線上的直線——可是「ε 是 Φ 的斜率」正是
//    這一頁唯一的重點，它需要紅線和藍線**看得出來對應**。尖峰一出現，
//    這個對應就從畫面上消失了。
//    （實測：正常 1.2～1.6 倍正弦尺度，掃到平面附近是 40～66 倍；
//      verify-magnetism ⑤b 有一條在盯這個比值。）
//
//    所以 N 極最多走到線圈前面一點點就退回來——這也是課本那個示範真正的
//    樣子：推近、拉遠，而不是穿過去。
const MAG_GAP = 45;                 // N 極停在線圈前方多遠處（2.25 cm）

/** N 極最靠近時，磁鐵中心的位置。 */
function magnetNear(panel) { return COIL_CX - MAG_LEN / 2 - MAG_GAP; }

// 位置從最遠處 (near − amp) 走到 near 再退回。(1 + cos)/2 讓它在兩端慢、
// 中間快——「手推過去再拉回來」的樣子，而且端點剛好速度 0，ε 在那裡
// 自然歸零，不必另外處理。
function magnetX(t, panel) {
    return magnetNear(panel)
         - panel.amp * (1 + Math.cos(TAU * panel.freq * t)) / 2;
}

/** 當下的場源清單。**u 一定要帶**，見檔頭。 */
function sourcesAt(t, panel) {
    return [{ kind: 'magnet', x: magnetX(t, panel), y: COIL_CY,
              angle: Math.PI,           // 轉 180° → N 極在右端，帶頭面對線圈
              p: panel.strength, len: MAG_LEN, u: U }];
}

/** 穿過線圈的磁通 Φ(t)，**單圈**（Wb）。線圈的軸沿 +x。 */
function fluxAt(t, panel) {
    return MagneticKit.fluxThroughCoil(sourcesAt(t, panel),
                                       COIL_CX, COIL_CY, 1, 0, COIL_R);
}

/** ε = −N dΦ/dt。N 由 inducedEmf 自己乘——所以上面那一支只能回傳單圈的 Φ。 */
function emfAt(t, panel) {
    return MagneticKit.inducedEmf(x => fluxAt(x, panel), t, panel.turns, 0.004);
}

/**
 * 磁鐵的速度（世界單位／秒）。直接對 magnetX 解析微分，不用數值差分——
 * 這條式子等一下要拿來判斷「靠近中／離開中」，差分在端點附近會有假訊號。
 *
 *   x(t) = near − A·(1 + cos ωt)/2   →   dx/dt = A·ω·sin(ωt)/2
 */
function magnetV(t, panel) {
    return panel.amp * TAU * panel.freq * Math.sin(TAU * panel.freq * t) / 2;
}

/**
 * 線圈兩端的極性。**這條推導就是楞次定律本身**：
 *
 *   感應電流讓線圈產生自己的磁通，方向由 ε 的正負決定——
 *   ε > 0 定義成「感應電流繞出 **+x̂** 的磁通」（x̂ 是線圈的軸方向）。
 *   磁矩 m = I·A·n̂ 由 S 指向 N，所以 n̂ = +x̂ 時 N 極在**右**端。
 *
 *   磁鐵靠近（N 極朝線圈）→ Φ 變大 → ε < 0 → n̂ = −x̂ → N 極在**左**端
 *   → 線圈的左端和靠近的磁鐵同極 → **推斥**。這正是楞次定律。
 *
 * @returns {{left:'N'|'S', right:'N'|'S', emf:number}}
 */
function polarity(emf) {
    const nHat = emf > 0 ? 1 : -1;      // 感應磁通的方向（±x̂）
    return {
        nHat,
        left: nHat > 0 ? 'S' : 'N',     // n̂ 指向 +x → N 在右端、S 在左端
        right: nHat > 0 ? 'N' : 'S',
    };
}

// ==========================================================================
// 快取：圖上的曲線只跟滑桿有關，和時間無關
// ==========================================================================
// Φ(t) 與 ε(t) 是**參數的函式**，不是歷史紀錄——所以整條曲線可以在滑桿
// 一改變的當下重算一次，之後每一幀都只是把標記點沿著它移動。比起累積歷史，
// 這樣拉滑桿時圖會立刻跟上（馬達那一頁要的是相反的：它的曲線是「啟動過程」，
// 只能在真實時間裡長出來）。
// 120 點 ÷ 6 秒 = 0.05 s 一格。頻率拉到最大 0.8 Hz（週期 1.25 s）時
// 一個週期還有 25 點，峰值不會被削掉——尖峰被削掉的話「ε 是 Φ 的斜率」
// 這句話就沒有畫面可以佐證了。
const CURVE_N = 120;                // 圖上取幾個點（每一個都真的算一次 Φ）
let curveKey = '', curve = null;

function buildCurve(panel) {
    // 連續兩個週期多一點，橫軸固定不動，拉滑桿時曲線不會橫向伸縮
    const phi = [], emf = [];
    let pMax = 1e-30, eMax = 1e-30;
    for (let i = 0; i <= CURVE_N; i++) {
        const t = T_END * i / CURVE_N;
        const fp = fluxAt(t, panel), fe = emfAt(t, panel);
        phi.push({ x: t, y: fp });
        emf.push({ x: t, y: fe });
        pMax = Math.max(pMax, Math.abs(fp));
        eMax = Math.max(eMax, Math.abs(fe));
    }
    return { phi, emf, pMax, eMax };
}

function curveFor(panel) {
    const key = panel.strength + '|' + panel.turns + '|' + panel.freq + '|' + panel.amp;
    if (key !== curveKey) { curve = buildCurve(panel); curveKey = key; }
    return curve;
}

// ==========================================================================
// 畫面
// ==========================================================================

/** 磁鐵：交給 MagneticScene（N 極在 angle 指定的那一端，和 physics 一致）。 */
function drawMagnet(p, view, panel, mx) {
    const s = { kind: 'magnet', x: mx, y: COIL_CY, angle: Math.PI,
                p: panel.strength, len: MAG_LEN, u: U };
    MagneticScene.drawBarMagnet(p, view, s, { h: MAG_H });

    // 速度箭頭：靠近中往右、離開中往左。**長度隨速率改變**——固定長度的話
    // 端點附近（速度趨近 0）也畫出一根一樣長的箭頭，那正是「ε = 0」的那一格，
    // 畫面卻在說「動得很快」。
    const v = magnetV(simT, panel);
    const vPeak = panel.amp * TAU * panel.freq / 2;
    const sp = Math.abs(v) / vPeak;
    if (sp > 0.02) {
        const dir = v > 0 ? 1 : -1;
        MagneticScene.arrow(p, view, mx, COIL_CY - MAG_H / 2 - 30,
                            dir * (38 + 82 * sp), 0,
                            MagneticScene.C_VEL, { w: 3, head: 11 });
        MagneticScene.worldBadge(p, view, mx, COIL_CY - MAG_H / 2 - 58,
                                 dir > 0 ? '磁鐵靠近中' : '磁鐵離開中',
                                 { size: 13, col: MagneticScene.C_VEL });
    }
}

/**
 * 線圈：側面圖，外加兩排 ⊙／⊗。
 *
 * ⚠️ **⊙ 畫在線圈的「上緣」、⊗ 在「下緣」**，不是隨便挑的。線圈的軸沿著
 *    x̂（躺在畫面內），電流繞著軸轉，所以在線圈最高點的那一段導線是在
 *    「穿出／穿入畫面」，而不是在畫面內跑。側面圖的橢圓頂點正好就是那個
 *    最高點——課本畫螺線管側面圖時，兩排 ⊙ ／ ⊗ 就是壓在橢圓的上下緣。
 *
 *    方向由 n̂ 決定：n̂ = +x̂（ε > 0）時，最高點的電流朝 **+z＝穿出畫面**。
 *    （推導：在最高點 r = (0, R, 0)、dl = (0,0,dz)，r × dl = (R·dz, 0, 0)，
 *      要讓它 ∝ +x̂ 就得 dz > 0。）
 */
function drawCoilWithCurrent(p, view, emf, noCur) {
    MagneticScene.drawCoil(p, view, COIL_CX, COIL_CY, 1, 0, COIL_R, {
        turns: COIL_DRAW_TURNS,
        span: 30,                       // 畫扁一點，和 flux 的平面線圈模型一致
        w: 3,
        leads: false,
    });

    // ⊙／⊗ 各 5 顆，沿著線圈的上下緣分佈。
    //
    // ⚠️ 畫在 `COIL_R + 22`（線圈**外面**一點），不是正好壓在緣上：
    //    壓在緣上的話標記住在線圈那疊橘色筆畫裡面，同色疊同色，
    //    半徑 8 的 ⊙ 和 ⊗ 在螢幕上長得一模一樣——**兩個極端都看不出來**。
    //    挪出來 22 單位（1.1 cm）仍然是「上緣那一段導線」的意思，
    //    但底下是白的，⊙ 和 ⊗ 就分得出來了。
    if (noCur) return;                  // 沒有感應電流，就沒有 ⊙ 也沒有 ⊗
    const out = emf > 0;
    const dy = COIL_R + 22;
    for (let i = 0; i < 5; i++) {
        const x = COIL_CX - 28 + 14 * i;
        MagneticScene.drawPageDir(p, view, x, COIL_CY - dy, 11, out ? 1 : -1,
                                  MagneticScene.C_COIL);
        MagneticScene.drawPageDir(p, view, x, COIL_CY + dy, 11, out ? -1 : 1,
                                  MagneticScene.C_COIL);
    }
}

/**
 * 線圈兩端的極性標籤。這是這一頁的答案，所以畫大一點。
 *
 * ⚠️ 位置往上挪到 `COIL_CY − 142`：磁鐵最靠近的時候幾乎貼在線圈上
 *    （mx 最多走到 COIL_CX − MAG_LEN/2 − MAG_GAP，磁鐵長 190、縱向是
 *     [COIL_CY−17, COIL_CY+17] 那一條帶狀）。放在軸線上的標籤會在那一刻
 *    被磁鐵蓋掉——而那一刻正是「推斥最強」、最該看清楚的時候。
 *
 * ⚠️ 也不要放太開。原本擺在 `COIL_CX ± 112`，而線圈畫出來只有 ±30 寬
 *    （span: 30），標籤於是飄在兩側半空中，看不出在標「這一顆線圈的兩端」。
 *    改成 ±64、貼著上緣，再各拉一條引線指到線圈的兩端。
 */
function drawCoilPoles(p, view, S) {
    const pol = S.pol;
    // dy = −170 而不是 −142：−142 會讓標籤和線圈上緣那排 ⊙ 撞在同一個高度
    // （標籤 [131,157]、⊙ [141,163]），兩者雖然左右錯開，貼在一起讀起來
    // 還是像一團。拉開到 −170 之後中間留得下引線。
    const dx = 64, dy = -170;
    const colL = S.noCur ? MagneticScene.C_DIM
                         : (pol.left === 'N' ? C_MAGNET_N : C_MAGNET_S);
    const colR = S.noCur ? MagneticScene.C_DIM
                         : (pol.right === 'N' ? C_MAGNET_N : C_MAGNET_S);
    const txtL = S.noCur ? '左端 —' : '左端 ' + pol.left;
    const txtR = S.noCur ? '右端 —' : '右端 ' + pol.right;

    // 引線：從標籤下緣斜指到線圈上緣的兩端
    MagneticScene.dashed(p, view, COIL_CX - dx, COIL_CY + dy + 26,
                         COIL_CX - 26, COIL_CY - COIL_R + 12,
                         MagneticScene.C_DIM, { w: 1.5 });
    MagneticScene.dashed(p, view, COIL_CX + dx, COIL_CY + dy + 26,
                         COIL_CX + 26, COIL_CY - COIL_R + 12,
                         MagneticScene.C_DIM, { w: 1.5 });

    MagneticScene.worldBadge(p, view, COIL_CX - dx, COIL_CY + dy, txtL,
                             { size: 18, col: colL });
    MagneticScene.worldBadge(p, view, COIL_CX + dx, COIL_CY + dy, txtR,
                             { size: 18, col: colR });
}

/** 右下角的讀數板：四列「現在發生什麼事」。 */
function drawReadout(p, view, panel, S) {
    p.noStroke();
    p.fill(255);
    p.rect(view.toScreenX(READ.x), view.toScreenY(READ.y),
           view.len(READ.w), view.len(READ.h), view.len(14));

    const rows = [
        { t: '磁通量 Φ', v: fmt(S.phi * 1000, 3), u: 'mWb', col: C_FLUX },
        { t: '感應電動勢 ε', v: fmt(S.emf, 3), u: 'V', col: C_EMF },
        { t: '感應電流 I', v: fmt(S.cur, 3), u: 'A', col: C_EMF },
        { t: '線圈左端', v: S.pol.left + ' 極', u: '', col: S.pol.left === 'N' ? C_MAGNET_N : C_MAGNET_S },
    ];
    rows.forEach((r, i) => {
        const y = READ.y + 46 + i * 46;
        p.fill(100, 116, 139);
        p.textAlign(p.LEFT, p.CENTER);
        p.textStyle(p.NORMAL);
        p.textSize(view.len(14, 9));
        p.text(r.t, view.toScreenX(READ.x + 20), view.toScreenY(y));

        p.fill(r.col[0], r.col[1], r.col[2]);
        p.textAlign(p.RIGHT, p.CENTER);
        p.textStyle(p.BOLD);
        p.textSize(view.len(22, 13));
        p.text(r.v, view.toScreenX(READ.x + READ.w - 62), view.toScreenY(y));
        p.textSize(view.len(13, 8));
        p.textAlign(p.LEFT, p.CENTER);
        p.text(' ' + r.u, view.toScreenX(READ.x + READ.w - 58), view.toScreenY(y));
    });

    // 結論：現在是推斥還是吸引。這一頁要學生記住的就是這一句。
    MagneticScene.worldBadge(p, view, READ.x + READ.w / 2, READ.y + READ.h - 34,
                             S.verdict, { size: 16, col: S.verdictCol });
}

// ⚠️ 名字**不可以**叫 `draw`。這是 classic script 的頂層宣告，叫 `draw` 就會
//    變成 `window.draw`；而 p5 的 `redraw()` 內部是
//    `r = this._isGlobal ? window : this; r.draw()`——一旦它走到 window 那一支，
//    就會呼叫到這一支，而且**一個參數都不傳**（`S` 是 undefined，整個炸掉）。
//    實際症狀：headless 下 rAF 只發火一次，所以只有一則 TypeError；
//    真實瀏覽器每一幀都中。改名之後 `window.draw` 不存在，p5 就只認得
//    lab-scene 包好的那一個。`drawMagnet` 這些相反地很安全——它們不是 p5 的 API 名。
function drawScene(p, view, t, panel, sol, S) {
    simT = t;

    // 磁力線先畫（在場源底下）。密度刻意低——這一頁的主角是線圈和圖表，
    // 場線只是讓「磁鐵帶著場一起動」看得見。
    MagneticScene.drawFieldLines(p, view, S.sources, {
        perPole: 5, step: 8, w: 1.6, arrowEvery: 120,
    });

    drawMagnet(p, view, panel, S.mx);
    MagneticScene.drawAxisLine(p, view, COIL_CX, COIL_CY, 1, 0, 250,
                               { col: MagneticScene.C_AXIS });
    drawCoilWithCurrent(p, view, S.emf, S.noCur);
    drawCoilPoles(p, view, S);

    // 圖：Φ 與 ε 各自除以自己的峰值。看的是**形狀**——ε 最大的地方正好是
    // Φ 穿過零的地方，因為 ε 是 Φ 的斜率。
    const cv = curveFor(panel);
    MagneticScene.drawGraph(p, view, {
        x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
        xMin: 0, xMax: T_END, yMin: -1.15, yMax: 1.15,
        xLabel: '時間 t', xUnit: 's',
        yLabel: 'Φ 與 ε（各自除以峰值）', yUnit: '',
        title: 'ε 是 Φ 的斜率：Φ 最大時 ε 為零',
        xTicks: 6, yTicks: 4,
        lines: [{ from: { x: 0, y: 0 }, to: { x: T_END, y: 0 },
                  col: [148, 163, 184], dash: true }],
        series: [
            { pts: cv.phi.map(q => ({ x: q.x, y: q.y / cv.pMax })),
              col: C_FLUX, join: true, r: 2.2 },
            { pts: cv.emf.map(q => ({ x: q.x, y: q.y / cv.eMax })),
              col: C_EMF, join: true, r: 2.2 },
        ],
        marker: { x: t, y: S.emf / cv.eMax, col: C_EMF },
        plate: true,
    });
    // 圖例。放在標題的右邊——標題置中在 GRAPH.x + w/2，右端大約到 410。
    MagneticScene.worldBadge(p, view, GRAPH.x + GRAPH.w - 52, GRAPH.y - 30,
                             'Φ', { size: 14, col: C_FLUX });
    MagneticScene.worldBadge(p, view, GRAPH.x + GRAPH.w - 22, GRAPH.y - 30,
                             'ε', { size: 14, col: C_EMF });

    drawReadout(p, view, panel, S);
}

// ==========================================================================
// 介面
// ==========================================================================
let simT = 0;                       // 這一幀的模擬時間（draw 之外的函式要用）
let modelKey = '', modelState = null;

MagneticScene.run({
    formula: '\\begin{aligned}'
           + '&\\Phi = \\int \\vec{B} \\cdot d\\vec{A} \\\\'
           + '&\\varepsilon = -N \\dfrac{d\\Phi}{dt}'
           + '\\end{aligned}',
    formulaFallback: 'Φ = ∫B·dA　　ε = −N dΦ/dt',

    controls: {
        sliders: [
            { key: 'strength', label: '磁鐵強度',   min: 200, max: 2000, step: 50,  def: 1200, unit: '',  dec: 0 },
            { key: 'turns',    label: '線圈匝數 N', min: 50,  max: 400,  step: 10,  def: 300, unit: '匝', dec: 0 },
            { key: 'freq',     label: '往復頻率',   min: 0.15, max: 0.8, step: 0.05, def: 0.5, unit: 'Hz', dec: 2 },
            { key: 'amp',      label: '來回距離',   min: 120, max: 260,  step: 10,  def: 200, unit: '',  dec: 0 },
        ],
    },

    cards: [
        { label: '磁通量 Φ', id: 'cardPhi', unit: 'mWb', highlight: true },
        { label: '感應電動勢 ε', id: 'cardEmf', unit: 'V', highlight: true },
        { label: '感應電流 I', id: 'cardI', unit: 'A' },
        { label: '磁鐵速率', id: 'cardV', unit: 'cm/s' },
        { label: 'N 極到線圈', id: 'cardGap', unit: 'cm' },
        { label: '線圈左端', id: 'cardLeft', unit: '' },
        { label: '線圈右端', id: 'cardRight', unit: '' },
        { label: '感應功率 ε²/R', id: 'cardP', unit: 'W' },
        { label: '線圈匝數 N', id: 'cardN', unit: '匝' },
        { label: '線圈電阻 R', id: 'cardR', unit: 'Ω' },
    ],

    model(t, panel) {
        // 一個狀態要算三支 Φ 的積分（本身 + 中心差分的兩邊），每幀重算是
        // 白費的。`lab-scene` 一幀最少叫一次 `model`、面板一動又再叫一次，
        // 所以照 motor.js 的做法把上一次的結果留著——但 key 要**同時**含
        // 時間與滑桿：暫停時 simTime 不動，只看 t 的話拉滑桿會拿到舊狀態。
        const key = t.toFixed(6) + '|' + panel.strength + '|' + panel.turns
                  + '|' + panel.freq + '|' + panel.amp;
        if (key === modelKey && modelState) return modelState;

        const sources = sourcesAt(t, panel);
        const diag = MagneticKit.check(sources);
        const mx = magnetX(t, panel);
        if (!diag.ok) {
            modelKey = key;
            modelState = { bad: diag.errors[0], sources, mx };
            return modelState;
        }

        const phi = MagneticKit.fluxThroughCoil(sources, COIL_CX, COIL_CY, 1, 0, COIL_R);
        const emf = MagneticKit.inducedEmf(x => fluxAt(x, panel), t, panel.turns, 0.004);
        const pol = polarity(emf);
        const v = magnetV(t, panel);

        // 端點附近速度趨近 0，ε 也趨近 0——這時候「靠近中／離開中」是雜訊
        // （v 的正負號會亂跳），但那個瞬間本身正是這一頁最想講的一格：
        // **Φ 到極值 → 斜率 0 → ε = 0**。所以不要讓它顯示成推斥或吸引，
        // 給它自己的說法。死區取峰速的 2%，端點附近約 ±0.06 s 寬。
        const vPeak = panel.amp * TAU * panel.freq / 2;
        const atPeak = Math.abs(v) < 0.02 * vPeak;

        modelKey = key;
        modelState = {
            sources, mx, phi, emf, pol,
            approaching: v > 0,
            atPeak,
            // 端點上 ε = 0、I = 0，也就是**根本沒有感應電流**。
            // 這時候還照 ε 的正負號畫出「左端 N 極」是假的——沒有電流就沒有
            // 極性，`polarity(0)` 回傳的 N 只是 `emf > 0` 為 false 的副產品。
            // 畫面上留著它，讀者會以為「有極性但沒有電流」，那是錯的。
            noCur: atPeak,
            cur: emf / COIL_RES,
            power: emf * emf / COIL_RES,
            speed: Math.abs(v) * U,                       // m/s
            // N 極面到線圈平面的距離——這才是決定磁通量大小的那個距離
            // （不是「磁鐵中心到線圈」，那會把磁鐵自己的半長算進去）。
            gap: (COIL_CX - (mx + MAG_LEN / 2)) * U,
            verdict: atPeak
                ? 'Φ 到極值：斜率為 0，所以 ε = 0'
                : (pol.left === 'N' ? '同極相斥：線圈擋住靠近的磁鐵'
                                    : '異極相吸：線圈拉住離開的磁鐵'),
            verdictCol: atPeak
                ? [100, 116, 139] : (pol.left === 'N' ? C_MAGNET_N : C_MAGNET_S),
        };
        return modelState;
    },

    values(t, panel, sol, S) {
        if (S.bad) return {};
        return {
            cardPhi: fmt(S.phi * 1000, 3),
            cardEmf: fmt(S.emf, 3),
            cardI: fmt(S.cur, 3),
            cardV: fmt(S.speed * 100, 2),
            cardGap: fmt(S.gap * 100, 2),
            cardLeft: S.noCur ? '—' : S.pol.left + ' 極',
            cardRight: S.noCur ? '—' : S.pol.right + ' 極',
            cardP: fmt(S.power, 4),
            cardN: fmt(panel.turns, 0),
            cardR: fmt(COIL_RES, 1),
        };
    },

    // ⚠️ 第三個參數是 `sol`，不是 `state`。磁學這幾頁沒有載入 circuit-kit，
    //    lab-scene 的預設 solver 是恆等函式，所以 `sol === state`。
    titleText(t, panel, S) {
        if (S.bad) return '⚠ ' + S.bad;
        return (S.atPeak ? '磁鐵在端點'
                         : (S.approaching ? '磁鐵靠近中' : '磁鐵離開中'))
             + '　Φ = ' + fmt(S.phi * 1000, 3) + ' mWb'
             + '　ε = ' + fmt(S.emf, 3) + ' V'
             + '　I = ' + fmt(S.cur, 3) + ' A'
             + '　線圈左端 = ' + (S.noCur ? '—（無感應電流）' : S.pol.left + ' 極');
    },

    draw: drawScene,
});

if (typeof window !== 'undefined') {
    window.__page = {
        U, COIL_CX, COIL_CY, COIL_R, MAG_LEN, COIL_RES, T_END,
        magnetX, magnetV, sourcesAt, fluxAt, emfAt, polarity, buildCurve,
        getSimT() { return simT; },
    };
}
