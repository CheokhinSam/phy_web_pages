/**
 * ⚙️ 直流電動機
 *
 * 這一頁要回答的是：**為什麼電動機不會一直加速下去？**
 *
 * 舊版這一頁寫的是「電壓越高 → 電流越大 → 力越大 → 轉越快」，用的是
 * I = V/R。那條式子只在**線圈靜止**的時候成立——真實的電動機一轉起來，
 * 線圈自己就在磁場裡發電，這個「反電動勢」把電流壓下去。少了它，電流
 * 會隨電壓無限上升，能量也就不守恆了（verify-magnetism.js ⑦ 有一條
 * 斷言專門在盯 τ·ω = ε·I）。
 *
 * 所以這一頁的主角是**三條恆等式**，而且三條都是逐位精確的：
 *
 *     ε_back = N·B·A·ω          反電動勢就是線圈自己的發電機
 *     I = (V − ε_back) / R      電流被反電動勢壓住 → 轉速自動收斂
 *     V·I = ε·I + I²·R          電源給的功率 = 機械輸出 + 線圈發熱
 *
 * 最後一條的左邊是電源、右邊兩項加起來剛好等於它——畫面右下的三根
 * 長條就是這一條，上面那根和下面兩根一樣長，不是畫得像，是算出來就一樣。
 *
 * ⚠️ 反電動勢的 |sin θ| 取平均（見 magnetic-kit.js 的 dcMotor），
 *    也就是「多段換向器的電樞」而不是單一線圈。單一線圈的轉矩每轉
 *    四分之一圈脈動一次、θ = 0 是換向死點，畫面會變成一格一格跳；
 *    課本寫的 τ = N·B·A·I 本來就是整圈平均，這一頁兩邊都用平均值。
 */
(function () {
    'use strict';

    const TAU = Math.PI * 2;

    // ======================================================================
    // 邏輯世界（900×900，見 lab-scene.js）
    // ======================================================================
    // 這一頁的磁場是**水平的**（在畫面內、左右向），和帶電粒子那一頁
    // 垂直穿出畫面的均勻場不一樣。場源是兩塊磁極面，中間的場是均勻的，
    // 所以不需要 traceLine、也沒有場源清單可以 check()——轉矩與反電動勢
    // 都是用集總公式（N·B·A）算的，不是逐點取樣來的。
    const AX = 450;                     // 轉軸的世界 x
    const AY = 268;                     // 轉軸的世界 y
    const POLE_L = 148, POLE_R = 752;   // 左右磁極面的中心 x
    const POLE_W = 84, POLE_H = 330;
    // 線圈兩條導體的間距。**這是沿著轉軸看進去的視圖**（見 drawMotorCoil），
    // 所以它在畫面上是一條繞著 (AX, AY) 轉的線段，不是一個矩形——
    // 一條「寬」就夠了，沒有對應的「高」。
    const COIL_W = 250;
    // 力的箭頭：預設參數、靜止（啟動）時的長度，以及上限。
    // 上限刻意壓在轉子半徑（COIL_W/2 = 125）以內——換向器讓箭頭**永遠指向
    // 轉子內部**（導體在下方時力朝上、在上方時力朝下），壓短一點就不會戳到
    // 轉子外面壓到標籤或圖表。
    const F_ARROW = 72, F_ARROW_MAX = 78;
    // 箭頭長度的基準：預設滑桿值（V = 8、N = 400、B = 0.5）＋靜止 → I = V/R。
    // 用**固定常數**當基準，拉任何一個滑桿箭頭才會跟著變。
    const F_REF = 400 * 0.5 * (8 / 1.5);

    // 線圈的物理參數。A 是線圈面積：0.005 m² = 7.07 cm 見方，一個手掌大的
    // 示範線圈。R 是線圈電阻，1.5 Ω 對應「啟動電流 5.3 A」——這是這一頁
    // 要學生記住的數字。
    const COIL_A = 0.005;
    const COIL_R = 1.5;
    // 轉子的轉動慣量。**只有它決定「花多久轉到穩態」**（時間常數
    // J/((2/π·N·B·A)²/R + 負載)），不影響穩態轉速，所以它不是教學重點，
    // 挑一個「大約三秒收斂」的值就好。
    const INERTIA = 0.272;

    const T_END = 8;                    // 圖表橫軸

    const GRAPH = { x: 62, y: 536, w: 420, h: 232 };
    const BARS = { x: 524, y: 520, w: 340, h: 250 };
    const HIST_MAX = 900;

    const C_MECH = [22, 163, 74];       // 機械輸出（綠）
    const C_HEAT = [220, 38, 38];       // 發熱（紅）
    const C_SRC = [37, 99, 235];        // 電源（藍）

    const fmt = (v, d) => (Math.abs(v) < 1e-12 ? 0 : v).toFixed(d == null ? 2 : d);

    // ======================================================================
    // 物理：轉子的運動方程式
    // ======================================================================
    // J·dω/dt = τ_em − τ_load，而 τ_em 與 ε_back 都來自 MagneticKit.dcMotor()。
    // **反電動勢不是額外加上去的修正項，它是那一支函式回傳的其中一個欄位**——
    // 卡片上的 ε、圖上的電流、線圈感受到的轉矩全部是同一份計算的結果。
    let theta = 0.9, omega = 0;
    let lastT = -1, lastState = null, lastKey = '';
    let hist = [];                      // I(t) 的取樣，給左下那張圖

    function resetMotor() {
        theta = 0.9;                    // 從「斜的」開始，畫面上才看得出它在轉
        omega = 0;
        hist = [];
    }

    /** 一小步的積分。固定小步長，面板一次餵進來的 dt 才不會讓積分爆掉。 */
    function integrate(h, panel) {
        const m = MagneticKit.dcMotor({
            V: panel.V, R: COIL_R, N: panel.turns, B: panel.B, A: COIL_A,
            omega: omega, theta: theta, avg: true,
        });
        const net = m.torque - panel.load * omega;
        omega += net / INERTIA * h;
        if (omega < 0) omega = 0;       // 負載太重時只是不轉，不會倒轉
        theta += omega * h;
        if (theta >= TAU) theta -= TAU * Math.floor(theta / TAU);
    }

    function step(t, panel) {
        if (t === lastT && lastState) return lastState;

        // 動到任何一個滑桿就**重新啟動一次**。圖上那條曲線講的是「從靜止
        // 開始、電流被反電動勢壓下去」的過程，不重來的話它會停在舊參數的
        // 終點，跟現在的卡片數字對不起來。
        const key = panel.V + '|' + panel.B + '|' + panel.turns + '|' + panel.load;
        if (key !== lastKey) { resetMotor(); lastKey = key; }

        if (t !== lastT) {
            let dt = t - lastT;
            // 第一次進來、或時間跳了一大段（換頁、重設）就重來
            if (!(dt > 0) || dt > 0.4) { resetMotor(); dt = 0; }
            const H = 1 / 240;
            let left = dt, guard = 0;
            while (left > 1e-9 && guard++ < 400) {
                const h = Math.min(H, left);
                left -= h;
                integrate(h, panel);
            }
            lastT = t;
        }

        const m = MagneticKit.dcMotor({
            V: panel.V, R: COIL_R, N: panel.turns, B: panel.B, A: COIL_A,
            omega: omega, theta: theta, avg: true,
        });
        const pIn = panel.V * m.I;
        const stall = panel.V / COIL_R;

        // 只收前 T_END 秒。橫軸不隨時間長大，曲線就不會被慢慢壓扁在左邊——
        // 這一頁要看的是**啟動那幾秒**，不是跑十分鐘之後的樣子。
        if (t <= T_END && (hist.length === 0 || t - hist[hist.length - 1].x > 0.02)) {
            hist.push({ x: t, y: m.I });
            while (hist.length > HIST_MAX) hist.shift();
        }

        lastState = {
            m, theta, omega,
            rpm: omega * 60 / TAU,
            stall,
            pIn, pMech: m.mechPower, pHeat: m.I * m.I * COIL_R,
            eff: pIn > 1e-12 ? m.mechPower / pIn : 0,
            ratio: m.backEmf / panel.V,
            hist: hist.slice(),
            tEnd: T_END,
        };
        return lastState;
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    /**
     * 定子：左 N 右 S 兩塊磁極面，中間是均勻的水平磁場（由 N 指向 S，
     * 也就是從左到右）。
     *
     * ⚠️ 這一頁的磁場**不是**用 MagneticKit.fieldAt() 畫的。兩塊磁極面
     *    之間的場在模型裡是「均勻的」，用雙極模型去追磁力線反而不均勻
     *    （那是條形磁鐵的場，極在兩端、線會散開）。所以這裡畫的是等間距
     *    的平行箭頭——那正是這一頁假設的場。場的方向定義在畫面裡講清楚，
     *    不假裝它是別的地方算出來的。
     */
    function drawStator(p, view, S) {
        for (const [px, pole, col] of [[POLE_L, 'N', MagneticScene.C_NPOLE],
                                       [POLE_R, 'S', MagneticScene.C_SPOLE]]) {
            p.noStroke();
            p.fill(col[0], col[1], col[2]);
            p.rect(view.toScreenX(px - POLE_W / 2), view.toScreenY(AY - POLE_H / 2),
                   view.len(POLE_W), view.len(POLE_H));
            p.noFill();
            MagneticScene.strokeOn(p, MagneticScene.C_FIELD, view.len(2, 1.2));
            p.rect(view.toScreenX(px - POLE_W / 2), view.toScreenY(AY - POLE_H / 2),
                   view.len(POLE_W), view.len(POLE_H));
            p.noStroke();
            p.fill(255);
            p.textAlign(p.CENTER, p.CENTER);
            p.textStyle(p.BOLD);
            p.textSize(view.len(46, 22));
            p.text(pole, view.toScreenX(px), view.toScreenY(AY));
        }

        // 均勻場：等間距的水平箭頭，N → S
        const x0 = POLE_L + POLE_W / 2, x1 = POLE_R - POLE_W / 2;
        for (let y = AY - POLE_H / 2 + 34; y <= AY + POLE_H / 2 - 34; y += 62) {
            MagneticScene.arrow(p, view, x0, y, x1 - x0, 0,
                                MagneticScene.C_FIELD, { w: 1.6, head: 9 });
        }
        // ⚠️ 往上留 52 而不是 26：轉子上方的導體受力往上，箭頭最多伸到
        //    AY − COIL_W/2 − F_ARROW_MAX ≈ 65，標籤再往下就會被箭尖壓到。
        MagneticScene.worldBadge(p, view, (x0 + x1) / 2, AY - POLE_H / 2 - 52,
                                 '磁場 B 由 N 指向 S（水平、在畫面內）',
                                 { size: 13, col: MagneticScene.C_FIELD });

        // 轉軸
        MagneticScene.drawAxisLine(p, view, AX, AY, 0, 1,
                                   POLE_H / 2 + 26, { col: MagneticScene.C_AXIS });
    }

    /**
     * 兩條導體受的力 F = N·B·I·L。
     *
     * ⚠️ 方向**永遠是畫面的上下**。這不是偷懶：導體 ∥ 轉軸（ẑ）、磁場在畫面內
     *    （x̂），而 ẑ × x̂ = ŷ，所以受力只能沿著 ±ŷ。推導在 drawMotorCoil。
     *    兩條導體的電流反向 → 一個往上、一個往下 → 合起來才是力矩。
     *
     * 箭頭長度 ∝ N·B·I，基準是固定的常數 F_REF（= 預設滑桿值、靜止時的
     * N·B·I），所以拉 V／B／N／負載任何一個滑桿，箭頭都會跟著變。
     *
     * ⚠️ **刻意不從 τ 反推每一枝力**。模型回傳的 τ 帶了多段換向器的 2/π，
     *    拿 τ/(2·hw) 當「一枝力」會是「一半的物理加一半的湊數」；而且 hw 隨
     *    θ 變，箭頭長度會被 |sin θ| 綁住，跟著線圈一起伸縮。這一頁要看見的
     *    是「轉起來之後 I 掉下來、力也跟著縮」，直接畫 ∝ I 才是那件事。
     */
    function drawForces(p, view, panel, S, coil) {
        const len = Math.min(F_ARROW * (panel.turns * panel.B * S.m.I) / F_REF,
                             F_ARROW_MAX);
        if (len < 1.5) return;
        for (const [end, sgn] of [[coil.a, 1], [coil.b, -1]]) {
            MagneticScene.arrow(p, view, end.x, end.y,
                                coil.fdir.x * sgn * len, coil.fdir.y * sgn * len,
                                MagneticScene.C_FORCE, { w: 2.6, head: 11 });
        }
    }

    /**
     * 右下角的功率長條。**這一頁的證據就在這裡**：
     * 上面那根（電源 V·I）與下面兩根（機械 ε·I、發熱 I²R）等長，
     * 因為 V·I = ε·I + I²R 是恆等式，不是近似。
     */
    function drawPowerBars(p, view, S) {
        const rows = [
            { t: '電源輸入 V·I', v: S.pIn, col: C_SRC },
            { t: '機械輸出 ε·I', v: S.pMech, col: C_MECH },
            { t: '線圈發熱 I²R', v: S.pHeat, col: C_HEAT },
        ];
        const labelW = 132;                     // 左邊留給列名
        const maxW = BARS.w - labelW - 74;      // 右邊留給數值
        const scale = S.pIn > 1e-9 ? maxW / S.pIn : 0;
        const rowH = 30, gap = 26;

        MagneticScene.worldBadge(p, view, BARS.x + BARS.w / 2, BARS.y - 4,
                                 '功率去向：V·I = ε·I + I²R',
                                 { size: 14, col: [15, 23, 42] });

        rows.forEach((r, i) => {
            const y = BARS.y + 30 + i * (rowH + gap);
            p.noStroke();
            p.fill(241, 245, 249);
            p.rect(view.toScreenX(BARS.x + labelW), view.toScreenY(y),
                   view.len(maxW), view.len(rowH));
            p.fill(r.col[0], r.col[1], r.col[2]);
            p.rect(view.toScreenX(BARS.x + labelW), view.toScreenY(y),
                   view.len(Math.max(0, r.v * scale)), view.len(rowH));
            p.fill(51, 65, 85);
            p.textAlign(p.RIGHT, p.CENTER);
            p.textStyle(p.BOLD);
            p.textSize(view.len(14, 9));
            p.text(r.t, view.toScreenX(BARS.x + labelW - 10), view.toScreenY(y + rowH / 2));
            p.textAlign(p.LEFT, p.CENTER);
            p.fill(r.col[0], r.col[1], r.col[2]);
            p.text(fmt(r.v, 2) + ' W',
                   view.toScreenX(BARS.x + labelW + maxW + 10),
                   view.toScreenY(y + rowH / 2));
        });

        // 上面一根 = 下面兩根：把「機械 + 發熱」的接縫畫出來
        const yTop = BARS.y + 30, yBot = BARS.y + 30 + 2 * (rowH + gap);
        const splitX = BARS.x + labelW + S.pMech * scale;
        MagneticScene.dashed(p, view, splitX, yTop, splitX, yBot + rowH,
                             [100, 116, 139], { w: 1.5 });
        MagneticScene.worldBadge(p, view, splitX, yBot + rowH + 26,
                                 '兩根接縫 ＝ 上面那根', { size: 12, col: [100, 116, 139] });
    }

    function draw(p, view, t, panel, sol, S) {
        drawStator(p, view, S);

        // 轉子。**沿著轉軸看進去**——傳回去的 a、b 是兩條導體的位置，
        // fdir 是 a 那一端的受力方向，drawForces 直接用它們畫箭頭。
        const coil = MagneticScene.drawMotorCoil(p, view, {
            cx: AX, cy: AY, w: COIL_W, theta: S.theta,
        });
        drawForces(p, view, panel, S, coil);

        // 線圈的姿態。θ 是**線圈法線與 B 的夾角**——θ = 0（法線 ∥ B）就是
        // 換向的死點，也是力矩為零的地方。轉速不另外標：它已經在標題列了。
        MagneticScene.worldBadge(p, view, AX, AY + COIL_W / 2 + 34,
                                 'θ = ' + fmt(S.theta * 180 / Math.PI, 0) + '°（法線與 B 的夾角）');

        MagneticScene.drawGraph(p, view, {
            x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
            xMin: 0, xMax: S.tEnd, yMin: 0,
            yMax: Math.max(S.stall * 1.15, 1e-6),
            xLabel: '時間 t', xUnit: 's',
            yLabel: '電流 I', yUnit: 'A',
            title: '啟動電流最大，轉起來就被反電動勢壓下去',
            xTicks: 4, yTicks: 4,
            lines: [
                { from: { x: 0, y: S.stall }, to: { x: S.tEnd, y: S.stall },
                  col: C_HEAT, dash: true, label: '啟動電流 V/R' },
            ],
            series: [{ pts: S.hist, col: C_SRC, join: true }],
            marker: { x: t, y: S.m.I, col: C_HEAT },
        });

        drawPowerBars(p, view, S);
    }

    // ======================================================================
    // 介面
    // ======================================================================
    MagneticScene.run({
        // ⚠️ 三個式子**排成三列**，不要擠成一列。側欄只有 ~300 px 寬，
        //    而 KaTeX 的 display 公式不會換行——擠成一列的話第三個式子會
        //    溢出底色之外被畫布蓋掉，畫面上只會覺得「公式好像少了一個」。
        formula: '\\begin{aligned}'
               + '&\\varepsilon_{\\text{back}} = NBA\\omega \\\\'
               + '&I = \\dfrac{V - \\varepsilon_{\\text{back}}}{R} \\\\'
               + '&VI = \\varepsilon I + I^2R'
               + '\\end{aligned}',
        formulaFallback: 'ε_back = NBAω　　I = (V − ε_back) / R　　VI = εI + I²R',

        controls: {
            sliders: [
                { key: 'V',     label: '電源電壓 V',   min: 2,   max: 12,  step: 0.5, def: 8,    unit: 'V',  dec: 1 },
                { key: 'B',     label: '磁場 B',       min: 0.2, max: 1.0, step: 0.05, def: 0.5, unit: 'T',  dec: 2 },
                { key: 'turns', label: '線圈匝數 N',   min: 100, max: 600, step: 20, def: 400,  unit: '匝', dec: 0 },
                { key: 'load',  label: '負載（摩擦）', min: 0.02, max: 0.5, step: 0.01, def: 0.08, unit: '', dec: 2 },
            ],
        },

        cards: [
            { label: '電流 I', id: 'cardI', unit: 'A', highlight: true },
            { label: '反電動勢 ε', id: 'cardEmf', unit: 'V', highlight: true },
            { label: '轉速', id: 'cardRpm', unit: 'rpm' },
            { label: '電磁轉矩 τ', id: 'cardTau', unit: 'N·m' },
            { label: '機械功率 ε·I', id: 'cardPmech', unit: 'W' },
            { label: '發熱功率 I²R', id: 'cardPheat', unit: 'W' },
            { label: '電源功率 V·I', id: 'cardPin', unit: 'W' },
            { label: '效率 ε/V', id: 'cardEff', unit: '' },
            { label: '啟動電流 V/R', id: 'cardStall', unit: 'A' },
            { label: '線圈電阻 R', id: 'cardR', unit: 'Ω' },
        ],

        model: step,

        values(t, panel, sol, S) {
            return {
                cardI: fmt(S.m.I, 3),
                cardEmf: fmt(S.m.backEmf, 2),
                cardRpm: fmt(S.rpm, 0),
                cardTau: fmt(S.m.torque, 3),
                cardPmech: fmt(S.pMech, 2),
                cardPheat: fmt(S.pHeat, 2),
                cardPin: fmt(S.pIn, 2),
                cardEff: (S.eff * 100).toFixed(1) + ' %',
                cardStall: fmt(S.stall, 2),
                cardR: fmt(COIL_R, 1),
            };
        },

        titleText(t, panel, S) {
            return 'V = ' + fmt(panel.V, 1) + ' V'
                 + '　I = ' + fmt(S.m.I, 2) + ' A（啟動時 ' + fmt(S.stall, 2) + ' A）'
                 + '　ε_back = ' + fmt(S.m.backEmf, 2) + ' V'
                 + '　' + fmt(S.rpm, 0) + ' rpm'
                 + '　機械功率 = 電功率 = ' + fmt(S.pMech, 2) + ' W';
        },

        draw,
    });

    if (typeof window !== 'undefined') {
        window.__page = {
            AX, AY, COIL_A, COIL_R, INERTIA, T_END,
            integrate, step, resetMotor,
            getTheta() { return theta; },
            setTheta(v) { theta = v; },
            getOmega() { return omega; },
            setOmega(v) { omega = v; },
            getHist() { return hist.slice(); },
        };
    }
})();
