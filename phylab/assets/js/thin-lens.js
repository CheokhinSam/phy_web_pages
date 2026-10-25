/**
 * 🔍 薄透鏡成像（凸透鏡／凹透鏡）
 *
 * 這一頁的教學本體是「物距 u、焦距 f 與像的關係」。像的位置、大小、正倒
 * 全部從 `OpticsKit.thinLensGeometry()` 來：透鏡公式算出 v 與 M，兩條
 * 作圖光線再從同一份幾何長出來。
 *
 * ==========================================================================
 * ⚠️ 這個 repo 的透鏡公式寫成 1/u + 1/v = 1/f，和教材的 v 符號一致
 * ==========================================================================
 * v > 0：像在透鏡後（實像）；v < 0：像在透鏡前（虛像）。
 * f > 0：凸透鏡；f < 0：凹透鏡。M = −v/u。
 * 所以凸透鏡 u < f 時 v 是負的、M 是正的，像在物這一側、正立放大；
 * 凹透鏡的 f 是負的，v 恆為負，像永遠是正立縮小虛像。
 *
 * ==========================================================================
 * ⚠️ u = f 是一個真的奇異點，不是「很小的像」
 * ==========================================================================
 * 凸透鏡 u = f 時分母 u − f 為零，v 在無窮遠，兩條作圖光線平行射出。
 * 這一頁不畫像、不填 v 與 M 的數字，卡片顯示 ∞ 與 —，標題寫「不成像」。
 * 若硬把 u = f 代進公式，會得到 Infinity 或 NaN，卡片上看不出來，
 * 但畫面會出現一條往無窮遠跑的像箭頭。
 *
 * ==========================================================================
 * ⚠️ 焦點標籤 F 在軸下、F′ 在軸上
 * ==========================================================================
 * 通過鏡心的光線從物頂（軸上）往右下走，剛好會穿過 F′ 附近；把 F′ 的
 * 字母放在軸下，預設參數下就會被那條線切過。F 在透鏡左邊，中心光線在
 * 那個 x 還在軸的上方，所以 F 放軸下、F′ 放軸上，兩個都不會碰到光線。
 * O（鏡心）不另外放字母——它一定落在透鏡本體裡面，白底徽章會蓋掉鏡片；
 * 改由左上角圖例的「O 鏡心」與鏡心上的圓點負責。
 */

(function () {
    'use strict';

    const LENS_X = 600;
    const AXIS_Y = 420;
    const SCALE = 12;              // 1 cm = 12 個世界單位
    const HALF_H = 150;            // 透鏡孔徑的半高
    const SCENE_RECT = { x0: 40, y0: 40, x1: 860, y1: 780 };
    const DIM_Y_U = 690;
    const DIM_Y_V = 736;
    const PULSE_SPEED = 240;       // 世界單位／秒
    const LEGEND = { x: 56, y: 78, sample: 42, gap: 38 };

    // ======================================================================
    // 這一頁的狀態（純資料）
    // ======================================================================

    function stateFor(panel) {
        panel = panel || {};
        const type = panel.type === 'concave' ? 'concave' : 'convex';
        const u = panel.u == null ? 18 : panel.u;
        const f = panel.f == null ? 7 : panel.f;
        const h = panel.h == null ? 5 : panel.h;
        return OpticsKit.thinLensGeometry({
            type, u, f, h,
            lensX: LENS_X,
            axisY: AXIS_Y,
            cmPerUnit: SCALE,
            scene: SCENE_RECT,
        });
    }

    /**
     * 像有沒有落在畫面裡（卡片仍然照樣顯示 v）。
     *
     * 邊界留 12 個世界單位：箭頭頭部半寬大約 7.2，夠放。這個數字只用來
     * 決定「畫不畫像」，不是「像在畫面外」的物理判據——u=20、f=10 的
     * 像在 x=840，離右緣還有 20，仍然看得到，標題就不該說它在畫面外。
     */
    function imageVisible(state) {
        const im = state.image;
        if (!im) return false;
        const m = 12;
        return im.base.x >= SCENE_RECT.x0 + m &&
               im.base.x <= SCENE_RECT.x1 - m &&
               im.top.y >= SCENE_RECT.y0 + m &&
               im.top.y <= SCENE_RECT.y1 - m;
    }

    function dimensionMarks(state) {
        const marks = {
            u: {
                x1: state.object.base.x, x2: LENS_X, y: DIM_Y_U,
                label: `u = ${state.u.toFixed(1)} cm`, labelDy: -30,
            },
            v: null,
        };
        if (state.image && imageVisible(state)) {
            marks.v = {
                x1: LENS_X, x2: state.image.base.x, y: DIM_Y_V,
                label: `v = ${state.vSigned.toFixed(1)} cm`, labelDy: 32,
            };
        }
        return marks;
    }

    /** 左上角圖例。像的標籤放這裡，不貼在箭頭旁邊。 */
    function legendRows(state) {
        const rows = [{
            y: LEGEND.y, text: '物', col: OpticsScene.C_OBJ,
            dash: null, sample: true,
        }];
        if (state.infinite) {
            rows.push({
                y: LEGEND.y + LEGEND.gap, text: '不成像', col: OpticsScene.C_IMG,
                dash: null, sample: false,
            });
        } else {
            const vis = imageVisible(state);
            rows.push({
                y: LEGEND.y + LEGEND.gap,
                text: vis ? (state.real ? '實像' : '虛像') : '像在畫面外',
                col: OpticsScene.C_IMG,
                dash: state.real ? null : [9, 7],
                sample: vis,
            });
        }
        rows.push({
            y: LEGEND.y + 2 * LEGEND.gap, text: 'O 鏡心　F、F′ 焦點',
            col: OpticsScene.C_NORMAL, dash: null, sample: false,
        });
        return rows;
    }

    /** 焦點字母：F 在軸下、F′ 在軸上（理由見檔頭）。 */
    function pointLabels(state) {
        return {
            F: { x: state.F.x, y: AXIS_Y + 30, text: 'F', align: 'center' },
            Fp: { x: state.Fp.x, y: AXIS_Y - 30, text: 'F′', align: 'center' },
        };
    }

    /** 第 i 條光線上的脈衝位置。兩條光線錯開半個週期。 */
    function pulsePoint(state, t, i) {
        const ray = state.rays[i] || state.rays[0];
        if (!ray || !(ray.totalLen > 0)) return null;
        let s = (t * PULSE_SPEED + i * 0.5 * ray.totalLen) % ray.totalLen;
        if (s < 0) s += ray.totalLen;
        return OpticsKit.thinLensRayPointAt(ray, s);
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;
        const label = state.type === 'convex' ? '凸透鏡（會聚）' : '凹透鏡（發散）';

        // 主軸
        OS.dashed(p, view, { x: 70, y: AXIS_Y }, { x: 870, y: AXIS_Y },
                  OS.C_NORMAL, { w: 1.3 });
        OS.worldBadge(p, view, 72, AXIS_Y - 18, '主軸',
                      { size: 12, col: OS.C_NORMAL, align: 'left' });

        // 透鏡本體（先畫，光線疊在上面）
        OS.drawThinLens(p, view, LENS_X, AXIS_Y, HALF_H, state.type);
        OS.worldBadge(p, view, LENS_X, 244, label,
                      { size: 13, col: OS.C_NORMAL, align: 'center' });

        // 焦點與鏡心
        OS.drawDot(p, view, state.F.x, AXIS_Y, OS.C_NORMAL, 6);
        OS.drawDot(p, view, state.Fp.x, AXIS_Y, OS.C_NORMAL, 6);
        OS.drawDot(p, view, LENS_X, AXIS_Y, OS.C_NORMAL, 6);

        // 距離尺標
        const dm = dimensionMarks(state);
        OS.drawDimensionH(p, view, dm.u.x1, dm.u.x2, dm.u.y, dm.u.label,
                          OS.C_DIM, { extY: AXIS_Y, labelDy: dm.u.labelDy });
        if (dm.v) {
            OS.drawDimensionH(p, view, dm.v.x1, dm.v.x2, dm.v.y, dm.v.label,
                              OS.C_DIM, { extY: AXIS_Y, labelDy: dm.v.labelDy });
        }

        // 虛像的反向延長線
        for (const ray of state.rays) {
            if (ray.virtualExtension) {
                OS.dashed(p, view, ray.virtualExtension.a, ray.virtualExtension.b,
                          OS.C_RAY_SOFT, { w: 1.6 });
            }
        }

        // 兩條作圖光線：物頂 → 透鏡 → 出射
        for (const ray of state.rays) {
            OS.line(p, view, ray.objectPoint, ray.lensPoint, OS.C_RAY,
                    { w: 2.8, arrowAt: 0.55, head: 11 });
            OS.line(p, view, ray.lensPoint, ray.end, OS.C_RAY,
                    { w: 2.8, arrowAt: 0.55, head: 11 });
            OS.drawDot(p, view, ray.lensPoint.x, ray.lensPoint.y, OS.C_RAY, 5);
        }

        // 像（虛像用虛線；像在畫面外時不畫箭頭）
        if (state.image && imageVisible(state)) {
            OS.drawVerticalArrow(p, view, state.image.base, state.image.top,
                                 OS.C_IMG, {
                                     dash: state.real ? null : [9, 7],
                                     w: 3.5, head: 12,
                                 });
        }

        // 物
        OS.drawVerticalArrow(p, view, state.object.base, state.object.top,
                             OS.C_OBJ, { w: 4, head: 13 });

        // 焦點字母
        const pl = pointLabels(state);
        OS.worldBadge(p, view, pl.F.x, pl.F.y, pl.F.text,
                      { size: 12, col: OS.C_NORMAL, align: pl.F.align });
        OS.worldBadge(p, view, pl.Fp.x, pl.Fp.y, pl.Fp.text,
                      { size: 12, col: OS.C_NORMAL, align: pl.Fp.align });

        // 左上角圖例
        for (const row of legendRows(state)) {
            if (row.sample) {
                OS.line(p, view,
                        { x: LEGEND.x, y: row.y },
                        { x: LEGEND.x + LEGEND.sample, y: row.y },
                        row.col, { w: 3, dash: row.dash });
            }
            OS.worldBadge(p, view, LEGEND.x + (row.sample ? LEGEND.sample + 10 : 0),
                          row.y, row.text,
                          { size: 12, col: row.col, align: 'left' });
        }

        // 物標籤（放在物的箭頭左側）
        OS.worldBadge(p, view, state.object.top.x - 24, state.object.top.y,
                      '物', { size: 13, col: OS.C_OBJ, align: 'right' });

        // 光脈衝
        if (panel.started) {
            for (let i = 0; i < state.rays.length; i++) {
                const q = pulsePoint(state, t, i);
                if (q) OS.drawPulse(p, view, q.x, q.y, OS.C_RAY, { r: 9 });
            }
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight) => ({ label, id, unit, highlight });

    OpticsScene.run({
        formula: '\\frac{1}{u}+\\frac{1}{v}=\\frac{1}{f}',
        formulaFallback: '1/u + 1/v = 1/f',

        controls: {
            selects: [{
                key: 'type', label: '透鏡的種類', def: 'convex', live: true,
                options: [
                    { v: 'convex', t: '凸透鏡（會聚）' },
                    { v: 'concave', t: '凹透鏡（發散）' },
                ],
            }],
            sliders: [
                { key: 'u', label: '物距 u', def: 18, min: 2, max: 20,
                  step: 1, unit: 'cm', dec: 1 },
                { key: 'f', label: '焦距大小 |f|', def: 7, min: 5, max: 10,
                  step: 1, unit: 'cm', dec: 1 },
                { key: 'h', label: '物高 h', def: 5, min: 3, max: 6,
                  step: 0.5, unit: 'cm', dec: 1 },
            ],
        },

        cards: [
            CARD('物距 u', 'cardU', 'cm', true),
            CARD('像距 v', 'cardV', 'cm', true),
            CARD('焦距 f', 'cardF', 'cm'),
            CARD('放大率 M', 'cardM', ''),
            CARD('像高 h′', 'cardHp', 'cm'),
            CARD('像的大小', 'cardSize', ''),
            CARD('像的性質', 'cardNature', ''),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            return {
                cardU: g.u.toFixed(1),
                cardV: g.infinite ? '∞' : g.vSigned.toFixed(1),
                cardF: g.fSigned.toFixed(1),
                cardM: g.infinite ? '—' : g.M.toFixed(2),
                cardHp: g.infinite ? '—' : g.hSigned.toFixed(1),
                cardSize: g.infinite ? '—' : g.sizeWord,
                cardNature: g.infinite ? '不成像'
                    : (g.real ? '倒立實像' : '正立虛像'),
            };
        },

        titleText(t, panel, g) {
            const label = g.type === 'convex' ? '凸透鏡' : '凹透鏡';
            if (g.infinite) {
                return `${label}　u = f = ${g.f.toFixed(1)} cm`
                     + '　折射光線平行射出（不成像）';
            }
            const where = imageVisible(g) ? '' : '　（像在畫面外）';
            return `${label}　u = ${g.u.toFixed(1)} cm`
                 + `　v = ${g.vSigned.toFixed(1)} cm`
                 + `　${g.nature}${where}`;
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
            LENS_X, AXIS_Y, SCALE, HALF_H, SCENE_RECT,
            DIM_Y_U, DIM_Y_V, PULSE_SPEED, LEGEND,
            stateFor, imageVisible, dimensionMarks, legendRows, pointLabels,
            pulsePoint, drawScene,
        };
    }
})();
