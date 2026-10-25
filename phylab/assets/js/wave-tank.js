/**
 * 🌊 二維水波的繞射與干涉 — 純物理模組
 *
 * 兩頁的畫面都是一整片「水面高度場」，而那個場只有一個來源：**疊加原理**。
 * 場源有兩種，各自是一份資料：
 *
 *   27 繞射  **開口**：障礙物上的每一個取樣點都是一個新的點波源（惠更斯），
 *            各自發出圓形波，疊起來就是繞射圖樣。
 *   34 干涉  **針尖**：兩根針在水面上上下振動，各自送出一列圓形波。
 *
 * 兩者合起來是同一條式子——差別只在每一個場源的振幅與相位：
 *
 *     u(P, t) = Σⱼ  wⱼ · aⱼ(θⱼ) · cos(ωt − k·rⱼ − φⱼ) / √rⱼ
 *
 * ⚠️ **這一支完全沒有 DOM。** 它的存在就是為了讓 Node 可以整支抓進來逐點
 *    斷言（同 circuit-kit.js / thermal-kit.js / machine-kit.js 的作法）：
 *    verify-waves.js 會用它自己算出來的亮紋位置，去對「r₂ − r₁ = mλ」
 *    這條**各自獨立**的幾何條件——畫面上的條紋和課本上的公式是兩份算出來的
 *    東西，對得上才算數。
 *
 * 單位：長度公尺、時間秒。頁面負責把公尺換成世界單位。
 */
var WaveTank = (function () {
    'use strict';

    const TAU = Math.PI * 2;

    // 淺水波的波速 v = √(g·h)。這一頁固定水深 16 公分 → v = 1.25 m/s。
    // 這不是隨手挑的數字：真實的造波水槽就是這個尺度（波長 0.5–1.6 m、
    // 週期 0.4–1.3 秒），所以**這一頁是照真實時間跑的，沒有慢動作**。
    const DEPTH = 0.16;                       // 水深（公尺）
    const V = Math.sqrt(9.81 * DEPTH);        // ≈ 1.253 m/s

    const R_REF = 2.0;                        // 正規化的參考距離（公尺）

    /** 角頻率 ω = 2πv/λ。 */
    function omega(lam) { return TAU * V / lam; }
    /** 波數 k = 2π/λ。 */
    function kOf(lam) { return TAU / lam; }

    // ======================================================================
    // 開口：一份資料
    // ----------------------------------------------------------------------
    // 牆上的開口是這一頁唯一的幾何真相——畫出來的牆、放上去的惠更斯點
    // 波源、算出來的亮紋，全部從這一份推出來。
    // ======================================================================

    /**
     * 場源的中心（相對水槽中線，公尺）。27 是兩個開口的中心，34 是兩根針。
     *
     * ⚠️ **沒有「單／雙」這個模式切換。** 兩個場源永遠都在，只是它們的
     *    間距 d 可以是 0——那時候兩者完全重合，就是一個。d 從 0 慢慢拉大，
     *    學生會親眼看到「第二個場源長出來、條紋才開始出現」的整個過程，
     *    而不是在一個下拉選單裡跳過去。
     *    （順帶解掉一個麻煩：如果做成模式切換，d 這支滑桿在單源模式
     *    就沒有作用，而 WaveScene 的控制面板沒有 `when` 可以把它收起來。）
     */
    function centers(o) {
        if (!o.d) return [0];
        return [-o.d / 2, o.d / 2];
    }

    /**
     * 開口本身（公尺），照 y 排好、相鄰重疊的合併。
     *
     * 合併不是為了好看：d 比 a 小的時候兩個開口在幾何上真的相連，
     * 那時候牆的缺口就只有一個，把它當成兩個會在中間多畫一小段牆。
     */
    function gaps(o) {
        const half = o.a / 2;
        const raw = centers(o).map(c => [c - half, c + half]);
        raw.sort((p, q) => p[0] - q[0]);
        const out = [];
        for (const g of raw) {
            const last = out[out.length - 1];
            if (last && g[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], g[1]);
            else out.push([g[0], g[1]]);
        }
        return out.map(g => ({ y0: g[0], y1: g[1] }));
    }

    /** 開口的總寬度（公尺）——「開口數」以外的另一個幾何量。 */
    function openWidth(o) {
        return gaps(o).reduce((s, g) => s + (g.y1 - g.y0), 0);
    }

    /**
     * 第二種場源：**針尖**（34 水波干涉）。
     *
     * 兩根針插在 o.wallX 這條線上、y 各在 ±d/2，等向地把波送出去。它和開口
     * 的取樣點有三個差別，三個都不是裝飾：
     *
     *   ① **等向（iso）**：沒有 Kirchhoff 傾斜因子 ob = (1 + cosθ)/2。
     *      少了這一條，波源的兩側會不對稱，腹線就不再落在「距離差 = mλ」
     *      那條雙曲線上——27 正是因為有傾斜因子才**刻意不畫**雙曲線
     *      （實測差到 0.1 公尺）；34 沒有它，所以雙曲線逐點重合，畫得上去。
     *   ② **一個點就是一個點**：不必取樣、也沒有取樣間距，所以沒有「光柵
     *      旁瓣」這種由取樣造出來的假條紋。
     *   ③ **可以反相**（p0 = π）：兩根針的相位差不只能是 0。反相時腹線與
     *      節線整個對調——中央那條變成節線，這是「同相」與「反相」在畫面上
     *      唯一看得出差別的地方，也是這一頁最值得動手切一次的東西。
     *
     * ⚠️ 位置讀的是 **o.wallX**，和開口的取樣點同一個名字。名稱一致是刻意的：
     *    norm() 與 table() 的 maxAbs 都以 o.wallX 為基準，針尖另外叫一個名字
     *    的話，兩個數字遲早會分家（「波源的線」只能有一條）。
     */
    function needles(o) {
        return centers(o).map((c, i) => ({
            x: o.wallX, y: c,
            w: o.amp == null ? 1 : o.amp,
            iso: true,
            p0: o.anti && i === 1 ? Math.PI : 0,
        }));
    }

    /**
     * 場源清單：針尖，或者沿著每個開口均勻取樣的惠更斯點波源。
     *
     * 取樣間距要小於 λ（不然會出現假的「光柵旁瓣」，那是取樣造成的，
     * 不是物理），所以每個開口的點數由 a/λ 決定；上限 30 只是預算。
     */
    function samples(o) {
        if (o.needles) return needles(o);
        const out = [];
        const step = o.lam / 3;
        for (const g of gaps(o)) {
            const h = g.y1 - g.y0;
            const n = Math.max(3, Math.min(30, Math.ceil(h / step)));
            const dy = h / n;
            for (let i = 0; i < n; i++) {
                out.push({ x: o.wallX, y: g.y0 + (i + 0.5) * dy, w: dy });
            }
        }
        return out;
    }

    // ======================================================================
    // 場
    // ======================================================================

    /**
     * 未正規化的複數振幅 Σ w·a(θ)·e^{i(kr + φ)}/√r。
     *
     * 振幅因子 a 有兩種：開口的傾斜因子 ob = (1 + cosθ)/2 是 Kirchhoff 的
     * 那一個（正前方全強、側面與背後衰減，少了它牆後面會出現一圈不該存在的
     * 「倒退波」）；針尖是等向的，a = 1（見 needles()）。
     *
     * ⚠️ **這個內圈和 table() 裡那一份是同一份數學，寫在兩個地方。** 分家的
     *    症狀是「畫面畫的場」和「驗證器量的場」不是同一片——兩邊各自都對，
     *    只是不同，而沒有任何一條數值斷言看得出來。verify-waves.js ⑲/㊱ 有一條
     *    逐格把兩邊對起來的斷言在守這件事。
     */
    function raw(o, S, x, y) {
        const k = kOf(o.lam);
        let re = 0, im = 0;
        for (let i = 0; i < S.length; i++) {
            const s = S[i];
            const dx = x - s.x, dy = y - s.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            // 波源上的那一點 r → 0，1/√r 會爆掉。用 0.2λ 當下限，
            // 那個尺度以下本來就已經在「波源裡面」，不該有場。
            const rs = r > o.lam * 0.2 ? r : o.lam * 0.2;
            const amp = s.w * (s.iso ? 1 : 0.5 * (1 + dx / rs)) / Math.sqrt(rs);
            const ph = k * r + (s.p0 || 0);
            re += amp * Math.cos(ph);
            im += amp * Math.sin(ph);
        }
        return { re, im };
    }

    /**
     * 正規化常數：正前方 R_REF 處的未正規化振幅。
     *
     * 少了它，開口愈窄畫面愈暗（能量本來就只過得去那麼多）——但這一頁要
     * 比較的是**圖樣展開的角度**，不是亮度。所有的場一律除以這個數，
     * 「開口變窄 → 條紋變寬變亮」才不會被「整體變暗」蓋掉。
     */
    /**
     * 正規化的除數：一個波源在 R_REF 處的振幅。
     *
     * ⚠️ **兩種波源要分開算，不能共用下面那一行。** 開口的取樣點散在障礙物
     *    上，在 `(wallX + R_REF, 0)` 疊加起來就是它們的總和，讀那個點剛好。
     *    可是**針尖不行**：兩根反相的針在中線上的貢獻永遠等長反向，疊加
     *    當場是 0，`Math.max(..., 1e-6)` 會把除數換成 1e-6，整片場乘上
     *    兩百萬倍、全部飽和成純白。而這個 bug **看不出來是 bug**——畫面只是
     *    「條紋糊掉了」，卡片上的波長、條數、角度全部照樣正確。
     *    所以針尖走另一條：直接加絕對值，不讓相位有機會相消。
     */
    function norm(o, S) {
        const S2 = S || samples(o);
        if (o.needles) {
            let s = 0;
            for (const q of S2) s += Math.abs(q.w) / Math.sqrt(R_REF);
            return Math.max(s, 1e-6);
        }
        const p = raw(o, S2, o.wallX + R_REF, 0);
        return Math.max(Math.sqrt(p.re * p.re + p.im * p.im), 1e-6);
    }

    /**
     * 牆後方的複數振幅（已正規化）。
     *
     * ⚠️ **它與時間無關。** 這是這一頁跑得動的關鍵：真正貴的是這一步，
     *    而它只在參數變動時重算一次；時間只是讓這個複數整體旋轉，
     *    每一幀每一格只要一次乘加（見 table()）。
     */
    function phasor(o, S, N, x, y) {
        const p = raw(o, S, x, y);
        return { re: p.re / N, im: p.im / N };
    }

    /** 瞬時水面高度：u = Re·cos(ωt) + Im·sin(ωt)。 */
    function wave(o, S, N, x, y, t) {
        const p = phasor(o, S, N, x, y);
        const w = omega(o.lam) * t;
        return p.re * Math.cos(w) + p.im * Math.sin(w);
    }

    /**
     * 牆**前面**的入射平面波。在牆面上相位是 0，往 +x 前進——
     * 和開口上那些點波源（相位也是 0）接得起來，所以牆的兩側是連續的。
     */
    function planeWave(o, x, t) {
        return Math.cos(omega(o.lam) * t - kOf(o.lam) * (x - o.wallX));
    }

    // ======================================================================
    // 課本上的那兩條式子——這一頁要拿它們來對照畫面上的條紋
    // ======================================================================

    /**
     * 單狹縫第一暗紋：sinθ₁ = λ/a。
     * λ ≥ a 的時候回 null——這不是「算不出來」，是真的**沒有暗紋**：
     * 開口比波長還窄，波一過縫就往所有方向散開，後方整個都是亮的。
     */
    function firstDarkSin(o) {
        return o.lam < o.a ? o.lam / o.a : null;
    }

    /** 雙狹縫第 m 條亮紋：sinθ = mλ/d。|mλ/d| > 1 時回 null（那條線不存在）。 */
    function fringeSin(o, m) {
        const s = m * o.lam / o.d;
        return Math.abs(s) <= 1 ? s : null;
    }

    /**
     * 「到兩個波源的距離差 = mλ」的那條線，在橫座標 X 處的高度。
     *
     * 兩個波源分別在 (0, ±sep/2)。距離差 r₂ − r₁ 是 Y 的單調函數
     * （0 → sep），所以二分法一定有解。
     *
     * ⚠️ **這條線是雙曲線，不是直線**，課本的 d·sinθ = mλ 是它跑到很遠
     *    之後的漸近線。
     *
     *    ⚠️ **27 沒有把它畫出來，34 畫了，而這個差別是物理不是口味。** 開口
     *    的取樣點帶傾斜因子、而且分散在一段寬度上，兩邊的振幅本來就不一樣
     *    （一個開口離得比較遠、ob 也比較小），亮紋會被拉離開嚴格的等相差
     *    位置——這一頁實測差到 0.1 公尺（十幾個像素）。針尖是等向的點，
     *    疊起來的振幅 √(A₁² + A₂² + 2A₁A₂cos kΔr) 只在 Δr = mλ 處最大，
     *    **和 A₁ ≠ A₂ 無關**，所以 34 的腹線與這條雙曲線逐點重合。
     *
     * @param sep 兩個波源的距離（單狹縫＝開口的兩個邊緣，雙狹縫＝兩個開口中心）
     * @param yMax 超過這個高度就當作「這條線跑出水槽了」，回 null
     */
    function locusY(sep, lam, m, X, yMax) {
        const half = sep / 2;
        const want = m * lam;
        // ⚠️ `m` 是**波程差除以波長**，所以它一定是正的：負的 m 指的是
        //    「下面那一支」，那是由回傳值的正負號決定的，不是由 m 決定的
        //    （呼叫端傳 m 再自己乘 ±1 就會踩到這裡）。
        //    少了這一行，負的 m 不會回 null——二分法找不到解時一路把 hi 往
        //    下夾，最後**回一個看起來很合理的 0.000**，而那條線正好畫在
        //    中線上。畫面上多一條假的線，沒有任何數字會不對。
        if (!(want >= 0)) return null;
        if (!(want < sep)) return null;                  // 距離差最大就是 sep
        const f = Y => Math.sqrt(X * X + (Y + half) * (Y + half))
                     - Math.sqrt(X * X + (Y - half) * (Y - half));
        if (f(yMax) < want) return null;                 // 跑出水槽
        let lo = 0, hi = yMax;
        for (let i = 0; i < 48; i++) {
            const mid = (lo + hi) / 2;
            if (f(mid) < want) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    }

    // ======================================================================
    // 畫一整片場：給畫面用的批次介面
    // ======================================================================

    /**
     * 把整片場算成一張與時間無關的表。
     *
     * 回傳的 re / im 是**複數振幅**，每一幀只要
     * `re[i]*cos(ωt) + im[i]*sin(ωt)` 就是那一格的水面高度——一格兩個乘法。
     * 這支本身只在參數變動時重算。
     *
     * 牆**前面**那一半不必疊加：那裡就是入射的平直波，直接寫解析式。
     *
     * @param g {x0, y0, dx, dy, nx, ny}　公尺（格子中心＝x0 + ix·dx）
     */
    function table(o, g) {
        const S = samples(o), N = norm(o, S);
        const n = g.nx * g.ny;
        const re = new Float32Array(n), im = new Float32Array(n);
        const k = kOf(o.lam);
        let i = 0, maxAbs = 0;
        for (let iy = 0; iy < g.ny; iy++) {
            const y = g.y0 + iy * g.dy;
            for (let ix = 0; ix < g.nx; ix++, i++) {
                const x = g.x0 + ix * g.dx;
                // 針尖沒有「前面／後面」：圓形波往四面八方送，波源的左邊
                // 也真的有波（那一帶是畫面上唯一看得到「波往回走」的地方）。
                // ⚠️ 少了 `!o.needles` 這一半，針的左邊會變成一片平直波——
                //    而它在畫面上長得就像「水槽左邊有一道入射波」，看不出是錯的。
                if (!o.needles && x < o.wallX) {
                    // 入射的平直波：cos(ωt − k(x − wallX))，在牆面上相位是 0。
                    const u = k * (x - o.wallX);
                    re[i] = Math.cos(u);
                    im[i] = Math.sin(u);
                    continue;
                }
                let sr = 0, si = 0;
                for (let j = 0; j < S.length; j++) {
                    const s = S[j];
                    const dx = x - s.x, dy = y - s.y;
                    const r = Math.sqrt(dx * dx + dy * dy);
                    const rs = r > o.lam * 0.2 ? r : o.lam * 0.2;
                    const amp = s.w * (s.iso ? 1 : 0.5 * (1 + dx / rs)) / Math.sqrt(rs);
                    const ph = k * r + (s.p0 || 0);
                    sr += amp * Math.cos(ph);
                    si += amp * Math.sin(ph);
                }
                re[i] = sr / N;
                im[i] = si / N;
                // ⚠️ 最亮處**不看波源邊上那一段**：正後方 r → 0，1/√r 會
                //    衝到很大，把它算進來的話整片場會被壓成灰的。那個亮帶
                //    是真的（能量真的擠在波源旁邊），但它不是畫面要看的
                //    東西——條紋在幾十公分以外。波源邊那一段就讓它過曝成白色。
                if (x > o.wallX + o.lam) {
                    const a = re[i] * re[i] + im[i] * im[i];
                    if (a > maxAbs) maxAbs = a;
                }
            }
        }
        return {
            re, im, nx: g.nx, ny: g.ny,
            x0: g.x0, y0: g.y0, dx: g.dx, dy: g.dy,
            lam: o.lam,
            maxAbs: Math.sqrt(maxAbs),
        };
    }

    /**
     * 沿一條鉛直線掃過去，回傳每個取樣點的振幅。
     *
     * 畫面上水槽右緣那些刻度、還有驗證器用來找亮紋位置，用的都是這一支。
     * **刻度和物理是同一次計算出來的**，不可能各自跑掉。
     */
    function lineProfile(o, x, y0, y1, n) {
        const S = samples(o), N = norm(o, S);
        const out = [];
        for (let i = 0; i < n; i++) {
            const y = y0 + (y1 - y0) * i / (n - 1);
            const p = raw(o, S, x, y);
            out.push({ y, amp: Math.sqrt(p.re * p.re + p.im * p.im) / N });
        }
        return out;
    }

    /**
     * 從剖面線找區域極值：`kind === 'min'` 找暗紋，其餘找亮紋。
     *
     * @param frac 只留振幅大於「最亮處 × frac」的亮紋——牆附近的殘餘起伏
     *             和數值雜訊都會長出假的極大值，不濾掉的話畫面上會多出
     *             一堆不該存在的刻度。找暗紋時反過來用 `(1 − frac)` 過濾
     *             太亮的「極小值」（那是還沒成形的波紋）。
     */
    function peaks(prof, frac, kind) {
        const min = kind === 'min';
        let mx = 0;
        for (const p of prof) if (p.amp > mx) mx = p.amp;
        const v = i => (min ? -prof[i].amp : prof[i].amp);
        const out = [];
        for (let i = 1; i < prof.length - 1; i++) {
            if (v(i) >= v(i - 1) && v(i) > v(i + 1)) {
                if (min ? prof[i].amp <= (1 - frac) * mx : prof[i].amp >= frac * mx) {
                    out.push(prof[i]);
                }
            }
        }
        return out;
    }

    /**
     * 條紋的脊線：沿著深度方向每隔一段取一條剖面線，記下亮紋（或暗紋）的
     * 位置。畫面上就是一串點沿著條紋排。
     *
     * ⚠️ 位置是**從場本身量出來的**，不是用 d·sinθ = mλ 算的。在障礙物
     *    附近條紋會彎開，而課本那條式子是遠處的漸近線——照式子畫出來的
     *    直線會**當著學生的面**和條紋錯開（實測在這一頁的尺度下差到 0.1 m，
     *    也就是十幾個像素），而條紋本身完全正確。
     */
    function tracks(o, xs, yMax, kind, frac) {
        const out = [];
        for (const x of xs) {
            const prof = lineProfile(o, x, -yMax, yMax, 121);
            for (const p of peaks(prof, frac, kind)) out.push({ x, y: p.y, amp: p.amp });
        }
        return out;
    }

    return {
        DEPTH, V, R_REF,
        omega, kOf,
        centers, gaps, openWidth, needles, samples,
        raw, norm, phasor, wave, planeWave,
        firstDarkSin, fringeSin, locusY,
        table, lineProfile, peaks, tracks,
    };
})();
