/**
 * 🔺 稜鏡折射、最小偏向角與色散
 *
 * 一束光從左邊射進一個頂角 A = 60° 的三角形稜鏡，在左面折射、在右面
 * 再折射一次，最後離開稜鏡。入射線與出射線的夾角就是偏向角 d。
 *
 * ==========================================================================
 * ⚠️ 公式與符號沿用教材
 * ==========================================================================
 * 頂角 A、入射角 θ₁、出射角 θ₄、偏向角 d：
 *
 *     d = θ₁ + θ₄ − A
 *
 * 當 θ₁ = θ₄ 時偏向角最小，記作 d_min，此時稜鏡內的光線平行於底邊：
 *
 *     n = sin((A + d_min)/2) / sin(A/2)
 *     θ₁,min = sin⁻¹(n sin(A/2))
 *     d_min = 2θ₁,min − A
 *
 * 色散：同一種介質對不同顏色的折射率不同。紫光的 n 最大、偏向最大；
 * 紅光的 n 最小、偏向最小。
 *
 * ==========================================================================
 * ⚠️ 畫面上的光線是真的用斯涅爾定律逐面算出來的
 * ==========================================================================
 * 左面：θ₂ = sin⁻¹(sinθ₁ / n)，折射線與法線的夾角是 θ₂。
 * 右面：θ₃ 是內部光線與右面法線的夾角，θ₄ = sin⁻¹(n sinθ₃)。
 * 出射點是內部光線與右面的真正交點，不是把光線畫到某個固定高度。
 *
 * ==========================================================================
 * ⚠️ 入射角太小、折射率太大時，右面會全反射
 * ==========================================================================
 * 右面的入射角 θ₃ = A − θ₂。當 n sinθ₃ > 1 時折射線不存在，光在右面
 * 全反射、留在稜鏡裡——這不是 bug，是這一頁要展示的現象之一。發生全反射
 * 時沒有 θ₄，也沒有偏向角 d（出射線根本不存在），卡片與讀數框顯示「—」。
 *
 * θ₁ 的定義域是 30°–85°：30° 時 n ≥ 1.53 的色光剛好在右面全反射，而
 * 其餘色光仍出得去，兩個現象可以同時看到；再往下調，七色會一起消失在
 * 稜鏡裡，反而看不到「有些出得去、有些出不去」的對比。85° 則是畫面還
 * 放得下入射線與出射線的上限。
 */

(function () {
    'use strict';

    const A_DEG = 60;
    const APEX = { x: 400, y: 220 };
    const SIDE = 420;
    const HALF_BASE = SIDE * Math.sin(A_DEG * Math.PI / 360); // 210
    const HEIGHT = SIDE * Math.cos(A_DEG * Math.PI / 360);    // 363.7
    const BL = { x: APEX.x - HALF_BASE, y: APEX.y + HEIGHT };
    const BR = { x: APEX.x + HALF_BASE, y: APEX.y + HEIGHT };

    // 入射角的定義域。理由見檔頭：30° 是「色散模式還看得到五～七色出射」
    // 與「單色光模式看得到全反射」的交會處。
    const THETA_MIN = 30, THETA_MAX = 85;
    const N_MIN = 1.30, N_MAX = 1.60;

    const ENTRY_S = 0.5;           // 入射點在左面的位置（0 = 頂點、1 = 底角）
    const IN_LEN = 260;
    const OUT_LEN = 300;
    const REF_LEN = 150;

    const SCENE_RECT = { x0: 8, y0: 8, x1: 892, y1: 806 };
    const LEGEND = { x: 54, y: 76, gap: 30 };
    // ⚠️ 角度數值住在右上角的讀數框，稜鏡上只留 θ₁／θ₄／d／A 這些符號。
    //    讀數框靠右對齊在 x = 872：右緣還留 28 個世界單位給徽章的內距，
    //    五列在 1100px 下也只長到 y ≈ 294——還在所有光線（y ≥ 350）
    //    與稜鏡右腰的上方。
    const READOUT = { x: 872, y: 76 };
    // ⚠️ 頂角 A 的徽章不能畫在角平分線上。字級放大兩倍之後那顆徽章
    //（尺寸 14）寬約 140 個世界單位，而頂角下方 74 個世界單位處的三角形
    // 只有 85 個世界單位寬——徽章會把頂角的弧和兩條腰一起蓋掉（1100px
    // 時更明顯）。改成畫在稜鏡右腰右側的空位：右上方的圖例第四列較短
    //（約到 x = 364），而徽章左緣在 444，兩者在水平方向不相交。
    // 2026-11：徽章只剩「A」一個符號，比原本更窄；數值搬到 READOUT。
    const A_LABEL = { x: APEX.x + 120, y: APEX.y + 40 };

    const C_PRISM = [30, 41, 59];
    const C_PRISM_FILL = [219, 234, 254];
    const C_DEV = [234, 88, 12];
    const C_THETA1 = [37, 99, 235];
    const C_THETA4 = [22, 163, 74];
    const C_NORMAL = [100, 116, 139];
    const C_TIR = [220, 38, 38];

    // ⚠️ 色散模式的七色 n 不是七個各自固定的數字，而是「中央（黃光）
    //    的 n ＋ 固定偏移」：紅 −0.02、橙 −0.01、黃 0、綠 +0.01、藍 +0.02、
    //    靛 +0.03、紫 +0.04。滑桿的 n 就是這個中央值，所以 1.50 時
    //    紅 1.48、紫 1.54（和舊版的固定光譜完全一樣），拉到 1.55 時
    //    七色一起變成 1.53–1.59。整條光譜會平移，但紫光永遠在紅光右邊。
    const SPECTRUM_CENTER_N = 1.50;
    const SPECTRUM = [
        { name: '紅', n: 1.48, col: [220, 38, 38] },
        { name: '橙', n: 1.49, col: [249, 115, 22] },
        { name: '黃', n: 1.50, col: [202, 138, 4] },
        { name: '綠', n: 1.51, col: [22, 163, 74] },
        { name: '藍', n: 1.52, col: [37, 99, 235] },
        { name: '靛', n: 1.53, col: [79, 70, 229] },
        { name: '紫', n: 1.54, col: [147, 51, 234] },
    ];

    // 情境預設：一次把 θ₁（必要時連 n）帶到某個教學上有意義的位置。
    // 這些值由 presetPlan() 解讀，不直接寫在 <select> 的事件裡。
    const PRESET_OPTIONS = [
        { v: 'custom', t: '自訂角度' },
        { v: 'min', t: '跳到最小偏向角' },
        { v: '30', t: 'θ₁ = 30°' },
        { v: '40', t: 'θ₁ = 40°' },
        { v: '50', t: 'θ₁ = 50°' },
        { v: '60', t: 'θ₁ = 60°' },
        { v: '70', t: 'θ₁ = 70°' },
        { v: '80', t: 'θ₁ = 80°' },
        { v: 'tir', t: '全反射示範' },
    ];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    /** θ₁ 的夾制只有這一個家：滑桿、畫面與 START 掃描都走它。 */
    function clampTheta(v) {
        return clamp(num(v, 50), THETA_MIN, THETA_MAX);
    }

    function clampN(v) {
        return clamp(num(v, 1.50), N_MIN, N_MAX);
    }

    function unit(v) {
        const l = Math.hypot(v.x, v.y);
        return { x: v.x / l, y: v.y / l };
    }

    /** 把向量旋轉 ang（弧度；畫面 y 向下，所以正角看起來是順時針）。 */
    function rot(v, ang) {
        const c = Math.cos(ang), s = Math.sin(ang);
        return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
    }

    function dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    function cross(a, b) {
        return a.x * b.y - a.y * b.x;
    }

    function angleOf(v) {
        return Math.atan2(v.y, v.x);
    }

    /**
     * 兩個方向之間的「短弧」。
     * atan2 會把 210° 回報成 −150°，直接取 min/max 會畫出 310° 的大弧
     * （入射角那一圈看起來像一個完整的圓）。先把其中一個轉到另一個附近。
     */
    function arcPair(a, b) {
        const TAU = Math.PI * 2;
        while (a < 0) a += TAU;
        while (b < 0) b += TAU;
        if (b - a > Math.PI) b -= TAU;
        else if (a - b > Math.PI) a -= TAU;
        return a < b ? [a, b] : [b, a];
    }

    /** 左面的內側法線（指向稜鏡裡面）。 */
    function leftInwardNormal() {
        const e = unit({ x: BL.x - APEX.x, y: BL.y - APEX.y });
        const n = { x: -e.y, y: e.x };
        // 稜鏡中心在頂點的正下方（y 向下），用這個方向挑出內側。
        return dot(n, { x: 0, y: 1 }) > 0 ? n : { x: -n.x, y: -n.y };
    }

    /** 右面的外側法線。 */
    function rightOutwardNormal() {
        const e = unit({ x: BR.x - APEX.x, y: BR.y - APEX.y });
        const n = { x: -e.y, y: e.x };       // 其中一個法線
        return dot(n, { x: 1, y: 0 }) > 0 ? n : { x: -n.x, y: -n.y };
    }

    const N_LEFT = leftInwardNormal();
    const N_RIGHT_OUT = rightOutwardNormal();

    /** 射線 P + t·d 與線段 Q1–Q2 的交點。 */
    function intersectSegment(P, d, Q1, Q2) {
        const e = { x: Q2.x - Q1.x, y: Q2.y - Q1.y };
        const det = cross(e, d);
        if (Math.abs(det) < 1e-12) return null;
        const c = { x: Q1.x - P.x, y: Q1.y - P.y };
        const t = cross(e, c) / det;
        const u = cross(d, c) / det;
        return { t, u, point: { x: P.x + d.x * t, y: P.y + d.y * t } };
    }

    /**
     * 全反射之後，內部光線會撞到另外兩條稜邊中的哪一條？
     * 只回傳最近的交點（不含出發的那條右面）。
     */
    function nextBoundary(from, dir) {
        let best = null;
        for (const [q1, q2] of [[APEX, BL], [BL, BR]]) {
            const h = intersectSegment(from, dir, q1, q2);
            if (h && h.t > 1e-6 && h.u >= -1e-9 && h.u <= 1 + 1e-9) {
                if (!best || h.t < best.t) best = h;
            }
        }
        return best ? best.point : null;
    }

    /**
     * 一束光在稜鏡裡的一次完整旅程。
     * 回傳入射線、內部線、出射線（或全反射後的內部線）、交點、四個角、
     * 偏向角。全反射時 theta4 與 deviation 是 null——它們不存在，
     * 不能拿 90° 或 0 假裝。
     */
    function prismGeometry(theta1Deg, n, rawN) {
        const theta1 = clampTheta(theta1Deg);
        // rawN：色散模式的單色 n。它不是使用者輸入，而是「中央 n ± 固定
        // 偏移」算出來的，中央在 1.30／1.60 時紅光／紫光會稍微超出滑桿
        // 範圍（1.28／1.64）。那不是錯誤，所以不在這裡夾掉。
        const nn = rawN ? Math.max(1.000001, num(n, SPECTRUM_CENTER_N))
                        : clampN(n);
        const t1 = theta1 * Math.PI / 180;

        const entry = {
            x: APEX.x + (BL.x - APEX.x) * ENTRY_S,
            y: APEX.y + (BL.y - APEX.y) * ENTRY_S,
        };
        const dIn = rot(N_LEFT, -t1);
        const start = {
            x: entry.x - dIn.x * IN_LEN,
            y: entry.y - dIn.y * IN_LEN,
        };

        const s2 = Math.sin(t1) / nn;
        const theta2 = Math.asin(clamp(s2, -1, 1));
        const dInside = rot(N_LEFT, -theta2);

        const hit = intersectSegment(entry, dInside, APEX, BR);
        const okExit = !!hit && hit.t > 0 && hit.u >= -1e-9 && hit.u <= 1 + 1e-9;
        const exit = hit ? hit.point : {
            x: APEX.x + (BR.x - APEX.x) * 0.5,
            y: APEX.y + (BR.y - APEX.y) * 0.5,
        };

        const theta3 = Math.acos(clamp(dot(dInside, N_RIGHT_OUT), -1, 1));
        const s4 = nn * Math.sin(theta3);
        const tir = s4 > 1;

        let theta4 = null, dOut, end, bounce = null;
        if (tir) {
            // 全反射：內部光線對右面法線反射，停在下一條稜邊上。
            // dOut 在這個分支是**反射線方向**，不是出射線方向；
            // 繪圖端靠 beam.tir 分辨，不會把它畫到稜鏡外面。
            const dn = dot(dInside, N_RIGHT_OUT);
            dOut = {
                x: dInside.x - 2 * dn * N_RIGHT_OUT.x,
                y: dInside.y - 2 * dn * N_RIGHT_OUT.y,
            };
            bounce = nextBoundary(exit, dOut);
            end = bounce || exit;
        } else {
            theta4 = Math.asin(clamp(s4, -1, 1));
            const side = Math.sign(cross(N_RIGHT_OUT, dInside)) || 1;
            dOut = rot(N_RIGHT_OUT, side * theta4);
            end = {
                x: exit.x + dOut.x * OUT_LEN,
                y: exit.y + dOut.y * OUT_LEN,
            };
        }

        const theta4Deg = tir ? null : theta4 * 180 / Math.PI;
        const deviation = tir ? null : theta1 + theta4Deg - A_DEG;
        const theta1Min = Math.asin(clamp(nn * Math.sin(A_DEG * Math.PI / 360), -1, 1))
                          * 180 / Math.PI;
        const dMin = 2 * theta1Min - A_DEG;
        const ok = okExit && (tir ? !!bounce : true);

        return {
            theta1, n: nn,
            entry, start, exit, end, bounce,
            dIn, dInside, dOut,
            theta2: theta2 * 180 / Math.PI,
            theta3: theta3 * 180 / Math.PI,
            theta4: theta4Deg,
            deviation, theta1Min, dMin,
            nearMin: !tir && Math.abs(theta1 - theta1Min) < 0.8,
            ok, tir,
        };
    }

    /** 七色光譜：nCenter 是中央（黃光）的折射率，其餘依固定偏移展開。 */
    function spectrumGeometry(theta1Deg, nCenter) {
        const center = clampN(nCenter);
        return SPECTRUM.map(c => {
            const n = center + (c.n - SPECTRUM_CENTER_N);
            return Object.assign({}, c, {
                n,
                g: prismGeometry(theta1Deg, n, true),
            });
        });
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = panel.mode === 'dispersion' ? 'dispersion' : 'single';
        const theta1 = clampTheta(panel.theta1);
        const n = clampN(panel.n);
        const beam = prismGeometry(theta1, n);
        const spectrum = spectrumGeometry(theta1, n);
        const red = spectrum[0];
        const violet = spectrum[spectrum.length - 1];
        const anyTir = spectrum.some(c => c.g.tir);
        // 角分散只有在紅、紫兩色都真的射出時才有定義。
        // 任何一色全反射時 spread 是 null，不是「0」或「紫光 − 紅光」。
        const spread = (red.g.tir || violet.g.tir)
            ? null : violet.g.deviation - red.g.deviation;
        return {
            mode, theta1, n, beam, spectrum, red, violet,
            spread, anyTir,
            apexAngle: A_DEG,
        };
    }

    // ======================================================================
    // 讀數框：數值全部集中在這裡，稜鏡上只留符號
    // ======================================================================

    function devText(g) {
        return g.tir ? '全反射' : `d = ${g.deviation.toFixed(2)}°`;
    }

    function readoutRows(state) {
        if (state.mode === 'dispersion') {
            return [
                { text: `θ₁ = ${state.theta1.toFixed(1)}°`, col: C_THETA1 },
                { text: `n = ${state.red.n.toFixed(2)}–${state.violet.n.toFixed(2)}`,
                  col: C_NORMAL },
                { text: `紅光 ${devText(state.red.g)}`, col: state.red.col },
                { text: `紫光 ${devText(state.violet.g)}`, col: state.violet.col },
                { text: `A = ${A_DEG}°`, col: C_NORMAL },
            ];
        }
        const b = state.beam;
        return [
            { text: `θ₁ = ${b.theta1.toFixed(1)}°`, col: C_THETA1 },
            { text: b.tir ? 'θ₄：全反射' : `θ₄ = ${b.theta4.toFixed(1)}°`, col: C_THETA4 },
            { text: b.tir ? 'd：—' : `d = ${b.deviation.toFixed(2)}°`, col: C_DEV },
            { text: `d_min = ${b.dMin.toFixed(2)}°`, col: C_NORMAL },
            { text: `A = ${A_DEG}°`, col: C_NORMAL },
        ];
    }

    function legendRows(state) {
        const single = state.mode !== 'dispersion';
        const beam = state.beam || {};
        const anyTir = state.anyTir != null
            ? state.anyTir
            : !!(state.spectrum && state.spectrum.some(c => c.g && c.g.tir));
        const rows = [
            { text: '入射光', col: [245, 158, 11] },
            // 色散模式下稜鏡內的光是七色疊在一起，不能再叫「折射光（藍）」。
            single
                ? { text: '折射光', col: [30, 64, 175] }
                : { text: '折射光：七色（紅→紫）', col: [147, 51, 234] },
            {
                // 橙色的「入射方向」虛線只有單色光、而且沒有全反射時才畫。
                text: (single && !beam.tir)
                    ? '灰虛線：法線　橙虛線：入射方向'
                    : '灰虛線：法線',
                col: C_NORMAL,
            },
        ];
        if (!single) {
            rows.push({ text: '紫光 n 最大，偏向最大', col: [147, 51, 234] });
            if (anyTir) rows.push({ text: '部分色光在右面全反射', col: C_TIR });
        } else if (beam.tir) {
            rows.push({ text: '全反射：光留在稜鏡裡', col: C_TIR });
        } else {
            rows.push({ text: 'd：入射線與出射線的夾角', col: C_DEV });
        }
        return rows;
    }

    // ======================================================================
    // 情境預設
    // ======================================================================

    /**
     * 把「情境」選項翻成 θ₁（必要時連 n）。
     * 回傳 null 代表「自訂」——不要動任何滑桿。
     */
    function presetPlan(preset, n) {
        if (!preset || preset === 'custom') return null;
        if (preset === 'min') {
            const nn = clampN(n);
            const th = Math.asin(clamp(nn * Math.sin(A_DEG * Math.PI / 360), -1, 1))
                       * 180 / Math.PI;
            return { theta1: clampTheta(th), n: nn };
        }
        if (preset === 'tir') {
            // 30° + n = 1.60：右面的 n sinθ₃ 約 1.07 > 1，一定全反射。
            return { theta1: 30, n: N_MAX };
        }
        const th = parseFloat(preset);
        if (!isFinite(th)) return null;
        return { theta1: clampTheta(th) };
    }

    function applyPreset(panel) {
        if (!panel) return;
        const plan = presetPlan(panel.preset, panel.n);
        if (!plan) return;
        if (plan.n != null) panel.set('n', plan.n);
        panel.set('theta1', plan.theta1);
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawPrism(p, view) {
        p.push();
        p.stroke(C_PRISM[0], C_PRISM[1], C_PRISM[2], 220);
        p.strokeWeight(OpticsScene.L(view, 3, 2));
        p.fill(C_PRISM_FILL[0], C_PRISM_FILL[1], C_PRISM_FILL[2], 110);
        p.beginShape();
        p.vertex(view.toScreenX(APEX.x), view.toScreenY(APEX.y));
        p.vertex(view.toScreenX(BL.x), view.toScreenY(BL.y));
        p.vertex(view.toScreenX(BR.x), view.toScreenY(BR.y));
        p.endShape(p.CLOSE);
        p.pop();
    }

    /** 入射點與出射點的法線。 */
    function drawNormals(p, view, beam) {
        const OS = OpticsScene;
        const L = 78;
        OS.drawNormal(p, view,
            { x: beam.entry.x - N_LEFT.x * L, y: beam.entry.y - N_LEFT.y * L },
            { x: beam.entry.x + N_LEFT.x * L, y: beam.entry.y + N_LEFT.y * L });
        OS.drawNormal(p, view,
            { x: beam.exit.x - N_RIGHT_OUT.x * L, y: beam.exit.y - N_RIGHT_OUT.y * L },
            { x: beam.exit.x + N_RIGHT_OUT.x * L, y: beam.exit.y + N_RIGHT_OUT.y * L });
    }

    /** 入射角：入射線（由頂點往回看）與外側法線的夾角。兩種模式都畫。 */
    function drawIncidenceAngle(p, view, beam) {
        const OS = OpticsScene;
        const e = beam.entry;
        const aIn = angleOf({ x: -beam.dIn.x, y: -beam.dIn.y });
        const aN = angleOf({ x: -N_LEFT.x, y: -N_LEFT.y });
        const pairIn = arcPair(aIn, aN);
        OS.drawAngleArc(p, view, e, pairIn[0], pairIn[1], 66, C_THETA1);
        const midIn = (pairIn[0] + pairIn[1]) / 2;
        OS.worldBadge(p, view, e.x + 104 * Math.cos(midIn), e.y + 104 * Math.sin(midIn),
                      'θ₁', { size: 12, col: C_THETA1, align: 'center' });
    }

    /** 出射角與偏向角：只有「光真的從右面出去」時才存在。 */
    function drawExitAngles(p, view, beam) {
        const OS = OpticsScene;
        const x = beam.exit;

        const aOut = angleOf(beam.dOut);
        const aRn = angleOf(N_RIGHT_OUT);
        const pairOut = arcPair(aOut, aRn);
        OS.drawAngleArc(p, view, x, pairOut[0], pairOut[1], 62, C_THETA4);
        // 標籤放在出射線的「外側」（射線下方），避開偏向角那顆。
        const perp = { x: -beam.dOut.y, y: beam.dOut.x };
        OS.worldBadge(p, view,
                      x.x + beam.dOut.x * 92 + perp.x * 30,
                      x.y + beam.dOut.y * 92 + perp.y * 30,
                      'θ₄', { size: 12, col: C_THETA4, align: 'center' });

        // 偏向角：從出射點沿入射方向畫一條參考線，和出射線的夾角就是 d
        const ref = {
            x: x.x + beam.dIn.x * REF_LEN,
            y: x.y + beam.dIn.y * REF_LEN,
        };
        OS.dashed(p, view, x, ref, C_DEV, { w: 1.3, dash: [4, 6] });
        const aRef = angleOf(beam.dIn);
        const pairDev = arcPair(aRef, aOut);
        OS.drawAngleArc(p, view, x, pairDev[0], pairDev[1], 44, C_DEV);
        const midDev = (pairDev[0] + pairDev[1]) / 2;
        OS.worldBadge(p, view, x.x + 82 * Math.cos(midDev), x.y + 82 * Math.sin(midDev),
                      'd', { size: 12, col: C_DEV, align: 'center' });
    }

    /** 全反射時，在右面外側標一顆「全反射」。 */
    function drawTirBadge(p, view, beam) {
        const OS = OpticsScene;
        OS.worldBadge(p, view,
                      beam.exit.x + N_RIGHT_OUT.x * 58,
                      beam.exit.y + N_RIGHT_OUT.y * 58,
                      '全反射', { size: 12, col: C_TIR, align: 'center' });
    }

    function drawBeamSingle(p, view, beam) {
        const OS = OpticsScene;
        OS.line(p, view, beam.start, beam.entry, OS.C_RAY,
                { w: 2.8, arrowAt: 0.55, head: 11 });
        OS.line(p, view, beam.entry, beam.exit, [37, 99, 235],
                { w: 2.8, arrowAt: 0.55, head: 10 });
        // 沒有全反射時這一段是出射線；全反射時它是反射回稜鏡裡的光。
        // 兩種情況都是 beam.end，差別只在它落在哪裡——由幾何決定，不是旗標。
        OS.line(p, view, beam.exit, beam.end, [37, 99, 235],
                { w: 2.8, arrowAt: 0.55, head: 10 });

        OS.drawDot(p, view, beam.entry.x, beam.entry.y, OS.C_RAY, 5);
        OS.drawDot(p, view, beam.exit.x, beam.exit.y, [37, 99, 235], 5);
        if (beam.tir && beam.bounce) {
            OS.drawDot(p, view, beam.bounce.x, beam.bounce.y, [37, 99, 235], 4.5);
        }
    }

    function drawBeamDispersion(p, view, state) {
        const OS = OpticsScene;
        const g0 = state.spectrum[0].g;
        OS.line(p, view, g0.start, g0.entry, OS.C_RAY,
                { w: 2.8, arrowAt: 0.55, head: 11 });

        for (const row of state.spectrum) {
            const g = row.g;
            OS.line(p, view, g.entry, g.exit, row.col,
                    { w: 2.3, arrowAt: 0.5, head: 8 });
            OS.line(p, view, g.exit, g.end, row.col,
                    { w: 2.3, arrowAt: 0.55, head: 9 });
            OS.drawDot(p, view, g.exit.x, g.exit.y, row.col, 4.5);
        }
        OS.drawDot(p, view, state.beam.entry.x, state.beam.entry.y, OS.C_RAY, 5);
    }

    /** 左上角圖例。 */
    function drawLegend(p, view, state) {
        const OS = OpticsScene;
        const rows = legendRows(state);
        const gap = OS.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OS.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                          rows[i].text, { size: 12, col: rows[i].col, align: 'left' });
        }
    }

    /** 右上角讀數框：稜鏡上只留符號，數值全部搬到這裡。 */
    function drawReadout(p, view, state) {
        const OS = OpticsScene;
        const rows = readoutRows(state);
        const gap = OS.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            OS.worldBadge(p, view, READOUT.x, READOUT.y + i * gap,
                          rows[i].text, { size: 12, col: rows[i].col, align: 'right' });
        }
    }

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;
        drawPrism(p, view);

        // 頂角 A 的弧與符號（位置見 A_LABEL：不能壓在弧與兩條腰上）
        OS.drawAngleArc(p, view, APEX,
                        A_DEG * Math.PI / 180, Math.PI - A_DEG * Math.PI / 180,
                        46, C_NORMAL);
        OS.worldBadge(p, view, A_LABEL.x, A_LABEL.y, 'A',
                      { size: 14, col: C_NORMAL });

        // 色散模式用中央（綠光）那條光線的出入點畫法線，不然法線會落在
        // 一條畫面上不存在的光線上。
        drawNormals(p, view,
                    state.mode === 'dispersion' ? state.spectrum[3].g : state.beam);

        if (state.mode === 'dispersion') {
            drawBeamDispersion(p, view, state);
            drawIncidenceAngle(p, view, state.beam);
        } else {
            drawBeamSingle(p, view, state.beam);
            drawIncidenceAngle(p, view, state.beam);
            if (state.beam.tir) drawTirBadge(p, view, state.beam);
            else drawExitAngles(p, view, state.beam);
        }

        drawLegend(p, view, state);
        drawReadout(p, view, state);

        // 光脈衝：沿著中央那條光線走（全反射時會走到反射點為止）
        if (panel && panel.started) {
            const g = state.mode === 'dispersion' ? state.spectrum[3].g : state.beam;
            const pts = [g.start, g.entry, g.exit, g.end];
            let total = 0;
            const lens = [];
            for (let i = 1; i < pts.length; i++) {
                const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
                lens.push(l); total += l;
            }
            let s = (t * 260) % total;
            if (s < 0) s += total;
            let k = 0;
            while (k < lens.length - 1 && s > lens[k]) { s -= lens[k]; k++; }
            const a = pts[k], b = pts[k + 1];
            const f = lens[k] > 1e-9 ? s / lens[k] : 0;
            OS.drawPulse(p, view, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f,
                         OS.C_RAY, { r: 8 });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isSingle = p => p.mode !== 'dispersion';
    const isDispersion = p => p.mode === 'dispersion';

    OpticsScene.run({
        formula: 'n=\\frac{\\sin\\frac{A+d_{\\min}}{2}}{\\sin\\frac{A}{2}}',
        formulaFallback: 'n = sin((A + d_min)/2) / sin(A/2)',

        controls: {
            selects: [
                {
                    key: 'mode', label: '光線', def: 'single', live: true,
                    options: [
                        { v: 'single', t: '單色光（看偏向角）' },
                        { v: 'dispersion', t: '色散（七色光）' },
                    ],
                },
                {
                    // ⚠️ 這一支**不是** live：選情境＝換一組參數，START 正在
                    //    掃描時要停下來（live 的 'view' 分支不會 reset），
                    //    不然下一幀 onFrame 又會把 θ₁ 拉走，選單停在情境上
                    //    而畫面完全不是那個角度。
                    key: 'preset', label: '情境', def: 'custom', live: false,
                    options: PRESET_OPTIONS,
                },
            ],
            sliders: [
                { key: 'theta1', label: '入射角 θ₁', def: 50,
                  min: THETA_MIN, max: THETA_MAX, step: 0.5, unit: '°', dec: 1 },
                // ⚠️ 兩種模式都出現。單色光模式是那條光線的 n；色散模式
                //    是中央（黃光）的 n，七色依固定偏移一起平移。
                { key: 'n', label: '折射率 n', def: 1.50, min: N_MIN, max: N_MAX,
                  step: 0.01, unit: '', dec: 2 },
            ],
        },

        cards: [
            CARD('入射角 θ₁', 'cardTheta1', '°', true, isSingle),
            CARD('出射角 θ₄', 'cardTheta4', '°', false, isSingle),
            CARD('折射率 n', 'cardN', '', true, isSingle),
            CARD('偏向角 d', 'cardDeviation', '°', true, isSingle),
            CARD('最小偏向角 d_min', 'cardDmin', '°', false, isSingle),
            CARD('θ₁,min = sin⁻¹(n sin A/2)', 'cardTheta1min', '°', false, isSingle),
            CARD('是否接近最小偏向', 'cardNearMin', '', false, isSingle),
            CARD('出射狀態', 'cardState', '', false, isSingle),
            CARD('入射角 θ₁', 'cardTheta1d', '°', true, isDispersion),
            CARD('紅光折射率 n_red', 'cardNRed', '', false, isDispersion),
            CARD('紫光折射率 n_violet', 'cardNViolet', '', false, isDispersion),
            CARD('紅光偏向角', 'cardDevRed', '°', false, isDispersion),
            CARD('紫光偏向角', 'cardDevViolet', '°', true, isDispersion),
            CARD('角分散（紫 − 紅）', 'cardSpread', '°', true, isDispersion),
            CARD('哪一色偏向最大', 'cardColorRule', '', false, isDispersion),
            CARD('色散狀態', 'cardStateD', '', false, isDispersion),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            const b = g.beam;
            return {
                cardTheta1: b.theta1.toFixed(1),
                cardTheta4: b.tir ? '—' : b.theta4.toFixed(1),
                cardN: b.n.toFixed(2),
                cardDeviation: b.tir ? '—' : b.deviation.toFixed(2),
                cardDmin: b.dMin.toFixed(2),
                cardTheta1min: b.theta1Min.toFixed(2),
                cardNearMin: b.tir ? '—'
                    : (b.nearMin ? '是（內部光線平行底邊）' : '否'),
                cardState: b.tir ? '全反射（光未從右面射出）' : '正常出射',
                cardTheta1d: g.theta1.toFixed(1),
                cardNRed: g.red.n.toFixed(2),
                cardNViolet: g.violet.n.toFixed(2),
                cardDevRed: g.red.g.tir ? '—' : g.red.g.deviation.toFixed(2),
                cardDevViolet: g.violet.g.tir ? '—' : g.violet.g.deviation.toFixed(2),
                cardSpread: g.spread == null ? '—' : g.spread.toFixed(2),
                cardColorRule: '紫光（n 最大）',
                cardStateD: g.anyTir ? '部分色光全反射' : '七色都射出',
            };
        },

        titleText(t, panel, g) {
            if (g.mode === 'dispersion') {
                const nRange = `n = ${g.red.n.toFixed(2)}–${g.violet.n.toFixed(2)}`;
                if (g.anyTir) {
                    return `θ₁ = ${g.theta1.toFixed(1)}°　${nRange}`
                         + `　部分色光在右面全反射`;
                }
                return `θ₁ = ${g.theta1.toFixed(1)}°　${nRange}`
                     + `　紫光偏向 ${g.violet.g.deviation.toFixed(1)}°`
                     + `　紅光偏向 ${g.red.g.deviation.toFixed(1)}°`;
            }
            if (g.beam.tir) {
                // 1100px 時底部黑條的字級下限是 14px；「光在右面反射回
                // 稜鏡裡」那一段會讓整行超出畫布、兩端被裁掉。原因在左邊
                // 圖例與右面的「全反射」徽章裡已經寫得很清楚。
                return `θ₁ = ${g.theta1.toFixed(1)}°　n = ${g.n.toFixed(2)}`
                     + `　全反射（右面）`
                     + `　d_min = ${g.beam.dMin.toFixed(2)}°`;
            }
            return `θ₁ = ${g.theta1.toFixed(1)}°　n = ${g.n.toFixed(2)}`
                 + `　d = ${g.beam.deviation.toFixed(2)}°`
                 + `　d_min = ${g.beam.dMin.toFixed(2)}°`;
        },

        onFrame(t, panel) {
            // 讓入射角緩慢掃過最小偏向角附近；偏向角會先減小、再變大。
            const theta = 55 + 14 * Math.sin(t * 0.7);
            panel.set('theta1', clampTheta(theta));
        },

        /**
         * 控制項的後鉤子（lab-scene 的 onControl）。
         * - 選了情境 → 把 θ₁（必要時 n）搬到滑桿上。
         * - 自己動了滑桿、或按了 START → 情境回到「自訂」，避免選單還停在
         *   上一個情境、畫面卻已經不是那個角度。
         */
        onControl(reason, panel, key) {
            if (!panel) return;
            if (key === 'preset') {
                applyPreset(panel);
                return;
            }
            if (reason === 'param' || reason === 'start') {
                if (panel.preset !== 'custom') panel.set('preset', 'custom');
            }
        },

        draw(p, view, t, panel, sol) {
            drawScene(p, view, t, panel, sol);
        },
    });

    // ======================================================================
    // 給驗證器的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            A_DEG, APEX, SIDE, HALF_BASE, HEIGHT, BL, BR, A_LABEL,
            THETA_MIN, THETA_MAX, N_MIN, N_MAX,
            ENTRY_S, IN_LEN, OUT_LEN, REF_LEN, SCENE_RECT, LEGEND, READOUT,
            C_PRISM, C_PRISM_FILL, C_DEV, C_THETA1, C_THETA4, C_NORMAL, C_TIR,
            SPECTRUM_CENTER_N, SPECTRUM, PRESET_OPTIONS,
            N_LEFT, N_RIGHT_OUT,
            clamp, num, clampTheta, clampN,
            unit, rot, dot, cross, angleOf,
            intersectSegment, nextBoundary, prismGeometry, spectrumGeometry, stateFor,
            readoutRows, legendRows, presetPlan, applyPreset, drawScene,
        };
    }
})();
