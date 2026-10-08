/**
 * 🚑 都卜勒效應 — 頻率沒有變，是「波峰被追著擠在一起」
 *
 * 波源一邊抖一邊移動，另一個位置站著**觀察者**。波跑的速度由介質決定
 * （這一頁是 4.00 m/s），和波源抖多快、跑多快都無關。
 *
 * 兩種畫面（下拉「畫面」）：
 *   **圓形波** — 由上往下看的水面。波源每抖一個週期就發出一個圓，
 *               每一個圓的**圓心都留在它被發出的地方**，自己往外擴散。
 *               波源一邊跑一邊發，前面的圓就被擠密、後面的被拉疏。
 *   **橫波波形** — 一條 8 m 的繩子。波峰被畫成一條垂直的線，看的是
 *               繩子上「波峰線之間的距離」。
 *
 * 兩種畫面是同一件事：繩波畫面上的每一條波峰線，在圓形波裡就是一個圓。
 *
 * 兩個模式（下拉「誰在動？」）：
 *   **波源移動** — 波源追著自己剛發出的波峰跑，介質裡的波長真的被擠歪了。
 *   **觀察者移動** — 波源固定在原地，介質裡的波長從頭到尾一模一樣，
 *                  但觀察者朝波源衝過去的時候，每秒撞到的波峰就是比較多。
 *
 * 兩個模式的結果長得很像，**原因完全不一樣**——這是這一頁要分開的東西。
 *
 * ⚠️ 為什麼不用真的聲速（340 m/s）？因為 8 公尺的繩子，聲波 23 毫秒就
 *    跑完了，波峰根本來不及被擠在一起。這裡讓 v = 4 m/s、波源最快 1.5 m/s，
 *    是為了讓「波源追著波跑」這件課本畫不出來的事真的看得見——
 *    而都卜勒效應的長相跟介質是繩子還是空氣無關。真實的數字在
 *    「生活中的都卜勒效應」那一節。
 *
 * 場景骨架、波形的數學、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位）
// ==========================================================================
const DOP_ROPE_Y = 430;        // 繩子的平衡位置 ＝ 水塘的中心線（兩種畫面共用同一條軸）
const DOP_AMP_C  = 13;         // 振幅放大：世界單位 / 公分（振幅固定 3 cm）
const DOP_A      = 3;          // 振幅（公分）。固定住，才只看得到頻率的變化。
const DOP_BEADS  = 32;         // 繩上的珠點：只是用來顯示「介質只在原處上下動」

const DOP_LINE_T = 356;        // 波峰線的上端
const DOP_LINE_B = 478;        // 波峰線的下端
const DOP_RAIL_Y = 325;        // 波長括號的高度（只有繩波畫面用得到）
const DOP_SRC_Y  = 235;        // 波源的標籤／徽章高度
const DOP_OBS_Y  = 565;        // 觀察者的標籤／徽章高度
const DOP_NOTE_Y = 665;        // 「靠近中／遠去中」那行大字

// 水塘（圓形波畫面）。上下緣刻意取成對稱於 DOP_ROPE_Y：
// (75 + 785) / 2 = 430，所以水塘的中心線**就是**繩子的那一條線。
// 兩種畫面因此共用同一條軸——圓形波畫面上的「波前與軸的交點」，
// 和繩波畫面上的「波峰線」是同一個 x，λ′ 括號在兩種畫面裡量的是同一段長度。
const DOP_POOL_T =  75;        // 水塘上緣
const DOP_POOL_B = 785;        // 水塘下緣

// 繩子的波速。T = 4 N、μ = 0.25 kg/m → v = √(4/0.25) = 4.00 m/s。
const DOP_V = 4.0;

// 波源的起點。從 1.0 m 出發、最快 1.5 m/s，跑 4 秒剛好到 7.0 m，不會出界。
const DOP_X0 = 1.0;
// 波源移動模式時，觀察者站的位置——在波源的右前方，會被超過去。
const DOP_OBS = 6.0;

// 觀察者移動模式時，波源固定在這裡（接近右端，讓觀察者有整條繩子可以跑）。
const DOP_OSRC = 7.5;
// 觀察者移動模式時，觀察者的**出發點**。往右（靠近）從左端出發、往左（遠去）
// 從右端出發，兩種都能跑滿 4 秒不出界。
// ⚠️ 改變滑桿會讓畫面歸零重來（這是 WaveScene 面板的既有行為），所以那個
//    位置的跳換發生在靜止狀態，不會看起來像「跑一跑突然傳送」。
const DOP_OVO_X0 = vo => (vo >= 0 ? 0.5 : 6.5);

// 波源抖動的頻率。上下限都不是口味——是量出來的：
// 水塘看得到的半徑約 6.5 m、波速 4 m/s，所以畫面上的波前數 ≈ 6.5/4 × f。
//   下限 1.6：把 f 從 1.6 往下調，畫面會出現「一個週期裡只剩一條弧」的時刻
//             （f = 1.2 與 0.8 都是），看起來不像稀疏、像壞掉。1.6 是量到的
//             最低值：一個週期內任何一刻都至少有 2 條弧。附帶的好處是
//             ⑱(b) 的 f = 0.8 那一格從安慰劑變成真的在量畫面（見那邊的註解）。
//   上限 2.8：f = 2.0 時 4 條弧，前方間距 (v−vs)/f = 1.25 m 對後方
//             (v+vs)/f = 2.75 m，2.2 倍的差一眼看得出來；2.8 有 5 條。
// 守門員：verify-waves.js ⑱(j) 掃過整個可達範圍，斷言任何時刻都 ≥ 2 條弧。
const DOP_F_MIN = 1.6, DOP_F_MAX = 2.8, DOP_F_DEF = 2.0;

// ------------------------------------------------------------------
// 這一頁的物理，一處算完給卡片、畫面、標題列共用
// ------------------------------------------------------------------
// ⚠️ 幾何只能有一個家。卡片上的數字和畫面上的波峰線若各自算一次，
//    就會出現「卡片說 1.92 Hz、波峰線看起來不是那樣」而沒有東西會報錯。
//
// ⚠️ 這個函式**不准讀 panel.view**。驗證器是用 { mode, f, vs, vo } 呼叫它的
//    （沒有 view 這個鍵），而且上面那條「一處算完」要成立的話，兩種畫面就
//    必須逐位共用同一組數字。畫面要分岔只能在 draw() 和 titleText() 裡分。
function model(t, panel) {
    const TS = WaveScene;
    const f = panel.f, w = TS.omega(f);

    const xsrc = panel.mode === 'source'
        ? (tt => DOP_X0 + panel.vs * tt)
        : (() => DOP_OSRC);
    const xobs = panel.mode === 'observer'
        ? (tt => DOP_OVO_X0(panel.vo) + panel.vo * tt)
        : (() => DOP_OBS);

    const xs = xsrc(t), xo = xobs(t);
    // 觀察者在波源的哪一側。收到的是「從波源往觀察者那一邊跑」的那一族
    // 波峰——這條決定了下面畫哪一條線、以及用哪一個 λ′。
    const side = (xo >= xs) ? 1 : -1;

    let fObs, lamAnalytic, approach;
    if (panel.mode === 'source') {
        fObs = TS.dopplerFreq(f, DOP_V, panel.vs, side);
        lamAnalytic = (DOP_V - side * panel.vs) / f;
        approach = side > 0;
    } else {
        // ⚠️ dopplerObserver 的第四個參數帶著方向（+1 靠近、−1 遠離），
        //    所以速度要傳**大小**。vo 在這一頁是帶號的（正 = 往 +x 走，
        //    也就是朝波源靠近），直接傳進去的話「遠離」那一半會因為
        //    (−1)×(−1.5) 變成 +1.5，音調反而升高——符號錯了兩次剛好抵銷，
        //    而畫面上的波峰線間距完全正確，只有卡片上的數字是反的。
        approach = (DOP_OSRC - xo) * panel.vo > 0;
        fObs = TS.dopplerObserver(f, DOP_V, Math.abs(panel.vo), approach ? 1 : -1);
        lamAnalytic = DOP_V / f;          // 波源沒動 → 介質裡的波長不變
    }

    // 波峰：第 n 個波峰在 tₙ 發出，之後自己以 v 前進，和波源再也沒有關係。
    //   te  發出的時刻
    //   c   **發出時波源的位置**——圓形波畫面裡它就是圓心，留在原地不動
    //   r   v × (t − te)，波前的半徑
    //   x   c + side × r，波前與軸的交點。一維的繩波畫面量的是這一個，
    //      所以它和改版前是同一個數字，λ′ 與卡片完全沒動。
    const fronts = [];   // 所有發出去的波前（圓），不管它切不切得到繩子那一小段
    const crests = [];   // 其中切得到的那幾條（一維畫面與 λ′ 量的就是這一組）
    const nmax = Math.ceil(f * t) + 2;
    let prev = null, pair = null;
    for (let n = 0; n <= nmax; n++) {
        const te = (Math.PI / 2 + 2 * Math.PI * n) / w;
        if (te > t) break;
        const c = xsrc(te);
        const r = DOP_V * (t - te);
        const x = c + side * r;
        const fd = { te, c, x, r };
        fronts.push(fd);
        // ⚠️ 下面這一條過濾是**一維的**：只留「會切到畫面上那段繩子」的波前。
        //    二維的水塘不能用它——圓心在 c、半徑 r 的圓，右交點已經跑到
        //    8.6 m 外面去了，左半邊卻還在水塘裡泡著。少了 fronts 這一組，
        //    圓形波畫面上只會剩下兩三條小弧，擠壓效果完全不見，
        //    而每一個數值斷言都還是綠的。
        if (x < -0.6 || x > TS.ROPE_M + 0.6) continue;
        crests.push(fd);
        if (prev != null && prev.x <= xo && xo <= fd.x) pair = [prev, fd];
        prev = fd;
    }
    if (!pair && crests.length >= 2) {
        // 觀察者落在所有波峰的同一側（前幾個週期一定會這樣）——取最靠近
        // 它的那一對，至少括號還畫得出來。
        const a = crests.length - 2;
        pair = (Math.abs(crests[1].x - xo) < Math.abs(crests[a].x - xo))
            ? [crests[0], crests[1]] : [crests[a], crests[a + 1]];
    }
    const lam = pair ? Math.abs(pair[1].x - pair[0].x) : lamAnalytic;

    // 波峰穿過觀察者的頻率——**完全沒有用到都卜勒公式**的第二次量測：
    // 相鄰兩個波峰相距 lam，而它們和觀察者的相對速度是「波峰的速度
    // 剪掉觀察者的速度」。除出來就是觀察者實際收到的頻率。
    // ⚠️ 分母不能寫成波峰的速度（DOP_V）——觀察者移動時波峰間距沒變，
    //    變的正是這個相對速度；寫錯的話卡片會顯示 f 而不是 f′。
    const vObs = panel.mode === 'observer' ? panel.vo : 0;
    const cross = lam > 1e-9 ? Math.abs(side * DOP_V - vObs) / lam : 0;

    return {
        xs, xo, side, fObs, lam, lamAnalytic, pair, crests, fronts, cross, approach,
        note: panel.mode === 'source'
            ? (approach ? '波源正在靠近 → 波峰被擠密 → 音調變高'
                        : '波源正在遠去 → 波峰被拉疏 → 音調變低')
            : (panel.vo === 0 ? '觀察者靜止 → 聽到原本的頻率'
                : approach ? '觀察者正在靠近 → 每秒撞到更多波峰 → 音調變高'
                           : '觀察者正在遠去 → 每秒撞到的波峰變少 → 音調變低'),
    };
}

// 徽章靠邊時要換對齊方式，否則會整塊被畫布裁掉（而且不會有任何錯誤訊息）。
function badgeAt(p, view, TS, xm, y, text, o) {
    const a = xm < 1.6 ? 'left' : xm > 6.4 ? 'right' : 'center';
    TS.valueBadge(p, view, TS.ropeX(view, xm), view.toScreenY(y), text,
        Object.assign({ align: a, size: 15 }, o));
}

// --------------------------------------------------------------------------
// 畫面 A：橫波波形（一條繩子）
// --------------------------------------------------------------------------
function drawRopeWave(p, view, t, panel, m) {
    const TS = WaveScene;
    const f = panel.f, w = TS.omega(f);

    // --- 波場 ----------------------------------------------------------
    // 波源移動：每一點的位移是「波源在較早的時刻發出的值」。
    // 觀察者移動：波源沒動，整條繩子就是一條普通的行進波。
    const fn = panel.mode === 'source'
        ? TS.movingSource({ A: DOP_A, omega: w, v: DOP_V, vs: panel.vs, x0: DOP_X0 })
        : TS.traveling({
            A: DOP_A, k: TS.waveNumber(f, DOP_V), v: DOP_V,
            dir: -1, x0: DOP_OSRC,
          });

    // --- 波峰線 --------------------------------------------------------
    // 一個波峰在第 n 個「波源位移最大」的時刻 tₙ 被發出來，位置是
    // 波源當時的位置；之後它就自己以 v 前進，跟波源再也沒有關係。
    // 這條式子不必另外假設「頻率會變」——擠密與拉疏全部從這裡掉出來。
    for (const fd of m.crests) {
        const sx = TS.ropeX(view, fd.x);
        const ctx = p.drawingContext;
        // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
        p.push();
        ctx.setLineDash([view.len(6, 3), view.len(6, 3)]);
        p.stroke(251, 191, 36);
        p.strokeWeight(view.len(2.5, 1.5));
        p.line(sx, view.toScreenY(DOP_LINE_T), sx, view.toScreenY(DOP_LINE_B));
        p.pop();
    }

    TS.drawBaseline(p, view, DOP_ROPE_Y);

    // 取樣密度跟著**最短的波長**走。波源移動時前方的 λ′ = (v − vs)/f
    // 最短；觀察者移動時介質裡的波長不變，還是 v/f。
    const vsEff = panel.mode === 'source' ? panel.vs : 0;
    const pts = TS.sample(fn, 0, TS.ROPE_M, t,
        Math.max(0.2, (DOP_V - vsEff) / f));
    TS.drawWave(p, view, pts, {
        baseY: DOP_ROPE_Y, ampScale: DOP_AMP_C,
        color: [37, 99, 235], weight: 4,
    });
    TS.drawBeads(p, view, fn, t, {
        baseY: DOP_ROPE_Y, ampScale: DOP_AMP_C, n: DOP_BEADS,
        color: [147, 197, 253], radius: 4,
    });

    // --- 觀察者附近的波長（直接量相鄰兩條波峰線的距離）----------------
    // ⚠️ 不可以用 λ = v / f′。觀察者移動時介質裡的波長**根本沒變**，
    //    v/f′ 只有在波源移動時才等於波長。量波峰線兩個模式都對。
    //    （兩端用的是波前與軸的交點 x，所以兩種畫面量到的是同一段長度。）
    if (m.pair) {
        TS.wavelengthBracket(p, view, m.pair[0].x, m.pair[1].x, DOP_RAIL_Y,
            `觀察者附近 λ′ = ${m.lam.toFixed(2)} m`,
            { size: 15, color: [217, 119, 6] });
    }

    // 波源坐在繩子上，y 由波形決定——交給 drawMarkers 畫。
    drawMarkers(p, view, m, panel,
        { srcY: TS.laneY(DOP_ROPE_Y, DOP_AMP_C, fn(m.xs, t)),
          tick: [DOP_ROPE_Y + 60, DOP_LINE_T] });
}

// --------------------------------------------------------------------------
// 畫面 B：圓形波（水塘，由上往下看）
// --------------------------------------------------------------------------

// 圓心在 (c, 軸上)、半徑 r 公尺的那個圓，有沒有一段弧落在水塘裡？
//   整條圓落在水塘外面 → 看不到（半徑還太小）
//   整條圓把水塘整個包住 → 也看不到（弧在水塘外面，水塘在圓裡面）
// 兩個條件都要問——判準本身住在 wave-scene.js 的 `circleCrossesRect`，
// 33 音爆的航線圖用的是同一支（幾何只能有一個家）。
//
// ⚠️ 這一支是**純幾何、不需要 view**，驗證器才進得去；
//    它吃的公尺數就是 `fronts[i].c` 與 `fronts[i].r`，和畫圓用的是同一組數字。
function frontInPool(c, r) {
    const TS = WaveScene;
    return TS.circleCrossesRect(
        DOP_X0 + c * TS.X_SCALE,                 // 圓心的世界 x
        DOP_ROPE_Y,                              // 圓心在水塘的中心線上
        r * TS.X_SCALE,                          // 半徑的世界長度
        DOP_X0, DOP_POOL_T,                      // 水塘左右緣與上下緣
        DOP_X0 + TS.ROPE_M * TS.X_SCALE, DOP_POOL_B);
}

function drawWavefronts(p, view, t, panel, m) {
    const TS = WaveScene;
    const x0 = TS.ropeX(view, 0), x1 = TS.ropeX(view, TS.ROPE_M);
    const y0 = view.toScreenY(DOP_POOL_T), y1 = view.toScreenY(DOP_POOL_B);
    const bw = x1 - x0, bh = y1 - y0;
    const cy = view.toScreenY(DOP_ROPE_Y);

    p.noStroke();
    p.fill(241, 245, 249);
    p.rect(x0, y0, bw, bh);

    // 圓形波是大圓，不裁的話會壓到兩顆徽章和底部那行大字上面。
    // （view.clip() 只裁到世界矩形，水塘比世界小。）
    const ctx = p.drawingContext;
    // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
    p.push();
    ctx.beginPath();
    ctx.rect(x0, y0, bw, bh);
    ctx.clip();

    // 波源行進的路線
    ctx.setLineDash([view.len(7, 4), view.len(7, 4)]);
    p.stroke(148, 163, 184);
    p.strokeWeight(view.len(2, 1));
    p.line(x0, cy, x1, cy);
    ctx.setLineDash([]);

    // 波前。**每一個圓的圓心都留在它被發出的地方**——波源往前走，只是把
    // 後來的圓心往前挪；先發出去的那幾個圓不會跟著它跑。整個都卜勒效應
    // 就長在這一行：圓心不動、而發出圓的位置一直在往前，前面就擠、後面就疏。
    // ⚠️ 圓心寫成 m.xs（波源現在的位置）的話，畫面上會是一組漂亮的同心圓，
    //    看起來完全正常，而擠壓效果整個不見。verify-waves.js ⑱(g) 在守這個。
    p.noFill();
    p.stroke(251, 191, 36);
    p.strokeWeight(view.len(3, 2));
    // ⚠️ 這裡要吃 **fronts**（每一條發出去的波前），不是 crests（切得到繩子
    //    那一小段的那幾條）。用 crests 的話，圓心在 4.2 m、半徑 5.5 m 的那條
    //    大圓會被丟掉——它的右交點已經超過 8.6 m，左半邊卻還在水塘裡。
    //    症狀是畫面上只剩兩三條小弧，擠壓完全不見，而所有數值斷言全綠。
    for (const fd of m.fronts) {
        if (!frontInPool(fd.c, fd.r)) continue;
        // 直徑用 view.len() 不給像素下限：圓心與半徑必須共用同一個 scale，
        // 給了下限就會變成「半徑用一個尺度、圓心用另一個」的橢圓。
        p.circle(TS.ropeX(view, fd.c), cy, 2 * view.len(fd.r * TS.X_SCALE));
    }

    // λ′ 括號畫在**軸線上**——波前與軸的交點就在那裡，括號的兩端真的落在
    // 前後兩個圓上。畫在高處（DOP_RAIL_Y）的話兩端會浮在圓弧之間的空氣裡，
    // 等於在量一段不存在的距離。標籤在線的上方（wavelengthBracket 的預設）。
    // ⚠️ 這一支排在 drawMarkers 之前畫，否則波源追過觀察者那一刻（t ≈ 3.3 s）
    //    括號的白底牌會蓋掉波源。
    if (m.pair) {
        TS.wavelengthBracket(p, view, m.pair[0].x, m.pair[1].x, DOP_ROPE_Y,
            `觀察者附近 λ′ = ${m.lam.toFixed(2)} m`,
            { size: 15, color: [217, 119, 6] });
    }
    p.pop();

    // 水塘的邊框（在裁切之外畫，框線才不會被裁掉一半）
    p.noFill();
    p.stroke(15, 23, 42);
    p.strokeWeight(view.len(3, 2));
    p.rect(x0, y0, bw, bh);

    // 波源走在水面上，y 固定在中心線。
    drawMarkers(p, view, m, panel, { srcY: DOP_ROPE_Y, tick: null });
}

// --------------------------------------------------------------------------
// 兩種畫面共用的標記：波源、觀察者、兩顆徽章、底部那行大字
// --------------------------------------------------------------------------
function drawMarkers(p, view, m, panel, o) {
    const TS = WaveScene;
    const f = panel.f;

    // --- 波源 ------------------------------------------------------------
    const sxS = TS.ropeX(view, m.xs);
    const syS = view.toScreenY(o.srcY);
    p.noStroke();
    p.fill(30, 41, 59);
    p.circle(sxS, syS, view.len(26, 12));
    p.fill(255);
    p.circle(sxS, syS, view.len(10, 5));

    // 波源的位置標線（只有繩波畫面用得到：一條往下指到繩子的短虛線）
    if (o.tick) {
        const ctx = p.drawingContext;
        // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
        p.push();
        ctx.setLineDash([view.len(5, 3), view.len(5, 3)]);
        p.stroke(30, 41, 59);
        p.strokeWeight(view.len(2, 1));
        p.line(sxS, view.toScreenY(o.tick[0]), sxS, view.toScreenY(o.tick[1]));
        p.pop();
    }

    badgeAt(p, view, TS, m.xs, DOP_SRC_Y,
        panel.mode === 'source'
            ? `波源 F = ${f.toFixed(2)} Hz　${panel.vs.toFixed(1)} m/s →`
            : `波源 F = ${f.toFixed(2)} Hz　固定不動`,
        { stroke: [30, 41, 59], fillColor: [30, 41, 59] });

    // --- 觀察者 ----------------------------------------------------------
    const sxO = TS.ropeX(view, m.xo);
    const syO = view.toScreenY(DOP_ROPE_Y);
    p.noStroke();
    p.fill(239, 68, 68);
    p.triangle(sxO, syO + view.len(62, 28),
               sxO - view.len(20, 10), syO + view.len(94, 42),
               sxO + view.len(20, 10), syO + view.len(94, 42));
    p.stroke(239, 68, 68);
    p.strokeWeight(view.len(4, 2));
    p.line(sxO, syO - view.len(96, 44), sxO, syO + view.len(62, 28));
    p.noStroke();

    badgeAt(p, view, TS, m.xo, DOP_OBS_Y,
        `觀察者聽到 F′ = ${m.fObs.toFixed(2)} Hz（F 的 ${(m.fObs / f).toFixed(2)} 倍）`,
        { stroke: [239, 68, 68], fillColor: [185, 28, 28] });

    // --- 這一行是兩個模式的分界線 -----------------------------------------
    p.noStroke();
    const noteCol = m.approach ? [185, 28, 28] : [100, 116, 139];
    p.fill(noteCol[0], noteCol[1], noteCol[2]);
    p.textSize(view.len(20, 11));
    p.textStyle(p.BOLD);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(m.note, view.toScreenX(TS.WORLD_W / 2), view.toScreenY(DOP_NOTE_Y));
}

function initDoppler() {

    WaveScene.run({

        formula: 'f\' = f \\cdot \\frac{v}{v \\mp v_s}',
        formulaFallback: 'f′ = f · v / (v ∓ vs)　（波源移動）',

        controls: {
            selects: [
                {
                    key: 'mode', label: '誰在動？', def: 'source',
                    options: [
                        { v: 'source',   t: '波源移動（手一邊抖一邊跑）' },
                        { v: 'observer', t: '觀察者移動（手不動，人跑）' },
                    ],
                },
                {
                    key: 'view', label: '畫面', def: 'rings',
                    options: [
                        { v: 'rings', t: '圓形波（水波，由上往下看）' },
                        { v: 'rope',  t: '橫波波形（一條繩子）' },
                    ],
                },
            ],
            sliders: [
                { key: 'f',  label: '波源抖動的頻率 <i>f</i>', unit: 'Hz',
                  min: DOP_F_MIN, max: DOP_F_MAX, step: 0.05, def: DOP_F_DEF },
                { key: 'vs', label: '波源的速率 <i>v<sub>s</sub></i>', unit: 'm/s', min: 0, max: 1.5, step: 0.1, def: 1.5, dec: 1 },
                { key: 'vo', label: '觀察者的速率 <i>v<sub>o</sub></i>（正＝靠近）', unit: 'm/s', min: -1.5, max: 1.5, step: 0.1, def: 1.0, dec: 1 },
            ],
        },

        cards: [
            { label: '時間',                 id: 'cardTime',  unit: 's',   highlight: true },
            { label: '觀察者聽到的頻率 F′',   id: 'cardFp',    unit: 'Hz',  highlight: true },
            { label: '波源發出的頻率 F',      id: 'cardF',     unit: 'Hz' },
            { label: 'F′ ÷ F',               id: 'cardRatio', unit: '倍' },
            { label: '波速 V（介質決定）',    id: 'cardV',     unit: 'm/s' },
            { label: '波源速率 vs',           id: 'cardVs',    unit: 'm/s' },
            { label: '觀察者速率 vo',         id: 'cardVo',    unit: 'm/s' },
            { label: '觀察者附近的波長 λ′',   id: 'cardLam',   unit: 'm' },
            { label: '波峰經過觀察者的頻率',  id: 'cardCross', unit: 'Hz' },
        ],

        values(t, panel) {
            const m = model(t, panel);
            return {
                cardTime:  t.toFixed(2),
                cardFp:    m.fObs.toFixed(2),
                cardF:     panel.f.toFixed(2),
                cardRatio: (m.fObs / panel.f).toFixed(2),
                cardV:     DOP_V.toFixed(2),
                cardVs:    (panel.mode === 'source' ? panel.vs : 0).toFixed(1),
                cardVo:    (panel.mode === 'observer' ? panel.vo : 0).toFixed(1),
                cardLam:   m.lam.toFixed(2),
                // 這張卡片是**獨立量出來的**：直接數波峰多久穿過觀察者一次，
                // 完全沒有用到都卜勒公式。它和 F′ 一致，才證明畫面上的波峰
                // 真的就是那個頻率。（verify-waves.js 兩條都斷言。）
                cardCross: m.cross.toFixed(2),
            };
        },

        titleText(t, panel) {
            const m = model(t, panel);
            const rings = panel.view === 'rings';
            const waveName = rings ? '波前' : '波峰線';
            const base = (DOP_V / panel.f).toFixed(2);

            if (t < 0.1) {
                if (rings) {
                    return panel.mode === 'source'
                        ? '按下開始——波源一邊抖一邊往右走。每一個圓的圓心都留在它被發出的地方'
                        : `按下開始——波源固定在 ${DOP_OSRC} m 抖，一個一個圓從它身上擴散出去。`
                          + '盯住觀察者撞到圓弧的速率';
                }
                return panel.mode === 'source'
                    ? '按下開始——手一邊抖一邊沿著繩子往右跑。盯住波峰線被擠密的那一段'
                    : `按下開始——手固定在 ${DOP_OSRC} m 抖。注意繩子上的波峰間距從頭到尾沒變，`
                      + `變的是觀察者撞到它們的速率`;
            }
            if (panel.mode === 'source') {
                return m.side > 0
                    ? `波源朝觀察者靠近：它追著自己發出的${waveName}跑，${waveName}被擠到 λ′ = ${m.lam.toFixed(2)} m`
                      + `（原本 ${base} m），觀察者聽到 ${m.fObs.toFixed(2)} Hz 比 ${panel.f.toFixed(2)} Hz 高`
                    : `波源離觀察者遠去：${waveName}被它自己甩開、拉疏成 λ′ = ${m.lam.toFixed(2)} m`
                      + `（原本 ${base} m），觀察者聽到 ${m.fObs.toFixed(2)} Hz 比 ${panel.f.toFixed(2)} Hz 低`;
            }
            // ⚠️ 標題列是 canvas 上的一行純文字，不是 markdown——寫 `**粗體**`
            //    的話那四個星號會**原樣畫在畫面上**。
            return m.approach
                ? `觀察者朝波源靠近：${rings ? '水面上的圓' : '繩子上的波峰'}間距完全沒變（還是 ${base} m），`
                  + `但它每秒撞到更多${waveName} → 聽到 ${m.fObs.toFixed(2)} Hz`
                : `觀察者離波源遠去：${rings ? '水面上的圓' : '繩子上的波峰'}間距完全沒變（還是 ${base} m），`
                  + `但它每秒撞到的${waveName}變少 → 聽到 ${m.fObs.toFixed(2)} Hz`;
        },

        draw(p, view, t, panel) {
            const m = model(t, panel);
            if (panel.view === 'rope') drawRopeWave(p, view, t, panel, m);
            else                      drawWavefronts(p, view, t, panel, m);
        },
    });

}

initDoppler();

// 匯出這一頁的常數，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    DOP_ROPE_Y, DOP_AMP_C, DOP_A, DOP_BEADS,
    DOP_LINE_T, DOP_LINE_B, DOP_RAIL_Y, DOP_SRC_Y, DOP_OBS_Y, DOP_NOTE_Y,
    DOP_POOL_T, DOP_POOL_B,
    DOP_V, DOP_X0, DOP_OBS, DOP_OSRC, DOP_OVO_X0,
    DOP_F_MIN, DOP_F_MAX, DOP_F_DEF,
    // 這一頁的物理：卡片、畫面、標題列共用同一個 model()，驗證器也讀它。
    model,
    // 「這個圓在水塘裡看不看得到」——畫圓的地方與驗證器讀的是同一支。
    frontInPool,
};
