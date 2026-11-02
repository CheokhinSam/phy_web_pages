/**
 * 💥 音爆與馬赫錐 — 波源跑得比自己的波還快時，波前疊成一個 V
 *
 * 這一頁是 26 都卜勒的下一格：那裡波源最快 1.5 m/s、波速 4 m/s，永遠追不上
 * 自己的波；這裡把速度拉到**超過**音速，看會發生什麼事。
 *
 * 由上往下看的一張「航線圖」：波源沿著中央的航線從左飛到右，每隔一個週期
 * 發出一道圓形的波前。每一個圓的**圓心都留在它被發出的地方**（和 26 同一個
 * 約定），所以：
 *
 *   M < 1（還沒追上）  波前跑得比波源快，圓一個比一個大、全都把波源包在裡面
 *   M = 1（剛好追上）  波源剛好貼在自己發出的波前上跑——每一個圓都穿過它身上
 *   M > 1（超過音速）  波源跑到圓**外面**去了，前緣互相疊起來；從波源對
 *                      每一道波前畫切線，所有切線**共用同一個角度**，
 *                      那就是馬赫錐的半頂角 θ，sin θ = v / v_s = 1 / M
 *
 * 為什麼切線一定存在、而且角度一樣？波源飛了 v_s·t、同時那道波前只跑了
 * v·t，兩者都是「同一個 t」的倍數——比值固定，所以直角三角形的斜邊
 * （v_s·t）與對邊（v·t）同比例縮放。畫面上那個灰色的直角三角形就是這件事，
 * 斜邊畫在航線上、對邊畫成半徑、直角在切點上。
 *
 * 音爆：錐面掃到觀察者的那一刻就是音爆。波源飛到觀察者正上方是 t = x/v_s，
 * 音爆要再晚 Δt = h·√(M²−1)/(M·v) 才到——**飛機早就過去了**。Δt 從 0
 * （M = 1）單調增加到 h/v（M → ∞），所以音爆最多只會晚 h/v 秒。
 *
 * 真實數字：v = 340 m/s（空氣，真值），v_s 從 0 拉到 850 m/s（2.5 馬赫）。
 * 畫面上那一段航線是 3400 m（＝聲音跑 10 秒的距離），高低各看 1000 m。
 * 為了讓畫面看得完，時間是**以秒為單位原速播放**的：M = 2 的飛機 4.8 秒
 * 飛完這一段——真實的飛機也是這樣，這不是慢動作。
 *
 * 場景骨架、控制面板與 p5 生命週期都在 wave-scene.js。
 */

// ==========================================================================
// 這一頁的版面與物理常數（世界單位與公尺並存，換算只有一個地方）
// ==========================================================================
// ⚠️ 這一頁有**兩種尺度**：畫面上的世界單位，以及物理用的公尺。兩者的換算
//    只有 `SBO_M_PER_W` 這一個常數，而它由「航線圖有多寬」定出來。
//    所有物理（半徑、座標、距離）一律用公尺算，只在繪製時才換成世界單位
//    ——兩種尺度各算一份的話，症狀是「圓心和半徑用了不同的比例」，
//    畫出來是橢圓，而每一個數值斷言都還是綠的。
const SBO_V = 340;             // 聲速（m/s，真值）

const SBO_POOL_M = 3400;       // 畫面那一段航線有幾公尺（= 聲音跑 10 秒）
const SBO_L = 70, SBO_R = 950; // 航線圖的左右緣（世界單位；= wave-scene 的 ROPE_L/ROPE_R）
const SBO_M_PER_W = SBO_POOL_M / (SBO_R - SBO_L);   // 3.8636 公尺 / 世界單位

const SBO_AXIS_Y = 430;        // 航線（= 26 都卜勒水塘的中心線，刻意同一條）
const SBO_POOL_T = 172;        // 航線圖的上緣
const SBO_POOL_B = 688;        // 下緣
// 航線上下各看得到 997 公尺。這不是口味：切點的高度是 v·Δt·cosθ，
// 圓太大的話切點會掉到圖外，畫面上就只剩下一條**沒有碰到任何圓**的直線
// ——「包絡線」當場變成一句空話（見 ⑭(b) 的守門員）。
const SBO_HALF_M = (SBO_POOL_B - SBO_POOL_T) / 2 * SBO_M_PER_W;

const SBO_X0 = 0;              // 波源的起點（公尺，航線的最左端）
const SBO_X_MAX = 3250;        // 飛到這裡就停住（留 150 m 給它自己的標記）
const SBO_OBS_X = 1700;        // 觀察者站在航線上的哪裡（公尺）
const SBO_OBS_H = 600;         // 觀察者離航線多遠（公尺）＝ 飛機的「高度」

// 波源速率：0 → 850 m/s（2.5 馬赫）。上限不是口味——見 ⑭(e)：
// σ 整個範圍都要能「先聽到音爆、才飛出畫面」。
const SBO_VS_MIN = 0, SBO_VS_MAX = 850, SBO_VS_DEF = 680;
// 發出波前的頻率。下限 0.8：一個週期內至少要有一道波前落在圖裡，
// 否則「還沒追上」看起來只是空畫面。
const SBO_F_MIN = 0.8, SBO_F_MAX = 2.4, SBO_F_DEF = 1.5;

const SBO_TOP_Y = 145;         // 波源那顆徽章（在航線圖上方）
const SBO_OBS_Y = 715;         // 觀察者那顆徽章（在下方）
const SBO_LEGEND_Y = 762;      // 底部圖例第一行
const SBO_LEGEND_Y2 = 788;     // 第二行（四項擠一行時最窄的版面排不下）

// --------------------------------------------------------------------------
// 公尺 ↔ 世界單位：只有這兩支
// --------------------------------------------------------------------------
/** 航線上離起點 m 公尺的位置 → 世界 x。 */
function sboWX(m) { return SBO_L + m / SBO_M_PER_W; }
/** 公尺 → 世界長度（半徑、高度都用它）。 */
function sboWL(m) { return m / SBO_M_PER_W; }
/** 公尺 → 世界 y：h 是「在航線上方幾公尺」，負的就在下面。 */
function sboWY(h) { return SBO_AXIS_Y - h / SBO_M_PER_W; }

// --------------------------------------------------------------------------
// 這一頁的物理，一處算完給卡片、畫面、標題列共用
// --------------------------------------------------------------------------
/**
 * 這一刻的完整狀態：波源在哪、發過哪些波前、馬赫錐多開、音爆什麼時候到。
 *
 * ⚠️ 飛到 SBO_X_MAX 就**停住**（`tm = min(t, tExit)`）：錐頂必須在波源身上，
 *    波源飛出畫面之後才畫的錐是**過期**的錐（圓已經又長大了，切線不再碰到
 *    它們）。停住的那一刻剛好是資訊最完整的一張圖——波源貼在右緣，整個 V
 *    往左張開。少了這一行，畫面會從「漂亮的馬赫錐」慢慢爛成一堆大圓。
 *
 * ⚠️ 和 26 的 model() 一樣，這一支**不准讀 panel 以外的東西**：卡片、
 *    畫面、標題列與驗證器讀的必須是同一份。
 */
function sboModel(t, panel) {
    const v = SBO_V, vs = panel.vs;
    const M = vs / v;
    const tExit = vs > 1e-9 ? (SBO_X_MAX - SBO_X0) / vs : Infinity;
    const tm = Math.min(t, tExit);
    const xs = SBO_X0 + vs * tm;

    // 波前：第 n 道在 tₙ 發出，之後自己以 v 往外擴散，和波源再也沒有關係。
    //   te  發出的時刻
    //   c   **發出時波源的位置**（公尺）——它就是圓心，留在原地不動
    //   r   v × (tm − te)，這道波前的半徑（公尺）
    const fronts = [];
    const w = WaveScene.omega(panel.f);
    const nmax = Math.ceil(panel.f * tm) + 2;
    for (let n = 0; n <= nmax; n++) {
        const te = (Math.PI / 2 + 2 * Math.PI * n) / w;
        if (te > tm) break;
        fronts.push({ te, c: SBO_X0 + vs * te, r: v * (tm - te) });
    }

    // 馬赫角：M ≤ 1 時切線不存在（sinθ 會大於 1），θ 是 null 而不是 90°。
    const theta = M > 1 ? Math.asin(1 / M) : null;

    // 音爆：波源飛到觀察者正上方的時刻，以及錐面掃到觀察者的時刻。
    const tOver = vs > 1e-9 ? (SBO_OBS_X - SBO_X0) / vs : Infinity;
    const boomDelay = theta != null
        ? SBO_OBS_H * Math.sqrt(M * M - 1) / (M * v)      // = h /（v_s · tanθ）
        : null;
    const tBoom = boomDelay != null ? tOver + boomDelay : null;

    return {
        v, vs, M, tm, xs, fronts, theta, tOver, boomDelay, tBoom,
        frozen: t > tExit,                       // 已經飛到右緣停住了
        heard: tBoom != null && tm >= tBoom,     // 觀察者已經聽到音爆
    };
}

/**
 * 一顆標籤的**世界半寬**（用真的字寬量，不是用猜的）。
 *
 * ⚠️ 標籤被畫布裁掉時不會有任何錯誤訊息——它就靜靜地少一半，而數值斷言
 *    全部照樣綠。它只在波源還貼著最左邊那零點幾秒的時候發生（那時候
 *    三角形還小、標籤的中點落在畫布外），所以截圖多半也拍不到；
 *    `.github/scripts/headless/verify/verify-waves.js` ㉖ 的畫布替身抓到過。
 */
function sboLabelHalf(p, view, text, size) {
    p.textSize(view.len(size, 9));
    // 1.08 的餘裕：瀏覽器量到的字寬比驗證器的保守估計窄一點，留給那個差
    return (p.textWidth(text) * 1.08 / 2 + view.len(13, 6)) / view.scale;
}

/**
 * 把標籤的世界 x 夾進 `[x0, x1]` 裡（只有靠邊的標籤會被推進來，平常不動）。
 *
 * ⚠️ 池子裡的東西要用**池子**當界線（`SBO_L`…`SBO_R`），不是畫布：錐體與
 *    波前都畫在池子的裁切區裡（draw() 的 `ctx.clip()`），池子外那半顆標籤
 *    是真的看不到——而「有沒有落在畫布裡」的判準會說它在畫布裡，什麼都不紅。
 */
function sboLabelX(p, view, wx, text, size, x0, x1) {
    const h = sboLabelHalf(p, view, text, size);
    return Math.min(Math.max(wx, x0 + h), x1 - h);
}

/** 這顆標籤整顆都落在 `[x0, x1]` 裡嗎（θ 的徽章要整顆在，因為它不能夾）。 */
function sboLabelIn(p, view, wx, text, size, x0, x1) {
    const h = sboLabelHalf(p, view, text, size);
    return wx - h >= x0 && wx + h <= x1;
}

/**
 * 波源頭頂那顆徽章。畫在池子的裁切區**外面**（畫布整寬都能用），所以
 * 界線是畫布。
 *
 * ⚠️ 門檻不能寫成一個世界單位的常數。同一串字在最窄的尺度上最寬——
 *    `view.len(15, 9)` 的字級在那裡被 9 px 的下限撐住，而畫布只有 850 px
 *    寬（世界 1000 寬只佔 349 px），於是「波源 850 m/s　M = 2.50　θ = 23.6°」
 *    換算回世界單位是 **538 寬**，不是寬螢幕上的 190。用後者當門檻的話，
 *    窄版面下這顆牌會被裁掉 13 px，而**所有數值斷言照樣全綠**（㉖ 抓到）。
 */
function sboBadgeAt(p, view, xm, y, text, o) {
    const size = (o && o.size) != null ? o.size : 15;
    const wx = sboLabelX(p, view, sboWX(xm), text, size, 0, WaveScene.WORLD_W);
    WaveScene.valueBadge(p, view, view.toScreenX(wx), view.toScreenY(y), text,
        Object.assign({ size }, o));
}

// --------------------------------------------------------------------------
// 畫面
// --------------------------------------------------------------------------
function initSonicBoom() {

    WaveScene.run({

        // 左欄公式框在 1100px 時內寬只有 183–198px；這一條排出來約 110px，塞得下。
        formula: '\\sin\\theta = \\frac{v}{v_s} = \\frac{1}{M}',
        formulaFallback: 'sinθ = v / vs = 1 / M　（馬赫角）',

        controls: {
            sliders: [
                { key: 'vs', label: '波源速率 <i>v<sub>s</sub></i>', unit: 'm/s',
                  min: SBO_VS_MIN, max: SBO_VS_MAX, step: 10, def: SBO_VS_DEF, dec: 0 },
                { key: 'f', label: '波前頻率 <i>f</i>', unit: 'Hz',
                  min: SBO_F_MIN, max: SBO_F_MAX, step: 0.1, def: SBO_F_DEF, dec: 1 },
            ],
        },

        cards: [
            { label: '時間',                 id: 'cardTime',  unit: 's',   highlight: true },
            { label: '馬赫數 M',             id: 'cardM',     unit: '',    highlight: true },
            { label: '馬赫角 θ',             id: 'cardTheta', unit: '°' },
            { label: '聲速 V（介質決定）',    id: 'cardV',     unit: 'm/s' },
            { label: '波源速率 vs',          id: 'cardVs',    unit: 'm/s' },
            { label: '觀察者離航線 h',        id: 'cardH',     unit: 'm' },
            { label: '音爆比飛越晚',          id: 'cardDelay', unit: 's' },
            { label: '觀察者',               id: 'cardHeard', unit: '' },
        ],

        values(t, panel) {
            const m = sboModel(t, panel);
            return {
                cardTime:  m.tm.toFixed(2),
                cardM:     m.M.toFixed(2),
                cardTheta: m.theta == null ? '—' : (m.theta * 180 / Math.PI).toFixed(1),
                cardV:     SBO_V.toFixed(0),
                cardVs:    panel.vs.toFixed(0),
                cardH:     SBO_OBS_H.toFixed(0),
                // 0.00 不是「幾乎同時」——M = 1 時錐面就是波源所在的那個垂直面
                cardDelay: m.boomDelay == null ? '—' : m.boomDelay.toFixed(2),
                cardHeard: m.tBoom == null ? '還沒有音爆'
                         : (m.heard ? '已經聽到音爆' : '還沒聽到'),
            };
        },

        titleText(t, panel) {
            const m = sboModel(t, panel);
            const deg = m.theta == null ? null : m.theta * 180 / Math.PI;

            if (t < 0.1) {
                return '按下開始——波源從左邊起飛。把速度拉過 340 m/s（M = 1），'
                     + '看波前怎麼疊成一個 V';
            }
            // ⚠️ 凍結那一幀要**先問有沒有錐**：M < 1 的時候整個畫面沒有 V，
            //    而「波源飛到右緣、V 往左張開」是超音速那一半的說法。
            //    兩句寫反的話畫面上只差一行字，數值斷言一條都不會紅。
            //    而且 M = 1 要排在 M < 1 **前面**——340/340 剛好是 1，漏掉的
            //    話它會掉進「還沒追上音速」那一句（原話是錯的）。
            if (m.frozen) {
                if (m.theta != null) {
                    return `波源飛到畫面右緣就停在那裡了——最後一幀的錐頂在它身上，`
                         + `整個 V 往左張開，馬赫角 θ = ${deg.toFixed(1)}°`
                         + `（M = ${m.M.toFixed(2)}）`;
                }
                if (Math.abs(m.M - 1) < 0.02) {
                    return '波源停在畫面右緣（M = 1.00）：它剛好貼在自己發出的波前上跑，'
                         + '每一道波前都穿過它身上——全部都疊在它的位置，還沒有張開';
                }
                const who = panel.vs < 1 ? '波源靜止' : '還沒追上音速';
                return `波源停在畫面右緣（${who}，M = ${m.M.toFixed(2)}）：`
                     + '每一道波前都還是完整的圓，波源一直在自己發出的圓裡面';
            }
            if (m.heard && t - m.tBoom < 0.9) {
                return `音爆！錐面掃過觀察者——波源 ${(m.tBoom - m.tOver).toFixed(2)} 秒前`
                     + `就從它頭上飛過去了，聲音卻現在才到`;
            }
            if (Math.abs(m.M - 1) < 0.02) {
                return 'M = 1：波源剛好貼在自己發出的波前上跑——每一個圓都穿過它身上，'
                     + '波前全部疊在它的位置';
            }
            if (m.theta == null) {
                const who = panel.vs < 1 ? '波源靜止' : '還沒追上音速';
                return `${who}（M = ${m.M.toFixed(2)}）：波前跑得比波源快，`
                     + '每一個圓都把波源包在裡面——還沒有人被追上，也就沒有錐面';
            }
            return `M = ${m.M.toFixed(2)}，馬赫角 θ = ${deg.toFixed(1)}°——`
                 + `波源飛得比波前快，前緣疊成一個 V；從錐頂對每一道波前畫的切線`
                 + `全部落在同一個角度上`;
        },

        draw(p, view, t, panel) {
            const TS = WaveScene;
            const m = sboModel(t, panel);

            const x0 = view.toScreenX(SBO_L), x1 = view.toScreenX(SBO_R);
            const y0 = view.toScreenY(SBO_POOL_T), y1 = view.toScreenY(SBO_POOL_B);
            const bw = x1 - x0, bh = y1 - y0;
            const sx = m => view.toScreenX(sboWX(m));           // 公尺 → 螢幕 x
            const sy = h => view.toScreenY(sboWY(h));           // 離航線 h 公尺 → 螢幕 y

            p.noStroke();
            p.fill(241, 245, 249);
            p.rect(x0, y0, bw, bh);

            // 波前是大圓，不裁的話會壓到兩顆徽章和底部那行圖例。
            // （view.clip() 只裁到世界矩形，航線圖比世界小。）
            const ctx = p.drawingContext;
            // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
            p.push();
            ctx.beginPath();
            ctx.rect(x0, y0, bw, bh);
            ctx.clip();

            // --- 航線 ---------------------------------------------------------
            ctx.setLineDash([view.len(7, 4), view.len(7, 4)]);
            p.stroke(148, 163, 184);
            p.strokeWeight(view.len(2, 1));
            p.line(x0, sy(0), x1, sy(0));
            ctx.setLineDash([]);

            // --- 觀察者離航線多遠（一條垂線）-----------------------------------
            ctx.setLineDash([view.len(5, 3), view.len(5, 3)]);
            p.stroke(21, 128, 61);
            p.strokeWeight(view.len(2, 1));
            p.line(sx(SBO_OBS_X), sy(0), sx(SBO_OBS_X), sy(-SBO_OBS_H));
            ctx.setLineDash([]);

            // --- 波前 ---------------------------------------------------------
            // **每一個圓的圓心都留在它被發出的地方**——波源往前走，只是把後來
            // 的圓心往前挪；先發出去的那幾個圓不會跟著它跑。整個音爆就長在這
            // 一行：圓心不動、而發出圓的位置一直在往前，前緣就疊起來了。
            // ⚠️ 圓心寫成 m.xs（波源現在的位置）的話，畫面上會是一組漂亮的
            //    同心圓，看起來完全正常，而音爆整個不見（見 ⑭(c)）。
            p.noFill();
            p.stroke(251, 191, 36);
            p.strokeWeight(view.len(3, 2));
            for (const fd of m.fronts) {
                // 看不看得見由 wave-scene.js 的 circleCrossesRect 判——和 26
                // 的水塘共用同一支（幾何只能有一個家）。單位全部是公尺。
                if (!TS.circleCrossesRect(fd.c, 0, fd.r, 0, -SBO_HALF_M,
                                          SBO_POOL_M, SBO_HALF_M)) continue;
                // 直徑用 view.len() 不給像素下限：圓心與半徑必須共用同一個
                // scale，給了下限就會變成「半徑用一個尺度」的橢圓。
                p.circle(sx(fd.c), sy(0), 2 * view.len(sboWL(fd.r)));
            }

            // --- 馬赫錐與直角三角形 --------------------------------------------
            if (m.theta != null) drawCone(p, view, m, sx, sy);

            p.pop();

            // --- 觀察者 -------------------------------------------------------
            drawObserver(p, view, m, sx, sy);

            // 航線圖的邊框（在裁切之外畫，框線才不會被裁掉一半）
            p.noFill();
            p.stroke(15, 23, 42);
            p.strokeWeight(view.len(3, 2));
            p.rect(x0, y0, bw, bh);

            // --- 波源（最後畫，壓在波前上面）----------------------------------
            drawSource(p, view, m, sx, sy, panel);

            // --- 底部圖例（兩行）------------------------------------------------
            // ⚠️ 四項擠成一行在窄版面上排不下：850×314 的畫布裡世界只有
            //    349 px 寬，而那一行的字量是 46 em（8 px 的字級也要 368 px）。
            //    溢出的是**最後那一項**，畫面看起來只是「少了一個色塊」。
            p.noStroke();
            p.fill(100, 116, 139);
            p.textSize(view.len(14, 8));
            p.textStyle(p.NORMAL);
            p.textAlign(p.CENTER, p.CENTER);
            const legendX = view.toScreenX(TS.WORLD_W / 2);
            p.text('黃圈 = 波前（圓心留在發出的地方）　深紅 = 馬赫錐',
                   legendX, view.toScreenY(SBO_LEGEND_Y));
            p.text('綠 = 觀察者　灰 = 切線與半徑的直角三角形',
                   legendX, view.toScreenY(SBO_LEGEND_Y2));
        },
    });

    // ----------------------------------------------------------------------
    // 馬赫錐：兩條切線、那個直角三角形、以及錐頂的角
    // ----------------------------------------------------------------------
    function drawCone(p, view, m, sx, sy) {
        const TS = WaveScene;
        const th = m.theta, cs = Math.cos(th), sn = Math.sin(th);
        const far = SBO_POOL_M * 1.3;             // 一定足夠長到被裁掉

        // ① 兩條切線。**同一個 θ**——因為對每一道波前，斜邊 v_s·Δt 與對邊
        //    v·Δt 的比都是 v_s/v。這就是「所有切線共用一個角度」的原因。
        p.stroke(185, 28, 28);
        p.strokeWeight(view.len(5, 3));
        for (const sgn of [+1, -1]) {
            p.line(sx(m.xs), sy(0),
                   sx(m.xs - far * cs), sy(sgn * far * sn));
        }

        // ② 直角三角形：斜邊 = 波源飛過的距離、對邊 = 波前跑過的距離。
        //    挑**最老**的那一道「整個直角三角形還在圖裡」的波前——三角形
        //    越大，直角越清楚。界線是切點高度 r·cosθ 加上直角記號再往上
        //    爬的那一段（260·sinθ）：兩者相加超過池子的半高，直角記號就會
        //    被裁掉一半，學生看到的是一個沒有記號的「直角」。
        //    一道都放不下時就不畫——畫了只看得到兩條沒有交會的線，
        //    比不畫更難懂。
        const MARK_M = 260;                       // 直角記號的臂長（公尺）
        let pick = null;
        for (const fd of m.fronts) {
            if (fd.r <= 1e-9) continue;
            if (fd.r * cs + MARK_M * sn > SBO_HALF_M) continue;
            if (fd.c < 0 || fd.c > SBO_POOL_M) continue;
            pick = fd;                            // fronts 由舊到新，第一個符合的就是最老的
            break;
        }
        if (pick) {
            const d = m.xs - pick.c;              // 斜邊 = v_s·Δt
            const tx = pick.c + pick.r * sn;      // 切點（公尺，航線上方）
            const ty = pick.r * cs;

            p.stroke(100, 116, 139);
            p.strokeWeight(view.len(3, 2));
            p.line(sx(pick.c), sy(0), sx(m.xs), sy(0));          // 斜邊（在航線上）
            p.line(sx(pick.c), sy(0), sx(tx), sy(ty));           // 對邊（半徑）

            // 直角記號：從切點沿著兩邊各畫一小段（兩段等長且互相垂直，就是
            // 課本上那個記號）。沒有它的話，「半徑垂直於切線」這件讓
            // sinθ = v/v_s 成立的事只能靠學生自己相信。
            //   u = 切線方向（背對錐頂，往左上）　n = 由圓心指向切點
            const s2 = MARK_M;
            const ux = -cs, uy = sn;
            const nx = sn, ny = cs;
            p.strokeWeight(view.len(2, 1));
            p.line(sx(tx), sy(ty), sx(tx + s2 * ux), sy(ty + s2 * uy));
            p.line(sx(tx), sy(ty), sx(tx - s2 * nx), sy(ty - s2 * ny));

            // 切點
            p.noStroke();
            p.fill(100, 116, 139);
            p.circle(sx(tx), sy(ty), view.len(16, 8));

            // 兩個長度的標籤。用 valueBadge（白底牌）——底下的黃圈會穿過
            // 文字，沒有底牌的話「1890 m」根本讀不出來。
            // ⚠️ 兩顆都擺在「斜邊中點／半徑中點」，而波源剛出發的那一秒
            //    這兩個中點都貼在畫布左緣：不夾進去的話標籤會靜靜地少掉
            //    一截（㉖ 的畫布替身量到的就是這個，見 sboLabelX 的檔頭）。
            const dText = `波源飛了 ${d.toFixed(0)} m`;
            const rText = `這道波前跑了 ${pick.r.toFixed(0)} m`;
            TS.valueBadge(p, view,
                view.toScreenX(sboLabelX(p, view, sboWX((pick.c + m.xs) / 2), dText, 13,
                                          SBO_L, SBO_R)),
                sy(0) - view.len(26, 12), dText, { size: 13, fillColor: [71, 85, 105] });
            TS.valueBadge(p, view,
                view.toScreenX(sboLabelX(p, view, sboWX((pick.c + tx) / 2), rText, 13,
                                          SBO_L, SBO_R)),
                sy(ty / 2) - view.len(22, 10), rText, { size: 13, fillColor: [71, 85, 105] });
        }

        // ③ 錐頂的角 θ：從「後方」量到切線
        const arcR = 300;                          // 公尺
        p.noFill();
        p.stroke(185, 28, 28);
        p.strokeWeight(view.len(3, 2));
        p.beginShape();
        for (let i = 0; i <= 32; i++) {
            const a = Math.PI - th * i / 32;       // 由「往後」轉到切線
            p.vertex(sx(m.xs + arcR * Math.cos(a)), sy(arcR * Math.sin(a)));
        }
        p.endShape();
        // θ 的標籤擺在扇形外面一點點。它**不能夾**（夾了就跟那道弧分家，
        // 學生對不上是哪個角），所以在扇形還沒進到畫布裡的時候整顆不畫——
        // 錐頂剛離開左緣那零點幾秒就是這樣，那時候 θ 也還寫在波源徽章上。
        const la = Math.PI - th / 2;
        const thText = `θ = ${(th * 180 / Math.PI).toFixed(1)}°`;
        const thX = sboWX(m.xs + arcR * 1.9 * Math.cos(la));
        if (sboLabelIn(p, view, thX, thText, 14, SBO_L, SBO_R)) {
            TS.valueBadge(p, view, view.toScreenX(thX), sy(arcR * 1.9 * Math.sin(la)),
                thText, { size: 14, stroke: [185, 28, 28], fillColor: [185, 28, 28] });
        }
    }

    // ----------------------------------------------------------------------
    // 觀察者：一個點，加上「被打到」那一下
    // ----------------------------------------------------------------------
    function drawObserver(p, view, m, sx, sy) {
        const TS = WaveScene;
        const ox = sx(SBO_OBS_X), oy = sy(-SBO_OBS_H);

        // 錐面掃過去的瞬間：以聲速往外擴散的幾圈漣漪（衝擊波過了之後
        // 就是一個普通的球面波，速度還是 v）。
        if (m.tBoom != null) {
            const dt = m.tm - m.tBoom;
            for (const [lag, alpha] of [[0, 190], [0.14, 120], [0.28, 60]]) {
                const k = dt - lag;
                if (k < 0 || k > 0.7) continue;
                p.noFill();
                p.stroke(185, 28, 28, alpha * (1 - k / 0.7));
                p.strokeWeight(view.len(4, 2));
                p.circle(ox, oy, 2 * view.len(sboWL(SBO_V * k)));
            }
        }

        p.noStroke();
        p.fill(m.heard ? 21 : 22, m.heard ? 128 : 163, m.heard ? 61 : 74);
        p.circle(ox, oy, view.len(24, 11));

        sboBadgeAt(p, view, SBO_OBS_X, SBO_OBS_Y,
            `觀察者（離航線 ${SBO_OBS_H} m）　${m.heard ? '已經聽到音爆' : '還沒聽到'}`,
            { stroke: [21, 128, 61], fillColor: [21, 128, 61] });
    }

    // ----------------------------------------------------------------------
    // 波源：一架飛機，機頭朝行進方向
    // ----------------------------------------------------------------------
    function drawSource(p, view, m, sx, sy, panel) {
        const px = sx(m.xs), py = sy(0);
        const L = view.len(30, 14);

        p.noStroke();
        p.fill(30, 41, 59);
        p.triangle(px + L * 0.62, py,
                   px - L * 0.52, py - L * 0.44,
                   px - L * 0.52, py + L * 0.44);
        p.fill(148, 163, 184);
        p.rect(px - L * 0.62, py - L * 0.10, L * 0.26, L * 0.20);   // 尾翼

        const deg = m.theta == null ? null : m.theta * 180 / Math.PI;
        sboBadgeAt(p, view, m.xs, SBO_TOP_Y,
            deg == null
                ? `波源 ${panel.vs.toFixed(0)} m/s　M = ${m.M.toFixed(2)}`
                : `波源 ${panel.vs.toFixed(0)} m/s　M = ${m.M.toFixed(2)}　θ = ${deg.toFixed(1)}°`,
            { stroke: [30, 41, 59], fillColor: [30, 41, 59] });

        // 徽章到飛機的短虛線（徽章在航線圖外面，不連起來會不知道在指誰）
        const ctx = p.drawingContext;
        // ⚠️ p.push()／p.pop()，不是 ctx.save()／ctx.restore()——見 README 陷阱二十九
        p.push();
        ctx.setLineDash([view.len(5, 3), view.len(5, 3)]);
        p.stroke(30, 41, 59);
        p.strokeWeight(view.len(2, 1));
        p.line(px, view.toScreenY(SBO_TOP_Y + view.len(16, 8)), px, py - L * 0.5);
        p.pop();
    }
}

initSonicBoom();

// 匯出這一頁的常數與物理，驗證器才進得來（見 .github/scripts/headless/README.md）。
window.__page = {
    SBO_V, SBO_POOL_M, SBO_L, SBO_R, SBO_M_PER_W,
    SBO_AXIS_Y, SBO_POOL_T, SBO_POOL_B, SBO_HALF_M,
    SBO_X0, SBO_X_MAX, SBO_OBS_X, SBO_OBS_H,
    SBO_VS_MIN, SBO_VS_MAX, SBO_VS_DEF, SBO_F_MIN, SBO_F_MAX, SBO_F_DEF,
    SBO_TOP_Y, SBO_OBS_Y, SBO_LEGEND_Y, SBO_LEGEND_Y2,
    // 這一頁的物理：卡片、畫面、標題列共用同一個 model()，驗證器也讀它。
    sboModel, sboWX, sboWL, sboWY,
    // 版面：徽章擺在哪裡是**量出來的**，驗證器要能拿自己的字寬重問一次。
    sboBadgeAt, sboLabelHalf, sboLabelX, sboLabelIn,
};
