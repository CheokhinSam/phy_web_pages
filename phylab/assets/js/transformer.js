/**
 * 🔌 變壓器
 *
 * 兩顆線圈纏在同一個鐵芯上：一次線圈接交流電源，二次線圈接負載。
 * 這一頁要回答三件事：
 *
 *   1. **電壓比 = 匝數比**　V₂/V₁ = N₂/N₁。左下角那條 45° 的理想線就是它，
 *      每動一次滑桿就落一個量測點在上面；切到「有損耗」時，新落的點會
 *      掉到線的下方，那就是損耗跑出來的地方。
 *   2. **功率不變**　理想變壓器的 P₁ = P₂。升壓的代價是**電流變小**——
 *      「電壓升高、電流變小」正是高壓輸電的道理。
 *   3. **每匝電壓兩邊相等**　V₁/N₁ = V₂/N₂。這才是變壓器的**根本原因**：
 *      兩顆線圈鏈到的是同一個 dΦ/dt，所以每一匝分到的電壓必然一樣。
 *      右下角把這兩個數並排放在一起，理想時它們逐位相同。
 *
 * ==========================================================================
 * ⚠️ 這一頁**不需要** MagneticKit 的場函式
 * ==========================================================================
 * 變壓器在課綱裡是**集總模型**（V₂/V₁ = N₂/N₁、P₁ = P₂），鐵芯裡的磁通
 * 只用來畫那一圈會隨交流轉向、又會縮到零的箭頭，不必逐點積分。
 * 所以這裡沒有場源清單、沒有 `u`、也不必呼叫 MagneticKit.check()——
 * verify-magnetism ⑪ 對「有沒有建場源」「有沒有取樣磁場」都是**條件式**的，
 * 條件不成立就不要求。唯一的 kit 呼叫是 MagneticKit.transformer()。
 *
 * ⚠️ 磁通 Φ 落後一次電壓 90°，這件事畫在箭頭上：
 *      v₁(t) = V̂₁ sin(ωt)　→　N₁ dΦ/dt = v₁　→　Φ(t) ∝ −cos(ωt)
 *    所以「v₁ 最大的那一刻」正是「Φ = 0、箭頭縮成一條線」的那一刻。
 *    這是第 4 頁（電磁感應）的同一件事，在這裡當作背景提醒。
 */

// ==========================================================================
// 邏輯世界
// ==========================================================================
const WORLD_W = 900;
const WORLD_H = 900;
const TAU = Math.PI * 2;

// 鐵芯：一個封閉的矩形框，兩柱各纏一顆線圈
const CORE = { x0: 330, y0: 250, x1: 570, y1: 440 };
const CORE_T = 34;                  // 鐵芯厚（框的寬度）→ 內窗 [364,536] × [284,406]
const CX1 = 347, CX2 = 553;         // 兩柱的軸線 x
const CCY = 345;                    // 兩顆線圈的中心高度
const COIL_R = 32;                  // 線圈半徑（沿水平方向鼓出來）
const COIL_SPAN = 66;               // 線圈沿軸的半長（2×66 = 132，柱高 190）

// 一次側的引線走這一條垂直線，二次側鏡射。**不能更靠內**：N 標籤
// （寬約 100 世界單位）就掛在兩柱正上方，太靠內會壓到標籤。
const LEAD_X1 = 270, LEAD_X2 = 900 - LEAD_X1;
const LEAD_Y_TOP = 208, LEAD_Y_BOT = 470;

// 上方的雙軌示波器：兩條正弦疊在同一個零線上、共用同一個電壓尺度
const WAVE = { x0: 352, x1: 872, zero: 115, amp: 44 };

// 左下角的圖：x 與 y 同一個量程，理想線才會是 45°。
//
// ⚠️ `x` 不可以小於 ~70。drawGraph 把 y 軸標題畫在「繪圖區左緣 **再往左 40
//    個畫布像素**」（lab-scene.js:223），那是像素不是世界單位。畫布越寬、
//    縮放越大，世界座標的 40 就越不足抵掉那 40 像素——x = 34 時標題整條被
//    裁到畫布外，**畫面上只是少了一行字，不會有任何錯誤**。
const GRAPH = { x: 70, y: 546, w: 426, h: 214 };
// 量程取 7 而不是「最大可達的 6」：讓 k = 6 那一點的記號離右緣還有一步。
// 刻度取 7 段是為了讓數字落在整數上（6 段會得到 0、1.17、2.33…）。
const K_MAX = 7;

const READ = { x: 528, y: 520, w: 352, h: 262 };

const C_V1 = [37, 99, 235];         // 一次電壓：藍
const C_V2 = [220, 38, 38];         // 二次電壓：紅
const C_FLUX = [124, 58, 237];      // 鐵芯磁通：紫
const C_CORE_FILL = [226, 232, 240];
const C_CORE = [71, 85, 105];
// 補助線灰。值和 MagneticScene.C_DIM 一樣，這裡自己寫一份是為了讓 model()
// 在 Node 裡跑得動——驗證腳本只掛 `MagneticScene.run` 一個 stub，畫面模組
// 整個掛上去要連 LabScene、PhysicsUtils 一起拖進來。**改色要兩邊都改。**
const C_DIM = [148, 163, 184];

const fmt = (v, d) => (Math.abs(v) < 1e-30 ? 0 : v).toFixed(d == null ? 2 : d);

// ==========================================================================
// 物理
// ==========================================================================

/**
 * 損耗參數。數字刻意**放大**——真實的電力變壓器效率在 95% 以上，
 * 這裡調成 89% 左右才看得出來偏離理想線。選單上也寫明了「誇大」。
 */
function lossParams(panel) {
    return panel.loss === 'real'
        ? { R1: 2, R2: 8, leak: 0.97 }   // 繞線電阻 + 一點漏磁
        : { R1: 0, R2: 0, leak: 1 };
}

let calcKey = '', calcRes = null;

/** 集總變壓器模型。只跟滑桿有關，跟時間無關——所以可以放心快取。 */
function calc(panel) {
    const key = panel.N1 + '|' + panel.N2 + '|' + panel.V1 + '|'
              + panel.Rload + '|' + panel.loss;
    if (key === calcKey && calcRes) return calcRes;
    const lp = lossParams(panel);
    calcKey = key;
    calcRes = MagneticKit.transformer({
        N1: panel.N1, N2: panel.N2, V1: panel.V1, Rload: panel.Rload,
        R1: lp.R1, R2: lp.R2, leak: lp.leak,
    });
    return calcRes;
}

const omega = panel => TAU * panel.freq;

/** 瞬時一次電壓（V）。二次電壓同相位、振幅 V₂。 */
const v1At = (t, panel) => panel.V1 * Math.sin(omega(panel) * t);

/** 鐵芯磁通的**正規化**值，−1..+1。落後 v₁ 90°（見檔頭）。 */
const phiNorm = (t, panel) => -Math.cos(omega(panel) * t);

/** 圖上的量測點：每換一組參數就落一點，同一點只記一次。 */
const pts = [];
function notePoint(R) {
    for (const q of pts) {
        if (Math.abs(q.x - R.ratioN) < 1e-12 && Math.abs(q.y - R.ratioV) < 1e-12) return;
    }
    pts.push({ x: R.ratioN, y: R.ratioV });
}

// ==========================================================================
// 畫面
// ==========================================================================

/** 折線（世界座標）——所有的接線都用這一支畫，粗細與顏色才一致。 */
function wire(p, view, ...q) {
    MagneticScene.strokeOn(p, MagneticScene.C_COIL, view.len(3, 1.8));
    p.noFill();
    // q 是攤平的座標：q[0],q[1] 是第一點，q[2],q[3] 是第二點……
    // 所以「還有下一點」的條件是 i+3 < q.length，不是 i+1。
    for (let i = 0; i + 3 < q.length; i += 2) {
        p.line(view.toScreenX(q[i]), view.toScreenY(q[i + 1]),
               view.toScreenX(q[i + 2]), view.toScreenY(q[i + 3]));
    }
}

/**
 * 鐵芯：外框填灰、內窗挖白，就得到一個「框」。
 * 疊片只在兩柱的外緣畫幾道短橫線示意——畫滿會變成一團雜訊。
 */
function drawCore(p, view) {
    p.noStroke();
    p.fill(C_CORE_FILL[0], C_CORE_FILL[1], C_CORE_FILL[2]);
    p.rect(view.toScreenX(CORE.x0), view.toScreenY(CORE.y0),
           view.len(CORE.x1 - CORE.x0), view.len(CORE.y1 - CORE.y0),
           view.len(6));
    p.fill(255);
    p.rect(view.toScreenX(CORE.x0 + CORE_T), view.toScreenY(CORE.y0 + CORE_T),
           view.len(CORE.x1 - CORE.x0 - 2 * CORE_T),
           view.len(CORE.y1 - CORE.y0 - 2 * CORE_T), view.len(3));

    MagneticScene.strokeOn(p, C_CORE, view.len(2.5, 1.5));
    p.noFill();
    p.rect(view.toScreenX(CORE.x0), view.toScreenY(CORE.y0),
           view.len(CORE.x1 - CORE.x0), view.len(CORE.y1 - CORE.y0), view.len(6));
    p.rect(view.toScreenX(CORE.x0 + CORE_T), view.toScreenY(CORE.y0 + CORE_T),
           view.len(CORE.x1 - CORE.x0 - 2 * CORE_T),
           view.len(CORE.y1 - CORE.y0 - 2 * CORE_T), view.len(3));
}

/**
 * 鐵芯裡的磁通：上下兩段軛各四枝箭頭，方向隨交流翻面、長度隨 |Φ| 伸縮。
 *
 * ⚠️ 只畫在**軛**上。兩柱被線圈蓋住，畫了也看不到；而軛上這八枝已經
 *    足夠看出「這是一個環流，而且它一直在換方向」。
 *    箭頭縮到零的那一刻正是 Φ = 0、也就是 v₁ 最大的那一刻——這不是巧合，
 *    是檔頭那條 90° 相位差的長相。
 */
function drawFlux(p, view, phiN) {
    const dir = phiN >= 0 ? 1 : -1;
    const len = 34 * Math.abs(phiN);
    if (len < 1.5) return;                       // 縮成一條線就別畫了
    const yTop = CORE.y0 + CORE_T / 2;
    const yBot = CORE.y1 - CORE_T / 2;
    // 三枝而不是四枝：四枝在全長時兩端會伸進線圈底下（內窗只有 172 寬，
    // 兩顆線圈各吃掉 15）。箭頭被線圈蓋掉一半，比少畫一枝更難讀。
    for (const x of [415, 450, 485]) {
        MagneticScene.arrow(p, view, x - dir * len / 2, yTop, dir * len, 0,
                            C_FLUX, { w: 3 });
        MagneticScene.arrow(p, view, x + dir * len / 2, yBot, -dir * len, 0,
                            C_FLUX, { w: 3 });
    }
}

/** 一顆線圈。用 drawCoil 畫圈數，但引線自己接——見下面 drawWires 的說明。 */
function drawWinding(p, view, cx, N) {
    MagneticScene.drawCoil(p, view, cx, CCY, 0, 1, COIL_R, {
        turns: Math.max(4, Math.min(14, Math.round(4 + N / 100))),
        span: COIL_SPAN,
        leads: false,            // 引線自己畫：drawCoil 的引線是為水平軸設計的
    });
}

/** 交流電源符號：一個圓裡面畫一個週期的正弦。 */
function drawSource(p, view, cx, cy, r) {
    MagneticScene.strokeOn(p, MagneticScene.C_COIL, view.len(3, 1.8));
    p.noFill();
    p.ellipse(view.toScreenX(cx), view.toScreenY(cy),
              view.len(r * 2), view.len(r * 2));
    p.beginShape();
    for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        p.vertex(view.toScreenX(cx - r * 0.62 + r * 1.24 * u),
                 view.toScreenY(cy - Math.sin(TAU * u) * r * 0.34));
    }
    p.endShape();
}

/** 負載電阻：一個方塊。 */
function drawLoad(p, view, cx, cy, w, h) {
    MagneticScene.strokeOn(p, MagneticScene.C_COIL, view.len(3, 1.8));
    p.fill(255);
    p.rect(view.toScreenX(cx - w / 2), view.toScreenY(cy - h / 2),
           view.len(w), view.len(h), view.len(4));
}

/**
 * 全部的接線。兩側各四個轉角，端子接在線圈最外緣的頂／底兩圈上
 * （x = 柱心 ∓ COIL_R），這樣接線看起來是**焊在線圈上**，而不是浮在半空。
 */
function drawWires(p, view) {
    const yT = CCY - COIL_SPAN + 8;
    const yB = CCY + COIL_SPAN - 8;
    // 一次側：電源
    wire(p, view,
         CX1 - COIL_R, yT, LEAD_X1, yT, LEAD_X1, LEAD_Y_TOP, 152, LEAD_Y_TOP, 152, 320);
    wire(p, view,
         CX1 - COIL_R, yB, LEAD_X1, yB, LEAD_X1, LEAD_Y_BOT, 152, LEAD_Y_BOT, 152, 372);
    // 二次側：負載（鏡射）
    wire(p, view,
         CX2 + COIL_R, yT, LEAD_X2, yT, LEAD_X2, LEAD_Y_TOP, 748, LEAD_Y_TOP, 748, 320);
    wire(p, view,
         CX2 + COIL_R, yB, LEAD_X2, yB, LEAD_X2, LEAD_Y_BOT, 748, LEAD_Y_BOT, 748, 372);
}

/**
 * 上方的雙軌示波器：v₁ 與 v₂ 疊在同一個零線、**共用同一個電壓尺度**。
 * 共用尺度是重點——高度差就是電壓比，一眼看得出來；分開各自正規化的話
 * 兩條線永遠一樣高，這一頁就白畫了。
 *
 * 視窗是 [t−P, t+P]（前後各一個週期），光點固定在正中間。
 */
function drawWaves(p, view, t, panel, R) {
    const P = 1 / panel.freq;
    const t0 = t - P, t1 = t + P;
    const sc = WAVE.amp / Math.max(panel.V1, R.V2, 1e-9);
    const X = tau => WAVE.x0 + (tau - t0) / (t1 - t0) * (WAVE.x1 - WAVE.x0);

    MagneticScene.dashed(p, view, WAVE.x0, WAVE.zero, WAVE.x1, WAVE.zero,
                         MagneticScene.C_AXIS, { w: 1.5 });

    const trace = (amp, col) => {
        p.noFill();                                  // p5：beginShape 前一定要自己定填色
        MagneticScene.strokeOn(p, col, view.len(2.5, 1.6));
        p.beginShape();
        for (let i = 0; i <= 160; i++) {
            const tau = t0 + (t1 - t0) * i / 160;
            p.vertex(view.toScreenX(X(tau)),
                     view.toScreenY(WAVE.zero - amp * Math.sin(omega(panel) * tau) * sc));
        }
        p.endShape();
        // 光點：現在這一刻的瞬時值
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        const v = amp * Math.sin(omega(panel) * t) * sc;
        p.ellipse(view.toScreenX(X(t)), view.toScreenY(WAVE.zero - v),
                  view.len(9), view.len(9));
    };
    trace(panel.V1, C_V1);
    trace(R.V2, C_V2);
}

/** 右下角的讀數板。 */
function drawReadout(p, view, panel, R, S) {
    p.noStroke();
    p.fill(255);
    p.rect(view.toScreenX(READ.x), view.toScreenY(READ.y),
           view.len(READ.w), view.len(READ.h), view.len(14));

    // ⚠️ 一次電壓要讀 panel.V1，不是 R.V1——kit 的 transformer() 只回傳
    //    二次側的結果（V2、I2…），回傳值裡**沒有** V1。
    const perTurn1 = panel.V1 / panel.N1, perTurn2 = R.V2 / panel.N2;
    const rows = [
        { t: '每匝電壓 V₁/N₁', v: fmt(perTurn1 * 1000, 2), u: 'mV', col: C_V1 },
        { t: '每匝電壓 V₂/N₂', v: fmt(perTurn2 * 1000, 2), u: 'mV', col: C_V2 },
        { t: '一次功率 P₁',    v: fmt(R.P1, 1), u: 'W', col: C_CORE },
        { t: '二次功率 P₂',    v: fmt(R.P2, 1), u: 'W', col: C_CORE },
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

    MagneticScene.worldBadge(p, view, READ.x + READ.w / 2, READ.y + READ.h - 34,
                             S.verdict, { size: 15, col: S.verdictCol });
}

// ⚠️ 名字**不可以**叫 `draw`。這是 classic script 的頂層宣告，叫 `draw` 就會
//    變成 `window.draw`；而 p5 的 `redraw()` 內部是
//    `r = this._isGlobal ? window : this; r.draw()`——一旦它走到 window 那一支，
//    就會呼叫到這一支，而且**一個參數都不傳**（`S` 是 undefined，整個炸掉）。
//    實際症狀：headless 下 rAF 只發火一次，所以只有一則 TypeError；
//    真實瀏覽器每一幀都中。改名之後 `window.draw` 不存在，p5 就只認得
//    lab-scene 包好的那一個。`drawCore` 這些相反地很安全——它們不是 p5 的 API 名。
function drawScene(p, view, t, panel, sol, S) {
    const R = S.R;

    drawWaves(p, view, t, panel, R);
    drawCore(p, view);
    drawFlux(p, view, phiNorm(t, panel));
    drawWinding(p, view, CX1, panel.N1);
    drawWinding(p, view, CX2, panel.N2);
    drawWires(p, view);
    drawSource(p, view, 152, 346, 26);
    drawLoad(p, view, 748, 346, 34, 54);

    // 標籤
    MagneticScene.worldBadge(p, view, CX1, CORE.y0 - 19,
                             'N₁ = ' + panel.N1 + ' 匝', { size: 13, col: C_CORE });
    MagneticScene.worldBadge(p, view, CX2, CORE.y0 - 19,
                             'N₂ = ' + panel.N2 + ' 匝', { size: 13, col: C_CORE });
    MagneticScene.worldBadge(p, view, (CORE.x0 + CORE.x1) / 2, CCY,
                             '鐵芯磁通 Φ', { size: 13, col: C_FLUX });
    MagneticScene.worldBadge(p, view, 66, 346, '交流電源', { size: 12, col: C_CORE });
    MagneticScene.worldBadge(p, view, 810, 346, 'R = ' + panel.Rload + ' Ω',
                             { size: 13, col: C_CORE });
    MagneticScene.worldBadge(p, view, 400, 44, 'v₁', { size: 13, col: C_V1 });
    MagneticScene.worldBadge(p, view, 450, 44, 'v₂', { size: 13, col: C_V2 });
    MagneticScene.worldBadge(p, view, 690, 44, '同頻率、同相位，只有振幅不同',
                             { size: 12, col: C_DIM });

    // --- 圖：電壓比 vs 匝數比 ---
    const k = R.ratioN;
    const lines = [{ from: { x: 0, y: 0 }, to: { x: K_MAX, y: K_MAX },
                     col: C_DIM, dash: true,
                     label: '理想：V₂/V₁ = N₂/N₁' }];
    // 有損耗時，把「實際值」和「理想值」之間那段缺口畫出來——那就是效率
    // 掉下來的地方，比卡片上的一個百分比更直接。
    if (k - R.ratioV > 0.02) {
        lines.push({ from: { x: k, y: R.ratioV }, to: { x: k, y: k },
                     col: C_V2, dash: true });
    }
    MagneticScene.drawGraph(p, view, {
        x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
        xMin: 0, xMax: K_MAX, yMin: 0, yMax: K_MAX,
        xLabel: '匝數比 N₂/N₁', xUnit: '',
        yLabel: '電壓比 V₂/V₁', yUnit: '',
        // 標題要跟著損耗模式換。理想那句話在「有損耗」之下是**假的**——
        // 點會掉到線的下面，正是那一格要給學生看的東西。
        title: panel.loss === 'real'
             ? '有損耗：點掉到理想線下面，缺口就是效率'
             : '不管怎麼調，量到的點都落在 V₂/V₁ = N₂/N₁ 上',
        xTicks: 7, yTicks: 7,
        lines,
        series: [{ pts, col: C_V1, r: 2.6 }],
        marker: { x: k, y: R.ratioV, col: C_V2 },
        plate: true,
    });

    drawReadout(p, view, panel, R, S);
}

// ==========================================================================
// 介面
// ==========================================================================

MagneticScene.run({
    formula: '\\begin{aligned}'
           + '&\\frac{V_2}{V_1} = \\frac{N_2}{N_1} \\\\'
           + '&V_1 I_1 = V_2 I_2'
           + '\\end{aligned}',
    formulaFallback: 'V₂/V₁ = N₂/N₁　　V₁I₁ = V₂I₂',

    controls: {
        selects: [
            { key: 'loss', label: '損耗', def: 'ideal', options: [
                { v: 'ideal', t: '理想變壓器（無損耗）' },
                { v: 'real',  t: '有損耗（數字已誇大）' },
            ] },
        ],
        sliders: [
            { key: 'N1',    label: '一次匝數 N₁', min: 200, max: 800,  step: 50, def: 300, unit: '匝', dec: 0 },
            { key: 'N2',    label: '二次匝數 N₂', min: 100, max: 1200, step: 50, def: 900, unit: '匝', dec: 0 },
            { key: 'V1',    label: '一次電壓 V₁', min: 10,  max: 120,  step: 10, def: 40,  unit: 'V',  dec: 0 },
            { key: 'Rload', label: '負載電阻 R',  min: 10,  max: 1000, step: 10, def: 200, unit: 'Ω',  dec: 0 },
            { key: 'freq',  label: '交流頻率',    min: 0.5, max: 3,    step: 0.5, def: 1,  unit: 'Hz', dec: 1 },
        ],
    },

    cards: [
        { label: '一次電壓 V₁', id: 'cardV1', unit: 'V', highlight: true },
        { label: '二次電壓 V₂', id: 'cardV2', unit: 'V', highlight: true },
        { label: '匝數比 N₂/N₁', id: 'cardKN', unit: '' },
        { label: '電壓比 V₂/V₁', id: 'cardKV', unit: '' },
        { label: '一次電流 I₁', id: 'cardI1', unit: 'A' },
        { label: '二次電流 I₂', id: 'cardI2', unit: 'A' },
        { label: '效率 P₂/P₁',  id: 'cardEff', unit: '%' },
        { label: '損耗功率',    id: 'cardLoss', unit: 'W' },
    ],

    model(t, panel) {
        const R = calc(panel);
        notePoint(R);

        const k = R.ratioN;
        const kind = Math.abs(k - 1) < 1e-12 ? '隔離' : (k > 1 ? '升壓' : '降壓');
        return {
            R, k, kind,
            verdict: kind + '：V₂ 是 V₁ 的 ' + fmt(R.ratioV, 2) + ' 倍'
                   + '　效率 ' + fmt(R.efficiency * 100, 1) + '%',
            verdictCol: Math.abs(k - 1) < 1e-12 ? C_DIM : (k > 1 ? C_V2 : C_V1),
        };
    },

    values(t, panel, sol, S) {
        const R = S.R;
        return {
            cardV1: fmt(panel.V1, 1),
            cardV2: fmt(R.V2, 1),
            cardKN: fmt(R.ratioN, 2),
            cardKV: fmt(R.ratioV, 2),
            cardI1: fmt(R.I1, 3),
            cardI2: fmt(R.I2, 3),
            cardEff: fmt(R.efficiency * 100, 1),
            cardLoss: fmt(R.loss, 2),
        };
    },

    // ⚠️ 第三個參數是 `sol`，不是 `state`。磁學這幾頁沒有載入 circuit-kit，
    //    lab-scene 的預設 solver 是恆等函式，所以 `sol === state`。
    titleText(t, panel, S) {
        const R = S.R;
        return 'N₁ = ' + panel.N1 + ' 匝　N₂ = ' + panel.N2 + ' 匝'
             + '　V₁ = ' + fmt(panel.V1, 1) + ' V'
             + '　V₂ = ' + fmt(R.V2, 1) + ' V'
             + '　I₁ = ' + fmt(R.I1, 3) + ' A'
             + '　I₂ = ' + fmt(R.I2, 3) + ' A'
             + '　' + S.verdict;
    },

    onReset() { pts.length = 0; },

    draw: drawScene,
});

if (typeof window !== 'undefined') {
    window.__page = {
        TAU, CORE, CX1, CX2, CCY, COIL_R, COIL_SPAN, K_MAX, WAVE,
        lossParams, calc, omega, v1At, phiNorm, notePoint,
        getPoints() { return pts.slice(); },
        clearPoints() { pts.length = 0; },
    };
}
