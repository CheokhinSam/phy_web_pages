/**
 * ⚡ CircuitKit — 電路的物理：元件模型 + 節點分析求解器
 *
 * 這支檔案裡**沒有一行程式碰到畫面**。它只做一件事：給一份電路資料，算出
 * 每個節點的電位、每個元件的電流與電壓。畫面在 circuit-scene.js，兩者分開
 * 是為了讓 verify-electricity.js 可以把它整支抓進 Node 逐位斷言——七頁電學
 * 的教學宣稱全部建立在這裡的等式上，這些斷言過不了就不要上線。
 *
 * ==========================================================================
 * 為什麼要有求解器（而不是每頁自己寫公式）
 * ==========================================================================
 * 舊的兩頁電學（ohms-law.js、series-parallel.js）把「畫出來的電路」和
 * 「算出來的電路」寫成兩份各自硬幹的程式，結果就是：
 *
 *   - series-parallel.js:428 的並聯電路圖頂端有一條導線把左右兩軌直接接通，
 *     繞過所有燈泡（＝短路），但安培計顯示的卻是理想並聯的總電流。
 *     畫的電路和算的電路不是同一個電路。
 *   - ohms-law.js:220 的 V–I 圖是 31 個預先算好的點 y = v/totalR 鋪出來的
 *     理論線，跟當下的電路無關，拉電壓滑桿它不會動。
 *
 * 這裡的電路是**一份資料**，solve() 算的就是 circuit-scene.js 畫的那一份。
 * 這一類錯誤在結構上不可能再發生——不是靠小心，是靠架構。
 *
 * ==========================================================================
 * 演算法：Modified Nodal Analysis
 * ==========================================================================
 * 未知數 = 所有節點的電位（挑一個接地） + 每個理想電壓源的支路電流。
 * 電阻跺 conductance、電壓源多跺一條拘束列，然後高斯消去（部分主元）。
 * 這是電路學的標準做法，好處是**任何拓樸都吃得下**：串並聯、分壓分流、
 * 內電阻、惠斯登電橋、雙迴路基爾霍夫，全部是同一支求解器，不是六套公式。
 *
 * 非歐姆元件（燈泡、二極體）用**迭代線性化**：每個元件在當下的工作點提供
 * 一組等效 (G, I0)，跺進矩陣解一輪、更新工作點、再解一輪，直到收斂。
 * 燈泡與熱敏電阻是「電阻隨自身功率變化」的定點迭代（兩者只差溫度係數的
 * 正負號），二極體是分段線性。
 *
 * 數值穩定性來自 MNA 本身，沒有做 GMIN 之類的保險——所以**矩陣奇異是真的
 * 代表電路有問題**（某塊浮空、沒有接地路徑），不是數值誤差。這種時候
 * solve() 會回傳 ok:false，寧可當場說出來，也不要安靜地給一組看起來很
 * 合理的假數字。check() 可以在畫圖之前先體檢。
 *
 * ==========================================================================
 * 符號約定（很重要，頁面作者看這裡）
 * ==========================================================================
 *   元件用 from / to 兩個節點描述。
 *   partV[id] = v[from] − v[to]        電壓降（順著 from→to 的方向）
 *   partI[id] > 0 代表 conventional current 順著 from→to 流
 *   partP[id] = partV × partI          元件**吸收**的功率
 *
 * ⚠️ 電池的 partI 特別定義成「這顆電池正在**放出**多少電流」——
 *    所以正常放電時是**正數**，被充電時才是負數。
 *    這是唯一一個和「from→to」字面方向相反的元件，因為電池的物理電流
 *    在它**內部**是從 − 流向 +，和外部迴路相反。這樣頁面上寫
 *    `V = ε − I·r` 時 I 直接就是 partI，不必再取負號。
 *
 * ⚠️ partI 是 conventional current（正電荷的流動方向），不是電子流。
 *    兩者方向相反——circuit-scene.js 的電子流疊圖就是靠這個負號畫出來的。
 */
var CircuitKit = (function () {
    'use strict';

    // ======================================================================
    // 元件表
    // ======================================================================
    //   zero      預設 0 Ω。跺成 0 V 的理想電壓源——這樣是**精確**的，
    //             而且順便得到流過它的電流（安培計的讀數就是這個）。
    //   source    有電動勢，會多一個支路電流未知數。
    //   thermal   電阻隨自身功率變化，需要迭代（燈泡、熱敏電阻）。
    //   threshold 分段線性（二極體）。
    //
    // 每種元件的預設值集中在這裡，頁面只寫它要覆蓋的部分。
    const KINDS = {
        wire:       { zero: true },
        ammeter:    { zero: true, meter: 'A' },
        switch:     { zero: true, open: false },
        fuse:       { zero: true, rating: 5 },
        resistor:   { R: 10 },
        rheostat:   { R: 10 },      // 可變電阻，R 由滑桿給
        voltmeter:  { R: 1e6, meter: 'V' },   // 內阻很大，並聯
        battery:    { source: true, emf: 6, r: 0.5 },
        bulb:       { thermal: true, R0: 4, heat: 0.42 },      // 正溫度係數
        thermistor: { thermal: true, R0: 100, heat: -0.35 },   // NTC，負溫度係數
        diode:      { threshold: true, Vf: 0.6, Rd: 2, Rrev: 1e7 },
        // 只給 equivalentR() 內部用，頁面不會直接寫它
        currentsource: { I: 1 },
    };

    // 迭代收斂參數
    const MAX_ITER = 200;
    const I_TOL = 1e-12;      // 工作點收斂門檻：等效電流源兩輪之間差幾安培
    const DAMP = 0.5;         // 阻尼，避免分段線性元件在兩支之間來回跳
    const R_FLOOR = 0.15;     // 熱敏電阻的電阻下限（× R0），避免負電阻

    function kindOf(part) { return KINDS[part.kind] || {}; }

    /** 這個元件現在是不是 0 Ω（斷開的開關、熔斷的保險絲不算） */
    function isZeroOhm(part) {
        if (part.R != null) return part.R === 0;
        if (part.kind === 'switch') return part.open !== true;
        if (part.kind === 'fuse') return part.blown !== true;
        return kindOf(part).zero === true;
    }

    /** 這個元件現在是不是開路（斷開的開關、熔斷的保險絲） */
    function isOpen(part) {
        if (part.kind === 'switch') return part.open === true;
        if (part.kind === 'fuse') return part.blown === true;
        return false;
    }

    /** 元件在「正常工作」狀態下的固定電阻；沒有固定電阻的回傳 null */
    function fixedR(part) {
        const k = kindOf(part);
        if (k.source || k.thermal || k.threshold || k.meter === 'A') return null;
        if (isZeroOhm(part)) return null;
        const R = part.R != null ? part.R : k.R;
        return R != null ? R : null;
    }

    // ======================================================================
    // 電路資料的前處理
    // ======================================================================
    // 節點依「第一次出現」的順序編號，接地的排第 0 個。
    // 電池的內電阻需要一個內部節點，這裡自動長出來，頁面不必自己宣告。
    function build(C) {
        const parts = (C.parts || []).slice();

        const names = [];
        const idx = new Map();
        function touch(name) {
            if (!idx.has(name)) { idx.set(name, names.length); names.push(name); }
            return idx.get(name);
        }
        for (const p of parts) { touch(p.from); touch(p.to); }
        if (names.length === 0) return null;

        // 接地點：頁面指定的優先，否則用第一個節點。
        // 節點編號 0 = 接地 = 電位 0，所以把它換到最前面。
        const gndName = (C.ground && idx.has(C.ground)) ? C.ground : names[0];
        if (gndName !== names[0]) {
            const gi = idx.get(gndName), zero = idx.get(names[0]);
            idx.set(names[0], gi); idx.set(gndName, zero);
            const t = names[0]; names[0] = gndName; names[gi] = t;
        }

        // 一個 part 可能長成兩條支路（電池 = 理想電源 + 內電阻），
        // 但對外仍然只有一個 partI / partV。
        const branches = [];
        let autoN = 0;
        for (const p of parts) {
            if (isOpen(p)) continue;                 // 斷開＝開路，不跺進矩陣
            const k = kindOf(p);

            if (k.source) {
                const emf = p.emf != null ? p.emf : k.emf;
                const r = p.r != null ? p.r : k.r;
                if (r > 0) {
                    const mid = '__r' + (autoN++) + '_' + p.id;
                    touch(mid);
                    branches.push({ part: p, from: idx.get(p.from), to: idx.get(mid), src: true, emf, rep: -1 });
                    branches.push({ part: null, from: idx.get(mid), to: idx.get(p.to), R: r, rep: 1 });
                } else {
                    branches.push({ part: p, from: idx.get(p.from), to: idx.get(p.to), src: true, emf, rep: -1 });
                }
                continue;
            }

            if (isZeroOhm(p)) {
                // 0 Ω 用 0 V 的理想電壓源跺——精確，而且它的支路電流
                // 就是流過去的電流（安培計要的就是這個）。
                branches.push({ part: p, from: idx.get(p.from), to: idx.get(p.to), src: true, emf: 0, rep: 1 });
                continue;
            }

            branches.push({ part: p, from: idx.get(p.from), to: idx.get(p.to), R: fixedR(p), rep: 1 });
        }

        return { parts, names, idx, nNodes: names.length, branches };
    }

    // ======================================================================
    // 高斯消去（部分主元）
    // ======================================================================
    // 回傳 null 代表奇異——有一塊電路浮空、沒有接地路徑。
    function solveLinear(A, b) {
        const n = b.length;
        for (let i = 0; i < n; i++) A[i].push(b[i]);

        for (let c = 0; c < n; c++) {
            let piv = c, best = Math.abs(A[c][c]);
            for (let r = c + 1; r < n; r++) {
                const v = Math.abs(A[r][c]);
                if (v > best) { best = v; piv = r; }
            }
            if (best < 1e-13) return null;
            if (piv !== c) { const t = A[piv]; A[piv] = A[c]; A[c] = t; }

            const d = A[c][c];
            for (let r = c + 1; r < n; r++) {
                const f = A[r][c] / d;
                if (f === 0) continue;
                for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
            }
        }

        const x = new Array(n).fill(0);
        for (let r = n - 1; r >= 0; r--) {
            let s = A[r][n];
            for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
            x[r] = s / A[r][r];
        }
        return x;
    }

    // ======================================================================
    // 元件在當下工作點的等效 (G, I0)
    // ======================================================================
    // 每個元件的電流都寫成  I = G·V + I0   （V = v[from] − v[to]）
    // 線性元件每一輪都回同一個答案；非線性元件靠 st 帶著工作點，
    // 用上一輪解出來的 V 把工作點往前推一步（阻尼）。
    //
    // ⚠️ 結果會**快取在 st.Gs / st.Is**，輸出的時候直接讀那兩個值。
    //    不可以為了算電流再呼叫一次 stamp()——那會多推一次工作點，
    //    回傳的就不是剛剛跺進矩陣的那一組數字了。
    //
    // ⚠️ 收斂的判據是「這一輪跺進矩陣的 G、I0 和上一輪差多少」，
    //    換算成電流：|ΔG·V| + |ΔI0|。**不能用節點電位有沒有變**——
    //    二極體直接並在理想電源上時，電位從第一輪之後就再也不動了，
    //    但它的工作點還停在逆向那一支，會被誤判成收斂。
    function stamp(st, V) {
        if (st.kind === 'bulb' || st.kind === 'thermistor') {
            // R = R₀(1 + heat·P)，P 是這個元件自己消耗掉的功率 V²/R。
            // 燈泡 heat > 0（越熱電阻越大），熱敏電阻 heat < 0（越熱電阻越小）。
            const P = V * V / st.R;
            let target = st.R0 * (1 + st.heat * P);
            const floor = st.R0 * R_FLOOR;
            if (target < floor) target = floor;
            st.R += DAMP * (target - st.R);
            st.Gs = 1 / st.R;
            st.Is = 0;
        } else if (st.kind === 'diode') {
            // 分段線性：逆向幾乎不導通，順向過了 Vf 才陡起來。
            // 順向那一段 I = (V − Vf)/Rd 改寫成 G·V + I0 之後 I0 = −Vf/Rd。
            const fwd = V >= st.Vf;
            const Gt = fwd ? 1 / st.Rd : 1 / st.Rrev;
            const I0t = fwd ? -st.Vf / st.Rd : 0;
            // 阻尼：分段元件在兩支之間跳會震盪
            st.Gs += DAMP * (Gt - st.Gs);
            st.Is += DAMP * (I0t - st.Is);
        } else {
            st.Gs = st.R > 0 ? 1 / st.R : 0;
            st.Is = 0;
        }

        st.move = Math.abs(st.Gs - st.Gprev) * Math.abs(V) + Math.abs(st.Is - st.Iprev);
        st.Gprev = st.Gs;
        st.Iprev = st.Is;
        return st;
    }

    // ======================================================================
    // solve — 解一個電路
    // ======================================================================
    /**
     * @param {object} C  { parts:[{id, kind, from, to, ...}], ground? }
     * @returns {object}  見檔頭的符號約定。
     */
    function solve(C) {
        const B = build(C);
        if (!B) return { ok: false, reason: '空的電路', nodeV: {}, partI: {}, partV: {}, partP: {} };

        const n = B.nNodes - 1;                 // 接地的電位固定 0，不是未知數
        const m = B.branches.filter(b => b.src).length;
        const size = n + m;

        // ── 建立每個元件的工作點狀態 ────────────────────────────────
        const states = new Map();
        for (const p of B.parts) {
            if (isOpen(p)) continue;
            const k = kindOf(p);
            let st;
            if (k.thermal) {
                const R0 = p.R0 != null ? p.R0 : k.R0;
                st = {
                    kind: p.kind, R0,
                    heat: p.heat != null ? p.heat : k.heat,
                    R: R0,
                };
            } else if (k.threshold) {
                const Rrev = p.Rrev != null ? p.Rrev : k.Rrev;
                st = {
                    kind: 'diode',
                    Vf: p.Vf != null ? p.Vf : k.Vf,
                    Rd: p.Rd != null ? p.Rd : k.Rd,
                    Rrev,
                };
            } else {
                st = { kind: p.kind, R: fixedR(p) };
            }
            // 起始工作點：線性元件就用自己的電阻，非線性元件先當成「冷的／逆向的」
            st.Gs = st.R > 0 ? 1 / st.R : (st.Rrev ? 1 / st.Rrev : 0);
            st.Is = 0;
            st.Gprev = st.Gs;
            st.Iprev = st.Is;
            // ⚠️ 起始值是 0 不是 Infinity。電源類的元件永遠不會被 stamp()
            //    （它在矩陣裡是一條拘束列，不是 conductance），如果起始值
            //    是 Infinity 就會永遠留著，max(move) 從此降不下來，
            //    「至少跑兩輪」的保護會變成「永遠不收斂」。
            st.move = 0;
            states.set(p.id, st);
        }

        let V = null, solv = null, iter = 0, converged = false;

        for (iter = 0; iter < MAX_ITER; iter++) {
            // ── 組矩陣 ──────────────────────────────────────────────
            const A = [];
            for (let i = 0; i < size; i++) A.push(new Array(size).fill(0));
            const rhs = new Array(size).fill(0);

            let si = 0;
            for (const b of B.branches) {
                // 電流源：只注入電流，不跺 conductance。
                // 頁面不會用到它，這是 equivalentR() 的探針。
                if (b.part && b.part.kind === 'currentsource') {
                    const J = b.part.I != null ? b.part.I : 1;
                    if (b.from > 0) rhs[b.from - 1] -= J;   // 從 from 抽出
                    if (b.to > 0) rhs[b.to - 1] += J;       // 注入 to
                    continue;
                }

                if (b.src) {
                    const row = n + si, col = n + si;
                    const p = b.from, q = b.to;            // p 是 +、q 是 −
                    if (p > 0) { A[row][p - 1] += 1; A[p - 1][col] += 1; }
                    if (q > 0) { A[row][q - 1] -= 1; A[q - 1][col] -= 1; }
                    rhs[row] = b.emf;
                    b._col = col;
                    si++;
                    continue;
                }

                // 內部支路（電池的內電阻）沒有 part，用固定電阻跺
                const st = b.part ? states.get(b.part.id) : { R: b.R, Gs: 1 / b.R, Is: 0 };
                if (b.part) stamp(st, V ? (V[b.from] - V[b.to]) : 0);
                const G = st.Gs, I0 = st.Is;

                const p = b.from, q = b.to;
                if (p > 0) A[p - 1][p - 1] += G;
                if (q > 0) A[q - 1][q - 1] += G;
                if (p > 0 && q > 0) { A[p - 1][q - 1] -= G; A[q - 1][p - 1] -= G; }

                // I0 是順著 from→to 流的電流源：注入 to、從 from 抽出
                if (p > 0) rhs[p - 1] -= I0;
                if (q > 0) rhs[q - 1] += I0;
            }

            const sol = size === 0 ? [] : solveLinear(A, rhs);
            if (sol === null) {
                return {
                    ok: false, reason: '矩陣奇異——有元件浮空、沒有接地路徑',
                    nodeV: {}, partI: {}, partV: {}, partP: {}, iterations: iter,
                };
            }

            const nv = [0];                             // 接地的電位是 0
            for (let i = 0; i < n; i++) nv.push(sol[i]);
            V = nv;
            solv = sol;                                 // 支路電流住在 sol 的後半段

            // ── 工作點收斂了嗎 ──────────────────────────────────────
            // stamp() 已經把「這一輪跺進矩陣的值和前幾輪差多少」記在 st.move。
            // ⚠️ 至少要跑兩輪：第一輪所有元件的 V 都當成 0，二極體會停在
            //    逆向那一支，那時候看起來是收斂的，其實還沒開始。
            let move = 0;
            for (const st of states.values()) if (st.move > move) move = st.move;
            if (iter > 0 && move < I_TOL) { converged = true; iter++; break; }
        }

        // ── 整理輸出 ────────────────────────────────────────────────
        const nodeV = {};
        for (let i = 0; i < B.names.length; i++) nodeV[B.names[i]] = V[i];

        const partI = {}, partV = {}, partP = {}, partR = {};
        for (const p of B.parts) {
            if (!B.idx.has(p.from) || !B.idx.has(p.to)) continue;
            const f = B.idx.get(p.from), t = B.idx.get(p.to);
            const v = V[f] - V[t];
            partV[p.id] = v;

            if (isOpen(p)) { partI[p.id] = 0; partP[p.id] = 0; continue; }

            const st = states.get(p.id);
            const b0 = B.branches.find(b => b.part === p);
            let I = 0;
            if (b0) {
                // ⚠️ 支路電流住在解向量 solv 的後半段（索引 ≥ n），
                //    不是在節點電位陣列 V 裡。用 V[_col] 取值會拿到
                //    某個節點的電位，數字看起來很合理卻是錯的。
                I = b0.src
                    ? b0.rep * solv[b0._col]              // 電池：正數＝正在放電
                    : b0.rep * (st.Gs * (V[b0.from] - V[b0.to]) + st.Is);
            }

            partI[p.id] = I;
            // 吸收的功率。電源放電時是負的（它供給能量而不是消耗）。
            partP[p.id] = v * (kindOf(p).source ? -I : I);
            if (st && st.R > 0) partR[p.id] = st.R;
        }

        return { ok: true, converged, iterations: iter, nodeV, partI, partV, partP, partR };
    }

    // ======================================================================
    // check — 這份電路資料有沒有問題
    // ======================================================================
    /**
     * 這不是求解，是**體檢**。舊的並聯電路圖（series-parallel.js:428）
     * 頂端有一條導線把兩軌接通，繞過所有燈泡——那種圖就是被這裡的第一條
     * 抓到的。頁面在開發時呼叫它，壞掉的電路要當場說出來，而不是安靜地
     * 畫出一張錯的圖。
     */
    function check(C) {
        const problems = [];
        const parts = C.parts || [];
        if (!parts.length) return { ok: false, problems: ['空的電路'] };

        // 把「只由 0 Ω 元件連起來」的節點縮成同一團（union-find）
        const parent = new Map();
        function find(x) {
            if (!parent.has(x)) parent.set(x, x);
            let r = x;
            while (parent.get(r) !== r) r = parent.get(r);
            while (parent.get(x) !== r) { const nx = parent.get(x); parent.set(x, r); x = nx; }
            return r;
        }
        for (const p of parts) { find(p.from); find(p.to); }
        for (const p of parts) {
            if (!isZeroOhm(p)) continue;
            const a = find(p.from), b = find(p.to);
            if (a !== b) parent.set(a, b);
        }

        // ① 短路：電源的兩端被 0 Ω 的路徑接在一起。
        //    注意是看**電源**的兩端——一圈純導線而沒有電源是無害的。
        for (const p of parts) {
            if (kindOf(p).source && find(p.from) === find(p.to)) {
                problems.push(`短路：電池「${p.id}」的 + 端（${p.from}）與 − 端（${p.to}）之間只有 0 Ω 的路徑`);
            }
        }

        // ② 懸空節點：只接了一個元件，電流沒有地方去
        const deg = new Map();
        for (const p of parts) {
            deg.set(p.from, (deg.get(p.from) || 0) + 1);
            deg.set(p.to, (deg.get(p.to) || 0) + 1);
        }
        for (const [name, d] of deg) {
            if (d < 2) problems.push(`懸空節點「${name}」只接了 ${d} 個元件`);
        }

        // ③ 沒有電源
        if (!parts.some(p => kindOf(p).source)) problems.push('這份電路沒有任何電源');

        return { ok: problems.length === 0, problems };
    }

    // ======================================================================
    // 輔助函式（頁面的卡片與驗證都會用）
    // ======================================================================

    /** 串聯：R = ΣR */
    function seriesR(list) { return list.reduce((s, r) => s + r, 0); }

    /** 並聯：1/R = Σ1/R */
    function parallelR(list) {
        let g = 0;
        for (const r of list) g += 1 / r;
        return g > 0 ? 1 / g : Infinity;
    }

    /**
     * 三個功率公式的同一個量。頁面把三個並排顯示，學生才看得出來
     * P = VI = I²R = V²/R 不是三個公式，是同一件事的三種寫法。
     */
    function power(o) {
        return { VI: o.V * o.I, I2R: o.I * o.I * o.R, V2R: o.V * o.V / o.R };
    }

    /**
     * 這條導線上的載子往哪邊走：+1 表示順著 from→to。
     *
     *   carrier = 'current'   傳統電流——正電荷的流動方向，安培計讀數、箭頭、
     *                         I = Q/t 用的都是這一個。
     *   carrier = 'electron'  電子流——**永遠相反**。
     *
     * ⚠️ 舊的 ohms-law.js 與 series-parallel.js 把點點的移動方向寫成順時針
     *    （＝傳統電流），註解卻寫「電子流」，等於把電子畫成帶正電。這條式子
     *    存在的目的就是把那個負號關在模組裡——畫面只負責問「這個載子往哪走」，
     *    不要自己決定正負。
     *
     * ⚠️ 電池是**唯一一個要取負號**的元件，因為它的 partI 不是「順 from→to
     *    的電流」而是「從 + 端放出的電流」。from 是 +，電流從 from 離開，
     *    所以在元件**內部**電流是朝著 from 流——和路徑方向相反。電化學的
     *    電動勢本來就是把正電荷從 − 推向 +，這是電池內部的真實方向，不是
     *    記號問題。取負號之後，整圈迴路的點才會同向繞行（外電路 + → −、
     *    電池內部 − → +），中間不會突然倒轉。
     */
    function flowSign(part, res, carrier) {
        const I = res.partI[part.id] || 0;
        const s = I < 0 ? -1 : 1;
        // 電源類元件：內部的傳統電流朝著 from，和 from→to 相反
        const d = kindOf(part).source ? -s : s;
        return carrier === 'electron' ? -d : d;
    }

    /**
     * a、b 兩點之間的等效電阻：把所有電源的電動勢關掉，從 a 注入 1 A，
     * 量 a、b 之間的電位差。R = ΔV / 1 A。
     * 借的正是同一支求解器，所以它一定和畫面上那顆電路一致。
     */
    function equivalentR(C, a, b) {
        const killed = {
            ...C,
            ground: b,          // 把 b 接地，a 的電位就直接是 ΔV
            parts: C.parts.map(p => (kindOf(p).source ? { ...p, emf: 0 } : p))
                .concat([{ id: '__probe', kind: 'currentsource', from: b, to: a, I: 1 }]),
        };
        const res = solve(killed);
        if (!res.ok) return NaN;
        return res.nodeV[a] - res.nodeV[b];
    }

    return {
        KINDS,
        solve, check, equivalentR,
        seriesR, parallelR, power,
        isZeroOhm, isOpen, kindOf, flowSign,
    };
})();
