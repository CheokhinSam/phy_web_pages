/**
 * 實驗頁的共用骨架（與題材無關）
 *
 * 這個檔案裡沒有任何物理，也沒有任何一種題材的符號。它就是
 * 「控制面板 + 開始／暫停／重設 + 數據卡片 + 圖表 + 底部黑色標題列 +
 * p5 生命週期」這一整套版面，加上共用的配色與小工具。
 *
 * 為什麼要有這一層：電學做完之後磁學要接，磁學要用的面板、卡片、標題列、
 * 圖表跟電學**完全一樣**，只有畫的東西不同。骨架住在 `circuit-scene.js`
 * 裡的話，磁學只有兩條路——複製 500 行，或者讓磁學頁面引用一個叫做
 * CircuitScene 的東西去畫磁力線。兩條都不好，所以把它抽出來。
 *
 * 分工：
 *   lab-scene.js       版面骨架（這個檔案）        ← 有 p5 生命週期
 *   circuit-scene.js   電路符號與電流動畫           ← 只有繪圖
 *   magnetic-scene.js  磁場、磁鐵、線圈、感應        ← 只有繪圖
 *
 * ⚠️ **只有這個檔案有 `new p5()`**，所以 `patch-site.py` 的三個錨點住在
 *    這裡（見下方 run()）。`patch-site.py` 只對**含有 `new p5(` 的**
 *    `*-scene.js` 要求錨點，其餘的純繪圖模組不受檢——改動這裡之前先讀
 *    `.github/scripts/headless/README.md` 的陷阱一。
 *
 * ⚠️ 載入順序：classic script、沒有 defer，照 `js_deps` 的順序同步執行，
 *    所以 `lab-scene.js` **必須排在** circuit-scene.js / magnetic-scene.js
 *    前面（後面兩者會轉出這裡的東西）。
 */
var LabScene = (function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900）
    // ======================================================================
    // 方形場景：電路、磁場、線圈都是往四方展開的，用正方形世界最省事，
    // 也不用為了長寬比去猜「主要往哪個方向展開」。
    const WORLD_W = 900;
    const WORLD_H = 900;

    const TITLE_TOP = 812;          // 底部黑條的世界 y
    const TITLE_H = 48;             // 黑條高度

    // 共用配色
    const C_WIRE = [30, 41, 59];          // 導線／座標軸：近黑
    const C_CURRENT = [37, 99, 235];      // 傳統電流：藍
    const C_ELECTRON = [234, 88, 12];     // 電子流：橘
    const C_HOT = [220, 38, 38];          // 發熱／熔斷／警示
    const C_LABEL = [30, 64, 175];        // 數值標籤的藍框
    const C_OPEN = [148, 163, 184];       // 斷開的開關、熔斷的保險絲
    const C_GRID = [226, 232, 240];       // 格線

    // ======================================================================
    // 小工具
    // ======================================================================

    function strokeOn(p, col, w) {
        p.stroke(col[0], col[1], col[2]);
        p.strokeWeight(w);
    }

    /** 世界座標的長度 → 這台機器上的像素 */
    const L = (view, n, min) => view.len(n, min);

    function fmt(v, unit) {
        const a = Math.abs(v);
        let s;
        if (a === 0) s = '0';
        else if (a < 0.001) s = v.toExponential(1);
        else if (a < 1) s = v.toFixed(3);
        else s = v.toFixed(2);
        return s + ' ' + unit;
    }

    /** 白底藍框的數值標籤（和 wave-scene 同一個長相，系列才一致）。 */
    function badge(p, view, x, y, text, o) {
        o = o || {};
        const size = L(view, o.size || 16, 9);
        const padX = L(view, 11, 5), padY = L(view, 6, 3);
        const align = o.align || 'center';
        const col = o.col || C_LABEL;

        p.textSize(size);
        p.textStyle(p.BOLD);
        const tw = p.textWidth(text);
        const bx = align === 'right' ? x - tw : align === 'left' ? x : x - tw / 2;
        const by = y - size / 2;
        const w = tw + padX * 2, h = size + padY * 2;

        p.noStroke();
        p.fill(255);
        p.rect(bx - padX, by - padY, w, h);
        p.noFill();
        strokeOn(p, col, L(view, 1.5, 1));
        p.rect(bx - padX, by - padY, w, h);
        p.noStroke();
        p.fill(col[0], col[1], col[2]);
        p.textAlign(align === 'right' ? p.RIGHT : align === 'left' ? p.LEFT : p.CENTER,
                    p.CENTER);
        p.text(text, x, y);
    }

    /** 刻度數字：去掉沒意義的尾數 0，但要保留「0.5」這種。 */
    function trim(v) {
        if (Math.abs(v) < 1e-12) return '0';
        if (Math.abs(v) >= 100) return v.toFixed(0);
        if (Math.abs(v) >= 10) return v.toFixed(0);
        return parseFloat(v.toFixed(2)).toString();
    }

    // ======================================================================
    // 底部標題列（和 wave-scene 同一個長相）
    // ======================================================================

    function drawTitleBar(p, view, text) {
        const r = view.rect;
        const barTop = view.toScreenY(TITLE_TOP);
        const barH = L(view, TITLE_H);
        p.noStroke();
        p.fill(0, 0, 0, 178);
        p.rect(r.x, barTop, r.w, barH);
        p.fill(251, 191, 36);
        p.textAlign(p.CENTER, p.CENTER);
        p.textStyle(p.BOLD);
        // 單行不換行。字級固定時長句會超出黑條、兩端被畫布邊緣切掉，
        // 所以讓字級自動降到塞得下；下限 11 px，再小就讀不到了。
        const maxW = r.w - L(view, 24, 12);
        let size = L(view, 17, 10);
        const floor = L(view, 11, 7);
        p.textSize(size);
        while (size > floor && p.textWidth(text) > maxW) {
            size *= 0.96;
            p.textSize(size);
        }
        p.text(text, r.x + r.w / 2, barTop + barH / 2);
    }

    // ======================================================================
    // 通用圖表
    // ======================================================================

    /**
     * 在畫布上畫一張座標圖。**不用 PhysicsUtils.createChart**——那支是
     * 單資料集的時間序列（x 軸只能是時間），畫不了 V–I 這種 x 軸是物理量的圖。
     *
     * @param {object} g
     *   g.x, g.y, g.w, g.h                 繪圖區在世界座標裡的位置與大小
     *   g.xMin, g.xMax, g.yMin, g.yMax     量程
     *   g.xTicks, g.yTicks                 格線數
     *   g.xLabel, g.xUnit, g.yLabel, g.yUnit
     *   g.series [{pts:[{x,y}], col, r, join}]   join=true 會把點連起來
     *   g.lines  [{from:{x,y}, to:{x,y}, col, dash, label}]
     *   g.marker {x, y, col}                當下的工作點
     *   g.title
     */
    function drawGraph(p, view, g) {
        const px = view.toScreenX(g.x), py = view.toScreenY(g.y);
        const pw = L(view, g.w), ph = L(view, g.h);
        const xMin = g.xMin, xMax = g.xMax, yMin = g.yMin, yMax = g.yMax;
        const X = v => px + (v - xMin) / (xMax - xMin) * pw;
        const Y = v => py + ph - (v - yMin) / (yMax - yMin) * ph;

        // 繪圖區底。要在標題**之前**畫，標題才有東西墊著。
        //
        // `plate: true` 會把標題（上面）與刻度數字、軸標題（下面）一起蓋住。
        // 什麼時候需要：圖的正上方與正下方就是場景本身的時候（磁力線那頁的
        // 場源就在圖的頭上，線會穿過標題與刻度——文字本身壓得住線，但筆畫
        // 之間會露出來，讀起來像雜訊）。電學那七頁不需要，預設不開。
        const up = g.plate ? L(view, 44) : 0;
        const dn = g.plate ? L(view, 46) : 0;
        p.noStroke();
        p.fill(252, 252, 253);
        p.rect(px, py - up, pw, ph + up + dn);

        // 標題
        if (g.title) {
            p.noStroke();
            p.fill(15, 23, 42);
            p.textSize(L(view, 17, 10));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.text(g.title, px + pw / 2, py - L(view, 30));
        }

        // 格線
        const nx = g.xTicks || 4, ny = g.yTicks || 4;
        strokeOn(p, C_GRID, L(view, 1, 1));
        for (let i = 0; i <= nx; i++) {
            const x = px + pw * i / nx;
            p.line(x, py, x, py + ph);
        }
        for (let i = 0; i <= ny; i++) {
            const y = py + ph * i / ny;
            p.line(px, y, px + pw, y);
        }

        // 軸
        strokeOn(p, C_WIRE, L(view, 2, 1.5));
        p.line(px, py, px, py + ph);
        p.line(px, py + ph, px + pw, py + ph);

        // 刻度數字
        p.noStroke();
        p.fill(71, 85, 105);
        p.textSize(L(view, 12, 8));
        p.textStyle(p.NORMAL);
        for (let i = 0; i <= nx; i++) {
            const v = xMin + (xMax - xMin) * i / nx;
            p.textAlign(p.CENTER, p.TOP);
            p.text(trim(v), px + pw * i / nx, py + ph + L(view, 5));
        }
        for (let i = 0; i <= ny; i++) {
            const v = yMin + (yMax - yMin) * i / ny;
            p.textAlign(p.RIGHT, p.CENTER);
            p.text(trim(v), px - L(view, 6), py + ph - ph * i / ny);
        }

        // 軸標題
        p.fill(15, 23, 42);
        p.textSize(L(view, 14, 9));
        p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.TOP);
        p.text(g.xLabel + (g.xUnit ? ' / ' + g.xUnit : ''),
               px + pw / 2, py + ph + L(view, 20));
        p.push();
        p.translate(px - L(view, 40), py + ph / 2);
        p.rotate(-Math.PI / 2);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text(g.yLabel + (g.yUnit ? ' / ' + g.yUnit : ''), 0, 0);
        p.pop();

        // ---- 以下裁切在繪圖區之內 ----
        // 資料點有可能落在量程外（電池電壓調到最大、外電阻調到最小），
        // 不裁的話點會畫到座標軸外面、甚至壓到電路圖上。
        const ctx = p.drawingContext;
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, pw, ph);
        ctx.clip();

        // 參考線（理論線）
        for (const ln of (g.lines || [])) {
            const a = ln.from, b = ln.to;
            strokeOn(p, ln.col || [148, 163, 184], L(view, 2, 1.5));
            if (ctx.setLineDash) ctx.setLineDash(ln.dash ? [L(view, 8, 4), L(view, 6, 3)] : []);
            p.line(X(a.x), Y(a.y), X(b.x), Y(b.y));
            if (ctx.setLineDash) ctx.setLineDash([]);
            if (ln.label) {
                // 標籤畫在白底標籤裡，壓在線上才讀得到。
                //
                // ⚠️ `from`/`to` 是**資料座標**（上面那段畫線自己就過了一次
                //    X()/Y()），而 badge() 吃的是**畫布像素**。這一格原本直接把
                //    資料座標餵進 badge()，於是標籤被擺在畫布左上角
                //    ——資料 (0.25, 2.85) 就是像素 (0.25, 2.85)——整塊落在
                //    裁切區外，**一條參考線的標籤都沒顯示過**。
                //    （電學那七頁的「V = I·R」「V = ε − Ir」都是這樣不見的。）
                //    凡是把位置交給 badge() 之前，都要先問「這是世界座標還是像素」。
                const my = (a.y + b.y) / 2 + (yMax - yMin) * 0.07;
                badge(p, view, X((a.x + b.x) / 2), Y(my),
                      ln.label, { size: 13, col: ln.col || [148, 163, 184] });
            }
        }

        // 資料點
        for (const s of (g.series || [])) {
            const col = s.col || C_CURRENT;
            if (s.join) {
                p.noFill();
                strokeOn(p, col, L(view, 2.5, 1.5));
                p.beginShape();
                for (const q of s.pts) p.vertex(X(q.x), Y(q.y));
                p.endShape();
            }
            p.noStroke();
            p.fill(col[0], col[1], col[2]);
            const r = L(view, s.r || 3.5, 2);
            for (const q of s.pts) p.ellipse(X(q.x), Y(q.y), r * 2, r * 2);
        }

        // 當下的工作點：放大、加一圈白環，和其他量測點區分開
        if (g.marker) {
            const m = g.marker, col = m.col || C_HOT;
            p.noFill();
            p.stroke(255);
            p.strokeWeight(L(view, 5, 3));
            p.ellipse(X(m.x), Y(m.y), L(view, 20), L(view, 20));
            strokeOn(p, col, L(view, 3, 2));
            p.ellipse(X(m.x), Y(m.y), L(view, 20), L(view, 20));
        }

        ctx.restore();
    }

    // ======================================================================
    // 控制面板
    // ======================================================================

    /**
     * 各頁共用的面板：宣告這頁要哪些滑桿／下拉，其餘（按鈕、公式盒、
     * 開始/暫停/重設的顯隱）都一樣。
     *
     * @returns {object} panel，滑桿的現值直接在 panel[key] 上；
     *                   另外有 panel.set(key, v) 可以**程式化**改值
     *                   （自動掃描用，會更新滑桿位置與數字但不觸發回呼）
     */
    function buildPanel(ctrlPanel, o) {
        o = o || {};
        const sliders = (o.controls && o.controls.sliders) || [];
        const selects = (o.controls && o.controls.selects) || [];

        const val = {};
        const dec = {};
        const range = {};
        for (const s of sliders) {
            val[s.key] = s.def;
            dec[s.key] = s.dec == null ? (s.step < 0.1 ? 2 : s.step < 1 ? 1 : 0) : s.dec;
            range[s.key] = { min: s.min, max: s.max, step: s.step };
        }
        for (const s of selects) val[s.key] = s.def;

        const formulaHTML = (typeof katex !== 'undefined')
            ? katex.renderToString(o.formula || '', { throwOnError: false, displayMode: true })
            : `<div style="font-size:1rem;font-weight:700;">${o.formulaFallback || ''}</div>`;

        const sliderHTML = sliders.map(s => `
            <div class="control-box">
                <label>
                    <span>${s.label}</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="${s.key}Val" style="color: #2563eb;">${s.def.toFixed(dec[s.key])}</span> ${s.unit || ''}
                    </span>
                </label>
                <input type="range" id="${s.key}Slider" min="${s.min}" max="${s.max}"
                       step="${s.step}" value="${s.def}">
            </div>`).join('');

        const selectHTML = selects.map(s => `
            <div class="control-box">
                <label><span>${s.label}</span></label>
                <select id="${s.key}Select" style="width: 100%; padding: 8px; font-size: 0.9rem; font-weight: 700; border: 1px solid #000; background: #fff; cursor: pointer;">
                    ${s.options.map(op => `<option value="${op.v}">${op.t}</option>`).join('')}
                </select>
            </div>`).join('');

        ctrlPanel.innerHTML = `
            ${selectHTML}
            ${sliderHTML}
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">核心關係</div>
                <!--
                    ⚠️ overflow-x: auto 是**故意的**，不是裝飾。
                    KaTeX 的 display 公式不會換行，比側欄寬的時候就整段溢出
                    control-box 的底色之外，被畫布蓋掉——**畫面上只是少了一段
                    公式，不會有任何錯誤**，跟 README 陷阱九（整頁縮圖看不出
                    「少畫了東西」）是同一種失敗。加上橫向捲軸，最壞情況是
                    要捲一下，而不是內容直接不見。
                    更好的做法是讓公式自己排成兩列（見 motor.js 用 aligned）。
                    （註：這段說明不能寫反引號——它住在樣板字串裡面。）
                -->
                <div style="overflow-x: auto;">${formulaHTML}</div>
            </div>
        `;

        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');

        const panel = {
            started: false, paused: false,
            reset(keepStarted) {
                panel.started = !!keepStarted;
                panel.paused = false;
                pauseBtn.textContent = '暫停 PAUSE';
                sync();
            },
            /** 程式化改值：更新面板與滑桿，但**不**觸發 onChange（自動掃描用） */
            set(key, v) {
                if (!(key in val)) return;
                val[key] = v;
                panel[key] = v;
                const el = document.getElementById(key + 'Slider');
                if (el) el.value = v;
                const lab = document.getElementById(key + 'Val');
                if (lab) lab.textContent = v.toFixed(dec[key]);
            },
            range: key => range[key],
        };
        for (const k in val) panel[k] = val[k];

        function sync() {
            startBtn.style.display = panel.started ? 'none' : 'block';
            pauseBtn.style.display = panel.started ? 'block' : 'none';
        }

        function change(reason) {
            for (const k in val) panel[k] = val[k];
            if (o.onChange) o.onChange(reason);
        }

        for (const s of selects) {
            const el = document.getElementById(s.key + 'Select');
            el.value = val[s.key];
            el.addEventListener('change', () => {
                val[s.key] = el.value;
                // live 的下拉只是「換一種畫法」，不是換電路——不該把模擬停掉、
                // 更不該把已經累積的資料點清掉。例如切換傳統電流／電子流。
                if (s.live) { change('view'); return; }
                panel.started = false;
                panel.paused = false;
                sync();
                change('param');
            });
        }

        for (const s of sliders) {
            PhysicsUtils.bindSlider(s.key + 'Slider', s.key + 'Val', v => {
                val[s.key] = v;
                panel.started = false;
                panel.paused = false;
                sync();
                change('param');
            }, v => v.toFixed(dec[s.key]));
        }

        startBtn.addEventListener('click', () => {
            panel.started = true;
            panel.paused = false;
            sync();
            change('start');
        });

        pauseBtn.addEventListener('click', () => {
            panel.paused = !panel.paused;
            pauseBtn.textContent = panel.paused ? '播放 PLAY' : '暫停 PAUSE';
            change('pause');
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            panel.started = false;
            panel.paused = false;
            sync();
            change('reset');
        });

        // 不在這裡呼叫 onChange：panel 是在實驗檔的 pushCards 之前建立的，
        // 建構時就回呼會撞上那些 const 的 TDZ。
        sync();
        return panel;
    }

    // ======================================================================
    // 頁面骨架
    // ======================================================================

    /**
     * @param {object} o
     *   o.formula / o.formulaFallback
     *   o.controls  { sliders, selects }
     *   o.cards     createDataCards 設定
     *   o.model     {function(t, panel) => state}  這一頁的物理狀態
     *               （電學是回傳電路 C，磁學是回傳場源與幾何）。
     *               run() 不碰它的內容，原封不動交給 o.solve 與 o.draw。
     *               `o.circuit` 是同義的舊名字，仍然接受
     *   o.solve     {function(t, panel, state) => sol}
     *               把 state 解出這一幀的讀數。**預設是 CircuitKit.solve**
     *               （電學那七頁就是靠這個預設值，一行都不用改）
     *   o.values    {function(t, panel, sol, state) => object}  卡片數值
     *   o.draw      {function(p, view, t, panel, sol, state)}   這一頁的畫面
     *   o.titleText {function(t, panel, sol)}            底部黑條文案
     *   o.onFrame   {function(t, panel)}                 跑起來時每幀的鉤子，
     *                                                    在**解之前**呼叫
     *                                                    （自動掃描滑桿用）
     *   o.onSample  {function(t, panel, sol, state)}     每解完一次就呼叫
     *                                                    ——跑起來時每幀一次，
     *                                                    面板變動時也一次。
     *                                                    「落一個量測點」用這個
     *   o.onReset   {function(reason)}                   重設時清掉這一頁的狀態
     */
    function run(o) {
        const origCanvas = document.getElementById('physicsCanvas');
        if (!origCanvas) return;
        const container = origCanvas.parentElement;
        origCanvas.remove();
        const ctrlPanel = document.getElementById('controlPanel');
        const guardEl = ctrlPanel || container;

        let simTime = 0;

        const panel = buildPanel(ctrlPanel, {
            formula: o.formula,
            formulaFallback: o.formulaFallback,
            controls: o.controls,
            onChange(reason) {
                // ⚠️ 可見性要在**兩個提早返回之前**收，不能放進 refresh()。
                //    'pause'／'view' 會直接 return（下面兩行），`live` 的下拉
                //    正是走 'view'——哪天有人在 live 下拉上宣告 `when`，
                //    藏在 refresh() 裡的那一份就永遠不會執行。
                syncVisibility();
                if (reason === 'pause') return;
                // 'view' 只是換一種畫法（例如切換電子流疊圖）——時間、資料點、
                // 卡片數值都不該動，否則學生每切一次圖就被歸零一次。
                if (reason === 'view') return;
                simTime = 0;
                if (o.onReset) o.onReset(reason);
                refresh();
            },
        });

        const updateCards = PhysicsUtils.createDataCards(o.cards);

        // ── 控制項與卡片的宣告式可見性 ──────────────────────────────
        // ⚠️ **控制項與卡片都是一次全部長出來的。** `buildPanel` 沒有任何
        //    條件式過濾（每個滑桿／下拉都無條件渲染），`createDataCards` 一次
        //    就換掉整個 grid。所以「這一個屬於現在這個模式嗎」只能在長完之後
        //    靠 `when(panel)` 再收——宣告寫在 controls／cards 的每一項上。
        //
        // ⚠️ **`when` 只能依賴「經由 `change()` 改變」的量。** `panel.set()`
        //    （見 buildPanel）只寫 val／panel／DOM，**不觸發 `change()`**——
        //    依賴滑桿「值」的 when 在動畫期間永遠不會更新。症狀是「滑桿不見
        //    了，但它還在影響數字」，`errs=0`、沒有任何錯誤，只有動手拉才發現。
        //
        // ⚠️ 藏起來的控制項**還是會被 `panel.set()` 寫到**（那是程式化改值，
        //    不經 DOM）。這一頁的 `when` 只看 `mode`，而 `mode` 是下拉、一定
        //    經過 `change()`，所以是安全的。
        const _ct = o.controls || {};
        const anyWhen = ((_ct.sliders || []).concat(_ct.selects || []))
                            .some(s => s.when)
                     || (o.cards || []).some(c => c.when);

        function syncVisibility() {
            if (!anyWhen) return;          // 其餘 16 頁一行 DOM 都不會被碰到
            for (const s of (_ct.sliders || []).concat(_ct.selects || [])) {
                // 滑桿與下拉用同一個 key，但元素 id 不同，兩個都查一次
                const el = document.getElementById(s.key + 'Slider')
                        || document.getElementById(s.key + 'Select');
                const box = el && el.closest('.control-box');
                // ⚠️ 寫 '' 不要寫 'block'：`.control-box` 是 display:flex
                //    （lab-style.css:105-109），寫 block 會靜默地弄歪排列。
                if (box) box.style.display = (!s.when || s.when(panel)) ? '' : 'none';
            }
            for (const c of (o.cards || [])) {
                const el = document.getElementById(c.id);
                const box = el && el.closest('.data-card');
                if (box) box.style.display = (!c.when || c.when(panel)) ? '' : 'none';
            }
        }

        // 電學那七頁沒有傳 o.solve，走這裡的預設值（＝電路求解器）。
        //
        // ⚠️ 但磁學那五頁**根本沒有載入 circuit-kit.js**，硬走同一個預設值
        //    會在第一次 refresh() 就 ReferenceError: CircuitKit is not defined。
        //    磁學的 model() 回傳的「場源與幾何」就已經是它要的答案，不需要
        //    再解一次，所以沒有 CircuitKit 時預設值就是恆等函式。
        //    （用 typeof 判斷，不是 try/catch——未宣告的識別字只有 typeof
        //      不會拋錯。）
        const solve = o.solve || (typeof CircuitKit !== 'undefined'
            ? (t, pn, state) => CircuitKit.solve(state)
            : (t, pn, state) => state);
        // ⚠️ `circuit` 是電學那七頁用的舊名字（它們全部原封不動地沿用），
        //    `model` 是給磁學用的中性名字。兩個都收，不要只留一個——
        //    這裡曾經只讀 o.model，結果七頁電學當場全部 TypeError。
        const model = o.model || o.circuit;

        function currentSolution() {
            const state = model(simTime, panel);
            const sol = solve(simTime, panel, state);
            return { state, sol };
        }

        /**
         * 解一次，把結果餵給卡片的更新函式。
         *
         * 兩個時機會叫它：面板變了（停住的時候），以及每一幀跑起來的時候。
         * **每一幀只解一次**——同一組 (state, sol) 同時餵給卡片和畫面，兩邊
         * 看到的必然是同一組數字。舊頁面就是「畫的電路」與「算的電路」各自
         * 一份，才會畫出短路的並聯圖卻顯示理想並聯的電流。
         */
        function refresh() {
            const { state, sol } = currentSolution();
            if (o.onSample) o.onSample(simTime, panel, sol, state);
            updateCards(o.values(simTime, panel, sol, state));
        }

        const sketch = (p) => {
            p.setup = () => {
                // 務必用 contentSize()（已扣 padding）。用 container.clientWidth
                // 的話，canvas 會比容器內容區大一圈，把三欄版面的右欄推出畫面。
                const { w, h } = PhysicsUtils.contentSize(container);
                const cnv = p.createCanvas(w || 800, h || 500);
                cnv.style('display', 'block');
                cnv.style('flex-shrink', '0');
                p.textFont('Inter');
            };

            p.windowResized = () => {
                const { w, h } = PhysicsUtils.contentSize(container);
                if (w > 0 && h > 0) p.resizeCanvas(w, h);
            };

            p.draw = () => {
                if (!document.contains(guardEl)) return;

                const running = panel.started && !panel.paused;
                if (running) {
                    simTime += p.min(p.deltaTime / 1000, 0.1);
                    // 先在這裡更新這一頁自己的狀態（例如自動掃描滑動變阻器），
                    // 再解——順序反過來的話，卡片會慢一幀，而且是拿舊的狀態
                    // 去配新的滑桿位置。
                    if (o.onFrame) o.onFrame(simTime, panel);
                }

                // 一定要清畫布。標題列與標註畫在場景範圍外，
                // 不清的話會一幀一幀疊上去糊成一團。
                p.background(255);

                const view = PhysicsUtils.fitViewWH(p.width, p.height, WORLD_W, WORLD_H);
                p.push();
                view.clip(p.drawingContext);

                const { state, sol } = currentSolution();
                if (running) {
                    if (o.onSample) o.onSample(simTime, panel, sol, state);
                    updateCards(o.values(simTime, panel, sol, state));
                }

                o.draw(p, view, simTime, panel, sol, state);

                drawTitleBar(p, view, o.titleText(simTime, panel, sol));

                p.pop();
            };
        };

        // 先收一次可見性，再解第一次——不然第一幀會是「兩個模式的滑桿同時
        // 在畫面上」的那一張，要等學生動一下才會收斂。
        syncVisibility();
        refresh();
        setTimeout(() => { new p5(sketch, container); }, 100);
    }

    return {
        WORLD_W, WORLD_H, TITLE_TOP, TITLE_H,
        C_WIRE, C_CURRENT, C_ELECTRON, C_HOT, C_LABEL, C_OPEN, C_GRID,

        strokeOn, L, fmt, badge, trim,
        drawTitleBar, drawGraph, buildPanel, run,
    };
})();
