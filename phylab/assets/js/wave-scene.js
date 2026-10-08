/**
 * 🪢 WaveScene — 繩波系列（04 產生與傳播、05 疊加、06 反射、07 折射、08 駐波）
 *                 共用的場景、波的數學與控制面板
 *
 * 五頁看的是同一條繩子，只是問的問題不同：
 *   04 → 波怎麼產生、波速由誰決定
 *   05 → 兩個波相遇會怎樣
 *   06 → 撞到端點會怎樣
 *   07 → 穿過接點會怎樣
 *   08 → 兩端固定的繩子能震出哪些花樣
 *
 * ⚠️ 全部包在 IIFE 裡。實驗檔是在同一個 classic script 環境執行的，
 *    若這裡用 top-level `const` 洩漏出 WORLD_W，會和實驗檔裡同名的常數撞成
 *    "Identifier has already been declared"。所以對外用 `var WaveScene`，
 *    而且實驗檔不要重複宣告這裡已經宣告過的名字。
 *
 * ⚠️ 座標系統：先宣告固定的「邏輯世界」，所有座標與尺寸都用世界單位，
 *    繪製前才經 PhysicsUtils.fitViewWH() 換算成像素。
 *    唯一的例外是波的振幅——見下面〈垂直放大〉。
 *
 * ==========================================================================
 * 物理約定（五頁共用，逐條都有數值驗證）
 * ==========================================================================
 * 繩波速度由介質決定：      v = √(T / μ)      T 張力、μ 線密度
 * 波阻抗：                  Z = √(Tμ) = T / v
 * 振幅反射係數：            r = (Z₁−Z₂)/(Z₁+Z₂) = (v₂−v₁)/(v₁+v₂)
 * 振幅透射係數：            τ = 1 + r        （繩子不能斷：界面位移連續）
 * 能量通量：                P = Z ω² A² / 2，且 P_in = P_re + P_tr
 *
 * 界面的兩個邊界條件就是「位移連續」與「斜率連續（張力相同）」，
 * 這兩條推出來的 r 與阻抗法一模一樣——verify-waves.js 會逐位比對這件事。
 *
 * 固定端 = 第二段介質無限重（v₂ → 0） → r = −1（相位反轉）
 * 自由端 = 第二段介質無限輕（v₂ → ∞） → r = +1（不反轉）
 * 所以 06 是 07 的兩個極限，不是兩套不同的物理。
 */
var WaveScene = (function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（世界單位）
    // ======================================================================
    // ⚠️ 900 不是隨便挑的。三欄版面在 1600×950 之下，中央畫布實測是
    //    804×803——幾乎正方形。世界若用 1000×700（1.43），fitViewWH 只能
    //    遷就寬度，上下各被 letterbox 掉 120px，整整 30% 的畫布是白的。
    //    1000×900（1.11）在這個尺寸下只浪費 40px，跟力學系列的
    //    motion-scene.js 同一組數字，兩系列看起來才像一家人。
    const WORLD_W = 1000;
    const WORLD_H = 900;

    // 繩子本體：8.00 公尺，畫在 70..950 之間
    const ROPE_M    = 8.0;                 // 繩長（公尺）
    const ROPE_L    = 70;
    const ROPE_R    = 950;
    // 水平比例：世界單位 / 公尺。物理量全部用公尺，所以比例也用公尺為單位，
    // 免得每個地方都要記得「這裡要乘 100 換成公分」——那種 100 倍的錯
    // 不會讓畫面爆掉，只會讓取樣點數默默差兩個數量級，很難查。
    const X_SCALE   = (ROPE_R - ROPE_L) / ROPE_M;    // = 110 世界單位 / 公尺

    // 繩子佔的垂直帶狀區域，lane 在這個範圍裡平分
    // （沒有時間圖的頁面用這組預設值；04 有自己的時間圖，會另外傳 band）
    const BAND_T = 180;
    const BAND_B = 740;

    const TITLE_TOP = 812;
    const TITLE_H   = 48;

    /**
     * 垂直放大。繩波圖一定要把振幅誇大才看得見——8 公尺長的繩子若照
     * 1:1 畫 4 公分的振幅，振幅只有 0.5% 的繩長，是一條直線。
     * 水平和垂直用不同的比例是這類圖的標準做法，但要在內文講清楚，
     * 否則學生會以為波真的很陡。
     */
    const AMP_SCALE = 15;                  // 世界單位 / 公分（1 條 lane 時）

    // 一個波長至少取這麼多點。實測誤差：8 點 7.6%、16 點 1.9%、
    // 24 點 0.86%、32 點 0.48%。取 32 是為了讓繩子在最高頻時還是平滑曲線
    // 而不是折線，同時點數還在幾百個以內。
    const SAMPLES_PER_LAMBDA = 32;

    // ======================================================================
    // 介質與波的參數
    // ======================================================================

    /** 一段繩子的介質性質。v = √(T/μ)。 */
    function medium(T, mu) {
        const v = Math.sqrt(T / mu);
        return { T, mu, v, Z: Math.sqrt(T * mu), lambda: f => v / f };
    }

    /** 頻率 → 角頻率。頻率由波源決定，跨介面不變。 */
    const omega = f => 2 * Math.PI * f;

    /** 波數 k = 2π/λ = ω/v。 */
    const waveNumber = (f, v) => 2 * Math.PI * f / v;

    /**
     * 界面兩側的振幅反射／透射係數。
     *
     * ⚠️ 這裡用阻抗算 (Z₁−Z₂)/(Z₁+Z₂)，不是用速度算 (v₂−v₁)/(v₁+v₂)。
     *    兩者只有在**張力相同**時才等價——因為 Z = T/v，同 T 時
     *    Z₁/Z₂ = v₂/v₁，代入就化簡成速度版。繩子接繩子張力當然一樣，
     *    所以本系列五頁兩式永遠同值；但張力不同時（例如一條繩子接一條
     *    彈簧）就只有阻抗版是對的。阻抗版是一般式，所以用它。
     *
     * 內文寫的會是化簡後的速度版，因為那個版本學生可以自己用 v = √(T/μ)
     * 算出來，不需要先認識阻抗。
     */
    function coefficients(m1, m2) {
        const r = (m1.Z - m2.Z) / (m1.Z + m2.Z);
        return { r, tau: 1 + r };
    }

    /**
     * 【入射 → 界面 → 反射 + 透射】最一般的那一條式子。
     *
     * 所有相位都以界面為原點（d = x − xj），所以：
     *   d ≤ 0（左邊那段）：入射波 + 反射波
     *   d > 0（右邊那段）：透射波
     *
     * 界面上 value 與 slope 都連續：
     *   值   A sin(ωt) + rA sin(ωt) = τA sin(ωt)          ← 因為 τ = 1 + r
     *   斜率 k₁(1−r)A cos(ωt) = k₂τA cos(ωt)              ← 邊界條件推出來的
     *
     * 06 的固定端／自由端就是把 r 取 −1 / +1，第二段不存在（xj 放在繩子右端）。
     */
    function decompose(o) {
        const A = o.A, w = o.omega, xj = o.xj || 0;
        const k1 = o.k1, k2 = o.k2 == null ? o.k1 : o.k2;
        const r = o.r, tau = o.tau == null ? 1 + r : o.tau;
        const phase = o.phase || 0;

        const incident = (x, t) => {
            const d = x - xj;
            return A * Math.sin(w * t - k1 * d + phase);
        };
        const reflected = (x, t) => {
            const d = x - xj;
            return r * A * Math.sin(w * t + k1 * d + phase);
        };
        const transmitted = (x, t) => {
            const d = x - xj;
            return tau * A * Math.sin(w * t - k2 * d + phase);
        };
        const total = (x, t) => (x - xj <= 0
            ? incident(x, t) + reflected(x, t)
            : transmitted(x, t));

        return { incident, reflected, transmitted, total, r, tau, xj };
    }

    /**
     * 行進波（單獨一條，用於 04）。dir = +1 向右、−1 向左。
     * env(u) 是包絡（0..1），給脈衝或波列用；不給就是等幅連續波。
     */
    function traveling(o) {
        const A = o.A, k = o.k, v = o.v;
        const dir = o.dir == null ? 1 : o.dir;
        const x0 = o.x0 || 0;
        const phase = o.phase || 0;
        const env = o.env || null;
        return function (x, t) {
            const u = x - x0 - dir * v * t;
            return (env ? A * env(u) : A) * Math.sin(k * u + phase);
        };
    }

    /**
     * 【會動的波源】——都卜勒效應。26 都卜勒那一頁靠這支。
     *
     * 波源在 x_s(t) = x0 + vs·t 上以角頻率 ω 振動。觀察者在 x 收到的，
     * 是波源在**較早的時刻** t′ 發出的訊號——因為波得花 (t − t′) 的時間
     * 走完它和波源之間的距離，而那段距離是以 v 走的：
     *
     *     |x − x_s(t′)| = v·(t − t′)
     *
     * 這一條叫**延遲時間**（retarded time）。解出來就是下面那兩支，
     * 而整條波的性質全部從這裡掉出來——不必另外假設「頻率會變」：
     *
     *   波源前方   t′ = (vt − (x − x₀))/(v − vs)   λ′ = (v − vs)/f   擠密
     *   波源後方   t′ = (vt + (x − x₀))/(v + vs)   λ′ = (v + vs)/f   拉疏
     *   觀察到的頻率                                 f′ = f·v/(v ∓ vs)
     *
     * 兩支在 x = x_s(t)（波源的**現在**位置）剛好都給 t′ = t，所以接得起來；
     * 那個位置也正是「前方／後方」的分界。
     *
     * ⚠️ 波源跑得比波快（|vs| ≥ v）時這兩式無解或給出負的時間——那是
     *    **震波**，不是都卜勒。滑桿上限必須壓在 v 以下（verify-waves.js 有
     *    反面斷言：把 vs 開到 v 以上必須讓斷言變紅）。
     *
     * ⚠️ t′ < 0 代表那個時刻波源還沒開始振動 → 位移 0。這一條同時就是
     *    「波前還沒到」的守衛，不必另外接 env：t′ ≥ 0 的範圍恰好是
     *    [x₀ − vt, x₀ + vt]。
     */
    function movingSource(o) {
        const A = o.A, w = o.omega, v = o.v, vs = o.vs;
        const x0 = o.x0 || 0;
        const phase = o.phase || 0;
        return function (x, t) {
            const d = x - x0;
            const tp = (d >= vs * t)
                ? (v * t - d) / (v - vs)          // 觀察者在波源前方
                : (v * t + d) / (v + vs);         // 觀察者在波源後方
            if (tp < 0) return 0;
            return A * Math.sin(w * tp + phase);
        };
    }

    /**
     * 都卜勒：波源以 vs 接近（dir = +1）／遠離（dir = −1）時，觀察到的頻率。
     * 就是 movingSource() 那個相位對 t 微分掉的結果，頁面與驗證器共用同一條，
     * 免得內文寫的公式和畫面上量到的東西各算各的。
     */
    function dopplerFreq(f, v, vs, dir) {
        return f * v / (v - dir * vs);
    }

    /**
     * 都卜勒（觀察者動、波源不動）：f′ = f·(v + dir·v₀)/v。
     *
     * 和 movingSource() 那一支是**兩件不同的事**，這一點是這一頁的重點：
     * 波源動的時候介質裡的波長真的被壓縮了（λ′ = (v∓vs)/f），
     * 觀察者動的時候介質裡的波長**一點都沒變**，變的只是「一秒掃過幾個波峰」。
     * 兩個公式在 v ≪ c 時形狀相似，但成因完全不同。
     */
    function dopplerObserver(f, v, vo, dir) { return f * (v + dir * vo) / v; }

    /** 高斯脈衝。教科書上「兩個脈衝相遇」用的就是這個形狀。 */
    function pulse(o) {
        const A = o.A, width = o.width, v = o.v;
        const dir = o.dir == null ? 1 : o.dir;
        const x0 = o.x0 || 0;
        return function (x, t) {
            const u = (x - x0 - dir * v * t) / width;
            return A * Math.exp(-u * u);
        };
    }

    /** 高斯脈衝的「波形」F(u)，峰在 u = 0。給 scatter 用。 */
    const pulseShape = w => u => Math.exp(-(u / w) * (u / w));

    /**
     * 連續波從 t = 0 開始、從 x = 0 出發的「波形」F(u)。給 scatter 用。
     * u > 0 代表波前還沒到，位移是 0。
     */
    const waveShape = (f, v) => {
        const k = 2 * Math.PI * f / v;
        return u => u > 0 ? 0 : -Math.sin(k * u);
    };

    /**
     * 【一條波撞上界面】的完整分解——脈衝與連續波共用同一條式子。
     *
     * 關鍵是把「波形」抽成一個純函式 F(u)（峰在 u = 0），三個波都只是把
     * 同一個 F 餵不同的引數：
     *
     *   入射   y = A·F((x − x₀) − v₁t)              峰以 v₁ 向右跑
     *   反射   y = rA·F((2x_j − x₀ − x) − v₁t)       把入射對界面鏡射，峰向左跑
     *   透射   y = τA·F((v₁/v₂)·[(x − x_j) − v₂(t − t_j)])
     *
     * 鏡射那一條就是「鏡像法」：固定端 r = −1 時，界面上
     * inc + ref = inc − inc ≡ 0；自由端 r = +1 時，兩條的斜率剛好差一個
     * 負號，和為 0——兩個邊界條件都自動成立，不必另外寫特例。
     *
     * 透射那個 (v₁/v₂) 是這一頁真正的重點。介面看到的是一段**隨時間**變化
     * 的位移；波過了界面之後速度變成 v₂，要在同一個界面上重現同樣的時間
     * 變化，空間上就得拉長 v₂/v₁ 倍。所以**波長比 = 波速比，但頻率不變**。
     * （寫成 y = τA·F(v₁x/v₂ − v₁t) 更清楚：時間的部分 v₁t 原封不動。）
     *
     * 連續波取 F(u) = −sin(k₁u) 代入後，這三條會化簡成 decompose() 的
     * 入射／反射／透射（只差一個相位 −k₁x_j），verify-waves.js 有逐點比對。
     */
    function scatter(o) {
        const A = o.A, v1 = o.v1, v2 = o.v2, xj = o.xj;
        const x0 = o.x0 || 0;
        const r = o.r, tau = o.tau == null ? 1 + r : o.tau;
        const F = o.shape;
        const tj = (xj - x0) / v1;          // 波前抵達界面的時刻
        const ratio = v1 / v2;

        const incident    = (x, t) => A * F((x - x0) - v1 * t);
        const reflected   = (x, t) => r * A * F((2 * xj - x0 - x) - v1 * t);
        // 不加「t < t_j 就回 0」的守衛。連續波的波前已經編在 F 裡面
        // （u > 0 → 0），而高斯脈衝本來就沒有尖銳波前、尾巴會先到；
        // 加了守衛反而會在 t_j 憑空造出一個跳斷。
        const transmitted = (x, t) =>
            tau * A * F(ratio * ((x - xj) - v2 * (t - tj)));
        const total = (x, t) => x <= xj
            ? incident(x, t) + reflected(x, t)
            : transmitted(x, t);

        return { incident, reflected, transmitted, total, r, tau, xj, tj };
    }

    /** 把幾個位移函式相加。線性疊加——05 的整個教學重點就是這件事。 */
    function sum(fns) {
        const list = fns.filter(Boolean);
        if (list.length === 1) return list[0];
        return function (x, t) {
            let s = 0;
            for (const f of list) s += f(x, t);
            return s;
        };
    }

    /**
     * 駐波。兩端固定時波長被繩長鎖住：L = nλ/2。
     *
     *   y(x, t) = A sin(nπx/L) cos(ωt)
     *
     * 節點在 x = mL/n（sin 為 0，永遠不動），腹點振幅 A（若由兩條振幅
     * A/2 的行進波疊加而來，腹點就是 2×(A/2) = A）。
     */
    function standing(o) {
        const n = o.n, L = o.L, A = o.A, w = o.omega;
        const k = n * Math.PI / L;
        return function (x, t) {
            return A * Math.sin(k * x) * Math.cos(w * t);
        };
    }

    /**
     * 應變極值的選點：行進波 ξ(x, t) = A sin(k(x − v t)) 上，「擠得最緊」與
     * 「拉得最開」的那一點在哪裡。
     *
     * 應變 ∂ξ/∂x = Ak cos(k(x − v t))，所以
     *   phase = 0        → 應變 = +Ak → **疏部**
     *   phase = π        → 應變 = −Ak → **密部**
     * 兩者相隔半個波長，λ 短的時候兩個徽章會疊在一起，所以第二個要避開第一個。
     *
     * ⚠️ 位置要**從相位算**，不要寫死「波源後面 25%」這種比例：介質一換
     *    λ 就變了，比例不動而波長動，徽章就站到一個應變不是極值的地方——
     *    畫面上只是兩顆徽章微微歪掉，不會有任何錯誤訊息。
     *
     * ⚠️ 候選要掃得夠寬（span）。λ 大的時候整條繩子裡擠不進幾個極值，
     *    只掃 j = 0..2 會在波速最快的介質下整個徽章不見，而畫面不會報錯。
     *
     * o 的欄位：
     *   v, lam, t      這一刻的波（公尺、秒）——波往 +x 走（往 −x 的頁面把 v 傳負的）
     *   phase          0（疏部）或 Math.PI（密部）
     *   front          波前的位置（公尺）。預設 Infinity
     *   x0, x1         可以擺徽章的區間（公尺）
     *   edge           兩端各留多少（徽章本身有寬度），預設 0.5
     *   anchor         想靠近誰，預設區間中點
     *   avoid          已經被佔掉的位置（一個數字或一串），預設沒有
     *   avoidD         avoid 的禁區半徑，預設 0.8
     *   span           往兩邊各掃幾個波長，預設 8
     *
     * ⚠️ **波前一定要傳。** 波前之外（x > front）位移整段是 0、應變也是 0，
     *    那裡的「極值」是一個不存在的東西：波還沒到的空氣是靜止的，在它底下
     *    標一顆「密部」正好講相反（23 頁的波前跑得比管子長，整整四秒都踩在
     *    這個坑上）。掃描的 j 是雙向的，所以少了 front 這一關，徽章會**優先**
     *    選中波前外面那一個——它在畫面上完全正常，只是指著一段還沒被擾動的空氣。
     *
     * 回傳公尺；區間裡一個候選都沒有時回 null（λ 比整條繩子還長、或波前
     * 還沒進到區間裡，都會這樣）。
     */
    function strainExtremumX(phase, o) {
        const x0 = o.x0 == null ? 0 : o.x0;
        const x1 = o.x1 == null ? ROPE_M : o.x1;
        const edge = o.edge == null ? 0.5 : o.edge;
        const anchor = o.anchor == null ? (x0 + x1) / 2 : o.anchor;
        const avoid = o.avoid == null ? [] : (Array.isArray(o.avoid) ? o.avoid : [o.avoid]);
        const avoidD = o.avoidD == null ? 0.8 : o.avoidD;
        const span = o.span == null ? 8 : o.span;
        const front = o.front == null ? Infinity : o.front;

        let best = null, bestD = Infinity;
        for (let j = -span; j <= span; j++) {
            const x = o.v * o.t + (phase + 2 * Math.PI * j) * o.lam / (2 * Math.PI);
            if (x < x0 + edge || x > x1 - edge) continue;
            if (x > front) continue;                  // 波還沒到，那裡沒有疏密
            if (avoid.some(a => a != null && Math.abs(x - a) < avoidD)) continue;
            const d = Math.abs(x - anchor);
            if (d < bestD) { bestD = d; best = x; }
        }
        return best;
    }

    /**
     * 圓（圓心 cx, cy、半徑 r）有沒有任何一點落在矩形 (x0, y0)–(x1, y1) 裡？
     *
     * 兩個條件都要問，缺一不可：
     *   ① 圓心到矩形的**最近**距離 ≤ r → 圓有探進矩形裡
     *   ② 圓心到矩形的**最遠**距離 ≥ r → 矩形沒有整塊被圓包住
     * ②漏掉的症狀是：t 一大（波前半徑 20 m、水塘只有 8 m），每一條波前都會
     * 被判成「看得到」，畫面上就是幾百條根本不會出現的圓在等著畫。
     *
     * 26 都卜勒（水塘）與 33 音爆（航線圖）共用這一支——兩個頁面各寫一份的
     * 話，「圓太大／太小」那兩個邊界會在其中一頁被修好、另一頁留著。
     * 四個座標與半徑必須是**同一個尺度**（公尺就全部公尺）。
     */
    function circleCrossesRect(cx, cy, r, x0, y0, x1, y1) {
        const dxNear = Math.max(x0 - cx, 0, cx - x1);
        const dyNear = Math.max(y0 - cy, 0, cy - y1);
        const dNear = Math.hypot(dxNear, dyNear);
        const dFar = Math.hypot(Math.max(cx - x0, x1 - cx), Math.max(cy - y0, y1 - cy));
        return dNear <= r && r <= dFar;
    }

    /**
     * 一支鉛直的量測括號（一條線 + 兩端的箭頭 + 中間的標籤），吃**畫布像素**。
     *
     * ⚠️ 27 繞射的「開口寬 a」「兩開口中心距 d」與 34 干涉的「波源距離 d」
     *    用的是同一支。兩個頁面各寫一份的話，會被改到的那一份只在一頁看得出
     *    差異——而它標的是尺寸，尺寸標錯**不會有任何數值斷言變紅**。
     */
    function vBracket(p, view, x, yTop, yBot, label, col) {
        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(view.len(2, 1));
        p.line(x, yTop, x, yBot);
        for (const e of [[yTop, 1], [yBot, -1]]) {
            p.line(x, e[0], x - view.len(9, 5), e[0] + e[1] * view.len(9, 5));
            p.line(x, e[0], x + view.len(9, 5), e[0] + e[1] * view.len(9, 5));
        }
        if (!label) return;
        const size = view.len(14, 8);
        p.noStroke();
        p.textSize(size);
        p.textStyle(p.BOLD);
        const tw = p.textWidth(label);
        const mid = (yTop + yBot) / 2;
        p.fill(255);
        p.rect(x - tw / 2 - view.len(5, 3), mid - size / 2 - view.len(4, 2),
               tw + view.len(10, 6), size + view.len(8, 4));
        p.fill(col[0], col[1], col[2]);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(label, x, mid);
    }

    /**
     * 水面高度的色階：**橙＝波峰、白＝水面、藍＝波谷**（和 07/08 兩頁的藍橘一致）。
     *
     * 輸入是 −1…+1（正規化過的瞬時水面高度），輸出是 256×3 的 RGB 表。
     * 振幅先開根號再上色——不然 |位移| 小的時候整片都停在白色附近，什麼都看不到。
     *
     * ⚠️ **兩頁畫同一片水，顏色就只能有一份。** 27 繞射與 34 干涉都是「二維
     *    水槽的高度場」，兩邊各建一張表的話，會被改到的那一張**只在其中一頁
     *    看得出差異**——同一片水在兩頁是兩個顏色，而兩頁的數值斷言全綠
     *    （顏色不是物理，沒有任何一條在掃它）。所以表和用它的圖例一起搬進來，
     *    頁面只透過 `WaveScene.waterRamp` 取用（同 `circleCrossesRect` 的理由）。
     */
    const waterRamp = (() => {
        const LO = [37, 99, 235], MID = [248, 250, 252], HI = [234, 88, 12];
        const a = new Uint8Array(256 * 3);
        for (let i = 0; i < 256; i++) {
            const u = i / 127.5 - 1;
            const to = u < 0 ? LO : HI;
            const q = Math.sqrt(Math.abs(u));
            for (let c = 0; c < 3; c++) {
                a[i * 3 + c] = Math.round(MID[c] + (to[c] - MID[c]) * q);
            }
        }
        return a;
    })();

    // ======================================================================
    // 版面：lane（繩子的橫列）
    // ----------------------------------------------------------------------
    // 「分解顯示」在 06/07 是同一件事：把入射、反射、透射各畫一條淡的，
    // 合成的畫粗的。所以用 lane 陣列來描述，頁面只要說「這頁要幾條」。
    // ======================================================================

    /**
     * 第 i 條 lane 的基準線世界 y（把 n 條平分整個帶狀區）。
     *
     * band 可以不給，預設是模組的 BAND_T/BAND_B。04 因為下面還要放一張
     * 時間圖，繩子只能佔上半部，就自己傳一組進來——與其為它改動預設值
     * （那會讓 05–08 的繩子全部擠在上半部），不如讓帶狀區變成參數。
     */
    function laneBaseY(i, n, band) {
        const [bt, bb] = band || [BAND_T, BAND_B];
        if (n <= 1) return (bt + bb) / 2;
        return bt + (bb - bt) * (i + 0.5) / n;
    }

    /** 第 i 條 lane 可用的半振幅（世界單位）。留 62% 給振幅，其餘是間距。 */
    function laneAmp(n, band) {
        const [bt, bb] = band || [BAND_T, BAND_B];
        return (bb - bt) / Math.max(1, n) * 0.31;
    }

    // ======================================================================
    // 取樣
    // ======================================================================

    /**
     * 把位移函式取樣成折線。
     *
     * ⚠️ 取樣點數要跟著**最短波長**走，不能寫死。一個波長只取 8 點的話
     * 振幅會被削掉 7.6%，看起來像「繩子沒在動」，而且頻率越高削得越兇。
     * 這裡由呼叫端給 lambdaM，反推需要幾個點。
     *
     * ⚠️ x0 / x1 / lambdaM 全部是**公尺**，回傳的 x 也是公尺。
     *    物理量與座標從頭到尾只有一種尺度，世界單位只在繪製時才出現。
     *    兩種尺度並存過一次，結果繩子被取了 1600 點卻橫跨 330 個波長、
     *    一個波長只剩 5 點——畫面不會炸，只是默默變成一條折線，很難查。
     *
     * 沒有波長可以參考時（脈衝、駐波）傳 null，就均勻取 400 點。
     */
    function sample(fn, x0, x1, t, lambdaM) {
        const span = x1 - x0;
        const per = (lambdaM > 0) ? lambdaM / SAMPLES_PER_LAMBDA : span / 400;
        const n = Math.max(24, Math.min(1600, Math.ceil(span / per)));
        const pts = new Array(n + 1);
        for (let i = 0; i <= n; i++) {
            const x = x0 + span * i / n;
            pts[i] = { x, y: fn(x, t) };
        }
        return pts;
    }

    // ======================================================================
    // 繪製
    // ======================================================================

    /** 繩子上的位置（公尺，0..ROPE_M）→ 螢幕 x。所有水平定位都走這條。 */
    function ropeX(view, xm) { return view.toScreenX(ROPE_L + xm * X_SCALE); }

    /** lane 上的位移 → 世界 y。 */
    function laneY(baseY, ampScale, y) { return baseY - y * ampScale; }

    /**
     * 平衡位置（繩子沒動時的那條線）。
     * 預設畫滿整條繩子；06 的繩子只到端點為止，會傳 x1m 進來把它截短。
     */
    function drawBaseline(p, view, baseY, x0m, x1m) {
        const a = x0m == null ? 0 : x0m;
        const b = x1m == null ? ROPE_M : x1m;
        p.stroke(203, 213, 225);
        p.strokeWeight(view.len(1.5, 1));
        const ctx = p.drawingContext;
        // ⚠️ 一律 `p.push()`／`p.pop()`，不要 `ctx.save()`／`ctx.restore()`
        //    ——理由見 `.github/scripts/headless/README.md` 陷阱二十九。
        p.push();
        ctx.setLineDash([view.len(10, 4), view.len(8, 3)]);
        p.line(ropeX(view, a), view.toScreenY(baseY),
               ropeX(view, b), view.toScreenY(baseY));
        p.pop();
    }

    /**
     * 畫一條位移曲線。
     * opts = { color, weight, dash, baseY, ampScale }
     */
    function drawWave(p, view, pts, opts) {
        if (!pts || pts.length < 2) return;
        const baseY = opts.baseY, ampScale = opts.ampScale;
        p.noFill();
        p.stroke(opts.color[0], opts.color[1], opts.color[2]);
        p.strokeWeight(view.len(opts.weight || 4, 2));

        const ctx = p.drawingContext;
        // ⚠️ 一律 `p.push()`／`p.pop()`，不要 `ctx.save()`／`ctx.restore()`
        //    ——理由見 `.github/scripts/headless/README.md` 陷阱二十九。
        if (opts.dash) {
            p.push();
            ctx.setLineDash([view.len(opts.dash, opts.dash * 0.4), view.len(opts.dash * 0.8, 2)]);
        }
        p.beginShape();
        for (const pt of pts) {
            p.vertex(ropeX(view, pt.x), view.toScreenY(laneY(baseY, ampScale, pt.y)));
        }
        p.endShape();
        if (opts.dash) p.pop();
    }

    /**
     * 繩子上的珠點。繩波的教學重點是「介質質點只在原處上下振動」，
     * 所以珠點是必要的——只有曲線的話，看起來像「波把繩子帶著跑」。
     *
     * opts = { baseY, ampScale, n, color, radius, x0m, x1m, highlight: {index, color} }
     * x0m/x1m 省略時鋪滿整條繩子；繩子沒有鋪滿世界的頁面（例如 06 的
     * 繩子只到 6.0 m）一定要傳，否則珠點會飄到端點右邊去，看起來像繩子
     * 還繼續延伸——那正好會把「這裡就是盡頭」的畫面意思弄反。
     */
    function drawBeads(p, view, fn, t, opts) {
        const baseY = opts.baseY, ampScale = opts.ampScale;
        const n = Math.max(2, opts.n || 22);
        const hl = opts.highlight || null;
        const r = view.len(opts.radius || 7, 3);
        const a = opts.x0m == null ? 0 : opts.x0m;
        const b = opts.x1m == null ? ROPE_M : opts.x1m;
        for (let i = 0; i <= n; i++) {
            const x = a + (b - a) * i / n;
            const y = fn(x, t);
            const sx = ropeX(view, x);
            const sy = view.toScreenY(laneY(baseY, ampScale, y));
            if (hl && i === hl.index) {
                p.noStroke();
                p.fill(hl.color[0], hl.color[1], hl.color[2]);
                p.circle(sx, sy, r * 2.6);
                p.fill(255);
                p.circle(sx, sy, r * 1.1);
            } else {
                p.noStroke();
                p.fill(opts.color[0], opts.color[1], opts.color[2]);
                p.circle(sx, sy, r * 1.7);
            }
        }
    }

    /**
     * 【縱波】把位移函式畫成一整排左右振動的質點（23、24 兩頁聲音用）。
     *
     * ⚠️ 都卜勒那一頁**不用這一支**——它的波在繩子上，是橫波。
     *
     * 橫波的質點本來就在曲線上，所以 drawBeads 直接畫在曲線上就好；
     * 縱波的質點是沿著基線**左右**移動的，位移要加在 x 上，而且相鄰質點
     * 的**間距**才是重點——擠在一起就是密部。所以這一支不能沿用 drawBeads。
     *
     * ⚠️ 密部用「實際畫出來的間距」上色，不要去算解析的應變。兩者在正弦波
     *    下等價，但波形一換（拍、都卜勒的壓縮波列）解析式就對不上了，
     *    而**顏色跟眼睛看到的一致**比跟公式一致重要。
     *
     * ⚠️ ampScale 是**橫向放大**（世界單位 / 位移單位），縱波必用的誇大。
     *    它有上限：相鄰質點的最大相對位移是 A·k·Δx·ampScale，必須小於
     *    平衡間距，否則質點會穿過彼此（看起來像在跳躍）。verify-waves.js
     *    對每一頁用的參數組合都有最壞情況斷言。
     *
     * opts = { baseY, ampScale, n, color, radius, band, x0m, x1m, highlight, alpha }
     *   band：密部色帶的半高（世界單位），預設 30
     *   alpha：密部最濃時的透明度，預設 0.34
     */
    function drawCompression(p, view, fn, t, opts) {
        const baseY = opts.baseY, ampScale = opts.ampScale;
        const n = Math.max(2, opts.n || 28);
        const a = opts.x0m == null ? 0 : opts.x0m;
        const b = opts.x1m == null ? ROPE_M : opts.x1m;
        const col = opts.color;
        const halfH = view.len(opts.band || 30, 14);
        const eqGapW = ((b - a) / n) * X_SCALE;      // 平衡間距（世界單位）
        const sy = view.toScreenY(baseY);

        const beads = [];
        for (let i = 0; i <= n; i++) {
            const xe = a + (b - a) * i / n;
            beads.push({ xe, xi: fn(xe, t) });
        }

        // 密部：間距比平衡值小的地方
        p.noStroke();
        const peak = opts.alpha == null ? 0.34 : opts.alpha;
        for (let i = 0; i < beads.length - 1; i++) {
            const xa = ropeX(view, beads[i].xe) + beads[i].xi * ampScale;
            const xb = ropeX(view, beads[i + 1].xe) + beads[i + 1].xi * ampScale;
            const alpha = Math.max(0, Math.min(1, 1 - (xb - xa) / eqGapW)) * peak;
            if (alpha < 0.01) continue;
            p.fill(col[0], col[1], col[2], alpha * 255);
            p.rect(xa, sy - halfH, xb - xa, halfH * 2);
        }

        // 質點
        const r = view.len(opts.radius || 7, 3);
        const hl = opts.highlight || null;
        for (let i = 0; i < beads.length; i++) {
            const sx = ropeX(view, beads[i].xe) + beads[i].xi * ampScale;
            p.noStroke();
            if (hl && i === hl.index) {
                p.fill(hl.color[0], hl.color[1], hl.color[2]);
                p.circle(sx, sy, r * 2.4);
                p.fill(255);
                p.circle(sx, sy, r * 1.0);
            } else {
                p.fill(col[0], col[1], col[2]);
                p.circle(sx, sy, r * 1.6);
            }
        }
    }

    /**
     * 波長標註：從 x0 到 x1 的括號。畫在曲線上方或下方。
     *
     * 選用「括號」而不是雙箭頭，是因為它標的是「一個波長」這個長度，
     * 不是「從這裡到那裡」的位移。
     */
    function wavelengthBracket(p, view, x0m, x1m, worldY, label, opts) {
        opts = opts || {};
        const sx0 = ropeX(view, x0m), sx1 = ropeX(view, x1m);
        const sy = view.toScreenY(worldY);
        const tick = view.len(9, 4);
        const col = opts.color || [37, 99, 235];

        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(view.len(2, 1));
        p.line(sx0, sy, sx1, sy);
        p.line(sx0, sy - tick, sx0, sy + tick);
        p.line(sx1, sy - tick, sx1, sy + tick);

        const size = view.len(opts.size || 16, 9);
        p.noStroke();
        p.textSize(size);
        p.textStyle(p.BOLD);
        const tw = p.textWidth(label);
        const pad = view.len(7, 4);
        const above = opts.above !== false;
        const by = above ? sy - size - pad : sy + pad;
        p.fill(255);
        p.rect(sx0 + (sx1 - sx0) / 2 - tw / 2 - pad, by - pad * 0.5,
               tw + pad * 2, size + pad);
        p.fill(col[0], col[1], col[2]);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(label, sx0 + (sx1 - sx0) / 2, by + size / 2 + pad * 0.25);
    }

    /**
     * 繩子的端點。固定端畫成釘在牆上的錨，自由端畫成套在桿上的環。
     *
     * 這兩種端點在畫面上必須一眼看得出不同，否則「相位反轉」的對照會
     * 只剩下文字說明。
     */
    function drawEndpoint(p, view, xm, baseY, type) {
        const sx = ropeX(view, xm);
        const sy = view.toScreenY(baseY);
        const h = view.len(46, 20);

        if (type === 'fixed') {
            // 錨：一條粗黑短線 + 斜紋牆面
            p.stroke(30, 41, 59);
            p.strokeWeight(view.len(7, 3));
            p.line(sx, sy - h, sx, sy + h);
            const n = 5;
            for (let i = 0; i < n; i++) {
                const yy = sy - h + (2 * h) * i / (n - 1);
                p.strokeWeight(view.len(3, 1.5));
                p.line(sx, yy, sx + view.len(15, 7), yy + view.len(12, 6));
            }
            p.noStroke();
            p.fill(30, 41, 59);
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            // 標籤置中在牆上，不是靠右擺。靠右擺的話繩子右端（世界 x =
            // ROPE_M = 950）的標籤會伸出世界矩形——`view.clip()` 是照世界矩形
            // 裁的，而世界右緣就是畫布右緣，所以最後一個字會被切掉一角，
            // 畫面不會報錯、所有數值斷言也照樣全綠。
            p.textAlign(p.CENTER, p.CENTER);
            p.text('固定端', sx, sy + h + view.len(16, 8));
        } else {
            // 環：套在一根豎桿上，可以自由上下滑
            p.stroke(100, 116, 139);
            p.strokeWeight(view.len(4, 2));
            p.line(sx + view.len(9, 4), sy - h, sx + view.len(9, 4), sy + h);
            p.noFill();
            p.stroke(37, 99, 235);
            p.strokeWeight(view.len(5, 2));
            p.circle(sx, sy, view.len(26, 12));
            p.noStroke();
            p.fill(37, 99, 235);
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.CENTER);   // 置中的理由同上面的固定端
            p.text('自由端', sx, sy + h + view.len(16, 8));
        }
    }

    /**
     * 兩段繩子的接點。左邊畫斜線紋、右邊畫點紋，讓「換介質了」看得出來。
     * 並在兩側標上 μ 與 v 的相對大小。
     */
    function drawJunction(p, view, xm, baseY, halfH, o) {
        o = o || {};
        const sx = ropeX(view, xm);
        const top = view.toScreenY(baseY - halfH);
        const bot = view.toScreenY(baseY + halfH);

        // 左段底色（淡）
        p.noStroke();
        p.fill(o.leftFill || [239, 246, 255]);
        p.rect(ropeX(view, 0), top, sx - ropeX(view, 0), bot - top);
        p.fill(o.rightFill || [255, 247, 237]);
        p.rect(sx, top, ropeX(view, ROPE_M) - sx, bot - top);

        // 接點
        p.stroke(30, 41, 59);
        p.strokeWeight(view.len(4, 2));
        const ctx = p.drawingContext;
        // ⚠️ 一律 `p.push()`／`p.pop()`，不要 `ctx.save()`／`ctx.restore()`
        //    ——理由見 `.github/scripts/headless/README.md` 陷阱二十九。
        p.push();
        ctx.setLineDash([view.len(9, 4), view.len(7, 3)]);
        p.line(sx, top, sx, bot);
        p.pop();

        p.noStroke();
        p.fill(30, 41, 59);
        p.textSize(view.len(15, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text(o.label || '接點', sx, top - view.len(8, 4));
    }

    /**
     * lane 的標籤（「入射波」「反射波」「合成波」…）。畫在繩子左端的外側。
     *
     * ⚠️ 標籤是**畫在 lane 的平衡線上**的，而波形自己也會經過那條線——所以
     *    只要繩子左端剛好有坡度，波形就會**從字中間穿過去**。現有頁面都不
     *    會出事（脈衝不在那一頭、標籤只有兩三個字），但這是這一支的既有
     *    性質，不是保證。README 陷阱二十六記著它真的發生過的那一次，以及
     *    當時的修法（已隨那一頁一起刪掉，要復活看 git）。
     */
    function drawLaneLabel(p, view, baseY, text, color) {
        const fs = view.len(15, 9);
        p.noStroke();
        p.textSize(fs);
        p.textStyle(p.BOLD);
        // 標籤畫在繩子左端的左邊，但繩子左邊只有 ROPE_L 這一段邊界（約 62 px），
        // 塞不下「實際的繩子」這種五個字的標籤——文字會從畫布的左緣被切掉，
        // 看起來像少了一個字。塞不下就改成畫在繩子裡面、左對齊。
        const pad = view.len(10, 5);
        const outX = ropeX(view, 0) - pad;
        const y = view.toScreenY(baseY);
        const tw = p.textWidth(text);
        const inside = outX - tw < view.rect.x + view.len(4, 2);
        const textX = inside ? outX + pad : outX;
        p.fill(color[0], color[1], color[2]);
        if (inside) {
            p.textAlign(p.LEFT, p.CENTER);
        } else {
            p.textAlign(p.RIGHT, p.CENTER);
        }
        p.text(text, textX, y);
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
        p.textStyle(p.BOLD);
        // 標題是單行、不換行的。字級固定時長句會直接超出黑條，兩端被畫布
        // 邊緣切掉（句子愈長掉得愈多，開頭第一個字最先消失）。這裡讓字級
        // 自動降到塞得下為止；下限 11 px，再小就讀不到了——降到下限還塞
        // 不下就代表文案該改短，不是繼續縮字。
        const maxW = r.w - view.len(24, 12);
        let size = view.len(17, 10);
        const floor = view.len(11, 7);
        p.textSize(size);
        while (size > floor && p.textWidth(text) > maxW) {
            size *= 0.96;
            p.textSize(size);
        }
        p.text(text, r.x + r.w / 2, barTop + barH / 2);
    }

    /** 白底藍框的數值標籤（和 motion-scene 同一個長相，五頁才一致）。 */
    function valueBadge(p, view, x, y, text, o) {
        o = o || {};
        const size = view.len(o.size || 16, o.minSize || 9);
        const padX = view.len(11, 5), padY = view.len(6, 3);
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

    /** 向上的箭頭，標「波往這邊跑」。 */
    function drawTravelArrow(p, view, xm, worldY, dir, label, color) {
        const c = color || [239, 68, 68];
        const sx = ropeX(view, xm);
        const sy = view.toScreenY(worldY);
        const L = view.len(90, 36);
        const head = view.len(16, 8);
        const x2 = sx + dir * L;

        p.stroke(c[0], c[1], c[2]);
        p.strokeWeight(view.len(4, 2));
        p.line(sx, sy, x2 - dir * head, sy);
        p.noStroke();
        p.fill(c[0], c[1], c[2]);
        p.triangle(x2, sy,
                   x2 - dir * head, sy - head * 0.55,
                   x2 - dir * head, sy + head * 0.55);

        if (label) {
            p.textSize(view.len(15, 9));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.text(label, (sx + x2) / 2, sy - view.len(7, 4));
        }
    }

    // ======================================================================
    // 控制面板
    // ======================================================================

    /**
     * 五頁共用的面板：宣告這頁要哪些滑桿／下拉，其餘（按鈕、公式盒、
     * 開始/暫停/重設的顯隱）都一樣。
     *
     * @param {HTMLElement} ctrlPanel
     * @param {object} o
     *   o.formula / o.formulaFallback
     *   o.controls.sliders  [{ key, label, unit, min, max, step, def, dec }]
     *   o.controls.selects  [{ key, label, options: [{ v, t }], def }]
     *   o.keepLive          [key] 這幾支改了不停動畫、時間也不歸零
     *   o.onChange(reason, key)
     * @returns {object} panel，滑桿的現值直接在 panel[key] 上
     */
    function buildPanel(ctrlPanel, o) {
        o = o || {};
        const sliders = (o.controls && o.controls.sliders) || [];
        const selects = (o.controls && o.controls.selects) || [];

        const val = {};
        for (const s of sliders) val[s.key] = s.def;
        for (const s of selects) val[s.key] = s.def;

        const formulaHTML = (typeof katex !== 'undefined')
            ? katex.renderToString(o.formula || '', { throwOnError: false, displayMode: true })
            : `<div style="font-size:1rem;font-weight:700;">${o.formulaFallback || ''}</div>`;

        const sliderHTML = sliders.map(s => {
            const dec = s.dec == null ? (s.step < 0.1 ? 2 : s.step < 1 ? 1 : 0) : s.dec;
            return `
            <div class="control-box">
                <label>
                    <span>${s.label}</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="${s.key}Val" style="color: #2563eb;">${s.def.toFixed(dec)}</span> ${s.unit || ''}
                    </span>
                </label>
                <input type="range" id="${s.key}Slider" min="${s.min}" max="${s.max}"
                       step="${s.step}" value="${s.def}">
            </div>`;
        }).join('');

        const selectHTML = selects.map(s => `
            <div class="control-box">
                <label><span>${s.label}</span></label>
                <select id="${s.key}Select" style="width: 100%; padding: 8px; font-size: 0.9rem; font-weight: 700; border: 1px solid #000; background: #fff; cursor: pointer;">
                    ${s.options.map(op => `<option value="${op.v}">${op.t}</option>`).join('')}
                </select>
            </div>`).join('');

        ctrlPanel.innerHTML = `
            ${selectHTML}
            ${sliderHTML}
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">核心關係</div>
                <!-- ⚠️ KaTeX 的 display 公式不換行，比側欄寬就整段溢出底色之外、
                     被畫布蓋掉——**只是少了一段公式，不會有任何錯誤**。
                     橫向捲軸是最壞情況的保險（理由同 lab-scene.js）。 -->
                <div style="overflow-x: auto;">${formulaHTML}</div>
            </div>
        `;

        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');

        const panel = {
            started: false, paused: false,
            reset(keepStarted) {
                panel.started = !!keepStarted;
                panel.paused = false;
                pauseBtn.textContent = '暫停 PAUSE';
                sync();
            },
        };
        for (const k in val) panel[k] = val[k];

        function sync() {
            startBtn.style.display = panel.started ? 'none' : 'block';
            pauseBtn.style.display = panel.started ? 'block' : 'none';
        }

        function change(reason, key) {
            for (const k in val) panel[k] = val[k];
            if (o.onChange) o.onChange(reason, key);
        }

        /**
         * 這支控制項改了之後**要不要讓動畫繼續跑**。
         *
         * 預設是不要：改了參數就停下來等學生重新按「開始」，五頁一致。
         * 但 28 波形圖與振動圖那一頁要看的正是「同一瞬間、方向反過來」，
         * 停下來就比不成了——所以那一頁把 `dir` 放進 o.keepLive。
         *
         * ⚠️ 只有出現在 `keepLive` 裡的 key 才免疫；寫錯名字的症狀是
         *    「這一支滑桿跟別的滑桿一樣會停」，而畫面完全正常。
         */
        function stayLive(key) {
            return (o.keepLive || []).indexOf(key) >= 0;
        }

        for (const s of selects) {
            const el = document.getElementById(s.key + 'Select');
            el.value = val[s.key];
            el.addEventListener('change', () => {
                val[s.key] = el.value;
                if (!stayLive(s.key)) {
                    panel.started = false;
                    panel.paused = false;
                    sync();
                }
                change('param', s.key);
            });
        }

        for (const s of sliders) {
            const dec = s.dec == null ? (s.step < 0.1 ? 2 : s.step < 1 ? 1 : 0) : s.dec;
            PhysicsUtils.bindSlider(s.key + 'Slider', s.key + 'Val', v => {
                val[s.key] = v;
                if (!stayLive(s.key)) {
                    panel.started = false;
                    panel.paused = false;
                    sync();
                }
                change('param', s.key);
            }, v => v.toFixed(dec));
        }

        startBtn.addEventListener('click', () => {
            panel.started = true;
            panel.paused = false;
            sync();
            change('start');
        });

        pauseBtn.addEventListener('click', () => {
            panel.paused = !panel.paused;
            pauseBtn.textContent = panel.paused ? '播放 PLAY' : '暫停 PAUSE';
            change('pause');
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            panel.started = false;
            panel.paused = false;
            sync();
            change('reset');
        });

        // 不在這裡呼叫 onChange。panel 是在實驗檔的 pushCards 之前建立的，
        // 建構時就回呼會撞上那些 const 的 TDZ。
        sync();
        return panel;
    }

    // ======================================================================
    // 頁面骨架
    // ======================================================================

    /**
     * 五頁的頁面骨架。跑完之後每頁只剩「繩子怎麼動」和「要標什麼」。
     *
     * @param {object} o
     *   o.formula / o.formulaFallback
     *   o.controls  { sliders, selects }
     *   o.cards     createDataCards 設定
     *   o.values    {function(t, panel) => object}  卡片數值
     *   o.draw      {function(p, view, t, panel)}   這一頁的畫面
     *   o.titleText {function(t, panel) => string}  底部黑條文案
     *   o.keepLive  {string[]} 這幾支控制項改了**不要**停下來、時間也不要歸零
     *               （28 波形圖與振動圖的 `dir` 用；其餘五頁不傳＝每一支都停）
     */
    function run(o) {
        const origCanvas = document.getElementById('physicsCanvas');
        if (!origCanvas) return;
        const container = origCanvas.parentElement;
        origCanvas.remove();
        const ctrlPanel = document.getElementById('controlPanel');
        const guardEl = ctrlPanel || container;

        let simTime = 0;

        const panel = buildPanel(ctrlPanel, {
            formula: o.formula,
            formulaFallback: o.formulaFallback,
            controls: o.controls,
            keepLive: o.keepLive,
            onChange(reason, key) {
                if (reason === 'pause') return;
                // 這一支被宣告成 keepLive 時，時間不歸零——見 buildPanel 的 stayLive
                if ((o.keepLive || []).indexOf(key) < 0) simTime = 0;
                pushCards();
            },
        });

        const updateCards = PhysicsUtils.createDataCards(o.cards);

        function pushCards() {
            updateCards(o.values(simTime, panel));
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

                // 一定要清畫布。標題列與 lane 標籤畫在繩子範圍外，
                // 不清的話會一幀一幀疊上去糊成一團。
                p.background(255);

                const view = PhysicsUtils.fitViewWH(p.width, p.height, WORLD_W, WORLD_H);
                p.push();
                view.clip(p.drawingContext);

                o.draw(p, view, simTime, panel);

                drawTitleBar(p, view, o.titleText(simTime, panel));

                p.pop();
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
        ROPE_M, ROPE_L, ROPE_R, X_SCALE,
        BAND_T, BAND_B, TITLE_TOP, TITLE_H, AMP_SCALE,
        SAMPLES_PER_LAMBDA,

        medium, omega, waveNumber, coefficients,
        decompose, traveling, pulse, sum, standing,
        pulseShape, waveShape, scatter,
        movingSource, dopplerFreq, dopplerObserver,
        // 密部／疏部徽章的選點。01 與 23 兩頁共用這一支——各寫一份的話，
        // 「介質一換就站錯位置」那個 bug 會在其中一頁被修好、另一頁留著。
        strainExtremumX,
        // 「這個圓看不看得見」。26 的水塘與 33 的航線圖共用——幾何只能有一個家。
        circleCrossesRect,
        // 水面高度的色階。27 與 34 兩頁畫的是同一片水，顏色只能有一份。
        waterRamp,
        // 鉛直的量測括號。27 標開口與中心距、34 標波源距離，同一支。
        vBracket,

        laneBaseY, laneAmp, sample,
        ropeX, laneY, drawBaseline, drawWave, drawBeads, drawCompression,
        wavelengthBracket, drawEndpoint, drawJunction, drawLaneLabel,
        drawTitleBar, valueBadge, drawTravelArrow,

        buildPanel, run,
    };
})();
