/**
 * 🎺 開管與閉管的空氣柱駐波 — 同樣的管子，一端封起來就少掉一半的諧音
 *
 * 這一頁要看到三件事：
 *   1. 管子裡的空氣駐波跟弦上的駐波是同一種東西：波節（空氣不動）與波腹
 *      （空氣動得最厲害）**在原地疏密交替**，波形不會跑。
 *   2. **兩端開口的管子**，兩端都是波腹（空氣可以自由進出），所以管長裡
 *      塞得下整數個**半波長**：L = n·λ/2，n 是任何正整數 → 諧音比
 *      1 : 2 : 3 : 4 : 5，每一個諧音都有。
 *   3. **一端封閉的管子**，封閉端是波節（空氣貼著牆動不了）、開口端是波腹，
 *      所以管長裡塞得下的是**四分之一波長**：L = n·λ/4，而 n 只能是奇數
 *      → 諧音比 1 : 3 : 5 : 7 : 9，**偶數諧音整個不見**。
 *
 * ⚠️ 這一頁的變數 k 是「第幾個諧音」（1、2、3…），n 才是模態編號。
 *    開管時 n = k（1、2、3…），閉管時 n = 2k−1（1、3、5…）。
 *    兩者分開寫是刻意的：學生要看到的是「第 4 個諧音在這裡根本不存在」，
 *    而不是「滑桿只能停在某些值」。
 *
 * ⚠️ 這一頁的空氣是**縱波**：質點沿著管子**左右**移動，不是上下。
 *    所以下面那條 lane 走 drawCompression（位移加在 x 上），上面那條 lane
 *    才是教科書的位移圖（縱軸＝往右為正）。兩條 lane 畫的是**同一個函式**。
 *
 * 場景骨架、縱波的繪圖、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的物理（公尺、秒）
// ==========================================================================
const AC_V = 343;              // 聲速（m/s，20 °C 的空氣）

// 畫面上的慢動作。真正的 f 是 100–500 Hz，照真實速度播放會糊成一團，
// 所以振動週期固定成 AC_SLOW 秒；卡片上的 f、λ、v 全部是真的。
const AC_SLOW = 4.0;

const AC_L_MIN = 1.2, AC_L_MAX = 2.0, AC_L_DEF = 1.6;      // 管長（公尺）
const AC_K_MIN = 1, AC_K_MAX = 5, AC_K_DEF = 2;            // 第幾個諧音
// ⚠️ 振幅上限 0.8 公分是**量出來的**，不是口味：最壞那一格是「最短的管子
//    （L = 1.2 m）＋最高的諧音（開管 n = 5，λ 只剩 0.48 m）＋最小的畫布
//    （850×314，scale 0.349）」——在那裡質點間距只有 8.1 px，而圓點半徑會
//    踩到 `view.len` 的 3 px 下限、**不跟著縮**（直徑 4.8 px），於是振幅每多
//    0.2 公分就吃掉 0.55 px 的餘裕。A = 0.8 時剩 1.07 px（13%，和 23 頁
//    SB_BEADS 的既有標準同一個量級）；A = 1.0 只剩 0.52 px（6%）。
//    驗證器 ㉘(g) 對整格參數逐點驗算，不是只驗預設值。
const AC_A_MIN = 0.4, AC_A_MAX = 0.8, AC_A_DEF = 0.6;      // 振幅（公分）

// ==========================================================================
// 座標：物理的公尺 → 繩子的公尺（世界是 1000 × 900，由 wave-scene.js 宣告）
// ==========================================================================
/**
 * 管長 1 公尺畫成幾個「繩子公尺」。
 *
 * ⚠️ 管子的**畫出來的長度必須跟 L 成正比**，否則拉長管子時畫面完全不動
 *    （同樣的 n 長得一模一樣），而「λ 被管長鎖住」這件事當場消失。
 *    最短的管子（1.2 m）畫成 4.2 個繩子公尺，管子仍然佔得到畫面寬度；
 *    最長的（2.0 m）剛好 7.0 個繩子公尺。
 */
const AC_STRETCH = 3.5;
/** 管子的中心固定在繩子座標的哪裡（rope-m）。兩端對稱地往左右長。 */
const AC_CENTER = 4.0;

// ⚠️ 質點數、半徑與振幅上限是**一起決定的**（理由見 23 頁的 SB_BEADS）：
//    ‧ 一個波長至少要有 8 顆質點，疏密才看得出來 → 質點數有下限。
//      這是最綁的那一條：管子只有 4.2~7.0 個繩子公尺長，而最高諧音
//      （開管 n = 5）一個波長只佔 2/5 根管子——**每個波長的質點數是
//      2·AC_BEADS/n**，所以 n = 5 那格決定了 AC_BEADS 至少要 20。
//    ‧ 相鄰質點的最大相對位移必須小於平衡間距，否則質點會穿過彼此
//    ‧ 而且要留得下兩顆圓點（直徑 1.6r）——間距扣掉相對位移之後，
//      還要大於一個圓的直徑，不然整排糊成一條實線
//    驗證器 ㉘(g) 對**整格參數**（管長 × 諧音 × 振幅 × 三個縮放尺度）逐點
//    驗算這三條，不是只驗預設值。
const AC_BEADS = 20;           // 管子上的質點數
const AC_DOT_R = 5;            // 質點半徑（世界單位）
const AC_AMP_C = 10;           // 下面那條 lane 的**橫向**放大：世界單位 / 公分

// ⚠️ 上面那條 lane 的**縱軸另外放大**，不跟 AC_AMP_C 共用。兩條 lane 的縱軸
//    量的不是同一個東西：上面那條的縱軸是位移（公分），下面那條的縱軸只是
//    管子裡的一排質點，它的位移是加在**橫向**的。共用一個常數的症狀是
//    **位移圖變成一條幾乎水平的線**——A = 0.6 公分只有 6 個世界單位高，
//    1600 px 下是 4.8 px，於是紅點、綠圈、曲線全部疊在同一條線上，「波節
//    不動、波腹動得最厲害」當場看不出來，而**所有數值斷言照樣全綠**。
//    60 是**量出來的**：縱軸的最大擺幅 A_max × 60 = 48 個世界單位，在三個
//    尺度下都要塞得進「λ 括號的白底牌」與「紅點／綠圈的圖例」之間——
//    那一條由驗證器 ㉘(h) 的區塊表守著，不是排一排好看。
const AC_TOP_AMP = 60;         // 上面那條 lane 的**縱向**放大：世界單位 / 公分

// ==========================================================================
// 版面（世界單位）
// ==========================================================================
// ⚠️ 這幾行是**由上而下量出來的**，不是排一排好看：字級走 `view.len(size, min)`，
//    而 min 是**畫布像素**——scale 越小，同一行字在**世界單位**裡就越高
//    （850×314 那個尺度下 scale = 0.349，一行 8 px 的字是 22.9 個世界單位，
//    是 1600 px 時的 1.6 倍）。所以判斷「兩行會不會撞在一起」要用**最小
//    的那個尺度**算。AC_TOP_CAP 與 AC_BRACKET_Y 之間那 80 個世界單位就是
//    為此留的：括號標籤的白底牌會往上長 size + 1.5·pad。驗證器 ㉘(h) 逐行
//    在三個尺度下各量一次。
// ⚠️ AC_TOP_Y 與 AC_LEG_Y 是**跟著 AC_TOP_AMP 一起量出來的**：位移曲線的
//    最大擺幅是 ±A_max·AC_TOP_AMP = ±48 個世界單位，上面要留給括號的白底牌、
//    下面要留給圖例。把那兩段縮短（或把 AC_TOP_AMP 調大）就會撞在一起，
//    ㉘(h) 會紅。
const AC_RULE_Y   = 96;        // 最上面那行：這一種管子的規則
const AC_TOP_CAP  = 172;       // 上面那條 lane 的說明（TOP）
const AC_BRACKET_Y = 252;      // λ/2 或 λ/4 的括號線
const AC_TOP_Y    = 323;       // 上面那條 lane：位移圖的平衡線
const AC_LEG_Y    = 400;       // 紅點／綠圈圖例（TOP）
const AC_BOT_CAP  = 456;       // 下面那條 lane 的說明（TOP）
const AC_PIPE_Y   = 580;       // 下面那條 lane：空氣柱的中心線
const AC_PIPE_H   = 40;        // 管壁半高
const AC_BAND     = 30;        // 密部色帶半高（要小於管壁，條紋才在管子裡）
const AC_END_Y    = 664;       // 兩端標籤（TOP）
const AC_BAND_CAP = 714;       // 色帶說明
const AC_RATIO_Y  = 772;       // 最下面那行：這一根管子吹得出的諧音比（TOP）

/**
 * 畫面上每一個文字元素的字級與像素下限（一律走 `view.len(size, min)`）。
 *
 * ⚠️ **繪製碼與驗證器讀同一份。** 兩邊各寫一份的話，把某一行的字級改大
 *    一點不會有任何症狀：那一行字會靜靜地壓到隔壁，而所有數值斷言照樣
 *    全綠。驗證器 ㉘(h) 的每一個外框都是從這張表算出來的。
 */
const AC_TYPE = {
    rule:   { size: 19, min: 11 },   // 最上面那行
    cap:    { size: 14, min: 8 },    // 兩條 lane 的說明
    legend: { size: 14, min: 8 },    // 圖例
    bracket:{ size: 15, min: 9 },    // λ/2、λ/4 的括號標籤
    end:    { size: 15, min: 9 },    // 兩端標籤
    band:   { size: 14, min: 8 },    // 色帶說明
    ratio:  { size: 15, min: 9 },    // 最下面那行
};

// ==========================================================================
// 這一頁的物理
// ==========================================================================

/**
 * 這一頁的物理。卡片、畫面、標題列與驗證器全部讀這一份，不另外算。
 *
 * 回傳的 `disp(xr, t)` 吃的是**繩子公尺**、吐的是**公分**——因為
 * `drawCompression` 的質點位置是 `ropeX(xe) + xi·ampScale`，位移那一項
 * 得是世界單位。兩條 lane 吃的是同一個 `disp`，只是上面那條把公分當縱軸。
 */
function acModel(panel) {
    const closed = panel.pipe === 'closed';
    const L = panel.L;
    const k = Math.round(panel.k);
    // 開管：第 k 個諧音就是第 k 個模態。閉管：第 k 個諧音是第 2k−1 個模態。
    const n = closed ? 2 * k - 1 : k;
    const lam = closed ? 4 * L / n : 2 * L / n;
    const f = AC_V / lam;
    const f1 = closed ? AC_V / (4 * L) : AC_V / (2 * L);
    const w = 2 * Math.PI / AC_SLOW;

    // 畫出來的管子：中心固定在 AC_CENTER，兩端對稱。
    const mRope = L * AC_STRETCH;
    const u0 = AC_CENTER - mRope / 2, u1 = AC_CENTER + mRope / 2;

    // 形狀（不含時間）。開管兩端是波腹 → cos；閉管左端是波節 → sin。
    const shape = closed
        ? (xm => Math.sin(n * Math.PI * xm / (2 * L)))
        : (xm => Math.cos(n * Math.PI * xm / L));

    // 波節與波腹的位置（公尺）。兩者都從 shape 導出來，不是另外寫一份。
    const nodes = [], anti = [];
    if (closed) {
        const half = (n - 1) / 2;
        for (let j = 0; j <= half; j++) nodes.push(2 * j * L / n);
        for (let j = 0; j <= half; j++) anti.push((2 * j + 1) * L / n);
    } else {
        for (let j = 0; j < n; j++) nodes.push((2 * j + 1) * L / (2 * n));
        for (let j = 0; j <= n; j++) anti.push(j * L / n);
    }

    /** 繩子公尺 → 公分。管子外面回 0（畫超出去也不會拖出一條尾巴）。 */
    const disp = (xr, t) => {
        const xm = (xr - u0) / AC_STRETCH;
        if (xm < -1e-9 || xm > L + 1e-9) return 0;
        return panel.A * shape(xm) * Math.cos(w * t);
    };
    /** 物理的公尺 → 繩子公尺。畫面上的每一個位置都要經過這一支。 */
    const toRope = (xm) => u0 + xm * AC_STRETCH;

    return {
        closed, L, k, n, lam, f, f1, w,
        mRope, u0, u1, shape, disp, toRope, nodes, anti,
        rule: closed ? 'L = n · λ/4（n 只能是奇數）' : 'L = n · λ/2（n 是任何正整數）',
        ratio: closed ? '1 : 3 : 5 : 7 : 9' : '1 : 2 : 3 : 4 : 5',
        which: closed ? '閉管（左端封閉、右端開口）' : '開管（兩端開口）',
    };
}

/**
 * 諧音清單：第 m 個諧音的頻率是 m × f₁。
 *
 * 開管每一個 m 都有；閉管只有**奇數** m 有——偶數那幾列就是「缺的那幾個」。
 * 清單是**固定列出來的**（1..AC_K_MAX），缺的也照樣列，只是標成不可按：
 * 把缺失的那幾列藏起來的話，學生只會看到「這根管子有三個音」，
 * 看不到「它少了兩個」。
 */
function acHarmonics(panel) {
    const closed = panel.pipe === 'closed';
    const base = closed ? AC_V / (4 * panel.L) : AC_V / (2 * panel.L);
    const out = [];
    for (let m = 1; m <= AC_K_MAX; m++) {
        const ok = !closed || (m % 2 === 1);
        out.push({
            m, ok,
            f: ok ? m * base : null,
            // 這一列對應到滑桿的哪一格（閉管的偶數列沒有對應的模態）
            k: closed ? (m + 1) / 2 : m,
        });
    }
    return out;
}

// ==========================================================================
// 聲音（Web Audio）
// ==========================================================================
/**
 * ⚠️ 一定要讀 `globalThis`。驗證器是用
 *    `new Function('window', …)({}, …)` 把這一頁抓進 Node 的，那裡的
 *    `window` 是一個**空物件**——只讀 `window.AudioContext` 的話，
 *    驗證器永遠種不進替身，這一整段就沒有任何守門員（README 陷阱十九）。
 */
function acAudioCtor() {
    const w = (typeof window !== 'undefined' && window) || null;
    const g = (typeof globalThis !== 'undefined' && globalThis) || null;
    return (w && (w.AudioContext || w.webkitAudioContext))
        || (g && (g.AudioContext || g.webkitAudioContext)) || null;
}

let AC_CTX = null;
/** 每一次播出去的聲音都記一筆。驗證器 ㉘(f) 直接讀它（可從外部清空）。 */
const AC_LOG = [];

/**
 * 播一串正弦波。`spec` 是 `[{ f, amp }]`，每個諧音一個振盪器。
 *
 * ⚠️ 純正弦 + 各自的包絡，**不加任何濾波或波形整形**：這一頁要聽的是
 *    「有哪些頻率」，加料就聽不出閉管少了偶數諧音。
 * ⚠️ 回傳的是「真的送進振盪器的頻率」，不是傳進來的 `spec`——中間若被
 *    改過（例如全部乘上一個倍率），驗證器要抓得到。
 */
function acPlay(spec, dur) {
    const Ctor = acAudioCtor();
    if (!Ctor || !spec || !spec.length) return null;
    if (!AC_CTX) AC_CTX = new Ctor();
    const ctx = AC_CTX;
    if (ctx.resume) ctx.resume();

    const t0 = ctx.currentTime + 0.02;
    const len = dur || 1.6;
    const vol = 0.18;
    const played = [];
    for (const s of spec) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = s.f;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(s.amp * vol, t0 + 0.03);
        gain.gain.setValueAtTime(s.amp * vol, t0 + Math.max(0.05, len - 0.3));
        gain.gain.linearRampToValueAtTime(0, t0 + len);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + len);
        played.push({ f: osc.frequency.value, amp: s.amp });
    }
    AC_LOG.push(played);
    return played;
}

/** 單獨聽一個諧音（純正弦）。 */
function acPlayHarmonic(m, panel) {
    const h = acHarmonics(panel).find(x => x.m === m);
    if (!h || !h.ok) return null;
    return acPlay([{ f: h.f, amp: 1 }]);
}

/**
 * 聽整根管子：每個諧音的振幅都是 1/n（這是管樂器音色的來源）。
 * 開管有 1、2、3、4、5；閉管只有 1、3、5——**聽起來就是不一樣**。
 */
function acPlayPipe(panel) {
    const spec = acHarmonics(panel).filter(h => h.ok)
        .map(h => ({ f: h.f, amp: 1 / h.m }));
    return acPlay(spec, 2.0);
}

// ==========================================================================
// 面板上的諧音清單（DOM）
// ==========================================================================
let AC_PANEL = null;

/**
 * 在控制面板最後面掛上「諧音清單」那一盒。
 *
 * ⚠️ **一定要在 `WaveScene.run()` 之後才呼叫**：面板的 innerHTML 是
 *    run() 裡才寫上去的，先插進去的話會被整片蓋掉（30 頁踩過同一個坑）。
 * ⚠️ Node 裡 `document.getElementById` 回 null，這一支直接返回——
 *    驗證器看到的永遠是「沒有這一盒」，所以它的內容由純函式
 *    `acHarmonics()` 負責斷言。
 */
function acBuildList() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const host = document.getElementById('controlPanel');
    if (!host) return;

    let box = document.getElementById('acListBox');
    if (!box) {
        box = document.createElement('div');
        box.className = 'control-box';
        box.id = 'acListBox';
        box.style.marginTop = '18px';
        // 插在「核心關係」公式盒之前（那是這一組頁面的收尾）。
        // 找不到公式盒就退回 appendChild——不能讓整盒消失。
        const last = host.lastElementChild;
        if (last && last !== box) host.insertBefore(box, last);
        else host.appendChild(box);
    }
    acRenderList(box);
}

function acRenderList(box) {
    const panel = AC_PANEL;
    if (!panel) return;
    const hs = acHarmonics(panel);
    const cur = acModel(panel);

    let html = '<label><span>諧音清單（點一下聽這個音）</span></label>'
             + '<div style="display:grid;gap:5px;margin-top:4px;">';
    for (const h of hs) {
        const on = h.ok && h.m === cur.n;
        // ⚠️ 自己指定底色的按鈕一定要**同時**指定前景色。`.control-box button`
        //    的全域規則是 color:#ffffff，沒寫 color 的話灰底那幾列就是白字
        //    灰底——按鈕在畫面上完全空白，而任何斷言都不會紅。
        const st = 'width:100%;text-align:left;padding:6px 9px;font-size:0.8rem;'
                 + 'font-weight:700;border-radius:5px;cursor:pointer;'
                 + (h.ok
                     ? `color:${on ? '#1d4ed8' : '#000'};background:${on ? '#eff6ff' : '#fff'};`
                       + `border:1px solid ${on ? '#2563eb' : '#cbd5e1'};`
                     : 'color:#94a3b8;background:#f1f5f9;border:1px solid #e2e8f0;'
                       + 'cursor:not-allowed;text-decoration:line-through;');
        html += `<button data-ac-m="${h.m}" ${h.ok ? '' : 'disabled'} style="${st}">`
             +  `▶　第 ${h.m} 諧音`
             +  (h.ok ? `　${h.f.toFixed(1)} Hz` : '　閉管沒有這個諧音')
             +  `</button>`;
    }
    html += '</div>';
    html += '<button id="acPlayAll" style="width:100%;margin-top:8px;padding:8px;'
         +  'font-size:0.8rem;font-weight:700;color:#fff;background:#2563eb;'
         +  'border:1px solid #1d4ed8;border-radius:5px;cursor:pointer;">'
         +  `聽整根管子（${cur.closed ? '只有奇數諧音' : '所有諧音'}）</button>`;
    html += '<div style="margin-top:6px;font-size:0.72rem;color:#64748b;line-height:1.5;">'
         +  '▶ 播的是<b>純正弦</b>，一次只聽得到一個頻率；最下面那顆是把'
         +  `上面${cur.closed ? '三' : '五'}個音疊起來的音色。`
         +  '</div>';
    box.innerHTML = html;

    for (const btn of box.querySelectorAll('button[data-ac-m]')) {
        btn.addEventListener('click', () => {
            const m = Number(btn.getAttribute('data-ac-m'));
            acPlayHarmonic(m, AC_PANEL);
            acSelectHarmonic(AC_PANEL.pipe === 'closed' ? (m + 1) / 2 : m);
        });
    }
    const all = box.querySelector('#acPlayAll');
    if (all) all.addEventListener('click', () => acPlayPipe(AC_PANEL));
}

/** 把「第 k 個諧音」寫回滑桿。走 input 事件，面板的數字與卡片一起更新。 */
function acSelectHarmonic(k) {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const el = document.getElementById('kSlider');
    if (!el) return;
    el.value = String(k);
    el.dispatchEvent(new Event('input'));
}

/** 面板有變動就重畫清單。掛在三個控制項自己的事件上（在 run() 之後）。 */
function acBindList() {
    if (typeof document === 'undefined' || !document.getElementById) return;
    acBuildList();
    for (const id of ['pipeSelect', 'LSlider', 'kSlider']) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => acBuildList());
    }
}

function initAirColumn() {
    WaveScene.run({

        // ⚠️ KaTeX 的 display 模式不換行，左欄公式框在 1100px 時內寬只有
        //    183–198px——兩條式子用 \qquad 併排會被**靜默裁掉**（陷阱八）。
        formula: '\\begin{aligned} L &= n\\frac{\\lambda}{2} \\quad (\\text{開管}) \\\\ '
               + 'L &= n\\frac{\\lambda}{4} \\quad (\\text{閉管，}n\\text{ 奇數}) \\end{aligned}',
        formulaFallback: '開管 L = nλ/2　閉管 L = nλ/4（n 奇數）',

        controls: {
            selects: [
                {
                    key: 'pipe', label: '管子', def: 'open',
                    options: [
                        { v: 'open',   t: '開管（兩端開口）' },
                        { v: 'closed', t: '閉管（左端封閉、右端開口）' },
                    ],
                },
            ],
            sliders: [
                { key: 'L', label: '管長 <i>L</i>', unit: 'm', min: AC_L_MIN, max: AC_L_MAX,
                  step: 0.05, def: AC_L_DEF, dec: 2 },
                { key: 'k', label: '第幾個諧音 <i>k</i>', unit: '', min: AC_K_MIN, max: AC_K_MAX,
                  step: 1, def: AC_K_DEF, dec: 0 },
                { key: 'A', label: '振幅 <i>A</i>', unit: 'cm', min: AC_A_MIN, max: AC_A_MAX,
                  step: 0.1, def: AC_A_DEF, dec: 1 },
            ],
        },

        cards: [
            { label: '波長 Λ',     id: 'cardLam',   unit: 'm',   highlight: true },
            { label: '頻率 F',     id: 'cardF',     unit: 'Hz',  highlight: true },
            { label: '管長 L',     id: 'cardL',     unit: 'm' },
            { label: '模態 N',     id: 'cardN',     unit: '' },
            { label: '波節數',     id: 'cardNodes', unit: '個' },
            { label: '基頻 F₁',    id: 'cardF1',    unit: 'Hz' },
            { label: '聲速 V',     id: 'cardV',     unit: 'm/s' },
            { label: '諧音比',     id: 'cardRatio', unit: '' },
        ],

        values(t, panel) {
            const m = acModel(panel);
            AC_PANEL = panel;
            return {
                cardLam:   m.lam.toFixed(3),
                cardF:     m.f.toFixed(1),
                cardL:     m.L.toFixed(2),
                cardN:     String(m.n),
                cardNodes: String(m.nodes.length),
                cardF1:    m.f1.toFixed(1),
                cardV:     AC_V.toFixed(0),
                // 這一根管子**吹得出**的諧音比。基頻永遠是 1。
                cardRatio: m.ratio,
            };
        },

        titleText(t, panel) {
            const m = acModel(panel);
            return `${m.which}：${m.rule} → λ = ${m.lam.toFixed(3)} m，`
                 + `f = v/λ = ${m.f.toFixed(1)} Hz（基頻 ${m.f1.toFixed(1)} Hz 的 ${m.n} 倍）；`
                 + `管內有 ${m.nodes.length} 個波節、${m.anti.length} 個波腹`;
        },

        draw(p, view, t, panel) {
            const m = acModel(panel);
            if (AC_PANEL !== panel) { AC_PANEL = panel; acBuildList(); }
            acDrawShapeLane(p, view, t, panel, m);
            acDrawPipeLane(p, view, t, panel, m);
            acDrawCaptions(p, view, m);
        },
    });

    // ⚠️ 一定要在 WaveScene.run() 之後：面板的 innerHTML 是 run() 裡才寫上去的。
    acBindList();
}

// ==========================================================================
// 畫面
// ==========================================================================

/** 一條置中的說明文字。畫在指定的世界 y 上。 */
function acText(p, view, x, worldY, text, type, color, align) {
    p.noStroke();
    p.fill(color[0], color[1], color[2]);
    p.textSize(view.len(type.size, type.min));
    p.textStyle(p.BOLD);
    p.textAlign(align || p.CENTER, p.TOP);
    p.text(text, x, view.toScreenY(worldY));
}

/**
 * 上面那條 lane：位移圖。
 *
 * 縱軸是「這個位置的空氣往右跑了多少」。縱波沒有上下起伏，所以這條曲線
 * 不是繩子的形狀——**它是同一個函式的另一種長相**（28 頁的波形圖）。
 * 下面那條 lane 的質點位置就是從這條曲線讀出來的（同一個 `m.disp`）。
 *
 * ⚠️ 兩條 lane 的**縱軸放大倍率不同**（AC_TOP_AMP vs AC_AMP_C）：上面那條的
 *    縱軸是位移，下面那條的位移是加在橫向的。讀**形狀**（哪裡是波節、哪裡
 *    是波腹）要從上面那條讀，讀**大小**要看下面那條。理由寫在 AC_TOP_AMP。
 */
function acDrawShapeLane(p, view, t, panel, m) {
    const TS = WaveScene;
    const sx0 = TS.ropeX(view, m.u0);

    // 這一條 lane 是「位移圖」不是繩子——縱波沒有上下起伏，
    // 縱軸是「這個位置的空氣往右跑了多少」。不講的話學生會把它當成繩波。
    acText(p, view, sx0, AC_TOP_CAP,
        '位移圖（縱軸已放大）：空氣往右（上）或往左（下）跑了多少',
        AC_TYPE.cap, [100, 116, 139], p.LEFT);

    TS.drawBaseline(p, view, AC_TOP_Y, m.u0, m.u1);
    TS.drawWave(p, view, TS.sample(m.disp, m.u0, m.u1, t, m.lam * AC_STRETCH),
        { baseY: AC_TOP_Y, ampScale: AC_TOP_AMP, color: [15, 23, 42], weight: 5 });

    // 波節：位移永遠是 0，畫成紅色實心點。它**永遠不動**，就畫在平衡線上。
    p.noStroke();
    p.fill(220, 38, 38);
    for (const xm of m.nodes) {
        p.circle(TS.ropeX(view, m.toRope(xm)), view.toScreenY(AC_TOP_Y), view.len(17, 8));
    }
    // 波腹：振幅最大，畫成綠色空心圈。它**騎在曲線上**——圈圈會跟著跑到
    // 波峰與波谷（t = T/4 時整條曲線變平，全部回到平衡線，那也是真的）。
    // 畫在平衡線上的話，縱軸一放大，綠圈看起來就和紅點一模一樣了。
    p.noFill();
    p.stroke(22, 163, 74);
    p.strokeWeight(view.len(3, 1.5));
    for (const xm of m.anti) {
        const xr = m.toRope(xm);
        const y = AC_TOP_Y - AC_TOP_AMP * m.disp(xr, t);
        p.circle(TS.ropeX(view, xr), view.toScreenY(y), view.len(23, 11));
    }

    // 括號：開管量的是「波腹到相鄰波腹 = λ/2」（永遠存在，因為兩端就是波腹）；
    // 閉管量的是「封閉端到第一個波腹 = λ/4」。兩個都從左端開始量，
    // 這樣括號的左端真的落在一個波節或波腹上。
    const seg = m.L / m.n;
    const label = m.closed
        ? `封閉端到第一個波腹 = λ/4 = ${(m.lam / 4).toFixed(3)} m`
        : `波腹到相鄰波腹 = λ/2 = ${(m.lam / 2).toFixed(3)} m`;
    TS.wavelengthBracket(p, view, m.toRope(0), m.toRope(seg), AC_BRACKET_Y, label,
        { color: [37, 99, 235], above: true, size: AC_TYPE.bracket.size });

    // 圖例。紅點與綠圈在這條 lane 上都有，要說清楚各是什麼。
    acText(p, view, (sx0 + TS.ropeX(view, m.u1)) / 2, AC_LEG_Y,
        `紅點＝波節（空氣不動，共 ${m.nodes.length} 個）　`
        + `綠圈＝波腹（動得最厲害，共 ${m.anti.length} 個）`,
        AC_TYPE.legend, [100, 116, 139], p.CENTER);
}

/**
 * 下面那條 lane：管內的空氣。
 *
 * 質點沿著管子**左右**移動（縱波），擠在一起的地方色帶就深。
 * 封閉端畫成一面牆，開口端讓管壁直接斷掉——這是這一頁唯一要一眼看出的差別。
 */
function acDrawPipeLane(p, view, t, panel, m) {
    const TS = WaveScene;
    const sx0 = TS.ropeX(view, m.u0), sx1 = TS.ropeX(view, m.u1);
    const sy = view.toScreenY(AC_PIPE_Y);
    const hh = view.len(AC_PIPE_H, 18);

    acText(p, view, sx0, AC_BOT_CAP,
        '管內的空氣（縱波：質點沿著管子左右振動，不是上下）',
        AC_TYPE.cap, [100, 116, 139], p.LEFT);

    // 管子
    p.noStroke();
    p.fill(248, 250, 252);
    p.rect(sx0, sy - hh, sx1 - sx0, hh * 2);
    p.stroke(203, 213, 225);
    p.strokeWeight(view.len(3, 1.5));
    p.line(sx0, sy - hh, sx1, sy - hh);
    p.line(sx0, sy + hh, sx1, sy + hh);

    // 質點與密部色帶。位移加在 x 上，色帶依**實際畫出來的間距**上色
    // （wave-scene.js 的 drawCompression），所以顏色跟眼睛看到的一致。
    TS.drawCompression(p, view, m.disp, t, {
        baseY: AC_PIPE_Y, ampScale: AC_AMP_C, n: AC_BEADS,
        x0m: m.u0, x1m: m.u1,
        color: [37, 99, 235], radius: AC_DOT_R, band: AC_BAND,
    });

    // 封閉端：一面牆（畫在管子外面一點，讓它看起來是「封住」而不是「畫上去」）
    if (m.closed) {
        const wx = sx0;
        p.stroke(30, 41, 59);
        p.strokeWeight(view.len(7, 3));
        p.line(wx, sy - hh - view.len(9, 4), wx, sy + hh + view.len(9, 4));
        for (let i = 0; i < 5; i++) {
            const yy = sy - hh + (2 * hh) * i / 4;
            p.strokeWeight(view.len(3, 1.5));
            p.line(wx, yy, wx - view.len(15, 7), yy + view.len(12, 6));
        }
    }

    // 兩端的標籤。左邊靠左、右邊靠右——兩顆都置中的話，短管子那兩顆
    // 會往中間靠，而長管子（畫到世界右緣）那顆會被畫布切掉一截。
    acText(p, view, sx0, AC_END_Y,
        m.closed ? '封閉端（波節：空氣貼著牆動不了）' : '開口端（波腹：空氣自由進出）',
        AC_TYPE.end, [30, 41, 59], p.LEFT);
    acText(p, view, sx1, AC_END_Y, '開口端（波腹：空氣自由進出）',
        AC_TYPE.end, [30, 41, 59], p.RIGHT);

    // 色帶的意思。疏密是**站在原地交替**的，不是一團密部跑過去——
    // 這句話下面那條 lane 自己會演，但學生第一次看很容易誤會。
    p.noStroke();
    p.fill(100, 116, 139);
    p.textSize(view.len(AC_TYPE.band.size, AC_TYPE.band.min));
    p.textStyle(p.NORMAL);
    p.textAlign(p.CENTER, p.TOP);
    p.text('色帶深＝空氣擠得密、還沒上色＝被拉得疏；同一個位置會隨時間疏密交替（波形不跑）',
        (sx0 + sx1) / 2, view.toScreenY(AC_BAND_CAP));
}

/** 最上面那行規則與最下面那行諧音比。 */
function acDrawCaptions(p, view, m) {
    acText(p, view, view.toScreenX(500), AC_RULE_Y,
        `${m.which}　${m.rule}`,
        AC_TYPE.rule, [15, 23, 42], p.CENTER);
    acText(p, view, view.toScreenX(500), AC_RATIO_Y,
        `這一根管子吹得出的諧音比：${m.ratio}`,
        AC_TYPE.ratio, m.closed ? [185, 28, 28] : [21, 128, 61], p.CENTER);
}

initAirColumn();

// 匯出這一頁的常數與純函式，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    AC_V, AC_SLOW,
    AC_L_MIN, AC_L_MAX, AC_L_DEF,
    AC_K_MIN, AC_K_MAX, AC_K_DEF,
    AC_A_MIN, AC_A_MAX, AC_A_DEF,
    AC_STRETCH, AC_CENTER, AC_BEADS, AC_DOT_R, AC_AMP_C, AC_TOP_AMP,
    AC_RULE_Y, AC_TOP_CAP, AC_BRACKET_Y, AC_TOP_Y, AC_LEG_Y,
    AC_BOT_CAP, AC_PIPE_Y, AC_PIPE_H, AC_BAND, AC_END_Y, AC_BAND_CAP, AC_RATIO_Y,
    AC_TYPE,
    acModel, acHarmonics,
    acAudioCtor, acPlay, acPlayHarmonic, acPlayPipe, AC_LOG,
};
