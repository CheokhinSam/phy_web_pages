/**
 * 🌡️ ThermalKit — 熱學的純物理（沒有任何 DOM）
 *
 * 熱學五頁共用這一份。它住的位置和 circuit-kit.js（電學）、magnetic-kit.js
 * （磁學）一樣：**沒有 DOM**，所以 `verify-thermal.js` 可以把它整支抓進
 * Node 逐位斷言，不必開瀏覽器。
 *
 * ==========================================================================
 * ⚠️ 熱學的「同一份資料」是什麼？
 * ==========================================================================
 * 電學的核心約定是「電路是一份資料」（求解器算的就是繪圖函式畫的那一份），
 * 磁學的是「場源是一份資料」（磁力線、磁通量、電動勢全部從同一份場源推）。
 * 熱學這邊對應的是**溫度場**：
 *
 *   熱傳導   一根棒子的節點溫度陣列 T[i]  →  色帶、粒子抖動、T(x) 圖、卡片
 *   熱對流   一個盒子的溫度場 T(x,z)      →  流線粒子、剖面圖、Ra 卡片
 *   熱輻射   一個物體的溫度 T             →  發光顏色、能量箭頭、T–t 圖、功率卡
 *   比熱潛熱 一份「能量 → 溫度」的分段表   →  加熱曲線、能量堆疊條、狀態卡
 *   氣體定律 一個狀態 (p, V, T)           →  活塞位置、分子速率、p–V 圖
 *
 * 五頁都是「一份狀態 → 四個地方同時顯示」。滑桿動了，四個地方一起動，而且
 * 必然互相吻合——因為它們讀的是同一個函式的回傳值，不是各自算的。
 *
 * ==========================================================================
 * ⚠️ 單位：這一支**只用 SI**
 * ==========================================================================
 * 公尺、公斤、秒、焦耳、瓦特、帕斯卡、克耳文、莫耳。理由和 magnetic-kit 的
 * `u` 是同一個：頁面上的座標是世界單位、滑桿上是公分公升千帕，混進來就會
 * 出現「圖全對、數字全錯」的錯，而且肉眼抓不到。
 *
 * 所以換算一律在**頁面**做，而且只在兩個地方做：讀滑桿進模型的時候，
 * 以及寫卡片出去的時候。中間全部是 SI。
 *
 * ⚠️ 溫度只有一個例外：`heatingSegments` 吃**攝氏**，因為那張相圖的
 *    熔點沸點就是這樣寫的（0 °C、100 °C）。它內部會處理，但這是刻意的，
 *    不是漏改——絕對溫度的公式（氣體、輻射）一律吃克耳文。
 *
 * ==========================================================================
 * ⚠️ 材料表只有一份，而且刻意**同時**擺 k 和 c
 * ==========================================================================
 * 銅的熱導率 401 很大，比熱容量 385 很小；水的熱導率 0.60 很小，比熱容量
 * 4186 很大。這兩件事在學生的腦子裡很容易黏成一團（「銅很容易變熱」其實
 * 是「銅很容易導熱，而且升溫需要的能量少」兩件事疊起來的）。
 *
 * 熱傳導那一頁讀 `k`，比熱容量那一頁讀 `c`，讀的是同一筆資料。這是刻意的：
 * 兩頁的銅必須是同一個銅。
 */
var ThermalKit = (function () {
    'use strict';

    // ======================================================================
    // 常數（全部 SI，2019 年 SI 修訂後的定義值）
    // ======================================================================
    const SIGMA = 5.670374419e-8;        // Stefan–Boltzmann 常數 W/(m²·K⁴)
    const R_GAS = 8.314462618;           // 氣體常數 J/(mol·K)
    const KELVIN = 273.15;               // 0 °C = 273.15 K
    const G = 9.81;                      // 重力加速度 m/s²
    const KB = 1.380649e-23;             // Boltzmann 常數 J/K
    const NA = 6.02214076e23;            // 亞佛加厥常數 /mol

    const toK = c => c + KELVIN;
    const toC = k => k - KELVIN;

    // ======================================================================
    // 材料庫：**熱學五頁共用一份**
    // ======================================================================
    // k   熱導率       W/(m·K)
    // rho 密度         kg/m³
    // c   比熱容量     J/(kg·K)     （固體／液體，常壓常溫附近）
    // eps 表面發射率   0–1          （拋光的金屬很小，粗糙的非金屬接近 1）
    //
    // ⚠️ 這張表刻意把 k 和 c 擺在一起（見檔頭）。不要為了某一頁方便就複製
    //    一份出去——那樣兩頁的「銅」就會各自漂走，而畫面上完全看不出來。
    const MATERIALS = {
        copper:    { name: '銅',     k: 401,  rho: 8960, c: 385,  eps: 0.05 },
        aluminium: { name: '鋁',     k: 237,  rho: 2700, c: 900,  eps: 0.10 },
        iron:      { name: '鐵',     k: 80,   rho: 7870, c: 450,  eps: 0.35 },
        steel:     { name: '不鏽鋼', k: 16,   rho: 7900, c: 500,  eps: 0.30 },
        glass:     { name: '玻璃',   k: 1.0,  rho: 2500, c: 840,  eps: 0.90 },
        wood:      { name: '木材',   k: 0.15, rho: 600,  c: 1700, eps: 0.90 },
        water:     { name: '水',     k: 0.60, rho: 1000, c: 4186, eps: 0.96 },
    };

    /** 熱擴散率 α = k/(ρc)，單位 m²/s。熱傳導方程裡真正決定「多快」的量。 */
    const diffusivity = (k, rho, c) => k / (rho * c);

    // ======================================================================
    // ① 熱傳導：傅立葉定律 + 一維有限差分
    // ======================================================================

    /** 熱流功率 P = kA·ΔT/L（W）。ΔT 是兩端溫差，L 是長度。 */
    function heatCurrent(k, A, dT, L) {
        return k * A * dT / L;
    }

    /** 熱阻 R = L/(kA)（K/W）。串起來的棒子就是串聯電阻，這是刻意的類比。 */
    function thermalResistance(L, k, A) {
        return L / (k * A);
    }

    /** 穩態的溫度分布：兩端固定時是一條**直線**。回傳長度 n 的陣列。 */
    function steadyProfile(n, left, right) {
        const T = new Array(n);
        for (let i = 0; i < n; i++) T[i] = left + (right - left) * i / (n - 1);
        return T;
    }

    /**
     * 顯式有限差分走一步：T_new[i] = T[i] + F·(T[i−1] − 2T[i] + T[i+1])
     * 其中 F = α·dt/dx² 是**擴散數**（diffusion number）。
     *
     * ⚠️ 兩端是 Dirichlet 條件（夾在固定溫度的熱源與冷源之間），而且每一
     *    步都**重新指定**。少了這一句，端點的溫度會自己漂走，穩態就不再
     *    是那條直線，而圖上只會看起來「有點歪」。
     *
     * ⚠️ F > 0.5 會發散（顯式法的穩定條件）。這裡不丟錯，只回傳新陣列——
     *    由呼叫端用 check() 把 F 講出來。發散的症狀是溫度在相鄰節點之間
     *    正負跳動、幾十步內衝到 ±1e30，畫面上是整條棒子閃爍。
     *
     * @returns {Float64Array} 新的溫度陣列（不改動傳進來的）
     */
    function conductionStep(T, o) {
        const n = o.n, dx = o.dx, dt = o.dt, alpha = o.alpha;
        const F = alpha * dt / (dx * dx);
        const out = new Float64Array(n);
        out[0] = o.left;
        out[n - 1] = o.right;
        for (let i = 1; i < n - 1; i++) {
            out[i] = T[i] + F * (T[i - 1] - 2 * T[i] + T[i + 1]);
        }
        return out;
    }

    /** 擴散數 F = α·dt/dx²。顯式法要 F ≤ 0.5。 */
    function diffusionNumber(alpha, dt, dx) {
        return alpha * dt / (dx * dx);
    }

    /** 顯式法能用的最大步長：dt ≤ safety·dx²/(2α)。safety 預設 0.4（留一點餘裕）。 */
    function stableDt(dx, alpha, safety) {
        const s = safety == null ? 0.4 : safety;
        return s * dx * dx / (2 * alpha);
    }

    /**
     * 擴散時間 τ：溫度擾動擴散過整個長度所需的時間。
     *
     * 熱傳導方程的基本模態以 exp(−t/τ) 衰減，代入分離變數得到
     * τ = 4L²/(π²α) ≈ 0.405·L²/α。教科書常寫 τ ≈ L²/α（同一個數量級，
     * 而且比較好記）——這裡把兩種都留著，`factor` 預設用精確的那個。
     *
     * ⚠️ 這個量在這一頁是**主角**，不是配角。銅和木材的 α 差了 10⁶ 倍
     *    （1.16e-4 對 1.47e-7），同樣一根 4 公分的棒子，銅 5.6 秒就到穩態，
     *    木材要 1.2 小時。那是「木頭為什麼能當隔熱材料」的全部答案。
     */
    function diffusionTime(L, alpha, factor) {
        const f = factor == null ? 4 / (Math.PI * Math.PI) : factor;
        return f * L * L / alpha;
    }

    /**
     * 傳導動畫的步進參數。
     *
     * ⚠️ 這一支存在的理由是一個兩難：六種材料的 α 差了一百萬倍，任何
     *    **固定的時間流速**都只有兩種下場——銅瞬間到穩態（看不到過程），
     *    或者木材永遠是那條初始的斜線（看起來像壞掉）。
     *
     * 解法是讓每一格畫面都走「同一個 τ 分數」，於是所有材料在**同樣的畫面
     * 時間**內走完自己的暫態，而卡片上印的**真實時間**才顯現出差別
     * （銅 5.6 秒、木材 1.2 小時）。壓縮倍率會印在卡片上，所以沒有藏。
     *
     * 副產品：需要的子步數和材料無關。子步數 = (τ/F̄)/(0.4·dx²/2α)，α 全部
     * 消掉，只剩 n 與畫面格數。
     *
     * @param {object} o {alpha, L, n, frames, safety}
     * @returns {{tau, dtFrame, dtStep, substeps, dx}}
     */
    function conductionDriver(o) {
        const n = o.n, L = o.L, alpha = o.alpha;
        const frames = o.frames || 360;                 // 60fps 下 6 秒
        const dx = L / (n - 1);
        const tau = diffusionTime(L, alpha);
        const dtFrame = tau / frames;
        const dtStep = stableDt(dx, alpha, o.safety);
        const substeps = Math.max(1, Math.ceil(dtFrame / dtStep));
        return { tau, dtFrame, dtStep, substeps, dx };
    }

    // ======================================================================
    // ② 熱對流：雷利數、對流胞的流函數
    // ======================================================================
    // ⚠️ 這一節**不是** Navier–Stokes 求解器，不要假裝它是。它做的是：
    //
    //   ‧ 用真實的流體性質算出 Ra 與臨界溫差（那兩個是精確的）
    //   ‧ 用**線性穩定的臨界模態**畫對流胞（那個也是精確的）
    //   ‧ 振幅用弱非線性理論的近臨界標度 ε^½ 起頭、遠離臨界時飽和在
    //     自由落體速度 sqrt(gβΔT·L) 上（那一段是**內插**，見 buoyantSpeed）
    //
    // 真實的高 Ra 對流是紊流的、有羽流的，不是乾乾淨淨的滾筒。這一頁畫的
    // 是「起流」那一段的理想模樣，文字裡要講清楚。
    //
    // 流體性質（20 °C 附近，常壓）：
    //   beta  體膨脹係數 1/K
    //   nu    動黏度     m²/s
    //   alpha 熱擴散率   m²/s
    const FLUIDS = {
        water:     { name: '水',     beta: 2.07e-4, nu: 1.004e-6, alpha: 1.43e-7, rho: 998 },
        air:       { name: '空氣',   beta: 3.43e-3, nu: 1.51e-5,  alpha: 2.12e-5, rho: 1.20 },
        glycerine: { name: '甘油',   beta: 5.0e-4,  nu: 1.19e-3,  alpha: 9.5e-8,  rho: 1260 },
        honey:     { name: '蜂蜜',   beta: 5.0e-4,  nu: 5.0e-3,   alpha: 1.79e-7, rho: 1400 },
    };

    // Prandtl 數 Pr = ν/α（這一頁不直接用，但驗證與文字會引用它）
    const prandtl = f => f.nu / f.alpha;

    /**
     * 雷利數 Ra = gβΔT·L³/(να)。
     *
     * ⚠️ 它是**無因次**的，所以 L 是層厚（m）、ΔT 是上下溫差（K）。這一頁
     *    的滑桿上層厚是公釐，進到這裡一定要先換成公尺——忘了換的症狀是
     *    Ra 差 10⁹ 倍，而畫面上「有沒有在對流」看起來完全正確（因為反正
     *    都是大於臨界值）。
     */
    function rayleigh(o) {
        return G * o.beta * o.dT * Math.pow(o.L, 3) / (o.nu * o.alpha);
    }

    /**
     * 臨界溫差：Ra = Ra_c 時解出來的 ΔT。
     * ΔT_c = Ra_c·να/(gβL³) —— 也就是「要多大溫差才會開始對流」。
     *
     * ⚠️ ΔT_c 正比於 L⁻³，所以**越薄的層越難對流**。這一點和直覺相反
     *    （薄比較容易傳熱吧？），但它是對的：10 公分厚的水只要 0.0001 K
     *    的溫差就會滾，1 公釐厚的水要 125 K。蜂蜜在 1 公釐厚的薄層裡
     *    要三十萬度，所以它只會靜靜地躺著導熱。
     *
     * 註：這裡用的 Ra_c = 1708 是**剛性邊界**（真實容器）的值。自由表面的
     *     理論值是 657.5（且與波數有關，見 criticalWavenumber）。課綱和
     *     課本都用 1708，這一頁也用它，但要知道它不是唯一的答案。
     */
    const RA_C = 1708;
    function criticalDT(o) {
        const rc = o.raC == null ? RA_C : o.raC;
        return rc * o.nu * o.alpha / (G * o.beta * Math.pow(o.L, 3));
    }

    /**
     * 對流胞的振幅因子 ε^½ 的飽和版。
     *
     * 近臨界時線性穩定分析給出振幅 ∝ ε^½（ε = Ra/Ra_c − 1），這是標準的
     * 弱非線性結果。但真實的 Ra 動輒 10⁸，ε^½ 會給出比光速還快的流速，
     * 所以遠離臨界時要飽和——飽和在哪裡？飽和在自由落體速度
     * sqrt(gβΔT·L)（一塊比周圍熱 ΔT 的流體自己浮起來能達到的速度）。
     *
     * 取 sqrt(ε/(1+ε))：ε→0 時是 ε^½（正確的近臨界標度），ε→∞ 時是 1
     * （飽和在自由落體速度）。這一段是**內插**，不是推導出來的——但它兩個
     * 端點都是對的，而且單調，所以拿來畫圖與講「越快」是誠實的。
     */
    function convectionAmplitude(ra, raC) {
        const rc = raC == null ? RA_C : raC;
        if (!(ra > rc)) return 0;                    // 臨界以下：不流動
        const e = ra / rc - 1;
        return Math.sqrt(e / (1 + e));
    }

    /**
     * 黏性（爬行流）限制的速度尺度：一顆比周圍熱 ΔT 的流體塊，在 Stokes 阻力
     * 下的終端速度。球體形狀時分母是 24ν（教科書的 2/9·Δρ g r²/μ 換算過來）。
     *
     *   U_Stokes = gβΔT·L² / (24ν)
     *
     * ⚠️ 這一支是為了修一個**會讓學生看到錯誤排序**的 bug。只用自由落體速度
     *    的話，蜂蜜（β = 5×10⁻⁴，是水的 2.4 倍）在厚層、大溫差下算出來比水
     *    還快——因為 sqrt(gβΔTL) 裡**根本沒有黏度**。真實的蜂蜜 3 公分厚、
     *    ΔT = 40 K 只會用 1 mm/s 的速度爬。
     */
    function stokesSpeed(o) {
        return G * o.beta * o.dT * o.L * o.L / (24 * o.nu);
    }

    /**
     * 對流速度的尺度（m/s）。
     *
     * 取「自由落體速度」與「黏性終端速度」**兩者中較小的那一個**，再乘上
     * 振幅因子（臨界以下為 0）。
     *
     *   U_ff     = sqrt(gβΔT·L)·amp    慣性極限：位能全變成動能能跑多快
     *   U_Stokes = gβΔT·L²/(24ν)·amp   黏性極限：黏到爬行時能跑多快
     *
     * 兩個都是標準的速度尺度，取 min 是一個**內插**——但它兩個端點都是對的，
     * 而且對 ΔT、L 單調遞增、對 ν 單調遞減，所以「更熱更快、更厚更快、
     * 更黏更慢」這三句話永遠成立（這正是畫面上要學生看出來的事）。
     *
     * 實測值（水/空氣/甘油/蜂蜜在 1 公分、ΔT = 20 K）：20.2 / 82 / 0 / 0 mm/s，
     * 甘油與蜂蜜在這一組條件下 Ra 遠低於 1708，根本不流動。
     */
    function buoyantSpeed(o) {
        const amp = convectionAmplitude(o.ra, o.raC);
        if (amp <= 0) return 0;
        const uff = Math.sqrt(G * o.beta * o.dT * o.L);
        return Math.min(uff, stokesSpeed(o)) * amp;
    }

    /**
     * 臨界波數 k_c = π/√2（自由表面）——對應的對流胞寬度約 1.4 倍層厚。
     * 這一頁拿它來決定「幾公分的盒子裡該有幾個胞」，不是拿來算閾值的。
     */
    const CRITICAL_K = Math.PI / Math.SQRT2;

    /**
     * 流函數 Ψ(x, z) = A·sin(kx)·sin(πz/H)。
     *
     * ⚠️ 這是**線性化問題的臨界模態**，不是隨手湊的正弦波。它的用處是
     *    「自動滿足邊界條件」：
     *      z = 0 與 z = H 時 sin(πz/H) = 0  →  垂直速度 w = −∂Ψ/∂x = 0
     *      x = 0 與 x = W 時 sin(kx) = 0（k = nπ/W） →  水平速度 u = ∂Ψ/∂z = 0
     *    所以流體不會穿過任何一面牆，也不需要額外做什麼去「擋住」它。
     *
     * ⚠️ 座標 z 是**向上**的物理高度，不是螢幕的 y。頁面要用它的話，
     *    垂直速度要取負號（螢幕 y 向下）。這個換號只在頁面的繪圖層做一次。
     *
     * @param {number} A   振幅，建議用 U·H/π（U 是峰值速度）
     */
    function streamFunction(A, k, H, x, z) {
        return A * Math.sin(k * x) * Math.sin(Math.PI * z / H);
    }

    /**
     * 對流胞的速度場（由 Ψ 微分得到，所以必然無散度、必然不穿牆）。
     * @returns {{u:number, w:number}} u 向右為正、w **向上**為正
     */
    function cellVelocity(o, x, z) {
        const k = o.k, H = o.H, A = o.A;
        const u = A * (Math.PI / H) * Math.sin(k * x) * Math.cos(Math.PI * z / H);
        const w = -A * k * Math.cos(k * x) * Math.sin(Math.PI * z / H);
        return { u, w };
    }

    /**
     * 這一組 (x, z) 的溫度（K）。**流線粒子的顏色就是這個值。**
     *
     *   T(x, z) = T_bottom − ΔT·(z/H)  +  θ₀·(−cos(kx)·sin(πz/H))
     *             └── 傳導的基本分布 ──┘   └── 對流造成的擾動 ───┘
     *
     * ⚠️ 擾動取 −cos(kx)·sin(πz/H)，和垂直速度 w 同號——所以**上升的流體
     *    一定是熱的、下沉的一定是冷的**。這件事如果寫錯，畫面照樣有一顆
     *    一顆的粒子在繞圈，只是熱的往下跑，而且沒有任何斷言會叫。頁面不要
     *    自己寫這個式子，一律呼叫這一支。
     *
     * ⚠️ 臨界以下 amplitude = 0，擾動整項消失，剩下的就是嚴格的線性傳導
     *    分布——靜止、分層、熱在上面。那是對的。
     */
    function cellTemperature(o, x, z) {
        const k = o.k, H = o.H;
        const amp = o.amplitude || 0;
        const base = o.Tbottom - o.dT * (z / H);
        const pert = (o.dT / 2) * amp * (-Math.cos(k * x) * Math.sin(Math.PI * z / H));
        return base + pert;
    }

    /**
     * Nusselt 數：對流的熱傳效率是純傳導的幾倍。
     *
     * ⚠️ 只用了 Nu = 1 + 2·amplitude 這一個**內插**（amplitude 見上）。
     *    真實的 Nu–Ra 關聯式（高 Ra 時 Nu ∝ Ra^(1/3)）是實驗擬合出來的，
     *    這一頁不假裝自己算得出來。它的用途只有一個：讓「對流把熱搬得更快」
     *    有一個可以看的數字，而且臨界以下剛好是 1（= 只有傳導）。
     */
    function nusselt(amplitude) {
        return 1 + 2 * amplitude;
    }

    // ======================================================================
    // ③ 熱輻射：斯特凡–波茲曼定律與淨輻射
    // ======================================================================
    // 表面處理 → 發射率。金屬拋光後 ε 可以低到 0.05，粗糙的非金屬接近 1。
    // ⚠️ 發射率等於吸收率（克希荷夫定律）：一個不容易輻射出去的東西，
    //    也不容易吸收進來。這一頁的四塊板冷卻速度不同，靠的就是這個。
    const SURFACES = {
        black:    { name: '啞黑漆',   eps: 0.95 },
        white:    { name: '白漆',     eps: 0.90 },
        grey:     { name: '灰色漆',   eps: 0.60 },
        polished: { name: '拋光鋁',   eps: 0.05 },
    };

    /**
     * 一個表面**淨**輻射出去的功率（W），正的表示放出去的比吸進來的多。
     *
     *   P = εσA(T⁴ − T_s⁴)
     *
     * ⚠️ 是**四次方差**不是「溫差的四次方」。T = 2T_s 時淨功率是 T_s = 0 時的
     *    15/16，不是 16 倍——這兩個很容易在口頭上混掉，卡片與文字要小心。
     *    （T_s = 0 的「絕對零度環境」才是 16 倍，那個不是實驗室。）
     *
     * ⚠️ 兩邊都是**克耳文**。用攝氏代入的話 300 °C 會算成 300（比實際的
     *    573 K 小一半），而四次方會把這個錯放大成 13 倍。
     */
    function stefanPower(o) {
        const T = o.T, Ts = o.Ts;
        return o.eps * SIGMA * o.A * (Math.pow(T, 4) - Math.pow(Ts, 4));
    }

    /** 淨輻射造成的降溫率 dT/dt = −P/(mc)（K/s）。負的表示在降溫。 */
    function coolingRate(o) {
        return -stefanPower(o) / (o.m * o.c);
    }

    /**
     * 降溫的 Runge–Kutta 4 步進。
     *
     * ⚠️ 不能用 Euler：這一頁的降溫率對 T 的敏感度是 T³，500 K 附近
     *    一步 0.5 s 的 Euler 會系統性地多降一點溫，跑久了四條曲線會
     *    **一起**偏低——四條一起偏，看起來就像「物理本來就這樣」。
     *    RK4 在同樣的步長下誤差是 h⁴，肉眼看不到。
     */
    function coolingStep(T, o, dt) {
        const rate = t => -stefanPower({
            eps: o.eps, A: o.A, T: t, Ts: o.Ts,
        }) / (o.m * o.c);
        const k1 = rate(T);
        const k2 = rate(T + k1 * dt / 2);
        const k3 = rate(T + k2 * dt / 2);
        const k4 = rate(T + k3 * dt);
        return T + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    }

    /**
     * 完整的降溫曲線（給圖表用的參考線，也是驗證用的解析對照）。
     * 回傳 [{t, T}, …]，t 從 0 到 tMax，共 steps + 1 點。
     */
    function coolingCurve(o) {
        const steps = o.steps || 200;
        const dt = (o.tMax || 600) / steps;
        const pts = [{ t: 0, T: o.T0 }];
        let T = o.T0;
        for (let i = 0; i < steps; i++) {
            T = coolingStep(T, o, dt);
            pts.push({ t: (i + 1) * dt, T });
        }
        return pts;
    }

    /**
     * 有內熱源時的**平衡溫度**：P_in = εσA(T⁴ − T_s⁴) 的解。
     * 例：一塊暖氣板在房間裡最後會停在幾度。
     */
    function equilibriumTemp(o) {
        return Math.pow(Math.pow(o.Ts, 4) + o.Pin / (o.eps * SIGMA * o.A), 0.25);
    }

    // ======================================================================
    // ④ 比熱容量與潛熱：加熱曲線的能量預算
    // ======================================================================
    // ⚠️ 這一節的溫度是**攝氏**（熔點沸點就是這樣寫的），能量是焦耳。
    //    單位和上面幾節不同，是刻意的，不是漏改。
    //
    // 水的三個數字就是這一頁的主角：
    //   冰的比熱 2100、水的比熱 4186、水蒸氣 2010 J/(kg·K)
    //   熔化潛熱 3.34e5、汽化潛熱 2.26e6 J/kg
    // 汽化潛熱是熔化潛熱的 6.8 倍，而加熱 100 克的水從 0 到 100 °C 只要
    // 4.2e4 J——**燒開水花的能量是把它從冰點加熱到沸點的五倍多**。
    const SUBSTANCES = {
        water: { name: '水',   cSolid: 2100, cLiquid: 4186, cGas: 2010,
                 Tfus: 0,      Tvap: 100,   Lf: 3.34e5, Lv: 2.26e6 },
        copper:{ name: '銅',   cSolid: 385,  cLiquid: 500,  cGas: 500,
                 Tfus: 1085,   Tvap: 2562,  Lf: 2.05e5, Lv: 4.73e6 },
        lead:  { name: '鉛',   cSolid: 128,  cLiquid: 148,  cGas: 148,
                 Tfus: 327.5,  Tvap: 1749,  Lf: 2.30e4, Lv: 8.66e5 },
        alcohol:{ name: '酒精', cSolid: 2400, cLiquid: 2500, cGas: 1430,
                 Tfus: -114.1, Tvap: 78.3,  Lf: 1.09e5, Lv: 8.55e5 },
    };

    /** 沒有相變時加熱／冷卻需要的能量 Q = mcΔT（J）。ΔT 可正可負。 */
    function heatFor(m, c, dT) {
        return m * c * dT;
    }

    /** 相變所需的能量 Q = mL（J）。熔化與汽化都用這一個。 */
    function latentHeat(m, L) {
        return m * L;
    }

    /**
     * 把「從 T0 加熱到 Tmax」切成一段一段的能量預算。
     *
     * 每一段是加熱曲線上的一節：升溫的段是斜線（溫度在變），相變的段是
     * **水平線**（能量一直進，溫度不動）。回傳的 Q0/Q1 是這一節在**能量軸**
     * 上的起訖，所以整條曲線就是一串接起來的線段。
     *
     * ⚠️ 一定要用這一支，不要在頁面上寫 if (T < 0) … else if (T < 100) …
     *    那種寫法在「起始溫度已經是液體」或「Tmax 沒高過熔點」的時候會
     *    悄悄漏掉一整段，而曲線看起來仍然是一條合理上升的線。
     *
     * @param {object} sub SUBSTANCES 裡的一筆
     * @param {object} o   {m, T0, Tmax}   T0/Tmax 是攝氏
     * @returns {{segs:Array, total:number}}
     *   seg = {id, label, kind:'sensible'|'latent', T0, T1, c, L, Q0, Q1, span}
     */
    function heatingSegments(sub, o) {
        const m = o.m;
        const T0 = Math.min(o.T0, o.Tmax), Tmax = Math.max(o.T0, o.Tmax);
        const segs = [];
        let Q = 0;

        const push = seg => {
            seg.Q0 = Q;
            Q += seg.span;
            seg.Q1 = Q;
            segs.push(seg);
        };
        const sensible = (id, label, a, b, c) => {
            if (!(b > a)) return;
            push({ id, label, kind: 'sensible', T0: a, T1: b, c, span: heatFor(m, c, b - a) });
        };
        const latent = (id, label, T, L) => {
            if (!(L > 0)) return;
            push({ id, label, kind: 'latent', T0: T, T1: T, L, span: latentHeat(m, L) });
        };

        // 固體：從 T0 到 min(Tmax, 熔點)
        sensible('solid', '加熱固體', T0, Math.min(Tmax, sub.Tfus), sub.cSolid);
        // 熔化：只有跨過熔點才發生
        if (T0 < sub.Tfus && Tmax > sub.Tfus) latent('melt', '熔化中', sub.Tfus, sub.Lf);
        // 液體：從 max(T0, 熔點) 到 min(Tmax, 沸點)
        sensible('liquid', '加熱液體',
                 Math.max(T0, sub.Tfus), Math.min(Tmax, sub.Tvap), sub.cLiquid);
        // 汽化：只有跨過沸點才發生
        if (T0 < sub.Tvap && Tmax > sub.Tvap) latent('boil', '沸騰中', sub.Tvap, sub.Lv);
        // 氣體：從 max(T0, 沸點) 到 Tmax
        sensible('gas', '加熱氣體',
                 Math.max(T0, sub.Tvap), Tmax, sub.cGas);

        return { segs, total: Q, substance: sub, m, T0, Tmax };
    }

    /**
     * 給定已加入的能量 Q（J），回傳那一點的狀態。
     *
     * @returns {{T:number, seg:object, phase:string, frac:number,
     *            melted:number, vaporised:number, done:boolean}}
     *   T        攝氏
     *   seg      落在哪一段（null 表示 Q 超出總能量）
     *   phase    固體／熔化中／液體／沸騰中／氣體
     *   frac     在這一段裡的進度 0–1（相變段就是「熔化了幾成」）
     *   melted   已熔化的質量（kg）  vaporised 已汽化的質量（kg）
     */
    function stateAt(budget, Q) {
        const segs = budget.segs, m = budget.m;
        const total = budget.total;
        const q = Math.max(0, Math.min(Q, total));
        let seg = segs[segs.length - 1];

        // ⚠️ 界線要用**嚴格**的 `<`，不能寫 `q <= s.Q1`。
        //    寫 `<=` 的話 q 剛好等於某一段的終點時會停在**前一段**，於是
        //    跑滿整條曲線的那一刻（q = total）回報的相態是倒數第二段——
        //    水會說「液體 130 °C」、鉛會說「液體 400 °C」，而溫度是對的，
        //    所以只看溫度不會發現。最後一段永遠由 `s === segs[last]` 接住。
        for (const s of segs) {
            if (q < s.Q1 || s === segs[segs.length - 1]) { seg = s; break; }
        }
        const frac = seg.span > 0 ? (q - seg.Q0) / seg.span : 1;
        const T = seg.kind === 'latent'
            ? seg.T0
            : seg.T0 + (seg.T1 - seg.T0) * Math.max(0, Math.min(1, frac));

        // 質量的分配：跨過的相變段就整段算完，當前這一段按 frac 算
        let melted = 0, vaporised = 0;
        for (const s of segs) {
            const done = (q >= s.Q1) ? 1 : (q <= s.Q0 ? 0 : frac);
            if (s.id === 'melt') melted = done;
            if (s.id === 'boil') vaporised = done;
        }

        const phase = seg.kind === 'latent'
            ? (seg.id === 'melt' ? '熔化中' : '沸騰中')
            : ({ solid: '固體', liquid: '液體', gas: '氣體' })[seg.id] || '—';

        return {
            T, seg, phase, frac: Math.max(0, Math.min(1, frac)),
            melted: melted * m, vaporised: vaporised * m,
            done: Q >= total,
        };
    }

    /** 加熱曲線的取樣（給圖表當參考線，也是驗證的對照）。 */
    function heatingCurve(budget, steps) {
        const n = steps || 240;
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const Q = budget.total * i / n;
            pts.push({ Q, T: stateAt(budget, Q).T });
        }
        return pts;
    }

    // ======================================================================
    // ⑤ 氣體定律：理想氣體與分子運動論
    // ======================================================================
    // 五種氣體的莫耳質量（kg/mol）。分子方均根速率要靠它。
    const GASES = {
        air:    { name: '空氣',   M: 0.02896 },
        helium: { name: '氦氣',   M: 0.004003 },
        argon:  { name: '氬氣',   M: 0.039948 },
        co2:    { name: '二氧化碳', M: 0.044010 },
    };

    /** p = nRT/V（Pa）。n 莫耳、T 克耳文、V 立方公尺。 */
    function idealP(n, T, V) { return n * R_GAS * T / V; }
    /** V = nRT/p（m³）。 */
    function idealV(n, T, p) { return n * R_GAS * T / p; }
    /** T = pV/(nR)（K）。 */
    function idealT(p, V, n) { return p * V / (n * R_GAS); }

    /**
     * 分子方均根速率 c_rms = √(3RT/M)（m/s）。
     *
     * ⚠️ 是**均方根**不是平均；平均速率是 √(8RT/πM)，兩者差 8%——同一頁
     *    不要混著用不同的式子算同一個量，卡片上的數字會和動畫對不起來。
     *
     * 空氣 300 K 時是 508 m/s。那大約是音速（347 m/s）的 1.5 倍，
     * 這個比值本身就是一個好記的錨點。
     */
    function rmsSpeed(T, M) { return Math.sqrt(3 * R_GAS * T / M); }

    /** 一個分子的平均平動動能（J）：3/2·kT。和分子種類無關——這是重點。 */
    function meanKE(T) { return 1.5 * KB * T; }

    /** 一莫耳的平動動能（J）：3/2·RT。 */
    function molarKE(T) { return 1.5 * R_GAS * T; }

    /**
     * 撞擊活塞（或任何一面牆）的頻率（1/s）。
     *
     * 分子運動論推出來的結果：單位時間撞上單位面積的次數
     *   Z = (n/V)·(c̄/4)，c̄ = √(8RT/πM) 是平均速率。
     * 乘上活塞面積 A 就是每秒幾次。
     *
     * ⚠️ 這一頁拿它當「壓力是撞出來的」的那個看得見的證據：溫度升高 →
     *    分子變快也變多（其實是變快，條數不變）→ 每秒撞更多次 → 壓力上升。
     */
    function collisionRate(o) {
        const cbar = Math.sqrt(8 * R_GAS * o.T / (Math.PI * o.M));
        // 分子數密度（1/m³）× 平均速率 ÷ 4 × 面積 = 每秒幾次
        return 0.25 * (o.n * NA / o.V) * cbar * o.A;
    }

    /** 上式乘上每次碰撞傳遞的動量，就是壓力：p = (1/3)·ρ·c_rms² 。
     *  這一支存在的目的是讓「撞擊頻率」與「壓力」可以互相印證（驗證腳本用）。 */
    function pressureFromKinetic(o) {
        const M = o.M;
        return (o.n * M / o.V) * rmsSpeed(o.T, M) * rmsSpeed(o.T, M) / 3;
    }

    // ======================================================================
    // 診斷：壞掉的狀態要當場說出來
    // ======================================================================
    /**
     * 把這一幀的關鍵量丟進來，回傳有沒有物理上不可能的東西。
     *
     * 舊頁面最常見的失敗不是「算錯」，而是**算不下去卻繼續畫**——顯式差分
     * 發散、體積變成負的、溫度跌到絕對零度以下，畫面照樣在動，只是畫的是
     * 假的。這一支讓那個當場停下來講。
     *
     * 頁面在 draw() 裡呼叫它，不 OK 就畫一個紅色標籤而不是畫場景。
     * verify-thermal.js 用它掃過五頁的極端參數。
     */
    function check(s) {
        const errors = [];
        if (s.T != null && s.T < 0) errors.push(`溫度 ${s.T.toFixed(1)} K 低於絕對零度`);
        if (s.V != null && !(s.V > 0)) errors.push(`體積必須是正的（${s.V}）`);
        if (s.L != null && !(s.L > 0)) errors.push(`長度必須是正的（${s.L}）`);
        if (s.p != null && !(s.p > 0)) errors.push(`壓力必須是正的（${s.p}）`);
        if (s.alpha != null && !(s.alpha > 0)) errors.push(`熱擴散率必須是正的（${s.alpha}）`);
        if (s.F != null && s.F > 0.5) {
            errors.push(`擴散數 F = ${s.F.toFixed(3)} > 0.5，顯式有限差分會發散`);
        }
        if (s.eps != null && !(s.eps >= 0 && s.eps <= 1)) {
            errors.push(`發射率必須在 0–1 之間（${s.eps}）`);
        }
        return { ok: errors.length === 0, errors };
    }

    return {
        SIGMA, R_GAS, KELVIN, G, KB, NA,
        toK, toC,
        MATERIALS, diffusivity,

        // ① 熱傳導
        heatCurrent, thermalResistance, steadyProfile, conductionStep,
        diffusionNumber, stableDt, diffusionTime, conductionDriver,

        // ② 熱對流
        FLUIDS, prandtl, RA_C, CRITICAL_K,
        rayleigh, criticalDT, convectionAmplitude, buoyantSpeed, stokesSpeed,
        streamFunction, cellVelocity, cellTemperature, nusselt,

        // ③ 熱輻射
        SURFACES, stefanPower, coolingRate, coolingStep, coolingCurve,
        equilibriumTemp,

        // ④ 比熱容量與潛熱
        SUBSTANCES, heatFor, latentHeat, heatingSegments, stateAt, heatingCurve,

        // ⑤ 氣體定律
        GASES, idealP, idealV, idealT, rmsSpeed, meanKE, molarKE,
        collisionRate, pressureFromKinetic,

        check,
    };
})();
