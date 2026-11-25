/**
 * 🧲 帶電粒子在磁場中（洛倫茲力）
 *
 * 這一頁只有一個畫面：一顆帶電粒子在垂直於螢幕的均勻磁場裡繞圈。
 *
 * ⚠️ 課本上寫「帶電粒子在均勻磁場中作圓周運動」，學生點頭，然後就沒有然後
 *    了——因為那句話沒有可觀察的後果。這裡把它拆成**兩件可以分別看見的事**：
 *
 *      r = mv/qB    拉 v 或 B，圓**變大變小**
 *      T = 2πm/qB   拉 v，圈**快慢不變**；只有拉 B 才會變快慢
 *
 *    第二句才是這一頁的主角。它是「等速圓周運動的週期與速率無關」在磁場
 *    裡的長相，也是迴旋加速器能在固定頻率下工作的原因——而它必須被**看見**，
 *    不能只是被寫下來。所以拉 v 滑桿時，圓會變大，但粒子繞一圈還是花一樣
 *    的秒數；拉 B 滑桿時，圓和秒數才一起變。
 *
 * ==========================================================================
 * ⚠️ 為什麼畫面上有一根比例尺，而且三種粒子的比例尺不一樣
 * ==========================================================================
 * 真實數字：電子在 10 mT、1.5×10⁶ m/s 下的圓半徑是 **0.85 mm**，
 * 質子是 **1.57 m**，α 粒子是 **3.11 m**。差了三個數量級。
 *
 * 畫面上三個圓長得一樣大（都是 170 世界單位），因為**每個粒子有自己的
 * 放大倍率**。這不是作弊，是必要的取捨：不這樣做的話，電子的圓會是
 * 0.0004 個像素。但取捨不能偷偷做——所以左下角永遠有一根比例尺，
 * 告訴你「螢幕上這麼長 = 真實的多少」。切換粒子時比例尺會跳一個量級，
 * 那個跳動本身就是「微觀與宏觀差多遠」的訊息。
 *
 * ==========================================================================
 * ⚠️ 為什麼用解析解而不是逐步積分
 * ==========================================================================
 * 圓周運動有閉式解，位置就是 cos/sin。用 Euler 或 RK4 一步步推，數值誤差
 * 會讓軌跡慢慢往外螺旋，跑幾圈之後「實際軌跡」和「公式預測的圓」就分家了
 * ——而這一頁的整個賣點就是**那兩條線必須重合**。所以這裡只累積一個相位，
 * 位置每次重算，跑一小時也不會歪。
 */
(function () {
    'use strict';

    const TAU = Math.PI * 2;

    // ======================================================================
    // 邏輯世界（900×900，見 lab-scene.js）
    // ======================================================================
    const CX = 450, CY = 430;      // 圓心：往上挪一點，讓最大半徑不撞到標題列
    const R0 = 170;                // 預設參數下的世界半徑
    const T_LAP = 4;               // 預設 B 下，繞一圈要 4 秒（動畫時間）

    const TRAIL_COL = [51, 65, 85];         // 走過的路：近黑，比虛線重
    const GRID_COL = [203, 213, 225];       // 底紋：淡，不跟軌道搶

    // ======================================================================
    // 三種粒子：真實的 SI 常數
    // ======================================================================
    const E_CHARGE = 1.602176634e-19;       // C
    const M_ELECTRON = 9.1093837015e-31;    // kg
    const M_PROTON = 1.67262192369e-27;     // kg
    const M_ALPHA = 6.6446573357e-27;       // kg（α 粒子 = 氦-4 原子核，2p + 2n）

    const PARTICLES = {
        electron: { sym: 'e⁻', name: '電子', q: -E_CHARGE, m: M_ELECTRON },
        proton: { sym: 'p⁺', name: '質子', q: +E_CHARGE, m: M_PROTON },
        alpha: { sym: 'α', name: 'α 粒子', q: +2 * E_CHARGE, m: M_ALPHA },
    };

    // 滑桿的預設值。u 可以想成「一個世界單位等於幾公尺」，v 與 B 的預設值
    // 決定 R0 對應到的真實半徑。
    const V0 = 1.5, B0 = 10;       // 1.5×10⁶ m/s、10 mT

    // ======================================================================
    // 數字格式：這一頁的數量級橫跨 10⁹（半徑 0.85 mm 到 3 m、週期 3.6 ns
    // 到 13 µs），固定小數位會讓其中一端永遠印成 0.00。所以一律自帶單位，
    // 卡片的 unit 留空字串。
    // ======================================================================
    const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³',
                  '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

    /** 10 的次方寫成上標，例如 3 → ⁻¹⁹（含負號）。 */
    function sup(n) {
        return String(n).split('').map(c => SUP[c] || c).join('');
    }

    /** 科學記號：1.50×10⁶。物理卡片上這比 1500000 好讀。 */
    function sci(v, d) {
        if (!(Math.abs(v) > 0)) return '0';
        const e = Math.floor(Math.log10(Math.abs(v)));
        const mant = v / Math.pow(10, e);
        return mant.toFixed(d == null ? 2 : d).replace('-', '−') + '×10' + sup(e);
    }

    /** 長度：自動挑單位。電子的半徑要印成 0.853 mm，不是 8.53×10⁻⁴ m。 */
    function fmtLen(m) {
        const a = Math.abs(m);
        if (!(a > 0)) return '0';
        if (a < 1e-7) return (m * 1e9).toFixed(1) + ' nm';
        if (a < 1e-4) return (m * 1e6).toFixed(1) + ' µm';
        if (a < 1e-2) return (m * 1e3).toFixed(a < 1e-3 ? 3 : 2) + ' mm';
        if (a < 1) return (m * 1e2).toFixed(1) + ' cm';
        if (a < 1e4) return m.toFixed(a < 1e2 ? 2 : 0) + ' m';
        return (m * 1e-3).toFixed(1) + ' km';
    }

    /** 時間：電子的週期是 3.57 ns，質子是 6.57 µs。 */
    function fmtTime(s) {
        const a = Math.abs(s);
        if (!(a > 0)) return '0';
        if (a < 1e-9) return (s * 1e12).toFixed(1) + ' ps';
        if (a < 1e-6) return (s * 1e9).toFixed(a < 1e-8 ? 1 : 2) + ' ns';
        if (a < 1e-3) return (s * 1e6).toFixed(a < 1e-5 ? 2 : 1) + ' µs';
        if (a < 1) return (s * 1e3).toFixed(1) + ' ms';
        return s.toFixed(2) + ' s';
    }

    // ======================================================================
    // 比例尺：1／2／5 的階梯，挑一個不超過畫面 1/4 寬的長度
    // ======================================================================
    const LADDER = [1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4,
                    1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 1e-1, 2e-1, 5e-1,
                    1, 2, 5, 10];
    const BAR_MAX_W = 230;         // 世界單位：比例尺最長畫這麼長

    function scaleBar(u) {
        let len = LADDER[0];
        for (const v of LADDER) if (v / u <= BAR_MAX_W) len = v;
        return { m: len, world: len / u, label: fmtLen(len) };
    }

    // ======================================================================
    // 軌道
    // ======================================================================
    // ⚠️ 軌道狀態一定要宣告在 MagneticScene.run() **之前**：run() 會同步呼叫
    //    refresh() → model()，也就是在 IIFE 還沒跑完時就讀它，寫在下面的話
    //    這裡直接 TDZ ReferenceError。（lab-scene.js 的 buildPanel 就是為了
    //    同一個理由才不在建構時回呼。）
    //
    // 只需要一個相位，位置是解析解。trail 是「走過的路」，用來看它有沒有
    // 乖乖貼在預測圓上。
    let lastT = -1;
    let lastState = null;
    const TRAIL_MAX = 720;
    let phase = 0;
    const trail = [];

    /**
     * 回到起始條件：粒子在圓心正右方，速度垂直於半徑、方向讓力**指向圓心**。
     *
     * ⚠️ 這裡**不要**先塞一個起始點進 trail。真正的半徑 Rw 取決於當下的
     *    v／B／粒子，而 resetOrbit() 是在算出 Rw 之前被呼叫的——先塞的話
     *    會留下一個用 R0 算的舊點，拉 v 滑桿之後就多出一條莫名其妙的線段。
     *    step() 裡「trail 空的話就推第一個點」已經處理好了。
     */
    function resetOrbit() {
        phase = 0;
        trail.length = 0;
    }

    /**
     * 這一頁的物理。回傳的每個數都是畫面和卡片共用的那一份。
     *
     * ⚠️ 用 t === lastT 去重：run() 每幀呼叫 model() 一次，但面板一有變動
     *    refresh() 也會呼叫一次（那時 simTime 還是上一幀的值）。不去重的話
     *    拉一次滑桿就多推進一幀。
     */
    function step(t, panel) {
        if (t === lastT && lastState) return lastState;

        const pt = PARTICLES[panel.particle] || PARTICLES.electron;
        const BmT = panel.B;
        const bz = (panel.bdir === 'in' ? -1 : 1) * BmT * 1e-3;   // T，帶正負
        const v = panel.v * 1e6;                                  // m/s
        const Babs = Math.abs(bz);

        // --- 真實的 SI 量。公式住在 magnetic-kit.js，這一頁不自己抄一份 ---
        const r = MagneticKit.lorentzRadius(pt.m, v, pt.q, Babs);
        const T = MagneticKit.lorentzPeriod(pt.m, pt.q, Babs);

        // --- 畫面上的量 ---
        // 世界半徑只跟 v/B 的比值有關：r ∝ v/B，預設值下剛好是 R0。
        const Rw = R0 * (panel.v / V0) * (B0 / BmT);
        // 一個世界單位 = 幾公尺。這一頁**沒有場源**，所以不必掛 u；比例尺
        // 直接從這裡算出來就好。
        //
        // ⚠️ u = r/Rw 化簡之後只剩 (m·V0/|q|B0)/R0——**跟 v、B 都無關**，
        //    只跟「哪一種粒子」有關。所以拉 v／B 滑桿時比例尺不會動，圓
        //    卻會變大：那代表真實半徑真的變了，而螢幕上的尺沒有跟著換。
        //    這正是我們要的（速度變快＝真實的圓變大，不是換一把尺）。
        const u = r / Rw;

        // 視覺角速度：刻意讓**動畫的週期**正比於 1/B、與 v 無關——這樣
        // 「T 不隨 v 變、只隨 B 變」才是眼睛看得見的事，而不是只有卡片上
        // 的兩個數字。
        const Tvis = T_LAP * (B0 / BmT);
        const wvis = TAU / Tvis;
        const sgn = (pt.q * bz) >= 0 ? 1 : -1;    // +1 = 螢幕上逆時針

        if (t !== lastT) {
            const dt = t - lastT;
            // 負的 dt（按了重設或拉了滑桿，simTime 歸零）或跳太大（分頁被
            // 切走再回來）都直接重來，不要讓粒子瞬移半圈。
            if (!(dt > 0) || dt > 0.5) resetOrbit();
            else phase += sgn * wvis * dt;
            lastT = t;
        }

        const px = CX + Rw * Math.cos(phase);
        const py = CY - Rw * Math.sin(phase);

        // 速度＝位置對時間的微分。螢幕 y 向下，所以 sin 那一項要反號。
        const vx = -Rw * wvis * Math.sin(phase) * sgn;
        const vy = -Rw * wvis * Math.cos(phase) * sgn;

        if (trail.length === 0 || Math.hypot(px - trail[trail.length - 1].x,
                                             py - trail[trail.length - 1].y) > 1.2) {
            trail.push({ x: px, y: py });
            if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX);
        }

        lastState = {
            pt, v, bz, BmT, Babs, r, T,
            f: 1 / T,
            Rw, u, px, py, vx, vy, sgn, Tvis,
            laps: Math.abs(phase) / TAU,
            ccw: sgn > 0,
            trail: trail.slice(),
            scale: scaleBar(u),
        };
        return lastState;
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    /** ⊙／⊗ 的底紋：整個畫面都是同一種符號，因為場是均勻的。 */
    function drawFieldGrid(p, view, bz) {
        for (let gy = 70; gy <= 800; gy += 120)
            for (let gx = 90; gx <= 810; gx += 120)
                MagneticScene.drawPageDir(p, view, gx, gy, 8, bz, GRID_COL);
    }

    /** 預測圓：r = mv/qB 算出來的那個圓，虛線，先畫（會被實線蓋過去）。 */
    function drawPredicted(p, view, Rw) {
        const N = 72;
        for (let i = 0; i < N; i += 2) {
            const a1 = i / N * TAU, a2 = (i + 1) / N * TAU;
            MagneticScene.strokeOn(p, MagneticScene.C_DIM, view.len(2, 1.4));
            p.line(view.toScreenX(CX + Rw * Math.cos(a1)), view.toScreenY(CY - Rw * Math.sin(a1)),
                   view.toScreenX(CX + Rw * Math.cos(a2)), view.toScreenY(CY - Rw * Math.sin(a2)));
        }
    }

    /** 實際走過的軌跡。這一條和上面的虛線必須**完全重合**。 */
    function drawTrail(p, view, pts) {
        if (pts.length < 2) return;
        p.noFill();                                  // endShape() 不帶參數還是會填色
        MagneticScene.strokeOn(p, TRAIL_COL, view.len(3, 2));
        p.beginShape();
        for (const q of pts) p.vertex(view.toScreenX(q.x), view.toScreenY(q.y));
        p.endShape();
    }

    function drawScaleBar(p, view, bar) {
        const x0 = 40, y0 = 792, x1 = x0 + bar.world;
        MagneticScene.strokeOn(p, MagneticScene.C_FIELD, view.len(3, 2));
        p.line(view.toScreenX(x0), view.toScreenY(y0), view.toScreenX(x1), view.toScreenY(y0));
        for (const xx of [x0, x1]) {
            p.line(view.toScreenX(xx), view.toScreenY(y0 - 9),
                   view.toScreenX(xx), view.toScreenY(y0 + 9));
        }
        MagneticScene.worldBadge(p, view, (x0 + x1) / 2, y0 - 22, bar.label,
                                 { size: 13, col: MagneticScene.C_FIELD });
    }

    function draw(p, view, t, panel, sol, state) {
        const S = state;

        drawFieldGrid(p, view, S.bz);

        // 左上角圖例：這一頁的磁場是垂直於畫面的，要先把「哪個方向」講清楚
        MagneticScene.drawPageDir(p, view, 74, 44, 13, S.bz, MagneticScene.C_FIELD);
        // 符號由左邊的 drawPageDir 提供，這裡只寫字——兩邊都畫 ⊙ 會變成
        // 「⊙ B 穿出螢幕 ⊙」。
        MagneticScene.worldBadge(p, view, 96, 44, S.bz < 0 ? 'B 穿入螢幕' : 'B 穿出螢幕',
                                 { size: 13, align: 'left', col: MagneticScene.C_FIELD });
        drawPredicted(p, view, S.Rw);
        drawTrail(p, view, S.trail);

        // 圓心與半徑
        p.noStroke();
        p.fill(148, 163, 184);
        p.ellipse(view.toScreenX(CX), view.toScreenY(CY), view.len(5, 3), view.len(5, 3));
        MagneticScene.dashed(p, view, CX, CY, S.px, S.py, MagneticScene.C_DIM, { w: 1.5 });
        // 'r' 標在半徑上離圓心 34% 的地方，**再往垂直方向推開 40 個世界單位**。
        //
        // ⚠️ 位置不能隨便挑。F 的箭頭就躺在同一條半徑上、尖端離圓心約 45%，
        //    而那枝箭頭帶一個白底標籤方塊——標籤畫得比 F 晚，會整個蓋掉 'r'。
        //    蓋掉的是「半徑」的標籤，畫面上只會覺得少了一個字，不會有任何
        //    錯誤訊息。往垂直方向推開才是真正的解：F 永遠沿著半徑，垂直方向
        //    離它最遠。
        {
            const dx = S.px - CX, dy = S.py - CY;
            const m = Math.hypot(dx, dy) || 1;
            MagneticScene.worldBadge(
                p, view,
                CX + dx * 0.34 - dy / m * 40,
                CY + dy * 0.34 + dx / m * 40, 'r',
                { size: 13, col: MagneticScene.C_DIM });
        }

        // 速度與力：F 的方向一定要問 MagneticKit，不要在這裡自己算叉積。
        // （vx、vy 是世界單位／秒，混了尺度，所以 F 的**大小**不是牛頓——
        //   這裡只拿它的方向來畫箭頭。大小在卡片上，由 SI 公式算。）
        MagneticScene.drawVector(p, view, S.px, S.py, S.vx / S.Rw * 95, S.vy / S.Rw * 95,
                                 MagneticScene.C_VEL, 'v', { w: 3, head: 11 });
        const F = MagneticKit.lorentzForce(S.pt.q, S.vx, S.vy, S.bz);
        const Fm = Math.hypot(F.fx, F.fy);
        if (Fm > 0) {
            MagneticScene.drawVector(p, view, S.px, S.py, F.fx / Fm * 78, F.fy / Fm * 78,
                                     MagneticScene.C_FORCE, 'F', { w: 3, head: 11 });
        }

        MagneticScene.drawParticle(p, view, S.pt.q, { x: S.px, y: S.py, r: 14 });
        MagneticScene.worldBadge(p, view, S.px, S.py - 30, S.pt.sym,
                                 { size: 14, col: S.pt.q >= 0 ? MagneticScene.C_NPOLE
                                                              : MagneticScene.C_SPOLE });

        drawScaleBar(p, view, S.scale);
    }

    // ======================================================================
    // 介面
    // ======================================================================
    MagneticScene.run({
        formula: 'r = \\dfrac{mv}{|q|B} \\qquad T = \\dfrac{2\\pi m}{|q|B}',
        formulaFallback: 'r = mv / |q|B　　T = 2πm / |q|B',

        controls: {
            selects: [
                { key: 'particle', label: '粒子', def: 'electron', options: [
                    { v: 'electron', t: '電子 e⁻（q = −e）' },
                    { v: 'proton', t: '質子 p⁺（q = +e）' },
                    { v: 'alpha', t: 'α 粒子（q = +2e）' },
                ] },
                { key: 'bdir', label: '磁場方向', def: 'out', options: [
                    { v: 'out', t: '穿出螢幕 ⊙' },
                    { v: 'in', t: '穿入螢幕 ⊗' },
                ] },
            ],
            sliders: [
                { key: 'v', label: '速率 v', def: V0, min: 1.0, max: 2.5, step: 0.1,
                  unit: '×10⁶ m/s', dec: 1 },
                { key: 'B', label: '磁場 B', def: B0, min: 8, max: 15, step: 0.5,
                  unit: 'mT', dec: 1 },
            ],
        },

        cards: [
            { label: '粒子', id: 'cardPart', unit: '' },
            { label: '圓周半徑 r', id: 'cardR', unit: '', highlight: true },
            { label: '週期 T', id: 'cardT', unit: '', highlight: true },
            { label: '頻率 f', id: 'cardF', unit: 'Hz' },
            { label: '速率 v', id: 'cardV', unit: 'm/s' },
            { label: '磁場 B', id: 'cardB', unit: 'mT' },
            { label: '電荷 q', id: 'cardQ', unit: 'C' },
            { label: '質量 m', id: 'cardM', unit: 'kg' },
            { label: '已繞圈數', id: 'cardLaps', unit: '圈' },
            { label: '時間慢速', id: 'cardSlow', unit: '倍' },
        ],

        model: step,

        values(t, panel, sol) {
            return {
                cardPart: sol.pt.name + ' ' + sol.pt.sym,
                cardR: fmtLen(sol.r),
                cardT: fmtTime(sol.T),
                cardF: sci(sol.f, 2),
                cardV: sci(sol.v, 2),
                cardB: sol.BmT.toFixed(1),
                cardQ: sci(sol.pt.q, 2),
                cardM: sci(sol.pt.m, 2),
                cardLaps: sol.laps.toFixed(2),
                // 動畫比真實慢幾倍。電子是 10⁹ 的等級——這個數本身就是訊息：
                // 微觀世界快到不可能直接看，只能這樣換算。
                cardSlow: sci(sol.Tvis / sol.T, 1),
            };
        },

        titleText(t, panel, sol) {
            return sol.pt.name + ' ' + sol.pt.sym
                 + '　r = ' + fmtLen(sol.r)
                 + '　T = ' + fmtTime(sol.T)
                 + '　迴旋方向：' + (sol.ccw ? '逆時針' : '順時針')
                 + '（螢幕上）';
        },

        draw,
    });

    if (typeof window !== 'undefined') {
        window.__page = {
            PARTICLES, CX, CY, R0, V0, B0,
            fmtLen, fmtTime, sci, scaleBar, step,
            resetOrbit,
            getPhase() { return phase; },
            setPhase(v) { phase = v; },
            getTrail() { return trail.slice(); },
        };
    }
})();
