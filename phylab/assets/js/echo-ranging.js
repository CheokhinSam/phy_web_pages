/**
 * 🔊 回聲測距 — 車一邊前進、聲音一邊去撞山壁再彈回來
 *
 * 這一頁在回答一個很常見、而學生幾乎都會算錯的問題：
 *
 *   車以 v 前進，鳴笛之後經過 t 聽到山壁的回聲——鳴笛的地方離山壁多遠？
 *
 * 第一個反射動作是 s = c·t（聲音走的路），錯；第二個是 s = c·t ÷ 2，也錯
 * ——因為**聲音出發之後車還在走**，回程的終點不是鳴笛點，是車往前跑到的
 * 新位置。課本那一行 2s = (c+v)t 對學生來說是憑空出現的，這一頁把它拆成
 * 畫面上三個看得見的量：
 *
 *   1. 聲音走的總路程 = 去程 + 回程（車一直往前，所以回程比去程短）
 *   2. 車走的路程（同一個 t 之內，車也在走）
 *   3. 兩者相加剛好是 2s（鳴笛點到山壁的兩倍）——這就是那條式子
 *
 * 畫面上只有一塊，而且**橫軸只有一把尺**（公尺 → 世界 x 只算一次）：
 *   ① 車與聲音：車在路上走；聲音畫成**一條**箭頭——從鳴笛點出發（上面那條
 *      軌）、碰到山壁折返（在牆邊轉一個彎）、再沿下面那條軌往車的方向回頭。
 *      尖端釘在回音的前緣上，所以整條的**總長**就是「聲音走過的總路程」c·t
 *   ② 車自己的速度：車頂上方一支深色箭頭——方向是行進方向、長度跟著車速
 *   ③ 各段距離：三條尺，一條對一個量。回程那一條的左端永遠貼著回音的前緣，
 *      它與車之間的縫在**聽到回聲的那一刻剛好閉合**
 *
 *    lane 上的箭頭、路面那把尺、底下三條距離尺全部問同一支 `erWorldX`——
 *    「上下對齊」看得出來就是靠這個。
 *
 * ⚠️ 這一頁**不畫位置－時間圖**（2026-10-15 依使用者指示移除）。原本下半邊
 *    那張 s-t 圖（車的陡線與聲音的 Λ 的交點）對八年級的聲現象單元是多的：
 *    圖上每一個數字都對，但它要教的那件事——**聲音走了多久、車同時走了多遠**
 *    ——箭頭與三條尺當場就講完了。空出來的下半邊還給路面與距離尺，
 *    整塊場景重新配過（lane 236、路面 470、三條尺 600／674／748）。
 *
 * ⚠️ **一條式子涵蓋兩個題型。** 山壁固定在 x = s₀、車在 t = 0 於 x = 0、
 *    沿 +x 以 u 前進：駛向山壁 u = +v、駛離山壁 u = −v。於是
 *
 *        聲音撞壁 t₁ = s₀ / c（與車無關）　回程波前 x = 2s₀ − c·t
 *        聽到回聲 2s₀ − c·t = u·t　⟹　t = 2s₀ / (c + u)
 *
 *    u = +v 就是課本的 2s = (c+v)t、u = −v 是 2s = (c−v)t。**符號就是方向**，
 *    不需要兩套程式——兩個題型共用同一個引擎，畫面才不會各說各話。
 *
 * ⚠️ **車與山壁是圖示，不按比例**（4.5 公尺的車在 360 公尺的尺上只有 11 個
 *    世界單位，會變成一顆灰點）。按比例的只有兩樣：車的**位置**與那兩條
 *    距離尺——被量的東西才需要誠實。
 *
 * ⚠️ **聲音的原點釘在鳴笛點，不是跟著車跑。** 這是學生的頭號誤解，所以
 *    箭頭是從「鳴笛那一刻車所在的位置」往外跑的；畫面上車與箭頭從第一格
 *    就分家，往後只會愈離愈遠。
 *
 * 場景骨架（面板、卡片、底部標題列、p5 生命週期）在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面（世界單位，跟 wave-scene.js 同一組 1000×900）
// ==========================================================================
const ER_WORLD_W = 1000, ER_WORLD_H = 900;   // 世界尺寸（夾住標籤用）
const ER_XL = 60;            // 橫軸的左端（尺與 lane 共用）
const ER_XR = 940;           // 橫軸的右端（山壁永遠站在這裡）
const ER_LANE_Y = 236;       // 聲音那條 lane 的基線＝箭頭的中心線
const ER_LANE_H = 26;        // 箭頭的半高（lane 那條帶子量到這裡）
const ER_ROAD_Y = 470;       // 路面
const ER_ROAD_H = 14;        // 路面的厚度
const ER_TICK_Y = 516;       // 路面那把尺的刻度數字
const ER_BAR1_Y = 600;       // 距離尺第一列：聲音去程
const ER_BAR2_Y = 674;       // 距離尺第二列：回程
const ER_BAR3_Y = 748;       // 距離尺第三列：車走的
const ER_BAR_H = 20;         // 距離尺的厚度
const ER_CAR_LEN = 78;       // 車的圖示長度（不按比例，見檔頭）

const ER_C_SOUND = 340;      // 聲速（m/s）——這一頁唯一的物理常數，不給滑桿
const ER_V_MIN = 0, ER_V_MAX = 80, ER_V_DEF = 20;        // 車速
const ER_S0_MIN = 100, ER_S0_MAX = 600, ER_S0_DEF = 360; // 鳴笛點距山壁

// 聲音那條箭頭走**兩條軌**：去程在上面、回程在下面，牆邊用一個半圓彎接起來
// （彎的頂點剛好碰到岩面——那就是「反彈」）。兩條軌各離中線 ER_TRACK_DY。
const ER_TRACK_DY = 7;                   // 世界單位

// 車的速度箭頭（畫在車頂上方）。長度 ∝ v、封頂——車速愈大那支愈長。
// ⚠️ 這個長度是**世界單位**（看螢幕的圖示，不是物理量），繪圖端只透過
//    `view.len()` 把它換成像素——它不跟任何公尺比大小。
// ⚠️ PER 與 MAX 是**成對**的：兩者相除就是封頂的車速（這裡是 75 m/s）。
//    車速的上限 2026-10-15 從 40 改成 80 時兩個一起調過——沿用舊的
//    2.0／72 的話，v 超過 36 之後箭頭就不再長了，滑桿上半段整段是死的
//    （「車速愈大它就愈長」在畫面上讀不出來）。現在 0→75 一路在長，
//    75→80 才封頂。驗證器 ㊳(i) 有兩條在守這個比例：封頂要頂得到、
//    而且不准太早封頂。
const ER_CAR_ARROW_Y = 400;              // 那支箭頭的 y（世界）
const ER_CAR_ARROW_PER = 1.6;            // 每一 (m/s) 畫幾個世界單位
const ER_CAR_ARROW_MAX = 120;            // 長度上限（世界單位）——封頂在 75 m/s
// 駛離山壁時車會退到整個場景的最左邊，而那支箭頭還要從車往左伸出去。
// 這是**留給它的邊界**（世界單位，`erScale` 據此把橫軸的左端再推出去）：
// 見 erScale 的 ⚠️。
const ER_CAR_PAD = 12;

// 刻度的階梯。挑「螢幕上還看得見」的最小一級——同一招用在 09 拋體的格線。
const ER_GRID_LADDER = [5, 10, 20, 50, 100, 200];

// ==========================================================================
// 純物理：全部只吃數字、只回傳數字（Node 可以直接餵它，見 verify-waves.js ㊳）
// ==========================================================================

/** 車沿「朝向山壁」的速度分量 u：駛向 +v、駛離 −v。**符號就是方向。** */
function erCarVel(v, dir) { return dir === 'away' ? -v : v; }

/** 聲音撞到山壁的時刻。**與車無關**——聲音走的就是 s₀ 這一段。 */
function erWallTime(s0) { return s0 / ER_C_SOUND; }

/** 聽到回聲的時刻：2s₀ − c·t = u·t 的解。 */
function erEchoTime(s0, v, dir) { return 2 * s0 / (ER_C_SOUND + erCarVel(v, dir)); }

/**
 * 這一組參數的橫軸要涵蓋多大的範圍。
 *
 * 車走 0 → u·T、聲音走 0 → s₀ → u·T，所以場景是 [min(0, uT), s₀]。
 * 駛向時 uT > 0，左端就是鳴笛點；駛離時車往左退 uT < 0，左端跟著推出去。
 * **整個尺度是從這裡推出來的**，畫面與驗證器問的是同一組數字。
 *
 * ⚠️ **駛離時左端要多推出去一段——那一段是留給車頂那支速度箭頭的。**
 *    駛離時 xMin 逐位等於車的位置（車退到整個場景的最左邊），而箭頭還要
 *    從車再往左伸 ER_CAR_ARROW_MAX——不推的話箭尖會伸到世界矩形外面，
 *    被 `view.clip()` 切平（v = 40 時箭尖在世界 −12）。**卡片上的每一個
 *    數字都還是對的**（沒有任何斷言在問畫布邊界），只有截圖看得出來：
 *    那顆箭頭看起來像被剪刀剪掉。
 *
 *    推的距離是解的，不是估的：令箭尖落在 `ER_CAR_PAD`（離世界矩形左緣），
 *    需要車落在世界 `ER_XL + need`（need = MAX + PAD − ER_XL）——
 *    把 xMin 再往左推 d 公尺，車的世界座標就是 `ER_XL + d·pxPerM`，
 *    而 pxPerM = 880/(Δ+d)（Δ 是原來的跨距），解得 d = need·Δ/(880 − need)。
 *    這樣車永遠落在世界 `ER_XL + need`、箭尖永遠落在 `ER_CAR_PAD`，
 *    **與 v 無關**（需要留的空間是「最大那支」的，不是「現在這支」的）
 *    ——不然拉滑桿時整個場景會跟著箭頭一起呼吸。
 */
function erScale(s0, v, dir) {
    const u = erCarVel(v, dir);
    const T = erEchoTime(s0, v, dir);
    let xMin = Math.min(0, u * T);
    const xMax = Math.max(s0, u * T);
    if (u * T < 0) {
        const need = ER_CAR_ARROW_MAX + ER_CAR_PAD - ER_XL;      // 世界單位
        xMin -= need * (xMax - xMin) / (ER_XR - ER_XL - need);
    }
    const pxPerM = (ER_XR - ER_XL) / (xMax - xMin);
    return { u: u, T: T, xMin: xMin, xMax: xMax, pxPerM: pxPerM };
}

/** 公尺 → 世界 x。**橫軸只有這一個家**：lane、路面那把尺、格線全部問它。 */
function erWorldX(xm, sc) { return ER_XL + (xm - sc.xMin) * sc.pxPerM; }

/**
 * 這一刻的所有狀態。t 先夾進 [0, T]——聽到回聲之後整個畫面就停在那一刻，
 * 回程的波前不會繞過車子繼續往左跑（那會是「已經聽到了還在走」的假畫面）。
 */
function erState(s0, v, dir, t) {
    const sc = erScale(s0, v, dir);
    const t1 = erWallTime(s0);
    const tc = t < 0 ? 0 : (t > sc.T ? sc.T : t);
    const carX = sc.u * tc;                        // 車的位置（公尺）
    const frontX = tc <= t1 ? ER_C_SOUND * tc      // 回音的前緣
                            : 2 * s0 - ER_C_SOUND * tc;
    return {
        t: tc, T: sc.T, t1: t1, u: sc.u, sc: sc,
        carX: carX,
        carDist: Math.abs(carX),                   // 車走了多遠
        soundLen: ER_C_SOUND * tc,                 // 聲音走的**總**路程
        outLen: s0,                                // 去程（固定）
        backLen: tc <= t1 ? 0 : ER_C_SOUND * (tc - t1),   // 回程已經走了
        frontX: frontX,
        gap: s0 - carX,                            // 車距山壁（聽到時就是答案）
        heard: t >= sc.T,
    };
}

/**
 * 聲音畫成**一條**箭頭：鳴笛點 → 山壁 → 回音的前緣。
 *
 * 尖端釘在 `erState` 的前緣上（不自己算位置），所以兩段的長度加起來逐位等於
 * c·t——「聲音走過的總路程」在畫面上就是這條線的長度。撞壁前是一段直線，
 * 撞壁後折成兩段：`out` 永遠停在 [0, s₀]（去程是既成事實了），`back` 從
 * 山壁長出來、一路縮到車上（聽到的那一刻 `back` 的終點 = 車的位置）。
 *
 * ⚠️ 回傳的是**公尺**（去程 0 → 山壁、回程由山壁回來）。兩條軌的上下偏移、
 *    牆邊那個半圓彎，都是繪圖端（`erDrawSoundArrow`）的事——這一支只回答
 *    「聲音走到哪了、路的形狀長怎樣」。抽成純函式是為了讓驗證器餵得進來
 *    （見 verify-waves.js ㊳）。
 */
function erSoundArrow(s0, v, dir, t) {
    const st = erState(s0, v, dir, t);
    const back = st.t > st.t1 + 1e-9;
    const legs = [{ leg: 'out', x0: 0, x1: back ? s0 : st.frontX }];
    if (back) legs.push({ leg: 'back', x0: s0, x1: st.frontX });
    return { legs: legs, tip: st.frontX, tipDir: back ? -1 : 1, total: st.soundLen };
}

/**
 * 車的速度箭頭：方向＝行進方向（駛向 +1、駛離 −1），長度 = PER × v、封頂。
 *
 * ⚠️ 這個長度是**世界單位**（看螢幕的圖示，不是物理量）：繪圖端只透過
 *    `view.len()` 把它換成像素，不跟任何公尺比大小。v = 0 時長度就是 0，
 *    繪圖端據此不畫——車沒動就沒有東西好指。
 */
function erCarArrow(v, dir) {
    return { dir: dir === 'away' ? -1 : 1,
             len: Math.min(v * ER_CAR_ARROW_PER, ER_CAR_ARROW_MAX) };
}

/** 公尺刻度的間距：螢幕上至少 minU 個世界單位才畫一級（不然會糊成一條尺）。 */
function erGridStep(spanM, worldW, minU) {
    for (const st of ER_GRID_LADDER) if (st / spanM * worldW >= minU) return st;
    return ER_GRID_LADDER[ER_GRID_LADDER.length - 1];
}

/** 刻度編號要不要每隔一格才寫（寫滿會擠成一排數字）。 */
function erLabelEvery(spacing, minU) { return spacing >= minU * 1.6 ? 1 : 2; }

/**
 * 一串字的保守寬度（螢幕像素）。
 *
 * ⚠️ 這一支是**給「放不放得下」用的**，所以刻意估得比真的寬：全形 1 em、
 *    其他 0.62 em、空白 0.35 em。畫得下才畫的判準吃它，估寬一點只是偶爾
 *    少寫一個數字，估窄了就是**文字伸出尺外被裁掉**（見 README 陷阱二十）。
 */
function erTextW(s, size) {
    let w = 0;
    for (const ch of String(s)) {
        const c = ch.codePointAt(0);
        w += ch === ' ' ? 0.35 : (c > 0x2e80 ? 1 : 0.62);
    }
    return w * size;
}

/** 這一條尺上面寫得下這個數字嗎（都在螢幕像素裡量）。 */
function erBarFits(text, widthPx, sizePx) {
    return widthPx >= erTextW(text, sizePx) + 6;
}

// ==========================================================================
// 繪圖。所有座標都在世界單位裡算，換算成螢幕只在 SX / SY / WX 幾支裡發生。
// ==========================================================================

/** 世界座標的文字。size 與 min 都是像素（min 是最窄尺度下的下限）。 */
function erLabel(p, view, wx, wy, text, o) {
    o = o || {};
    p.noStroke();
    p.fill(o.col || [100, 116, 139]);
    p.textSize(view.len(o.size || 15, o.min || 8));
    p.textStyle(p.BOLD);
    p.textAlign(o.align || p.LEFT, p.CENTER);
    p.text(text, view.toScreenX(wx), view.toScreenY(wy));
}

/**
 * 置中的文字，但**夾在世界矩形裡面**。
 *
 * ⚠️ 這一支是為了「錨點跟著會跑的物件」而寫的：車與回聲都在畫面裡移動，
 *    最窄的那個尺度（850×314，世界只剩 349 px 寬）下，一顆置中標籤只要
 *    靠近左右緣就會伸出去被 `view.clip()` 切掉一角，而**畫面上只是少了一
 *    兩個字**。夾住之後「標籤黏在物件旁邊」自動變成「離邊緣還有半個字寬」。
 */
function erCentered(p, view, sx, sy, text, o) {
    o = o || {};
    p.noStroke();
    p.textSize(view.len(o.size || 14, o.min || 8));
    p.textStyle(p.BOLD);
    const w = p.textWidth(text);
    // 白底比字再寬一點，所以**夾的邊界要跟著它算**——用字寬去夾的話，
    // 白底會從世界矩形的左／右緣伸出去一截（只有最窄的尺度看得出來）。
    const half = (o.box ? w + view.len(16, 6) : w) / 2;
    const l = view.toScreenX(0) + half + 4;
    const r = view.toScreenX(ER_WORLD_W) - half - 4;
    const x = Math.min(Math.max(sx, l), Math.max(r, l));
    if (o.box) {                               // 白底標籤（畫在字底下）
        const bw = w + view.len(16, 6), bh = view.len(26, 16);
        p.fill(255, 255, 255);
        p.rect(x - bw / 2, sy - bh / 2, bw, bh);
    }
    p.fill(o.col || [100, 116, 139]);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(text, x, sy);
    return { x: x, w: w };
}

/** 一條橫躺的尺（距離列）。 */
function erBar(p, view, wx0, wx1, wy, col, text) {
    const a = view.toScreenX(wx0), b = view.toScreenX(wx1);
    const h = view.len(ER_BAR_H, 7);
    const y = view.toScreenY(wy);
    p.noStroke();
    p.fill(col[0], col[1], col[2]);
    p.rect(Math.min(a, b), y, Math.abs(b - a), h);
    const size = view.len(13, 8);
    // 只有「整串字真的塞得進去、而且尺夠厚」才寫數字——最窄尺度下寧可留白，
    // 右側卡片本來就有同一組數字。
    if (text && h > size + 1 && erBarFits(text, Math.abs(b - a), size)) {
        p.fill(255, 255, 255);
        p.textSize(size);
        p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(text, (a + b) / 2, y + h / 2);
    }
}

/** 山壁：一條從聲音 lane 上方貫穿到路面下緣的線，加上粗糙的岩面。
 *  ⚠️ 上端停在 lane 上方一點、下端停在路面——**不往下長到距離尺那一帶**
 *  （那裡是量距離的地方，岩面會把三條尺的右端整片蓋掉）。 */
function erCliff(p, view, wx, top, bottom) {
    const x = view.toScreenX(wx);
    const y0 = view.toScreenY(top), y1 = view.toScreenY(bottom);
    p.stroke(120, 113, 108);
    p.strokeWeight(view.len(2, 1));
    p.line(x - view.len(11, 4), y0, x - view.len(11, 4), y1);
    // 岩面：幾個疊起來的三角形。**每一個都自己填色**——填色會漏給下一個
    // 圖元（見 verify-waves.js ⑮），所以不走多邊形路徑，一顆一顆畫。
    const n = 7, step = (y1 - y0) / n;
    p.noStroke();
    for (let i = 0; i < n; i++) {
        const ty = y0 + step * i;
        p.fill(i % 2 ? 168 : 190, i % 2 ? 162 : 184, i % 2 ? 158 : 180);
        p.triangle(x - view.len(12, 4), ty,
                   x - view.len(34, 12), ty + step / 2,
                   x - view.len(12, 4), ty + step);
    }
}

/** 車（圖示，不按比例——按比例的只有它的位置）。dirSign 是車頭朝哪邊。 */
function erCar(p, view, wx, wy, dirSign, heard) {
    const x = view.toScreenX(wx), y = view.toScreenY(wy);
    const L = view.len(ER_CAR_LEN, 30), H = view.len(26, 10);
    const cabW = view.len(42, 16), cabH = view.len(20, 8);
    const w = view.len(15, 6);
    p.noStroke();
    p.fill(51, 65, 85);
    p.quad(x - L / 2, y - w / 2, x + L / 2, y - w / 2,
           x + L / 2 - view.len(7, 3), y - H, x - L / 2 + view.len(7, 3), y - H);
    p.fill(71, 85, 105);
    p.rect(x - cabW / 2, y - H - cabH, cabW, cabH);
    p.fill(30, 41, 59);
    p.circle(x - L * 0.28, y - w / 2, w);
    p.circle(x + L * 0.28, y - w / 2, w);
    p.fill(253, 224, 71);                      // 車頭燈：一看就知道往哪邊開
    p.circle(x + dirSign * (L / 2 - view.len(9, 4)), y - H * 0.55, view.len(9, 4));
    if (heard) {
        p.fill(239, 68, 68);
        p.circle(x + L * 0.36, y - H - cabH - view.len(7, 3), view.len(9, 4));
    }
}

/** 聲音那一條箭頭。這一支只把 erSoundArrow 的結果畫出來（幾何不在這裡）。 */
function erDrawSoundArrow(p, view, arrow, sc) {
    const yOut = view.toScreenY(ER_LANE_Y - ER_TRACK_DY);    // 去程那一條軌（上）
    const yBack = view.toScreenY(ER_LANE_Y + ER_TRACK_DY);   // 回程那一條軌（下）
    const outX = m => view.toScreenX(erWorldX(m, sc));
    const wgt = view.len(3.5, 2);
    const hh = view.len(14, 7);

    // 一段直線（尾巴 → 尖端）＋一顆釘在尖端的箭頭。
    const seg = (x1, x2, y, col) => {
        const d = x2 >= x1 ? 1 : -1;
        const span = Math.abs(x2 - x1);
        // 剛折返的那一瞬間回音很短（它是從壁面長出來的），所以箭尖要跟著縮，
        // 不然「尖端」會退到尾巴的左邊、畫出一支倒過來的箭。**下限**是留給
        // t = 0 那一幀的：那一刻聲音一步都還沒走，留一顆小箭頭釘在鳴笛點上，
        // 學生才看得到「聲音是從這裡出發的」。⚠️ 這條像素下限就是 ㊳(j) 那條
        // 靜態掃描在守的東西（`view.len(8,`）。
        const head = Math.max(Math.min(view.len(20, 10), span * 0.6), view.len(8, 4));
        if (span > head) {
            p.stroke(col[0], col[1], col[2]);
            p.strokeWeight(wgt);
            p.line(x1, y, x2 - d * head, y);
        }
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.triangle(x2, y, x2 - d * head, y - hh, x2 - d * head, y + hh);
    };

    const BLUE = [37, 99, 235], ORANGE = [234, 88, 12];
    const out = arrow.legs[0];
    if (arrow.legs.length === 1) {          // 還沒撞到山壁：一條直線
        seg(outX(out.x0), outX(out.x1), yOut, BLUE);
        return;
    }
    // 撞壁之後：去程那一條停在牆邊，牆前轉一個半圓彎到回程那一條
    // （彎的頂點剛好碰到岩面——那就是「反彈」），回程再往左追車。
    // ⚠️ 岩面那條線的 11 個世界單位偏移要和 erCliff 對齊，不然彎會懸空。
    const wallX = outX(arrow.legs[1].x0) - view.len(11, 4);
    const rpx = view.len(ER_TRACK_DY, 2);
    const cx = wallX - rpx, cy = view.toScreenY(ER_LANE_Y);
    p.stroke(BLUE[0], BLUE[1], BLUE[2]);
    p.strokeWeight(wgt);
    p.line(outX(out.x0), yOut, cx, yOut);
    p.noFill();
    p.arc(cx, cy, 2 * rpx, 2 * rpx, -p.HALF_PI, 0);      // 碰壁那一半（藍）
    p.stroke(ORANGE[0], ORANGE[1], ORANGE[2]);
    p.arc(cx, cy, 2 * rpx, 2 * rpx, 0, p.HALF_PI);       // 折返那一半（橘）
    seg(cx, outX(arrow.legs[1].x1), yBack, ORANGE);
}

/** ① 側視圖：路、車、山壁、聲音那一條箭頭、車的速度箭頭、三條距離尺。 */
function erDrawSide(p, view, panel, st, sc) {
    const SX = wx => view.toScreenX(wx);
    const SY = wy => view.toScreenY(wy);
    const WX = xm => erWorldX(xm, sc);

    // ---- 公尺格線：一把尺同時餵 lane 上的箭頭與路面 ----------------------
    // 兩條帶子上的格線是**同一批 x**——「上下對齊」看得出來就是靠這個。
    const span = sc.xMax - sc.xMin;
    const step = erGridStep(span, ER_XR - ER_XL, 34);
    const every = erLabelEvery(step / span * (ER_XR - ER_XL), 34);
    let k = 0;
    for (let m = Math.ceil(sc.xMin / step) * step; m <= sc.xMax + 1e-9; m += step) {
        const x = SX(WX(m));
        p.stroke(226, 232, 240);
        p.strokeWeight(view.len(1, 0.6));
        p.line(x, SY(ER_LANE_Y - ER_LANE_H - 30), x, SY(ER_LANE_Y + ER_LANE_H + 30));
        p.line(x, SY(ER_ROAD_Y - 46), x, SY(ER_ROAD_Y + ER_ROAD_H + 8));
        if (k % every === 0) {
            p.noStroke();
            p.fill(148, 163, 184);
            p.textSize(view.len(12, 8));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(m.toFixed(0), x, SY(ER_TICK_Y));
        }
        k++;
    }
    p.noStroke();

    // ---- 路面與車 --------------------------------------------------------
    p.fill(226, 232, 240);
    p.rect(SX(ER_XL), SY(ER_ROAD_Y), SX(ER_XR) - SX(ER_XL), view.len(ER_ROAD_H, 5));
    p.fill(71, 85, 105);
    p.rect(SX(ER_XL), SY(ER_ROAD_Y), SX(ER_XR) - SX(ER_XL), view.len(2, 1));

    // ---- 山壁 ------------------------------------------------------------
    erCliff(p, view, WX(panel.s0), ER_LANE_Y - ER_LANE_H - 62, ER_ROAD_Y + 12);
    erLabel(p, view, ER_XR - 4, 84, '山壁',
            { size: 15, col: [120, 113, 108], align: p.RIGHT });

    // ---- 鳴笛點：整頁的座標原點（車從這裡出發、聲音也從這裡出發）---------
    p.push();
    const dash1 = p.drawingContext;
    dash1.setLineDash([view.len(7, 3), view.len(6, 3)]);
    p.stroke(148, 163, 184);
    p.strokeWeight(view.len(1.5, 0.8));
    p.line(SX(WX(0)), SY(ER_LANE_Y - ER_LANE_H - 62),
           SX(WX(0)), SY(ER_BAR3_Y + ER_BAR_H + 12));
    p.pop();
    erLabel(p, view, WX(0) + 6, ER_LANE_Y - ER_LANE_H - 76, '鳴笛點',
            { size: 14, col: [100, 116, 139] });

    // ---- 聲音：一條箭頭（鳴笛點 → 山壁 → 回音的前緣），尖端釘在波前上 ---
    erDrawSoundArrow(p, view, erSoundArrow(panel.s0, panel.v, panel.dir, st.t), sc);
    // ⚠️ 這一顆**不能**擺在車道下緣（第一版在 ER_LANE_Y + ER_LANE_H + 22）。
    //    那正是「聽到回聲了」那塊白底標籤的高度——它跟著車跑，車開到哪就把
    //    這幾個字蓋到哪（而且白底會把字切一半，畫面看起來只是「少寫了幾個
    //    字」）。改擺到 lane 那一列的最左邊：山壁在最右邊（84 那一行）、它在
    //    最左邊，兩顆標籤各自釘在圖的兩端，中間全部留給會動的東西。
    erLabel(p, view, ER_XL + 2, 84, '聲音（箭頭＝傳播方向）',
            { size: 14, col: [37, 99, 235] });

    // ---- 回音的前緣與車之間的那條縫 --------------------------------------
    // 這一條縫在聽到回聲的那一刻閉合。它是「什麼時候聽得到」的答案。
    // 兩端各一顆朝外的箭頭——它是「還差多遠」這一段的尺寸線（回音一路追，
    // 這段就一路縮，追到車上那一刻縮成零）。
    if (st.t > st.t1 + 1e-9) {
        const gy = SY(ER_ROAD_Y - 56);
        const g1 = SX(WX(st.carX)), g2 = SX(WX(st.frontX));
        const gySpan = Math.abs(g2 - g1);
        const head = Math.min(view.len(13, 6), gySpan * 0.45);
        p.push();
        const dash2 = p.drawingContext;
        dash2.setLineDash([view.len(5, 2), view.len(5, 2)]);
        p.stroke(251, 146, 60);
        p.strokeWeight(view.len(2, 1));
        p.line(g1, gy, g2, gy);
        p.pop();
        p.noStroke();
        p.fill(251, 146, 60);
        p.triangle(g1, gy, g1 - head, gy - head * 0.55, g1 - head, gy + head * 0.55);
        p.triangle(g2, gy, g2 + head, gy - head * 0.55, g2 + head, gy + head * 0.55);
    }

    // ---- 距離尺（三條，一條對一個量）-------------------------------------
    // ⚠️ 這裡**一定要三條**。第一版只有兩條：上面是去程，下面一條由「車走的」
    //    與「回程」兩塊拼成——駛向時兩塊剛好在車的位置接起來（看起來就像
    //    「車走的 ＋ 回程 ＝ 去程」），但**駛離時回程是 [車, 山壁]**，它把
    //    車到鳴笛點那一段整個蓋住，「車走的」那一塊一格都看不到——而它上面
    //    的數字、卡片、標題列全部正確。一條一個量就沒有這個問題，而
    //    「回程比去程長／短了多少」由三條的右端點直接讀出來。
    erLabel(p, view, WX(0) + 4, ER_BAR1_Y - 18, '聲音去程（鳴笛點 → 山壁）',
            { size: 14, col: [37, 99, 235] });
    erBar(p, view, WX(0), WX(panel.s0), ER_BAR1_Y, [37, 99, 235],
          `${panel.s0.toFixed(0)} m`);

    const back = st.t > st.t1 + 1e-9;
    erLabel(p, view, WX(0) + 4, ER_BAR2_Y - 18,
            back ? '回程（山壁 → 回音的前緣）' : '回程（還沒開始）',
            { size: 14, col: [234, 88, 12] });
    if (back) {
        // 外面那一段淡橘＝**還沒回來的**，也就是上面那條虛線的縫。它會在聽到
        // 回聲的那一刻縮到 0，整條尺變成實心——「聽到了」在這一列看得出來。
        erBar(p, view, Math.min(WX(st.carX), WX(st.frontX)),
              Math.max(WX(st.carX), WX(st.frontX)), ER_BAR2_Y, [253, 224, 199], '');
        erBar(p, view, Math.min(WX(st.frontX), WX(panel.s0)),
              Math.max(WX(st.frontX), WX(panel.s0)), ER_BAR2_Y, [234, 88, 12],
              `${st.backLen.toFixed(1)} m`);
    }

    erLabel(p, view, WX(0) + 4, ER_BAR3_Y - 18, '車走的（鳴笛點 → 車）',
            { size: 14, col: [100, 116, 139] });
    erBar(p, view, Math.min(WX(0), WX(st.carX)), Math.max(WX(0), WX(st.carX)),
          ER_BAR3_Y, [100, 116, 139],
          st.carDist >= 0.05 ? `${st.carDist.toFixed(1)} m` : '');

    // ---- 車 --------------------------------------------------------------
    erCar(p, view, WX(st.carX), ER_ROAD_Y, st.u < 0 ? -1 : 1, st.heard);
    if (st.heard) {
        erCentered(p, view, SX(WX(st.carX)), SY(ER_ROAD_Y - 120), '聽到回聲了',
                   { size: 14, col: [239, 68, 68], box: true });
    }

    // ---- 車的速度：車頂上方那一支 ----------------------------------------
    // 車在聲音飛行的整段時間裡都在走——這一支把「車也有速度」畫出來。
    // 方向跟著行進方向、長度跟著 v；v = 0 就不畫（車沒動，沒有東西好指）。
    // 那一支落在 world 393–407 那一條空帶（上面的「聽到回聲了」在 350、
    // 下面的縫在 414、車頂在 424）。
    // ⚠️ 讀數擺在箭頭**上方** 24 個世界單位，不是貼在箭桿旁邊：㉖ 量的是
    //    「深色的筆畫有沒有穿過字身框」，而這條箭桿正是深色的——車開到尺的
    //    左端時 erCentered 會把標籤夾回世界矩形裡，貼著箭桿擺的標籤當場被
    //    自己的箭桿穿過去（㉖ 抓到兩條，804px 那一組）。擺在上方就永遠不碰
    //    筆畫；24 是量出來的：最窄尺度（scale 0.349、字級下限 8px）下與
    //    「聽到回聲了」的字身框還留著 2.9px 的空隙。
    const ca = erCarArrow(panel.v, panel.dir);
    if (ca.len > 0) {
        const yA = SY(ER_CAR_ARROW_Y);
        const cx = SX(WX(st.carX));
        const lenPx = view.len(ca.len, ca.len * 0.36);
        const d = ca.dir;
        const x1 = cx, x2 = cx + d * lenPx;
        const head = Math.max(Math.min(view.len(20, 10), lenPx * 0.6), view.len(8, 4));
        if (lenPx > head) {
            p.stroke(51, 65, 85);
            p.strokeWeight(view.len(6, 3));
            p.line(x1, yA, x2 - d * head, yA);
        }
        p.noStroke();
        p.fill(51, 65, 85);
        p.triangle(x2, yA, x2 - d * head, yA - view.len(14, 7),
                   x2 - d * head, yA + view.len(14, 7));
        erCentered(p, view, (x1 + x2) / 2, SY(ER_CAR_ARROW_Y - 24),
                   `v = ${panel.v.toFixed(0)} m/s`, { size: 14, col: [71, 85, 105] });
    }
}

// ==========================================================================
// 面板與卡片
// ==========================================================================

function initEchoRanging() {
    WaveScene.run({

        formula: '\\begin{aligned} 2s_0 &= (c+u)\\,t \\\\ u &= \\pm v \\end{aligned}',
        formulaFallback: '2s₀ = (c+u)t，u = ±v（駛向 +v、駛離 −v）',

        controls: {
            selects: [
                {
                    key: 'dir', label: '車往哪邊開', def: 'toward',
                    options: [
                        { v: 'toward', t: '駛向山壁（u = +v）' },
                        { v: 'away',   t: '駛離山壁（u = −v）' },
                    ],
                },
            ],
            sliders: [
                { key: 'v',  label: '車速 <i>v</i>', unit: 'm/s',
                  min: ER_V_MIN, max: ER_V_MAX, step: 1, def: ER_V_DEF },
                { key: 's0', label: '鳴笛點到山壁 <i>s</i><sub>0</sub>', unit: 'm',
                  min: ER_S0_MIN, max: ER_S0_MAX, step: 10, def: ER_S0_DEF },
            ],
        },

        cards: [
            { label: '時間 t',           id: 'cardTime',  unit: 's',   highlight: true },
            { label: '鳴笛點距山壁 s₀',  id: 'cardS0',    unit: 'm',   highlight: true },
            { label: '車速 v',           id: 'cardV',     unit: 'm/s' },
            { label: '聲速 c',           id: 'cardC',     unit: 'm/s' },
            { label: '車走過的距離',     id: 'cardCar',   unit: 'm' },
            { label: '聲音走過的總路程', id: 'cardSound', unit: 'm' },
            { label: '回程已經走了',     id: 'cardBack',  unit: 'm' },
            { label: '車距山壁（現在）', id: 'cardGap',   unit: 'm' },
        ],

        values(t, panel) {
            const st = erState(panel.s0, panel.v, panel.dir, t);
            return {
                cardTime:  st.t.toFixed(2),
                cardS0:    panel.s0.toFixed(0),
                cardV:     panel.v.toFixed(0),
                cardC:     ER_C_SOUND.toFixed(0),
                cardCar:   st.carDist.toFixed(1),
                cardSound: st.soundLen.toFixed(1),
                cardBack:  st.backLen.toFixed(1),
                cardGap:   st.gap.toFixed(1),
            };
        },

        titleText(t, panel) {
            const st = erState(panel.s0, panel.v, panel.dir, t);
            const u = st.u, T = st.T, s0 = panel.s0;
            const dirName = panel.dir === 'away' ? '駛離山壁' : '駛向山壁';
            // ⚠️ 黑條是**單行、不換行**的（`wave-scene.js` 的 drawTitleBar），
            //    字級會自動降，但有 11 px 的下限——**降到底還塞不下就是文案
            //    該改短**。所以這裡每一句都控制在 40 個字上下：1100 px 的視窗
            //    只有 490 px 寬的黑條，60 個字當場變成兩端被裁掉。
            if (t < 0.05) {
                return `按「開始」＝鳴笛：聲音以 ${ER_C_SOUND} m/s 出發，`
                     + `車同時繼續往前開——${dirName}`;
            }
            if (!st.heard) {
                const phase = st.t <= st.t1
                    ? `聲音還在去程：走了 ${st.soundLen.toFixed(1)} m`
                    : `回音正在回頭：回程走了 ${st.backLen.toFixed(1)} m`;
                return `${phase}，車走了 ${st.carDist.toFixed(1)} m`
                     + `（離山壁還有 ${st.gap.toFixed(1)} m）`;
            }
            // ⚠️ 這一句要講的是**回程比去程長還是短**（車走了多遠就吃掉／多出
            //    多少），不是在把聲音的總路程和車走的路加起來——那個加法只有
            //    駛向那一組剛好等於 2s₀，駛離加起來是 810 m。
            const cmp = panel.v < 0.5 ? '車沒動，回程和去程一樣長'
                : `回程${u > 0 ? '短' : '長'}了車走的 ${st.carDist.toFixed(0)} m`;
            return `聽到回聲 t = ${T.toFixed(2)} s：聲音走 ${st.soundLen.toFixed(0)} m`
                 + `（${s0.toFixed(0)} ＋ ${st.backLen.toFixed(0)}），`
                 + `車走 ${st.carDist.toFixed(0)} m——${cmp}`;
        },

        draw(p, view, t, panel) {
            const sc = erScale(panel.s0, panel.v, panel.dir);
            const st = erState(panel.s0, panel.v, panel.dir, t);
            erDrawSide(p, view, panel, st, sc);
        },
    });
}

initEchoRanging();

// 匯出這一頁的常數與物理，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    ER_WORLD_W, ER_WORLD_H, ER_XL, ER_XR, ER_LANE_Y, ER_LANE_H, ER_ROAD_Y, ER_ROAD_H,
    ER_TICK_Y, ER_BAR1_Y, ER_BAR2_Y, ER_BAR3_Y, ER_BAR_H, ER_CAR_LEN,
    ER_C_SOUND, ER_V_MIN, ER_V_MAX, ER_V_DEF, ER_S0_MIN, ER_S0_MAX, ER_S0_DEF,
    ER_TRACK_DY, ER_CAR_ARROW_Y, ER_CAR_ARROW_PER, ER_CAR_ARROW_MAX, ER_CAR_PAD,
    ER_GRID_LADDER,
    erCarVel, erWallTime, erEchoTime, erScale, erWorldX,
    erState, erSoundArrow, erCarArrow, erGridStep, erLabelEvery, erTextW, erBarFits,
};
