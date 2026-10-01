/**
 * ☀️ 熱輻射
 *
 * 四個一模一樣的罐子、裝一樣多的水、從一樣的溫度開始，只有**表面處理**
 * 不一樣：啞黑漆、白漆、灰色漆、拋光鋁。它們在同一個房間裡冷卻，只靠
 * **輻射**散熱。看哪一個先涼。
 *
 * ══════════════════════════════════════════════════════════════════════
 * 這一頁要打掉的三個直覺
 * ══════════════════════════════════════════════════════════════════════
 *
 * ① **「白色會把熱反射回來，所以降得慢」——錯。**
 *    決定熱輻射快慢的是**紅外線的發射率**，不是眼睛看到的顏色。白漆在
 *    紅外線裡是很好的發射體（ε ≈ 0.90），和黑漆（0.95）幾乎一樣快。
 *    這一頁把兩條曲線畫在一起讓它們**幾乎重疊**，就是要講這件事。
 *    （見 SURFACES 的白漆 ε = 0.90。）
 *
 * ② **「拋光鋁那麼亮，應該很會輻射吧」——錯。** ε = 0.05，是黑漆的 1/19。
 *    它幾乎不輻射，所以幾乎不降溫。保溫瓶做成鏡面就是這個道理。
 *
 * ③ **「溫差越大降得越快」對，但快多少不是線性的。**
 *    P = εσA(T⁴ − T_s⁴) 是**四次方差**。90 °C 的水和 20 °C 的房間，
 *    T⁴ 差了 2.36 倍——不是 (363−293) 的某個倍數。
 *
 * ══════════════════════════════════════════════════════════════════════
 * 這一頁只算輻射，不算對流與傳導
 * ══════════════════════════════════════════════════════════════════════
 * 真實的罐子還會經由空氣的**對流**（罐壁加熱空氣、空氣上升帶走熱）和
 * 墊在桌上的**傳導**散熱，那兩條路和表面塗什麼**幾乎無關**。所以真實
 * 實驗裡四個罐子的差距會比這一頁小得多——這一頁畫的是「只留下輻射」
 * 那個乾淨的對照。**不要拿這裡的溫差去預測真實的保溫瓶。**
 * （md 的〈物理知識〉把這件事講清楚了。）
 */

(function () {
    const K = ThermalKit.KELVIN;

    // ======================================================================
    // 邏輯世界（900×900，見 lab-scene.js）
    // ======================================================================
    const SLOT_X = 150;                 // 四格從 150 排到 750
    const SLOT_W = 150;
    const CAN = { y: 175, h: 220, w: 84 };
    /**
     * 溫度計**插在罐子裡**，不是擺在罐子旁邊。
     *
     * ⚠️ 一開始是「罐子擺左邊、溫度計擺右邊」的並排版。結果是四個罐子
     *    的輻射射線全部打在隔壁那支溫度計上：罐子右緣到溫度計只有 11 個
     *    世界單位，而射線最長 30 個——畫面上四支溫度計被八條射線穿刺，
     *    看起來像壞掉。插進罐子裡就沒有這個問題（整格橫向都空的），
     *    而且更像真的實驗：水裡插一支溫度計。
     *
     * ⚠️ 但是**不能插在正中央**：n = 10 的射線裡有一條正好往正上方，
     *    會從罐頂沿著中心線穿過管子。偏移 22 個單位剛好讓開。
     */
    const TH_DX = 22;                   // 溫度計相對罐子中心的偏移
    const TH_H = 230;                   // 溫度計的管長
    const LABEL_Y = 105;                // 罐子上方的名稱
    const P_Y = 428;                    // 罐子下方的輻射功率
    const NOTE_Y = 464;                 // 一句話總結
    const GRAPH = { x: 150, y: 545, w: 600, h: 230 };

    // ======================================================================
    // 物理
    // ======================================================================
    const SURFACE_ORDER = ['black', 'white', 'grey', 'polished'];

    const A_CAN = 0.05;                 // 罐子表面積 0.05 m²
    const M_CAN = 0.15;                 // 裡面的水 150 g
    const C_WATER = 4186;               // J/(kg·K)
    const T_ROOM = 20;                  // 房間溫度 °C（固定，不給調）

    const T0 = { min: 50, max: 100, def: 90 };      // 起始水溫 °C
    const T_LO = 0, T_HI = 100;                     // 溫度計與圖的縱軸範圍 °C
    const SPAN_MIN = 60;                            // 圖的橫軸：60 分鐘
    const SPAN_S = SPAN_MIN * 60;                   // ＝3600 秒，跑到這裡就停

    // 時間壓縮。真實的降溫是「幾十分鐘」等級，不壓縮的話沒人看得完，
    // 但 ×1 要留著——學生要能自己確認「真實世界真的這麼慢」。
    const SPEEDS = [
        { v: '1',    t: '×1　真實時間（看得到它幾乎不動）' },
        { v: '60',   t: '×60　畫面 1 秒 = 1 分鐘' },
        { v: '300',  t: '×300　畫面 1 秒 = 5 分鐘' },
        { v: '1200', t: '×1200　畫面 1 秒 = 20 分鐘' },
    ];

    const STEP_MAX = 15;                // 一次 RK4 最多走 15 物理秒
    /**
     * 每 30 物理秒記一個資料點。
     *
     * ⚠️ 不能記得太密。`drawGraph` 的資料點**沒有辦法關掉**——它寫的是
     *    `L(view, s.r || 3.5, 2)`，`r: 0` 是 falsy，會落回預設的 3.5，
     *    而 3.5 又大於最小像素 2，所以半徑一定是 2 px 以上。60 分鐘記
     *    20 秒一筆的話是 180 筆，點與點的間距不到 4 px，四條曲線會變
     *    四條粗緞帶，線反而看不見了。
     *    30 秒一筆 = 每條 121 點、間距 5 px，剛好是「沿著線的點」。
     */
    const REC_MIN = 30;

    /**
     * 圖的兩軸範圍與刻度數。
     *
     * ⚠️ 兩軸的刻度都挑成**整數**：`drawGraph` 的 `trim()` 對 ≥10 的值用
     *    `toFixed(0)`，所以 3.5 會印成「4」——格線和標籤會對不上，圖上
     *    多出一組**假刻度**。60/6 = 10 和 100/5 = 20 都是整數。
     *
     * ⚠️ 必須宣告在 `SPAN_MIN` / `T_LO` / `T_HI` **之後**。寫在檔頭的話
     *    是 TDZ（`Cannot access 'SPAN_MIN' before initialization`），
     *    整頁當場白畫面——而這是 `const`，不是 `undefined`，所以連
     *    「值是 NaN」那種看得出來的症狀都沒有。
     *    獨立宣告（不寫成 drawGraph 的行內參數）是為了讓 verify-thermal.js
     *    能直接讀到它做斷言。
     */
    const AXES = {
        xMin: 0, xMax: SPAN_MIN, yMin: T_LO, yMax: T_HI,
        xTicks: 6, yTicks: 5,
    };

    /**
     * 四種表面的**畫線顏色**。
     *
     * ⚠️ 這一頁有兩套顏色，各有各的工作，不要混：
     *    罐子的**填色** = 表面的長相（黑漆是黑的、白漆是白的），那是自變數
     *    曲線的**線色**   = 下面這四個，用來把「罐子」和「曲線」連起來
     *    溫度       = 溫度計的水銀柱（唯一顯示溫度的地方）
     *
     *    白漆的曲線不能用白色——白底上看不見。所以它借了藍色。
     */
    const LINE_COL = {
        black:    [17, 24, 39],
        white:    [37, 99, 235],
        grey:     [22, 163, 74],
        polished: [217, 119, 6],
    };

    /** 罐子塗料的**外觀**色（不是溫度、也不是線色）。 */
    const PAINT = {
        black:    [26, 26, 30],
        white:    [248, 250, 252],
        grey:     [156, 163, 175],
        polished: [203, 213, 225],
    };

    const SLOT_CX = i => SLOT_X + SLOT_W * (i + 0.5);

    // ======================================================================
    // 狀態
    // ======================================================================
    // ⚠️ 物理狀態住在**頁面**裡，不住在 model() 裡：model() 每一幀都被叫，
    //    它只能回報「現在幾度」，不能自己往前推——往前推的時機在 onFrame。
    let TK = {};                 // key → 現在的水溫（K）
    let trace = {};              // key → [{t, T}]，t 是物理秒、T 是 K
    let physTime = 0;            // 已過的**物理**時間（秒）
    let lastSim = 0;             // 上一幀的畫面時間
    let lastRec = -1e9;          // 上一次記錄資料點的物理時間
    let panelRef = null;         // ⚠️ onReset(reason) 拿不到 panel，見熱傳導那一頁

    function reset(panel) {
        TK = {};
        trace = {};
        for (const k of SURFACE_ORDER) {
            TK[k] = panel.t0 + K;
            trace[k] = [{ t: 0, T: TK[k] }];
        }
        physTime = 0;
        lastSim = 0;
        lastRec = 0;
    }

    /** 這一頁的物理常數＋面板 → 一份算好的東西，畫面與卡片都吃它。 */
    function propsFor(panel) {
        const ts = parseFloat(panel.speed) || 1;
        const T0K = panel.t0 + K;
        const TsK = T_ROOM + K;
        // 射線長度的參考值：ε = 1、而且還在起始溫度時會有多少功率。
        // 除以它，長度就剛好**起頭等於 ε**，之後隨降溫一起縮。
        const Pref = ThermalKit.SIGMA * A_CAN * (Math.pow(T0K, 4) - Math.pow(TsK, 4));
        const cans = SURFACE_ORDER.map((k, i) => {
            const s = ThermalKit.SURFACES[k];
            const T = TK[k] == null ? T0K : TK[k];
            const P = ThermalKit.stefanPower({ eps: s.eps, A: A_CAN, T, Ts: TsK });
            return {
                key: k, i, name: s.name, eps: s.eps,
                cx: SLOT_CX(i), T, P, f: Pref > 0 ? P / Pref : 0,
            };
        });
        return { ts, T0K, TsK, Pref, cans, physTime, t0: panel.t0 };
    }

    const can = (pr, k) => pr.cans.find(c => c.key === k);

    // ======================================================================
    // 數字格式化
    // ======================================================================
    function fmtP(P) {
        if (!(P > 0)) return '0';
        if (P >= 100) return P.toFixed(0);
        if (P >= 10) return P.toFixed(1);
        if (P >= 1) return P.toFixed(2);
        return P.toFixed(3);
    }

    /**
     * 時間壓縮講成人話。
     *
     * ⚠️ 回傳的字串要接在「畫面 1 秒 ≈ 」後面，所以填的是**物理秒數**
     *    （`ts` 的定義就是這個），不是壓縮倍率的倒數。標題列曾經印成
     *    「畫面 1 秒 ≈ ×300（1 秒 ≈ 5 分鐘）」——同一句話裡把倍率和
     *    時長混在一起講，讀起來是壞的。控制面板的下拉選項自己會寫
     *    「×300」，那是倍率，它有自己的措辭，不要跟這裡混。
     */
    function fmtSpeed(ts) {
        if (ts <= 1.001) return '真實時間';
        if (ts < 90) return `真實 ${ts.toFixed(0)} 秒`;
        if (ts < 5400) return `真實 ${(ts / 60).toFixed(0)} 分鐘`;
        return `真實 ${(ts / 3600).toFixed(1)} 小時`;
    }

    function fmtClock(s) {
        if (s < 90) return s.toFixed(0) + ' 秒';
        if (s < 5400) return (s / 60).toFixed(s < 600 ? 1 : 0) + ' 分鐘';
        return (s / 3600).toFixed(1) + ' 小時';
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    /** 罐子：填色是塗料的外觀，外框是曲線的顏色。 */
    function drawCan(p, view, x, y, w, h, fill, edge) {
        const px = view.toScreenX(x), py = view.toScreenY(y);
        const pw = ThermalScene.L(view, w), ph = ThermalScene.L(view, h);
        p.noStroke();
        p.fill(fill[0], fill[1], fill[2]);
        p.rect(px, py, pw, ph);
        // 頂蓋：一條深色帶。四個罐子都一樣，強調「差別只在側面」。
        p.fill(100, 116, 139);
        p.rect(px, py, pw, ThermalScene.L(view, 12));
        ThermalScene.strokeOn(p, edge, ThermalScene.L(view, 3, 2));
        p.noFill();
        p.rect(px, py, pw, ph);
    }

    /**
     * 罐子往四面八方輻射出去的射線。
     *
     * ⚠️ 射線**從罐子的邊界出發**，不是從中心——從中心畫的話，內側那一段
     *    會被罐子自己蓋掉，看起來像浮在罐子上的箭頭。
     *
     * ⚠️ 條數**固定**、只有**長度**隨功率變（見 thermal-scene.js 的
     *    drawGlow 註解）：條數一變，學生會以為「輻射出更多種射線」。
     */
    function drawRays(p, view, x, y, w, h, f, col) {
        const cx = x + w / 2, cy = y + h / 2, hw = w / 2, hh = h / 2;
        const n = 10;
        // ⚠️ 最短也留 2 個世界單位。ε = 0.05 的拋光鋁「幾乎沒有」是對的，
        //    但不能真的沒有——畫面上看不到東西會被當成壞掉（而不是當成
        //    「它真的不輻射」）。反正箭頭本身有 5 個單位長，再短也看得見
        //    一小截探出來。
        //    留 5 的話四支會變得太像：跑 50 分鐘之後四支功率是
        //    3.0 / 3.1 / 3.8 / 1.2 W，差值被地板吃掉，四支射線一樣長——
        //    編碼就**安靜地失效**了。
        //
        // ⚠️ 最長 30 不是隨便挑的。格子寬 150、罐子半寬 42，所以相鄰兩罐
        //    的邊緣相距 66 個單位。射線最長 30 的話，左罐往右伸到 +72、
        //    右罐往左伸到 +78——剛好**錯開**。最長 36 的話兩邊會在中間
        //    交叉，四個罐子的射線攪成一團。
        const len = 2 + 28 * Math.max(0, Math.min(1, f));
        for (let i = 0; i < n; i++) {
            const a = 2 * Math.PI * i / n + Math.PI / n;
            const dx = Math.cos(a), dy = Math.sin(a);
            const k = Math.min(hw / Math.max(1e-9, Math.abs(dx)),
                               hh / Math.max(1e-9, Math.abs(dy)));
            ThermalScene.arrow(p, view,
                cx + dx * k, cy + dy * k, dx * len, dy * len,
                col, { w: 1.6, head: 5 });
        }
    }

    /** 名稱＋ε 的標籤，前面綴一小塊曲線顏色，把罐子和曲線連起來。 */
    function drawLabel(p, view, x, y, text, lineCol) {
        const cx = view.toScreenX(x), cy = view.toScreenY(y);
        p.noStroke();
        p.fill(lineCol[0], lineCol[1], lineCol[2]);
        const s = ThermalScene.L(view, 11);
        p.rect(cx - s / 2, cy - s / 2, s, s);
        ThermalScene.worldBadge(p, view, x + ThermalScene.L(view, 12, 7),
                                y, text, { size: 13, col: lineCol });
    }

    function drawGraph(p, view, pr) {
        const series = SURFACE_ORDER.map(k => ({
            pts: trace[k].map(q => ({ x: q.t / 60, y: q.T - K })),
            col: LINE_COL[k], r: 0, join: true,
        }));
        ThermalScene.drawGraph(p, view, {
            x: GRAPH.x, y: GRAPH.y, w: GRAPH.w, h: GRAPH.h,
            ...AXES,
            xLabel: '時間', xUnit: '分鐘',
            yLabel: '水溫', yUnit: '°C',
            title: '四個罐子的降溫曲線（只靠輻射散熱）',
            series,
        });
    }

    ThermalScene.run({
        // ⚠️ 兩個公式**要疊成兩行**，不能並排。並排（`\\qquad` 接起來）的話
        //    整條比面板寬，KaTeX 不會自己縮，第二個公式會被右邊界切掉——
        //    而畫面上的症狀只是「公式少了一半」，其他一切正常。
        formula: '\\begin{aligned}'
               + 'P &= \\varepsilon\\,\\sigma\\,A\\left(T^{4} - T_{s}^{4}\\right) \\\\[2pt]'
               + '\\frac{dT}{dt} &= -\\frac{P}{mc}'
               + '\\end{aligned}',

        formulaFallback: 'P = εσA(T⁴ − T_s⁴)　　dT/dt = −P/(mc)',

        controls: {
            selects: [
                // live: true → 換播放速度**不會**清掉資料點。
                // 溫度是真的已經降下去了，按快轉不該讓它跳回原點——
                // 這和「顯示」下拉是同一類控制（換的是看法，不是實驗條件）。
                // 起始水溫不一樣：那是實驗條件，改了就是要重做，所以不給 live。
                { key: 'speed', label: '時間壓縮', def: '300',
                  live: true, options: SPEEDS },
            ],
            sliders: [
                { key: 't0', label: '起始水溫 T₀', def: T0.def,
                  min: T0.min, max: T0.max, step: 1, unit: '°C', dec: 0 },
            ],
        },

        cards: [
            { label: '啞黑漆 水溫', id: 'cardBlackT', unit: '°C', highlight: true },
            { label: '拋光鋁 水溫', id: 'cardPolishT', unit: '°C', highlight: true },
            // ⚠️ 標籤一定要寫出方向。啞黑漆最後會**比拋光鋁冷**（跑滿
            //    60 分鐘時黑漆 31 °C、鋁 82 °C），所以這個數是負的。
            //    只寫「兩罐溫差」的話，學生看到 −51 K 會以為算錯了。
            { label: '溫差（黑 − 鋁）', id: 'cardGap', unit: 'K' },
            { label: '啞黑漆 淨輻射功率', id: 'cardBlackP', unit: 'W' },
            { label: '拋光鋁 淨輻射功率', id: 'cardPolishP', unit: 'W' },
            { label: '功率比（黑 ÷ 鋁）', id: 'cardRatio', unit: '×' },
            { label: '環境溫度', id: 'cardRoom', unit: '°C' },
            { label: '已過時間（真實）', id: 'cardClock', unit: '' },
        ],

        model(t, panel) {
            panelRef = panel;
            return propsFor(panel);
        },

        /**
         * 每一幀把四個罐子往前推。
         *
         * ⚠️ 走的是**物理時間** `dt · ts`，而且自己切子步：×1200 的時候
         *    一幀就是 20 物理秒，直接丟給 RK4 會讓四個罐子一起偏低
         *    （降溫率對 T 的敏感度是 T³，步長太大時誤差是系統性的）。
         */
        onFrame(t, panel) {
            const dt = Math.min(0.1, Math.max(0, t - lastSim));
            lastSim = t;
            const pr = propsFor(panel);
            // ⚠️ 跑滿 60 分鐘就停。圖的橫軸只有到 60 分鐘，不停的話會出現
            //    「圖上的點全部擠在左邊 60 分鐘、卡片卻說已經過了 2.2 小時」
            //    ——兩邊在講不同的時間，學生只會覺得有一邊壞了。
            //    停下來之後上面的橫幅會換成結束訊息，所以不會像當掉。
            if (physTime >= SPAN_S) return;
            let remain = Math.min(dt * pr.ts, SPAN_S - physTime);
            if (!(remain > 0)) return;
            while (remain > 1e-9) {
                const step = Math.min(STEP_MAX, remain);
                remain -= step;
                for (const c of pr.cans) {
                    TK[c.key] = ThermalKit.coolingStep(TK[c.key], {
                        eps: c.eps, A: A_CAN, m: M_CAN, c: C_WATER, Ts: pr.TsK,
                    }, step);
                }
                physTime += step;
                if (physTime - lastRec >= REC_MIN - 1e-9) {
                    lastRec = physTime;
                    for (const c of pr.cans) {
                        trace[c.key].push({ t: physTime, T: TK[c.key] });
                    }
                }
            }
        },

        values(t, panel, pr) {
            const b = can(pr, 'black'), w = can(pr, 'polished');
            return {
                cardBlackT: (b.T - K).toFixed(1),
                cardPolishT: (w.T - K).toFixed(1),
                cardGap: (b.T - w.T).toFixed(2),
                cardBlackP: fmtP(b.P),
                cardPolishP: fmtP(w.P),
                cardRatio: w.P > 0 ? (b.P / w.P).toFixed(1) : '—',
                cardRoom: T_ROOM.toFixed(0),
                cardClock: fmtClock(physTime),
            };
        },

        titleText(t, panel, pr) {
            const b = can(pr, 'black'), w = can(pr, 'polished');
            return `☀️ 熱輻射　起始 ${panel.t0} °C　環境 ${T_ROOM} °C`
                 + `　畫面 1 秒 ≈ ${fmtSpeed(pr.ts)}`
                 + `　啞黑漆 ${(b.T - K).toFixed(1)} °C ／ 拋光鋁 ${(w.T - K).toFixed(1)} °C`
                 + `　只算輻射`;
        },

        onReset() { reset(panelRef); },

        draw(p, view, t, panel, pr) {
            // --- 頂部橫幅：開頭是說明，跑滿 60 分鐘後換成結束訊息 ---
            const done = pr.physTime >= SPAN_S;
            ThermalScene.worldBadge(p, view, 450, 54, done
                ? `⏹ 60 分鐘到（圖的橫軸滿了）——按重設 RESET 可以重跑一次`
                : '四個罐子：一樣的水、一樣多的量、一樣的起始溫度——只有表面不同',
                { size: 14, col: done ? [220, 38, 38] : [100, 116, 139] });

            // --- 四個罐子 ---
            for (const c of pr.cans) {
                const line = LINE_COL[c.key];
                const col = ThermalScene.tempColor(c.T - K, T_LO, T_HI);
                const top = CAN.y, cx = c.cx - CAN.w / 2;

                drawRays(p, view, cx, top, CAN.w, CAN.h, c.f, col);
                drawCan(p, view, cx, top, CAN.w, CAN.h, PAINT[c.key], line);
                drawLabel(p, view, SLOT_CX(c.i), LABEL_Y,
                          `${c.name}　ε = ${c.eps.toFixed(2)}`, line);

                // 溫度計插在罐子裡：球泡沉在水底附近、管子從罐口伸出來。
                // 這是這一頁**唯一**顯示溫度的地方（罐身的顏色是塗裝，
                // 不是溫度——四個罐子的塗裝從頭到尾不變）。
                ThermalScene.drawThermometer(p, view, SLOT_CX(c.i) + TH_DX,
                    top + CAN.h - 25, TH_H, c.T - K, T_LO, T_HI,
                    { bulb: 13, tube: 12, label: false, dec: 1 });

                ThermalScene.worldBadge(p, view, SLOT_CX(c.i), P_Y,
                    `P = ${fmtP(c.P)} W`, { size: 12, col: line });
            }

            // --- 目前為止的差距 ---
            // 還沒開始跑的時候不要印「已降 0.0 K」，那看起來像壞掉。
            const b = can(pr, 'black'), w = can(pr, 'polished');
            const note = pr.physTime <= 0
                ? '按開始 START，看四條曲線怎麼從同一個點分開'
                : `啞黑漆已降 ${(pr.T0K - b.T).toFixed(1)} K，`
                  + `拋光鋁只降 ${(pr.T0K - w.T).toFixed(1)} K`
                  + '　——　亮不代表不吸熱，亮代表不輻射';
            // ⚠️ worldBadge 畫的是純文字，不吃 markdown。在這裡寫 **粗體**
            //    會原樣印出兩顆星號。
            ThermalScene.worldBadge(p, view, 450, NOTE_Y, note,
                { size: 13, col: [220, 38, 38] });

            drawGraph(p, view, pr);
        },
    });

    // ======================================================================
    // 給 headless 探針用的出口
    // ======================================================================
    if (typeof document !== 'undefined') reset({
        t0: T0.def, speed: '300',
    });
    if (typeof window !== 'undefined') {
        window.__page = {
            GRAPH, AXES, CAN, SLOT_CX, SURFACE_ORDER, LINE_COL, PAINT,
            A_CAN, M_CAN, C_WATER, T_ROOM, T0, SPAN_S, REC_MIN, STEP_MAX,
            propsFor, fmtP, fmtSpeed, fmtClock,
            physTime: () => physTime,
            traceOf: k => trace[k].map(q => [q.t, q.T - K]),
            reset,
        };
    }
})();
