/**
 * 🪢 脈波的多重反射與透射 — 一個脈波在兩端之間來回，每撞一次就在時間軸上留一個點
 *
 * 這頁要學生看到三件事：
 *   1. 一個脈波在兩端之間**來回跑**。撞到固定端會上下反轉、撞到自由端不會，
 *      所以同一條繩子上會同時出現「正的」和「負的」脈波。
 *   2. 中間接一段不同線密度的繩子：撞上界面時**一部分反射、一部分透射**。
 *      反射的那一份回到原來那一側，透射的那一份換了速度繼續走。
 *   3. 每一次撞擊都是**時間軸上的一個事件點**。時間軸把「什麼時候、在哪裡、
 *      套用了哪一條規則」記下來——這是這一頁和 06 繩波反射最大的差別：
 *      06 只看一次反射，這一頁看的是**一連串**事件怎麼疊起來。
 *
 * ⚠️ 這頁的波不是由 scatter() 疊出來的，而是一棵**事件樹**：每個脈波走到
 *    邊界或界面就生出子波（振幅 × r，或者振幅 × τ 且換速度）。之所以要自己
 *    長這棵樹，是因為 scatter() 只處理「單一界面、單次」；而「脈波在兩端之間
 *    來回」正是這一頁要教的時序。
 *
 *    ⚠️ 子波在透射時**寬度要乘上 v₂/v₁**（空間上被壓縮或拉長）。忘了乘的症狀
 *       是「波形看起來完全正常、每一次反射的位置也對」——只有界面兩側的**斜率**
 *       對不起來。verify-waves.js ㉗ 用有限差分直接量界面兩側的斜率在盯這件事。
 *
 *    ⚠️ 子波**不設「出生時間之前是 0」的守衛**。高斯的尾巴會先到，那正是
 *       「界面兩側的位移隨時都連續」的原因（振幅的引數做了 v₁/v₂ 的縮放之後，
 *       兩側的高斯在界面上逐點相等）。加了守衛反而會在事件時刻憑空造出一個跳斷。
 *       scatter() 的註解講的是同一件事。
 *
 *    ⚠️ **事件樹一棵都不剪**，而時間軸標點另有一個比較高的門檻。兩個數字分開
 *       設定是必要的（剪樹會在界面上留下一個可見的階梯）、而且很容易被「順手
 *       合併」掉——MR_MARK 上面那一大段記著實測數字。
 *
 * 場景、面板骨架與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const MR_LANE_ROPE = 290;      // 上面那條：實際的繩子（合成波）
const MR_LANE_DECO = 600;      // 下面那條：分解（入射／反射／透射）

// 垂直放大：世界單位 / 公分。最大值出現在「自由端 + 兩份疊在一起」：
// 2 cm 的脈衝在自由端會到 4 cm，4 × 12 = 48 個世界單位，離下面那條 lane
// 還有 600 − 290 = 310 的空間。
const MR_AMP_C = 12;

const MR_SUM_Y = 210;          // 「合成波」色標的高度
const MR_FAMILY_Y = 522;       // 分解三個分量的色標高度
const MR_AXIS_T = 736;         // 時間軸的上緣
const MR_AXIS_B = 770;         // 時間軸的下緣
const MR_MARK_H = 18;          // 事件三角的高度
const MR_MARK_W = 7;           // 事件三角的半寬
const MR_RULE_Y = 692;         // 事件規則徽章的中心
const MR_LEGEND_Y = 786;       // 圖例

const MR_END_LABEL_Y = 662;    // 端點標籤（drawEndpoint 會畫在 lane + 62）

// ==========================================================================
// 這一頁的物理
// ==========================================================================
const MR_L = 8.0;              // 繩長（公尺）＝ WaveScene.ROPE_M
const MR_TENSION = 4.0;        // 張力（兩段相同——接在一起的繩子拉力當然一樣）
const MR_XJ = 4.0;             // 界面的位置（公尺）——就在繩子正中間
const MR_X0 = 1.2;             // 脈波的起點（公尺）
const MR_W0 = 0.30;            // 脈波的寬度（公尺）
const MR_A0 = 2.0;             // 脈波的振幅（公分）
const MR_T_MAX = 20;           // 時間軸的長度（秒）

/**
 * 時間軸上「值得標一個點」的門檻（公分）。**只影響時間軸與卡片，不影響物理。**
 *
 * ⚠️ 這裡有兩個很容易搞混的數字，而且**不能合併成一個**：
 *    ‧ 物理**完全不能剪**。界面每撞一次就分裂成兩個，20 秒內事件樹有 500 多個
 *      脈波；隨手把振幅小的分支剪掉（剪在 0.5 公分）會讓**界面那一點上的
 *      位移當場不連續**——實測最大跳 0.667 公分＝畫面上 8 個世界單位的階梯，
 *      就長在合成波曲線上。原因是：子波在界面上「兩側逐點相等」是**成對**的，
 *      剪掉其中一個（r 那份只有 0.667）另一側（τ 那份）就沒有人跟它對消。
 *      整棵樹留著（剪 0 公分）時，界面的最大不連續是 9.4e-15 ✓。
 *    ‧ 時間軸**必須剪**。374 個事件擠在 20 秒裡是一條梳子，看不出時序。
 *      只標振幅 ≥ 0.30 公分的撞擊：兩段一樣 10 個點（每一次撞擊都標到），
 *      右段較重 56 個點——但**只有 19 個相異時刻**（相鄰兩時刻差 1.00 秒
 *      ＝ 44 個世界單位，事件三角的半寬只有 7），所以時間軸上看到的仍然
 *      是一排分得開的點。
 *    ⚠️ 挑 0.30 是**量出來的**，不是口味：振幅是一組離散的值
 *      （2·(2/3)ᵃ·(1/3)ᵇ），0.30 正好落在 0.395 與 0.222 之間的那個空隙裡。
 *      所以「低於門檻」的最大一個是 0.222 公分＝2.7 個世界單位＝畫面上約
 *      2 個像素，**跟繩子本身一樣細**——沒被標到的都是真的看不見的。
 *      門檻訂在 0.75 的話未標記的最大一個是 0.667 公分（8 個世界單位），
 *      那是一顆**看得清清楚楚**的脈波撞在牆上卻沒有點，畫面會自相矛盾。
 *    ⚠️ 標的是「撞上去的那一個脈波有多大」（事件記的是入射波的振幅），
 *      不是「反射出來的那一個有多大」。所以門檻比第一次界面反射
 *      （|r|·A₀ = 0.667）高或低都跟反射波無關，曲線上照樣看得到它。
 */
const MR_MARK = 0.30;          // 振幅 ≥ 這個值（公分）的撞擊才標在時間軸上
const MR_MAX_PACKETS = 4000;   // 純保險（8 種組合都碰不到它，㉗ 有一條在盯）

// 每個「最窄脈波寬度」取幾個樣本點。最窄的是透射波的 w·(v₂/v₁)（右段較重時
// 是 0.15 m）。16 個點在畫面上是每 1.0 個世界單位一點——比像素還密。
const MR_SAMPLES_PER_W = 16;

const MR_SPEED_MIN = 0.25;
const MR_SPEED_MAX = 2;
const MR_SPEED_DEF = 1;

/**
 * 中間那一段的線密度。`same` 就是「一條均勻的繩子，沒有界面」。
 *
 * ⚠️ **只做「右段較重」這一種不對稱，不做「右段較輕」。** 不是偷懶，是量出來的：
 *    脈波從左邊出發，若右段較輕（波在右段變快），它會在右段與右端之間以
 *    兩倍的速度來回，20 秒內排出 **55 個事件**（右段較重是 19 個），時間軸當場
 *    擠成一團。|r| 兩者相同、只是正負號相反——而「反射不反轉」那一課，
 *    兩端自由的那個設定（r = +1）已經完整演出來了。
 */
const MR_MEDIA = {
    same:  { mu1: 0.25, mu2: 0.25, label: '兩段一樣（沒有界面）' },
    dense: { mu1: 0.25, mu2: 1.00, label: '右段較重 μ₂ = 4μ₁（波變慢）' },
};

const MR_ENDS = {
    'fixed-fixed': '兩端都固定',
    'free-free':   '兩端都自由',
    'fixed-free':  '左固定、右自由',
    'free-fixed':  '左自由、右固定',
};

const MR_SHOW_ON = 'on';
const MR_SHOW_OFF = 'off';

/**
 * 面板上「顯示哪些波」的四個開關。
 *
 * ⚠️ 這四個開關是**頁面自己插進控制面板**的，不是 WaveScene 的 controls
 *    長出來的（面板骨架只認滑桿與下拉，而這一頁要的是四個各自獨立的開關）。
 *    插進去的 div 只有兩種下場：插在「核心關係」公式盒之前，或者插在最後。
 *    id 一律是 `<key>Select`，和面板自己的下拉同一個命名，headless 的
 *    `?s_showReflected=off` 因此直接打得中。
 */
const MR_TOGGLES = [
    { key: 'showIncident',    label: '入射' },
    { key: 'showReflected',   label: '反射' },
    { key: 'showTransmitted', label: '透射' },
    { key: 'showSum',         label: '合成' },
];

const MR_SHOW = {
    showIncident: true, showReflected: true, showTransmitted: true, showSum: true,
};

const MR_COL_SUM   = [15, 23, 42];
const MR_COL_INC   = [37, 99, 235];
const MR_COL_REF   = [234, 88, 12];
const MR_COL_TRA   = [22, 163, 74];
const MR_COL_FIXED = [30, 41, 59];
const MR_COL_FREE  = [37, 99, 235];
const MR_COL_JOIN  = [22, 163, 74];

/**
 * 兩段繩子的介質與兩端、界面的係數。**這一頁唯一的參數入口。**
 * 卡片、畫面、標題列、驗證器全部查這一份，不各自算一次。
 */
function mrModel(panel) {
    const key = MR_MEDIA[panel.medium] ? panel.medium : 'dense';
    const endsKey = MR_ENDS[panel.ends] ? panel.ends : 'fixed-fixed';
    const md = MR_MEDIA[key];
    const m1 = WaveScene.medium(MR_TENSION, md.mu1);
    const m2 = WaveScene.medium(MR_TENSION, md.mu2);
    const co = WaveScene.coefficients(m1, m2);
    const parts = endsKey.split('-');
    return {
        key, endsKey, m1, m2, mu1: md.mu1, mu2: md.mu2,
        hasJ: key !== 'same',
        r: co.r, tau: co.tau,
        rWallL: parts[0] === 'free' ? 1 : -1,
        rWallR: parts[1] === 'free' ? 1 : -1,
    };
}

/**
 * 事件樹：把脈波走過的每一步排出來。
 *
 * 每個脈波（packet）是 `{ x0, t0, dir, A, side, w, kind }`：
 *   xc(t) = x0 + dir · v_side · (t − t0)      峰的位置
 *   u     = dir · (x − xc(t))                 離峰多遠
 *   位移  = A · exp(−(u/w)²)                  只在自己那一側畫出來
 *
 * 走到邊界或界面就生一個（界面生兩個）子波，並在 events 裡記一筆。
 * 事件時刻取**峰到達**的那一刻（和 06 的 tArrive 同一個約定）。
 */
function mrSchedule(panel) {
    const M = mrModel(panel);
    const packets = [];
    const events = [];
    let truncated = false;

    const root = {
        x0: MR_X0, t0: 0, dir: 1, A: MR_A0, side: 1, w: MR_W0,
        kind: 'incident', gen: 0, done: false,
    };
    packets.push(root);
    const queue = [root];

    // ⚠️ **一棵都不剪。**（為什麼不能剪，見 MR_MARK 上面那一大段。）
    //    子波在界面上是**成對**的（一份反射、一份透射），少一個就是曲線上
    //    的一個階梯。樹的大小由 20 秒的時間窗自然封住（500 多個）。
    // ⚠️ 振幅**不是單調變小**：每一次來回界面淨乘 8/9（(2/3)·(4/3)），但
    //    從重的那一段傳回輕的那一段時，透射係數是 4/3 > 1——畫面上真的會
    //    出現一顆比它「上一代」還高的脈波（實測最大 1.78 公分）。
    const spawn = (from, o) => {
        const c = Object.assign({ gen: from.gen + 1, done: false }, o);
        packets.push(c);
        queue.push(c);
        return c;
    };

    while (queue.length) {
        const pk = queue.shift();
        // 已經穿過界面的脈波不再排事件：它的能量已經交給子波了，
        // 留在畫面上的只是「尾巴還在過界」的那一半（見檔頭的說明）。
        if (pk.done) continue;
        const v = pk.side === 1 ? M.m1.v : M.m2.v;
        const atJ = M.hasJ &&
            ((pk.side === 1 && pk.dir > 0) || (pk.side === 2 && pk.dir < 0));
        const xhit = atJ ? MR_XJ : (pk.dir > 0 ? MR_L : 0);
        const th = pk.t0 + (xhit - pk.x0) / (pk.dir * v);
        if (!(th > pk.t0 + 1e-12) || th > MR_T_MAX) continue;
        if (packets.length + 2 > MR_MAX_PACKETS) { truncated = true; break; }
        pk.done = true;

        // 時間軸只標「撞上去的那一個有多大」的撞擊（見 MR_MARK）。
        const mark = Math.abs(pk.A) >= MR_MARK;
        if (atJ) {
            const from1 = pk.side === 1;
            const r = from1 ? M.r : -M.r;        // r₂₁ = −r₁₂
            if (mark) events.push({ t: th, x: MR_XJ, kind: 'junction', from: pk.side,
                          r, tau: 1 + r, A: pk.A, parent: pk });
            spawn(pk, { x0: MR_XJ, t0: th, dir: -pk.dir, A: pk.A * r,
                        side: pk.side, w: pk.w, kind: 'reflected' });
            // 透射波的寬度乘上 v₂/v₁：空間上被壓縮（或拉長）這麼多倍，
            // 界面兩側的位移**與斜率**才會同時連續。
            spawn(pk, { x0: MR_XJ, t0: th, dir: pk.dir, A: pk.A * (1 + r),
                        side: from1 ? 2 : 1,
                        w: pk.w * (from1 ? M.m2.v / M.m1.v : M.m1.v / M.m2.v),
                        kind: 'transmitted' });
        } else {
            const r = xhit <= 0 ? M.rWallL : M.rWallR;
            if (mark) events.push({ t: th, x: xhit, kind: 'wall',
                          end: xhit <= 0 ? 'left' : 'right', r, tau: null,
                          A: pk.A, parent: pk });
            spawn(pk, { x0: xhit, t0: th, dir: -pk.dir, A: pk.A * r,
                        side: pk.side, w: pk.w, kind: 'reflected' });
        }
    }

    events.sort((a, b) => a.t - b.t || a.x - b.x);
    return { M, packets, events, truncated };
}

/**
 * 一個脈波在 (x, t) 的位移。只在自己那一側有值。
 *
 * ⚠️ 有界面時，界面上那一點要用**半開區間**（左段 [0, XJ)、右段 [XJ, L]）。
 *    子波的寬度乘過 v₂/v₁ 之後，兩側的高斯在界面上逐點相等，所以各算一次是
 *    對的、算兩次就是兩倍。全閉區間會讓 x = XJ 被兩邊各算一次，而**畫面上
 *    只是那一根取樣點特別高**——樣本不一定剛好落在 4.00 m，所以這種 bug 還會
 *    隨取樣密度時有時無。
 *    邊界（x = 0 與 x = L）不能跟著半開：固定端的抵銷要靠同一側的入射波與
 *    反射波**在牆上相加**，牆那一點本來就該算進去。
 */
function mrPacketY(pk, M, x, t) {
    const EPS = 1e-9;
    if (M.hasJ) {
        if (pk.side === 1) { if (x < -EPS || x >= MR_XJ - EPS) return 0; }
        else               { if (x < MR_XJ - EPS || x > MR_L + EPS) return 0; }
    } else if (x < -EPS || x > MR_L + EPS) return 0;
    const v = pk.side === 1 ? M.m1.v : M.m2.v;
    const xc = pk.x0 + pk.dir * v * (t - pk.t0);
    const u = pk.dir * (x - xc);
    if (u > pk.w * 5 || u < -pk.w * 5) return 0;    // 五個寬度以外就是 0
    return pk.A * Math.exp(-(u / pk.w) * (u / pk.w));
}

/**
 * 某一家的位移函式。kind 省略＝全部（＝合成波）。
 *
 * 「入射／反射／透射」分的是**這個脈波是怎麼生出來的**：原來的脈波是入射，
 * 撞到邊界或界面折回來的是反射，穿過界面的是透射。所以反射波不一定只在
 * 左段——右段那一段上面也可能有反射波（它是透射過去之後又撞到右端折回來的）。
 */
function mrFamily(sched, kind) {
    const list = kind ? sched.packets.filter(p => p.kind === kind) : sched.packets;
    const M = sched.M;
    return (x, t) => {
        let s = 0;
        for (const pk of list) s += mrPacketY(pk, M, x, t);
        return s;
    };
}

/**
 * 四條曲線**一次算完**：同一個取樣格點上把每個脈波加進它所屬的那一家，
 * 順便加進合成波。
 *
 * ⚠️ 分四次呼叫 TS.sample() 是同一個脈波走訪四遍——而這一頁的事件樹在 20 秒裡
 *    有 500 多個脈波（見 MR_MARK 的說明），四遍就是 4 倍的差距（實測 6.3 ms/幀）。
 *    一次算完是 0.8 ms，而且四條曲線**共用同一組 x 格點**——「合成波 ＝ 入射 ＋
 *    反射 ＋ 透射」因此在畫面上是逐點對得起來的，那正是分解 lane 要教的等式。
 *
 * 取樣寬度跟著**最窄**的脈波走：透射波的寬度是 w·(v₂/v₁)，右段較重的時候
 * 只有 0.15 m；拿原本的 0.30 m 去取樣，透射波會被畫成一個三角形。
 */
function mrSampleAll(sched, t) {
    const M = sched.M;
    const wMin = MR_W0 * Math.min(1, M.m2.v / M.m1.v);
    const per = wMin / MR_SAMPLES_PER_W;
    const n = Math.max(24, Math.min(1600, Math.ceil(MR_L / per)));
    const out = { sum: [], incident: [], reflected: [], transmitted: [] };
    for (let i = 0; i <= n; i++) {
        const x = MR_L * i / n;
        let ys = 0, yi = 0, yr = 0, yt = 0;
        for (const pk of sched.packets) {
            const y = mrPacketY(pk, M, x, t);
            if (y === 0) continue;
            ys += y;
            if (pk.kind === 'incident') yi += y;
            else if (pk.kind === 'reflected') yr += y;
            else yt += y;
        }
        out.sum.push({ x, y: ys });
        out.incident.push({ x, y: yi });
        out.reflected.push({ x, y: yr });
        out.transmitted.push({ x, y: yt });
    }
    return out;
}

/** 某一家現在畫不畫（面板上的四個開關）。 */
function mrShow(kind) {
    const key = kind === 'sum' ? 'showSum' : 'show' + kind.charAt(0).toUpperCase() + kind.slice(1);
    return MR_SHOW[key] !== false;
}

/** 事件套用的規則——時間軸上的徽章與標題列共用同一句話。 */
function mrRuleText(ev) {
    if (ev.kind === 'junction') {
        return `撞上界面：一部分反射、一部分透射（r = ${mrSigned(ev.r, 2)}）`;
    }
    return ev.r > 0
        ? '撞到自由端：反射波不反轉（r = +1）'
        : '撞到固定端：反射波上下反轉（r = −1）';
}

function mrSigned(v, dec) {
    const s = v.toFixed(dec);
    if (v > 0) return '+' + s;
    return s.replace('-', '−');
}

function mrEventColor(ev) {
    if (ev.kind === 'junction') return MR_COL_JOIN;
    return ev.r > 0 ? MR_COL_FREE : MR_COL_FIXED;
}

function mrEventWhere(ev) {
    if (ev.kind === 'junction') return '界面';
    return ev.x <= 0.01 ? '左端' : '右端';
}

/** 第一個在 t 之後發生的事件（t 本身算過去了）。 */
function mrNextEvent(events, t) {
    for (const e of events) if (e.t > t + 1e-9) return e;
    return null;
}

/** 已經發生的事件（含正好在 t 的那一個）。 */
function mrPastEvents(events, t) {
    return events.filter(e => e.t <= t + 1e-9);
}

// ==========================================================================
// 顯示時間：自己的時鐘
// --------------------------------------------------------------------------
// 這一頁比別的頁面多一個「時間軸滑桿」——學生把滑桿拖到哪裡，畫面就跳到
// 哪裡（拖回來就是回放）。所以畫面上顯示的時間**不是** simTime，而是這個
// 時鐘算出來的 disp。verifier 直接戳 mrAdvance()，不必開瀏覽器。
//
// ⚠️ 時鐘是**有狀態**的，而 values() 與 draw() 每一幀都會各問一次
//    「現在幾秒」。所以這一支必須對同一個 t 冪等：同樣的輸入問兩次，
//    回同一個答案、而且只推進一次。
// ==========================================================================
const MR_CLK = { t: -1, disp: 0, seen: null, sig: '' };

function mrAdvance(clk, t, panel) {
    const sig = `${panel.ends}|${panel.medium}|${panel.speed}`;
    const seen = panel.scrub;
    const dragged = seen !== clk.seen;

    if (t !== clk.t || dragged || sig !== clk.sig) {
        const dt = (clk.t < 0) ? 0 : Math.max(0, Math.min(t - clk.t, 0.1));
        const jumped = sig !== clk.sig;      // 換了端點／介質／速度＝重新開始
        clk.t = t;
        clk.seen = seen;
        if (jumped) { clk.sig = sig; clk.disp = 0; }
        if (dragged) {
            // 學生拖了時間滑桿：跳到那裡。拖回來就是回放。
            clk.disp = seen;
        } else if (!jumped) {
            clk.disp += dt * panel.speed;
            if (clk.disp > MR_T_MAX) clk.disp -= MR_T_MAX;   // 跑完就從頭
        }
    }
    if (clk.disp < 0) clk.disp = 0;
    if (clk.disp > MR_T_MAX) clk.disp = MR_T_MAX;
    return clk.disp;
}

function mrDisplayTime(t, panel) { return mrAdvance(MR_CLK, t, panel); }

/** 單步前進的格數（秒）＝時間滑桿的 step，兩者同一個格子才對得起來。 */
const MR_STEP = 0.1;

/** 下一個格子的時間（不會超過時間軸的右端）。 */
function mrStepTime(tt) {
    const n = Math.floor(tt / MR_STEP + 1e-6) + 1;
    return Math.min(MR_T_MAX, Number((n * MR_STEP).toFixed(2)));
}

/** 「單步前進 ▸」按鈕：把時鐘與時間滑桿一起推進一格。 */
function mrStepForward() {
    const next = mrStepTime(MR_CLK.disp);
    MR_CLK.disp = next;
    MR_CLK.seen = next;          // 這是「已經同步過了」，下一幀不會被當成拖動
    const el = document.getElementById('scrubSlider');
    if (el) el.value = next.toFixed(2);
    mrSyncScrub(next);
    return next;
}

// ==========================================================================
// 畫面
// ==========================================================================

function mrVLine(p, view, xm, y0, y1, col) {
    const ctx = p.drawingContext;
    // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
    p.push();
    ctx.setLineDash([view.len(9, 4), view.len(7, 3)]);
    p.stroke(col[0], col[1], col[2]);
    p.strokeWeight(view.len(3, 1.5));
    p.line(WaveScene.ropeX(view, xm), view.toScreenY(y0),
           WaveScene.ropeX(view, xm), view.toScreenY(y1));
    p.pop();
}

/** 時間軸：一條代表 0～MR_T_MAX 的橫條，事件點坐在上面。 */
function mrDrawTimeline(p, view, tt, sched) {
    const TS = WaveScene;
    const x0 = TS.ropeX(view, 0), x1 = TS.ropeX(view, MR_L);
    const yT = view.toScreenY(MR_AXIS_T), yB = view.toScreenY(MR_AXIS_B);
    const h = yB - yT;
    const span = x1 - x0;

    p.noStroke();
    p.fill(241, 245, 249);
    p.rect(x0, yT, span, h);
    p.fill(219, 234, 254);
    p.rect(x0, yT, span * Math.min(1, tt / MR_T_MAX), h);
    p.noFill();
    p.stroke(203, 213, 225);
    p.strokeWeight(view.len(1.5, 1));
    p.rect(x0, yT, span, h);

    // 兩端的刻度：0 s 與 20 s，畫在橫條裡面（下面的空間要留給圖例）
    const sSize = view.len(14, 8);
    p.noStroke();
    p.fill(148, 163, 184);
    p.textSize(sSize);
    p.textStyle(p.BOLD);
    p.textAlign(p.LEFT, p.CENTER);
    p.text('0 s', x0 + view.len(10, 5), yT + h / 2);
    p.textAlign(p.RIGHT, p.CENTER);
    p.text(`${MR_T_MAX} s`, x1 - view.len(10, 5), yT + h / 2);

    // 事件點：已經發生的填實、還沒發生的只有框
    const mh = view.len(MR_MARK_H, 8), mw = view.len(MR_MARK_W, 3.5);
    for (const ev of sched.events) {
        const ex = x0 + span * (ev.t / MR_T_MAX);
        const col = mrEventColor(ev);
        if (ev.t <= tt + 1e-9) {
            p.noStroke();
            p.fill(col[0], col[1], col[2]);
        } else {
            p.noFill();
            p.stroke(col[0], col[1], col[2]);
            p.strokeWeight(view.len(2, 1));
        }
        p.triangle(ex, yT, ex - mw, yT - mh, ex + mw, yT - mh);
    }

    // 游標：一條紅線 + 線右邊的時間
    const cx = x0 + span * Math.min(1, tt / MR_T_MAX);
    p.stroke(239, 68, 68);
    p.strokeWeight(view.len(3, 1.5));
    p.line(cx, yT - view.len(6, 3), cx, yB + view.len(6, 3));
    p.noStroke();
    p.fill(185, 28, 28);
    p.textSize(view.len(14, 8));
    p.textStyle(p.BOLD);
    if (cx > x1 - view.len(90, 45)) {
        p.textAlign(p.RIGHT, p.CENTER);
        p.text(`t = ${tt.toFixed(2)} s`, cx - view.len(7, 4), yT + h / 2);
    } else {
        p.textAlign(p.LEFT, p.CENTER);
        p.text(`t = ${tt.toFixed(2)} s`, cx + view.len(7, 4), yT + h / 2);
    }

    // 最近一次事件的規則：徽章跟著那一顆事件點跑（夾在時間軸裡面）
    const past = mrPastEvents(sched.events, tt);
    const last = past[past.length - 1];
    if (last) {
        const txt = mrRuleText(last);
        const size = view.len(15, 9);
        p.textSize(size);
        p.textStyle(p.BOLD);
        const tw = p.textWidth(txt);
        const half = tw / 2 + view.len(14, 7);
        const col = mrEventColor(last);
        let bx = x0 + span * (last.t / MR_T_MAX);
        bx = Math.max(x0 + half, Math.min(x1 - half, bx));
        TS.valueBadge(p, view, bx, view.toScreenY(MR_RULE_Y), txt,
            { size: 15, stroke: col, fillColor: col });
    }

    // 圖例：三種事件點的顏色 + 一句「什麼樣的撞擊才會被標出來」。
    // ⚠️ 最後那一項**沒有三角形**（col: null）——它不是第四種事件，是這一排
    //    標記規則的說明。少了它，學生會看到一顆明明看得到的脈波撞在牆上、
    //    時間軸卻沒有點，而畫面上不會有任何錯誤訊息。
    // ⚠️ 這一串字的長度是量過的：1100px（scale ≈ 0.45）時整排仍然塞得進
    //    時間軸的寬度裡。再加字之前先量一次，不然它會從右邊被裁掉。
    const items = [
        { col: MR_COL_FIXED, text: '固定端' },
        { col: MR_COL_FREE,  text: '自由端' },
        { col: MR_COL_JOIN,  text: '界面' },
        { col: null,         text: `只標振幅 ≥ ${MR_MARK.toFixed(2)} 公分`, muted: true },
    ];
    const size = view.len(13, 8);
    p.textSize(size);
    p.textStyle(p.BOLD);
    const gap = view.len(8, 4), triW = view.len(15, 7);
    const widths = items.map(it => (it.col ? triW + gap : 0) + p.textWidth(it.text));
    let total = widths.reduce((a, b) => a + b, 0) + view.len(30, 15) * (items.length - 1);
    let lx = (x0 + x1) / 2 - total / 2;
    const ly = view.toScreenY(MR_LEGEND_Y);
    for (let i = 0; i < items.length; i++) {
        const col = items[i].col;
        if (col) {
            p.noStroke();
            p.fill(col[0], col[1], col[2]);
            p.triangle(lx + triW / 2, ly - size * 0.5,
                       lx, ly + size * 0.45, lx + triW, ly + size * 0.45);
        }
        // 圖例的字跟三角形同色（和三個分解分量的色標同一個規矩）；
        // 那一句說明用灰色，才不會看起來像第四種事件。
        p.noStroke();
        if (col) p.fill(col[0], col[1], col[2]);
        else p.fill(148, 163, 184);
        p.textAlign(p.LEFT, p.CENTER);
        p.text(items[i].text, lx + (col ? triW + gap : 0), ly);
        lx += widths[i] + view.len(30, 15);
    }
}

/**
 * 面板上「顯示哪些波」的四個開關。**要在 WaveScene.run() 之後才呼叫**——
 * 面板的 innerHTML 是 run() 裡才寫上去的，先插進去的話會被整片蓋掉。
 */
function mrBuildToggles() {
    const host = document.getElementById('controlPanel');
    if (!host) return;
    const box = document.createElement('div');
    box.className = 'control-box';
    box.style.marginTop = '18px';
    const title = document.createElement('label');
    title.innerHTML = '<span>顯示哪些波</span>';
    box.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
    for (const t of MR_TOGGLES) {
        const sel = document.createElement('select');
        sel.id = t.key + 'Select';
        sel.style.cssText = 'width:100%;padding:6px;font-size:0.85rem;font-weight:700;'
                          + 'border:1px solid #000;background:#fff;cursor:pointer;';
        sel.innerHTML = `<option value="${MR_SHOW_ON}">${t.label} ✓</option>`
                      + `<option value="${MR_SHOW_OFF}">${t.label} ✗</option>`;
        sel.value = MR_SHOW[t.key] ? MR_SHOW_ON : MR_SHOW_OFF;
        sel.addEventListener('change', () => {
            MR_SHOW[t.key] = sel.value === MR_SHOW_ON;
        });
        grid.appendChild(sel);
    }
    box.appendChild(grid);

    // 單步前進。暫停之後一次推一格（0.1 秒）——看得清楚「這一步裡發生了
    // 什麼」，而連續播放時它只是把時間往前撥一點。
    // ⚠️ 它動的是**這一頁自己的時鐘**（MR_CLK）與時間滑桿，不是 simTime：
    //    時鐘的「被拖動」是靠滑桿值變了來判斷的（見 mrAdvance），所以這裡
    //    要把 seen 一起寫進去，否則下一幀會把它當成學生拖了滑桿而跳回去。
    const stepBtn = document.createElement('button');
    stepBtn.id = 'stepBtn';
    stepBtn.textContent = `單步前進 ▸ ${MR_STEP.toFixed(1)} 秒`;
    // ⚠️ `color:#000` 不可以省。`.control-box button` 的全域規則是
    //    `color:#ffffff`，這一顆自己把底色改成白的，不寫前景色的話就是
    //    **白字白底**——按鈕在畫面上完全空白，而 errs=0、卡片正常、
    //    任何斷言都不會紅（只有截圖看得出來）。
    stepBtn.style.cssText = 'width:100%;margin-top:8px;padding:8px;font-size:0.85rem;'
                          + 'font-weight:700;color:#000;border:1px solid #000;'
                          + 'background:#fff;cursor:pointer;';
    stepBtn.addEventListener('mouseenter', () => {
        stepBtn.style.background = '#000'; stepBtn.style.color = '#fff';
    });
    stepBtn.addEventListener('mouseleave', () => {
        stepBtn.style.background = '#fff'; stepBtn.style.color = '#000';
    });
    stepBtn.addEventListener('click', () => mrStepForward());
    box.appendChild(stepBtn);

    // 插在「核心關係」公式盒之前：那一盒是這一組頁面的收尾。
    // ⚠️ 找不到公式盒（lastElementChild 是滑桿或按鈕）時退回 appendChild，
    //    不能讓它整塊消失——那會變成「開關不見了，其他一切正常」。
    const last = host.lastElementChild;
    if (last && last !== box) host.insertBefore(box, last);
    else host.appendChild(box);
}

/** 把時間滑桿的把手與數字同步到畫面上真正的時間。 */
function mrSyncScrub(tt) {
    const el = document.getElementById('scrubSlider');
    if (el && Math.abs(Number(el.value) - tt) > 0.02) el.value = tt.toFixed(2);
    const lab = document.getElementById('scrubVal');
    if (lab) lab.textContent = tt.toFixed(1);
}

function initMultipleReflections() {
    WaveScene.run({

        // 左欄只有約 250 px 寬：三行以上的併排會被公式框裁掉，所以一行一條。
        formula: '\\begin{aligned} r &= \\frac{Z_1 - Z_2}{Z_1 + Z_2} \\\\ Z &= \\sqrt{T\\mu} \\\\ \\tau &= 1 + r \\end{aligned}',
        formulaFallback: 'r = (Z₁−Z₂)/(Z₁+Z₂)　Z = √(Tμ)　τ = 1 + r',

        controls: {
            selects: [
                {
                    key: 'ends', label: '兩端是哪一種（左／右）', def: 'fixed-fixed',
                    options: [
                        { v: 'fixed-fixed', t: '兩端都固定（釘在牆上）' },
                        { v: 'fixed-free',  t: '左固定、右自由' },
                        { v: 'free-fixed',  t: '左自由、右固定' },
                        { v: 'free-free',   t: '兩端都自由' },
                    ],
                },
                {
                    key: 'medium', label: '中間的界面（4 m 處）', def: 'dense',
                    options: [
                        { v: 'same',  t: '兩段一樣　沒有界面' },
                        { v: 'dense', t: '右段較重　μ₂ = 4μ₁（波變慢）' },
                    ],
                },
            ],
            sliders: [
                // ⚠️ max 吃的是具名常數（README 陷阱二十二）：時間軸的長度
                //    同時是滑桿的上限、時鐘的回捲點、畫面刻度的右端。
                { key: 'scrub', label: '時間軸（拖動＝回放）', unit: 's',
                  min: 0, max: MR_T_MAX, step: 0.1, def: 0 },
                { key: 'speed', label: '播放速度（慢動作）', unit: '×',
                  min: MR_SPEED_MIN, max: MR_SPEED_MAX, step: 0.25, def: MR_SPEED_DEF, dec: 2 },
            ],
        },

        // 拖時間軸不該讓動畫停下來或歸零——它就是在播放器上拖進度條。
        keepLive: ['scrub'],

        cards: [
            { label: '時間 T',             id: 'cardT',    unit: 's',   highlight: true },
            { label: '左段波速 V₁',        id: 'cardV1',   unit: 'm/s', highlight: true },
            { label: '右段波速 V₂',        id: 'cardV2',   unit: 'm/s' },
            { label: '界面反射係數 r',     id: 'cardR',    unit: '' },
            { label: '界面透射係數 τ',     id: 'cardTau',  unit: '' },
            { label: '已經發生的事件',     id: 'cardHits', unit: '次' },
            { label: '下一個事件',         id: 'cardNext', unit: '' },
            { label: '目前最大的振幅',     id: 'cardAmp',  unit: 'cm' },
        ],

        values(t, panel) {
            const tt = mrDisplayTime(t, panel);
            const M = mrModel(panel);
            const S = mrSchedule(panel);
            const past = mrPastEvents(S.events, tt);
            const next = mrNextEvent(S.events, tt);
            let amp = 0;
            for (const pk of S.packets) {
                if (tt >= pk.t0 - 1e-9) amp = Math.max(amp, Math.abs(pk.A));
            }
            return {
                cardT:    tt.toFixed(2),
                cardV1:   M.m1.v.toFixed(2),
                cardV2:   M.m2.v.toFixed(2),
                cardR:    mrSigned(M.r, 2),
                cardTau:  M.tau.toFixed(2),
                cardHits: String(past.length),
                cardNext: next ? `${next.t.toFixed(2)} s（${mrEventWhere(next)}）` : '沒有了',
                cardAmp:  amp.toFixed(2),
            };
        },

        titleText(t, panel) {
            const tt = mrDisplayTime(t, panel);
            const S = mrSchedule(panel);
            const M = S.M;

            if (tt < 0.05) {
                return `脈波從 ${MR_X0.toFixed(1)} m 出發，`
                     + (M.hasJ ? `中間 4 m 處接了一段不同線密度的繩子（${MR_ENDS[M.endsKey]}）`
                               : `整條繩子均勻，${MR_ENDS[M.endsKey]}`)
                     + `——按下開始，看它每撞一次就在時間軸上留下一個點`;
            }
            const past = mrPastEvents(S.events, tt);
            const last = past[past.length - 1];
            if (last && tt - last.t < 0.6) {
                return `t = ${last.t.toFixed(2)} s：${mrRuleText(last)}`;
            }
            const next = mrNextEvent(S.events, tt);
            if (!next) {
                return `時間軸上的事件都跑完了——把時間軸滑桿往左拖就是回放，`
                     + `畫面上還會剩下幾個來不及跑完的脈波`;
            }
            return `還在路上：下一個事件在 t = ${next.t.toFixed(2)} s（${mrEventWhere(next)}），`
                 + `還有 ${(next.t - tt).toFixed(2)} 秒——`
                 + `目前畫面上有 ${S.packets.filter(pk => tt >= pk.t0 && Math.abs(pk.A) >= 0.1).length} 個跑得動的脈波`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const tt = mrDisplayTime(t, panel);
            const S = mrSchedule(panel);
            const M = S.M;
            const now = tt;
            const curve = mrSampleAll(S, now);

            // ------------------------------------------------------------
            // 兩端的牆與中間的界面（貫穿兩條 lane）
            // ------------------------------------------------------------
            for (const lane of [MR_LANE_ROPE, MR_LANE_DECO]) {
                if (M.hasJ) {
                    TS.drawJunction(p, view, MR_XJ, lane, 90,
                        lane === MR_LANE_ROPE
                            ? { label: `界面　μ ${M.mu1.toFixed(2)} → ${M.mu2.toFixed(2)} kg/m` }
                            : { label: '' });
                } else if (lane === MR_LANE_DECO) {
                    mrVLine(p, view, MR_XJ, lane - 90, lane + 90, [203, 213, 225]);
                }
                TS.drawEndpoint(p, view, 0, lane, M.rWallL > 0 ? 'free' : 'fixed');
                TS.drawEndpoint(p, view, MR_L, lane, M.rWallR > 0 ? 'free' : 'fixed');
            }

            // ------------------------------------------------------------
            // lane 0：實際的繩子（所有脈波加起來）
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, MR_LANE_ROPE);
            if (mrShow('sum')) {
                TS.drawWave(p, view, curve.sum,
                    { baseY: MR_LANE_ROPE, ampScale: MR_AMP_C, color: MR_COL_SUM, weight: 5 });
                TS.drawBeads(p, view, mrFamily(S, null), now,
                    { baseY: MR_LANE_ROPE, ampScale: MR_AMP_C, n: 26,
                      color: [148, 163, 184], radius: 4 });
                TS.valueBadge(p, view, TS.ropeX(view, 1.0), view.toScreenY(MR_SUM_Y),
                    '合成波（繩子真正的位置）',
                    { size: 14, stroke: MR_COL_SUM, fillColor: MR_COL_SUM });
            }
            TS.drawLaneLabel(p, view, MR_LANE_ROPE, '繩子', MR_COL_SUM);

            // ------------------------------------------------------------
            // lane 1：分解——入射、反射、透射各自畫（都在同一條基線上）
            // ------------------------------------------------------------
            TS.drawBaseline(p, view, MR_LANE_DECO);
            const fams = [
                { kind: 'incident',    col: MR_COL_INC, text: '入射波', at: 1.0 },
                { kind: 'reflected',   col: MR_COL_REF, text: '反射波', at: 3.0 },
                { kind: 'transmitted', col: MR_COL_TRA, text: '透射波', at: 6.0 },
            ];
            for (const f of fams) {
                if (!mrShow(f.kind)) continue;
                TS.drawWave(p, view, curve[f.kind],
                    { baseY: MR_LANE_DECO, ampScale: MR_AMP_C, color: f.col, weight: 3, dash: 8 });
                TS.valueBadge(p, view, TS.ropeX(view, f.at), view.toScreenY(MR_FAMILY_Y),
                    f.text, { size: 15, stroke: f.col, fillColor: f.col });
            }
            TS.drawLaneLabel(p, view, MR_LANE_DECO, '分解', [100, 116, 139]);

            // ------------------------------------------------------------
            // 時間軸
            // ------------------------------------------------------------
            mrDrawTimeline(p, view, now, S);
            mrSyncScrub(tt);
        },
    });

    // ⚠️ 一定要在 WaveScene.run() 之後：面板的 innerHTML 是 run() 裡才寫上去的。
    mrBuildToggles();
}

initMultipleReflections();

// 匯出這一頁的常數與純函式，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    MR_LANE_ROPE, MR_LANE_DECO, MR_AMP_C, MR_SUM_Y, MR_FAMILY_Y,
    MR_AXIS_T, MR_AXIS_B, MR_MARK_H, MR_MARK_W, MR_RULE_Y, MR_LEGEND_Y,
    MR_L, MR_TENSION, MR_XJ, MR_X0, MR_W0, MR_A0,
    MR_T_MAX, MR_MARK, MR_MAX_PACKETS, MR_SAMPLES_PER_W,
    MR_SPEED_MIN, MR_SPEED_MAX, MR_SPEED_DEF,
    MR_MEDIA, MR_ENDS, MR_TOGGLES, MR_SHOW,
    mrModel, mrSchedule, mrPacketY, mrFamily, mrSampleAll, mrShow,
    mrRuleText, mrSigned,
    mrEventColor, mrEventWhere, mrNextEvent, mrPastEvents,
    MR_CLK, mrAdvance, mrDisplayTime,
    MR_STEP, mrStepTime, mrStepForward,
};
