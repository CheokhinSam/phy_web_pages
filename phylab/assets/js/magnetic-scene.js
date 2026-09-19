/**
 * 🧲 MagneticScene — 磁場、磁鐵、線圈、帶電粒子的符號
 *
 * 搭配 magnetic-kit.js（純物理、沒有 DOM）使用。這一支負責畫面：把一組
 * **場源**畫成磁力線、把磁鐵畫成紅藍兩半、把帶電粒子的軌跡與受力畫出來。
 *
 * 版面骨架（控制面板、數據卡片、圖表、底部標題列、p5 生命週期）**不在這裡**，
 * 它在 `lab-scene.js`。這一支只有「磁學長什麼樣子」，和 circuit-scene.js
 * 之於電學是同一個位置。
 *
 * ==========================================================================
 * ⚠️ 為什麼這一支沒有 p5 生命週期（而且必須繼續沒有）
 * ==========================================================================
 * `patch-site.py` 會 glob `_site/phylab/assets/js/*-scene.js`，凡是自己開了
 * p5 實例的模組就要交出三個錨點字串。純繪圖模組沒有 p.draw 可以掛，所以
 * 被跳過——判定方式是在原始碼裡找「建立 p5 實例」的那一行。
 *
 * 這一支一旦自己開了 p5 實例，就會當場被要求錨點，而它本來就沒有那些
 * 字串，補丁腳本會 exit 1，整個 headless 驗證跟著掛掉。
 *
 * ⚠️ 而且**連註解都不能提到那個字串**：判斷是純文字比對，看不出那是註解。
 *    這裡原本的註解把那一行逐字寫進來解釋，結果 `patch-site.py` 當場誤判，
 *    是 verify-magnetism.js ⑪ 的靜態斷言先抓到的。要講這件事就用中文講。
 *    （verify-magnetism.js ⑪ 有斷言盯著這一條。）
 *
 * ==========================================================================
 * ⚠️ 場源是資料，畫的與算的是同一份
 * ==========================================================================
 * 這一支**不自己產生磁場**。所有磁力線都是呼叫 `MagneticKit.traceLine()`
 * 追出來的，而那些線走的場和卡片上印的數字、粒子感受到的力、線圈量到的
 * 磁通量，全部來自同一個 `MagneticKit.fieldAt()`。電學那組的「電路是一份
 * 資料」在這裡的對應就是「場源是一份資料」。
 *
 * 頁面因此永遠不需要把磁力線的座標寫死——寫死了就會出現「圖上的線」和
 * 「卡片上的數字」各自為政，那正是舊電學頁面畫出短路並聯圖的原因。
 *
 * ⚠️ 座標是**螢幕慣例**（x 右、y 下），手性問題見 magnetic-kit.js 檔頭。
 *    這一支只做繪圖，不碰外積。
 */
var MagneticScene = (function () {
    'use strict';

    const {
        WORLD_W, WORLD_H, TITLE_TOP,
        strokeOn, L, fmt, badge,
    } = LabScene;

    /**
     * 場景的可畫區域。**下緣是標題列的上緣，不是 WORLD_H。**
     *
     * ⚠️ 底部黑條只蓋住 TITLE_TOP～TITLE_TOP+48 這一條，再往下幾十個世界
     *    單位是**看得見的**。磁力線若一路追到 WORLD_H，就會有一截線和箭頭
     *    孤零零地露在黑條底下——第一版的磁力線頁就是這樣，而且沒有任何
     *    斷言會叫（少畫東西、多畫東西都不會報錯，只會靜靜地顯示）。
     *    場線本來就該被畫面的框切掉；切在標題列上緣，那個框就是標題列。
     */
    const SCENE = { x0: 8, y0: 8, x1: WORLD_W - 8, y1: TITLE_TOP - 6 };

    /**
     * 白底標籤，**吃世界座標**。
     *
     * ⚠️ 這一支非有不可。`LabScene.badge()` 的第二、三個參數是**畫布像素**
     *    （波動學那幾頁就是這樣呼叫的：`valueBadge(p, view, view.toScreenY(...))`），
     *    但磁學這邊每一頁的直覺都是「標籤放在世界座標的某一點上」。
     *    直接傳世界座標進去的話，標籤會落在 `(x, y)` 這個**像素**位置上，
     *    而正確位置是 `(offsetX + x·scale, offsetY + y·scale)`。
     *
     *    歪掉的量是 `x·(1−scale) − offsetX` 與 `y·(1−scale) − offsetY`——
     *    跟位置有關。畫面正中央看起來只差二、三十像素（「差不多」），
     *    但靠畫布邊緣時會整顆標籤被裁掉，或是壓到別的圖形上。這一組五頁
     *    的標籤很多（極名、場源、向量、比例尺），不對齊就會到處都是。
     *
     * ⚠️ 這裡刻意**不改 badge() 本身**：它是 lab-scene 的介面，波動學與電學
     *    那十幾頁都在用，改了會一次弄壞它們。磁學自己包一層。
     *    verify-magnetism.js ⑪ 有一條斷言在盯「磁學的檔案裡不得直接呼叫
     *    小寫的 badge(」——就是為了不讓這件事再發生一次。
     *
     * 註：`o.size`、`o.padX` 這類參數本來就是像素（內部走 `L(view, …)`），
     *     不受這裡的換算影響。呼叫端把「世界座標 − 幾個像素」混著算，
     *     誤差是 `像素量 × (1−scale)`，在小數點以下，不影響可讀性。
     */
    function worldBadge(p, view, x, y, text, o) {
        badge(p, view, view.toScreenX(x), view.toScreenY(y), text, o);
    }

    // ======================================================================
    // 磁學的配色（沿用 style guide 的色盤，語意見下）
    // ======================================================================
    const C_FIELD = [30, 41, 59];         // 磁力線：近黑，課本的樣子
    const C_NPOLE = [239, 68, 68];        // N 極：紅
    const C_SPOLE = [37, 99, 235];        // S 極：藍
    const C_COIL = [234, 88, 12];         // 線圈／導線：銅橙
    const C_VEL = [139, 92, 246];         // 速度 v：紫
    const C_FORCE = [22, 163, 74];        // 力 F：綠
    const C_INDUCED = [22, 163, 74];      // 感生電流：綠（和力同色系，都在講「因此產生」）
    const C_DIM = [148, 163, 184];        // 輔助線、量測線
    const C_AXIS = [203, 213, 225];       // 對稱軸、參考線

    // ======================================================================
    // 小工具
    // ======================================================================

    /** 箭頭（螢幕座標）。dx, dy 只需要方向，長度不影響。 */
    function arrowHead(p, view, x, y, dx, dy, size, col) {
        const m = Math.hypot(dx, dy) || 1;
        const ux = dx / m, uy = dy / m;
        const px = -uy, py = ux;
        const s = L(view, size);
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.triangle(x + ux * s, y + uy * s,
                   x - ux * s * 0.4 + px * s * 0.6, y - uy * s * 0.4 + py * s * 0.6,
                   x - ux * s * 0.4 - px * s * 0.6, y - uy * s * 0.4 - py * s * 0.6);
    }

    /** 從 (x, y) 往 (dx, dy) 畫一枝箭（世界座標）。回傳箭尖的世界座標。 */
    function arrow(p, view, x, y, dx, dy, col, o) {
        o = o || {};
        const x2 = x + dx, y2 = y + dy;
        strokeOn(p, col, L(view, o.w || 2.5, 1.5));
        p.line(view.toScreenX(x), view.toScreenY(y),
               view.toScreenX(x2), view.toScreenY(y2));
        arrowHead(p, view, view.toScreenX(x2), view.toScreenY(y2),
                  dx, dy, o.head || 11, col);
        return { x: x2, y: y2 };
    }

    /** 虛線（世界座標）。ctx.setLineDash 只在有 drawingContext 時才有。 */
    function dashed(p, view, x1, y1, x2, y2, col, o) {
        o = o || {};
        const ctx = p.drawingContext;
        strokeOn(p, col, L(view, o.w || 1.5, 1));
        if (ctx.setLineDash) ctx.setLineDash([L(view, 8, 4), L(view, 7, 3)]);
        p.line(view.toScreenX(x1), view.toScreenY(y1),
               view.toScreenX(x2), view.toScreenY(y2));
        if (ctx.setLineDash) ctx.setLineDash([]);
    }

    // ======================================================================
    // 穿出／穿入螢幕的符號 ⊙ ⊗
    // ======================================================================
    // 這是磁學這一組的**核心視覺語言**：磁場垂直於畫面時，紙上就是這樣畫的。
    // 帶電粒子那一頁、長直導線那一頁、變壓器的鐵芯都靠這個符號溝通方向。

    /** ⊙ 穿出螢幕（指向觀察者） */
    function drawOutOfPage(p, view, x, y, r, col) {
        const c = col || C_FIELD;
        const cx = view.toScreenX(x), cy = view.toScreenY(y), R = L(view, r);
        p.noFill();
        strokeOn(p, c, L(view, 2, 1.2));
        p.ellipse(cx, cy, R * 2, R * 2);
        p.noStroke();
        p.fill(c[0], c[1], c[2]);
        p.ellipse(cx, cy, L(view, r * 0.42, 2), L(view, r * 0.42, 2));
    }

    /** ⊗ 穿入螢幕（遠離觀察者） */
    function drawIntoPage(p, view, x, y, r, col) {
        const c = col || C_FIELD;
        const cx = view.toScreenX(x), cy = view.toScreenY(y), R = L(view, r);
        const d = R * Math.SQRT1_2;
        p.noFill();
        strokeOn(p, c, L(view, 2, 1.2));
        p.ellipse(cx, cy, R * 2, R * 2);
        p.line(cx - d, cy - d, cx + d, cy + d);
        p.line(cx - d, cy + d, cx + d, cy - d);
    }

    /** 依 B 的穿出／穿入分量選 ⊙ 或 ⊗。bz = 0 時什麼都不畫。 */
    function drawPageDir(p, view, x, y, r, bz, col) {
        if (Math.abs(bz) < 1e-12) return;
        if (bz > 0) drawOutOfPage(p, view, x, y, r, col);
        else drawIntoPage(p, view, x, y, r, col);
    }

    // ======================================================================
    // 場源：長直導線、條形磁鐵、螺線管
    // ======================================================================

    /**
     * 長直導線（**垂直於畫面**，所以看到的是它的端點）。
     * @param {object} o {r, label, showMag}
     */
    function drawWire(p, view, s, o) {
        o = o || {};
        const r = o.r || 16;
        drawPageDir(p, view, s.x, s.y, r, s.I, C_COIL);
        if (o.label !== false) {
            const txt = o.label || `${s.I > 0 ? '⊙' : '⊗'} I = ${fmt(s.I, 'A')}`;
            worldBadge(p, view, s.x, s.y - r - L(view, 22, 12), txt,
                  { size: 14, col: C_COIL });
        }
    }

    /**
     * 條形磁鐵：左半 N（紅）、右半 S（藍），沿著 angle 擺放。
     * 極的位置一律問 MagneticKit.magnetPoles()，不在這裡自己算——
     * 磁力線的起點與磁鐵的端點必須是同一個座標。
     */
    function drawBarMagnet(p, view, s, o) {
        o = o || {};
        const pol = MagneticKit.magnetPoles(s);
        const len = s.len == null ? 120 : s.len;
        const hw = len / 2, hh = o.h || 34;
        const a = s.angle || 0;

        p.push();
        p.translate(view.toScreenX(s.x), view.toScreenY(s.y));
        p.rotate(a);
        const W = L(view, hw), H = L(view, hh);

        // 兩半：N 在 −x 那一端（和 magnetPoles 一致）
        p.noStroke();
        p.fill(C_NPOLE[0], C_NPOLE[1], C_NPOLE[2]);
        p.rect(-W, -H, W, H * 2);
        p.fill(C_SPOLE[0], C_SPOLE[1], C_SPOLE[2]);
        p.rect(0, -H, W, H * 2);
        strokeOn(p, C_FIELD, L(view, 2, 1.2));
        p.noFill();
        p.rect(-W, -H, W * 2, H * 2);

        p.noStroke();
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.BOLD);
        p.textSize(L(view, Math.min(hh * 1.1, hw * 0.7), 11));
        p.text('N', -W / 2, 0);
        p.text('S', W / 2, 0);
        p.pop();

        if (o.poleLabels) {
            worldBadge(p, view, pol.n.x, pol.n.y - hh - L(view, 20, 11), 'N 極',
                  { size: 13, col: C_NPOLE });
            worldBadge(p, view, pol.s.x, pol.s.y - hh - L(view, 20, 11), 'S 極',
                  { size: 13, col: C_SPOLE });
        }
    }

    /**
     * 螺線管：軸躺在畫面內，沿著 angle 擺放。
     * 畫成側面的彈簧狀——沿軸排一串橢圓，圈的疏密由匝數決定。
     */
    function drawSolenoid(p, view, s, o) {
        o = o || {};
        const len = s.len, a = s.angle || 0;
        const R = o.r || 52;
        const turns = Math.max(4, Math.min(24, o.turns || 12));
        const gap = len / turns;

        p.push();
        p.translate(view.toScreenX(s.x), view.toScreenY(s.y));
        p.rotate(a);
        const W = L(view, gap), H = L(view, R) * 2;
        strokeOn(p, C_COIL, L(view, 3, 1.8));
        p.noFill();
        for (let i = 0; i < turns; i++) {
            p.ellipse(-L(view, len / 2) + W * (i + 0.5), 0, W, H);
        }
        p.pop();

        // 兩個極的位置問 physics，不在這裡算——磁力線要從同樣的點出發
        const pol = MagneticKit.magnetPoles(s);
        if (o.poleLabels !== false) {
            worldBadge(p, view, pol.n.x, pol.n.y - R - L(view, 26, 14), 'N',
                  { size: 15, col: C_NPOLE });
            worldBadge(p, view, pol.s.x, pol.s.y - R - L(view, 26, 14), 'S',
                  { size: 15, col: C_SPOLE });
        }
        if (o.current !== false) {
            worldBadge(p, view, s.x, s.y + R + L(view, 30, 16),
                  `N = ${s.N} 匝　I = ${fmt(s.I, 'A')}`, { size: 13, col: C_COIL });
        }
    }

    /** 依 kind 分派。頁面常常只有一串場源要畫，這支省掉 switch。 */
    function drawSource(p, view, s, o) {
        if (s.kind === 'wire') return drawWire(p, view, s, o);
        if (s.kind === 'magnet') return drawBarMagnet(p, view, s, o);
        if (s.kind === 'solenoid') return drawSolenoid(p, view, s, o);
    }

    // ======================================================================
    // 磁力線
    // ======================================================================

    /**
     * 自動挑種子點。
     *
     * 導線：場是純環流，一條半徑上取一個點就代表整個圓，所以每個半徑
     *       只需要一個種子。多取幾個半徑＝多畫幾個同心圓。
     * 磁鐵／螺線管：從 N 極周圍灑一圈種子、往 B 的方向追——每一條磁力線
     *       都從 N 出發，所以這樣剛好每一條都畫到一次，不多不少。
     */
    function autoSeeds(sources, o) {
        const seeds = [];
        const r0 = o.r0 || 26;
        for (const s of sources) {
            if (s.kind === 'wire') {
                for (const r of (o.radii || [70, 140, 225, 330])) {
                    seeds.push({ x: s.x + r, y: s.y });
                }
            } else {
                const pol = MagneticKit.magnetPoles(s);
                const n = o.perPole || 10;
                for (let i = 0; i < n; i++) {
                    const a = 2 * Math.PI * (i + 0.5) / n;
                    seeds.push({ x: pol.n.x + r0 * Math.cos(a),
                                 y: pol.n.y + r0 * Math.sin(a) });
                }
            }
        }
        return seeds;
    }

    /**
     * 畫磁力線。
     *
     * @param {object} o
     *   o.seeds     自訂種子點（不給就用 autoSeeds）
     *   o.perPole / o.r0 / o.radii   自動種子的參數
     *   o.step      追蹤步長（世界單位，預設 7）
     *   o.col / o.w 顏色與線寬
     *   o.arrow     沿線畫箭頭，預設 true（磁力線有方向，畫出來才讀得到）
     *   o.arrowEvery 每走多遠畫一個箭頭
     *   o.onlyClosed 只畫封閉的線
     */
    function drawFieldLines(p, view, sources, o) {
        o = o || {};
        const col = o.col || C_FIELD;
        const step = o.step || 7;
        const seeds = o.seeds || autoSeeds(sources, o);
        const maxSteps = o.maxSteps || 900;
        const bounds = o.bounds || SCENE;

        for (const sd of seeds) {
            const line = MagneticKit.traceLine(sources, sd.x, sd.y, { step, maxSteps, bounds });
            if (line.pts.length < 4) continue;
            if (o.onlyClosed && !line.closed) continue;

            p.noFill();
            strokeOn(p, col, L(view, o.w || 2, 1.2));
            p.beginShape();
            for (const q of line.pts) {
                p.vertex(view.toScreenX(q.x), view.toScreenY(q.y));
            }
            p.endShape();

            if (o.arrow !== false) drawLineArrows(p, view, line.pts, col, o);
        }
    }

    /** 沿著一條折線每隔一段距離放一個箭頭，顯示場的方向。 */
    function drawLineArrows(p, view, pts, col, o) {
        const every = o.arrowEvery || 95;
        const head = o.head || 9;
        let acc = every * 0.5;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            acc += Math.hypot(b.x - a.x, b.y - a.y);
            if (acc < every) continue;
            acc = 0;
            // 用前後各一點的差當方向，比單一線段穩
            const j = Math.min(i + 1, pts.length - 1);
            const dx = pts[j].x - pts[i - 1].x, dy = pts[j].y - pts[i - 1].y;
            arrowHead(p, view, view.toScreenX(b.x), view.toScreenY(b.y),
                      dx, dy, head, col);
        }
    }

    // ======================================================================
    // 均勻磁場（垂直於畫面）
    // ======================================================================

    /**
     * 在一片矩形區域上鋪滿 ⊙ 或 ⊗，代表垂直於畫面的均勻磁場。
     * 帶電粒子那一頁的「磁場區域」就是這個。
     *
     * @param {object} o {bz, spacing, r, col, fill, label}
     */
    function drawFieldRegion(p, view, rect, o) {
        o = o || {};
        const bz = o.bz;
        if (Math.abs(bz) < 1e-12) return;
        const col = o.col || C_FIELD;
        const sp = o.spacing || 100;
        const r = o.r || 9;

        if (o.fill !== false) {
            p.noStroke();
            p.fill(bz > 0 ? 239 : 246, bz > 0 ? 246 : 248, bz > 0 ? 255 : 255);
            p.rect(view.toScreenX(rect.x), view.toScreenY(rect.y),
                   L(view, rect.w), L(view, rect.h));
        }
        for (let x = rect.x + sp / 2; x < rect.x + rect.w; x += sp) {
            for (let y = rect.y + sp / 2; y < rect.y + rect.h; y += sp) {
                drawPageDir(p, view, x, y, r, bz, col);
            }
        }
        if (o.border !== false) {
            strokeOn(p, C_DIM, L(view, 1.5, 1));
            p.noFill();
            p.rect(view.toScreenX(rect.x), view.toScreenY(rect.y),
                   L(view, rect.w), L(view, rect.h));
        }
    }

    /** 磁場大小的標籤（畫在區域角落，配上 ⊙／⊗ 的說明）。 */
    function fieldRegionLabel(p, view, rect, bz, o) {
        o = o || {};
        const sym = bz > 0 ? '⊙ 穿出螢幕' : '⊗ 穿入螢幕';
        worldBadge(p, view, rect.x + rect.w / 2, rect.y + L(view, 26, 14),
              `${sym}　B = ${o.text || fmt(Math.abs(bz), 'T')}`,
              { size: 14, col: o.col || C_FIELD });
    }

    // ======================================================================
    // 帶電粒子
    // ======================================================================

    /**
     * 帶電粒子：一個帶 +/− 的圓，加一枝速度箭頭。
     *
     * ⚠️ 力的箭頭不要在這裡自己算——呼叫端要用 MagneticKit.lorentzForce()
     *    拿到 F 再交給 drawForceArrow()。方向寫錯的症狀是「粒子往反方向
     *    繞」，而那個在畫面上看起來很合理，所以只能靠共用同一個函式來防。
     */
    function drawParticle(p, view, q, o) {
        o = o || {};
        const col = q >= 0 ? C_NPOLE : C_SPOLE;
        const rad = o.r || 13;
        const cx = o.x, cy = o.y;
        const sx = view.toScreenX(cx), sy = view.toScreenY(cy);
        const R = L(view, rad);

        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.ellipse(sx, sy, R * 2, R * 2);
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.BOLD);
        p.textSize(L(view, rad * 1.5, 9));
        p.text(q >= 0 ? '+' : '−', sx, sy - L(view, 1));

        if (o.vx || o.vy) {
            const k = o.vScale || 1;
            arrow(p, view, cx, cy, o.vx * k, o.vy * k, C_VEL, { w: 3, head: 11 });
        }
    }

    /** 力／速度的箭頭（世界座標），配上文字標籤。 */
    function drawVector(p, view, x, y, dx, dy, col, label, o) {
        const tip = arrow(p, view, x, y, dx, dy, col, o);
        if (label) {
            worldBadge(p, view, tip.x, tip.y + L(view, 4, 3) + L(view, 16, 9), label,
                  { size: 13, col });
        }
    }

    // ======================================================================
    // 線圈（軸躺在畫面內）
    // ======================================================================

    /**
     * 側面看到的線圈：軸沿著 (ax, ay)，半徑 R，N 匝。
     * 電磁感應與變壓器兩頁都用這個。
     *
     * @param {object} o {R, turns, col, w, leads}
     */
    function drawCoil(p, view, cx, cy, ax, ay, R, o) {
        o = o || {};
        const am = Math.hypot(ax, ay) || 1;
        const a = Math.atan2(ay / am, ax / am);
        const turns = o.turns || 8;
        const span = o.span || R * 0.9;             // 線圈整體沿軸的長度（單邊）
        const len = span * 2;
        const gap = len / turns;
        const col = o.col || C_COIL;

        p.push();
        p.translate(view.toScreenX(cx), view.toScreenY(cy));
        p.rotate(a);
        strokeOn(p, col, L(view, o.w || 3, 1.8));
        p.noFill();
        for (let i = 0; i < turns; i++) {
            p.ellipse(-L(view, len / 2) + L(view, gap) * (i + 0.5), 0,
                      L(view, gap) * 0.95, L(view, R) * 2);
        }
        // 引線：從線圈的兩端往外拉出去
        if (o.leads !== false) {
            const lead = o.lead || R * 1.5;
            strokeOn(p, col, L(view, 3, 1.8));
            p.line(-L(view, len / 2), -L(view, R), -L(view, len / 2 + lead), -L(view, R));
            p.line(L(view, len / 2), -L(view, R), L(view, len / 2 + lead), -L(view, R));
        }
        p.pop();

        if (o.label) {
            worldBadge(p, view, cx, cy + L(view, R + 34, 18), o.label,
                  { size: 13, col: o.labelCol || col });
        }
    }

    /** 線圈的軸（虛線），畫在線圈後面，讓「軸」這件事看得見。 */
    function drawAxisLine(p, view, cx, cy, ax, ay, half, o) {
        o = o || {};
        const am = Math.hypot(ax, ay) || 1;
        const ux = ax / am, uy = ay / am;
        dashed(p, view, cx - ux * half, cy - uy * half, cx + ux * half, cy + uy * half,
               o.col || C_AXIS, { w: o.w || 1.5 });
    }

    // ======================================================================
    // 直流電動機的轉子（沿著轉軸看進去的視圖）
    // ======================================================================
    /**
     * 馬達線圈，**沿著轉軸看進去**（end-on）的視圖。
     *
     * ⚠️ 這個視角很容易畫錯，而且畫錯了畫面照樣轉得很順、不會有任何錯誤訊息。
     *    推導留在這裡，要改之前先讀一遍（每一個「所以」都是可以獨立檢查的）：
     *
     *    1. 磁場在畫面內、由左（N 極）指向右（S 極）：B = B·x̂。
     *    2. 轉軸**垂直於畫面**（指向讀者）。線圈的兩條導體與轉軸平行，
     *       所以沿著轉軸看過去，兩條導體各自只是**一個點**。
     *    3. 導體受力 F = I·L·(d̂ × B)，d̂ 是電流方向。導體 ∥ ẑ、B ∥ x̂，
     *       而 ẑ × x̂ = ŷ，所以 **F 永遠沿著 ±ŷ**——一個往上、一個往下
     *       → 對轉軸產生力矩 → **線圈在畫面內轉**。
     *    4. 若把導體畫成畫面內的直線（第一版就是這樣），受力方向會變成
     *       穿出畫面，和「在畫面內轉」直接矛盾。但**畫面上看起來一樣在轉**，
     *       所以只能靠推導抓出來，不能靠眼睛。
     *
     * 角度約定：θ 是 **線圈法線與 B 的夾角**（與 MagneticKit.dcMotor 一致）。
     * 法線與「兩條導體的連線」互相垂直，所以連線的螢幕角度是
     *
     *     φ = 90° − θ
     *
     * （螢幕慣例：x 向右、y 向下，φ 增加看起來是順時針。）
     * θ = 0 時法線 ∥ B，兩條導體躺在 ±ŷ 上、力臂為零 → 力矩 0，正是換向的死點。
     *
     * ⚠️ **換向器**：線圈裡的電流每半圈要反向一次，否則過了死點力矩就變成
     *    反對轉動，馬達會停下來。方向由 sin θ 的正負決定——`commutate: false`
     *    就是「沒有換向器的單一線圈」，那台機器轉不過半圈。
     *
     * @param {object} o {cx, cy, w, theta, commutate, showPath, label}
     *   w        —— 兩條導體的間距（世界單位）
     *   theta    —— 線圈法線與 B 的夾角（弧度），由 MagneticKit 的積分給
     *   commutate—— 預設 true。false 時固定在 +û 那一端穿出畫面
     * @returns {{a:object, b:object, out:number, fdir:object}}
     *   a、b  —— 兩條導體的世界座標（a 是 +û 那一端）
     *   out   —— 哪一端帶 ⊙：+1 = a，−1 = b
     *   fdir  —— **a 那一端**所受的力方向（螢幕單位向量，y 向下）
     */
    function drawMotorCoil(p, view, o) {
        const theta = o.theta || 0;
        const phi = Math.PI / 2 - theta;
        const hw = (o.w || 260) / 2;
        const ux = Math.cos(phi), uy = Math.sin(phi);
        const a = { x: o.cx + hw * ux, y: o.cy + hw * uy };
        const b = { x: o.cx - hw * ux, y: o.cy - hw * uy };

        // 導體掃過的路徑。畫虛線圓，不然單看一條轉動的線段看不出「在轉」。
        if (o.showPath !== false) {
            const ctx = p.drawingContext;
            p.noFill();
            strokeOn(p, C_AXIS, L(view, 1.5, 1));
            if (ctx.setLineDash) ctx.setLineDash([L(view, 9, 5), L(view, 8, 4)]);
            p.ellipse(view.toScreenX(o.cx), view.toScreenY(o.cy),
                      L(view, hw * 2), L(view, hw * 2));
            if (ctx.setLineDash) ctx.setLineDash([]);
        }

        // 線圈本體：兩條導體沿轉軸看過去各是一個點，這一條線段就是把它們
        // 接起來的兩段端接線。畫粗一點，讀起來才像導線而不是一條參考線。
        strokeOn(p, C_COIL, L(view, 7, 3.4));
        p.line(view.toScreenX(a.x), view.toScreenY(a.y),
               view.toScreenX(b.x), view.toScreenY(b.y));

        // 電流：一端 ⊙（穿出畫面）、另一端 ⊗（穿入畫面）。兩條導體的電流
        // 反向——這是電動機轉得動的全部理由，也是這一頁最該看見的一件事。
        const out = (o.commutate === false) ? ((o.out || 1) >= 0 ? 1 : -1)
                                            : (Math.sin(theta) >= 0 ? 1 : -1);
        const outEnd = out > 0 ? a : b;
        const inEnd = out > 0 ? b : a;
        drawOutOfPage(p, view, outEnd.x, outEnd.y, 11, C_COIL);
        drawIntoPage(p, view, inEnd.x, inEnd.y, 11, C_COIL);

        if (o.label) {
            worldBadge(p, view, o.cx, o.cy + hw * 1.22, o.label,
                       { size: 12, col: C_COIL });
        }

        // a 那一端的受力方向：out = +1 時 d̂ = +ẑ → F = I·L·B·ŷ = 畫面「上」；
        // out = −1 時整枝反向。b 那一端的力永遠與它相反。
        return { a, b, out, fdir: { x: 0, y: -out } };
    }

    // ======================================================================
    // 對外介面
    // ======================================================================
    return {
        // 以下是 lab-scene.js 的東西，只是**轉出**——磁學的頁面因此只要
        // 記住 MagneticScene 一個名字（電學那邊也是同樣的做法，見
        // circuit-scene.js 的介面）。
        strokeOn, L, fmt, badge,
        // 標籤**一律用 worldBadge**（吃世界座標）。`badge` 是像素版本，
        // 只為了和波動學／電學那幾頁共用才一起轉出來——磁學的頁面不要用它。
        worldBadge,
        run: LabScene.run,
        drawGraph: LabScene.drawGraph,
        drawTitleBar: LabScene.drawTitleBar,
        WORLD_W, WORLD_H,
        // 可畫區域（下緣在標題列上緣）。要放東西進場景就照這個框，
        // 尤其是場線的 traceLine bounds。
        SCENE,

        C_FIELD, C_NPOLE, C_SPOLE, C_COIL, C_VEL, C_FORCE, C_INDUCED, C_DIM, C_AXIS,

        arrowHead, arrow, dashed,

        drawOutOfPage, drawIntoPage, drawPageDir,
        drawWire, drawBarMagnet, drawSolenoid, drawSource,

        autoSeeds, drawFieldLines, drawLineArrows,
        drawFieldRegion, fieldRegionLabel,

        drawParticle, drawVector,
        drawCoil, drawAxisLine, drawMotorCoil,
    };
})();
