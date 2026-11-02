/**
 * 📈 波形圖與振動圖 — 同一個正弦，兩種橫軸
 *
 * 這一頁要學生分清楚兩張長得幾乎一樣的圖：
 *
 *   波形圖 y–x  橫軸是**位置**，畫的是**某一瞬間、繩上每一顆質點**的位移
 *   振動圖 y–t  橫軸是**時間**，畫的是**某一顆質點、所有時間**的位移
 *
 * 兩張都是正弦曲線，很容易看成一張圖的兩種畫法。實際上它們的橫軸正交：
 * 波形圖是「時間停住、把整條繩子看一遍」，振動圖是「位置固定、把時間看一遍」。
 * 兩個方向都可以互相推理——波形圖往哪邊跑決定質點往哪邊動，振動圖的
 * **斜率**就是質點的速度——這是這一頁的核心。
 *
 * ⚠️ 這一頁**沒有波前**。波一開始就鋪滿整條繩子（理想的行進波），
 *    因為振動圖要畫「最近 4 秒」的歷史，有波前的話前半段是一片空白。
 *
 * ⚠️ 換方向的那一刻，「相位時間」τ 必須**接得上**（見下面 advancePhase）。
 *    直接讓 y = A sin(k(x − dir·v·t)) 的話，切換的瞬間整條波形會跳一下
 *    （波形圖與振動圖會同時被攔腰折斷），而所有數值斷言照樣全綠。
 */
// ==========================================================================
// 這一頁的版面（世界單位）
// --------------------------------------------------------------------------
// 兩張圖上下堆疊，橫軸都吃滿整條繩子的寬度（ropeX(0) → ropeX(ROPE_M)），
// 所以兩張圖的左右邊界必然對齊——那是這一頁看起來「像一組圖」的原因。
//
// ⚠️ 整組由上而下落在可用高度（0–812）的中間。**「整組一起平移」不會有
//    任何守門員**（所有版面斷言都是相對的），所以在 verify-waves.js ㉔ 裡
//    有一條指名道姓量中心位置的正反斷言。
// ==========================================================================
const WVR_TOP_T = 60,  WVR_TOP_B = 354, WVR_TOP_Z = 207;   // 波形圖的框與零線
const WVR_XTICK_Y = 368;                                    // 波形圖的 x 刻度文字
const WVR_BOT_T = 422, WVR_BOT_B = 716, WVR_BOT_Z = 569;   // 振動圖的框與零線
const WVR_TTICK_Y = 730;                                    // 振動圖的時間刻度文字
const WVR_NOTE_Y  = 766;                                    // 底部那一行結論

/** 垂直放大：世界單位 / 公分。A 最大 8 cm → ±120，框的半高是 147。 */
const WVR_AMP_SCALE = 15;

/** 質點數。32 顆 = 每 0.25 m 一顆，點選時格點夠密、畫面又不會糊成一片。 */
const WVR_BEAD_N = 32;

/** 振動圖的時間窗（秒）。固定不隨 f 縮放——理由同 string-wave-basics：
 *  窗寬跟著 f 跑的話，改頻率時整張圖看起來一模一樣，「頻率變了」就看不見。 */
const WVR_WINDOW = 4;

/**
 * 振動圖右邊那一段留白（秒），與切線的半長（秒）。
 *
 * ⚠️ 這一對常數是為了一個**只有截圖看得出來**的缺陷而存在的。
 *    標記點是「現在」，而滾動視窗的右緣**就是**現在——`xOf(t)` 於是恰好
 *    等於 `gr`（框的右緣），紅點與切線便各有一半落在 `ctx.clip()` 的框外
 *    被靜默切掉：畫面上是一條陡線硬生生停在框邊，紅點變成半個圓。
 *    `errs=0`、爆框 0、卡片數字全對、**所有數值斷言照樣全綠**。
 *
 *    所以時間軸的右端不再貼著框的右緣，中間留 `WVR_NOW_LEAD` 秒。
 *    那一條帶子裡不畫格線、不畫曲線、也沒有刻度——那裡根本還沒有資料，
 *    它是「框比時間軸長出來的部分」。切線因此能以標記點為中心對稱地畫滿，
 *    而右端還離框邊 `(NOW_LEAD − TAN_HALF)` 秒的餘裕。
 *
 * ⚠️ `WVR_TAN_HALF` 必須 < `WVR_NOW_LEAD`，否則切線的右端又會頂到框邊
 *    （那正是這個缺陷的本體）。verify-waves.js ㉖ 有兩條在守它：
 *    一條量行為（切線與紅點在三個尺度下都落在框裡），一條量常數。
 * ⚠️ 兩個值都是**秒**，換算成像素要乘 `pxPerSec`——這樣改 f 或改窗寬時
 *    留白的「時間長度」不變，切線永遠是固定的一段時間。
 */
const WVR_NOW_LEAD = 0.45;
const WVR_TAN_HALF = 0.30;

/** 速度箭頭的最大長度（世界單位），對應 |v_y| = Aω。 */
const WVR_ARROW_W = 34;

/**
 * 「波往右跑 →」那支箭頭的位置（起點公尺數、世界 y）。
 *
 * ⚠️ 它和兩張圖的標題**共用框上方那一條 60 單位高的帶子**：標題的底線在
 *    `框頂 − 8`、字級 `view.len(15, 9)`，而這支箭頭更上面。三個東西擠在
 *    同一個 60 單位裡，所以位置是**量出來的**：
 *
 *    - 箭頭長 `view.len(90, 36)`，起點 6.6 m 時箭尖落在世界 886——剛好從
 *      右邊那行「橫軸＝位置 x (m)」的**字裡面**穿過去（1100 px 時兩者的
 *      像素間隔只有 1～2 px，讀起來就是壓在字上）。
 *    - 起點 5.2 m → 箭頭落在世界 [642, 732]，離那行標題的左緣還有 60 個
 *      世界單位以上（**水平**分開是主要的保險，不是靠那幾像素的垂直間隙）。
 *    - y = 32 是**量出來的**：標籤畫在箭身上方 `view.len(7,4)` 處，字級
 *      `view.len(15,9)`，所以標籤的字頂在世界 `32 − 8 − 1.2·18 ≈ 2`——
 *      再高一點，窄尺度下那行字就會頂出世界的上緣被裁掉。
 *
 *    ⚠️ 字級下限（9 px）在窄尺度下把字**放大**，所以最窄的尺度是最壞情況；
 *    verify-waves.js ㉔ 用保守字框在 `scale = 0.5` 與 `0.825` 下各量一次。
 */
const WVR_ARROW_XM = 5.2, WVR_ARROW_Y = 32;

/** 預設追蹤的質點位置（公尺）。3.0 m 剛好落在第 12 顆（格點上，不會有偏差）。 */
const WVR_X0 = 3.0;

/**
 * 這一頁把波速寫死。波速由誰決定是 04 那一頁的事，這一頁要專心處理
 * 「兩張圖的橫軸」——多一個滑桿只會多一個讓學生分心的東西。
 *
 * ⚠️ v 與 f 的範圍是**一起挑的**，不能各自決定：
 *    看得見的波長數 = ROPE_M ÷ (v/f)，波長 = v/f，
 *    v = 2.0、f ∈ [0.5, 1.25] → λ ∈ [4.0, 1.6] m → 繩上 2.0～5.0 個波長。
 *    同時窗裡有 4f ∈ [2.0, 5.0] 個週期。
 *    兩邊都落在「看得出來它在幹嘛」的範圍裡。
 */
const WVR_V = 2.0;
const WVR_F_MIN = 0.5, WVR_F_MAX = 1.25, WVR_F_DEF = 0.75;
const WVR_A_MIN = 1,   WVR_A_MAX = 8,    WVR_A_DEF = 4;
const WVR_DIR_DEF = '1';

/**
 * 這一頁自己的純物理。不碰 DOM，Node 抓進去就能逐位斷言。
 *
 * 波形本身是標準的 A sin(k(x − vτ))（共用模組的 `WaveScene.traveling`
 * 已經有一份），這裡放的是這一頁獨有的東西：
 *
 *   1. `waveVy()`——質點速度的閉式解，也就是振動圖的**斜率**。
 *      驗證器會拿它對 `traveling` 的中央差分，兩支各自寫死。
 *   2. 相位段 `segs`——換方向時 τ 要接得上（見 advancePhase 的說明）。
 *   3. 點選的命中測試（世界座標 → 最近的質點）。**幾何只能有一個家，
 *      而且那個家要驗證器進得去**，所以它住在這裡、不是住在繪製碼裡。
 */
var WaveGraphs = (function () {
    'use strict';

    /** 第 i 顆質點的位置（公尺）。 */
    function beadXOf(i, n) {
        const N = n == null ? WVR_BEAD_N : n;
        return WaveScene.ROPE_M * i / N;
    }

    /** 位置（公尺）→ 最近的質點索引。 */
    function beadIndexAt(xm, n) {
        const N = n == null ? WVR_BEAD_N : n;
        const i = Math.round(xm / WaveScene.ROPE_M * N);
        return Math.max(0, Math.min(N, i));
    }

    /**
     * 世界 x → 繩子上的位置（公尺）。
     * 點選時要把畫布像素換算回「第幾顆質點」，這一步必須和 `ropeX()` 用
     * **同一組**常數（ROPE_L / X_SCALE），否則點左邊會偏、點右邊會更偏。
     */
    function metresFromWorldX(wx) {
        return (wx - WaveScene.ROPE_L) / WaveScene.X_SCALE;
    }

    /**
     * 點在波形圖上 → 最近的質點索引；點在框外回 null。
     * 整個框（不只是曲線附近）都是有效目標——質點的位移可能是 0，
     * 要求學生「點在線上」會變成在考手眼協調。
     */
    function pickBead(worldX, worldY, n) {
        if (worldY < WVR_TOP_T || worldY > WVR_TOP_B) return null;
        const mx = metresFromWorldX(worldX);
        if (mx < 0 || mx > WaveScene.ROPE_M) return null;
        return beadIndexAt(mx, n);
    }

    /** 位置 x、相位時間 τ 處的位移（公分）。 */
    function waveY(x, tau, A, k, v) {
        return A * Math.sin(k * (x - v * tau));
    }

    /**
     * 該質點的瞬時速度（公分/秒）= ∂y/∂t。
     *
     * y = A sin(k(x − vτ(t)))，連鎖律：
     *     dy/dt = A cos(k(x − vτ)) · (−kv) · τ′
     * 而 τ′ 就是行進方向的 ±1（dtaudt）。
     *
     * 最大速度 Aω（ω = kv）出現在 cos = ±1，也就是 **y = 0（平衡位置）**；
     * 在 y = ±A（振幅端點）cos = 0，速度是 0。這一條是這一頁的教學重點，
     * verify-waves.js ㉔(c) 直接掃一遍 τ 把兩件事都量出來。
     */
    function waveVy(x, tau, A, k, v, dtaudt) {
        return -A * k * v * dtaudt * Math.cos(k * (x - v * tau));
    }

    /** 最大速率（公分/秒）。 */
    function speedMax(A, k, v) { return A * k * v; }

    // ----------------------------------------------------------------------
    // 相位：換方向時 τ 要接得上
    // ----------------------------------------------------------------------
    // 波寫成 y = A sin(k(x − vτ))，τ 是「波走過的等效時間」，dτ/dt = ±1
    // 就是行進方向。**方向反過來的那一刻 τ 必須連續**，波形才不會跳：
    //
    //     τ 連續  →  y 連續、每一顆質點的位置不變，只有速度方向反過來
    //     τ 不連續 → 整條波形瞬間平移（畫面上像「換了一條波」）
    //
    // 所以這裡存的不是一個 τ，而是一串相位段：每一段是「從 t₀ 開始、
    // 以 dir 前進」的一條射線。τ(t) 就是落在哪一段上。
    // 副作用是振動圖上會出現一個**轉折點**——那正是質點在那一刻煞停、
    // 反向的地方，是這一頁最值得看的一幀。
    // ----------------------------------------------------------------------

    function newPhase(dir, t0) {
        const s = t0 == null ? 0 : t0;
        return { tLast: s, dir: dir, segs: [{ t0: s, tau0: 0, dir: dir }] };
    }

    /** τ(t)：找出 t 落在哪一段相位上。 */
    function tauAt(segs, tp) {
        let s = segs[0];
        for (let i = 1; i < segs.length; i++) {
            if (tp >= segs[i].t0) s = segs[i];
        }
        return s.tau0 + s.dir * (tp - s.t0);
    }

    /**
     * 每一幀推進相位。就地修改並回傳同一個物件（呼叫端要接住回傳值，
     * 因為「時間歸零」那一條會換一顆新的）。
     */
    function advancePhase(ph, t, dir) {
        if (t < ph.tLast - 1e-9) return newPhase(dir, t);   // 參數一改，simTime 歸零 → 相位重來
        if (dir !== ph.dir) {
            ph.segs.push({ t0: t, tau0: tauAt(ph.segs, t), dir: dir });
            ph.dir = dir;
            // 離開所有可能的時間窗的舊相位段就丟掉，切換很多次也不會愈積愈長
            while (ph.segs.length > 2 && ph.segs[1].t0 < t - WVR_WINDOW - 1) ph.segs.shift();
        }
        ph.tLast = t;
        return ph;
    }

    return {
        WVR_V, WVR_BEAD_N, WVR_WINDOW, WVR_X0, WVR_AMP_SCALE,
        beadXOf, beadIndexAt, metresFromWorldX, pickBead,
        waveY, waveVy, speedMax,
        newPhase, tauAt, advancePhase,
    };
})();

function initWaveformVibration() {
    const TS = WaveScene;

    let ph = WaveGraphs.newPhase(+WVR_DIR_DEF);
    let tracked = WaveGraphs.beadIndexAt(WVR_X0);

    // 點選：監聽器只綁一次，但每一幀都要用**當下**的 view 換算，
    // 所以 view 另外存一份（視窗縮放後 e.offsetX 對應的世界座標會變）。
    let bound = false;
    let viewNow = null;

    function bindClick(p, view) {
        viewNow = view;
        if (bound || !p.canvas) return;
        bound = true;
        p.canvas.style.cursor = 'crosshair';
        p.canvas.addEventListener('click', (e) => {
            const v = viewNow;
            if (!v) return;
            const pick = WaveGraphs.pickBead(
                (e.offsetX - v.offsetX) / v.scale,
                (e.offsetY - v.offsetY) / v.scale);
            if (pick != null) tracked = pick;
        });
    }

    WaveScene.run({

        // 長推導自己一行一條，**不要用 \qquad 併排**——側欄很窄，超出的部分
        // 會被靜默裁掉（量法見 .github/scripts/headless/probe-math.html）。
        formula: '\\begin{aligned} y &= A\\sin k(x - vt) \\\\ v_y &= \\dfrac{\\partial y}{\\partial t} \\end{aligned}',
        formulaFallback: 'y = A sin k(x − vt)　　v_y = ∂y/∂t',

        controls: {
            // 下拉排在滑桿前面（buildPanel 先畫 selects）
            selects: [
                { key: 'dir', label: '波的行進方向　', def: WVR_DIR_DEF, options: [
                    { v: '1',  t: '→ 向右（波往右跑）' },
                    { v: '-1', t: '← 向左（波往左跑）' },
                ] },
            ],
            sliders: [
                { key: 'f', label: '頻率 <i>f</i>（每秒幾個波）', unit: 'Hz',
                  min: WVR_F_MIN, max: WVR_F_MAX, step: 0.05, def: WVR_F_DEF, dec: 2 },
                { key: 'A', label: '振幅 <i>A</i>', unit: 'cm',
                  min: WVR_A_MIN, max: WVR_A_MAX, step: 0.5, def: WVR_A_DEF, dec: 1 },
            ],
        },

        /**
         * ⚠️ 換方向**不歸零時間**（`keepLive`）：這一頁要看的正是「同一瞬間、
         *    方向反過來」。歸零的話波會整個重來，學生得先按開始、再等它跑到
         *    剛才那一刻，才比得出差異——而那已經不是「同一瞬間」了。
         */
        keepLive: ['dir'],

        cards: [
            { label: '時間 TIME',      id: 'cardTime',   unit: 's',     highlight: true },
            { label: '質點速度 V_Y',   id: 'cardVy',     unit: 'cm/s',  highlight: true },
            { label: '質點位移 Y',     id: 'cardY',      unit: 'cm' },
            { label: '質點位置 X',     id: 'cardX',      unit: 'm' },
            { label: '波長 Λ',         id: 'cardLambda', unit: 'm' },
            { label: '週期 T = 1/f',   id: 'cardPeriod', unit: 's' },
            { label: '波速 V',         id: 'cardV',      unit: 'm/s' },
            { label: '質點狀態',       id: 'cardState',  unit: '' },
        ],

        values(t, panel) {
            const A = panel.A, f = panel.f, v = WVR_V;
            const k = TS.waveNumber(f, v);
            const x = WaveGraphs.beadXOf(tracked);
            const tau = WaveGraphs.tauAt(ph.segs, t);
            const y = WaveGraphs.waveY(x, tau, A, k, v);
            const vy = WaveGraphs.waveVy(x, tau, A, k, v, +panel.dir);
            const ratio = Math.abs(y) / A;
            return {
                cardTime:   t.toFixed(2),
                cardVy:     vy.toFixed(1),
                cardY:      y.toFixed(1),
                cardX:      x.toFixed(2),
                cardLambda: (v / f).toFixed(2),
                cardPeriod: (1 / f).toFixed(2),
                cardV:      v.toFixed(2),
                cardState:  ratio > 0.995 ? '振幅端點'
                          : ratio < 0.05  ? '平衡位置'
                          :                 '中間',
            };
        },

        titleText(t, panel) {
            const A = panel.A, f = panel.f, v = WVR_V;
            const k = TS.waveNumber(f, v);
            const x = WaveGraphs.beadXOf(tracked);
            const tau = WaveGraphs.tauAt(ph.segs, t);
            const y = WaveGraphs.waveY(x, tau, A, k, v);
            const ratio = Math.abs(y) / A;
            const vmax = WaveGraphs.speedMax(A, k, v);

            if (t < 0.05) {
                return '按「開始」讓波跑起來；在**波形圖**上點一下，就可以換一顆質點';
            }
            if (ratio > 0.99) {
                return `這顆質點走到振幅端點：位移最大、速度是 0（下圖的切線是平的）`;
            }
            if (ratio < 0.01) {
                return `這顆質點正好在平衡位置：位移 0、速度最大 ${vmax.toFixed(1)} cm/s（下圖最陡）`;
            }
            return '質點的速度＝振動圖上那一點的斜率：平衡位置最陡、振幅端點是平的';
        },

        draw(p, view, t, panel) {
            const dir = +panel.dir;
            const A = panel.A, f = panel.f, v = WVR_V;
            const k = TS.waveNumber(f, v);
            const lambda = v / f;

            // 相位要先推進：換方向的那一幀 τ 接得上，波形才不會跳
            ph = WaveGraphs.advancePhase(ph, t, dir);
            const tau = WaveGraphs.tauAt(ph.segs, t);
            const xm = WaveGraphs.beadXOf(tracked);
            const vmax = WaveGraphs.speedMax(A, k, v);

            const trav = TS.traveling({ A: A, k: k, v: v, dir: +1, x0: 0 });
            const yfn = (x, tt) => trav(x, WaveGraphs.tauAt(ph.segs, tt));

            bindClick(p, view);

            // ================================================================
            // 上：波形圖 y–x（橫軸＝位置，整條繩子、某一瞬間）
            // ================================================================
            const gl = TS.ropeX(view, 0);
            const gr = TS.ropeX(view, TS.ROPE_M);
            const gt = view.toScreenY(WVR_TOP_T);
            const gb = view.toScreenY(WVR_TOP_B);
            const topZero = view.toScreenY(WVR_TOP_Z);

            drawFrame(p, view, gl, gt, gr, gb);

            // 每公尺一條格線（讓「橫軸＝位置」讀得出來）
            p.stroke(241, 245, 249);
            p.strokeWeight(1);
            for (let i = 1; i < TS.ROPE_M; i++) {
                const xx = TS.ropeX(view, i);
                p.line(xx, gt, xx, gb);
            }

            // 零線（平衡位置）
            p.stroke(148, 163, 184);
            p.strokeWeight(view.len(2, 1));
            p.line(gl, topZero, gr, topZero);

            // 曲線
            TS.drawWave(p, view, TS.sample(yfn, 0, TS.ROPE_M, t, lambda), {
                baseY: WVR_TOP_Z, ampScale: WVR_AMP_SCALE,
                color: [37, 99, 235], weight: 4,
            });

            // 每一顆質點的速度箭頭：長度 ∝ |v_y|。平衡位置最長、振幅端點縮成 0，
            // 「同一瞬間各質點往哪裡動」一眼看得出來（方向一換，全部同時反過來）。
            for (let i = 0; i <= WVR_BEAD_N; i++) {
                const bx = WaveGraphs.beadXOf(i);
                const isTracked = (i === tracked);
                drawVyArrow(p, view, TS.ropeX(view, bx),
                    view.toScreenY(TS.laneY(WVR_TOP_Z, WVR_AMP_SCALE, yfn(bx, t))),
                    WaveGraphs.waveVy(bx, tau, A, k, v, dir), vmax,
                    isTracked ? WVR_ARROW_W * 1.3 : WVR_ARROW_W,
                    isTracked ? [239, 68, 68] : [251, 146, 60],
                    isTracked ? 3.4 : 2.4);
            }

            // 珠點（放在箭頭之上，箭頭的尾巴才不會蓋掉它）
            TS.drawBeads(p, view, yfn, t, {
                baseY: WVR_TOP_Z, ampScale: WVR_AMP_SCALE, n: WVR_BEAD_N,
                color: [148, 163, 184], radius: 4,
                highlight: { index: tracked, color: [239, 68, 68] },
            });

            // 被追蹤質點的往復軌跡：它只在這條虛線上來回，x 從來沒變過
            const tx = TS.ropeX(view, xm);
            const trackT = view.toScreenY(WVR_TOP_Z - A * WVR_AMP_SCALE);
            const trackB = view.toScreenY(WVR_TOP_Z + A * WVR_AMP_SCALE);
            const ctx = p.drawingContext;
            // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
            p.push();
            ctx.setLineDash([view.len(7, 3), view.len(6, 3)]);
            p.stroke(248, 113, 113);
            p.strokeWeight(view.len(1.5, 1));
            p.line(tx, trackT, tx, trackB);
            p.pop();
            p.stroke(248, 113, 113);
            p.strokeWeight(view.len(2.5, 1.5));
            const capW = view.len(11, 5);
            p.line(tx - capW, trackT, tx + capW, trackT);
            p.line(tx - capW, trackB, tx + capW, trackB);

            // 瞬時速度的數值標籤（向量本身是上面那支紅色箭頭）
            const vyNow = WaveGraphs.waveVy(xm, tau, A, k, v, dir);
            TS.valueBadge(p, view, tx, Math.max(trackT - view.len(18, 9), gt + view.len(13, 8)),
                `v = ${vyNow.toFixed(1)} cm/s ${vyNow > 0.05 ? '↑' : vyNow < -0.05 ? '↓' : '（不動）'}`,
                { size: 14, minSize: 9, stroke: [239, 68, 68], fillColor: [185, 28, 28] });

            // 兩張圖的標題與橫軸說明
            p.noStroke();
            p.fill(100, 116, 139);
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('波形圖 y–x：某一瞬間，繩上每一顆質點的位移', gl, gt - view.len(8, 4));
            p.textAlign(p.RIGHT, p.BOTTOM);
            p.text('橫軸＝位置 x (m)', gr, gt - view.len(8, 4));

            // 「波往哪邊跑」的箭頭（放在標題列右側那一帶）
            TS.drawTravelArrow(p, view, WVR_ARROW_XM, WVR_ARROW_Y, dir,
                dir > 0 ? '波往右跑' : '波往左跑', [239, 68, 68]);

            // 波形圖的 x 刻度
            p.noStroke();
            p.fill(148, 163, 184);
            p.textSize(view.len(13, 8));
            p.textStyle(p.NORMAL);
            p.textAlign(p.CENTER, p.TOP);
            const tickY = view.toScreenY(WVR_XTICK_Y);
            for (let i = 0; i <= TS.ROPE_M; i++) {
                p.text(`${i}`, TS.ropeX(view, i), tickY);
            }

            // ================================================================
            // 下：振動圖 y–t（橫軸＝時間，一顆質點、所有時間）
            // ================================================================
            drawTrackGraph(p, view, t, yfn, xm, A, k, v, dir);
        },
    });

    /** 一張圖的框：白底、淺灰邊。兩張圖共用，所以邊界與底色必然一致。 */
    function drawFrame(p, view, gl, gt, gr, gb) {
        p.noStroke();
        p.fill(252, 252, 253);
        p.rect(gl, gt, gr - gl, gb - gt);
        p.noFill();
        p.stroke(226, 232, 240);
        p.strokeWeight(1);
        p.rect(gl, gt, gr - gl, gb - gt);
    }

    /**
     * 一顆質點的速度向量。
     *
     * 螢幕 y 向下、世界 y 向上，所以速度為正（往上）時線段要往**上**畫
     * （螢幕 y 變小）——這裡的 `sgn` 就是那一次翻轉。翻錯的話所有箭頭會
     * 一起指反，而**數字全部是對的**（卡片、斜率、週期都不變），
     * 只有截圖看得出來。
     */
    function drawVyArrow(p, view, sx, sy, vy, vmax, maxW, col, weight) {
        const L = view.len(maxW) * Math.abs(vy) / vmax;
        const head = view.len(6.5, 3);
        if (!(L > head * 1.2)) return;      // 振幅端點：速度 0，連箭頭都不該有
        const sgn = vy > 0 ? -1 : 1;
        const y2 = sy + sgn * L;
        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(view.len(weight, 1.2));
        p.line(sx, sy, sx, y2 - sgn * head);
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.triangle(sx, y2, sx - head * 0.5, y2 - sgn * head, sx + head * 0.5, y2 - sgn * head);
    }

    /**
     * 被追蹤質點的位移–時間圖。
     *
     * 橫軸是時間（最近 WVR_WINDOW 秒），縱軸與上面那張圖**共用同一組**
     * 世界 y（WVR_AMP_SCALE 與零線高度），所以「上圖那個點的高度」與
     * 「下圖曲線的高度」可以直接對照——兩張圖的振幅是同一把尺。
     *
     * 曲線只畫 t ≥ 0 的部分（模擬開始之前沒有歷史）。換過方向的話，
     * 曲線在切換的那一刻有一個**轉折**：那是質點煞停再反向的地方。
     */
    function drawTrackGraph(p, view, t, yfn, xm, A, k, v, dir) {
        const gl = TS.ropeX(view, 0);
        const gr = TS.ropeX(view, TS.ROPE_M);
        const gt = view.toScreenY(WVR_BOT_T);
        const gb = view.toScreenY(WVR_BOT_B);
        const zeroY = view.toScreenY(WVR_BOT_Z);
        const pxPerCm = view.len(WVR_AMP_SCALE);
        const W = WVR_WINDOW;

        drawFrame(p, view, gl, gt, gr, gb);

        // 時間刻度（橫軸真的是時間——這張圖與上圖唯一的差別就在這裡）
        //
        // ⚠️ 時間軸的右端是 `axisR`，**不是**框的右緣 `gr`。兩者之間留
        //    `WVR_NOW_LEAD` 秒的空白，理由見那個常數的說明：不這樣做的話
        //    「現在」就落在框邊上，切線與紅點會各被切掉一半。
        //    軸寬由「框寬 = 軸寬 × (1 + LEAD/W)」反解出來。
        const axisW = (gr - gl) / (1 + WVR_NOW_LEAD / W);
        const axisR = gl + axisW;
        const xOf = tt => gl + (tt - (t - W)) / W * axisW;
        const tOf = px => t - W + (px - gl) / axisW * W;
        const pxPerSec = axisW / W;

        // 「現在」右邊那一條帶子：框比時間軸長出來的部分。
        // 淡淡地填一層灰、再畫一條淡線收邊，讓它讀起來是「時間軸到這裡為止，
        // 右邊那段還沒有資料」，而不是「圖畫歪了、上面少了一塊」。
        // 上下左右各內縮半個框線寬，免得蓋掉框線的內側。
        const bw = view.len(2, 1);
        p.noStroke();
        p.fill(246, 248, 252);
        p.rect(axisR, gt + bw / 2, gr - axisR - bw / 2, gb - gt - bw);
        p.stroke(226, 232, 240);
        p.strokeWeight(bw);
        p.line(axisR, gt + bw / 2, axisR, gb - bw / 2);

        p.stroke(241, 245, 249);
        p.strokeWeight(1);
        for (let i = 0; i <= 8; i++) {
            const xx = gl + axisW * i / 8;
            p.line(xx, gt, xx, gb);
        }
        p.stroke(148, 163, 184);
        p.strokeWeight(bw);
        p.line(gl, zeroY, axisR, zeroY);

        // 標題
        p.noStroke();
        p.fill(100, 116, 139);
        p.textSize(view.len(15, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text(`振動圖 y–t：x = ${xm.toFixed(2)} m 那一顆質點的位移`, gl, gt - view.len(8, 4));
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text('橫軸＝時間 t (s)', gr, gt - view.len(8, 4));

        p.fill(148, 163, 184);
        p.textSize(view.len(13, 8));
        p.textStyle(p.NORMAL);
        p.textAlign(p.CENTER, p.TOP);
        for (let i = 0; i <= 8; i++) {
            const tt = t - W + W * i / 8;
            if (tt >= -1e-9) p.text(tt.toFixed(tt < 10 ? 1 : 0), gl + axisW * i / 8, gb + view.len(6, 3));
        }

        // 曲線
        const ctx = p.drawingContext;
        // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
        p.push();
        ctx.beginPath();
        ctx.rect(gl, gt, gr - gl, gb - gt);
        ctx.clip();

        p.noFill();
        p.stroke(37, 99, 235);
        p.strokeWeight(view.len(3, 2));
        const N = 300;
        let drawing = false;
        for (let i = 0; i <= N; i++) {
            const tt = tOf(gl + axisW * i / N);
            if (tt < 0) continue;                    // 模擬還沒開始
            if (!drawing) { p.beginShape(); drawing = true; }
            p.vertex(xOf(tt), zeroY - yfn(xm, tt) * pxPerCm);
        }
        if (drawing) p.endShape();

        // 切線：斜率就是質點的速度（這一頁的結論）
        // 以標記點為中心、左右各 WVR_TAN_HALF 秒；因為右邊留了 NOW_LEAD 秒，
        // 這一整段現在都在框內（見常數說明）。
        const vy = WaveGraphs.waveVy(xm, WaveGraphs.tauAt(ph.segs, t), A, k, v, dir);
        const slope = -vy * pxPerCm / pxPerSec;      // 螢幕 y 向下為正
        const x0 = xOf(t), y0 = zeroY - yfn(xm, t) * pxPerCm;
        const dx = pxPerSec * WVR_TAN_HALF;
        p.stroke(217, 119, 6);
        p.strokeWeight(view.len(2.5, 1.5));
        p.line(x0 - dx, y0 - slope * dx, x0 + dx, y0 + slope * dx);

        // 此刻的點
        p.noStroke();
        p.fill(239, 68, 68);
        p.circle(x0, y0, view.len(13, 6));
        p.pop();

        // 底部那一行結論
        p.noStroke();
        p.fill(100, 116, 139);
        p.textSize(view.len(14, 9));
        p.textStyle(p.NORMAL);
        p.textAlign(p.CENTER, p.CENTER);
        p.text('曲線的斜率就是質點的速度：平衡位置最陡 → 速度最大，振幅端點最平 → 速度為零',
               (gl + gr) / 2, view.toScreenY(WVR_NOTE_Y));
    }
}

// ⚠️ 這個守衛不可省：驗證器用 new Function() 把整支讀進 Node 執行，
//    少了它就會在 `document is not defined` 當場爆掉。
if (typeof document !== 'undefined') initWaveformVibration();

// 匯出這一頁的常數與純函式，驗證器才進得來（見 README 陷阱十九）。
if (typeof window !== 'undefined') {
    window.__page = {
        WVR_TOP_T, WVR_TOP_B, WVR_TOP_Z, WVR_XTICK_Y,
        WVR_BOT_T, WVR_BOT_B, WVR_BOT_Z, WVR_TTICK_Y, WVR_NOTE_Y,
        WVR_AMP_SCALE, WVR_BEAD_N, WVR_WINDOW, WVR_ARROW_W, WVR_X0, WVR_V,
        WVR_ARROW_XM, WVR_ARROW_Y, WVR_NOW_LEAD, WVR_TAN_HALF,
        WVR_F_MIN, WVR_F_MAX, WVR_F_DEF, WVR_A_MIN, WVR_A_MAX, WVR_A_DEF, WVR_DIR_DEF,
        WaveGraphs,
    };
}
