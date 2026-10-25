/**
 * 🌈 彩色視覺（光的三原色、濾光）
 *
 * 這一頁有三個模式：
 *
 * 1. 加法混色（光）：紅、綠、藍三個聚光燈打在黑幕上，重疊的地方把光
 *    加起來，所以紅＋綠＝黃、紅＋藍＝洋紅、綠＋藍＝青、三色全到＝白。
 * 2. 減法混色（顏料）：青、洋紅、黃三種顏料塗在白紙上，重疊的地方把
 *    色光吸收掉，所以青＋洋紅＝藍、青＋黃＝綠、洋紅＋黃＝紅、三者全到
 *    ＝黑。
 * 3. 濾光：白光（紅＋綠＋藍）射向一片濾光片，每個色通道各自被透過或
 *    吸收；透過的顏色 = 光源的色通道 × 濾光片的色通道。
 *
 * ==========================================================================
 * ⚠️ 加法與減法用的是真正的混色，不是事先畫好的七塊色塊
 * ==========================================================================
 * 加法模式用 p5 的 ADD 混合模式畫三個圓；減法模式用 MULTIPLY 畫三個圓。
 * 重疊區的顏色是畫布算出來的，所以拉動 R/G/B 或 C/M/Y 時，重疊區會跟著
 * 變，而不是「圓的顏色變了、重疊區還是原本那塊」。
 *
 * ⚠️ 混合模式一定要在畫完之後重設回 BLEND。否則後面的白色標籤、邊框、
 * 文字會繼續被 ADD／MULTIPLY 影響——症狀是「第一幀正常，之後標籤愈來
 * 愈亮或不見」，而卡片數字全部正確。
 *
 * ==========================================================================
 * ⚠️ 濾光片的「看到的顏色」是逐通道相乘
 * ==========================================================================
 * 紅濾光片的 RGB 是 (255, 0, 0)：它讓紅光通過、把綠與藍吸收掉。
 * 白光 (255,255,255) 透過紅濾光片 → (255,0,0)，看起來是紅色。
 * 綠光 (0,255,0) 透過紅濾光片 → (0,0,0)，看起來是黑色。
 * 這就是「紅光照綠紙會變黑」那一類題目的同一個算式。
 */

(function () {
    'use strict';

    const BOARD = { x: 40, y: 170, w: 820, h: 530 };
    const CIRCLE_R = 140;
    const CENTERS = {
        a: { x: 360, y: 350 },
        b: { x: 540, y: 350 },
        c: { x: 450, y: 505 },
    };
    const LEGEND = { x: 54, y: 72, gap: 30 };
    const SCENE_RECT = { x0: 8, y0: 8, x1: 892, y1: 806 };

    const C_ADD = [15, 23, 42];
    const C_TEXT = [15, 23, 42];

    const FILTERS = {
        red: { name: '紅', rgb: [255, 0, 0] },
        green: { name: '綠', rgb: [0, 255, 0] },
        blue: { name: '藍', rgb: [0, 0, 255] },
        cyan: { name: '青', rgb: [0, 255, 255] },
        magenta: { name: '洋紅', rgb: [255, 0, 255] },
        yellow: { name: '黃', rgb: [255, 255, 0] },
    };

    const SOURCES = {
        white: { name: '白光', rgb: [255, 255, 255] },
        red: { name: '紅光', rgb: [255, 0, 0] },
        green: { name: '綠光', rgb: [0, 255, 0] },
        blue: { name: '藍光', rgb: [0, 0, 255] },
    };

    const FILTER_KEYS = ['red', 'green', 'blue', 'cyan', 'magenta', 'yellow'];
    const SOURCE_KEYS = ['white', 'red', 'green', 'blue'];
    const CHANNELS = [
        { key: 'r', name: '紅', col: [255, 0, 0] },
        { key: 'g', name: '綠', col: [0, 255, 0] },
        { key: 'b', name: '藍', col: [0, 0, 255] },
    ];

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function num(v, def) {
        return (typeof v === 'number' && isFinite(v)) ? v : def;
    }

    /**
     * 一個色通道「有沒有亮」。這個門檻同時是 `colorName` 的黑／灰分界，
     * 兩邊必須一致：否則加法中心會出現「標籤寫白、卡片寫黑」的矛盾。
     */
    const ON_LEVEL = 26;

    function on(v, threshold) {
        return v >= (threshold == null ? ON_LEVEL : threshold);
    }

    /**
     * 粗略的顏色名稱。只用來顯示「中心看起來是什麼顏色」，但**卡片與畫面
     * 的中心標籤都問它**，所以名稱必須對暗一點的顏色也成立：
     * (130, 0, 0) 是暗紅，不是「混合色」。
     *
     * 判準是「最強通道的 55% 以上算有這個色」——這樣亮度從 26 到 255
     * 的純紅都叫紅，而 (255, 128, 0) 這種紅多綠少的仍叫橙。
     */
    function colorName(rgb) {
        const [r, g, b] = rgb;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        if (mx < ON_LEVEL) return '黑';
        // 三通道接近相等：亮度決定白／灰。
        if (mx - mn < 40) return mx > 200 ? '白' : '灰';

        // 橙：紅最強、綠有一半左右、藍幾乎沒有。
        if (r === mx && g >= 0.25 * mx && g < 0.8 * mx && b < 0.3 * mx) {
            return '橙';
        }

        const t = 0.55 * mx;
        const R = r >= t, G = g >= t, B = b >= t;
        if (R && G && B) return '混合色';
        if (R && G) return '黃';
        if (G && B) return '青';
        if (R && B) return '洋紅';
        if (R) return '紅';
        if (G) return '綠';
        return '藍';
    }

    function rgbText(rgb) {
        return rgb.map(v => String(Math.round(v))).join(', ');
    }

    // ======================================================================
    // 三個模式的狀態（純函式）
    // ======================================================================

    function additiveState(panel) {
        const r = clamp(num(panel.r, 255), 0, 255);
        const g = clamp(num(panel.g, 255), 0, 255);
        const b = clamp(num(panel.b, 255), 0, 255);
        return { r, g, b, center: [r, g, b], centerName: colorName([r, g, b]) };
    }

    function subtractiveState(panel) {
        const c = clamp(num(panel.c, 100), 0, 100) / 100;
        const m = clamp(num(panel.m, 100), 0, 100) / 100;
        const y = clamp(num(panel.y, 100), 0, 100) / 100;
        const center = [
            255 * (1 - c),
            255 * (1 - m),
            255 * (1 - y),
        ];
        return { c, m, y, center, centerName: colorName(center) };
    }

    function filterState(panel) {
        const filterKey = FILTERS[panel.filter] ? panel.filter : 'red';
        const sourceKey = SOURCES[panel.source] ? panel.source : 'white';
        const level = clamp(num(panel.sourceLevel, 255), 0, 255);
        const filter = FILTERS[filterKey];
        const source = SOURCES[sourceKey];

        const effective = source.rgb.map(v => v * level / 255);
        const seen = effective.map((v, i) => v * filter.rgb[i] / 255);
        const transmit = CHANNELS.filter((_, i) => filter.rgb[i] > 0).map(ch => ch.name);
        const absorb = CHANNELS.filter((_, i) => filter.rgb[i] === 0).map(ch => ch.name);

        return {
            filterKey, sourceKey, filter, source, level,
            effective, seen,
            transmit, absorb,
            seenName: colorName(seen),
        };
    }

    function stateFor(panel) {
        panel = panel || {};
        const mode = (panel.mode === 'subtractive' || panel.mode === 'filter')
            ? panel.mode : 'additive';
        return {
            mode,
            additive: additiveState(panel),
            subtractive: subtractiveState(panel),
            filter: filterState(panel),
        };
    }

    /**
     * 重疊中心那顆標籤的文字（沒有就回 null）。
     *
     * 加法與減法都用這一個函式，卡片則用同一個 `centerName`——這樣
     * 「標籤寫白、卡片寫灰」這一類矛盾只可能出現在同一個地方，改一次就好。
     */
    function centerLabelText(mode, st) {
        let vals;
        if (mode === 'additive') {
            vals = [st.r, st.g, st.b];
        } else if (mode === 'subtractive') {
            vals = [st.c * 100, st.m * 100, st.y * 100];
        } else {
            return null;
        }
        const allOn = vals.every(on);
        const noneOn = vals.every(v => !on(v));
        if (allOn) return st.centerName;
        if (noneOn) return mode === 'additive' ? '黑' : '白';
        return null;
    }

    function legendRows(state) {
        if (state.mode === 'additive') {
            return [
                { text: '加法混色：光疊在一起', col: C_TEXT },
                { text: '紅＋綠＝黃　紅＋藍＝洋紅　綠＋藍＝青', col: C_TEXT },
                { text: '三色全到＝白', col: C_TEXT },
            ];
        }
        if (state.mode === 'subtractive') {
            return [
                { text: '減法混色：顏料吸收色光', col: C_TEXT },
                { text: '青＋洋紅＝藍　青＋黃＝綠　洋紅＋黃＝紅', col: C_TEXT },
                { text: '三色全到＝黑', col: C_TEXT },
            ];
        }
        const f = state.filter;
        const pass = f.transmit.join('、') || '—';
        return [
            { text: '濾光：每個色通道各自通過或被吸收', col: C_TEXT },
            { text: '看到的顏色＝光源 × 濾光片（逐通道）', col: C_TEXT },
            { text: `${f.filter.name}濾光片只讓${pass}光通過`, col: C_TEXT },
        ];
    }

    // ======================================================================
    // 畫面：加法／減法
    // ======================================================================

    function drawBoard(p, view, dark) {
        p.push();
        p.noStroke();
        p.fill(dark ? C_ADD[0] : 255, dark ? C_ADD[1] : 255, dark ? C_ADD[2] : 255);
        p.rect(view.toScreenX(BOARD.x), view.toScreenY(BOARD.y),
               OpticsScene.L(view, BOARD.w), OpticsScene.L(view, BOARD.h),
               OpticsScene.L(view, 18));
        p.pop();
        p.push();
        p.noFill();
        OpticsScene.strokeOn(p, [148, 163, 184], OpticsScene.L(view, 1.8, 1));
        p.rect(view.toScreenX(BOARD.x), view.toScreenY(BOARD.y),
               OpticsScene.L(view, BOARD.w), OpticsScene.L(view, BOARD.h),
               OpticsScene.L(view, 18));
        p.pop();
    }

    function drawVennCircles(p, view, colors, mode) {
        p.push();
        if (mode === 'additive') p.blendMode(p.ADD);
        else p.blendMode(p.MULTIPLY);
        p.noStroke();
        const keys = ['a', 'b', 'c'];
        for (let i = 0; i < 3; i++) {
            const c = CENTERS[keys[i]];
            const col = colors[i];
            p.fill(col[0], col[1], col[2]);
            p.ellipse(view.toScreenX(c.x), view.toScreenY(c.y),
                      OpticsScene.L(view, 2 * CIRCLE_R),
                      OpticsScene.L(view, 2 * CIRCLE_R));
        }
        p.blendMode(p.BLEND);
        p.pop();
        p.blendMode(p.BLEND);
    }

    function drawAdditiveLabels(p, view, st) {
        const OS = OpticsScene;
        const lab = (x, y, text, col) =>
            OS.worldBadge(p, view, x, y, text, { size: 13, col: col || C_TEXT, align: 'center' });

        if (on(st.r)) lab(360, 318, '紅');
        if (on(st.g)) lab(540, 318, '綠');
        if (on(st.b)) lab(450, 588, '藍');
        if (on(st.r) && on(st.g)) lab(450, 312, '黃');
        if (on(st.r) && on(st.b)) lab(372, 455, '洋紅');
        if (on(st.g) && on(st.b)) lab(528, 455, '青');
        // 中心名稱跟著卡片用同一個 `colorName`：三色都在時是白／灰／混合色，
        // 不是無條件寫「白」（r = g = b = 130 其實是灰）。
        const center = centerLabelText('additive', st);
        if (center) lab(450, 398, center);
    }

    function drawSubtractiveLabels(p, view, st) {
        const OS = OpticsScene;
        const lab = (x, y, text) =>
            OS.worldBadge(p, view, x, y, text, { size: 13, col: C_TEXT, align: 'center' });
        const c = st.c * 100, m = st.m * 100, y = st.y * 100;

        if (on(c)) lab(360, 318, '青');
        if (on(m)) lab(540, 318, '洋紅');
        if (on(y)) lab(450, 588, '黃');
        if (on(c) && on(m)) lab(450, 312, '藍');
        if (on(c) && on(y)) lab(372, 455, '綠');
        if (on(m) && on(y)) lab(528, 455, '紅');
        // 和加法一樣：中心名稱由 `colorName` 決定。三種顏料各 50% 時
        // 中心是灰，不是黑。
        const center = centerLabelText('subtractive', st);
        if (center) lab(450, 398, center);
    }

    function drawAdditiveScene(p, view, st) {
        const OS = OpticsScene;
        drawBoard(p, view, true);
        drawVennCircles(p, view, [
            [st.r, 0, 0], [0, st.g, 0], [0, 0, st.b],
        ], 'additive');
        drawAdditiveLabels(p, view, st);
    }

    function drawSubtractiveScene(p, view, st) {
        const OS = OpticsScene;
        drawBoard(p, view, false);
        drawVennCircles(p, view, [
            [255 * (1 - st.c), 255, 255],
            [255, 255 * (1 - st.m), 255],
            [255, 255, 255 * (1 - st.y)],
        ], 'subtractive');
        drawSubtractiveLabels(p, view, st);
    }

    // ======================================================================
    // 畫面：濾光
    // ======================================================================

    const FILTER_X = 420;
    const FILTER_W = 40;
    const FILTER_Y = 280;
    const FILTER_H = 260;
    const SOURCE_X = 132;
    const SCREEN_X = 758;
    const SCREEN_W = 94;
    const BEAM_Y = [322, 410, 498];
    const BEAM_END = 760;

    function drawFilterScene(p, view, st) {
        const OS = OpticsScene;

        // 背景板
        p.push();
        p.noStroke();
        p.fill(248, 250, 252);
        p.rect(view.toScreenX(BOARD.x), view.toScreenY(BOARD.y),
               OS.L(view, BOARD.w), OS.L(view, BOARD.h), OS.L(view, 18));
        p.pop();
        p.push();
        p.noFill();
        OS.strokeOn(p, [203, 213, 225], OS.L(view, 1.5, 1));
        p.rect(view.toScreenX(BOARD.x), view.toScreenY(BOARD.y),
               OS.L(view, BOARD.w), OS.L(view, BOARD.h), OS.L(view, 18));
        p.pop();

        // 光源：三個色通道
        for (let i = 0; i < 3; i++) {
            const ch = CHANNELS[i];
            const v = st.effective[i];
            if (v < 5) {
                OS.worldBadge(p, view, SOURCE_X, BEAM_Y[i], '無',
                              { size: 12, col: [148, 163, 184], align: 'center' });
                continue;
            }
            // 光源端的色通道也要跟著「光源亮度」變暗。原本這裡用滿強度的
            // ch.col，於是拉低亮度時只有濾光片後面那一段變暗，光源本身
            // 看起來完全沒變——卡片上的 RGB 卻已經掉下去了。
            const srcCol = ch.col.map(x => Math.round(x * v / 255));
            p.push();
            p.noStroke();
            p.fill(srcCol[0], srcCol[1], srcCol[2]);
            p.ellipse(view.toScreenX(SOURCE_X), view.toScreenY(BEAM_Y[i]),
                      OS.L(view, 30), OS.L(view, 30));
            p.pop();
            OS.line(p, view,
                    { x: SOURCE_X + 18, y: BEAM_Y[i] },
                    { x: FILTER_X - FILTER_W / 2, y: BEAM_Y[i] },
                    srcCol,
                    { w: 5, arrowAt: 0.6, head: 10 });
        }
        OS.worldBadge(p, view, SOURCE_X, FILTER_Y - 32, `${st.source.name}的色通道`,
                      { size: 12, col: C_TEXT, align: 'center' });

        // 濾光片
        p.push();
        p.noStroke();
        p.fill(st.filter.rgb[0], st.filter.rgb[1], st.filter.rgb[2], 235);
        p.rect(view.toScreenX(FILTER_X - FILTER_W / 2), view.toScreenY(FILTER_Y),
               OS.L(view, FILTER_W), OS.L(view, FILTER_H), OS.L(view, 5));
        p.pop();
        p.push();
        p.noFill();
        OS.strokeOn(p, [30, 41, 59], OS.L(view, 2.2, 1.4));
        p.rect(view.toScreenX(FILTER_X - FILTER_W / 2), view.toScreenY(FILTER_Y),
               OS.L(view, FILTER_W), OS.L(view, FILTER_H), OS.L(view, 5));
        p.pop();
        OS.worldBadge(p, view, FILTER_X, FILTER_Y - 32,
                      `${st.filter.name}濾光片`,
                      { size: 13, col: C_TEXT, align: 'center' });

        // 濾光後的光束與被吸收的記號
        for (let i = 0; i < 3; i++) {
            const ch = CHANNELS[i];
            const before = st.effective[i];
            const after = st.seen[i];
            const y = BEAM_Y[i];
            if (after > 5) {
                const col = ch.col.map((v, k) => k === i ? Math.round(after) : 0);
                OS.line(p, view,
                        { x: FILTER_X + FILTER_W / 2, y },
                        { x: BEAM_END, y },
                        col,
                        { w: 5, arrowAt: 0.6, head: 10 });
            } else if (before > 5) {
                OS.worldBadge(p, view, FILTER_X + 42, y, '×',
                              { size: 13, col: [220, 38, 38], align: 'center' });
            }
        }

        // 屏幕與看到的顏色
        p.push();
        p.noStroke();
        p.fill(255, 255, 255);
        p.rect(view.toScreenX(SCREEN_X), view.toScreenY(FILTER_Y),
               OS.L(view, SCREEN_W), OS.L(view, FILTER_H), OS.L(view, 6));
        p.pop();
        p.push();
        p.noFill();
        OS.strokeOn(p, [148, 163, 184], OS.L(view, 1.6, 1));
        p.rect(view.toScreenX(SCREEN_X), view.toScreenY(FILTER_Y),
               OS.L(view, SCREEN_W), OS.L(view, FILTER_H), OS.L(view, 6));
        p.pop();

        const swatch = st.seen;
        p.push();
        p.noStroke();
        p.fill(swatch[0], swatch[1], swatch[2]);
        p.ellipse(view.toScreenX(SCREEN_X + SCREEN_W / 2),
                  view.toScreenY(FILTER_Y + FILTER_H / 2),
                  OS.L(view, 66), OS.L(view, 66));
        p.pop();
        p.push();
        p.noFill();
        OS.strokeOn(p, [30, 41, 59], OS.L(view, 1.8, 1.2));
        p.ellipse(view.toScreenX(SCREEN_X + SCREEN_W / 2),
                  view.toScreenY(FILTER_Y + FILTER_H / 2),
                  OS.L(view, 66), OS.L(view, 66));
        p.pop();
        OS.worldBadge(p, view, SCREEN_X + SCREEN_W / 2, FILTER_Y - 32,
                      '屏幕', { size: 13, col: C_TEXT, align: 'center' });
        OS.worldBadge(p, view, SCREEN_X + SCREEN_W / 2, FILTER_Y + FILTER_H + 30,
                      `看到：${st.seenName}`, { size: 13, col: C_TEXT, align: 'center' });
    }

    // ======================================================================
    // 頁面
    // ======================================================================
    const CARD = (label, id, unit, highlight, when) =>
        ({ label, id, unit, highlight, when });
    const isAdd = p => p.mode !== 'subtractive' && p.mode !== 'filter';
    const isSub = p => p.mode === 'subtractive';
    const isFilter = p => p.mode === 'filter';

    OpticsScene.run({
        formula: '\\begin{aligned}R+G+B&=W\\\\ C+M+Y&=K\\\\ C_{\\text{見}}&=C_{\\text{光}}\\\\ &\\quad\\times C_{\\text{片}}\\end{aligned}',
        formulaFallback: 'R+G+B=W；C+M+Y=K；看到的顏色=光源×濾光片',

        controls: {
            selects: [
                {
                    key: 'mode', label: '混色方式', def: 'additive', live: true,
                    options: [
                        { v: 'additive', t: '加法混色（光）' },
                        { v: 'subtractive', t: '減法混色（顏料）' },
                        { v: 'filter', t: '濾光' },
                    ],
                },
                {
                    key: 'filter', label: '濾光片', def: 'red', live: true,
                    when: isFilter,
                    options: FILTER_KEYS.map(k => ({ v: k, t: `${FILTERS[k].name}色` })),
                },
                {
                    key: 'source', label: '光源', def: 'white', live: true,
                    when: isFilter,
                    options: SOURCE_KEYS.map(k => ({ v: k, t: SOURCES[k].name })),
                },
            ],
            sliders: [
                { key: 'r', label: '紅光強度 R', def: 255, min: 0, max: 255,
                  step: 1, unit: '', dec: 0, when: isAdd },
                { key: 'g', label: '綠光強度 G', def: 255, min: 0, max: 255,
                  step: 1, unit: '', dec: 0, when: isAdd },
                { key: 'b', label: '藍光強度 B', def: 255, min: 0, max: 255,
                  step: 1, unit: '', dec: 0, when: isAdd },
                { key: 'c', label: '青色顏料量', def: 100, min: 0, max: 100,
                  step: 1, unit: '%', dec: 0, when: isSub },
                { key: 'm', label: '洋紅顏料量', def: 100, min: 0, max: 100,
                  step: 1, unit: '%', dec: 0, when: isSub },
                { key: 'y', label: '黃色顏料量', def: 100, min: 0, max: 100,
                  step: 1, unit: '%', dec: 0, when: isSub },
                { key: 'sourceLevel', label: '光源亮度', def: 255, min: 0, max: 255,
                  step: 1, unit: '', dec: 0, when: isFilter },
            ],
        },

        cards: [
            CARD('紅光 R', 'cardR', '', false, isAdd),
            CARD('綠光 G', 'cardG', '', false, isAdd),
            CARD('藍光 B', 'cardB', '', false, isAdd),
            CARD('重疊中心的 RGB', 'cardAddRGB', '', true, isAdd),
            CARD('中心看起來', 'cardAddName', '', true, isAdd),

            CARD('青色顏料 C', 'cardC', '%', false, isSub),
            CARD('洋紅顏料 M', 'cardM', '%', false, isSub),
            CARD('黃色顏料 Y', 'cardY', '%', false, isSub),
            CARD('重疊中心的 RGB', 'cardSubRGB', '', true, isSub),
            CARD('中心看起來', 'cardSubName', '', true, isSub),

            CARD('濾光片', 'cardFilter', '', true, isFilter),
            CARD('光源', 'cardSource', '', false, isFilter),
            CARD('透過的色光', 'cardTransmit', '', true, isFilter),
            CARD('吸收的色光', 'cardAbsorb', '', false, isFilter),
            CARD('看到的顏色 RGB', 'cardSeenRGB', '', true, isFilter),
            CARD('看起來', 'cardSeenName', '', true, isFilter),
            CARD('光源亮度', 'cardLevel', '', false, isFilter),
        ],

        model(t, panel) {
            return stateFor(panel);
        },

        values(t, panel, g) {
            const a = g.additive, s = g.subtractive, f = g.filter;
            return {
                cardR: String(Math.round(a.r)),
                cardG: String(Math.round(a.g)),
                cardB: String(Math.round(a.b)),
                cardAddRGB: rgbText(a.center),
                cardAddName: a.centerName,

                cardC: String(Math.round(s.c * 100)),
                cardM: String(Math.round(s.m * 100)),
                cardY: String(Math.round(s.y * 100)),
                cardSubRGB: rgbText(s.center),
                cardSubName: s.centerName,

                cardFilter: `${f.filter.name}色`,
                cardSource: f.source.name,
                cardTransmit: f.transmit.join('、') || '—',
                cardAbsorb: f.absorb.join('、') || '—',
                cardSeenRGB: rgbText(f.seen),
                cardSeenName: f.seenName,
                cardLevel: String(Math.round(f.level)),
            };
        },

        titleText(t, panel, g) {
            if (g.mode === 'additive') {
                const a = g.additive;
                return `加法混色　R = ${Math.round(a.r)}　G = ${Math.round(a.g)}`
                     + `　B = ${Math.round(a.b)}　中心 = ${a.centerName}`;
            }
            if (g.mode === 'subtractive') {
                const s = g.subtractive;
                return `減法混色　C = ${Math.round(s.c * 100)}%`
                     + `　M = ${Math.round(s.m * 100)}%　Y = ${Math.round(s.y * 100)}%`
                     + `　中心 = ${s.centerName}`;
            }
            const f = g.filter;
            return `${f.source.name} → ${f.filter.name}色濾光片`
                 + `　透過：${f.transmit.join('、') || '—'}`
                 + `　看到：${f.seenName}`;
        },

        onFrame(t, panel) {
            const mode = panel.mode;
            if (mode === 'subtractive') {
                panel.set('c', 50 + 50 * Math.sin(t * 0.8));
                panel.set('m', 50 + 50 * Math.sin(t * 0.8 + 2.09));
                panel.set('y', 50 + 50 * Math.sin(t * 0.8 + 4.18));
            } else if (mode === 'filter') {
                panel.set('sourceLevel', 130 + 125 * (0.5 + 0.5 * Math.sin(t * 0.9)));
            } else {
                panel.set('r', 128 + 127 * Math.sin(t * 0.9));
                panel.set('g', 128 + 127 * Math.sin(t * 0.9 + 2.09));
                panel.set('b', 128 + 127 * Math.sin(t * 0.9 + 4.18));
            }
        },

        draw(p, view, t, panel, sol) {
            const state = sol;
            if (state.mode === 'additive') drawAdditiveScene(p, view, state.additive);
            else if (state.mode === 'subtractive') drawSubtractiveScene(p, view, state.subtractive);
            else drawFilterScene(p, view, state.filter);

            const rows = legendRows(state);
            const gap = OpticsScene.legendRowGap(view, LEGEND.gap);
            for (let i = 0; i < rows.length; i++) {
                OpticsScene.worldBadge(p, view, LEGEND.x, LEGEND.y + i * gap,
                                       rows[i].text,
                                       { size: 12, col: rows[i].col, align: 'left' });
            }
        },
    });

    // ======================================================================
    // 給驗證器的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            BOARD, CIRCLE_R, CENTERS, LEGEND, SCENE_RECT, C_ADD, C_TEXT,
            FILTERS, SOURCES, FILTER_KEYS, SOURCE_KEYS, CHANNELS,
            FILTER_X, FILTER_W, FILTER_Y, FILTER_H,
            SOURCE_X, SCREEN_X, SCREEN_W, BEAM_Y, BEAM_END,
            clamp, on, colorName, rgbText, ON_LEVEL, centerLabelText,
            additiveState, subtractiveState, filterState, stateFor,
            legendRows, drawAdditiveScene, drawSubtractiveScene, drawFilterScene,
        };
    }
})();
