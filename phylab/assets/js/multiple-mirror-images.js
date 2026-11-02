/**
 * 🪞 平面鏡的多次反射成像
 *
 * 兩面平面鏡夾一個角 θ，物體放在夾角裡面。光線可以在兩面鏡子之間來回
 * 反射，所以除了兩面鏡子各自的第一個像以外，還會出現「像再被另一面鏡子
 * 反射」的第二個、第三個像。這些像全部落在同一個圓上，圓心是兩面鏡子的
 * 交點，半徑就是物體到交點的距離。
 *
 * ==========================================================================
 * ⚠️ 公式與符號沿用教材
 * ==========================================================================
 * n = 360° / θ。
 * n 是偶數：像數 = n − 1。
 * n 是奇數：物在分角線上 → 像數 = n − 1；物不在分角線上 → 像數 = n。
 * n 不是正整數：沒有簡單公式，畫圖求之。
 *
 * 這一頁的角度下拉只放「能整除 360°」的角度，所以 n 一定是正整數；
 * 「n 不是正整數」那一條寫在右側說明裡，不在畫面上假裝算得出來。
 *
 * ==========================================================================
 * ⚠️ 像是一個一個「反射出來的」，不是用角度公式排出來的
 * ==========================================================================
 * 每一面鏡子只反射「在它前面」的點：物體在兩面鏡子前面，所以先得到兩個
 * 一次反射的像；某個像如果落在另一面鏡子的前面，才可以再被那一面反射。
 * 一旦某個像跑到某面鏡子的背後，它就不能再被那面鏡子反射——這正是教材
 * 說的「落在鏡後的像不再成像」。用這個規則逐次反射，算出來的像數在
 * θ = 30°、36°、40°、45°、60°、72°、90°、120° 全部與公式逐位相符
 * （包含 n 為奇數時「在／不在分角線」的差別）。
 *
 * 直接套角度公式排像的寫法在 n 為偶數時看起來也對，但 n 為奇數、物不在
 * 分角線時會少一個像，而畫面、卡片、標題會一起錯得很自洽。
 *
 * ==========================================================================
 * ⚠️ 這一頁的 START 會讓物體沿圓弧來回移動
 * ==========================================================================
 * 這一頁的幾何是靜態的；如果 START 不做任何事，按下去畫面文風不動。
 * 所以 onFrame 會把「物體在夾角中的位置」慢慢來回掃過分角線——n 為奇數
 * 時，掃過分角線的那一瞬間像數會少一個，這是這一頁最重要的觀察。
 */

(function () {
    'use strict';

    const VERTEX = { x: 450, y: 450 };
    const RADIUS = 200;            // 物體與所有像到交點的距離
    const MIRROR_LEN = 330;
    const POS_MIN = 0.10;
    const POS_MAX = 0.90;
    const SWEEP_SPEED = 0.6;       // rad/s
    const SCENE_RECT = { x0: 8, y0: 8, x1: 892, y1: 806 };
    const LEGEND = { x: 54, y: 74, gap: 30 };

    const C_ODD = [234, 88, 12];       // 奇數次反射：橘
    const C_EVEN = [124, 58, 237];     // 偶數次反射：紫

    const ANGLE_OPTIONS = [30, 36, 40, 45, 60, 72, 90, 120];

    // ======================================================================
    // 這一頁的物理（純函式）
    // ======================================================================

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    /** 兩面鏡子的單位方向、內側法線與交點。 */
    function mirrorFrame(thetaDeg) {
        const h = thetaDeg * Math.PI / 360;
        const uA = { x: Math.cos(-h), y: Math.sin(-h) };
        const uB = { x: Math.cos(h), y: Math.sin(h) };
        // 內側法線：指向夾角裡面（用另一面鏡子的方向判斷正負）。
        let nA = { x: -uA.y, y: uA.x };
        if (nA.x * uB.x + nA.y * uB.y < 0) nA = { x: -nA.x, y: -nA.y };
        let nB = { x: -uB.y, y: uB.x };
        if (nB.x * uA.x + nB.y * uA.y < 0) nB = { x: -nB.x, y: -nB.y };
        return { h, uA, uB, nA, nB };
    }

    function inFront(P, n) {
        return (P.x - VERTEX.x) * n.x + (P.y - VERTEX.y) * n.y > 1e-9;
    }

    function reflectAcross(P, n) {
        const d = (P.x - VERTEX.x) * n.x + (P.y - VERTEX.y) * n.y;
        return { x: P.x - 2 * d * n.x, y: P.y - 2 * d * n.y };
    }

    function angleOf(P) {
        return Math.atan2(P.y - VERTEX.y, P.x - VERTEX.x);
    }

    /**
     * 逐次反射。回傳的 images 不含物體本身，每一項是
     * { x, y, depth, angle, parity }。
     *
     * 佇列裡只放「已經在某一面鏡子前面、可以被反射」的點；物體本身
     * 一開始就在兩面鏡子前面，所以會直接生出兩個一次反射的像。
     */
    function imagesFor(thetaDeg, posFrac) {
        const frame = mirrorFrame(thetaDeg);
        const h = frame.h;
        const frac = clamp(num(posFrac, 0.35), 0, 1);
        const phi = -h + 2 * h * frac;
        const obj = {
            x: VERTEX.x + RADIUS * Math.cos(phi),
            y: VERTEX.y + RADIUS * Math.sin(phi),
        };
        const seen = [obj];
        const queue = [{ pt: obj, depth: 0 }];
        const images = [];
        const mirrors = [frame.nA, frame.nB];

        while (queue.length) {
            const cur = queue.shift();
            for (const n of mirrors) {
                if (!inFront(cur.pt, n)) continue;
                const q = reflectAcross(cur.pt, n);
                if (seen.some(s => Math.hypot(s.x - q.x, s.y - q.y) < 1e-7)) continue;
                seen.push(q);
                const depth = cur.depth + 1;
                images.push({
                    x: q.x, y: q.y, depth,
                    angle: angleOf(q),
                    parity: depth % 2 ? 'odd' : 'even',
                });
                queue.push({ pt: q, depth });
            }
        }
        return { obj, images, frame };
    }

    function nOf(thetaDeg) {
        return 360 / thetaDeg;
    }

    function isIntegerN(thetaDeg) {
        const n = nOf(thetaDeg);
        return Math.abs(n - Math.round(n)) < 1e-9;
    }

    function onBisector(posFrac) {
        return Math.abs(num(posFrac, 0.35) - 0.5) <= 1e-6;
    }

    function ruleFor(thetaDeg, posFrac) {
        if (!isIntegerN(thetaDeg)) return 'n 不是正整數：畫圖求之';
        const n = Math.round(nOf(thetaDeg));
        if (n % 2 === 0) return 'n 為偶數：像數 = n − 1';
        return onBisector(posFrac)
            ? 'n 為奇數、物在分角線：像數 = n − 1'
            : 'n 為奇數、物不在分角線：像數 = n';
    }

    function stateFor(panel) {
        panel = panel || {};
        // 下拉的值是字串；stateFor 也可能被直接餵字串，所以先轉數字。
        const th = Number(panel.theta);
        const theta = ANGLE_OPTIONS.includes(th) ? th : 120;
        const pos = clamp(num(panel.pos, 0.35), POS_MIN, POS_MAX);
        const g = imagesFor(theta, pos);
        const n = nOf(theta);
        const bis = onBisector(pos);
        return {
            theta, n, nInteger: isIntegerN(theta),
            pos, onBisector: bis,
            rule: ruleFor(theta, pos),
            obj: g.obj,
            images: g.images,
            count: g.images.length,
            frame: g.frame,
            circleRadius: RADIUS,
            vertex: VERTEX,
        };
    }

    /** 圖例：顏色代表反射次數的奇偶。 */
    function legendRows() {
        return [
            { text: '物體', col: [37, 99, 235], kind: 'dot' },
            { text: '偶數次反射（左右相同）', col: C_EVEN, kind: 'dot' },
            { text: '奇數次反射（左右相反）', col: C_ODD, kind: 'dot' },
            { text: '所有像都在同一個圓上', col: [148, 163, 184], kind: 'circle' },
        ];
    }

    /** 像的標籤位置：沿半徑往外放，和點本身錯開。 */
    function imageLabelAt(img, i) {
        const a = img.angle;
        return {
            x: VERTEX.x + (RADIUS + 30) * Math.cos(a),
            y: VERTEX.y + (RADIUS + 30) * Math.sin(a),
            align: 'center',
            text: String(i + 1),
        };
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    /** 斜的平面鏡：鏡面本體、反射面的亮線、背面的斜線。 */
    function drawSlantedMirror(p, view, u, nIn, len, label, labelCol) {
        const OS = OpticsScene;
        const a = VERTEX;
        const b = { x: a.x + u.x * len, y: a.y + u.y * len };
        const back = { x: -nIn.x, y: -nIn.y };
        const gap = 24, depth = 17, slant = -10;

        p.push();
        OS.strokeOn(p, OS.C_HATCH, OS.L(view, 1.4, 1));
        for (let s = 12; s < len; s += gap) {
            const q = { x: a.x + u.x * s, y: a.y + u.y * s };
            p.line(view.toScreenX(q.x), view.toScreenY(q.y),
                   view.toScreenX(q.x + back.x * depth + u.x * slant),
                   view.toScreenY(q.y + back.y * depth + u.y * slant));
        }
        p.pop();

        OS.line(p, view, a, b, OS.C_MIRROR, { w: 5 });
        OS.line(p, view,
                { x: a.x + nIn.x * 3, y: a.y + nIn.y * 3 },
                { x: b.x + nIn.x * 3, y: b.y + nIn.y * 3 },
                [226, 232, 240], { w: 1.2 });

        OS.worldBadge(p, view, b.x + u.x * 24, b.y + u.y * 24, label,
                      { size: 12, col: labelCol, align: 'center' });
    }

    /** 虛線圓：所有像都在這個圓上。 */
    function drawCircleDashed(p, view, cx, cy, r, col) {
        const ctx = p.drawingContext;
        p.push();
        p.noFill();
        OpticsScene.strokeOn(p, col, OpticsScene.L(view, 1.4, 1));
        if (ctx.setLineDash) {
            ctx.setLineDash([OpticsScene.L(view, 8, 4), OpticsScene.L(view, 7, 3)]);
        }
        p.ellipse(view.toScreenX(cx), view.toScreenY(cy),
                  OpticsScene.L(view, 2 * r), OpticsScene.L(view, 2 * r));
        if (ctx.setLineDash) ctx.setLineDash([]);
        p.pop();
    }

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;
        const f = state.frame;
        const v = state.vertex;

        // 夾角的淡色底（只在夾角裡面）
        p.push();
        p.noStroke();
        p.fill(219, 234, 254, 46);
        p.beginShape();
        p.vertex(view.toScreenX(v.x), view.toScreenY(v.y));
        for (let i = 0; i <= 40; i++) {
            const a = -f.h + 2 * f.h * i / 40;
            p.vertex(view.toScreenX(v.x + MIRROR_LEN * 0.96 * Math.cos(a)),
                     view.toScreenY(v.y + MIRROR_LEN * 0.96 * Math.sin(a)));
        }
        p.endShape(p.CLOSE);
        p.pop();

        // 共同的圓
        drawCircleDashed(p, view, v.x, v.y, state.circleRadius, OS.C_DIM);

        // 兩面鏡子
        drawSlantedMirror(p, view, f.uA, f.nA, MIRROR_LEN, '鏡 A', OS.C_MIRROR);
        drawSlantedMirror(p, view, f.uB, f.nB, MIRROR_LEN, '鏡 B', OS.C_MIRROR);

        // 夾角 θ 的弧與標籤
        const a0 = -f.h, a1 = f.h;
        p.push();
        p.noFill();
        OS.strokeOn(p, OS.C_NORMAL, OS.L(view, 1.8, 1.2));
        const arcR = 96;
        p.beginShape();
        for (let i = 0; i <= 36; i++) {
            const a = a0 + (a1 - a0) * i / 36;
            p.vertex(view.toScreenX(v.x + arcR * Math.cos(a)),
                     view.toScreenY(v.y + arcR * Math.sin(a)));
        }
        p.endShape();
        p.pop();
        OS.worldBadge(p, view, v.x + (arcR + 24) * Math.cos(0),
                      v.y + (arcR + 24) * Math.sin(0),
                      `θ = ${state.theta}°`,
                      { size: 13, col: OS.C_LABEL, align: 'center' });

        // 交點 O
        OS.drawDot(p, view, v.x, v.y, OS.C_MIRROR, 6);
        OS.worldBadge(p, view, v.x - 18, v.y + 22, 'O',
                      { size: 12, col: OS.C_MIRROR, align: 'right' });

        // 物體。物體靠近分角線時，內側的「物」標籤會和 θ 的標籤黏在一起
        // （θ 的徽章就畫在分角線上）；這時把標籤移到圓外。
        OS.drawDot(p, view, state.obj.x, state.obj.y, OS.C_OBJ, 9);
        const oa = Math.atan2(state.obj.y - v.y, state.obj.x - v.x);
        const nearBisector = Math.abs(state.pos - 0.5) < 0.12;
        const objLabelR = nearBisector ? RADIUS + 30 : RADIUS - 34;
        OS.worldBadge(p, view,
                      v.x + objLabelR * Math.cos(oa),
                      v.y + objLabelR * Math.sin(oa),
                      '物', { size: 13, col: OS.C_OBJ, align: 'center' });

        // 像：顏色代表反射次數的奇偶，標籤是編號
        for (let i = 0; i < state.images.length; i++) {
            const im = state.images[i];
            const col = im.parity === 'odd' ? C_ODD : C_EVEN;
            OS.drawDot(p, view, im.x, im.y, col, 7);
            const lb = imageLabelAt(im, i);
            OS.worldBadge(p, view, lb.x, lb.y, lb.text,
                          { size: 11, col, align: lb.align });
        }

        // 左上角圖例
        const rows = legendRows();
        const gap = OS.legendRowGap(view, LEGEND.gap);
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const y = LEGEND.y + i * gap;
            if (row.kind === 'dot') {
                OS.drawDot(p, view, LEGEND.x + 8, y, row.col, 6);
            } else {
                p.push();
                p.noFill();
                OS.strokeOn(p, row.col, OS.L(view, 1.4, 1));
                p.ellipse(view.toScreenX(LEGEND.x + 8), view.toScreenY(y),
                          OS.L(view, 14), OS.L(view, 14));
                p.pop();
            }
            OS.worldBadge(p, view, LEGEND.x + 24, y, row.text,
                          { size: 12, col: row.col, align: 'left' });
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight) => ({ label, id, unit, highlight });

    OpticsScene.run({
        formula: 'n=\\frac{360^\\circ}{\\theta}',
        formulaFallback: 'n = 360° / θ',

        controls: {
            selects: [{
                key: 'theta', label: '兩面鏡子的夾角 θ', def: 120, live: true,
                options: ANGLE_OPTIONS.map(a => ({ v: String(a), t: `${a}°` })),
            }],
            sliders: [{
                key: 'pos', label: '物體在夾角中的位置', def: 0.35,
                min: POS_MIN, max: POS_MAX, step: 0.01, unit: '', dec: 2,
            }],
        },

        cards: [
            CARD('夾角 θ', 'cardTheta', '°', true),
            CARD('n = 360° / θ', 'cardN', ''),
            CARD('像的數目', 'cardCount', '', true),
            CARD('成像規則', 'cardRule', ''),
            CARD('物體的位置', 'cardBisector', ''),
        ],

        model(t, panel) {
            // 下拉的值是字串；stateFor 只接受數字。
            const theta = parseInt(panel.theta, 10);
            return stateFor({ theta, pos: panel.pos });
        },

        values(t, panel, g) {
            return {
                cardTheta: String(g.theta),
                cardN: g.nInteger ? String(Math.round(g.n)) : g.n.toFixed(2),
                cardCount: g.nInteger ? String(g.count) : '—',
                cardRule: g.rule,
                cardBisector: g.onBisector ? '在分角線上' : '不在分角線上',
            };
        },

        titleText(t, panel, g) {
            if (!g.nInteger) {
                return `θ = ${g.theta}°　n = ${g.n.toFixed(2)}（不是正整數）　像數要畫圖求`;
            }
            return `θ = ${g.theta}°　n = ${Math.round(g.n)}`
                 + `　像數 = ${g.count}`
                 + `　${g.onBisector ? '物在分角線' : '物不在分角線'}`;
        },

        onFrame(t, panel) {
            // 讓物體沿圓弧慢慢來回；n 為奇數時會掃過分角線。
            // 在分角線附近停留約 0.25 秒，讓「像數少一個」真的看得見——
            // 連續掃過去時，那一瞬間可能剛好落在兩幀之間。
            const s = Math.sin(t * SWEEP_SPEED);
            const pos = Math.abs(s) < 0.08 ? 0.5 : 0.5 + 0.38 * s;
            panel.set('pos', Math.max(POS_MIN, Math.min(POS_MAX, pos)));
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
            VERTEX, RADIUS, MIRROR_LEN, POS_MIN, POS_MAX, SWEEP_SPEED,
            SCENE_RECT, LEGEND, C_ODD, C_EVEN, ANGLE_OPTIONS,
            clamp, mirrorFrame, inFront, reflectAcross, imagesFor,
            nOf, isIntegerN, onBisector, ruleFor, stateFor,
            legendRows, imageLabelAt, drawScene,
        };
    }
})();
