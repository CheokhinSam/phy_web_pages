/**
 * 🎸 弦的張力與節點數 — 頻率被外面的振動器鎖住時，弦拉得越緊，弦上的波反而越少
 *
 * 這一頁的因果方向和 08 駐波與諧音**剛好相反**，那是刻意的：
 *   08 是「先選模態 n，再看它對應的頻率」——弦自己愛用哪個頻率就用哪個。
 *   這一頁是「頻率被外面的振動器鎖在 6 Hz」，弦只能配合；能調的只有張力。
 *   於是張力一拉緊，v = √(F/μ) 變快、λ = v/f 變長，弦上塞得下的半波數
 *   反而**變少**——這和「弦拉得越緊、抖得越快」的直覺正好相反。
 *
 * 為什麼是「塞得下幾個」而不是直接算節點數：
 *   張力連續變化時，弦上容納得下的半波數 q = 2l/λ 是一個**連續**的數
 *   （例如 10.7）。可是兩端固定時，只有整數個半波才留得住——第一個半波
 *   從左端出發、第二個接上去……最後一個一定要剛好停在右端的釘子上。
 *   所以弦只會用**最接近的那個整數模態**回應，其餘的張力它寧可不太動。
 *   這就是「為什麼張力不是連續的」：真正的共振張力只有那幾個。
 *
 * ⚠️ 這一頁**同時**畫兩個張力：你調的張力，和這個圖形需要的共振張力。
 *    那不是重複，而是這一頁的重點（要調準才看得到）。卡片上兩張都有標籤，
 *    驗證器 ㉕ 會盯著「在共振張力上時，兩者必須逐位相等」。
 *
 * 場景、波的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的物理（公尺、公斤、秒）
// ==========================================================================
const CLA_L = 2.0;              // 弦長（公尺）
const CLA_F = 6.0;              // 驅動頻率（Hz）——固定，這是這一頁的前提
const CLA_SLOW = 6;             // 畫面慢動作倍率（6 Hz 直接播會糊成一團）
const CLA_N_MIN = 2, CLA_N_MAX = 16;   // 弦上留得住的半波數範圍

// 滑桿範圍。張力那三支要跟這些常數走，驗證器 ㉕(g) 會把原始碼和匯出值對起來。
const CLA_T_MIN = 0.020, CLA_T_MAX = 0.600, CLA_T_DEF = 0.040;     // 張力 F（N）
const CLA_MU_MIN = 0.006, CLA_MU_MAX = 0.016, CLA_MU_DEF = 0.010;  // 線密度 μ（kg/m）
const CLA_A_MIN = 1, CLA_A_MAX = 5, CLA_A_DEF = 3;                 // 腹點振幅（cm）

// ==========================================================================
// 版面（世界單位；世界是 1000 × 900，由 wave-scene.js 宣告）
// ==========================================================================
/**
 * 弦上 1 公尺 = 幾個「繩子公尺」。
 *
 * ⚠️ 這一頁的弦是 2 公尺，而 wave-scene.js 的繩子固定是 0..ROPE_M（8 公尺）
 *    橫跨整個畫面。所以畫圖時要把**物理的公尺**換成**繩子的公尺**，
 *    兩者相差 4 倍（CLA_XS）。所有座標最後都要經過 rx()，包括節點圓點、
 *    括號的兩端與取樣函式；漏掉任何一個的症狀都是「數字對、位置錯」。
 *    物理量本身（λ、v、l）從頭到尾都是公尺，只有畫的那一瞬間才換。
 */
const CLA_XS = WaveScene.ROPE_M / CLA_L;   // = 4

const CLA_STRING_Y = 320;       // 弦的平衡線
const CLA_AMP_C = 13;           // 垂直放大：世界單位 / 公分
const CLA_BRACKET_Y = 232;      // λ/2 括號（畫在包絡線上方）
const CLA_CHAIN_Y = 500;        // 換算鏈那一排的中心
const CLA_CHAIN_H = 62;         // 換算鏈的框高
const CLA_CHAIN_X0 = 70, CLA_CHAIN_X1 = 950;   // 與繩子同寬
const CLA_CHAIN_GAP = 24;       // 換算鏈框與框之間留給箭頭的寬度
const CLA_LADDER_CAP_Y = 584;   // 「共振階梯」那一行小字（TOP）
const CLA_RUNG_LABEL_Y = 634;   // 每一階的節點數（BOTTOM）
const CLA_LADDER_Y = 664;       // 階梯的軸線
const CLA_RUNG_TOP = 650, CLA_RUNG_BOT = 680;  // 刻度線
const CLA_AXIS_LABEL_Y = 690;   // 軸兩端的張力值（TOP）
const CLA_MARK_Y = 736;         // 「你調的張力」游標的數字牌（軸的標籤在它上面，兩者不相交）
const CLA_LEGEND_Y = 776;       // 最下面那行圖例

const CLA_NODE_R = 8;           // 節點圓點的半徑（世界單位）
const CLA_ANTI_R = 9;           // 腹點圓圈的半徑

/**
 * 畫面上每一個文字元素的字級與像素下限（一律走 `view.len(size, min)`）。
 *
 * ⚠️ **繪製碼與驗證器讀同一份。** 兩邊各寫一份的話，把某一行的字級改大
 *    一點（例如驗證器裡寫 13、繪製碼改成 18）不會有任何症狀：那一行字會
 *    靜靜地壓到隔壁，而所有數值斷言照樣全綠。驗證器 ㉕(f) 的每一個外框
 *    都是從這張表算出來的，改這裡就等於同時改兩邊。
 */
const CLA_TYPE = {
    cap:     { size: 13, min: 8 },    // 換算鏈的框標、「共振階梯」那一行
    value:   { size: 18, min: 10 },   // 換算鏈的數值
    rung:    { size: 13, min: 8 },    // 階的數字（不是現在這一階）
    rungOn:  { size: 16, min: 9 },    // 階的數字（現在這一階，放大）
    axis:    { size: 13, min: 8 },    // 軸兩端的張力值
    legend:  { size: 14, min: 8 },    // 最下面那行圖例
    bracket: { size: 15, min: 9 },    // λ/2 括號的標籤
    badge:   { size: 15, min: 9 },    // 游標的數字牌
};

/**
 * 這一頁的物理。卡片、畫面、標題列與驗證器全部讀這一份，不另外算。
 *
 * 回傳的 `q` 是**連續**的半波數（10.7 這種），`n` 是弦真正留得住的整數。
 * 兩個都要回傳：`q` 是「容納得下幾個」，`n` 是「真的留下幾個」，
 * 這一頁要教的就是這兩者的差別。
 */
function claModel(panel) {
    const F = panel.T, mu = panel.mu;
    const vFree = Math.sqrt(F / mu);            // v = √(F/μ)
    const lamFree = vFree / CLA_F;              // λ = v/f
    const q = 2 * CLA_L / lamFree;              // 弦上容納得下的半波數（連續）
    const n = Math.min(CLA_N_MAX, Math.max(CLA_N_MIN, Math.round(q)));
    const lam = 2 * CLA_L / n;                  // 這個模態的波長：l = nλ/2
    const v = CLA_F * lam;                      // 這個模態的波速：v = fλ
    const Fres = mu * v * v;                    // 這個模態需要的張力：F = μv²
    return {
        F, mu, vFree, lamFree, q, n, N: n + 1, lam, v, Fres,
        tuned: Math.abs(q - n) <= 0.06,
    };
}

/** 第 n 個模態的共振張力（N）。F = μv²，而 v = 2lf/n。 */
function claTensionFor(n, mu) {
    return mu * Math.pow(2 * CLA_L * CLA_F / n, 2);
}

/** 弦上第 i 個節點的位置（公尺，共 n+1 個，i = 0..n）。 */
function claNodeX(i, n) { return i * CLA_L / n; }

/**
 * 張力 → 階梯軸上的位置（0..1）。
 *
 * ⚠️ **一定要用對數刻度。** 共振張力是 F = μ(2lf/n)²——和 n 的平方成反比，
 *    所以 n = 12 與 11 兩階只差 19%，而 n = 5 與 4 差了 56%。量出來的數字：
 *    在滑桿的 0.020–0.600 N 這一段，最擠的兩階（n = 16 與 15）用對數刻度
 *    相距 33 個世界單位，換成等距刻度只剩 4.7——13 階的標籤當場疊成一團，
 *    而畫面不會報錯。
 */
function claLadderPos(F) {
    const t = Math.log(F / CLA_T_MIN) / Math.log(CLA_T_MAX / CLA_T_MIN);
    return Math.min(1, Math.max(0, t));
}

function initStringTensionNodes() {

    WaveScene.run({

        // 左欄公式框在 1100px 時內寬只有 183–198px，KaTeX 的 display 模式
        // 不會自動換行——三條式子一定要一行一條（README 陷阱八）。
        formula: '\\begin{aligned} v &= \\sqrt{F/\\mu} \\\\ \\lambda &= \\frac{v}{f} \\\\ N &= \\frac{2l}{\\lambda} + 1 \\end{aligned}',
        formulaFallback: 'v = √(F/μ)　λ = v/f　N = 2l/λ + 1',

        controls: {
            sliders: [
                { key: 'T',  label: '張力 <i>F</i>',   unit: 'N',   min: CLA_T_MIN,  max: CLA_T_MAX,  step: 0.001, def: CLA_T_DEF,  dec: 3 },
                { key: 'mu', label: '線密度 <i>μ</i>', unit: 'kg/m', min: CLA_MU_MIN, max: CLA_MU_MAX, step: 0.001, def: CLA_MU_DEF, dec: 3 },
                { key: 'A',  label: '腹點振幅',        unit: 'cm',  min: CLA_A_MIN,  max: CLA_A_MAX,  step: 0.5,   def: CLA_A_DEF,  dec: 1 },
            ],
        },

        cards: [
            { label: '張力 F',    id: 'cardT',      unit: 'N',    highlight: true },
            { label: '節點數 N',  id: 'cardNodes',  unit: '個',   highlight: true },
            { label: '波腹數',    id: 'cardAnti',   unit: '個' },
            { label: '波長 Λ',    id: 'cardLambda', unit: 'm' },
            { label: '波速 V',    id: 'cardV',      unit: 'm/s' },
            { label: '共振張力',  id: 'cardRes',    unit: 'N' },
            { label: '驅動頻率',  id: 'cardF',      unit: 'Hz' },
            { label: '線密度 Μ',  id: 'cardMu',     unit: 'kg/m' },
        ],

        values(t, panel) {
            const m = claModel(panel);
            return {
                cardT:      m.F.toFixed(3),
                cardNodes:  String(m.N),
                cardAnti:   String(m.n),
                cardLambda: m.lam.toFixed(3),
                cardV:      m.v.toFixed(2),
                cardRes:    m.Fres.toFixed(3),
                cardF:      CLA_F.toFixed(2),
                cardMu:     m.mu.toFixed(3),
            };
        },

        titleText(t, panel) {
            const m = claModel(panel);
            const tol = m.tuned ? '正好是共振張力' : `共振張力是 ${m.Fres.toFixed(3)} N`;
            return `張力 ${m.F.toFixed(3)} N（${tol}）：弦上容納得下 ${m.q.toFixed(1)} 個半波，`
                 + `只留得住整數個 → ${m.n} 個半波（λ = ${m.lam.toFixed(3)} m、v = ${m.v.toFixed(2)} m/s）、`
                 + `${m.N} 個節點`;
        },

        draw(p, view, t, panel) {
            const m = claModel(panel);
            drawString(p, view, t, panel, m);
            drawChain(p, view, m);
            drawLadder(p, view, m);
            drawLegend(p, view, m);
        },
    });
}

/** 弦上的公尺 → 繩子公尺。畫面用的一律走這一支。 */
function claRx(xm) { return xm * CLA_XS; }

/**
 * 主圖：兩端固定的弦。
 *
 * y(x,t) = A sin(nπx/l) cos(ωt) —— 節點在 x = i·l/n（永遠不動），
 * 相鄰兩個節點之間就是一個波腹。
 */
function drawString(p, view, t, panel, m) {
    const TS = WaveScene;
    const A = panel.A;                                   // 公分
    const k = m.n * Math.PI / CLA_L;
    // 慢動作：畫面上用 1/CLA_SLOW 的角頻率。物理上的 f 仍然寫在卡片上。
    const w = 2 * Math.PI * CLA_F / CLA_SLOW;
    const yOf = (xm, tt) => A * Math.sin(k * xm) * Math.cos(w * tt);

    TS.drawBaseline(p, view, CLA_STRING_Y);
    TS.drawEndpoint(p, view, 0, CLA_STRING_Y, 'fixed');
    TS.drawEndpoint(p, view, TS.ROPE_M, CLA_STRING_Y, 'fixed');

    const pts = TS.sample((xr, tt) => yOf(xr / CLA_XS, tt),
                          0, TS.ROPE_M, t, m.lam * CLA_XS);
    TS.drawWave(p, view, pts,
        { baseY: CLA_STRING_Y, ampScale: CLA_AMP_C, color: [15, 23, 42], weight: 5 });

    // 腹點：振幅最大，畫成綠色空心圈
    p.noFill();
    p.stroke(22, 163, 74);
    p.strokeWeight(view.len(3, 1.5));
    for (let i = 0; i < m.n; i++) {
        const xm = (i + 0.5) * CLA_L / m.n;
        p.circle(TS.ropeX(view, claRx(xm)), view.toScreenY(CLA_STRING_Y), view.len(CLA_ANTI_R * 2, 6));
    }

    // 節點：永遠不動，畫成紅色實心點
    p.noStroke();
    p.fill(220, 38, 38);
    for (let i = 0; i <= m.n; i++) {
        p.circle(TS.ropeX(view, claRx(claNodeX(i, m.n))),
                 view.toScreenY(CLA_STRING_Y), view.len(CLA_NODE_R * 2, 5));
    }

    // λ/2 括號：標在**正中間**那一段（相鄰兩個節點之間）。長度與位置都走 rx()，
    // 漏掉的話括號會落在繩子上的錯誤位置——而數字仍然是對的。
    // ⚠️ 刻意挑中間而不是最左邊那一段：那塊標籤牌是**置中**在括號上的，
    //    牌寬 ~162 px 而括號在窄畫布上只有 33 px，擺在最左邊會整塊凸出畫布
    //    （1100px 時 x = −33），左邊幾個字當場被切掉。擺在中間的話牌的中心
    //    就是畫布的中心，永遠放得下。驗證器 ㉖ 會把這一頁的 draw 跑一遍檢查。
    const gi = Math.floor(m.n / 2);
    TS.wavelengthBracket(p, view, claRx(claNodeX(gi, m.n)), claRx(claNodeX(gi + 1, m.n)),
        CLA_BRACKET_Y, `相鄰節點間距 = λ/2 = ${(m.lam / 2).toFixed(3)} m`,
        { color: [220, 38, 38], above: true, size: CLA_TYPE.bracket.size });
}

/**
 * 換算鏈：節點數 → 波腹數 → 波長 → 波速 → 張力。
 *
 * 這一排就是這一頁的骨幹：從**看得見的**節點數，一路算回**要調多少張力**。
 * 五個框的寬度是量出來的（見驗證器 ㉕(f) 的保守字框），字級用 view.len()。
 */
function drawChain(p, view, m) {
    const T = CLA_TYPE;
    // ⚠️ 全部先換成**畫布像素**再畫。這一頁的常數是**世界單位**，而 p5 的
    //    p.rect/p.text 吃的是像素——少了 view.toScreenX/Y，這一排會照世界
    //    數字原樣畫在像素座標上：1600px 的畫布（scale 0.804）下整排會放大
    //    25% 並往右下偏，而**最後一格會被 view.clip() 切掉**（世界 x = 950
    //    的框畫在像素 950，畫布只有 804 寬）。畫面看起來「只是擠了點」，
    //    數字全對、errs=0，只有截圖逐格數才看得出來。
    //    驗證器 ㉖ 會把這一頁的 draw 真的跑一遍，任何一筆畫到畫布外的都會紅。
    const x0 = view.toScreenX(CLA_CHAIN_X0), x1 = view.toScreenX(CLA_CHAIN_X1);
    const yc = view.toScreenY(CLA_CHAIN_Y);
    const GAP = view.len(CLA_CHAIN_GAP);
    const y = view.toScreenY(CLA_CHAIN_Y - CLA_CHAIN_H / 2);
    const BOX_H = view.len(CLA_CHAIN_H);
    // ⚠️ 第二格把符號 n 命名出來，第三格才用得到它（λ = 2l/n）。原本第三格寫
    //    的是 λ = 2l/(N−1)，在 1100px 的畫布上（字級有 8px 下限）量出來要
    //    170 個世界單位，比框的 156.8 還寬——不換寫法的話那行字會壓在框線
    //    上，而畫面不會報錯。驗證器 ㉕(f) 量的就是這件事。
    const steps = [
        { cap: '節點數 N',           val: `${m.N}`,                  hot: [220, 38, 38] },
        { cap: '波腹數 n = N−1',     val: `${m.n}`,                  hot: null },
        { cap: '波長 λ = 2l/n',      val: `${m.lam.toFixed(3)} m`,   hot: null },
        { cap: '波速 v = fλ',        val: `${m.v.toFixed(2)} m/s`,   hot: null },
        { cap: '張力 F = μv²',       val: `${m.Fres.toFixed(3)} N`,  hot: [37, 99, 235] },
    ];

    p.textStyle(p.BOLD);
    // ⚠️ 框寬是**算出來的**，不是量出來的：五個框加四個箭頭缺口剛好排滿
    //    [X0, X1]。寫死一個數字的話，最後一個框會多凸出去或少留一塊空白，
    //    而畫面照樣能看（驗證器 ㉕(f) 在盯這條等式）。
    const BOX_W = ((x1 - x0) - GAP * (steps.length - 1)) / steps.length;
    for (let i = 0; i < steps.length; i++) {
        const x = x0 + i * (BOX_W + GAP);
        const col = steps[i].hot;

        p.noFill();
        p.stroke(col ? col[0] : 226, col ? col[1] : 232, col ? col[2] : 240);
        p.strokeWeight(view.len(col ? 2.5 : 1.5, 1));
        p.rect(x, y, BOX_W, BOX_H, view.len(8, 4));

        p.noStroke();
        p.fill(100, 116, 139);
        p.textSize(view.len(T.cap.size, T.cap.min));
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text(steps[i].cap, x + BOX_W / 2, yc - view.len(4, 2));

        p.fill(col ? col[0] : 15, col ? col[1] : 23, col ? col[2] : 42);
        p.textSize(view.len(T.value.size, T.value.min));
        p.textAlign(p.CENTER, p.TOP);
        p.text(steps[i].val, x + BOX_W / 2, yc + view.len(3, 1.5));

        // 框與框之間的箭頭
        if (i < steps.length - 1) {
            const ax = x + BOX_W, ay = yc;
            const head = view.len(9, 4);
            p.stroke(148, 163, 184);
            p.strokeWeight(view.len(2, 1));
            p.line(ax + view.len(4, 2), ay, ax + GAP - head - view.len(2, 1), ay);
            p.noStroke();
            p.fill(148, 163, 184);
            p.triangle(ax + GAP - view.len(2, 1), ay,
                       ax + GAP - head - view.len(2, 1), ay - head * 0.55,
                       ax + GAP - head - view.len(2, 1), ay + head * 0.55);
        }
    }
}

/**
 * 共振階梯：橫軸是張力（對數刻度），每一階是一個留得住的模態。
 *
 * 這一條要回答的是「為什麼張力只能停在某幾個值」——把游標夾在兩階中間時，
 * 學生看得到自己離最近的階梯還有多遠。
 */
function drawLadder(p, view, m) {
    const T = CLA_TYPE;
    // 世界 → 畫布像素，理由同 drawChain（少了這一步整條階梯會畫到畫布外）。
    const x0 = view.toScreenX(CLA_CHAIN_X0), x1 = view.toScreenX(CLA_CHAIN_X1);
    const axX = u => x0 + (x1 - x0) * u;
    const y = view.toScreenY(CLA_LADDER_Y);
    const yCap = view.toScreenY(CLA_LADDER_CAP_Y);
    const yAxis = view.toScreenY(CLA_AXIS_LABEL_Y);
    const yRungTop = view.toScreenY(CLA_RUNG_TOP), yRungBot = view.toScreenY(CLA_RUNG_BOT);
    const yRungLabel = view.toScreenY(CLA_RUNG_LABEL_Y);

    p.noStroke();
    p.fill(100, 116, 139);
    p.textSize(view.len(T.cap.size, T.cap.min));
    p.textStyle(p.BOLD);
    p.textAlign(p.LEFT, p.TOP);
    p.text('共振階梯（橫軸：張力，對數刻度）—— 每一階是一個留得住的模態',
        x0, yCap);

    // 軸線
    p.stroke(203, 213, 225);
    p.strokeWeight(view.len(2, 1));
    p.line(axX(0), y, axX(1), y);

    // 兩端的張力值
    p.noStroke();
    p.fill(148, 163, 184);
    p.textSize(view.len(T.axis.size, T.axis.min));
    p.textStyle(p.NORMAL);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`${CLA_T_MIN.toFixed(3)} N`, axX(0), yAxis);
    p.textAlign(p.RIGHT, p.TOP);
    p.text(`${CLA_T_MAX.toFixed(3)} N`, axX(1), yAxis);

    // 每一階
    for (let n = CLA_N_MAX; n >= CLA_N_MIN; n--) {
        const Fr = claTensionFor(n, m.mu);
        if (Fr < CLA_T_MIN * 0.999 || Fr > CLA_T_MAX * 1.001) continue;
        const x = axX(claLadderPos(Fr));
        const cur = (n === m.n);
        p.stroke(cur ? 37 : 203, cur ? 99 : 213, cur ? 235 : 225);
        p.strokeWeight(view.len(cur ? 4 : 2, cur ? 2 : 1));
        p.line(x, yRungTop, x, yRungBot);
        p.noStroke();
        p.fill(cur ? 37 : 100, cur ? 99 : 116, cur ? 235 : 139);
        p.textSize(cur ? view.len(T.rungOn.size, T.rungOn.min)
                       : view.len(T.rung.size, T.rung.min));
        p.textStyle(cur ? p.BOLD : p.NORMAL);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text(String(n + 1), x, yRungLabel);
    }

    // 你調的張力：三角形游標（往下指著軸線）
    const uNow = claLadderPos(m.F);
    const mx = axX(uNow);
    p.noStroke();
    p.fill(239, 68, 68);
    const h = view.len(11, 5);
    p.triangle(mx, y - view.len(3, 2), mx - h, y - view.len(3, 2) - h, mx + h, y - view.len(3, 2) - h);

    // 游標的數字牌。靠邊的時候換成左／右對齊，不然會被畫出世界外面。
    const align = uNow > 0.86 ? 'right' : uNow < 0.14 ? 'left' : 'center';
    const bx = Math.min(x1 - view.len(10, 5), Math.max(x0 + view.len(10, 5), mx));
    WaveScene.valueBadge(p, view, bx, view.toScreenY(CLA_MARK_Y), `張力 ${m.F.toFixed(3)} N`,
        { size: CLA_TYPE.badge.size, align: align,
          stroke: [239, 68, 68], fillColor: [185, 28, 28] });
}

/** 最下面那行圖例。紅點／綠圈是畫面上的東西，要說清楚各是什麼。 */
function drawLegend(p, view, m) {
    const T = CLA_TYPE;
    p.noStroke();
    p.fill(100, 116, 139);
    p.textSize(view.len(T.legend.size, T.legend.min));
    p.textStyle(p.NORMAL);
    p.textAlign(p.CENTER, p.TOP);
    // ⚠️ 這一行是**置中的單行長字串**，而字級在窄版面會踩到 8 px 的下限——
    //    整串字在世界單位裡跟著變寬。本來還有一句「兩端都釘住，所以兩端
    //    一定是節點」，在 900×700 的畫布（scale 0.349）上兩端各被切掉
    //    13.5 px（「紅」「點」各半個字）。那句話在 md 的物理知識裡有，
    //    畫面上兩端那兩顆紅點也自己講了，所以這裡只留「這兩個符號是什麼」。
    p.text(`紅點 = 節點（永遠不動，共 ${m.N} 個）　綠圈 = 腹點（振幅最大，共 ${m.n} 個）`,
        view.toScreenX((CLA_CHAIN_X0 + CLA_CHAIN_X1) / 2), view.toScreenY(CLA_LEGEND_Y));
}

initStringTensionNodes();

// 匯出這一頁的常數與物理，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    CLA_L, CLA_F, CLA_SLOW, CLA_N_MIN, CLA_N_MAX, CLA_XS,
    CLA_T_MIN, CLA_T_MAX, CLA_T_DEF,
    CLA_MU_MIN, CLA_MU_MAX, CLA_MU_DEF,
    CLA_A_MIN, CLA_A_MAX, CLA_A_DEF,
    CLA_STRING_Y, CLA_AMP_C, CLA_BRACKET_Y,
    CLA_CHAIN_Y, CLA_CHAIN_H, CLA_CHAIN_X0, CLA_CHAIN_X1, CLA_CHAIN_GAP,
    CLA_LADDER_CAP_Y, CLA_RUNG_LABEL_Y, CLA_LADDER_Y,
    CLA_RUNG_TOP, CLA_RUNG_BOT, CLA_AXIS_LABEL_Y, CLA_MARK_Y, CLA_LEGEND_Y,
    CLA_NODE_R, CLA_ANTI_R,
    // 字級表：繪製碼與驗證器讀同一份（見上面的 ⚠️）。
    CLA_TYPE,
    // 這一頁的物理：卡片、畫面、標題列共用同一個 model()，驗證器也讀它。
    claModel, claTensionFor, claNodeX, claLadderPos,
};
