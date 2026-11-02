/**
 * 🔭 OpticsKit — 幾何光學的純物理（沒有任何 DOM）
 *
 * 這一支只回答「光線怎麼走」，不畫圖、不碰畫面。光學 02–03、05–06、08、
 * 13–14 的**所有**幾何都從這裡推出來：畫面上一條線的端點、卡片上的角度與
 * 像距、以及驗證器餵進來的參數，走的都是同一組函式。（其餘十頁的物理只有
 * 那一頁會用到，留在頁面檔，見 CLAUDE.md 的判準。）
 *
 * 為什麼要獨立一支：反射定律、平面鏡成像與球面鏡成像看起來是三個題目，
 * 其實是同一件事的三個切面——平面鏡的像就是「每一條反射光線的反向延長線
 * 交於一點」，球面鏡只是把那面鏡子彎成球面。如果各頁各寫一份反射幾何，
 * 總有一天會出現「反射頁的 θ₁ = θ₂，成像頁的兩條光線卻不遵守反射定律」
 * 這種互相打臉的情形，而兩頁的卡片都會是對的。
 *
 * 球面鏡的 v、M、像的位置、兩條作圖光線與弧面上的反射點全部由
 * sphericalMirrorGeometry() 一次算完；頁面只負責挑要畫哪幾條。
 *
 * ==========================================================================
 * ⚠️ 座標約定
 * ==========================================================================
 * 世界座標是**螢幕慣例**：x 向右、y **向下**。所以「鏡面上方」是 y 比較小，
 * 「法線朝上」是 (0, −1)。角度一律用**度**，而且都是從法線量起：
 *
 *   入射角 θ₁：入射光線與法線的夾角
 *   反射角 θ₂：反射光線與法線的夾角
 *
 * 反射定律的「反射角等於入射角」量的是與法線的夾角，不是與鏡面。
 * 頁面上的滑桿、卡片、角度弧全部共用它；要改成與鏡面量，必須三處一起改。
 *
 * ==========================================================================
 * ⚠️ 反射向量的公式
 * ==========================================================================
 * 入射方向 d、鏡面單位法線 n，反射方向是
 *
 *   r = d − 2(d·n)n
 *
 * 這一支把它寫成 reflectVector()，而不是在頁面上用 sin/cos 拼座標。原因是
 * 前者對**任何方向**的鏡面都成立，後者只對水平鏡面成立；以後要加球面鏡或
 * 斜鏡面時，換的是法線，不是整個幾何。
 */
var OpticsKit = (function () {
    'use strict';

    const DEG = Math.PI / 180;
    const RAD = 180 / Math.PI;
    const C_LIGHT = 299792458;   // 真空中的光速（m/s）

    // ======================================================================
    // 向量小工具
    // ======================================================================

    function clamp(v, lo, hi) {
        return v < lo ? lo : v > hi ? hi : v;
    }

    function norm(v) {
        const m = Math.hypot(v.x, v.y);
        return m > 0 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 };
    }

    function dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    function lerp(a, b, t) {
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    /** 兩個方向（度）之間比較小的夾角，0～180 */
    function angleBetweenDeg(a, b) {
        const ma = Math.hypot(a.x, a.y), mb = Math.hypot(b.x, b.y);
        if (!(ma > 0) || !(mb > 0)) return 0;
        const c = clamp(dot(a, b) / (ma * mb), -1, 1);
        return Math.acos(c) * RAD;
    }

    /** 一條方向與單位法線的夾角（度）。取絕對值，所以法線朝哪一邊都一樣。 */
    function angleFromNormalDeg(d, n) {
        const m = Math.hypot(d.x, d.y);
        if (!(m > 0)) return 0;
        return Math.acos(clamp(Math.abs(dot(d, n)) / m, -1, 1)) * RAD;
    }

    /**
     * 反射方向 r = d − 2(d·n)n。
     * d、n 不一定要是單位向量；回傳的 r 是單位向量。
     */
    function reflectVector(d, n) {
        const nn = norm(n);
        const dd = norm(d);
        const k = 2 * dot(dd, nn);
        return norm({ x: dd.x - k * nn.x, y: dd.y - k * nn.y });
    }

    // ======================================================================
    // 光的反射定律
    // ======================================================================

    /**
     * 水平鏡面的反射幾何。
     *
     * @param {number} thetaDeg  入射角（度），從法線量起
     * @param {object} o
     *   o.O      入射點（世界座標），預設 (450, 600)
     *   o.len    每一條光線的長度（世界單位），預設 360
     *   o.side   +1：光從左上方射入（預設）；−1：光從右上方射入（光路可逆）
     *
     * @returns {object}
     *   P、O、Q       入射起點、入射點、反射終點
     *   N             法線的上端
     *   dIn、dOut     入射與反射的單位方向（都是從 O 出發的方向）
     *   theta1Deg     = thetaDeg
     *   theta2Deg     由 reflectVector 算出來，不是抄進去的
     *   rayAngleDeg   兩條光線（當成直線）的夾角 = 2θ₁
     *   deviationDeg  偏向角 = 180° − 2θ₁
     *   pathLen       光走過的總長 = 2·len
     */
    function reflectionGeometry(thetaDeg, o) {
        o = o || {};
        const O = o.O || { x: 450, y: 600 };
        const len = o.len || 360;
        const side = o.side === -1 ? -1 : 1;
        const th = clamp(thetaDeg, 0, 89.5) * DEG;
        const sin = Math.sin(th), cos = Math.cos(th);

        // 螢幕慣例：法線朝上 = (0, −1)。
        const n = { x: 0, y: -1 };
        const P = { x: O.x - side * len * sin, y: O.y - len * cos };
        const dIn = norm({ x: O.x - P.x, y: O.y - P.y });
        const dOut = reflectVector(dIn, n);
        const Q = { x: O.x + dOut.x * len, y: O.y + dOut.y * len };
        const N = { x: O.x, y: O.y - len };

        return {
            O, P, Q, N,
            side, len,
            normal: n,
            dIn, dOut,
            theta1Deg: th * RAD,
            theta2Deg: angleFromNormalDeg(dOut, n),
            rayAngleDeg: 2 * th * RAD,
            mirrorAngleDeg: 90 - th * RAD,
            deviationDeg: 180 - 2 * th * RAD,
            pathLen: 2 * len,
            // 兩條光線分別在法線的哪一側：P、Q 的 x 與 O.x 比較
            incidentSide: Math.sign(P.x - O.x),
            reflectedSide: Math.sign(Q.x - O.x),
        };
    }

    /**
     * 反射光線上「走了 s 之後」的位置。
     * s 以世界單位計；s < len 在入射段，len < s < 2·len 在反射段。
     * 超出就停在終點（動畫迴圈由呼叫端取模）。
     */
    function reflectionPointAt(g, s) {
        const t = clamp(s, 0, g.pathLen);
        if (t <= g.len) return lerp(g.P, g.O, g.len > 0 ? t / g.len : 1);
        return lerp(g.O, g.Q, g.len > 0 ? (t - g.len) / g.len : 1);
    }

    // ======================================================================
    // 光的折射與折射定律
    // ======================================================================

    /**
     * 水平介面上的折射幾何。
     *
     * 介質 1 是**入射介質**、介質 2 是**折射介質**。這個編號跟著光線的角色
     * 走，不跟著畫面上下走：`from: 'bottom'` 時介質 1 在介面下方。頁面要畫
     * 「介質 1／介質 2」的區域標籤時，問回傳的 `incidentMediumSide` 與
     * `refractedMediumSide`，不要自己假定介質 1 在上半邊。
     *
     * @param {number} theta1Deg 入射角（度），從法線量起
     * @param {object} o
     *   o.O     入射點（世界座標），預設 (450, 470)
     *   o.n1    入射介質的絕對折射率，預設 1
     *   o.n2    折射介質的絕對折射率，預設 1.5
     *   o.from  'top'：光由上方射入（預設）；'bottom'：光由下方射入
     *   o.len1  入射段的長度（世界單位），預設 330
     *   o.len2  折射段的長度（世界單位），預設 330
     *   o.lenRefl 反射段的長度（世界單位），預設與 len1 相同
     *
     * @returns {object}
     *   P、O、Q       入射起點、入射點、折射終點（全反射時 Q 是 null）
     *   R             反射終點（反射線永遠存在，不論有沒有全反射）
     *   dIn、dOut、dRefl  行進方向（單位向量）；dOut 全反射時是 null
     *   theta1Deg、theta2Deg   入射角與折射角；全反射時 theta2Deg 是 null
     *   sin1、sin2    sin θ₁ 與 sin θ₂；全反射時 sin2 是 null
     *   sin2Raw       (n₁/n₂)·sin θ₁，全反射時大於 1
     *   tir           true 表示 n₁ sin θ₁ > n₂，沒有折射光線
     *   criticalDeg   n₁ > n₂ 時的臨界角，其餘是 null
     *   relativeIndex n₂/n₁（介質 2 對介質 1 的相對折射率）
     *   speed1、speed2、speedRatio  光在兩介質中的速率（m/s）與 v₁/v₂
     *   bend          'toward'（偏向法線）／'away'（偏離法線）／'none'
     *   deviationDeg  |θ₂ − θ₁|
     *   pathLen       入射段＋折射段的總長（全反射時只算入射段）
     *   reflectionPathLen  入射段＋反射段的總長（全反射頁的脈衝走這條）
     */
    function refractionGeometry(theta1Deg, o) {
        o = o || {};
        const O = o.O || { x: 450, y: 470 };
        const n1 = o.n1 == null ? 1 : o.n1;
        const n2 = o.n2 == null ? 1.5 : o.n2;
        const fromTop = o.from !== 'bottom';
        const len1 = o.len1 || 330;
        const len2 = o.len2 || 330;
        const lenRefl = o.lenRefl || len1;

        const th1 = clamp(theta1Deg, 0, 89.9) * DEG;
        const sin1 = Math.sin(th1);
        const cos1 = Math.cos(th1);
        const sin2Raw = (n1 / n2) * sin1;
        const tir = sin2Raw > 1;
        const th2 = tir ? null : Math.asin(clamp(sin2Raw, -1, 1));
        const cos2 = tir ? 0 : Math.cos(th2);

        // 光跨過介面時 y 往哪一邊走：由上往下是 +1，由下往上是 −1。
        const down = fromTop ? 1 : -1;
        const dIn = { x: sin1, y: down * cos1 };
        const P = { x: O.x - len1 * dIn.x, y: O.y - len1 * dIn.y };
        const dOut = tir ? null : { x: Math.sin(th2), y: down * cos2 };
        const Q = tir ? null : { x: O.x + len2 * dOut.x, y: O.y + len2 * dOut.y };

        // 反射線永遠存在：把 dIn 對介面法線 (0,1) 做鏡射。
        // 反射線留在入射介質那一側，所以 y 分量與 dIn 相反。
        const dRefl = { x: dIn.x, y: -dIn.y };
        const R = {
            x: O.x + lenRefl * dRefl.x,
            y: O.y + lenRefl * dRefl.y,
        };

        return {
            O, P, Q, R,
            dRefl,
            lenRefl,
            reflectedLen: lenRefl,
            reflectionPathLen: len1 + lenRefl,
            reflectedSide: Math.sign(R.x - O.x),
            n1, n2, fromTop, from: fromTop ? 'top' : 'bottom',
            incidentMediumIndex: n1,
            refractedMediumIndex: n2,
            topIndex: fromTop ? n1 : n2,
            bottomIndex: fromTop ? n2 : n1,
            incidentMediumSide: fromTop ? 'top' : 'bottom',
            refractedMediumSide: fromTop ? 'bottom' : 'top',
            len1, len2,
            normal: { x: 0, y: 1 },
            dIn, dOut,
            theta1Deg: th1 * RAD,
            theta2Deg: tir ? null : th2 * RAD,
            sin1,
            sin2: tir ? null : Math.sin(th2),
            sin2Raw,
            tir,
            // n₁ = n₂ 時臨界角是 90°（折射線沿介面），仍然有定義；
            // 只有 n₁ < n₂ 才沒有臨界角。
            criticalDeg: n1 >= n2 ? Math.asin(clamp(n2 / n1, -1, 1)) * RAD : null,
            relativeIndex: n2 / n1,
            speed1: C_LIGHT / n1,
            speed2: C_LIGHT / n2,
            speedRatio: (C_LIGHT / n1) / (C_LIGHT / n2),
            bend: tir ? null : (th2 < th1 - 1e-12 ? 'toward'
                              : th2 > th1 + 1e-12 ? 'away' : 'none'),
            deviationDeg: tir ? null : Math.abs((th2 - th1) * RAD),
            pathLen: tir ? len1 : len1 + len2,
            incidentLen: len1,
            refractedLen: tir ? 0 : len2,
            incidentSide: Math.sign(P.x - O.x),
            refractedSide: tir ? null : Math.sign(Q.x - O.x),
        };
    }

    /**
     * 折射光路上「走了 s 之後」的位置。
     * s 以世界單位計；s < len1 在入射段，len1 < s < pathLen 在折射段。
     * 全反射時沒有折射段，s 超過 len1 就停在 O。
     */
    function refractionPointAt(g, s) {
        const t = clamp(s, 0, g.pathLen);
        if (t <= g.len1) return lerp(g.P, g.O, g.len1 > 0 ? t / g.len1 : 1);
        if (!g.Q) return g.O;
        return lerp(g.O, g.Q, g.len2 > 0 ? (t - g.len1) / g.len2 : 1);
    }

    /**
     * 折射頁那條「入射 → 反射」光路上「走了 s 之後」的位置。
     * 反射線永遠存在，所以全反射時脈衝沿著它離開介面；沒有全反射時，
     * 這一支畫的仍然是反射光，不是折射光。
     */
    function refractionReflectionPointAt(g, s) {
        const t = clamp(s, 0, g.reflectionPathLen);
        if (t <= g.len1) return lerp(g.P, g.O, g.len1 > 0 ? t / g.len1 : 1);
        return lerp(g.O, g.R, g.reflectedLen > 0
            ? (t - g.len1) / g.reflectedLen : 1);
    }

    /**
     * 折射幾何的檢查：斯涅爾定律、法線兩側、介質疏密與偏折方向。
     *
     * 這裡檢查的是**由向量量出來的角度**，不是把輸入的 θ₁、θ₂ 抄回去比對：
     * dIn、dOut 從 P、O、Q 三個點重新算，所以「卡片上的數字對了，畫面上的
     * 光線卻沒有照那個角度走」這種情形會被抓出來。
     */
    function checkRefraction(g) {
        const errors = [];
        if (!(g.n1 > 0)) errors.push(`入射介質折射率 n₁ = ${g.n1} 不是正的`);
        if (!(g.n2 > 0)) errors.push(`折射介質折射率 n₂ = ${g.n2} 不是正的`);
        if (!(g.theta1Deg >= 0 && g.theta1Deg < 90))
            errors.push(`入射角 θ₁ = ${g.theta1Deg} 不在 0°～90° 之間`);

        // 反射線永遠存在（部分反射），和全反射與否無關。
        const dRefl = norm({ x: g.R.x - g.O.x, y: g.R.y - g.O.y });
        const aRefl = angleFromNormalDeg(dRefl, { x: 0, y: 1 });
        if (Math.abs(aRefl - g.theta1Deg) > 1e-7)
            errors.push(`由反射線量到的入射角 = ${aRefl}，不是 ${g.theta1Deg}`);
        if (Math.abs(dRefl.x - g.dIn.x) > 1e-12 ||
            Math.abs(dRefl.y + g.dIn.y) > 1e-12)
            errors.push('反射方向不是入射方向對法線的鏡射');
        if (g.fromTop) {
            if (!(g.R.y < g.O.y)) errors.push('光由上方射入，反射線應該在介面上方');
        } else {
            if (!(g.R.y > g.O.y)) errors.push('光由下方射入，反射線應該在介面下方');
        }
        if (g.sin1 > 1e-9 &&
            Math.sign(g.R.x - g.O.x) !== -Math.sign(g.P.x - g.O.x))
            errors.push('反射線與入射線應該在法線的兩側');
        if (Math.abs(g.reflectedLen -
                     Math.hypot(g.R.x - g.O.x, g.R.y - g.O.y)) > 1e-9)
            errors.push('反射段長度不對');
        if (Math.abs(g.reflectionPathLen - g.len1 - g.reflectedLen) > 1e-9)
            errors.push('反射光路的總長不等於入射段加反射段');
        if (g.reflectedSide !== Math.sign(g.R.x - g.O.x))
            errors.push('reflectedSide 與反射終點的位置不一致');

        if (g.tir) {
            if (g.Q !== null) errors.push('全反射時不該有折射終點 Q');
            if (g.theta2Deg !== null) errors.push('全反射時不該有折射角');
            if (!(g.n1 > g.n2)) errors.push('只有光從光密介質射向光疏介質才可能全反射');
            if (g.criticalDeg == null) errors.push('全反射時應該有臨界角');
            else {
                const crit = Math.asin(clamp(g.n2 / g.n1, -1, 1)) * RAD;
                if (Math.abs(g.criticalDeg - crit) > 1e-9)
                    errors.push(`臨界角 ${g.criticalDeg} 不等於 asin(n₂/n₁) = ${crit}`);
            }
            if (!(g.sin2Raw > 1)) errors.push('全反射的判據應該是 n₁ sin θ₁ > n₂');
            if (!(g.theta1Deg > g.criticalDeg))
                errors.push('全反射時入射角應該大於臨界角');
            return { ok: errors.length === 0, errors };
        }

        if (g.Q === null) errors.push('沒有全反射，卻沒有折射終點 Q');

        const dIn = norm({ x: g.O.x - g.P.x, y: g.O.y - g.P.y });
        const dOut = norm({ x: g.Q.x - g.O.x, y: g.Q.y - g.O.y });
        const normal = { x: 0, y: 1 };
        const a1 = angleFromNormalDeg(dIn, normal);
        const a2 = angleFromNormalDeg(dOut, normal);
        if (Math.abs(a1 - g.theta1Deg) > 1e-7)
            errors.push(`由入射線量到的 θ₁ = ${a1}，不是 ${g.theta1Deg}`);
        if (Math.abs(a2 - g.theta2Deg) > 1e-7)
            errors.push(`由折射線量到的 θ₂ = ${a2}，不是 ${g.theta2Deg}`);
        if (Math.abs(g.sin1 - Math.sin(g.theta1Deg * DEG)) > 1e-12)
            errors.push('sin1 不等於 sin θ₁');
        if (Math.abs(g.sin2 - Math.sin(g.theta2Deg * DEG)) > 1e-12)
            errors.push('sin2 不等於 sin θ₂');

        const lhs = g.n1 * Math.sin(g.theta1Deg * DEG);
        const rhs = g.n2 * Math.sin(g.theta2Deg * DEG);
        if (Math.abs(lhs - rhs) > 1e-10)
            errors.push(`斯涅爾定律不成立：n₁sinθ₁ = ${lhs}，n₂sinθ₂ = ${rhs}`);
        if (Math.abs(g.sin2Raw - rhs / g.n2) > 1e-12)
            errors.push('sin2Raw 不等於 (n₁/n₂)·sin θ₁');

        // θ₁ = 0 時兩條線都沿著法線，沒有「哪一側」可言。
        if (g.sin1 > 1e-9 &&
            Math.sign(g.P.x - g.O.x) === Math.sign(g.Q.x - g.O.x))
            errors.push('入射線與折射線在法線的同一側');
        if (g.incidentMediumSide === g.refractedMediumSide)
            errors.push('入射介質與折射介質是同一側');
        if (g.fromTop) {
            if (!(g.P.y < g.O.y)) errors.push('光由上方射入，入射線應該在介面上方');
            if (!(g.Q.y > g.O.y)) errors.push('光由上方射入，折射線應該在介面下方');
        } else {
            if (!(g.P.y > g.O.y)) errors.push('光由下方射入，入射線應該在介面下方');
            if (!(g.Q.y < g.O.y)) errors.push('光由下方射入，折射線應該在介面上方');
        }

        if (g.sin1 > 1e-9 && g.n2 > g.n1 && !(g.theta2Deg < g.theta1Deg))
            errors.push('光進入光密介質時，折射角應該小於入射角');
        if (g.sin1 > 1e-9 && g.n2 < g.n1 && !(g.theta2Deg > g.theta1Deg))
            errors.push('光進入光疏介質時，折射角應該大於入射角');
        if (g.n2 === g.n1 && Math.abs(g.theta2Deg - g.theta1Deg) > 1e-12)
            errors.push('兩介質折射率相同時，光線不該偏折');
        if (g.sin1 > 1e-9 &&
            g.bend !== (g.n2 > g.n1 ? 'toward' : g.n2 < g.n1 ? 'away' : 'none'))
            errors.push('bend 與兩介質的疏密關係不一致');

        if (Math.abs(g.relativeIndex - g.n2 / g.n1) > 1e-12)
            errors.push('相對折射率不等於 n₂/n₁');
        if (Math.abs(g.speed1 * g.n1 - C_LIGHT) > 1e-3)
            errors.push('v₁·n₁ 不等於真空光速');
        if (Math.abs(g.speed2 * g.n2 - C_LIGHT) > 1e-3)
            errors.push('v₂·n₂ 不等於真空光速');
        if (Math.abs(g.speedRatio - g.relativeIndex) > 1e-12)
            errors.push('v₁/v₂ 不等於 n₂/n₁');
        if (Math.abs(g.deviationDeg - Math.abs(g.theta2Deg - g.theta1Deg)) > 1e-9)
            errors.push('偏向角不等於 |θ₂ − θ₁|');

        if (Math.abs(g.incidentLen - Math.hypot(g.O.x - g.P.x, g.O.y - g.P.y)) > 1e-9)
            errors.push('入射段長度不對');
        if (Math.abs(g.refractedLen - Math.hypot(g.Q.x - g.O.x, g.Q.y - g.O.y)) > 1e-9)
            errors.push('折射段長度不對');
        if (Math.abs(g.pathLen - g.incidentLen - g.refractedLen) > 1e-9)
            errors.push('總路長不等於兩段之加');

        return { ok: errors.length === 0, errors };
    }

    // ======================================================================
    // 薄透鏡成像
    // ======================================================================

    /**
     * 薄透鏡的成像幾何（近軸）。
     *
     * 符號約定和教材一致：
     *   u > 0（物在鏡前）
     *   v > 0 實像（透鏡後）、v < 0 虛像（透鏡前）
     *   f > 0 凸透鏡、f < 0 凹透鏡
     *   M = −v/u；M > 0 正立、M < 0 倒立
     *
     * 兩條作圖光線：
     *   ① 平行主軸的光線，經凸透鏡後通過後焦點 F′；凹透鏡則反向延長
     *      通過前焦點 F。
     *   ② 通過鏡心 O 的光線，方向不變。
     *
     * @param {object} o
     *   o.type 'convex'（預設）或 'concave'
     *   o.u、o.f、o.h 物距、焦距大小、物高（cm）
     *   o.lensX、o.axisY、o.cmPerUnit  世界座標與比例
     *   o.scene 光線要停在這個矩形裡
     */
    function thinLensGeometry(o) {
        o = o || {};
        const type = o.type === 'concave' ? 'concave' : 'convex';
        const lensX = o.lensX == null ? 600 : o.lensX;
        const axisY = o.axisY == null ? 420 : o.axisY;
        const scale = o.cmPerUnit || 12;
        const u = o.u == null ? 18 : o.u;
        const f = Math.abs(o.f == null ? 7 : o.f);
        const h = Math.abs(o.h == null ? 5 : o.h);
        const scene = o.scene || { x0: 8, y0: 8, x1: 892, y1: 806 };

        const fSigned = type === 'convex' ? f : -f;
        const O = { x: lensX, y: axisY };
        const F = { x: lensX - f * scale, y: axisY };
        const Fp = { x: lensX + f * scale, y: axisY };

        const object = {
            base: { x: lensX - u * scale, y: axisY },
            top: { x: lensX - u * scale, y: axisY - h * scale },
        };

        // 透鏡公式：1/u + 1/v = 1/f。凸透鏡 u = f 時分母為零，像在無窮遠。
        const denom = u - fSigned;
        const infinite = Math.abs(denom) < 1e-9;
        const vSigned = infinite ? Infinity : (u * fSigned) / denom;
        const M = infinite ? null : -vSigned / u;
        const hSigned = infinite ? null : M * h;
        const image = infinite ? null : {
            base: { x: lensX + vSigned * scale, y: axisY },
            top: { x: lensX + vSigned * scale, y: axisY - hSigned * scale },
        };

        const real = !infinite && vSigned > 0;
        const upright = !infinite && hSigned > 0;
        const size = infinite ? null : Math.abs(M);
        const sizeWord = size == null ? ''
                       : size > 1 + 1e-9 ? '放大'
                       : size < 1 - 1e-9 ? '縮小' : '等大';
        const nature = infinite ? '不成像'
                     : `${upright ? '正立' : '倒立'}${real ? '實像' : '虛像'}`
                       + (sizeWord ? `（${sizeWord}）` : '');

        const rays = [];

        // ── 光線①：平行主軸 ─────────────────────────────────────────────
        const A = { x: lensX, y: object.top.y };
        let dParallel = type === 'convex'
            ? norm({ x: Fp.x - A.x, y: Fp.y - A.y })
            : norm({ x: A.x - F.x, y: A.y - F.y });
        const parallelEnd = rayEndInRect(A, dParallel, scene);
        const parallelRay = {
            tag: 'parallel',
            objectPoint: object.top,
            lensPoint: A,
            outDir: dParallel,
            end: parallelEnd,
            incidentLen: Math.hypot(A.x - object.top.x, A.y - object.top.y),
            outLen: Math.hypot(parallelEnd.x - A.x, parallelEnd.y - A.y),
            virtualExtension: (!infinite && !real)
                ? { a: A, b: image.top } : null,
        };
        parallelRay.totalLen = parallelRay.incidentLen + parallelRay.outLen;
        rays.push(parallelRay);

        // ── 光線②：通過鏡心 ─────────────────────────────────────────────
        const dCenter = norm({ x: O.x - object.top.x, y: O.y - object.top.y });
        const centerEnd = rayEndInRect(O, dCenter, scene);
        const centerRay = {
            tag: 'center',
            objectPoint: object.top,
            lensPoint: O,
            outDir: dCenter,
            end: centerEnd,
            incidentLen: Math.hypot(O.x - object.top.x, O.y - object.top.y),
            outLen: Math.hypot(centerEnd.x - O.x, centerEnd.y - O.y),
            // 虛像在物與鏡之間時，實線的入射段本來就穿過像頂；
            // 只有虛像比物更遠時才需要一段額外的反向延長線。
            virtualExtension: (!infinite && !real &&
                               image.top.x < object.top.x - 1e-9)
                ? { a: object.top, b: image.top } : null,
        };
        centerRay.totalLen = centerRay.incidentLen + centerRay.outLen;
        rays.push(centerRay);

        return {
            type, lensX, axisY, scale, u, f, fSigned, h,
            F, Fp, O, object, image,
            infinite, vSigned, M, hSigned, real, upright, sizeWord, nature,
            rays,
        };
    }

    /** 薄透鏡某條作圖光線上「走了 s 之後」的位置。 */
    function thinLensRayPointAt(ray, s) {
        const t = clamp(s, 0, ray.totalLen);
        if (t <= ray.incidentLen)
            return lerp(ray.objectPoint, ray.lensPoint,
                        ray.incidentLen > 0 ? t / ray.incidentLen : 1);
        return lerp(ray.lensPoint, ray.end,
                    ray.outLen > 0 ? (t - ray.incidentLen) / ray.outLen : 1);
    }

    /**
     * 薄透鏡幾何的檢查：透鏡公式、正負號、像的位置與兩條作圖光線。
     *
     * 光線不是「看起來像」就好：兩條出射線（或它們的反向延長線）必須
     * 真的通過像頂，平行主軸那一條還必須通過正確的焦點。
     */
    function checkThinLens(g) {
        const errors = [];
        if (!(g.u > 0)) errors.push(`物距 u = ${g.u} 不是正的`);
        if (!(g.f > 0)) errors.push(`焦距大小 f = ${g.f} 不是正的`);
        if (!(g.h > 0)) errors.push(`物高 h = ${g.h} 不是正的`);
        if (g.fSigned !== (g.type === 'convex' ? g.f : -g.f))
            errors.push('fSigned 的符號和透鏡種類不一致');
        if (Math.abs(g.F.x - (g.lensX - g.f * g.scale)) > 1e-9 ||
            Math.abs(g.Fp.x - (g.lensX + g.f * g.scale)) > 1e-9)
            errors.push('焦點位置不對');
        if (Math.abs(g.object.top.x - (g.lensX - g.u * g.scale)) > 1e-9)
            errors.push('物頂的位置不對');
        if (Math.abs(g.object.top.y - (g.axisY - g.h * g.scale)) > 1e-9)
            errors.push('物頂的高度不對');

        const denom = g.u - g.fSigned;
        const infinite = Math.abs(denom) < 1e-9;
        if (g.infinite !== infinite) errors.push('infinite 的判據不對');

        if (!infinite) {
            const v = (g.u * g.fSigned) / denom;
            const M = -v / g.u;
            const hp = M * g.h;
            if (Math.abs(g.vSigned - v) > 1e-10)
                errors.push(`v = ${g.vSigned} 不是 u·f/(u−f) = ${v}`);
            if (Math.abs(1 / g.u + 1 / g.vSigned - 1 / g.fSigned) > 1e-10)
                errors.push('透鏡公式 1/u + 1/v = 1/f 不成立');
            if (Math.abs(g.M - M) > 1e-12)
                errors.push('放大率不等於 −v/u');
            if (Math.abs(g.hSigned - hp) > 1e-12)
                errors.push('像高不等於 M·h');
            if (Math.abs(g.image.base.x - (g.lensX + g.vSigned * g.scale)) > 1e-9)
                errors.push('像的 x 位置不對');
            if (Math.abs(g.image.top.y - (g.axisY - g.hSigned * g.scale)) > 1e-9)
                errors.push('像頂的高度不對');
            if (g.real !== (g.vSigned > 0))
                errors.push('real 和 v 的正負號不一致');
            if (g.upright !== (g.hSigned > 0))
                errors.push('upright 和 h′ 的正負號不一致');
            if (g.type === 'concave' && (g.real || !g.upright))
                errors.push('凹透鏡的像一定是正立虛像');
            if (g.type === 'convex' && g.u > g.f && (!g.real || g.upright))
                errors.push('凸透鏡 u > f 時應該是倒立實像');
            if (g.type === 'convex' && g.u < g.f && (g.real || !g.upright))
                errors.push('凸透鏡 u < f 時應該是正立虛像');
        } else {
            if (g.image !== null) errors.push('u = f 時不該有像');
            if (g.M !== null || g.hSigned !== null)
                errors.push('u = f 時放大率與像高都應該是 null');
        }

        const seen = {};
        for (const ray of g.rays) {
            seen[ray.tag] = (seen[ray.tag] || 0) + 1;
            if (Math.abs(Math.hypot(ray.outDir.x, ray.outDir.y) - 1) > 1e-12)
                errors.push(`${ray.tag}：出射方向不是單位向量`);
            if (Math.abs(ray.incidentLen -
                         Math.hypot(ray.lensPoint.x - ray.objectPoint.x,
                                    ray.lensPoint.y - ray.objectPoint.y)) > 1e-9)
                errors.push(`${ray.tag}：入射段長度不對`);
            if (Math.abs(ray.outLen -
                         Math.hypot(ray.end.x - ray.lensPoint.x,
                                    ray.end.y - ray.lensPoint.y)) > 1e-9)
                errors.push(`${ray.tag}：出射段長度不對`);
            if (Math.abs(ray.totalLen - ray.incidentLen - ray.outLen) > 1e-9)
                errors.push(`${ray.tag}：總長不等於兩段之加`);
            // outDir 和畫出來的出射段必須指向同一邊。只驗「線通過像頂」
            // 抓不到方向被反過來：把 outDir 取負、end 不動，線還是同一條。
            const ex = ray.end.x - ray.lensPoint.x;
            const ey = ray.end.y - ray.lensPoint.y;
            if (ray.outLen > 1e-9) {
                const dot = ray.outDir.x * ex + ray.outDir.y * ey;
                const cross = ray.outDir.x * ey - ray.outDir.y * ex;
                if (dot <= 0)
                    errors.push(`${ray.tag}：出射方向與出射段相反`);
                else if (Math.abs(cross) > 1e-7)
                    errors.push(`${ray.tag}：出射方向與出射段不共線`);
            }
            if (!infinite) {
                const d = distToLine(g.image.top, ray.lensPoint, ray.end);
                if (d > 1e-7)
                    errors.push(`${ray.tag}：出射線沒有通過像頂（差 ${d}）`);
            }
        }
        if (seen.parallel !== 1 || seen.center !== 1)
            errors.push('應該恰好有「平行主軸」與「通過鏡心」兩條光線');

        if (g.rays[0]) {
            const A = g.rays[0].lensPoint;
            if (Math.abs(A.x - g.lensX) > 1e-9 ||
                Math.abs(A.y - g.object.top.y) > 1e-9)
                errors.push('平行光線的入射點不在透鏡平面上、物的高度上');
            const target = g.type === 'convex' ? g.Fp : g.F;
            if (distToLine(target, A, g.rays[0].end) > 1e-7)
                errors.push(g.type === 'convex'
                    ? '凸透鏡的平行光線沒有通過後焦點 F′'
                    : '凹透鏡的平行光線反向延長線沒有通過前焦點 F');
        }
        if (g.rays[1]) {
            if (Math.abs(g.rays[1].lensPoint.x - g.lensX) > 1e-9 ||
                Math.abs(g.rays[1].lensPoint.y - g.axisY) > 1e-9)
                errors.push('通過鏡心的光線沒有經過鏡心 O');
            if (distToLine(g.object.top, g.rays[1].lensPoint,
                           g.rays[1].end) > 1e-7)
                errors.push('通過鏡心的光線方向改變了');
        }

        if (infinite) {
            const a = g.rays[0], b = g.rays[1];
            if (a && b) {
                const cross = a.outDir.x * b.outDir.y - a.outDir.y * b.outDir.x;
                if (Math.abs(cross) > 1e-9)
                    errors.push('u = f 時兩條出射線應該平行');
            }
        }

        return { ok: errors.length === 0, errors };
    }

    // ======================================================================
    // 平面鏡成像
    // ======================================================================

    /** 一點對垂直鏡面（x = mirrorX）的鏡像。 */
    function mirrorImage(point, mirrorX) {
        return { x: 2 * mirrorX - point.x, y: point.y };
    }

    /**
     * 從 image 到 eye 的直線，與垂直鏡面 x = mirrorX 的交點。
     * 這個交點就是光線在鏡面上的反射點——因為 image 是 object 的鏡像，
     * 「object → 反射點 → eye」與「image → 反射點 → eye」是同一條直線的
     * 兩半，反射定律自動成立。
     */
    function hitVerticalMirror(image, eye, mirrorX) {
        const dx = eye.x - image.x;
        if (Math.abs(dx) < 1e-9) return null;
        const t = (mirrorX - image.x) / dx;
        return { x: mirrorX, y: image.y + t * (eye.y - image.y), t };
    }

    /**
     * 平面鏡成像的完整幾何。
     *
     * @param {object} o
     *   o.mirrorX    鏡面的世界 x
     *   o.baseY      物體與像的底部 y
     *   o.u          物距（cm）
     *   o.h          物高（cm）
     *   o.cmPerUnit  1 cm 等於幾個世界單位（預設 18）
     *   o.eye        眼睛的世界座標
     *   o.objectSide −1：物在鏡子左邊（預設）；+1：物在右邊
     *
     * @returns {object}
     *   object、image  {base, top}
     *   rays           兩條光線（物頂、物底），每一條有
     *                  objectPoint、mirrorPoint、imagePoint、eye、
     *                  incidentLen、reflectedLen、totalLen、virtualLen
     *   uEqualsV、hEqualsH、magnification、axisAngleDeg
     */
    function planeMirrorGeometry(o) {
        o = o || {};
        const mirrorX = o.mirrorX == null ? 480 : o.mirrorX;
        const baseY = o.baseY == null ? 580 : o.baseY;
        const scale = o.cmPerUnit || 18;
        const side = o.objectSide === 1 ? 1 : -1;
        const u = o.u == null ? 10 : o.u;
        const h = o.h == null ? 7 : o.h;
        const eye = o.eye || { x: 160, y: 310 };

        const uUnits = u * scale;
        const hUnits = h * scale;
        const objX = mirrorX + side * uUnits;

        const object = {
            base: { x: objX, y: baseY },
            top: { x: objX, y: baseY - hUnits },
        };
        const image = {
            base: mirrorImage(object.base, mirrorX),
            top: mirrorImage(object.top, mirrorX),
        };

        // 兩條光線：物頂與物底。每一條都經過「像點 → 眼睛」與鏡面的交點。
        const rays = [object.top, object.base].map((T, i) => {
            const I = mirrorImage(T, mirrorX);
            const hit = hitVerticalMirror(I, eye, mirrorX);
            const M = hit ? { x: hit.x, y: hit.y } : { x: mirrorX, y: T.y };
            const incidentLen = Math.hypot(M.x - T.x, M.y - T.y);
            const reflectedLen = Math.hypot(eye.x - M.x, eye.y - M.y);
            return {
                tag: i === 0 ? 'top' : 'base',
                objectPoint: T,
                imagePoint: I,
                mirrorPoint: M,
                eye: { x: eye.x, y: eye.y },
                incidentLen,
                reflectedLen,
                totalLen: incidentLen + reflectedLen,
                virtualLen: Math.hypot(I.x - M.x, I.y - M.y),
            };
        });

        return {
            mirrorX, baseY, scale, u, h, eye,
            uUnits, vUnits: uUnits, hUnits, imageHeightUnits: hUnits,
            object, image, rays,
            objectDistanceCm: u,
            imageDistanceCm: u,
            magnification: 1,
            axisAngleDeg: 90,
            uEqualsV: true,
            hEqualsH: true,
            virtual: true,
        };
    }

    /**
     * 光線在「物 → 鏡 → 眼」路徑上走了 s 之後的位置。
     * s 超出總長就停在眼睛（動畫迴圈由呼叫端取模）。
     */
    function rayPointAt(ray, s) {
        const t = clamp(s, 0, ray.totalLen);
        if (t <= ray.incidentLen) {
            return lerp(ray.objectPoint, ray.mirrorPoint,
                        ray.incidentLen > 0 ? t / ray.incidentLen : 1);
        }
        return lerp(ray.mirrorPoint, ray.eye,
                    ray.reflectedLen > 0
                        ? (t - ray.incidentLen) / ray.reflectedLen : 1);
    }

    // ======================================================================
    // 球面鏡成像
    // ======================================================================

    /**
     * 光線從 origin 沿著單位方向 dir 走，遇到矩形 rect 的邊界就停。
     * origin 必須在 rect 內；回傳的是邊界上的點（不是無限遠）。
     */
    function rayEndInRect(origin, dir, rect) {
        let t = Infinity;
        if (dir.x > 1e-12) t = Math.min(t, (rect.x1 - origin.x) / dir.x);
        else if (dir.x < -1e-12) t = Math.min(t, (rect.x0 - origin.x) / dir.x);
        if (dir.y > 1e-12) t = Math.min(t, (rect.y1 - origin.y) / dir.y);
        else if (dir.y < -1e-12) t = Math.min(t, (rect.y0 - origin.y) / dir.y);
        if (!isFinite(t) || t < 0) t = 0;
        return { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
    }

    /**
     * 球面鏡的弧線在高度 y 的 x。
     *
     * 座標約定：物在鏡面左邊（x < mirrorX），主軸水平。凹面鏡的球心在鏡前
     * （左），鏡頂是圓的最右點；凸面鏡的球心在鏡後（右），鏡頂是最左點。
     * 所以凹面鏡的弧在鏡頂左邊、凸面鏡的弧在鏡頂右邊。
     */
    function sphericalArcX(type, mirrorX, axisY, radius, y) {
        const dy = Math.abs(y - axisY);
        const sag = radius - Math.sqrt(Math.max(0, radius * radius - dy * dy));
        return mirrorX + (type === 'convex' ? sag : -sag);
    }

    /**
     * 球面鏡成像的完整幾何（近軸近似）。
     *
     * @param {object} o
     *   o.type       'concave'（預設）或 'convex'
     *   o.mirrorX    鏡頂的世界 x，預設 600
     *   o.axisY      主軸的世界 y，預設 420
     *   o.cmPerUnit  1 cm 等於幾個世界單位，預設 12
     *   o.u          物距（cm，恆為正）
     *   o.f          焦距的大小（cm，恆為正；正負號由 type 決定）
     *   o.h          物高（cm，恆為正）
     *   o.arcHalf    鏡面孔徑的半高（世界單位），預設 150
     *   o.scene      光線要被裁在哪個矩形裡，預設 {x0:8,y0:8,x1:892,y1:806}
     *
     * @returns {object}
     *   fSigned     凹面鏡 +f、凸面鏡 −f（教材的正負號約定）
     *   vSigned     實像 +、虛像 −；u = f 時是 Infinity（不成像）
     *   image       {base, top}；不成像時是 null
     *   M、hSigned  M = −v/u、h′ = M·h（正立 +、倒立 −）
     *   rays        兩條作圖光線：平行主軸、通過焦點（u = f 時只有第一條）
     *
     * ⚠️ 這一支是**近軸**模型：光線在鏡頂平面上交會，成像位置由面鏡公式
     *    決定。球面鏡在孔徑角大時有像差，平行光不會真的會聚於一點；這一頁
     *    刻意只畫近軸的兩條光線，讓公式與圖形一致（教材也把像差另成一節）。
     */
    function sphericalMirrorGeometry(o) {
        o = o || {};
        const type = o.type === 'convex' ? 'convex' : 'concave';
        const mirrorX = o.mirrorX == null ? 600 : o.mirrorX;
        const axisY = o.axisY == null ? 420 : o.axisY;
        const scale = o.cmPerUnit || 12;
        const u = o.u == null ? 15 : o.u;
        const f = Math.abs(o.f == null ? 7 : o.f);
        const h = o.h == null ? 5 : o.h;
        const arcHalf = o.arcHalf == null ? 150 : o.arcHalf;
        const scene = o.scene || { x0: 8, y0: 8, x1: 892, y1: 806 };

        const fSigned = type === 'concave' ? f : -f;
        const uUnits = u * scale;
        const hUnits = h * scale;
        const fUnits = f * scale;
        const rUnits = 2 * fUnits;
        const objX = mirrorX - uUnits;

        const object = {
            base: { x: objX, y: axisY },
            top: { x: objX, y: axisY - hUnits },
        };
        const O = { x: mirrorX, y: axisY };
        const F = { x: mirrorX - fSigned * scale, y: axisY };
        const C = { x: mirrorX - 2 * fSigned * scale, y: axisY };

        // 面鏡公式：1/u + 1/v = 1/f。凹面鏡 u = f 時分母為零，像在無窮遠。
        const denom = u - fSigned;
        const infinite = Math.abs(denom) < 1e-9;
        const vSigned = infinite ? Infinity : (u * fSigned) / denom;
        const vUnits = infinite ? Infinity : vSigned * scale;
        const M = infinite ? null : -vSigned / u;
        const hSigned = infinite ? null : M * h;
        const image = infinite ? null : {
            base: { x: mirrorX - vUnits, y: axisY },
            top: { x: mirrorX - vUnits, y: axisY - hSigned * scale },
        };

        const real = !infinite && vSigned > 0;
        const upright = !infinite && hSigned > 0;
        const size = infinite ? null : Math.abs(M);
        const sizeWord = size == null ? ''
                       : size > 1 + 1e-9 ? '放大'
                       : size < 1 - 1e-9 ? '縮小' : '等大';
        const nature = infinite ? '不成像'
                     : `${upright ? '正立' : '倒立'}${real ? '實像' : '虛像'}`
                       + (sizeWord ? `（${sizeWord}）` : '');

        const rays = [];

        // ── 光線①：平行主軸 ─────────────────────────────────────────────
        const A = { x: mirrorX, y: object.top.y };
        let dA = norm({ x: F.x - A.x, y: F.y - A.y });
        // 反射光一定往鏡前（左）走。凹面鏡是朝 F 過去，凸面鏡是背離 F。
        if (dA.x > 0) dA = { x: -dA.x, y: -dA.y };
        const Aend = rayEndInRect(A, dA, scene);

        // 畫面上光線要落在弧面上，不能穿到鏡背。弧面的 x 由 sphericalArcX
        // 算；反射方向仍然用近軸作圖（所以視覺上一定經過像頂）。
        const Asurf = {
            x: sphericalArcX(type, mirrorX, axisY, rUnits, A.y),
            y: A.y,
        };
        let dAv = image
            ? norm({ x: image.top.x - Asurf.x, y: image.top.y - Asurf.y })
            : dA;
        if (dAv.x > 0) dAv = { x: -dAv.x, y: -dAv.y };
        const AendV = rayEndInRect(Asurf, dAv, scene);

        const rayA = {
            tag: 'parallel',
            objectPoint: object.top,
            mirrorPoint: A,
            surfacePoint: Asurf,
            end: Aend,
            visualEnd: AendV,
            reflectedDir: dA,
            visualDir: dAv,
            incidentLen: Math.hypot(A.x - object.top.x, A.y - object.top.y),
            reflectedLen: Math.hypot(Aend.x - A.x, Aend.y - A.y),
            visualIncidentLen: Math.hypot(Asurf.x - object.top.x,
                                          Asurf.y - object.top.y),
            visualReflectedLen: Math.hypot(AendV.x - Asurf.x,
                                           AendV.y - Asurf.y),
            totalLen: 0,
            visualTotalLen: 0,
            imagePoint: image ? image.top : null,
            virtualExtension: (!infinite && !real && image)
                ? { a: Asurf, b: image.top } : null,
            inAperture: Math.abs(A.y - axisY) <= arcHalf,
        };
        rayA.totalLen = rayA.incidentLen + rayA.reflectedLen;
        rayA.visualTotalLen = rayA.visualIncidentLen + rayA.visualReflectedLen;
        rays.push(rayA);

        // ── 光線②：通過焦點（u = f 時這條線與鏡面平行，畫不出來）────────
        if (!infinite && Math.abs(F.x - object.top.x) > 1e-9) {
            const t = (mirrorX - object.top.x) / (F.x - object.top.x);
            const B = {
                x: mirrorX,
                y: object.top.y + t * (F.y - object.top.y),
            };
            const dB = { x: -1, y: 0 };
            const Bend = rayEndInRect(B, dB, scene);
            const Bsurf = {
                x: sphericalArcX(type, mirrorX, axisY, rUnits, B.y),
                y: B.y,
            };
            const BendV = rayEndInRect(Bsurf, dB, scene);
            const rayB = {
                tag: 'throughF',
                objectPoint: object.top,
                mirrorPoint: B,
                surfacePoint: Bsurf,
                end: Bend,
                visualEnd: BendV,
                reflectedDir: dB,
                visualDir: dB,
                incidentLen: Math.hypot(B.x - object.top.x, B.y - object.top.y),
                reflectedLen: Math.hypot(Bend.x - B.x, Bend.y - B.y),
                visualIncidentLen: Math.hypot(Bsurf.x - object.top.x,
                                              Bsurf.y - object.top.y),
                visualReflectedLen: Math.hypot(BendV.x - Bsurf.x,
                                               BendV.y - Bsurf.y),
                totalLen: 0,
                visualTotalLen: 0,
                imagePoint: image ? image.top : null,
                virtualExtension: (!infinite && !real && image)
                    ? { a: Bsurf, b: image.top } : null,
                inAperture: Math.abs(B.y - axisY) <= arcHalf,
            };

            // F 不在「物頂 → 鏡面」這一段上時，用虛線把「通過焦點」畫出來。
            const vx = B.x - object.top.x, vy = B.y - object.top.y;
            const L2 = vx * vx + vy * vy;
            const ft = L2 > 0
                ? ((F.x - object.top.x) * vx + (F.y - object.top.y) * vy) / L2
                : 0;
            rayB.fOnSegment = ft >= -1e-9 && ft <= 1 + 1e-9;
            if (!rayB.fOnSegment) {
                rayB.fExtension = F.x < object.top.x
                    ? { a: object.top, b: F }   // 凹面鏡、物在焦點內
                    : { a: B, b: F };           // 凸面鏡、F 在鏡後
            }
            rayB.totalLen = rayB.incidentLen + rayB.reflectedLen;
            rayB.visualTotalLen = rayB.visualIncidentLen + rayB.visualReflectedLen;
            rays.push(rayB);
        }

        return {
            type, mirrorX, axisY, scale, u, h,
            f, fSigned, fUnits, rUnits,
            uUnits, hUnits, arcHalf,
            object, image, O, F, C,
            infinite, formed: !infinite,
            vSigned, vUnits, imageDistanceCm: vSigned,
            M, hSigned, imageHeightCm: hSigned,
            real, virtual: !infinite && !real,
            upright, inverted: !infinite && !upright,
            size, sizeWord, nature,
            rays,
        };
    }

    /** 球面鏡的兩條作圖光線上走了 s 之後的位置（走的是畫出來的那條路）。 */
    function sphericalRayPointAt(ray, s) {
        const inc = ray.visualIncidentLen != null
            ? ray.visualIncidentLen : ray.incidentLen;
        const total = ray.visualTotalLen != null
            ? ray.visualTotalLen : ray.totalLen;
        const mirror = ray.surfacePoint || ray.mirrorPoint;
        const end = ray.visualEnd || ray.end;
        const ref = total - inc;
        const t = clamp(s, 0, total);
        if (t <= inc) {
            return lerp(ray.objectPoint, mirror, inc > 0 ? t / inc : 1);
        }
        return lerp(mirror, end, ref > 0 ? (t - inc) / ref : 1);
    }

    // ======================================================================
    // 自我檢查（頁面與驗證器共用）
    // ======================================================================

    /**
     * 反射幾何的檢查。回傳 {ok, errors}。
     * 這一支的用途不是「讓頁面不要爆掉」，而是把反射定律的三句話寫成可執行的
     * 斷言：同平面（2D 自動成立）、分居法線兩側、反射角等於入射角。
     */
    function checkReflection(g) {
        const errors = [];
        if (!(g.theta1Deg >= 0 && g.theta1Deg < 90))
            errors.push(`入射角 ${g.theta1Deg} 不在 0°～90° 之間`);
        if (Math.abs(g.theta2Deg - g.theta1Deg) > 1e-9)
            errors.push(`反射角 ${g.theta2Deg} 不等於入射角 ${g.theta1Deg}`);
        // θ = 0（垂直入射）時兩條光線都和法線重合，「分居兩側」退化，
        // 不該被判成錯誤。只要 θ > 0，兩側的 x 分量就必須一正一負。
        if (g.theta1Deg > 1e-9 && !(g.incidentSide * g.reflectedSide < 0))
            errors.push('入射光線與反射光線沒有分居法線兩側');
        if (Math.abs(Math.abs(g.dIn.x) - Math.abs(g.dOut.x)) > 1e-9)
            errors.push('入射與反射方向對法線的橫向分量不相等');
        return { ok: errors.length === 0, errors };
    }

    /**
     * 平面鏡幾何的檢查。除了「u = v、h′ = h、連線垂直」之外，還逐條驗
     * 畫出來的光線真的遵守反射定律——這是「像」與「反射定律」是同一件事
     * 的數值證明。
     */
    function checkPlaneMirror(g) {
        const errors = [];
        const dx = g.image.base.x - g.object.base.x;
        if (Math.abs(dx) < 1e-9) errors.push('物與像的 x 相同（應該分居鏡面兩側）');
        if (Math.sign(g.object.base.x - g.mirrorX) ===
            Math.sign(g.image.base.x - g.mirrorX))
            errors.push('物與像在鏡面的同一側');
        if (Math.abs(g.uUnits - g.vUnits) > 1e-9)
            errors.push('物距 u 與像距 v 不相等');
        if (Math.abs(g.hUnits - g.imageHeightUnits) > 1e-9)
            errors.push('物高 h 與像高 h′ 不相等');
        if (Math.abs(g.axisAngleDeg - 90) > 1e-9)
            errors.push('物像連線與鏡面不垂直');

        for (const ray of g.rays) {
            const dIn = norm({ x: ray.mirrorPoint.x - ray.objectPoint.x,
                               y: ray.mirrorPoint.y - ray.objectPoint.y });
            const dOut = norm({ x: ray.eye.x - ray.mirrorPoint.x,
                                y: ray.eye.y - ray.mirrorPoint.y });
            const n = { x: 1, y: 0 };       // 垂直鏡面的法線
            const a1 = angleFromNormalDeg(dIn, n);
            const a2 = angleFromNormalDeg(dOut, n);
            if (Math.abs(a1 - a2) > 1e-7)
                errors.push(`${ray.tag} 光線的入射角 ${a1} 與反射角 ${a2} 不相等`);
        }
        return { ok: errors.length === 0, errors };
    }

    /** 點到直線（通過 a、b）的距離。 */
    function distToLine(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const m = Math.hypot(dx, dy);
        if (!(m > 0)) return Math.hypot(p.x - a.x, p.y - a.y);
        return Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / m;
    }

    /**
     * 球面鏡幾何的檢查。
     *
     * 驗的是面鏡公式與兩條作圖光線的關係：
     *   ① 平行主軸的光線，反射後（或反向延長線）通過焦點與像頂。
     *   ② 通過焦點的光線，反射後平行主軸，而且高度正好是像頂的高度。
     *   ③ 實像在鏡前、虛像在鏡後；正立與倒立由 h′ 的正負號決定。
     *
     * ⚠️ 這一支不驗「光線在弧面上遵守反射定律」——畫面上用的是近軸作圖，
     *    光線交在鏡頂平面上。球面鏡的弧面反射是另一件事（孔徑大時就是
     *    像差），不該拿近軸的圖去假裝它逐點成立。
     */
    function checkSphericalMirror(g) {
        const errors = [];
        if (!(g.u > 0)) errors.push(`物距 u = ${g.u} 不是正的`);
        if (!(g.h > 0)) errors.push(`物高 h = ${g.h} 不是正的`);
        if (!(g.f > 0)) errors.push(`焦距大小 f = ${g.f} 不是正的`);
        if (g.type !== 'concave' && g.type !== 'convex')
            errors.push(`未知的鏡種 ${g.type}`);
        if (g.type === 'concave' && !(g.fSigned > 0))
            errors.push('凹面鏡的 f 應該取正');
        if (g.type === 'convex' && !(g.fSigned < 0))
            errors.push('凸面鏡的 f 應該取負');

        if (g.infinite) {
            if (g.image !== null) errors.push('u = f 時不該有有限的像');
            if (g.vSigned !== Infinity) errors.push('u = f 時 v 應該是 Infinity');
            if (g.M !== null) errors.push('u = f 時不該有放大率');
        } else {
            const rhs = 1 / g.fSigned;
            const lhs = 1 / g.u + 1 / g.vSigned;
            if (Math.abs(lhs - rhs) > 1e-10)
                errors.push(`面鏡公式不成立：1/u + 1/v = ${lhs}，1/f = ${rhs}`);
            const M = -g.vSigned / g.u;
            if (Math.abs(g.M - M) > 1e-12)
                errors.push(`M = ${g.M}，應該是 −v/u = ${M}`);
            const hp = M * g.h;
            if (Math.abs(g.hSigned - hp) > 1e-12)
                errors.push(`h′ = ${g.hSigned}，應該是 M·h = ${hp}`);
            if (Math.abs(g.image.base.x - (g.mirrorX - g.vUnits)) > 1e-9)
                errors.push('像的 x 不等於鏡頂減去像距');
            if (Math.abs(g.image.top.y - (g.axisY - g.hSigned * g.scale)) > 1e-9)
                errors.push('像頂的 y 不等於主軸減去 h′');
            if (g.real !== (g.vSigned > 0))
                errors.push('實像／虛像的旗標和 v 的正負號不一致');
            if (g.upright !== (g.hSigned > 0))
                errors.push('正立／倒立的旗標和 h′ 的正負號不一致');
            if (g.real && !(g.image.base.x < g.mirrorX))
                errors.push('實像不在鏡前');
            if (g.virtual && !(g.image.base.x > g.mirrorX))
                errors.push('虛像不在鏡後');
        }

        for (const ray of g.rays) {
            const tag = ray.tag;
            if (Math.abs(ray.mirrorPoint.x - g.mirrorX) > 1e-9)
                errors.push(`${tag}：反射點不在鏡頂平面上`);
            if (Math.abs(ray.incidentLen -
                Math.hypot(ray.mirrorPoint.x - ray.objectPoint.x,
                           ray.mirrorPoint.y - ray.objectPoint.y)) > 1e-9)
                errors.push(`${tag}：入射段長度不對`);
            if (Math.abs(ray.reflectedLen -
                Math.hypot(ray.end.x - ray.mirrorPoint.x,
                           ray.end.y - ray.mirrorPoint.y)) > 1e-9)
                errors.push(`${tag}：反射段長度不對`);
            if (Math.abs(ray.totalLen - ray.incidentLen - ray.reflectedLen) > 1e-9)
                errors.push(`${tag}：總長不等於兩段之和`);

            // 畫出來的那條路：起點在弧面上，而且反射線要真的經過像頂。
            if (ray.surfacePoint) {
                const xArc = sphericalArcX(g.type, g.mirrorX, g.axisY,
                                           g.rUnits, ray.surfacePoint.y);
                if (Math.abs(ray.surfacePoint.x - xArc) > 1e-9)
                    errors.push(`${tag}：畫面上的反射點不在弧面上`);
                if (Math.abs(ray.visualTotalLen -
                    ray.visualIncidentLen - ray.visualReflectedLen) > 1e-9)
                    errors.push(`${tag}：畫面上的總長不等於兩段之和`);
                if (g.image) {
                    const dirEnd = {
                        x: ray.surfacePoint.x + ray.visualDir.x,
                        y: ray.surfacePoint.y + ray.visualDir.y,
                    };
                    const d = distToLine(g.image.top, ray.surfacePoint, dirEnd);
                    if (d > 1e-7)
                        errors.push(`${tag}：畫面上的反射線沒有經過像頂（差 ${d}）`);
                }
            }

            if (tag === 'parallel') {
                if (Math.abs(ray.objectPoint.y - ray.mirrorPoint.y) > 1e-9)
                    errors.push('平行主軸的光線，入射段不是水平的');
                if (!(ray.mirrorPoint.x > ray.objectPoint.x))
                    errors.push('平行主軸的光線沒有射向鏡面');
                if (g.image) {
                    const d = distToLine(g.image.top, ray.mirrorPoint, g.F);
                    if (d > 1e-7)
                        errors.push(`平行光反射後沒有通過像頂（差 ${d}）`);
                    const along = dot(ray.reflectedDir,
                        { x: g.image.top.x - ray.mirrorPoint.x,
                          y: g.image.top.y - ray.mirrorPoint.y });
                    if (g.real && !(along > 0))
                        errors.push('實像不在平行光反射後的前進方向上');
                    if (g.virtual && !(along < 0))
                        errors.push('虛像不在平行光反射線的反向延長線上');
                }
            }

            if (tag === 'throughF') {
                const d = distToLine(g.F, ray.objectPoint, ray.mirrorPoint);
                if (d > 1e-7)
                    errors.push(`通過焦點的光線，F 不在入射線上（差 ${d}）`);
                if (Math.abs(ray.reflectedDir.y) > 1e-12 ||
                    !(ray.reflectedDir.x < -1e-12))
                    errors.push('通過焦點的光線，反射後不是平行主軸向左');
                if (g.image) {
                    if (Math.abs(ray.mirrorPoint.y - g.image.top.y) > 1e-7)
                        errors.push('通過焦點的光線，反射後沒有經過像頂的高度');
                    if (g.real && !(g.image.top.x < ray.mirrorPoint.x))
                        errors.push('實像不在通過焦點光線的反射方向上');
                    if (g.virtual && !(g.image.top.x > ray.mirrorPoint.x))
                        errors.push('虛像不在通過焦點光線的反向延長線上');
                }
            }
        }

        return { ok: errors.length === 0, errors };
    }

    return {
        DEG, RAD, C_LIGHT,
        clamp, norm, dot, lerp,
        angleBetweenDeg, angleFromNormalDeg, reflectVector,

        reflectionGeometry, reflectionPointAt,
        checkReflection,

        refractionGeometry, refractionPointAt,
        refractionReflectionPointAt, checkRefraction,
        thinLensGeometry, thinLensRayPointAt, checkThinLens,

        mirrorImage, hitVerticalMirror, planeMirrorGeometry, rayPointAt,
        checkPlaneMirror,

        rayEndInRect, sphericalArcX, sphericalMirrorGeometry,
        sphericalRayPointAt, checkSphericalMirror,
    };
})();
