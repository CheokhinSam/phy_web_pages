/**
 * 🎬 MotionScene — 力學圖表三部曲（x-t / v-t / a-t）共用的場景與運動模組
 *
 * 03 位移時間圖、04 速度時間圖、17 加速度時間圖看的是同一個運動的三張圖。
 * 三頁若各自複製一份場景與物理，改個車子顏色要改三個地方，而且很容易只改到
 * 其中兩頁，三張圖就再也對不起來。所以場景、鏡頭、圖表框、運動模式、控制面板
 * 全部集中在這裡。
 *
 * 每個實驗只保留「自己那張圖要強調什麼」：
 *   03 → 斜率三角形（斜率 = 速度）
 *   04 → 斜率三角形 + 面積著色（斜率 = 加速度、面積 = 位移）
 *   17 → 面積著色（面積 = 速度變化 Δv）
 *
 * ⚠️ 全部包在 IIFE 裡。實驗檔（如 acceleration-time-graph.js）是在同一個
 *    classic script 環境執行的，若這裡用 top-level `const` 洩漏出 WORLD_W，
 *    會和實驗檔裡同名的常數撞成 "Identifier has already been declared"。
 *
 * ⚠️ 座標系統：先宣告固定的「邏輯世界」，所有座標與尺寸都用世界單位，
 *    繪製前才經 PhysicsUtils.fitViewWH() 換算成像素。
 */
var MotionScene = (function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（世界單位）
    // ======================================================================
    const WORLD_W = 1000;
    const WORLD_H = 900;

    // --- 場景（上方）---
    const ROAD_TOP  = 155;                 // 路面上緣
    const ROAD_H    = 76;                  // 路面厚度
    const ROAD_MID  = ROAD_TOP + ROAD_H / 2;
    const GROUND_BOTTOM = 315;             // 地面下緣

    const CAR_W = 92, CAR_H = 40;
    const CAR_START_X = 150;               // 車子起始世界座標
    const CAMERA_ANCHOR = 380;             // 車子永遠停在畫面的這個世界座標
    const METER = 9;                       // 1 公尺 = 9 世界單位
    const DASH_PERIOD = 90;                // 車道虛線週期（世界單位）

    // --- 圖表（下方）---
    const GRAPH_L = 118, GRAPH_R = 950;
    const GRAPH_T = 355, GRAPH_B = 790;
    const T_WINDOW = 12;                   // 時間軸初始窗寬（秒）

    // 掃整段運動時的取樣點數。這條曲線要不是二次式就是階梯，240 點已經
    // 遠超過一個像素一點，極值與轉折都抓得到。
    const Y_SAMPLES = 240;

    // --- 底部標題列 ---
    const TITLE_TOP = 852;
    const TITLE_H   = 48;

    // 車道捲動的地面刻度間距（公尺）
    const GROUND_TICK_M = 10;

    // ======================================================================
    // 運動模式
    // ----------------------------------------------------------------------
    // a 是分段常數，所以 v(t) 與 x(t) 都有閉式解：直接算，不累加。
    // 累加會累積浮點誤差，而且分頁切到背景再回來時 dt 會暴走，
    // 那些誤差會直接變成物理誤差。
    // ======================================================================
    const MODES = ['constant', 'uniform', 'decelerate', 'staged'];

    const MODE_LABEL = {
        constant:   '等速運動',
        uniform:    '等加速度運動',
        decelerate: '等減速運動',
        staged:     '分段變速',
    };

    /**
     * 分段變速：加速 4 秒 → 等速 4 秒 → 減速 8 秒。
     *
     * 第三段故意「不夾在 v = 0」，讓速度從 +16 一路穿過零線掉到 −8。
     * 這一條撐起三份 MD 已經寫下的教學宣稱：
     *   x-t 的斜率由正轉負（03：斜率為負 → 往後走）
     *   v-t 的面積由正轉負（04：面積在軸下方 = 負位移）
     *   a-t 出現負面積（17）
     * 若把第三段也夾在 0，v 永遠 ≥ 0，上面三句就都沒有實驗能驗證了。
     *
     * 16 秒之後 a 回到 0，車子維持 −8 m/s 等速後退，不會無限加速暴走。
     */
    // 分段變速：加速 4 s（4 → 16 m/s）→ 等速 4 s → 減速 8 s（16 → −8 m/s）→
    // 再煞停 8/3 s（−8 → 0）→ 靜止。
    //
    // 第三段故意不夾在 v = 0，讓速度穿到負的：x-t 的斜率由正轉負、v-t 的
    // 面積變號，這兩個是 03/04 內文已經寫下的教學點。
    //
    // 第四段（煞停）不能省。少了它，車子會以 −8 m/s 永遠倒退，x 無界成長：
    // 學生看到 75 秒時「位移」卡片是 −336 m，但圖上只看得到 0..20 秒、面積
    // 104，兩邊對不起來，平均速度也跟著漂。加上煞停之後車子靜止，所有量都
    // 凍結（和「等減速」一樣），數字就永遠一致。
    const STAGED = [
        { t0: 0,       t1: 4,        a:  3 },
        { t0: 4,       t1: 8,        a:  0 },
        { t0: 8,       t1: 16,       a: -3 },
        { t0: 16,      t1: 16 + 8/3, a:  3 },
        { t0: 16 + 8/3, t1: Infinity, a: 0 },
    ];

    const STAGED_A = 3;                    // 分段變速的固定加速度大小

    /**
     * 目前的加速度分段。
     *
     * 減速模式的 a **與 v 反向**（`-sign(v0) * |a|`），不是「a 取負值」。
     * v0 為負時加速度是正的——因為「減速」定義的是 a 與 v 反向。
     * 然後在 |v0| / |a| 秒時靜止，之後 a = 0 不再動。
     */
    function segments(mode, v0, a) {
        const mag = Math.abs(a);
        switch (mode) {
            case 'constant':
                return [{ t0: 0, t1: Infinity, a: 0 }];

            case 'uniform':
                return [{ t0: 0, t1: Infinity, a: mag }];

            case 'decelerate': {
                if (Math.abs(v0) < 1e-9 || mag < 1e-9) {
                    return [{ t0: 0, t1: Infinity, a: 0 }];
                }
                const dir = v0 >= 0 ? 1 : -1;
                const tStop = Math.abs(v0) / mag;
                return [
                    { t0: 0,     t1: tStop,    a: -dir * mag },
                    { t0: tStop, t1: Infinity, a: 0 },
                ];
            }

            case 'staged':
                return STAGED;

            default:
                return [{ t0: 0, t1: Infinity, a: 0 }];
        }
    }

    /**
     * 運動「演完」的時刻：最後一個 a ≠ 0 的分段邊界。
     *
     * 沒有這個的話，時間軸會隨著 simTime 無限長大。等減速模式 1.33 秒就演完了，
     * 放著跑 40 秒的話那一段階梯會被壓縮到畫面左邊 3%，整個教學重點消失。
     * 等速與等加速度沒有終點（a 固定不變），回傳 Infinity，時間軸照常長大。
     */
    function motionEnd(mode, v0, a) {
        let end = 0;
        for (const s of segments(mode, v0, a)) {
            if (s.a === 0) continue;
            if (!isFinite(s.t1)) return Infinity;      // 還在加速，永遠演不完
            end = Math.max(end, s.t1);
        }
        return end > 0 ? end : Infinity;
    }

    /** 減速模式的靜止時刻；不停或不是減速模式就回傳 Infinity。 */
    function stopTime(mode, v0, a) {
        if (mode !== 'decelerate') return Infinity;
        // a = 0 時 segments() 會退化成等速運動，車子永遠不會停——這裡若回傳 0，
        // 停止距離 v0²/(2|a|) 會除以 0 變成 Infinity，整台車飛走。
        if (Math.abs(a) < 1e-9) return Infinity;
        if (Math.abs(v0) < 1e-9) return 0;          // 本來就靜止，一開始就算停住
        return Math.abs(v0) / Math.abs(a);
    }

    /**
     * t 時刻的完整運動狀態。回傳 { t, a, v, x }。
     *
     * 逐段積分下去，每段之內 a 是常數，所以等加速度公式是精確的。
     */
    function stateAt(mode, v0, a, t) {
        const segs = segments(mode, v0, a);

        // 減速模式的停止點用解析值寫死，不靠上面那段積分算出來。
        // v0/|a| 在浮點下乘以 |a| 不一定剛好回到 v0，殘留的 1e-15 會讓卡片
        // 顯示 "-0.00"，看起來像車子偷偷倒退了一點。
        const ts = stopTime(mode, v0, a);
        if (t >= ts) {
            const mag = Math.abs(a);
            const dist = (Math.abs(v0) * v0) / (2 * mag);   // v² = v0² + 2aΔx，v = 0
            return { t, a: 0, v: 0, x: dist };
        }

        // 分段邊界上回報的是「正要進入」那一段的 a（半開區間 [t0, t1)），
        // 不是剛結束那一段。這樣 t = 18.667（分段變速煞停的那一刻）讀到的
        // a 是 0 而不是 3，和「車子停住之後 a 跳回 0」的教學描述一致，
        // 也和上面的參考積分器用同一套約定。邊界是零測度，x 與 v 不受影響。
        let v = v0, x = 0, acc = segs.length ? segs[0].a : 0;
        for (const s of segs) {
            if (t < s.t0) { acc = s.a; break; }
            const t1 = Math.min(s.t1, t);
            const dt = t1 - s.t0;
            if (dt > 0) {
                x += v * dt + 0.5 * s.a * dt * dt;
                v += s.a * dt;
            }
            acc = s.a;
            if (t < s.t1) break;
        }
        return { t, a: acc, v, x };
    }

    /**
     * a-t 曲線下的「幾何面積」= 速度變化 Δv：各段 a × Δt 的帶號和。
     *
     * 這是獨立於 stateAt() 算出來的——a-t 實驗的教學重點是「量出來的面積
     * 等於速度變化」，若直接把 v − v0 當答案填進去，那個等式就變成同義反覆，
     * 學生看到的數字是定義而不是量測結果。
     */
    function accelAreaAt(mode, v0, a, t) {
        let S = 0;
        for (const s of segments(mode, v0, a)) {
            if (t <= s.t0) break;
            S += s.a * (Math.min(s.t1, t) - s.t0);
            if (t <= s.t1) break;
        }
        return S;
    }

    /**
     * v-t 曲線下的帶號面積 = 位移 x。
     *
     * v(t) 是分段線性（因為 a 是分段常數），所以梯形法在每一段之內都是
     * 精確的，沒有離散化誤差。同樣刻意不直接回傳 x——這頁的教學重點就是
     * 「量出來的面積等於位移」。
     */
    function velocityAreaAt(mode, v0, a, t) {
        let S = 0;
        let v = v0;
        for (const s of segments(mode, v0, a)) {
            if (t <= s.t0) break;
            const t1 = Math.min(s.t1, t);
            const dt = t1 - s.t0;
            const vEnd = v + s.a * dt;
            S += 0.5 * (v + vEnd) * dt;          // 梯形面積
            v = vEnd;
            if (t <= s.t1) break;
        }
        return S;
    }

    /** 把分段常數的 a 組成階梯頂點（精確，不取樣）。 */
    function stepPath(mode, v0, a, upto) {
        const pts = [];
        for (const s of segments(mode, v0, a)) {
            if (s.t0 > upto) break;
            const t1 = Math.min(s.t1, upto);
            pts.push({ t: pts.length === 0 ? 0 : s.t0, y: s.a });
            pts.push({ t: t1, y: s.a });
            if (t1 >= upto) break;
        }
        if (pts.length === 0) pts.push({ t: 0, y: 0 });
        return pts;
    }

    /**
     * 取樣 y(t)，回傳 { t, y } 陣列。
     *
     * 除了均勻取樣，還會**補上分段邊界**——只靠均勻取樣的話，折線會在
     * t = 4、8、16 這些轉折處被切角，圖形看起來像平滑的曲線而不是有轉折。
     *
     * @param {function} pick (state) => y，看要取 x 還是 v
     */
    function samplePath(mode, v0, a, upto, pick, steps) {
        const ts = [];
        const n = Math.max(2, steps);
        for (let i = 0; i <= n; i++) ts.push((upto * i) / n);
        for (const s of segments(mode, v0, a)) {
            if (s.t0 > 0 && s.t0 < upto) ts.push(s.t0);
        }
        ts.sort((x, y) => x - y);
        return ts.map(t => ({ t, y: pick(stateAt(mode, v0, a, t)) }));
    }

    // ======================================================================
    // 數值工具
    // ======================================================================

    /**
     * 把資料範圍變成「好看」的座標軸。
     *
     * 回傳 { lo, hi, step }，保證 lo ≤ 0 ≤ hi（零線一定在圖內）。
     */
    function niceAxis(minV, maxV, targetTicks) {
        let lo = Math.min(0, minV);
        let hi = Math.max(0, maxV);
        if (hi - lo < 1e-9) { lo -= 1; hi += 1; }

        const raw = (hi - lo) / Math.max(2, targetTicks);
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const n = raw / mag;
        const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;

        lo = Math.floor(lo / step) * step;
        hi = Math.ceil(hi / step) * step;
        return { lo, hi, step };
    }

    /** 刻度數字：依 step 決定小數位，並去掉 "-0" 這種東西。 */
    function fmtTick(v, step) {
        const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
        let s = v.toFixed(dec);
        if (parseFloat(s) === 0) s = (0).toFixed(dec);
        return s;
    }

    /** 時間軸刻度間距：跑久了 maxT 會一直長大，固定間距會讓標籤擠成一團。 */
    function timeTicks(pxWidth, maxT, minPxPerTick) {
        const maxTicks = Math.max(2, Math.floor(pxWidth / minPxPerTick));
        return Math.max(2, 2 * Math.ceil(maxT / maxTicks / 2));
    }

    /**
     * 時間軸右端（秒）。就是「這張圖現在講到第幾秒」。
     *
     * 運動有終點（等減速停住、分段變速跑完）就固定在那裡，往上取整到偶數；
     * 沒有終點（等速、等加速度會一直跑下去）才隨 simTime 長大。
     *
     * graph() 畫時間軸、run() 算縱軸範圍都用這一條。兩邊各算一次的話，
     * 縱軸會看著一個長度、時間軸畫另一個長度，預覽線就會超出格子。
     */
    function axisEndT(endT, simTime) {
        return (endT != null && isFinite(endT))
            ? Math.max(4, Math.ceil(endT * 1.15 / 2) * 2)
            : Math.max(T_WINDOW, Math.ceil(simTime * 1.15));
    }

    // ======================================================================
    // 場景繪製
    // ======================================================================

    function drawSky(p, view) {
        const r = view.rect;
        const skyTop = view.toScreenY(0);
        const roadTop = view.toScreenY(ROAD_TOP);
        const span = Math.max(1, roadTop - skyTop);
        // 由上而下把天空從淡藍漸層到近白
        for (let y = Math.floor(skyTop); y < roadTop; y++) {
            const t = (y - skyTop) / span;
            p.stroke(p.lerp(224, 240, t), p.lerp(242, 249, t), p.lerp(254, 255, t));
            p.line(r.x, y, r.x + r.w, y);
        }
    }

    function drawRoad(p, view, camX) {
        const r = view.rect;
        p.noStroke();
        p.fill(51, 65, 85);
        p.rect(r.x, view.toScreenY(ROAD_TOP), r.w, view.len(ROAD_H));

        // 車道中央虛線（依 camX 捲動）
        const midY = view.toScreenY(ROAD_MID);
        const dashLen = view.len(45, 12);
        const period = view.len(DASH_PERIOD, 20);
        // camX 可能為負（車子倒退），JS 的 % 會保留負號，先正規化到 [0, period)
        const off = ((camX * view.scale) % period + period) % period;
        p.stroke(251, 191, 36);
        p.strokeWeight(view.len(4, 2));
        for (let x = r.x - off; x < r.x + r.w + period; x += period) {
            p.line(x, midY, x + dashLen, midY);
        }
        p.noStroke();
    }

    function drawGround(p, view, camX) {
        const r = view.rect;
        const y = view.toScreenY(ROAD_TOP + ROAD_H);
        p.noStroke();
        p.fill(241, 245, 249);
        p.rect(r.x, y, r.w, view.toScreenY(GROUND_BOTTOM) - y);

        // 每 10 公尺一個短刻度，只在路緣下方一點點，不要畫滿整條地面
        const step = GROUND_TICK_M * METER;
        const first = Math.floor(camX / step) * step;
        const tickTop = view.toScreenY(ROAD_TOP + ROAD_H);
        const tickBot = view.toScreenY(ROAD_TOP + ROAD_H + 26);
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(2, 1));
        for (let wx = first; wx < camX + WORLD_W + step; wx += step) {
            const x = view.toScreenX(wx - camX);
            p.line(x, tickTop, x, tickBot);
        }
        p.noStroke();
    }

    /**
     * 小車。鏡頭鎖在車上：車子永遠停在畫面的 CAMERA_ANCHOR 處，
     * 靠道路捲動表現移動。所以這裡直接把車畫在 CAMERA_ANCHOR。
     */
    function drawCar(p, view, vel) {
        const x = view.toScreenX(CAMERA_ANCHOR);
        const y = view.toScreenY(ROAD_MID);
        const w = view.len(CAR_W);
        const h = view.len(CAR_H);

        // 車身
        p.noStroke();
        p.fill(37, 99, 235);
        p.rect(x - w / 2, y - h * 0.35, w, h * 0.8, view.len(8, 3));

        // 車頂
        p.fill(30, 64, 175);
        p.rect(x - w * 0.26, y - h * 0.95, w * 0.54, h * 0.66, view.len(6, 2));

        // 車窗
        p.fill(191, 219, 254);
        p.rect(x - w * 0.21, y - h * 0.88, w * 0.18, h * 0.44);
        p.rect(x + w * 0.03, y - h * 0.88, w * 0.18, h * 0.44);

        // 輪子
        p.fill(30, 41, 59);
        const wheel = view.len(20, 7);
        p.circle(x - w * 0.29, y + h * 0.46, wheel);
        p.circle(x + w * 0.29, y + h * 0.46, wheel);

        // 速度箭頭
        const arrowY = view.toScreenY(ROAD_TOP - 42);
        if (Math.abs(vel) > 0.2) {
            const lenPx = p.constrain(view.len(Math.abs(vel) * 16), view.len(20, 8), view.len(220, 40));
            const dir = vel >= 0 ? 1 : -1;
            const x1 = x - dir * w * 0.55;
            const x2 = x1 + dir * lenPx;
            const head = p.constrain(lenPx * 0.28, view.len(11, 6), view.len(20, 10));

            p.stroke(239, 68, 68);
            p.strokeWeight(view.len(5, 2));
            p.line(x1, arrowY, x2 - dir * head, arrowY);
            p.noStroke();
            p.fill(239, 68, 68);
            p.triangle(
                x2, arrowY,
                x2 - dir * head, arrowY - head * 0.5,
                x2 - dir * head, arrowY + head * 0.5
            );

            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(view.len(17, 10));
            p.textStyle(p.BOLD);
            p.text(`v = ${vel.toFixed(1)} m/s`, x, arrowY - view.len(8, 4));
        } else {
            p.fill(100, 116, 139);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(view.len(17, 10));
            p.textStyle(p.BOLD);
            p.text('v = 0', x, arrowY - view.len(8, 4));
        }
    }

    function drawTitleBar(p, view, text) {
        const r = view.rect;
        const barTop = view.toScreenY(TITLE_TOP);
        const barH = view.len(TITLE_H);
        p.noStroke();
        p.fill(0, 0, 0, 178);
        p.rect(r.x, barTop, r.w, barH);
        p.fill(251, 191, 36);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(view.len(18, 11));
        p.textStyle(p.BOLD);
        p.text(text, r.x + r.w / 2, barTop + barH / 2);
    }

    // ======================================================================
    // 圖表框
    // ======================================================================

    /**
     * 畫圖表框，並在框內執行 drawFn(g) 畫曲線。
     *
     * 順序很重要：底 → 網格 → 外框 → 零線 → [呼叫端，裁切在框內] →
     * 刻度數字 → 標題列。刻度數字與標題畫在框**外**，所以底框必須塗滿，
     * 而且 drawScene 每幀要 p.background(255) 清畫布，否則會一幀一幀疊上去。
     *
     * @param {object} o
     *   o.maxT       {number} 時間軸至少要顯示到幾秒
     *   o.yLo/yHi    {number} 縱軸範圍（呼叫端用 niceAxis 算好）
     *   o.yStep      {number} 縱軸刻度間距
     *   o.titleLeft  {string} 左上角標題（含圖名）
     *   o.titleRight {string} 右上角單位（例如 't (s)   x (m)'）
     * @param {function} drawFn 收到 g（座標換算工具）後畫曲線
     */
    function graph(p, view, o, drawFn) {
        const gl = view.toScreenX(GRAPH_L);
        const gr = view.toScreenX(GRAPH_R);
        const gt = view.toScreenY(GRAPH_T);
        const gb = view.toScreenY(GRAPH_B);

        // 時間軸：運動有終點時就固定在那裡（往上取整到刻度上），否則隨 simTime 長大
        const maxT = axisEndT(o.endT, o.maxT);
        const tToX = t => gl + (t / maxT) * (gr - gl);
        const yToPx = v => gb - ((v - o.yLo) / (o.yHi - o.yLo)) * (gb - gt);

        // 時間軸刻度間距隨可用寬度調整。跑久了 maxT 會一直長大，
        // 固定每 2 秒一格的話標籤會擠成一團並溢出圖表外。
        const tStep = timeTicks(gr - gl, maxT, view.len(46, 26));
        const zeroY = yToPx(0);

        // 底框
        p.noStroke();
        p.fill(250, 250, 250);
        p.rect(gl, gt, gr - gl, gb - gt);

        // 網格
        p.stroke(241, 245, 249);
        p.strokeWeight(1);
        for (let v = o.yLo; v <= o.yHi + 1e-9; v += o.yStep) {
            const y = yToPx(v);
            if (Math.abs(y - zeroY) < 1) continue;      // 零線另外畫
            p.line(gl, y, gr, y);
        }
        for (let t = 0; t <= maxT; t += tStep) {
            const x = tToX(t);
            p.line(x, gt, x, gb);
        }

        // 外框
        p.noFill();
        p.stroke(226, 232, 240);
        p.strokeWeight(1);
        p.rect(gl, gt, gr - gl, gb - gt);

        // 零線（x-t 與 v-t 常常讓它和底框重合，畫粗一點才讀得出來是坐標軸）
        p.stroke(148, 163, 184);
        p.strokeWeight(view.len(2, 1));
        p.line(gl, zeroY, gr, zeroY);

        // --- 呼叫端畫曲線（裁切在框內）---
        const ctx = p.drawingContext;
        ctx.save();
        ctx.beginPath();
        ctx.rect(gl, gt, gr - gl, gb - gt);
        ctx.clip();
        drawFn({
            gl, gr, gt, gb, zeroY, maxT, tStep, tToX, yToPx,
            yLo: o.yLo, yHi: o.yHi, endT: o.endT,
            /**
             * 「現在」畫在時間軸上的哪一格。運動演完之後 simTime 會一直長大
             * （車子停著不動，時間照樣在走），不夾住的話圓點會被推到圖外。
             */
            nowT(t) { return Math.min(t, maxT); },
        });
        ctx.restore();

        // --- 軸刻度（框外）---
        const showSign = o.yLo < -1e-9;
        p.noStroke();
        p.fill(148, 163, 184);
        p.textSize(view.len(15, 9));
        p.textStyle(p.NORMAL);
        p.textAlign(p.CENTER, p.TOP);
        for (let t = 0; t <= maxT; t += tStep) {
            p.text(`${t}`, tToX(t), gb + view.len(10, 4));
        }
        p.textAlign(p.RIGHT, p.CENTER);
        for (let v = o.yLo; v <= o.yHi + 1e-9; v += o.yStep) {
            let s = fmtTick(v, o.yStep);
            if (showSign && parseFloat(s) > 0) s = '+' + s;
            p.text(s, gl - view.len(10, 5), yToPx(v));
        }

        // --- 圖表標題列 ---
        // 單位寫在這裡，不另外畫軸標題。畫軸標題的話，小畫布上 minPx 的下限
        // 會讓標題和刻度數字擠在同一行（間距隨 scale 縮、字級卻被下限撐住）。
        const headY = gt - view.len(8, 4);
        p.fill(100, 116, 139);
        p.textSize(view.len(16, 10));
        p.textStyle(p.BOLD);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text(o.titleLeft, gl, headY);
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text(o.titleRight, gr, headY);
    }

    // ======================================================================
    // 圖表上的元件（都要在 graph() 的 drawFn 內、已被裁切）
    // ======================================================================

    /** 目前位置的標記點（實心圓 + 白心）。 */
    function marker(p, view, x, y) {
        p.noStroke();
        p.fill(37, 99, 235);
        p.circle(x, y, view.len(14, 6));
        p.fill(255);
        p.circle(x, y, view.len(6, 3));
    }

    /** 把折線畫成曲線。 */
    function curve(p, view, pts, g, color, weight) {
        p.noFill();
        p.stroke(color);
        p.strokeWeight(view.len(weight || 4, 2));
        p.beginShape();
        for (const pt of pts) p.vertex(g.tToX(pt.t), g.yToPx(pt.y));
        p.endShape();
    }

    /**
     * 整個時間窗的完整軌跡，淡淡的虛線底稿。
     *
     * 沒有這一條的話，「開始」之前圖上是一片空白（第一幀 simTime = 0，曲線
     * 沒得畫），看起來像壞掉；而縱軸也只能從零開始猜，刻度是假的 ±1。
     * 有了底稿，載入當下就看得到整個運動的長相，按「開始」之後亮線沿著它
     * 長出來，「現在跑到哪裡、還剩多少」一眼就看得出來。
     *
     * 刻意用淺灰藍虛線而不是淡藍實線：它是座標系的一部分，不是數據。
     */
    function ghostPath(p, view, pts, g) {
        if (!pts || pts.length < 2) return;
        p.noFill();
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(2, 1));
        const ctx = p.drawingContext;
        ctx.save();
        ctx.setLineDash([view.len(10, 4), view.len(8, 3)]);
        p.beginShape();
        for (const pt of pts) p.vertex(g.tToX(pt.t), g.yToPx(pt.y));
        p.endShape();
        ctx.restore();
    }

    /**
     * 依正負號把折線切成數段，並各別填色。
     * v-t 的面積會穿過時間軸，正負要分色，否則「負面積」看不出來。
     */
    function fillSignedArea(p, view, pts, g, colorPos, colorNeg) {
        for (const run of splitByZero(pts)) {
            const sign = run.find(pt => Math.abs(pt.y) > 1e-9);
            if (!sign) continue;
            const c = sign.y > 0 ? colorPos : colorNeg;
            if (!c) continue;
            p.noStroke();
            p.fill(c[0], c[1], c[2], c[3]);
            p.beginShape();
            for (const pt of run) p.vertex(g.tToX(pt.t), g.yToPx(pt.y));
            p.vertex(g.tToX(run[run.length - 1].t), g.zeroY);
            p.vertex(g.tToX(run[0].t), g.zeroY);
            p.endShape(p.CLOSE);
        }
    }

    /**
     * 在零交點把折線切開，讓每一段的 y 同號。
     *
     * ⚠️ 不能只看「相鄰兩點是否正負相鄰」。a-t 的階梯從 +3 降到 −3 中間
     * 夾著一段 0，走法是 (4,+3) → (4,0) → (8,0) → (8,−3)：相鄰兩點永遠
     * 不會一正一負，整條會被誤判成同一色，負面積就不見了。
     * 所以改成追蹤「上一個非零的號」，號一換就在零點切開。
     */
    function splitByZero(pts) {
        const out = [];
        let cur = [];
        let sign = 0;
        for (const pt of pts) {
            const s = pt.y > 1e-9 ? 1 : pt.y < -1e-9 ? -1 : 0;
            if (s !== 0 && sign !== 0 && s !== sign && cur.length) {
                // 換號了。分界點落在 cur 終點與 pt 之間——階梯的轉折處通常
                // 已經有一點 y = 0，沒有的話（例如折線直接穿過去）就自己插一點。
                const prev = cur[cur.length - 1];
                const zero = Math.abs(prev.y) < 1e-9
                    ? prev
                    : { t: prev.t + (pt.t - prev.t) * (prev.y / (prev.y - pt.y)), y: 0 };
                if (zero !== prev) cur.push(zero);
                out.push(cur);
                cur = [zero];                              // 下一段從零點接續
            }
            if (s !== 0) sign = s;
            cur.push(pt);
        }
        if (cur.length > 1) out.push(cur);
        return out;
    }

    /**
     * 面積標籤要落在哪裡：挑「面積絕對值最大」的那一塊著色區，回傳它的中心。
     *
     * 不能取整段的中點再配平均高度——分段變速的 a-t 圖正負會相消（+12 − 24 + 8），
     * 平均值剩下 −0.2，標籤就貼在零線上、正好壓在區塊邊緣，看起來像放錯位置。
     * 挑最大的那一塊，標籤才會穩穩落在顏色裡面。
     *
     * @returns {{t:number, y:number, S:number}|null} 最大區塊的時間中點、平均高度、帶號面積
     */
    function dominantArea(pts) {
        let best = null;
        for (const run of splitByZero(pts)) {
            // 面積整條算（貼在零線上的尾巴貢獻 0），但 t0/t1 只取真的有值的那一段。
            // 「等減速」停下之後 v 會一直貼在 0，尾巴若算進範圍，中點會被推到
            // 停住之後好久的地方，標籤就飄到著色區外面了。
            let S = 0, first = -1, last = -1;
            for (let i = 0; i < run.length; i++) {
                if (Math.abs(run[i].y) > 1e-9) { if (first < 0) first = i; last = i; }
                if (i > 0) S += 0.5 * (run[i - 1].y + run[i].y) * (run[i].t - run[i - 1].t);
            }
            if (first < 0 || Math.abs(S) < 1e-9) continue;
            const t0 = run[first].t, t1 = run[last].t;
            if (t1 - t0 < 1e-9) continue;
            if (!best || Math.abs(S) > Math.abs(best.S)) {
                best = { S, t: (t0 + t1) / 2, y: S / (t1 - t0) };
            }
        }
        return best;
    }

    /**
     * 白底藍框的數值標籤。
     *
     * 直接寫字會壓到零線、網格或階梯的垂直線（17 開發時就是這樣糊掉的），
     * 所以底下墊一塊白底藍框。
     */
    function valueBadge(p, view, x, y, text, o) {
        o = o || {};
        const size = view.len(o.size || 17, o.minSize || 10);
        const padX = view.len(12, 6), padY = view.len(7, 4);
        const align = o.align || 'center';
        const stroke = o.stroke || [37, 99, 235];
        const fill = o.fillColor || [30, 64, 175];

        p.textSize(size);
        p.textStyle(p.BOLD);
        const tw = p.textWidth(text);
        const bx = align === 'right' ? x - tw : align === 'left' ? x : x - tw / 2;
        const by = y - size / 2;

        p.noStroke();
        p.fill(255);
        p.rect(bx - padX, by - padY, tw + padX * 2, size + padY * 2);
        p.noFill();
        p.stroke(stroke[0], stroke[1], stroke[2]);
        p.strokeWeight(view.len(1.5, 1));
        p.rect(bx - padX, by - padY, tw + padX * 2, size + padY * 2);
        p.noStroke();
        p.fill(fill[0], fill[1], fill[2]);
        p.textAlign(align === 'right' ? p.RIGHT : align === 'left' ? p.LEFT : p.CENTER,
                    p.CENTER);
        p.text(text, x, y);
    }

    /**
     * 斜率三角形：以曲線上的 (t, y) 為一點，往左畫水平股 Δt 與垂直股
     * slope × Δt，斜邊落在那一點的切線上。
     *
     * 斜率用**解析值**（x-t 用 v(t)、v-t 用 a(t)），不是有限差分：
     * 等加速度的 x-t 是拋物線，割線斜率和切線斜率差 a·Δt/2，用有限差分
     * 標出來的數字會跟卡片上的「速度」對不起來。
     */
    function slopeTriangle(p, view, g, o) {
        const dtMax = o.dt || 1.6;
        const tL = Math.max(0, o.t - dtMax);
        const dt = o.t - tL;
        if (dt < 0.15) return;                    // 才剛開始，三角形太小沒有意義

        const x1 = g.tToX(o.t),  y1 = g.yToPx(o.y);
        const x0 = g.tToX(tL),   y0 = g.yToPx(o.y);              // 水平股左端
        const yc = g.yToPx(o.y - o.slope * dt);                  // 垂直股下端
        if (Math.abs(y0 - yc) < view.len(6, 4)) return;          // 斜率幾乎是 0，看不出三角形

        // 水平股（Δt）
        p.stroke(37, 99, 235);
        p.strokeWeight(view.len(2.5, 1));
        p.line(x0, y0, x1, y1);
        // 垂直股（Δx 或 Δv）
        p.stroke(239, 68, 68);
        p.line(x0, y0, x0, yc);

        // 直角記號
        const tick = view.len(11, 5);
        p.stroke(148, 163, 184);
        p.strokeWeight(view.len(1.5, 1));
        p.line(x0 + tick, y0, x0 + tick, yc > y0 ? y0 + tick : y0 - tick);
        p.line(x0, yc > y0 ? y0 + tick : y0 - tick, x0 + tick, yc > y0 ? y0 + tick : y0 - tick);

        p.noStroke();
        valueBadge(p, view, x0, yc > y0 ? yc + view.len(20, 11) : yc - view.len(20, 11),
                   o.label, { align: 'center', size: 16, minSize: 9 });
    }

    // ======================================================================
    // 控制面板
    // ======================================================================

    /**
     * 三頁共用的控制面板：模式下拉 + 初速度 + 加速度大小 + 開始/暫停/重設 + 公式。
     *
     * a 滑桿是取「大小」不是有號值——「等減速」已經是獨立模式、自己決定正負，
     * 再讓滑桿也能給負值會出現「等加速度模式 + 負 a」這種語意重疊。
     * 符號一律由模式決定。
     *
     * @param {HTMLElement} ctrlPanel
     * @param {object} o  { formula, formulaFallback, onChange(reason), initial }
     * @returns {object} { mode, v0, a, started, paused, reset(), sync() }
     */
    function buildPanel(ctrlPanel, o) {
        o = o || {};
        const st = {
            mode:    o.initial && o.initial.mode ? o.initial.mode : 'uniform',
            v0:      o.initial && o.initial.v0   != null ? o.initial.v0 : 4,
            a:       o.initial && o.initial.a    != null ? o.initial.a  : 3,
            started: false,
            paused:  false,
        };

        const formulaHTML = (typeof katex !== 'undefined')
            ? katex.renderToString(o.formula, { throwOnError: false, displayMode: true })
            : `<div style="font-size:1rem;font-weight:700;">${o.formulaFallback || ''}</div>`;

        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label><span>運動模式</span></label>
                <select id="modeSelect" style="width: 100%; padding: 8px; font-size: 0.9rem; font-weight: 700; border: 1px solid #000; background: #fff; cursor: pointer;">
                    <option value="constant">等速運動</option>
                    <option value="uniform">等加速度運動</option>
                    <option value="decelerate">等減速運動（會停下來）</option>
                    <option value="staged">分段變速</option>
                </select>
            </div>
            <div class="control-box">
                <label>
                    <span>初速度 <i>v₀</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="v0Val" style="color: #2563eb;">${st.v0.toFixed(1)}</span> m/s
                    </span>
                </label>
                <input type="range" id="v0Slider" min="-10" max="10" step="0.5" value="${st.v0}">
            </div>
            <div class="control-box" id="aBox">
                <label>
                    <span>加速度大小 <i>|a|</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">${st.a.toFixed(1)}</span> m/s²
                    </span>
                </label>
                <input type="range" id="aSlider" min="0" max="6" step="0.5" value="${st.a}">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">核心關係</div>
                <div>${formulaHTML}</div>
            </div>
        `;

        const modeSelect = document.getElementById('modeSelect');
        const aBox = document.getElementById('aBox');
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');

        const panel = {
            mode: st.mode, v0: st.v0, a: st.a,
            started: false, paused: false,
            sync,
            reset(keepStarted) {
                Object.assign(st, { started: keepStarted, paused: false });
                panel.started = st.started;
                panel.paused = st.paused;
                pauseBtn.textContent = '暫停 PAUSE';
                sync();
            },
        };

        function sync() {
            startBtn.style.display = st.started ? 'none' : 'block';
            pauseBtn.style.display = st.started ? 'block' : 'none';
            // 減速與分段模式用固定的加速度大小，滑桿不參與，藏起來免得誤會
            const usesSlider = (st.mode === 'uniform');
            aBox.style.display = usesSlider ? '' : 'none';
        }

        modeSelect.value = st.mode;

        function change(reason) {
            panel.mode = st.mode;
            panel.v0 = st.v0;
            panel.a = st.a;
            panel.started = st.started;
            panel.paused = st.paused;
            if (o.onChange) o.onChange(reason);
        }

        modeSelect.addEventListener('change', () => {
            st.mode = modeSelect.value;
            st.started = false;
            st.paused = false;
            sync();
            change('param');
        });

        PhysicsUtils.bindSlider('v0Slider', 'v0Val',
            v => { st.v0 = v; st.started = false; st.paused = false; sync(); change('param'); },
            v => v.toFixed(1));

        PhysicsUtils.bindSlider('aSlider', 'aVal',
            v => { st.a = v; st.started = false; st.paused = false; sync(); change('param'); },
            v => v.toFixed(1));

        startBtn.addEventListener('click', () => {
            st.started = true;
            st.paused = false;
            sync();
            change('start');
        });

        pauseBtn.addEventListener('click', () => {
            st.paused = !st.paused;
            pauseBtn.textContent = st.paused ? '播放 PLAY' : '暫停 PAUSE';
            change('pause');
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            st.started = false;
            st.paused = false;
            sync();
            change('reset');
        });

        // 不在這裡呼叫 onChange。panel 是在實驗檔的 pushCards / updateCards
        // 之前建立的，建構時就回呼會撞上那些 const 的 TDZ。實驗檔自己會在
        // 設定完成後推一次卡片。
        sync();
        return panel;
    }

    // ======================================================================
    // 頁面骨架
    // ======================================================================

    /**
     * 三個實驗的頁面骨架。跑完之後每個實驗檔只剩「縱軸畫什麼」和
     * 「這張圖要強調什麼」——其餘（容器、p5 生命週期、攝影機、縱軸範圍、
     * 卡片推送）三頁完全一樣，抽在這裡才不會改一頁漏兩頁。
     *
     * @param {object} o
     *   o.formula / o.formulaFallback  控制面板的公式（KaTeX 字串）
     *   o.cards     {Array}   createDataCards 的設定
     *   o.yOf       {function(state) => number}  這頁縱軸畫哪個量
     *   o.values    {function(state, panel) => object}  卡片數值
     *   o.plot      {function(p, view, g, state, panel)}  曲線與強調物件
     *   o.titleText {function(mode, panel) => string}     底部黑條文案
     *   o.titleLeft / o.titleRight  圖表框上方的標題與單位
     */
    function run(o) {
        const origCanvas = document.getElementById('physicsCanvas');
        if (!origCanvas) return;
        const container = origCanvas.parentElement;
        origCanvas.remove();
        const ctrlPanel = document.getElementById('controlPanel');
        const guardEl = ctrlPanel || container;

        let simTime = 0;

        // 運動的終點時刻（等減速停住的那一刻、分段變速跑完的那一刻）。
        // 時間軸與縱軸都據此固定住，不再隨 simTime 無限長大。
        //
        // 宣告必須在 buildPanel 之前：onChange 會寫 mEnd，而 let 有 TDZ，
        // 只要 buildPanel 之後有任何一行改成在建構期回呼就會炸。
        let mEnd = Infinity;

        const panel = buildPanel(ctrlPanel, {
            formula: o.formula,
            formulaFallback: o.formulaFallback,
            onChange(reason) {
                if (reason === 'pause') return;
                simTime = 0;
                mEnd = motionEnd(panel.mode, panel.v0, panel.a);
                pushCards();
            },
        });

        mEnd = motionEnd(panel.mode, panel.v0, panel.a);

        const updateCards = PhysicsUtils.createDataCards(o.cards);

        const state = () => stateAt(panel.mode, panel.v0, panel.a, simTime);

        function pushCards() {
            updateCards(o.values(state(), panel));
        }

        function drawScene(p, view, s) {
            // 一定要清畫布。圖表框只有把「框內」塗滿，座標軸的刻度數字與
            // 標題畫在框外，不清的話會一幀一幀疊上去糊成一團。
            p.background(255);

            // 一切繪製都裁切在世界範圍內，否則滿版元素會溢到 contain 的留白區
            p.push();
            view.clip(p.drawingContext);

            // 攝影機要在畫任何東西之前先算好，否則道路與地面會慢一拍。
            // 鏡頭鎖在車上：車子永遠停在畫面的 CAMERA_ANCHOR 處，靠道路捲動
            // 表現移動。用 max(0, ...) 擋住倒捲的話，a < 0 時車子會倒退嚕出畫面。
            const camX = CAR_START_X + s.x * METER - CAMERA_ANCHOR;

            drawSky(p, view);
            drawRoad(p, view, camX);
            drawGround(p, view, camX);
            drawCar(p, view, s.v);
            drawPlot(p, view, s);
            drawTitleBar(p, view, o.titleText(panel.mode, panel));

            p.pop();
        }

        function drawPlot(p, view, s) {
            // 縱軸刻度數依可用高度決定，不是寫死
            const span = view.toScreenY(GRAPH_B) - view.toScreenY(GRAPH_T);
            const ticks = Math.max(2, Math.floor(span / view.len(46, 26)));

            // 縱軸範圍掃「整個時間窗」而不是「到目前為止」。
            //
            // 只掃到目前為止的話，第一幀 simTime = 0 掃不到任何點，
            // niceAxis(0, 0) 會回傳一組假的 ±1，載入後圖上什麼都沒有，
            // 要按了「開始」才長出座標系——這就是「圖表沒有東西」的成因。
            //
            // 掃整個時間窗還有兩個好處：載入當下刻度就是最後的刻度（曲線是
            // 長進一個已經畫好的座標系，不是把座標系撐大），而且車子跑到極值
            // 時縱軸不會一階一階往上跳。時間窗本身單調不減，所以範圍也單調。
            const winEnd = axisEndT(mEnd, simTime);
            let lo = 0, hi = 0;
            for (const q of samplePath(panel.mode, panel.v0, panel.a, winEnd,
                                       o.yOf, Y_SAMPLES)) {
                lo = Math.min(lo, q.y);
                hi = Math.max(hi, q.y);
            }
            const ax = niceAxis(lo, hi, ticks);

            graph(p, view, {
                maxT: simTime,
                endT: mEnd,
                yLo: ax.lo, yHi: ax.hi, yStep: ax.step,
                titleLeft: o.titleLeft,
                titleRight: o.titleRight,
            }, g => {
                // 底稿先畫，亮線再疊上去。取樣點數要夠多，階梯的垂直段
                // 才不會被畫成斜的（stepPath 已經會在分段邊界補點）。
                ghostPath(p, view, samplePath(panel.mode, panel.v0, panel.a,
                                              winEnd, o.yOf, Y_SAMPLES), g);
                o.plot(p, view, g, s, panel);
            });
        }

        const sketch = (p) => {
            p.setup = () => {
                // 務必用 contentSize()（已扣 padding）。用 container.clientWidth 的話，
                // canvas 會比容器內容區大一圈，把三欄版面的右欄推出畫面。
                const { w, h } = PhysicsUtils.contentSize(container);
                const cnv = p.createCanvas(w || 800, h || 500);
                cnv.style('display', 'block');
                cnv.style('flex-shrink', '0');
                p.textFont('Inter');
            };

            p.windowResized = () => {
                const { w, h } = PhysicsUtils.contentSize(container);
                if (w > 0 && h > 0) p.resizeCanvas(w, h);
            };

            p.draw = () => {
                if (!document.contains(guardEl)) return;

                if (panel.started && !panel.paused) {
                    simTime += p.min(p.deltaTime / 1000, 0.1);
                    pushCards();
                }

                const s = state();
                const view = PhysicsUtils.fitViewWH(p.width, p.height, WORLD_W, WORLD_H);
                drawScene(p, view, s);
            };
        };

        pushCards();
        setTimeout(() => { new p5(sketch, container); }, 100);
    }

    // ======================================================================
    // 對外介面
    // ======================================================================
    return {
        WORLD_W, WORLD_H,
        ROAD_TOP, ROAD_H, ROAD_MID, GROUND_BOTTOM,
        CAR_W, CAR_H, CAR_START_X, CAMERA_ANCHOR, METER,
        GRAPH_L, GRAPH_R, GRAPH_T, GRAPH_B,
        MODES, MODE_LABEL, STAGED_A,

        segments, stateAt, accelAreaAt, velocityAreaAt, stepPath, samplePath,
        stopTime, motionEnd,

        niceAxis, fmtTick, timeTicks,
        graph, marker, curve, fillSignedArea, valueBadge, slopeTriangle, dominantArea,

        drawSky, drawRoad, drawGround, drawCar, drawTitleBar,
        buildPanel, run,
    };
})();
