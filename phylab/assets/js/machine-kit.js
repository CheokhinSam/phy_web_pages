/**
 * 簡單機械的**純物理**模組
 *
 * 這個檔案裡沒有任何 DOM，也沒有一個 p5 呼叫。它可以在 Node 裡被整支抓進去
 * 逐位斷言（`verify-machines.js` 就是這樣做的）。
 *
 * 兩個題材，兩個「唯一真相」：
 *
 *   槓桿    MachineKit.armOf()      支點到力作用線的**垂直距離**
 *   滑輪    MachineKit.threadRope() 繩子怎麼繞；段數由 countStrands() 數回來
 *
 * ⚠️ **滑輪那一組的核心約定是「繩子是一份資料」。**
 *    `pulleyState()` 只吃 `threadRope()` 產生的 `path`，**不吃使用者要求的 n**。
 *    顯示的力氣是從畫出來的那條繩子推出來的，所以「畫 3 段、算 2 段」這種事
 *    在結構上不可能發生——這和電學的「電路是一份資料」是同一條規矩。
 *    驗證器再從 `path` 獨立數一次，形成第二道防線（見 verify-machines.js）。
 *
 * ⚠️ **力臂是垂直距離，不是「支點到作用點的距離」。**
 *    力一斜，作用點沒動，力臂就從 d 變成 d·cosθ。畫虛線、標數字、判平衡
 *    全部要呼叫 `armOf()`，否則這一頁的教學重點會被畫面自己打臉。
 */
var MachineKit = (function () {
    'use strict';

    const DEG = Math.PI / 180;
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const EPS = 1e-9;

    // ======================================================================
    // 槓桿
    // ======================================================================

    /**
     * 支點到力作用線的**垂直距離**（力臂）。
     *
     * 力的作用線通過 `point`，方向角 `angle` 是「從豎直向下算起的傾角」
     * （0 = 正下方，逆時針為正）。世界座標 y 向下，所以方向向量是
     * `d = (sin a, cos a)`。
     *
     * 點到直線的距離 = |(pivot − point) × d̂|，二維外積 = ax·by − ay·bx。
     *
     * ⚠️ 這一支是這一頁的教學重點本身。作用點 `point` 不動、`angle` 一斜，
     *    回傳值就從 |pivot→point| 掉到 |pivot→point|·cos(angle)。
     *    任何「用兩點距離代替力臂」的寫法都會讓畫面與數字互相矛盾。
     */
    function armOf(pivot, point, angle) {
        const dx = pivot.x - point.x;
        const dy = pivot.y - point.y;
        const ax = Math.sin(angle), ay = Math.cos(angle);
        return Math.abs(dx * ay - dy * ax);
    }

    /** 力臂的「天真值」：支點到作用點的直線距離。只用來對照，不是力臂。 */
    function spanOf(pivot, point) {
        return Math.hypot(point.x - pivot.x, point.y - pivot.y);
    }

    /**
     * 力臂的**垂足**：支點到力作用線的垂線與作用線的交點。
     *
     * 畫面要畫的那條虛線就是「支點 → 垂足」。垂足和長度都從這裡出來，
     * 所以畫出來的線長和標在旁邊的數字必然一致——「幾何只能有一個家」。
     */
    function armFoot(pivot, point, angle) {
        const ax = Math.sin(angle), ay = Math.cos(angle);
        const t = (pivot.x - point.x) * ax + (pivot.y - point.y) * ay;
        return { x: point.x + t * ax, y: point.y + t * ay };
    }

    /**
     * 槓桿的平衡狀態。
     *
     * 兩邊都掛在**水平**的桿上（翹翹板／撬棒），作用點在桿上、離支點 `arm`。
     * 力是斜的（`angle` 從豎直向下算），所以力臂 = arm·cos(angle)。
     *
     * @param o.pivot {x,y}
     * @param o.left  {arm, angle, F}   重物那一邊
     * @param o.right {arm, angle}      手那一邊（F 反算）
     */
    function leverState(o) {
        const P = o.pivot;
        const L = o.left, R = o.right;

        // 作用點都在同一條水平線上（世界 y 相同 = 桿所在的高度）
        const pl = { x: P.x + L.arm, y: P.y };
        const pr = { x: P.x + R.arm, y: P.y };

        const l1 = armOf(P, pl, L.angle);
        const l2 = armOf(P, pr, R.angle);

        // 平衡條件 F1·l1 = F2·l2。手要出多少力，由這一條決定——不另外寫公式，
        // 這樣「F·l 兩邊相等」是**建構出來的**，不是另外算一次剛好對上。
        const F2 = l2 > EPS ? L.F * l1 / l2 : Infinity;

        return {
            l1, l2, F1: L.F, F2,
            d1: spanOf(P, pl),          // 天真的「距離」，用來對照
            d2: spanOf(P, pr),
            torque1: L.F * l1,
            torque2: F2 * l2,
            ratio: l2 > EPS ? l1 / l2 : Infinity,
            // 省力／費力／等臂：比的是**力臂**，不是作用點到支點的距離
            kind: l1 < l2 - 1e-6 ? '省力' : l1 > l2 + 1e-6 ? '費力' : '等臂',
        };
    }

    /**
     * 桿秤（2024 版第 2 節「跨學科實踐：制作简易杆秤」）。
     *
     * 提紐是支點，秤盤掛在一側固定距離 `panArm`，秤砣在另一側滑動。
     * 平衡： (m盤 + m物)·g·panArm = m砣·g·l
     *
     * 空盤時秤砣的位置就是**定盤星**：
     *     zero = m盤·panArm / m砣
     * 掛上 m 之後：
     *     l = zero + m·panArm / m砣
     * 所以「秤砣位置 − 定盤星」和質量成**正比**，刻度是等距的。
     */
    function steelyardState(o) {
        const panArm = o.panArm, mBob = o.mBob, mPan = o.mPan || 0;
        const zero = mPan * panArm / mBob;
        const perKg = panArm / mBob;              // 每 1 kg 秤砣要走多遠
        return {
            zero, perKg,
            posOf: m => zero + m * perKg,
            readingOf: l => (l - zero) / perKg,
            // 秤桿最遠能走到 beamEnd，對應的最大讀數
            maxRead: (o.beamEnd - zero) / perKg,
        };
    }

    // ======================================================================
    // 滑輪
    // ======================================================================

    const PULLEY_R = 38;          // 滑輪半徑（世界單位）

    /**
     * 產生一個滑輪組的幾何。
     *
     * n 段繩子，需要 ⌊n/2⌋ 顆定滑輪 + ⌊n/2⌋ 顆動滑輪，**交錯**排列、
     * 間隔 2r，輪心在 x₀ + (2i+1)·r。
     *
     *   第 i 顆是動滑輪  ⟺  (i 是偶數) === (n 是偶數)
     *
     * 這條規則同時就是「奇動偶定」的來源：
     *   n 偶數 → 第 0 顆是動滑輪 → 繩的固定端在不動的那一側（天花板）
     *   n 奇數 → 第 0 顆是定滑輪 → 繩的固定端在動滑輪框上
     *
     * 承擔動滑輪的繩段落在 x₀ + 2k·r（k = 0…n−1）——這正好是每顆滑輪的
     * 兩個切點 x。相鄰兩顆滑輪共用一個切點，所以繩子是連續的一條折線。
     */
    function rigFor(n, o) {
        o = o || {};
        if (!(n >= 2)) throw new Error('滑輪組至少要有 2 段繩子，收到 ' + n);

        const r = o.r || PULLEY_R;
        const x0 = o.x0 == null ? 130 : o.x0;
        const ceilY = o.ceilY == null ? 96 : o.ceilY;
        const my = o.my == null ? 480 : o.my;          // 動滑輪輪心（初始高度）
        // 天花板下緣到繩子最高點之間的淨空。太小（例如 14）的話繩頂幾乎貼著
        // 天花板，滑輪看起來像嵌進去的；留 30 上下吊架才畫得出來。
        const gap = o.gap == null ? 14 : o.gap;
        const fy = ceilY + r + gap;                    // 定滑輪輪心

        const half = Math.floor(n / 2);
        const isMovable = i => (i % 2 === 0) === (n % 2 === 0);
        const pulleyX = i => x0 + (2 * i + 1) * r;

        const fixed = [], movable = [];
        for (let i = 0; i < 2 * half; i++) {
            const p = { x: pulleyX(i), y: isMovable(i) ? my : fy, i };
            (isMovable(i) ? movable : fixed).push(p);
        }

        // 動滑輪框：上橫樑、下橫樑、兩側立板。重物掛在下橫樑。
        const frameTop = my - r - 14;
        const frameBot = my + r + 14;
        const frameL = x0;                             // 最左邊那條繩的 x
        const frameR = x0 + 2 * (n - 1) * r;           // 最右邊那條承擔繩段的 x

        const movableTie = (n % 2 === 1);
        const tie = movableTie
            ? { x: x0, y: frameTop, side: 'movable' }
            : { x: x0, y: ceilY, side: 'fixed' };

        // 手的位置。**偶數 n 的手在下面**（自由端從最後一顆定滑輪垂下來），
        // **奇數 n 的手在上面**（自由端向上離開最後一顆動滑輪）——這不是
        // 排版選擇，是繩子繞法的直接後果。
        //
        // 兩個起點都隨「拉了多遠 s」等速移動：偶數往下、奇數往上，位移量都是 s。
        // 所以同一個 s 之下，n 愈大 h = s/n 愈小——把 n 切過去，重物當場
        // 跳回一個不一樣的高度，這正是這一頁要教的東西。
        const handDownY = o.handDownY == null ? my + 20 : o.handDownY;   // 偶數 n 的起點
        const handUpY = o.handUpY == null ? frameTop - 40 : o.handUpY;   // 奇數 n 的起點

        return {
            n, r, x0, ceilY, fy, my, half,
            fixed, movable,
            frameTop, frameBot, frameL, frameR,
            tie, movableTie,
            handDownY, handUpY,
            strandX: k => x0 + 2 * k * r,
            isMovable, pulleyX,
            // 外框（畫天花板、算置中用）
            left:  x0 - r,
            right: x0 + 2 * n * r + r,
        };
    }

    /** 手的位置：偶數 n 往下拉、奇數 n 往上拉。位移量都是 s。 */
    function handYAt(rig, n, s) {
        return n % 2 === 0 ? rig.handDownY + s : rig.handUpY - s;
    }

    /**
     * 把繩子繞過整個滑輪組。回傳的是一條**折線 + 圓弧**，不是示意直線。
     *
     * 起點（繩的固定端）：
     *   n 偶數 → 天花板（不動的那一側）
     *   n 奇數 → 動滑輪框的上橫樑
     *
     * 然後依序繞過第 0、1、…、2⌊n/2⌋−1 顆滑輪：動滑輪從**下面**繞過、
     * 定滑輪從**上面**繞過。最後接一段到手上。
     *
     * ⚠️ 相鄰兩顆滑輪間隔 2r，所以「前一顆的右切點」和「這一顆的左切點」
     *    x 完全相同——每一段折線都是**嚴格鉛直**的。繩段是幾何事實在這裡
     *    成立，不是靠畫的時候對齊。
     *
     * @param handY 手的 y。省略時用 `rig.handDownY`／`handYAt()` 的約定值。
     */
    function threadRope(n, rig, handY) {
        // ⚠️ **先驗證這組滑輪繞得出 n 段**，不驗的話會靜靜地畫出一條斜的
        //    「繩子」：`threadRope(4, rigFor(2))` 走完 2⌊n/2⌋ = 4 顆滑輪的位置
        //    （第 2、3 顆根本不存在），最後那段從 `pulleyX(3)` 斜著接到手上，
        //    而 `countStrands` 數到的是 2 —— 畫面像繩子、數字是另一組滑輪的。
        //    這個守衛是精確的，不會誤判：2⌊n/2⌋ + (繩頭綁在動滑輪上 ? 1 : 0)
        //    就是這組滑輪的容量。
        const cap = 2 * rig.half + (rig.movableTie ? 1 : 0);
        if (n !== cap) {
            throw new Error('這組滑輪（' + cap + ' 段）繞不出 ' + n + ' 段——'
                + '滑輪組的段數由 rigFor(n) 決定，兩者必須同一組');
        }

        const r = rig.r;
        const pts = [];
        const segs = [];

        // segs[k] 連接 pts[k] 與 pts[k+1]。所有段都經過這裡建，頂點與段
        // 永遠同進同出，不會有「pts 多一個、segs 少一個」的漏接。
        function add(kind, to, extra) {
            const a = pts[pts.length - 1];
            pts.push(to);
            segs.push(Object.assign({ kind, a, b: to }, extra || {}));
        }

        pts.push({ x: rig.tie.x, y: rig.tie.y });

        const total = 2 * rig.half;
        for (let i = 0; i < total; i++) {
            const cx = rig.pulleyX(i);
            const mov = rig.isMovable(i);
            const cy = mov ? rig.my : rig.fy;
            // 由左切點進、右切點出。動滑輪走下半圓、定滑輪走上半圓。
            add('line', { x: cx - r, y: cy }, { into: i });
            add('arc', { x: cx + r, y: cy },
                { c: { x: cx, y: cy }, r, half: mov ? 'bottom' : 'top', pulley: i });
        }

        const freeX = rig.strandX(n % 2 === 0 ? n : n - 1);
        add('line', { x: freeX, y: handY == null ? handYAt(rig, n, 0) : handY },
            { free: true });

        // 每一段的「下端點」——判「這一段有沒有承擔動滑輪」用。
        // （世界座標 y 向下，所以 y 比較大的那一端是下端。）
        for (const g of segs) {
            if (g.a.y >= g.b.y) { g.lower = g.a; g.upper = g.b; }
            else { g.lower = g.b; g.upper = g.a; }
        }

        const arcs = [];
        segs.forEach((g, k) => { if (g.kind === 'arc') arcs.push(Object.assign({ at: k }, g)); });

        return {
            n, rig, pts, segs, arcs,
            tie: pts[0],
            free: pts[pts.length - 1],
            movableTie: rig.movableTie,
        };
    }

    /**
     * 單一滑輪的幾何：一顆定滑輪，或一顆動滑輪。
     *
     * 回傳的形狀刻意和 `rigFor()` 對齊，所以 `threadSingle()`／
     * `supportingSegs()`／`countStrands()`／`pulleyState()` 整組可以直接吃
     * ——**單一滑輪和滑輪組用的是同一套數段數的程式**，不是另外寫一份。
     * 這一頁的教學重點正是「定滑輪是 n = 1、動滑輪是 n = 2」，那就讓它
     * 真的由同一支程式數出來。
     *
     *   kind = 'fixed'    n = 1：繩子跨過定滑輪，左端掛物、右端手拉
     *   kind = 'movable'  n = 2：繩子一端綁在天花板，往下兜住動滑輪，再往上手拉
     */
    function singleRig(kind, o) {
        o = o || {};
        const r = o.r || PULLEY_R;
        const cx = o.cx == null ? 300 : o.cx;
        const ceilY = o.ceilY == null ? 96 : o.ceilY;

        if (kind === 'fixed') {
            const gap = o.gap == null ? 14 : o.gap;    // 同 rigFor 的淨空
            const cy = ceilY + r + gap;
            const loadY = o.loadY == null ? cy + 320 : o.loadY;
            return {
                kind, r, cx, cy, ceilY,
                fixed: [{ x: cx, y: cy, i: 0 }], movable: [],
                tie: null, movableTie: false,
                // 重物直接掛在繩尾。這一段繩尾同時是畫面的端點與段數的
                // 著力點——一個家，不會分家
                loadEnd: { x: cx - r, y: loadY, of: 'loadEnd' },
                loadX: cx - r,
                frameTop: cy, frameBot: cy,
                frameL: cx - r, frameR: cx + r,
                left: cx - r, right: cx + r,
                half: 0, n: 1,
            };
        }

        if (kind === 'movable') {
            const my = o.my == null ? 620 : o.my;
            return {
                kind, r, cx, my, ceilY,
                fixed: [], movable: [{ x: cx, y: my, i: 0 }],
                // 只有一顆動滑輪，它自己會隨物上升，所以繩頭綁在天花板上
                tie: { x: cx - r, y: ceilY, side: 'fixed' },
                movableTie: false,
                loadEnd: null,                 // 重物掛在輪軸上，不是掛在繩尾
                loadX: cx,
                frameTop: my - r - 14, frameBot: my + r + 14,
                frameL: cx - r, frameR: cx + r,
                // 手往**上**拉，所以起點在動滑輪上方
                handY0: o.handY0 == null ? my - r - 60 : o.handY0,
                left: cx - r, right: cx + r,
                half: 1, n: 2,
            };
        }

        throw new Error('singleRig 只認得 fixed / movable，收到 ' + kind);
    }

    /**
     * 單一滑輪的繩子。回傳形狀和 `threadRope()` 相同，段數同樣是數出來的。
     *
     * @param o.angle 自由端的拉力方向（從豎直向下算起，0 = 向下）。只有
     *                定滑輪用得到——那一頁的重點正是「方向怎麼變、力都不變」
     * @param o.s     手已經拉了多遠。自由端沿拉力方向移動 s，重物上升 h = s/n
     */
    function threadSingle(rig, o) {
        o = o || {};
        const s = o.s || 0;
        const r = rig.r, cx = rig.cx;
        const pts = [], segs = [];
        function add(kind, to, extra) {
            const a = pts[pts.length - 1];
            pts.push(to);
            segs.push(Object.assign({ kind, a, b: to }, extra || {}));
        }

        if (rig.kind === 'fixed') {
            const cy = rig.cy;
            const ang = o.angle || 0;
            const dx = Math.sin(ang), dy = Math.cos(ang);
            // 自由端那一側的切點。拉力的作用線永遠切於滑輪，切點的半徑
            // 垂直於拉力方向，所以 切點 = 輪心 + r·n̂，n̂ 是 d̂ 向右轉 90°。
            // 這也就是「定滑輪是等臂槓桿」的來源：兩條拉力作用線都切於
            // 同一個圓，兩邊的力臂都是 r，與方向無關。
            const nx = Math.cos(ang), ny = -Math.sin(ang);
            const tx = cx + r * nx, ty = cy + r * ny;

            pts.push({ x: rig.loadEnd.x, y: rig.loadEnd.y });
            add('line', { x: cx - r, y: cy }, { into: 0 });
            add('arc', { x: tx, y: ty },
                { c: { x: cx, y: cy }, r, half: 'top', pulley: 0,
                  a0: Math.PI, a1: 2 * Math.PI - ang });
            add('line', { x: tx + dx * s, y: ty + dy * s }, { free: true });
        } else {
            const my = rig.my;
            const handY = rig.handY0 - s;
            pts.push({ x: rig.tie.x, y: rig.tie.y });
            add('line', { x: cx - r, y: my }, { into: 0 });
            add('arc', { x: cx + r, y: my },
                { c: { x: cx, y: my }, r, half: 'bottom', pulley: 0 });
            add('line', { x: cx + r, y: handY }, { free: true });
        }

        for (const g of segs) {
            if (g.a.y >= g.b.y) { g.lower = g.a; g.upper = g.b; }
            else { g.lower = g.b; g.upper = g.a; }
        }
        const arcs = [];
        segs.forEach((g, k) => { if (g.kind === 'arc') arcs.push(Object.assign({ at: k }, g)); });

        return {
            n: rig.n, rig, pts, segs, arcs,
            tie: pts[0],
            free: pts[pts.length - 1],
            movableTie: false,
        };
    }

    /**
     * 把整組滑輪（含框與綁繩點）抬高 `h`。
     *
     * 動滑輪隨重物上升——這是畫面在動的那一半；定滑輪、天花板不動。
     * 為什麼要產生一個新的 rig 而不是改 `threadRope` 的參數：`countStrands()`
     * 是拿 `path` 去比對 `rig` 上的著力點。兩者必須來自**同一個** rig，
     * 否則「用抬過的繩子比沒抬過的滑輪」會讓段數當場數錯——而那正是
     * 驗證器要抓的那一類 bug，所以這裡不給它機會。
     */
    function liftRig(rig, h) {
        if (!h) return rig;
        const d = -h;
        return Object.assign({}, rig, {
            my: rig.my + d,
            frameTop: rig.frameTop + d,
            frameBot: rig.frameBot + d,
            movable: rig.movable.map(p => ({ x: p.x, y: p.y + d, i: p.i })),
            tie: rig.movableTie
                ? { x: rig.tie.x, y: rig.tie.y + d, side: 'movable' }
                : rig.tie,
            // 單一定滑輪的重物掛在繩尾上，繩尾也得跟著上升——它同時是畫面
            // 的端點與段數的著力點，只有一個家
            loadEnd: rig.loadEnd
                ? { x: rig.loadEnd.x, y: rig.loadEnd.y + d, of: 'loadEnd' }
                : undefined,
        });
    }

    /**
     * **重物的著力點**：繩子上「直接承擔重物」的那幾個點。
     *
     * 這是「從幾何上判斷一條繩段有沒有承擔重物」的唯一依據，也是段數的定義。
     * 三種來源：
     *   · 每一顆動滑輪的兩個切點（繩子從那裡兜住滑輪）
     *   · n 為奇數時，綁在動滑輪框上的繩頭
     *   · `rig.loadEnd`——重物**直接掛在繩子的一端**時，那個繩尾本身
     *     （單一定滑輪那頁就是這一種：繩尾掛物、另一端手拉，n = 1）
     *
     * 滑輪組的重物掛在框上、不是掛在繩尾，所以那裡不會有第三種。
     */
    function attachmentPoints(rig) {
        const out = [];
        for (const p of rig.movable) {
            out.push({ x: p.x - rig.r, y: p.y, of: 'tangent', pulley: p.i });
            out.push({ x: p.x + rig.r, y: p.y, of: 'tangent', pulley: p.i });
        }
        if (rig.movableTie) out.push({ x: rig.tie.x, y: rig.tie.y, of: 'tie' });
        if (rig.loadEnd) out.push({ x: rig.loadEnd.x, y: rig.loadEnd.y, of: 'loadEnd' });
        return out;
    }

    /**
     * **從畫出來的那條繩子數回段數**——回傳的是那幾段本身（由左到右編號），
     * 不是只有個數。畫面要標 ①②③、要著色、要灰掉自由端，用的都是這一份。
     *
     * 物理定義是「直接支撐動滑輪的繩段數」。幾何上等價於：
     *
     *     有幾個動滑輪的著力點，是某一條**直線**繩段的下端點？
     *
     * 為什麼這條判準是對的（也是它的證明）：
     *   · 每顆動滑輪有兩個切點，各恰好是一條直線段的下端點 → 2·⌊n/2⌋
     *   · n 為奇數時，綁在框上的繩頭再多一個 → +1
     *   · n 偶數：2·(n/2) = n ✓
     *   · n 奇數：2·⌊n/2⌋ + 1 = n ✓
     * 偶數 n 的自由端落在手上，手上不是著力點，所以不會被多算。
     * 奇數 n 的自由端**向上**離開動滑輪，它的下端點正是切點——它真的在支撐，
     * 該被算進去 ✓
     *
     * ⚠️ 這一支是整個架構的承重牆。`pulleyState()` 用它、畫面用它、
     *    驗證器也用它，但驗證器是**另外從 `path.segs` 再數一次**的
     *    ——不是把同一個數字傳兩次。
     */
    function supportingSegs(path, rig) {
        const attach = attachmentPoints(rig);
        const out = [];
        for (const a of attach) {
            for (let k = 0; k < path.segs.length; k++) {
                const s = path.segs[k];
                if (s.kind !== 'line') continue;
                if (Math.abs(s.lower.x - a.x) < EPS && Math.abs(s.lower.y - a.y) < EPS) {
                    out.push({ at: k, seg: s, attach: a });
                    break;
                }
            }
        }
        // 由左到右編號：繩的固定端在最左邊，所以這就是「從綁繩那頭數過來」
        out.sort((u, v) => u.seg.lower.x - v.seg.lower.x);
        out.forEach((g, k) => { g.no = k + 1; });
        return out;
    }

    /** 段數。就只是 `supportingSegs()` 的長度——同一個實作，不會分家。 */
    function countStrands(path, rig) {
        return supportingSegs(path, rig).length;
    }

    /**
     * 滑輪組的力、距離、功、效率。
     *
     * ⚠️ **段數是從 `path` 數回來的，不是參數。**
     *    傳進來的 `path` 是畫面畫的那一條，所以顯示的力氣必然和畫面上
     *    能數出來的段數一致。
     *
     * 力的來源只有一條式子：**功的帳本**。
     *     有用功 = G·h
     *     額外功 = G動·h（提起動滑輪）+ f·s（摩擦，f 是「每拉 1 公尺繩子
     *              要額外對抗的力」，所以 n 條繩段各滑過 h 就是 n·h = s）
     *     總功   = 有用 + 額外
     *     手的力 = 總功 ÷ 繩端位移        ← F 是**導出來**的
     *
     * F 從 W總/s 導出來（而不是另外寫一條 (G+G動)/n + f），是為了讓
     * `F·s === W總` 精確成立——「省力不省功」是這一頁的標題宣稱，
     * 它必須是恆等式而不是巧合。
     *
     * 理想（f = 0）時 η = G·h / ((G+G動)·h) = **G/(G+G動)**：
     * 和 n 無關、和 h 也無關。摩擦是 n 唯一進得來的門。
     */
    function pulleyState(path, rig, G, Gm, f, s) {
        return ledger(countStrands(path, rig), G, Gm, f, s);
    }

    /**
     * **功的帳本**。滑輪組、單一定滑輪、單一動滑輪全部走這裡
     * ——差別只在 `n`（繩子分擔的段數）與 `G動`，不在公式。
     *
     * 把這一支抽出來的理由很實際：三頁的「省力不省功」講的是同一件事，
     * 分成三份實作就會有三份各自漂移的浮點誤差，而驗證器要斷言的是
     * **恆等式**（殘差 < 1e-12）。
     *
     * @param n  直接承擔重物的繩段數（單一定滑輪 = 1、單一動滑輪 = 2）
     * @param G  物重
     * @param Gm 跟著重物一起上升的機件重（動滑輪＋框）。定滑輪的重不算，
     *           它掛在天花板上，沒有被提起來
     * @param f  「每拉 1 公尺繩子，額外要對抗的摩擦阻力」
     */
    function ledger(n, G, Gm, f, s) {
        const h = s / n;

        const Wu = G * h;                       // 有用功
        const We = Gm * h + f * s;              // 額外功
        const Wt = Wu + We;                     // 總功
        // s = 0 時 W總/s 是 0/0。取極限值（同一個帳本除以 n·h 再令 h→0）。
        const F = s > EPS ? Wt / s : (G + Gm) / n + f;

        return {
            n, F, h, s,
            Wu, We, Wt,
            eta: Wt > EPS ? Wu / Wt : ((G + Gm) > EPS ? G / (G + Gm) : 1),
            // 以下三個是「畫面要標」的東西，不是獨立物理
            ratio: G > EPS ? F / G : Infinity,   // 施力是物重的幾倍
            sOverH: h > EPS ? s / h : n,
            // 無摩擦時的施力。**只當畫面上的參考值**——顯示的 F 永遠是
            // W總/s 導出來的，不要把這一個當成 F
            Fideal: (G + Gm) / n,
        };
    }

    /** 單一定滑輪：n = 1。不省力、不費距離，只改變力的方向。 */
    function fixedPulleyState(o) {
        // 定滑輪自己不會被提起來，所以 G動 = 0
        return ledger(1, o.G, 0, o.f || 0, o.s);
    }

    /** 單一動滑輪：n = 2。動滑輪自己會跟著上升，所以 G動 要算進去。 */
    function movablePulleyState(o) {
        return ledger(2, o.G, o.Gm || 0, o.f || 0, o.s);
    }

    // ======================================================================
    // 出口
    // ======================================================================
    return {
        DEG, clamp, EPS,
        // 槓桿
        armOf, spanOf, armFoot, leverState, steelyardState,
        // 滑輪
        PULLEY_R, rigFor, liftRig, threadRope, handYAt,
        singleRig, threadSingle,
        attachmentPoints, supportingSegs, countStrands, pulleyState,
        ledger, fixedPulleyState, movablePulleyState,
    };
})();
