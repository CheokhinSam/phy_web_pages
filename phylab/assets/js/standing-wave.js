/**
 * 🪢 駐波與諧音 — 兩端固定時，只有特定的波長活得住
 *
 * 這頁要學生看到四件事：
 *   1. 兩端固定時，波長被繩長鎖死：L = nλ/2，只有 λ = 2L/n 這幾個值
 *      能在繩上留下穩定的圖形。其他的波長會互相干涉、抵銷掉。
 *   2. 圖形**不會跑**——波峰波谷停在原地上下跳，這就是「駐」波。
 *   3. **節點永遠不動**（振幅 0），腹點振幅最大。節點間距剛好是 λ/2。
 *   4. 駐波不是新的波，它就是兩個反向行進波疊加出來的：
 *      y = (A/2)sin(kx−ωt) + (A/2)sin(kx+ωt) = A sin(kx)cos(ωt)。
 *      下面那條 lane 就是這個分解。
 *
 * 另外可以做「一端固定、一端自由」的對照：那時候 L = nλ/4，而 **n 只能
 * 是奇數**（1、3、5…），所以只有**奇數倍**的頻率能共振——這就是為什麼
 * 同樣一根管子，一端開口和兩端封閉吹出來的音高不一樣。
 * n 就是課本上那個模式編號，兩種端點條件共用同一個字母；滑桿的範圍
 * 跟著端點條件換（見 SW_N_RANGE）。
 *
 * 場景、波的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const SW_L = 8.0;              // 繩長（公尺），兩端固定在 0 與 8
const SW_LANE_MODE = 300;      // 駐波
const SW_LANE_DECO = 620;      // 分解成兩個行進波

const SW_AMP_C = 13;           // 垂直放大：世界單位 / 公分（最大振幅 6 cm → ±78）

const SW_T = 16, SW_MU = 0.25; // 繩子的張力與線密度 → v = 8.00 m/s

/**
 * 模式 `n` 在兩種端點條件下**不是同一組數字**，而這一組就是課本上那一組：
 *
 *   兩端固定   L = nλ/2，n = 1, 2, 3, 4, 5     每個整數都是一個模式
 *   一端自由   L = nλ/4，n = 1, 3, 5, 7, 9     **只有奇數**
 *
 * ⚠️ 「一端自由時 n 只能是奇數」不是我們挑奇數來畫，是物理：n 取偶數時
 *    kL = nπ/2 會讓 x = L 也變成零點——右端從腹點變成節點，畫面上那顆
 *    「自由端」會釘在平衡位置上動都不動。而卡片、波長、頻率、節點數
 *    **全部照樣算得出來、照樣自洽**，只有截圖看得出來（陷阱九）。
 *
 * ⚠️ 這一組數字**同時**是滑桿的規格與物理的定義域，所以驗證器有兩條在守：
 *    一條量滑桿（`controls.sliders` 的 n 就是 `SW_N_RANGE.fixed`），
 *    一條量物理（這個範圍裡的每一個 n，右端都真的是腹點）。
 *    它們原本是分開的兩份（滑桿永遠 1–5、物理自己把索引換成奇數），
 *    **兩份的症狀是卡片上的「模式 N」寫 2 而課本說這個模式叫 n = 3**。
 */
const SW_N_RANGE = {
    fixed: { min: 1, max: 5, step: 1, def: 2 },
    free:  { min: 1, max: 9, step: 2, def: 1 },
};

/** 把任何數字夾到該端點條件下最接近的合法 n（一端自由時一定是奇數）。 */
function swSnapN(endType, n) {
    const r = SW_N_RANGE[endType === 'free' ? 'free' : 'fixed'];
    let v = Math.floor((n - r.min) / r.step + 1e-9) * r.step + r.min;
    if (v < r.min) v = r.min;
    if (v > r.max) v = r.max;
    return v;
}

/**
 * 切換端點條件時，滑桿該變成什麼：新的 min／max／step，以及**在新範圍底下**
 * 合法的那個值。跟 `swSnapN` 一樣是純函式、也一樣住在模組層級——驗證器
 * 只進得到 `window.__page` 匯出的東西（README 陷阱十九），而「固定端的 2
 * 切到自由端是 1 還是 3」正是這一頁最容易被瀏覽器偷偷改掉的一條規則。
 */
function swRetunePlan(endType, rawValue) {
    const r = SW_N_RANGE[endType === 'free' ? 'free' : 'fixed'];
    return { min: r.min, max: r.max, step: r.step, value: swSnapN(endType, rawValue) };
}

/**
 * 這一頁的駐波——**模組層級**，因為驗證器只進得到 `window.__page` 匯出的東西
 * （README 陷阱十九）。它原本住在 `initStandingWave()` 裡面，於是這一頁的
 * 全部物理（節點數、諧音倍數、自由端的 k）**一條斷言都沒有**：
 * 驗證器看得到的只有 `draw()` 畫出來的像素。
 *
 * 兩端固定時 k = nπ/L（繩長裡剛好塞進 n 個半波長）；
 * 一端自由時 k = nπ/(2L)（只塞得進奇數個四分之一波長）。
 * ω 不能亂給——它由 v 和 k 綁死：ω = vk = 2πf。
 *
 * ⚠️ `n` 一律先過 `swSnapN`：面板上那個值隨時可能是不合法的（滑桿還沒換
 *    範圍、驗證器餵了偶數、網址參數寫了 `s_n=4`），而「不合法的 n」在這裡
 *    的症狀是**右端被釘住**，不是丟錯。夾在門口比夾在每個呼叫點可靠。
 *
 * ⚠️ `nodeCount` 只有這一份。它本來在 `draw()` 裡又被寫了一次
 *    （`freeEnd ? panel.n : panel.n + 1`），兩份只要有一份走鐘，症狀是
 *    **卡片寫「3 個」而畫面上點著 4 顆紅點**——兩個數字都在同一頁上，
 *    而 `errs=0`、爆框 0、波也照樣在跳（陷阱九）。
 */
function swBuildMode(panel) {
    const m = WaveScene.medium(SW_T, SW_MU);
    const freeEnd = panel.endType === 'free';
    const n = swSnapN(freeEnd ? 'free' : 'fixed', panel.n);
    const k = freeEnd ? n * Math.PI / (2 * SW_L) : n * Math.PI / SW_L;
    const w = m.v * k;
    const lambda = 2 * Math.PI / k;
    const y = (x, t) => panel.A * Math.sin(k * x) * Math.cos(w * t);
    // 兩個反向行進波，振幅各是腹點的一半，相加剛好等於 y
    const right = WaveScene.traveling({ A: panel.A / 2, k, v: m.v, dir: +1, x0: 0 });
    const left  = WaveScene.traveling({ A: panel.A / 2, k, v: m.v, dir: -1, x0: 0 });
    // 節點數＝sin(kx) 在 [0, L] 上的零點個數（見驗證器 ㉜(b)）：
    // 兩端固定時 x = L 也是零點（n + 1 個）；一端自由時 x = L 是腹點，
    // 弦上只有 (n + 1)/2 個零點。
    const nodeCount = freeEnd ? (n + 1) / 2 : n + 1;
    // 「第幾個諧音」＝模式編號：兩端固定的 n 倍頻、一端自由的奇數倍頻。
    const harmonic = n;
    return { m, k, w, lambda, y, right, left, freeEnd, n, nodeCount, harmonic };
}

function initStandingWave() {
    WaveScene.run({

        // ⚠️ 兩條式子用 \qquad 併排的話左欄的公式框（1100px 時內寬只有
        //    183–198px）會把它**靜默裁掉**——`?measure=1` 回報 OVERFLOW 0，
        //    畫面也不報錯，只有右半條式子消失。KaTeX 的 display 模式不會自動
        //    換行，所以要自己拆。詳見 headless README 陷阱八。
        formula: '\\begin{aligned} y &= A\\sin(kx)\\cos(\\omega t) \\\\ L &= n\\frac{\\lambda}{2} \\end{aligned}',
        formulaFallback: 'y = A sin(kx) cos(ωt)　　L = n λ/2',

        controls: {
            selects: [
                {
                    key: 'endType', label: '兩端怎麼固定', def: 'fixed',
                    options: [
                        { v: 'fixed', t: '兩端都固定' },
                        { v: 'free', t: '左端固定、右端自由' },
                    ],
                },
            ],
            sliders: [
                // ⚠️ 這裡的 min/max/step 是「兩端固定」那一組。一端自由時
                //    合法的 n 是奇數（1,3,5,7,9），範圍要換——`swRetuneN()`
                //    會在切換端點條件時把滑桿重新設定一次。
                { key: 'n', label: '模式 <i>n</i>', unit: '', ...SW_N_RANGE.fixed, dec: 0 },
                { key: 'A', label: '腹點振幅 <i>A</i>', unit: 'cm', min: 1, max: 6, step: 0.5, def: 4, dec: 1 },
            ],
        },

        cards: [
            { label: '時間 TIME',     id: 'cardTime',      unit: 's',   highlight: true },
            { label: '波速 V',        id: 'cardV',         unit: 'm/s', highlight: true },
            // 模式 N 就是諧音編號（兩端固定 n=1,2,3…；一端自由 n=1,3,5…），
            // 所以不再另開一張「諧音倍數」——兩張卡片會顯示同一個數字。
            { label: '模式 N',        id: 'cardMode',      unit: '' },
            { label: '波長 Λ',        id: 'cardLambda',    unit: 'm' },
            { label: '頻率 F',        id: 'cardF',         unit: 'Hz' },
            { label: '腹點振幅',      id: 'cardAntinode',  unit: 'cm' },
            { label: '節點間距',      id: 'cardNodeGap',   unit: 'm' },
            { label: '節點數',        id: 'cardNodes',     unit: '個' },
        ],

        values(t, panel) {
            const { m, lambda, n, nodeCount } = swBuildMode(panel);
            return {
                cardTime:     t.toFixed(2),
                cardV:        m.v.toFixed(2),
                cardMode:     String(n),
                cardLambda:   lambda.toFixed(2),
                cardF:        (m.v / lambda).toFixed(2),
                // 腹點振幅就是兩個行進波振幅相加：A/2 + A/2 = A
                cardAntinode: panel.A.toFixed(1),
                // 相鄰節點永遠差半個波長——畫面上那個括號量到的就是這個數字
                cardNodeGap:  (lambda / 2).toFixed(2),
                cardNodes:    String(nodeCount),
            };
        },

        titleText(t, panel) {
            const { m, lambda, freeEnd, n } = swBuildMode(panel);
            const f = m.v / lambda;
            if (t < 0.05) {
                const rule = freeEnd ? 'L = nλ/4（n = 1, 3, 5…）' : 'L = nλ/2';
                const fits = freeEnd ? `${n} 個四分之一波長` : `${n} 個半波長`;
                return `${rule}：波長被繩長鎖死成 λ = ${lambda.toFixed(2)} m，`
                     + `弦上剛好留下 ${fits}——按下開始，繩子只會原地上下跳`;
            }
            if (freeEnd) {
                return `一端自由：只有奇數倍頻率能共振，這是第 ${n} 諧音（λ = 4L/${n} = ${lambda.toFixed(2)} m，`
                     + `f = ${f.toFixed(2)} Hz）——右端是腹點，動得最厲害`;
            }
            return `兩端固定：L = ${n}×λ/2 → λ = ${lambda.toFixed(2)} m，f = ${f.toFixed(2)} Hz；`
                 + `節點永遠不動、相鄰節點間距剛好 λ/2 = ${(lambda / 2).toFixed(2)} m`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            // nodeCount 由 swBuildMode 給（和卡片上那個數字是同一份）
            const { k, lambda, y, right, left, freeEnd, nodeCount } = swBuildMode(panel);

            // ⚠️ 節點位置**直接由 λ 推**：相鄰兩個節點永遠差半個波長，第一個
            //    在 x = 0。這條式子對兩種端點條件都成立，所以不必再分成
            //    「固定端 mL/n」和「自由端 mL/(n−0.5)」兩份——兩份就是等著
            //    其中一份走鐘，而症狀是紅點畫在波峰上（數字全對）。
            const nodeX = j => j * lambda / 2;

            // ------------------------------------------------------------
            // lane 0：駐波
            // ------------------------------------------------------------
            drawEndpointAt(p, view, 0, SW_LANE_MODE, 'fixed', 0);
            drawEndpointAt(p, view, SW_L, SW_LANE_MODE, freeEnd ? 'free' : 'fixed',
                           freeEnd ? y(SW_L, t) : 0);

            TS.drawBaseline(p, view, SW_LANE_MODE);

            // 振幅包絡線：繩子只會在這個信封裡面上上下下
            drawEnvelope(p, view, panel.A, k);

            TS.drawWave(p, view, TS.sample(y, 0, SW_L, t, lambda),
                { baseY: SW_LANE_MODE, ampScale: SW_AMP_C, color: [15, 23, 42], weight: 5 });
            TS.drawLaneLabel(p, view, SW_LANE_MODE, '駐波', [15, 23, 42]);

            // 節點：永遠不動的點
            p.noStroke();
            p.fill(220, 38, 38);
            for (let i = 0; i < nodeCount; i++) {
                p.circle(TS.ropeX(view, nodeX(i)), view.toScreenY(SW_LANE_MODE), view.len(17, 8));
            }
            p.noStroke();
            p.fill(220, 38, 38);
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('紅點 = 節點，永遠不動', TS.ropeX(view, 0) + view.len(14, 7),
                   view.toScreenY(SW_LANE_MODE + 96));

            // λ/2 括號：標在相鄰兩個節點之間
            if (nodeCount >= 2) {
                const a = nodeX(0), b = nodeX(1);
                if (b <= SW_L + 1e-9) {
                    TS.wavelengthBracket(p, view, a, b, SW_LANE_MODE - 108,
                        `相鄰節點間距 = λ/2 = ${(lambda / 2).toFixed(2)} m`,
                        { color: [220, 38, 38], above: true, size: 15 });
                }
            }

            // 腹點標記：第一個腹點在 λ/4（自由端那一頁的腹點就是右端點本身）
            const antiX = freeEnd ? SW_L : lambda / 4;
            if (!freeEnd) {
                TS.valueBadge(p, view, TS.ropeX(view, antiX),
                    view.toScreenY(SW_LANE_MODE - SW_AMP_C * panel.A - 30),
                    `腹點振幅 ${panel.A.toFixed(1)} cm`, { size: 14, stroke: [22, 163, 74], fillColor: [21, 128, 61] });
            }

            // ------------------------------------------------------------
            // lane 1：分解成兩個反向行進波
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, SW_LANE_DECO);
            TS.drawWave(p, view, TS.sample(right, 0, SW_L, t, lambda),
                { baseY: SW_LANE_DECO, ampScale: SW_AMP_C, color: [147, 197, 253], weight: 2.5, dash: 9 });
            TS.drawWave(p, view, TS.sample(left, 0, SW_L, t, lambda),
                { baseY: SW_LANE_DECO, ampScale: SW_AMP_C, color: [253, 186, 116], weight: 2.5, dash: 9 });
            TS.drawWave(p, view, TS.sample((x, tt) => right(x, tt) + left(x, tt), 0, SW_L, t, lambda),
                { baseY: SW_LANE_DECO, ampScale: SW_AMP_C, color: [15, 23, 42], weight: 3 });

            TS.drawLaneLabel(p, view, SW_LANE_DECO, '分解', [100, 116, 139]);
            TS.drawTravelArrow(p, view, SW_L * 0.25, SW_LANE_DECO - 120, +1, '往右', [147, 197, 253]);
            TS.drawTravelArrow(p, view, SW_L * 0.75, SW_LANE_DECO - 120, -1, '往左', [253, 186, 116]);
            p.noStroke();
            p.fill(100, 116, 139);
            p.textSize(view.len(14, 8));
            p.textStyle(p.NORMAL);
            p.textAlign(p.CENTER, p.TOP);
            p.text('兩個行進波相加 = 上面那條駐波',
                   TS.ropeX(view, SW_L / 2), view.toScreenY(SW_LANE_DECO + 118));
        },
    });

    // ----------------------------------------------------------------------
    // 切換端點條件時，把 n 滑桿換成那個條件下合法的範圍
    // ----------------------------------------------------------------------
    /**
     * ⚠️ 這種「控制項的範圍要跟著另一個控制項變」的東西**沒有守門員會自己
     *    長出來**——`controls.sliders` 宣告完就被 `buildPanel` 一次全部畫出來，
     *    它不知道 n 的定義域跟端點條件有關。所以這裡要自己接：
     *    在選單上再掛一個 listener（`buildPanel` 自己那一個先跑，面板上的
     *    `endType` 屆時已經更新完了），再把滑桿的範圍改掉、把目前的值夾進
     *    新範圍、走一次 `input` 事件。
     *
     * ⚠️ 不能改 `o.onChange`：`WaveScene.run` 會蓋掉它（run 只把 formula／
     *    controls／keepLive 傳給 buildPanel，自己接走 onChange 去重設 simTime
     *    與推卡片），頁面傳進去的回呼**永遠不會被呼叫**。
     *
     * ⚠️ 也不直接改 `panel.n`：`bindSlider` 的處理器除了寫面板上的值，還會
     *    把滑桿旁那個數字（`#nVal`）一起更新。自己改其中一邊的症狀是
     *    **滑桿跳到 3、旁邊還寫著 2**，而物理照樣用 3 算——三個數字裡只有
     *    一個錯，看起來像眼花。
     */
    /**
     * ⚠️ **先讀再改，順序不能顛倒。** 改 `min`／`max`／`step` 任何一個，
     *    瀏覽器會**立刻**把滑桿現值吸附到新格點上：固定端預設的 2 在
     *    `step = 2` 寫下去的那一刻就變成 3 了，於是讀到的已經不是 2，
     *    `swSnapN('free', 2) = 1` 這條規則**根本沒被問到**。
     *    症狀是切過去落在 **3**，而滑桿、`#nVal`、畫面、卡片四者完全一致
     *    （3 本來就是合法的），**只有「2 應該變成 1」這個期待落空**——
     *    看起來像眼花，找不到任何不對的地方。
     *    驗證器只有一條**靜態斷言**守得到這個順序（Node 裡沒有 range input）。
     */
    function swRetuneN(endType) {
        const el = document.getElementById('nSlider');
        if (!el) return;
        // 目前的值要在動任何屬性**之前**讀走（理由見上面那一段）
        const plan = swRetunePlan(endType, parseFloat(el.value));
        el.min = String(plan.min);
        el.max = String(plan.max);
        el.step = String(plan.step);
        // 一端自由沒有 n = 2 這個模式，2 要落到 1（見 SW_N_RANGE 的說明）。
        // 這一行同時走一次 input 事件，讓面板上的值與 `#nVal` 一起更新。
        el.value = String(plan.value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const endTypeEl = document.getElementById('endTypeSelect');
    if (endTypeEl) {
        endTypeEl.addEventListener('change', () => swRetuneN(endTypeEl.value));
        swRetuneN(endTypeEl.value);   // 初始那一組也走同一條路，不另外寫一份
    }

    /** 振幅包絡：±A sin(kx) 的兩條淡虛線。 */
    function drawEnvelope(p, view, A, k) {
        const ctx = p.drawingContext;
        // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
        p.push();
        ctx.setLineDash([view.len(8, 3), view.len(7, 3)]);
        // ⚠️ p5 的 endShape() 不帶參數時「不閉合」只影響描邊，填色仍然會
        //    把路徑自動閉合後填滿。這裡不關掉 fill 的話，上下兩條包絡各自
        //    被填成一塊透鏡，兩塊疊起來剛好是 ±A|sin(kx)| 的實心區域——
        //    看起來就像繩子被畫成一大條深色香蕉，而不是一條線。
        //    （繼承到的 fill 是 drawEndpoint 留下的 (30,41,59)。）
        p.noFill();
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(2, 1));
        for (const sign of [+1, -1]) {
            p.beginShape();
            for (let i = 0; i <= 120; i++) {
                const x = SW_L * i / 120;
                const env = sign * A * Math.abs(Math.sin(k * x));
                p.vertex(WaveScene.ropeX(view, x),
                         view.toScreenY(WaveScene.laneY(SW_LANE_MODE, SW_AMP_C, env)));
            }
            p.endShape();
        }
        p.pop();
    }

    /**
     * 端點。自由端要跟著繩子跑——那裡本來就是腹點，畫在平衡位置上
     * 會完全誤導（看起來像釘住了）。
     */
    function drawEndpointAt(p, view, xm, baseY, type, disp) {
        if (type === 'fixed') {
            WaveScene.drawEndpoint(p, view, xm, baseY, 'fixed');
            return;
        }
        const sx = WaveScene.ropeX(view, xm);
        const sy = view.toScreenY(WaveScene.laneY(baseY, SW_AMP_C, disp));
        const h = view.len(70, 30);
        p.stroke(100, 116, 139);
        p.strokeWeight(view.len(4, 2));
        p.line(sx + view.len(10, 5), view.toScreenY(baseY - h), sx + view.len(10, 5), view.toScreenY(baseY + h));
        p.noFill();
        p.stroke(37, 99, 235);
        p.strokeWeight(view.len(5, 2));
        p.circle(sx, sy, view.len(26, 12));
        p.noStroke();
        p.fill(37, 99, 235);
        p.textSize(view.len(15, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.CENTER);
        p.text('自由端', sx + view.len(20, 9), view.toScreenY(baseY + h));
    }
}

initStandingWave();

// 匯出這一頁的常數與駐波模型，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    SW_L, SW_LANE_MODE, SW_LANE_DECO, SW_AMP_C,
    SW_T, SW_MU,
    // 模式 n 的定義域——滑桿的規格與物理的定義域是同一份資料
    SW_N_RANGE, swSnapN, swRetunePlan,
    // 這一頁的全部物理：k、λ、ω、節點數、諧音倍數、兩個行進波。
    swBuildMode,
};
