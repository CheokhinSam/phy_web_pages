/**
 * 🧲 MagneticKit — 磁場的純物理（沒有任何 DOM）
 *
 * 這一支只做一件事：給定一組**場源**，算出空間中任何一點的磁場 B，以及
 * 由它衍生出來的東西（磁力線、磁通量、感生電動勢、力矩、洛倫茲半徑）。
 *
 * 為什麼要獨立一支：磁力線、帶電粒子的軌跡、穿過線圈的磁通量，這三件事
 * 在畫面上是三個不同的東西，可是它們**必須來自同一個 B**。五頁磁學共用
 * 這一個場，就像七頁電學共用同一個 MNA 求解器——「畫的」和「算的」是
 * 同一份，這一類錯誤在結構上就不可能發生。
 *
 * ==========================================================================
 * ⚠️ 座標約定（整支模組和所有頁面都靠這一條）
 * ==========================================================================
 * 世界座標是**螢幕慣例**：x 向右、y **向下**（和網站其他部分一致）。
 *
 * 在這個平面上定義「穿出螢幕指向觀察者」為 +z。於是：
 *
 *   電流**穿出螢幕**（⊙，流向觀察者）→ 磁力線在畫面上是**逆時針**
 *   電流**穿入螢幕**（⊗，遠離觀察者）→ 磁力線在畫面上是**順時針**
 *
 * ⚠️ 但 (x 右, y 下, z 出) 是**左手系**。所以真正的外積在這裡會差一個
 *    負號——下面 crossZ() 就是那個負號的唯一住處。**頁面不要自己寫外積**，
 *    要算 F = qv×B 就呼叫 lorentzForce()。這一條有測試盯著（verify-magnetism
 *    的 ①），因為寫錯的症狀是「粒子往反方向繞」，而那個畫面上看起來很合理。
 *
 * 場源的 `I` 一律定義為**正 = 穿出螢幕**。負值就是穿入。
 *
 * ==========================================================================
 * ⚠️ 場源上的 `u`：座標單位換成公尺（**每一頁都必須填**）
 * ==========================================================================
 * 幾何（x、y、len）用的是各頁自己的座標單位，而 MU0 是 SI 常數。這兩件事
 * 湊在一起就會出事：1 世界單位 = 0.2/900 公尺的那一頁，餵進來的座標被當成
 * 公尺算，畫出來的**方向完全正確**（磁力線的形狀與尺度無關），**數字卻差了
 * 2×10⁷ 倍**——卡片印出 3.98e-7 mT，而同一點的物理答案是 8 mT。
 *
 * 所以每個場源要帶一個 `u` = **一個座標單位等於幾公尺**（預設 1，也就是
 * 座標本來就是公尺）。sourceField() 用它把結果換算回特斯拉：
 *
 *   導線    B ∝ μ0I/(2πr)      → 差一個長度，除以 u
 *   雙極    B ∝ μ0p/(4πr²)     → 差兩個長度，除以 u²
 *
 * ⚠️ 這兩種**不是同一個次方**，所以不能在頁面上「統一乘一個係數」了事——
 *    同一頁只要同時出現導線與磁鐵，那種寫法就必然錯一個。u 掛在場源上，
 *    就會跟著 fieldAt() 一路傳下去（traceLine 內部也吃得到），頁面不必管。
 *
 * ⚠️ 忘了填 u 的症狀是「圖全對、數字全錯」，肉眼檢查圖形抓不到。
 *    verify-magnetism.js ⑪ 有專門一條在盯這件事。
 */
var MagneticKit = (function () {
    'use strict';

    const MU0 = 4 * Math.PI * 1e-7;      // T·m/A

    /** 平面向量的外積 z 分量（正 = 指向螢幕外）。
     *  參數是螢幕座標 (x 右, y 下)，回傳的是「穿出螢幕」方向的分量。 */
    const crossZ = (ax, ay, bx, by) => ay * bx - ax * by;

    /** 投影到單位向量上 */
    const dot = (ax, ay, bx, by) => ax * bx + ay * by;

    /** 一個座標單位等於幾公尺。沒填就是 1（座標本來就是公尺）。 */
    const scaleOf = s => (s.u > 0 ? s.u : 1);

    // ======================================================================
    // 場源
    // ======================================================================
    // 每一種場源都提供同一件事：在 (x, y) 產生的 (bx, by)。
    //
    //   {kind:'wire',     x, y, I}                    無限長直導線，⊥ 螢幕
    //   {kind:'magnet',   x, y, angle, p, len}        條形磁鐵（雙極模型）
    //   {kind:'solenoid', x, y, angle, N, I, len}     螺線管
    //
    // ⚠️ 磁鐵與螺線管都用**雙極模型**（把兩端當成兩個磁極）。磁單極並不
    //    存在，但這是課本畫條形磁鐵磁力線的標準模型，畫出來的形狀與真實
    //    條形磁鐵一致（內部 N→S、外部 N 出 S 入、磁力線封閉）。
    //    螺線管的極強度 p 是由「管內磁場必須等於 μ0NI/ℓ」**反推**出來的
    //    （見 solenoidPoleStrength），所以圖上畫的和卡片印的是同一個數。

    /** 螺線管的等效極強度：讓軸心處的磁場正好等於 μ0NI/ℓ。
     *  軸心處  B = μ0 p / (2π (ℓ/2)²)  ≡ μ0 N I / ℓ
     *       →  p = π · ℓ · N · I / 2
     *
     *  ⚠️ **ℓ 要用公尺**（和 p 的單位 A·m 一致）。呼叫端如果手上的長度是
     *     座標單位，要自己乘上 u 再進來——magnetPoles() 就是這樣做的。
     *     一度讓這裡吃座標長度，配上 u 之後軸心場變成 μ0NI/(ℓ·u²)，差 4500 倍。
     *     （兩個極的貢獻在軸心同向相加，所以分母是 2π 不是 4π。）              */
    function solenoidPoleStrength(N, I, len) {
        return Math.PI * len * N * I / 2;
    }

    /** 螺線管內部的理論磁場（安培定律，無限長近似） */
    function solenoidField(N, I, len) {
        return MU0 * N * Math.abs(I) / len;
    }

    /** 磁鐵的兩個極在世界座標上的位置 */
    function magnetPoles(s) {
        const len = s.len == null ? 120 : s.len;
        const a = s.angle || 0;              // 弧度，+x 方向為 0，往 +y（下）為正
        const hx = Math.cos(a) * len / 2, hy = Math.sin(a) * len / 2;
        // ⚠️ 螺線管的極強度是**算出來的**，不是使用者給的。這裡一度讓它沿用
        //    條形磁鐵的預設值 p = 40，結果磁力線的形狀完全正確、數字卻差了
        //    7071 倍（螺線管的 p 可以到數十萬）——圖看起來毫無異狀。
        //    verify-magnetism ③ 那條「軸心場 = μ0NI/ℓ」就是抓這個的。
        const p = s.kind === 'solenoid'
            ? solenoidPoleStrength(s.N, s.I, len * scaleOf(s))
            : (s.p == null ? 40 : s.p);      // 極強度 (A·m)
        // N 極在 from 那一端。預設 angle=0 時 N 在左、S 在右——
        // 和 CircuitKit 電池「from 是 +」同一個方向感。
        return {
            n: { x: s.x - hx, y: s.y - hy },
            s: { x: s.x + hx, y: s.y + hy },
            p,
        };
    }


    /** 單一磁極的貢獻：B = μ0 p / (4π r²)，方向沿著 r̂（從極指向該點）。
     *  u 是「一個座標單位幾公尺」——r² 差兩個長度，所以換算要除以 u²。 */
    function poleField(px, py, p, x, y, out, u) {
        const dx = x - px, dy = y - py;
        const r2 = dx * dx + dy * dy;
        const r = Math.sqrt(r2);
        if (r < 1e-9) return;                // 極點本身：奇異點，跳過
        const k = MU0 * p / (4 * Math.PI * r2) / r / (u * u);
        // N 極（p>0）發出、S 極（p<0）吸入——都沿著 r̂ 的 ± 方向
        out.bx += k * dx;
        out.by += k * dy;
    }

    /** 場源在單一點的貢獻。r 太小的奇異點會被夾住，免得畫出 NaN。 */
    function sourceField(s, x, y, out) {
        const u = scaleOf(s);
        if (s.kind === 'wire') {
            const dx = x - s.x, dy = y - s.y;
            let r2 = dx * dx + dy * dy;
            // 觀測點到導線軸的距離下限：1 mm。沒有它的話，取樣點正好落在
            // 導線上會得到 Infinity，整張圖當場爆掉（B–r 圖就是這樣畫的）。
            //
            // ⚠️ 這個下限以前寫成常數 4（座標單位²，等於「2 個座標單位」）。
            //    對世界座標的頁面那是 0.44 mm，對直接用公尺的驗證卻是 **2 公
            //    尺**——同一個數字在兩邊不是同一件事。改成帶單位的物理量之後
            //    （除以 u 換算成座標單位）兩邊才真的在講同一個下限。
            const rmin = 1e-3 / u;
            if (r2 < rmin * rmin) r2 = rmin * rmin;
            // B = μ0 I / (2π r²) · (dy, −dx)，I 正 = 穿出螢幕
            // （推導見檔頭：穿出螢幕用左手系會差一個負號，這裡已經吸收掉）
            const k = MU0 * s.I / (2 * Math.PI * r2) / u;
            out.bx += k * dy;
            out.by += k * -dx;
            return;
        }
        if (s.kind === 'magnet' || s.kind === 'solenoid') {
            const pol = magnetPoles(s);
            // N 極帶 +p、S 極帶 −p。磁力線從 N 出去、回到 S。
            poleField(pol.n.x, pol.n.y, pol.p, x, y, out, u);
            poleField(pol.s.x, pol.s.y, -pol.p, x, y, out, u);
            return;
        }
    }

    /**
     * 所有場源在 (x, y) 的總磁場（向量相加）。
     * @returns {{bx:number, by:number}}
     */
    function fieldAt(sources, x, y) {
        const out = { bx: 0, by: 0 };
        for (const s of sources) sourceField(s, x, y, out);
        return out;
    }

    /** 同上，只回傳大小（T） */
    function fieldMag(sources, x, y) {
        const b = fieldAt(sources, x, y);
        return Math.hypot(b.bx, b.by);
    }

    // ======================================================================
    // 磁力線
    // ======================================================================

    /**
     * 從 (x0, y0) 沿著 B 追一條磁力線。四階 Runge–Kutta，步長自適應地
     * 依「場的相對變化」縮小——磁極附近場變化快，固定步長會直接跳過轉彎處。
     *
     * 方向不重要：磁力線是無方向的曲線，從 N 極或 S 極出發都會走上同一條。
     * 這裡固定往 B 的正方向走，走到出界、撞到場源、或步數用完為止。
     *
     * @returns {{pts:Array<{x,y}>, closed:boolean, hitSource:boolean}}
     */
    function traceLine(sources, x0, y0, o) {
        o = o || {};
        const step = o.step || 8;
        const maxSteps = o.maxSteps || 1400;
        const minStep = o.minStep || 0.4;
        const bounds = o.bounds || { x0: 0, y0: 0, x1: 900, y1: 900 };

        const pts = [{ x: x0, y: y0 }];
        let x = x0, y = y0;
        let closed = false, hitSource = false;

        const unit = (px, py) => {
            const b = fieldAt(sources, px, py);
            const m = Math.hypot(b.bx, b.by);
            if (!(m > 0) || !isFinite(m)) return null;
            return { x: b.bx / m, y: b.by / m };
        };

        for (let i = 0; i < maxSteps; i++) {
            const k1 = unit(x, y);
            if (!k1) { hitSource = true; break; }
            // 步長依「這一帶場有多均勻」自動縮：相鄰兩點的場方向差越多，
            // 步就越短。磁極附近的線會轉得很急，這裡不縮就會畫成折角。
            const h = step;
            const k2 = unit(x + k1.x * h / 2, y + k1.y * h / 2) || k1;
            const k3 = unit(x + k2.x * h / 2, y + k2.y * h / 2) || k2;
            const k4 = unit(x + k3.x * h, y + k3.y * h) || k3;

            const turn = Math.abs(crossZ(k1.x, k1.y, k4.x, k4.y));
            const hh = Math.max(minStep, h * Math.min(1, 0.35 / (turn + 0.02)));

            x += (k1.x + 2 * k2.x + 2 * k3.x + k4.x) * hh / 6;
            y += (k1.y + 2 * k2.y + 2 * k3.y + k4.y) * hh / 6;

            if (!isFinite(x) || !isFinite(y)) { hitSource = true; break; }
            if (x < bounds.x0 || x > bounds.x1 || y < bounds.y0 || y > bounds.y1) break;

            pts.push({ x, y });

            // 回到起點附近（而且已經走了一段）→ 這是一條封閉的線
            if (i > 12 && Math.hypot(x - x0, y - y0) < hh * 0.9) {
                closed = true;
                pts.push({ x: x0, y: y0 });
                break;
            }
            // 太靠近某個場源＝被吸進去了
            for (const s of sources) {
                if (s.kind === 'wire') {
                    if (Math.hypot(x - s.x, y - s.y) < 3) { hitSource = true; break; }
                } else {
                    const pol = magnetPoles(s);
                    if (Math.hypot(x - pol.n.x, y - pol.n.y) < 6 ||
                        Math.hypot(x - pol.s.x, y - pol.s.y) < 6) { hitSource = true; break; }
                }
            }
            if (hitSource) break;
        }
        return { pts, closed, hitSource };
    }

    /**
     * 沿著一條線圈繞一圈的種子點（螺線管、亥姆霍茲線圈的磁力線起點）。
     * 回傳 n 個點，分佈在垂直於軸、距離軸 d 的圓上。
     */
    function ringSeeds(cx, cy, angle, d, n) {
        const perp = { x: -Math.sin(angle), y: Math.cos(angle) };
        const out = [];
        for (let i = 0; i < n; i++) {
            const a = 2 * Math.PI * i / n;
            // 投影到螢幕平面：垂直軸的方向 × cos、螢幕外方向 × sin。
            // 螢幕外那個分量在 2D 上看不到，所以只取可見的那一半
            // （|cos| 讓圓看起來像一條線段的兩端來回）。
            const c = Math.cos(a);
            out.push({ x: cx + perp.x * d * c, y: cy + perp.y * d * c, z: Math.sin(a) });
        }
        return out;
    }

    // ======================================================================
    // 磁通量
    // ======================================================================

    /**
     * 穿過一個圓形線圈的磁通量 Φ = ∫B·dA（Wb）。
     *
     * 線圈的軸躺在**畫面內**，方向是 (ax, ay)；線圈半徑 R。
     * 把圓面切成同心圓環，每一環取樣一次場、投影到軸上再乘環面積——
     * 這是標準的數值積分，而且因為雙極模型的場對軸是軸對稱的，取樣點
     * 只要取「垂直於軸、在畫面內」那個方向就代表了整個環。
     *
     * @returns {number} Φ，單位 Wb（乘以匝數 N 請用 coilFlux）
     */
    function fluxThroughCoil(sources, cx, cy, ax, ay, R, rings) {
        const n = rings || 24;
        const am = Math.hypot(ax, ay) || 1;
        const ux = ax / am, uy = ay / am;
        const px = -uy, py = ux;             // 畫面內、垂直於軸

        // ⚠️ 取樣的每一個環面積是 **座標單位²**，而 B 已經是特斯拉，兩者相乘
        //    之後還要乘上 u² 才會得到 Wb（公尺²）。這一格原本漏了 u²。
        //
        //    症狀是「Φ 隨你挑的座標尺度而變」：同一組幾何，u 從 1 改成 5e-4
        //    （1 單位 = 0.5 mm），Φ 就差 4×10⁶ 倍。**畫面上完全看不出來**
        //    ——磁力線的形狀與尺度無關——只有卡片上的 mV 和 V 全錯，
        //    跟檔頭那段「忘了填 u」是同一種病，只是換了一個地方發作。
        //
        //    補上 u² 之後，Φ 對 u 是**不變的**：場 B ∝ 1/u²（雙極），面積
        //    ∝ u²，兩者剛好抵銷。這才是對的物理——穿過一個 5.6 cm 線圈的
        //    磁通，不該取決於你當初是用公尺還是用毫米把它畫出來。
        //    verify-magnetism ⑤ 有一條「換座標尺度，Φ 一動也不動」在盯這件事。
        //
        //    u 取自場源（同一頁必然同一個尺度，check() 會檢查）。
        const u = sources.length ? scaleOf(sources[0]) : 1;
        let phi = 0;
        for (let i = 0; i < n; i++) {
            const rho = R * (i + 0.5) / n;
            const dr = R / n;
            const b = fieldAt(sources, cx + px * rho, cy + py * rho);
            phi += dot(b.bx, b.by, ux, uy) * 2 * Math.PI * rho * dr;
        }
        return phi * u * u;
    }

    /** Φ 乘上匝數（磁通連鎖） */
    function coilFlux(sources, N, cx, cy, ax, ay, R, rings) {
        return N * fluxThroughCoil(sources, cx, cy, ax, ay, R, rings);
    }

    /**
     * 感生電動勢 ε = −N dΦ/dt（V），用**中心差分**。
     *
     * ⚠️ 不用「這一幀的 Φ 減上一幀的 Φ」除以 frame dt。那個做法把 emf 綁在
     *    幀率上，掉幀時數字會突然跳一下；而且面板一改（dt=0）就會除以零。
     *    中心差分取的是**模擬時間**上的固定小間隔 h，和幀率無關。
     *
     * @param {function(number)} fluxAt  給定模擬時間 t 回傳 Φ(t)
     */
    function inducedEmf(fluxAt, t, N, h) {
        const dd = h || 0.004;
        const a = fluxAt(t + dd), b = fluxAt(t - dd);
        if (!isFinite(a) || !isFinite(b)) return 0;
        return -N * (a - b) / (2 * dd);
    }

    // ======================================================================
    // 洛倫茲力與帶電粒子的運動
    // ======================================================================
    // ⚠️ 力是 F = qv×B，而外積在螢幕座標上差一個負號（見檔頭）。
    //    這一支是那個負號唯一被用到的地方，頁面一律呼叫它。

    /**
     * 帶電粒子在**垂直於螢幕**的均勻磁場中的受力。
     *
     * 這是這一頁唯一需要的情形：B 穿出／穿入螢幕，粒子在畫面內繞圈。
     * （磁力線那一頁的 B 是躺在畫面內的，粒子會被推到畫面外，畫不出來，
     * 所以兩頁用的不是同一種場——但都是同一個 B 概念。）
     *
     * @param {number} q  電荷（C，可正可負）
     * @param {number} vx, vy 速度（世界單位／秒，螢幕座標分量）
     * @param {number} bz 磁場**穿出螢幕**的分量（T）。穿入螢幕就給負值
     * @returns {{fx:number, fy:number}} 力，分量在畫面內
     */
    function lorentzForce(q, vx, vy, bz) {
        // F = q·v×B。B 只有 z 分量時，v×B 的平面分量是 bz·(vy, −vx)，
        // 投影回「穿出螢幕」時再吃一次左手系的負號——兩次剛好抵消，
        // 所以最後就是下面這一行。方向由 ① 的測試釘住（正電荷 + B 出
        // 螢幕 → 畫面內逆時針）。
        return { fx: q * bz * vy, fy: -q * bz * vx };
    }

    /** 圓周運動半徑 r = mv/(|q|B)（m 用 kg、v 用 m/s、B 用 T） */
    function lorentzRadius(m, v, q, B) {
        const d = Math.abs(q) * B;
        return d > 0 ? m * v / d : Infinity;
    }

    /** 週期 T = 2πm/(|q|B)。**與速率無關**——這是迴旋加速器的關鍵。 */
    function lorentzPeriod(m, q, B) {
        const d = Math.abs(q) * B;
        return d > 0 ? 2 * Math.PI * m / d : Infinity;
    }

    // ======================================================================
    // 線圈：磁通、力矩、反電動勢
    // ======================================================================
    // 同一個 Φ(θ) = N·B·A·cos θ 導出下面三個式子。這是這一頁的重點：
    // 力矩與反電動勢不是兩個獨立的公式，是**同一個磁通**對角度、對時間
    // 各微一次。所以 τ·ω 必然等於 ε·I（能量守恆），兩個都必須帶 sin θ。
    //
    //   τ = N·B·A·I·sin θ       （轉矩，讓線圈轉）
    //   ε = N·B·A·ω·sin θ       （反電動勢，擋住電流）
    //   τ·ω = N·B·A·I·ω·sin θ = ε·I   ✓

    function coilFluxAngle(N, B, A, theta) { return N * B * A * Math.cos(theta); }
    function coilTorque(N, B, A, I, theta) { return N * B * A * I * Math.abs(Math.sin(theta)); }
    function coilBackEmf(N, B, A, omega, theta) { return N * B * A * omega * Math.abs(Math.sin(theta)); }

    /**
     * 直流電動機的穩態（含反電動勢）。
     * 電流由「電源推的」減「線圈自己產生的反電動勢」決定：
     *   I = (V − ε_back) / R
     * 穩態時電磁轉矩正好抵掉摩擦，所以 ω 不再上升。
     *
     * @returns {{I, torque, backEmf, mechPower, elecPower, ok}}
     */
    function dcMotor(o) {
        const { V, R, N, B, A, omega, theta } = o;
        // ⚠️ `avg` 不是近似，是在描述**不同的機器**：
        //   - `avg` 不給（預設）＝**單一線圈**。力矩與反電動勢都帶 |sin θ|，
        //     每轉四分之一圈脈動一次，θ = 0、π 是換向的死點（力矩為 0）。
        //   - `avg: true`＝**多段換向器的電樞**。真實的馬達繞了好幾組線圈、
        //     換向片也切得很細，整圈平均下來的 |sin θ| 就是 2/π。
        //     課本寫的 τ = NBAI 就是這一個——所以才沒有 sin θ。
        //
        // 兩種情況 τ·ω 與 ε·I 都**逐位相等**：兩個式子拿到的是同一個 k。
        // 這正是能量守恆，也是 verify-magnetism.js ⑦ 在盯的那一條。
        // （舊 motor.js 的反電動勢沒有 sin θ、力矩有，兩邊差一個 |sin θ|，
        //   機械功率輸出就等於不等於電功率輸入——而且畫面上「轉得好好的」。）
        const k = o.avg ? 2 / Math.PI : Math.abs(Math.sin(theta));
        const K = N * B * A;
        const back = K * omega * k;
        const I = Math.max(0, (V - back) / R);
        const torque = K * I * k;
        return {
            I, backEmf: back, torque,
            mechPower: torque * omega,
            elecPower: back * I,
        };
    }

    /** 兩條平行導線之間單位長度的力（N/m）：F/L = μ0·I1·I2/(2πd)。
     *  正值 = 吸引（同向電流），負值 = 排斥（反向電流）。 */
    function parallelWireForce(I1, I2, d) {
        return MU0 * I1 * I2 / (2 * Math.PI * d);
    }

    // ======================================================================
    // 變壓器
    // ======================================================================

    /**
     * @param {object} o
     *   N1, N2      一次／二次匝數
     *   V1          一次電壓（峰值或有效值都可以，只要一致）
     *   R1, R2      兩邊的繞線電阻（Ω）
     *   Rload       二次側的負載（Ω）。null = 開路
     *   leak        漏磁比例 0..1（二次側實際鏈到的磁通佔比）
     *
     * 理想變壓器（R1=R2=0, leak=1）之下 V2/V1 = N2/N1 且 V1·I1 = V2·I2，
     * 兩個都是**精確**的。加上電阻與漏磁之後就不再精確——這一頁先讓學生
     * 看到恆等式，再把損耗打開，看它怎麼壞掉。
     */
    function transformer(o) {
        const { N1, N2, V1, Rload } = o;
        const R1 = o.R1 || 0, R2 = o.R2 || 0;
        const leak = o.leak == null ? 1 : o.leak;
        const k = N1 > 0 ? N2 / N1 : 0;      // 匝數比

        // 理想變壓器的安匝守恆：N1·I1 = N2·I2 → I1 = k·I2
        // 一次側的磁化電流很小，忽略不計；一次電流由二次側的需求決定。
        //
        // 一次側繞線電阻 R1 會讓真正跨在線圈上的電壓變成 V1 − I1·R1，
        // 而 I1 又反過來由 I2 決定——兩邊互相依賴，但可以解成閉式：
        //
        //   V2 = (V1 − I1·R1)·k·leak,  I1 = k·I2,  I2 = V2/(Rload + R2)
        //   ⇒ V2 = V1·k·leak·(Rload+R2) / (Rload+R2 + k²·R1·leak)
        //
        // ⚠️ R1 之前收了卻沒有用到（頁面開滑桿也不會動），這一版才真的接上。
        //    理想情況 R1 = R2 = 0、leak = 1 時，這條式子化簡回 V2 = V1·k。
        let V2 = 0, I2 = 0;
        if (Rload != null && Rload > 0) {
            const den = Rload + R2 + k * k * R1 * leak;
            V2 = den > 0 ? V1 * k * leak * (Rload + R2) / den : 0;
            I2 = V2 / Rload;
        } else {
            // 二次開路：沒有電流，但仍量得到電壓
            V2 = V1 * k * leak;
        }
        const I1 = k * I2;
        const P1 = V1 * I1;
        const P2 = V2 * I2;
        return {
            V2, I1, I2, P1, P2,
            ratioV: V1 !== 0 ? V2 / V1 : 0,
            ratioN: k,
            efficiency: P1 > 0 ? P2 / P1 : 0,
            loss: P1 - P2,
        };
    }

    // ======================================================================
    // 診斷
    // ======================================================================

    /** 場源清單的基本檢查——壞掉的場源要當場說出來，不要安靜地畫一張錯的圖。 */
    function check(sources) {
        const errs = [];
        if (!Array.isArray(sources)) return { ok: false, errors: ['sources 不是陣列'] };
        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            if (!s || typeof s !== 'object') { errs.push(`第 ${i} 個場源不是物件`); continue; }
            if (!isFinite(s.x) || !isFinite(s.y)) errs.push(`第 ${i} 個場源的座標不是有限數`);
            if (!['wire', 'magnet', 'solenoid'].includes(s.kind))
                errs.push(`第 ${i} 個場源 kind="${s.kind}" 不認識`);
            if (s.kind === 'solenoid' && !(s.len > 0))
                errs.push(`第 ${i} 個螺線管的 len 必須是正的`);
            if (s.kind === 'solenoid' && !(s.N > 0))
                errs.push(`第 ${i} 個螺線管的匝數 N 必須是正的`);
            // u 沒填不會壞掉（預設 1），但填了負值或 0 會讓整個場變成 NaN 或反向
            if (s.u != null && !(s.u > 0))
                errs.push(`第 ${i} 個場源的 u（每單位幾公尺）必須是正的`);
        }
        // 同一張圖上的場源必須共用同一個座標尺度。混用不是「彈性」，是那張圖
        // 根本沒有比例可言——一個 1 單位 = 1 mm 的導線和一塊 1 單位 = 1 m 的
        // 磁鐵畫在一起，圖上的距離不可能是兩者真實的距離。
        //
        // ⚠️ 這條檢查是 fluxThroughCoil 需要的：它從 sources[0] 取 u 來把
        //    面積換算成公尺²，混用時那個 u 對其他場源就是錯的。與其讓磁通
        //    安靜地算錯，不如當場說出來。
        {
            const us = sources.filter(s => s && typeof s === 'object' && s.u != null)
                              .map(s => scaleOf(s));
            if (us.length > 1 && us.some(v => v !== us[0]))
                errs.push('同一組場源的 u 不一致——這張圖沒有統一的座標尺度，' +
                          '磁通量無法換算成 Wb');
        }
        return { ok: errs.length === 0, errors: errs };
    }

    return {
        MU0, crossZ, dot,

        // 場源與場
        fieldAt, fieldMag, magnetPoles, solenoidPoleStrength, solenoidField,

        // 磁力線
        traceLine, ringSeeds,

        // 磁通量與感應
        fluxThroughCoil, coilFlux, inducedEmf,

        // 洛倫茲
        lorentzForce, lorentzRadius, lorentzPeriod,

        // 線圈、電動機
        coilFluxAngle, coilTorque, coilBackEmf, dcMotor, parallelWireForce,

        // 變壓器
        transformer,

        check,
    };
})();
