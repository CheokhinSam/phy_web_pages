/**
 * 🪞 球面鏡成像（凹面鏡／凸面鏡）
 *
 * 這一頁的教學本體是「物距 u、焦距 f 與像的關係」。像的位置、大小、正倒
 * 全部從 `OpticsKit.sphericalMirrorGeometry()` 來：面鏡公式算出 v 與 M，
 * 兩條作圖光線再從同一份幾何長出來。
 *
 * ==========================================================================
 * ⚠️ 光線要落在弧面上，不能穿到鏡背
 * ==========================================================================
 * 近軸作圖的反射點在「鏡頂平面」x = mirrorX 上；但球面鏡的弧面在鏡頂以外
 * 是往後退的。若直接把光線畫到鏡頂平面，凹面鏡的光線會穿過弧面、凸面鏡的
 * 光線則停在弧面前面——`errs=0`、卡片全對，只有截圖看得出來。
 *
 * 所以 kit 對每一條光線同時給兩組座標：
 *   mirrorPoint  近軸作圖的反射點（在鏡頂平面上，公式用它）
 *   surfacePoint 畫面上的反射點（真的在弧面上）
 * 畫面上的反射線從 surfacePoint 出發、朝著像頂過去；兩條反射線在畫面上
 * 仍然交於像頂，但入射段和「通過焦點」那一條只差幾個世界單位。
 *
 * ==========================================================================
 * ⚠️ 四個標籤的位置是算出來的，不是排出來的
 * ==========================================================================
 * C、F、O 都在主軸上，而主軸附近同時有物的箭頭、兩條入射線、兩條反射線
 * 與鏡面的弧。固定偏移（例如「右上 34 / 26」）在預設參數下就會被反射線
 * 穿過；物距接近焦距時 F 又會和物的箭頭重疊；凸面鏡的 O 還會壓在水平的
 * 反射線上。所以標籤先列候選位置，再依現場的線段、弧面與其他標籤挑選：
 * C/F/O 三顆**一起**枚舉（逐一放置會讓先放的佔走後放的唯一空位），
 * 「物」則另外挑一個不碰線的位置。
 *
 * 物距預設 18 cm（不是 15 cm）：u=15、f=7 時物與像只差 22 個世界單位，
 * 兩支箭頭幾乎疊在一起；u=18 時像距 11.5 cm，兩支箭頭分得開，預設畫面
 * 才看得懂「像在鏡前、倒立、縮小」。
 */
(function () {
    'use strict';

    const MIRROR_X = 600;
    const AXIS_Y = 420;
    const SCALE = 12;              // 1 cm = 12 個世界單位
    const ARC_HALF = 150;          // 鏡面孔徑的半高（世界單位）
    const SCENE_RECT = { x0: 40, y0: 40, x1: 860, y1: 780 };
    const DIM_Y_U = 690;
    const DIM_Y_V = 736;
    const PULSE_SPEED = 240;       // 世界單位／秒
    const LEGEND = { x: 56, y: 78, sample: 42, gap: 38 };
    const LABEL_BOX = { hw: 18, hh: 14, gap: 4 };

    // 「物」標籤的候選位移（相對物頂，世界單位）。順序是偏好：先試箭頭
    // 左上方，再沿著左側往外、往上，最後才跨到右側。真正的位置由
    // objectLabel() 依現場的箭頭、光線與弧面挑第一個不碰撞的。
    const OBJECT_LABEL_OFFSETS = (() => {
        const out = [];
        for (const dx of [-40, -72, -104, 0, 40, 72, 104]) {
            for (const dy of [-34, -72, -104, -8, 24, 56, 88]) {
                out.push({ dx, dy });
            }
        }
        return out;
    })();

    // ======================================================================
    // 這一頁的狀態（純資料）
    // ======================================================================

    function stateFor(panel) {
        const type = panel && panel.type === 'convex' ? 'convex' : 'concave';
        const u = panel && panel.u != null ? panel.u : 18;
        const f = panel && panel.f != null ? panel.f : 7;
        const h = panel && panel.h != null ? panel.h : 5;
        return OpticsKit.sphericalMirrorGeometry({
            type, u, f, h,
            mirrorX: MIRROR_X,
            axisY: AXIS_Y,
            cmPerUnit: SCALE,
            arcHalf: ARC_HALF,
            scene: SCENE_RECT,
        });
    }

    /** 像有沒有落在畫面的安全範圍裡（卡片仍然照樣顯示 v）。 */
    function imageVisible(state) {
        const im = state.image;
        if (!im) return false;
        const m = 28;
        return im.base.x >= SCENE_RECT.x0 + m &&
               im.base.x <= SCENE_RECT.x1 - m &&
               im.top.y >= SCENE_RECT.y0 + m &&
               im.top.y <= SCENE_RECT.y1 - m;
    }

    /** 真正會畫出來的光線：第二條落在孔徑外時就不畫。 */
    function drawnRays(state) {
        return state.rays.filter(r => r.inAperture);
    }

    function dimensionMarks(state) {
        const marks = {
            u: {
                x1: state.object.base.x, x2: MIRROR_X, y: DIM_Y_U,
                label: `u = ${state.u.toFixed(1)} cm`, labelDy: -30,
            },
            v: null,
        };
        if (state.formed && imageVisible(state)) {
            marks.v = {
                x1: MIRROR_X, x2: state.image.base.x, y: DIM_Y_V,
                label: `v = ${state.vSigned.toFixed(1)} cm`, labelDy: 32,
            };
        }
        return marks;
    }

    function makeBox(x, y, pad) {
        pad = pad || 0;
        return {
            x0: x - LABEL_BOX.hw - pad, x1: x + LABEL_BOX.hw + pad,
            y0: y - LABEL_BOX.hh - pad, y1: y + LABEL_BOX.hh + pad,
        };
    }

    function boxesOverlap(a, b) {
        return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    }

    /** 線段 ab 與矩形 box 是否相交（Liang–Barsky，和 headless 驗證器同一支）。 */
    function segHitsBox(a, b, box) {
        let t0 = 0, t1 = 1;
        const dx = b.x - a.x, dy = b.y - a.y;
        const p = [-dx, dx, -dy, dy];
        const q = [a.x - box.x0, box.x1 - a.x, a.y - box.y0, box.y1 - a.y];
        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) { if (q[i] < 0) return false; continue; }
            const r = q[i] / p[i];
            if (p[i] < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
        }
        return true;
    }

    /** 畫面上所有會擋住標籤的線段（物箭頭、像箭頭、光線、弧面）。 */
    function sceneObstacles(state) {
        const obstacles = [];
        obstacles.push({ a: state.object.base, b: state.object.top, pad: 8 });
        if (state.formed && imageVisible(state)) {
            obstacles.push({ a: state.image.base, b: state.image.top, pad: 8 });
        }
        for (const ray of drawnRays(state)) {
            obstacles.push({ a: ray.objectPoint, b: ray.surfacePoint, pad: 5 });
            obstacles.push({ a: ray.surfacePoint, b: ray.visualEnd, pad: 5 });
            if (ray.fExtension) obstacles.push({
                a: ray.fExtension.a, b: ray.fExtension.b, pad: 4,
            });
            if (ray.virtualExtension) obstacles.push({
                a: ray.virtualExtension.a, b: ray.virtualExtension.b, pad: 4,
            });
        }
        const nArc = 24;
        const half = Math.min(ARC_HALF, state.rUnits * 0.98);
        for (let i = 0; i < nArc; i++) {
            const y1 = AXIS_Y - half + (2 * half) * i / nArc;
            const y2 = AXIS_Y - half + (2 * half) * (i + 1) / nArc;
            obstacles.push({
                a: { x: OpticsKit.sphericalArcX(state.type, MIRROR_X, AXIS_Y,
                                                state.rUnits, y1), y: y1 },
                b: { x: OpticsKit.sphericalArcX(state.type, MIRROR_X, AXIS_Y,
                                                state.rUnits, y2), y: y2 },
                pad: 5,
            });
        }
        return obstacles;
    }

    function boxPenalty(box, obstacles, boxObs) {
        if (box.x0 < SCENE_RECT.x0 || box.x1 > SCENE_RECT.x1 ||
            box.y0 < SCENE_RECT.y0 || box.y1 > SCENE_RECT.y1) return 1000;
        let n = 0;
        for (const ob of obstacles) {
            if (segHitsBox(ob.a, ob.b, makeBox(
                    (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2,
                    LABEL_BOX.gap + ob.pad))) n++;
        }
        for (const o of boxObs) if (boxesOverlap(box, o.box)) n++;
        return n;
    }

    function objectLabel(state, obstacles) {
        // 物標籤不能寫死在箭身中段：凸面鏡的「通過焦點」反射線是一條
        // 從中段高度往左射出的水平線，白底徽章會把它切出一個缺口；
        // 凹面鏡的虛像情形則是反射線從物的上方斜穿過去。所以和 C/F/O
        // 一樣，依現場幾何挑第一個不碰線、不出界的位置。
        const obs = obstacles || sceneObstacles(state);
        const anchor = state.object.top;
        let best = null, bestPenalty = Infinity;
        for (const off of OBJECT_LABEL_OFFSETS) {
            if (Math.hypot(off.dx, off.dy) > 120) continue;
            const x = anchor.x + off.dx, y = anchor.y + off.dy;
            const box = makeBox(x, y);
            const pen = boxPenalty(box, obs, []);
            if (pen < bestPenalty) {
                bestPenalty = pen;
                best = { x, y, box };
            }
            if (pen === 0) break;
        }
        return {
            x: best.x, y: best.y, align: 'center', text: '物', box: best.box,
        };
    }

    /**
     * C、F、O 三個字母的位置。
     *
     * 這不是排版偏好：三個點都在主軸上，而主軸附近同時有物的箭頭、兩條
     * 入射光線與兩條反射線。字母放在「點的右上方 34 / 26」在預設參數下
     * 就會被反射線穿過（凸面鏡的 O 還剛好壓在水平反射線上）；物距接近
     * 焦距時，F 的字母又會和一整支物的箭頭重疊。所以三顆字母的候選位置
     * **一起**枚舉，取總碰撞最少、而且彼此不重疊的一組；逐一放置會讓
     * 先放的字母佔走後放的唯一空位。
     *
     * 回傳的 box 是保守外框（18 × 14 個世界單位），驗證器用同一個外框。
     */
    function pointLabels(state) {
        const obstacles = sceneObstacles(state);
        const ol = objectLabel(state, obstacles);
        const boxObs = [{ box: makeBox(ol.x, ol.y, LABEL_BOX.gap) }];

        const CANDIDATES = [
            { dx: 34, dy: -26 }, { dx: -34, dy: -26 },
            { dx: 0, dy: -104 }, { dx: 34, dy: -104 }, { dx: -34, dy: -104 },
            { dx: 72, dy: -26 }, { dx: -72, dy: -26 },
            { dx: 104, dy: -26 }, { dx: -104, dy: -26 },
            { dx: 34, dy: 26 }, { dx: -34, dy: 26 },
            { dx: 72, dy: 26 }, { dx: -72, dy: 26 },
            { dx: 104, dy: 26 }, { dx: -104, dy: 26 }, { dx: 0, dy: 90 },
        ];

        const options = {};
        for (const key of ['C', 'F', 'O']) {
            const pt = state[key];
            options[key] = CANDIDATES.map(cand => {
                const x = pt.x + cand.dx, y = pt.y + cand.dy;
                const box = makeBox(x, y);
                return { x, y, box, base: boxPenalty(box, obstacles, boxObs) };
            });
        }

        // 三顆字母**一起挑**，不是逐一放置。逐一放置時先放的那顆會佔走
        // 後放的唯一空位（實測 concave f=9 u=3：F 坐到 O 的空位上，O 只剩
        // 「壓在像的箭頭上」這個選擇）。這裡枚舉 12³ 組，取總碰撞最少、
        // 而且彼此不重疊的一組；候選順序仍然是「離點近的優先」。
        let best = null, bestScore = Infinity;
        for (const c of options.C) {
            for (const f of options.F) {
                for (const o of options.O) {
                    const score = c.base + f.base + o.base
                        + (boxesOverlap(c.box, f.box) ? 100 : 0)
                        + (boxesOverlap(c.box, o.box) ? 100 : 0)
                        + (boxesOverlap(f.box, o.box) ? 100 : 0);
                    if (score < bestScore) {
                        bestScore = score;
                        best = { C: c, F: f, O: o };
                    }
                }
            }
        }

        const out = {};
        for (const key of ['C', 'F', 'O']) {
            const picked = best[key];
            out[key] = {
                x: picked.x, y: picked.y, align: 'center',
                text: key, box: picked.box,
            };
        }
        return out;
    }

    /**
     * 左上角圖例。像的標籤放在這裡而不是箭頭旁邊：反射線和虛線延長線都
     * 會經過像的附近，貼在箭頭上的字很容易被一條線穿過。
     */
    function legendRows(state) {
        const rows = [{
            y: LEGEND.y, text: '物', col: OpticsScene.C_OBJ,
            dash: null, sample: true,
        }];
        if (!state.formed) {
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
            y: LEGEND.y + 2 * LEGEND.gap, text: 'C 球心　F 焦點',
            col: OpticsScene.C_NORMAL, dash: null, sample: false,
        });
        return rows;
    }

    /** 第 i 條光線上的脈衝位置。兩條光線錯開半個週期。 */
    function pulsePoint(state, t, i) {
        const rays = drawnRays(state);
        const ray = rays[i] || rays[0];
        if (!ray || !(ray.visualTotalLen > 0)) return null;
        let s = (t * PULSE_SPEED + i * 0.5 * ray.visualTotalLen) % ray.visualTotalLen;
        if (s < 0) s += ray.visualTotalLen;
        return OpticsKit.sphericalRayPointAt(ray, s);
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;
        const isConcave = state.type === 'concave';
        const side = isConcave ? 1 : -1;   // 標籤往鏡面的哪一側讓開
        const label = isConcave ? '凹面鏡' : '凸面鏡';

        // 主軸
        OS.dashed(p, view, { x: 70, y: AXIS_Y }, { x: 870, y: AXIS_Y },
                  OS.C_NORMAL, { w: 1.3 });
        OS.worldBadge(p, view, 72, AXIS_Y - 18, '主軸',
                      { size: 12, col: OS.C_NORMAL, align: 'left' });

        // 鏡面弧
        OS.drawMirrorArc(p, view, MIRROR_X, AXIS_Y, state.rUnits,
                         ARC_HALF, state.type);

        // C、F、O 三個點
        OS.drawDot(p, view, state.C.x, AXIS_Y, OS.C_NORMAL, 6);
        OS.drawDot(p, view, state.F.x, AXIS_Y, OS.C_NORMAL, 6);
        OS.drawDot(p, view, MIRROR_X, AXIS_Y, OS.C_NORMAL, 6);
        OS.worldBadge(p, view, MIRROR_X + side * 24, 244, label,
                      { size: 13, col: OS.C_NORMAL,
                        align: side > 0 ? 'left' : 'right' });

        // 距離尺標
        const dm = dimensionMarks(state);
        OS.drawDimensionH(p, view, dm.u.x1, dm.u.x2, dm.u.y, dm.u.label,
                          OS.C_DIM, { extY: AXIS_Y, labelDy: dm.u.labelDy });
        if (dm.v) {
            OS.drawDimensionH(p, view, dm.v.x1, dm.v.x2, dm.v.y, dm.v.label,
                              OS.C_DIM, { extY: AXIS_Y, labelDy: dm.v.labelDy });
        }

        const rays = drawnRays(state);

        // 「通過焦點」那條線的輔助虛線（F 不在入射段上時才需要）
        for (const ray of rays) {
            if (ray.fExtension) {
                OS.dashed(p, view, ray.fExtension.a, ray.fExtension.b,
                          OS.C_RAY_SOFT, { w: 1.2 });
            }
        }

        // 虛像的反向延長線
        for (const ray of rays) {
            if (ray.virtualExtension) {
                OS.dashed(p, view, ray.virtualExtension.a, ray.virtualExtension.b,
                          OS.C_RAY_SOFT, { w: 1.6 });
            }
        }

        // 入射與反射光線
        for (const ray of rays) {
            OS.line(p, view, ray.objectPoint, ray.surfacePoint, OS.C_RAY,
                    { w: 2.8, arrowAt: 0.55, head: 11 });
            OS.line(p, view, ray.surfacePoint, ray.visualEnd, OS.C_RAY,
                    { w: 2.8, arrowAt: 0.55, head: 11 });
            OS.drawDot(p, view, ray.surfacePoint.x, ray.surfacePoint.y,
                       OS.C_RAY, 6);
        }

        // 像（虛像用虛線；像在畫面外時不畫箭頭，只留圖例與卡片）
        if (state.formed && imageVisible(state)) {
            OS.drawVerticalArrow(p, view, state.image.base, state.image.top,
                                 OS.C_IMG, {
                                     dash: state.real ? null : [9, 7],
                                     w: 3.5, head: 12,
                                 });
        }

        // 物
        OS.drawVerticalArrow(p, view, state.object.base, state.object.top,
                             OS.C_OBJ, { w: 4, head: 13 });

        // C、F、O 的字母最後才畫：位置已經避開所有線段，畫在最上層
        // 是為了避免圓弧或箭尖的端點壓到字。
        const pl = pointLabels(state);
        for (const key of ['C', 'F', 'O']) {
            OS.worldBadge(p, view, pl[key].x, pl[key].y, pl[key].text,
                          { size: 12, col: OS.C_NORMAL, align: 'center' });
        }

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

        // 物標籤
        const ol = objectLabel(state);
        OS.worldBadge(p, view, ol.x, ol.y, ol.text,
                      { size: 13, col: OS.C_OBJ, align: ol.align });

        // 光脈衝
        if (panel.started) {
            for (let i = 0; i < rays.length; i++) {
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
        formula: "\\frac{1}{u}+\\frac{1}{v}=\\frac{1}{f}",
        formulaFallback: "1/u + 1/v = 1/f",

        controls: {
            selects: [{
                key: 'type', label: '鏡的種類', def: 'concave', live: true,
                options: [
                    { v: 'concave', t: '凹面鏡（會聚）' },
                    { v: 'convex', t: '凸面鏡（發散）' },
                ],
            }],
            sliders: [
                { key: 'u', label: '物距 u', def: 18, min: 2, max: 20,
                  step: 1, unit: 'cm', dec: 1 },
                { key: 'f', label: '焦距大小 |f|', def: 7, min: 7, max: 10,
                  step: 1, unit: 'cm', dec: 1 },
                { key: 'h', label: '物高 h', def: 5, min: 3, max: 6,
                  step: 0.5, unit: 'cm', dec: 1 },
            ],
        },

        cards: [
            CARD('物距 u', 'cardU', 'cm', true),
            CARD('像距 v', 'cardV', 'cm', true),
            CARD('焦距 f', 'cardF', 'cm'),
            CARD('曲率半徑 R', 'cardR', 'cm'),
            CARD('物高 h', 'cardH', 'cm'),
            CARD('像高 h′', 'cardHp', 'cm'),
            CARD('放大率 M', 'cardM', ''),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            return {
                cardU: g.u.toFixed(1),
                cardV: g.infinite ? '∞' : g.vSigned.toFixed(1),
                cardF: g.fSigned.toFixed(1),
                cardR: (2 * g.f).toFixed(1),
                cardH: g.h.toFixed(1),
                cardHp: g.infinite ? '—' : g.hSigned.toFixed(1),
                cardM: g.infinite ? '—' : g.M.toFixed(2),
            };
        },

        titleText(t, panel, g) {
            const label = g.type === 'concave' ? '凹面鏡' : '凸面鏡';
            if (g.infinite) {
                return `${label}　u = f = ${g.f.toFixed(1)} cm`
                     + '　像在無窮遠（不成像）';
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
            MIRROR_X, AXIS_Y, SCALE, ARC_HALF, SCENE_RECT,
            DIM_Y_U, DIM_Y_V, PULSE_SPEED, LEGEND, LABEL_BOX,
            stateFor, imageVisible, drawnRays, dimensionMarks,
            objectLabel, pointLabels, legendRows, pulsePoint, drawScene,
        };
    }
})();
