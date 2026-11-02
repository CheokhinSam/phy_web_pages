/**
 * PhysicsUtils — 共享工具庫
 * 所有實驗共用的初始化、繪圖、UI 控制、數據面板、圖表工具。
 */
const PhysicsUtils = {

    // =========================================================================
    // 字型常數
    // =========================================================================

    FONTS: {
        LABEL: '700 13px "Inter", monospace',
        LEGEND: '700 12px "Inter", sans-serif',
        SMALL: '600 11px "Inter", sans-serif',
        ANGLE: '600 12px "Inter", monospace',
    },

    // =========================================================================
    // 佈局工具
    // =========================================================================

    /**
     * ⚠️ 舊版：只依寬度縮放，垂直尺寸無從表達，容易導致位置與尺寸脫節。
     * 新實驗請改用 fitView()。
     *
     * @param {number} px - 基準像素值
     * @param {number} W - 當前 canvas CSS 寬度
     * @returns {number}
     */
    scaled(px, W) {
        return px * (W / 800);
    },

    /**
     * 建立「邏輯世界 → 畫布」的座標轉換（等比縮放 + 置中）。
     *
     * 這是新實驗的標準做法。先宣告一個固定尺寸的邏輯世界，所有座標與尺寸
     * 一律用世界單位表示，再由 fitView 換算成實際像素。如此位置與尺寸必然
     * 同步縮放，不會因為 canvas 長寬比改變而相對跑掉。
     *
     * 世界原點在左上角，y 軸向下（與 canvas 一致，避免換算時要翻轉）。
     * 採 contain 模式：整個世界一定可見，多出來的空間置中留白。
     *
     * @param {HTMLCanvasElement} canvas
     * @param {number} worldW - 邏輯世界寬度（世界單位）
     * @param {number} worldH - 邏輯世界高度（世界單位）
     * @returns {object} view
     *
     * @example
     *   const view = PhysicsUtils.fitView(canvas, 1000, 700);
     *   const [px, py] = view.toScreen(120, 385);
     *   const carW = view.len(60);          // 60 世界單位 → 像素
     *   const fontSize = view.len(13, 10);  // 下限 10px，避免小畫布上無法閱讀
     *
     * p5.js 實驗請改用 fitViewWH(p.width, p.height, ...)。
     */
    fitView(canvas, worldW, worldH) {
        return PhysicsUtils.fitViewWH(canvas.cssWidth, canvas.cssHeight, worldW, worldH);
    },

    /**
     * fitView 的底層版本：直接吃寬高數字，不綁 canvas 元素。
     *
     * p5.js 實驗用這個（p5 自建的 canvas 沒有 cssWidth / cssHeight）：
     *   const view = PhysicsUtils.fitViewWH(p.width, p.height, 1000, 700);
     *
     * @param {number} W - 畫布寬度（CSS 像素）
     * @param {number} H - 畫布高度（CSS 像素）
     * @param {number} worldW - 邏輯世界寬度（世界單位）
     * @param {number} worldH - 邏輯世界高度（世界單位）
     * @returns {object} view
     */
    fitViewWH(W, H, worldW, worldH) {
        const scale = Math.min(W / worldW, H / worldH);
        const offsetX = (W - worldW * scale) / 2;
        const offsetY = (H - worldH * scale) / 2;
        const rectW = worldW * scale;
        const rectH = worldH * scale;

        return {
            scale,
            offsetX,
            offsetY,
            W,
            H,
            worldW,
            worldH,

            toScreenX: (x) => offsetX + x * scale,
            toScreenY: (y) => offsetY + y * scale,
            toScreen: (x, y) => [offsetX + x * scale, offsetY + y * scale],

            /**
             * 世界單位長度 → 像素
             * @param {number} n
             * @param {number} [minPx] - 像素下限（字級等需要可讀性時使用）
             */
            len: (n, minPx) => {
                const px = n * scale;
                return minPx != null && px < minPx ? minPx : px;
            },

            /** 世界範圍在畫布上的矩形（像素） */
            rect: { x: offsetX, y: offsetY, w: rectW, h: rectH },

            /**
             * 裁切到世界範圍，避免內容溢出到留白區。
             * 需由呼叫端自行以 ctx.save() / ctx.restore() 包住。
             */
            clip(ctx) {
                ctx.beginPath();
                ctx.rect(offsetX, offsetY, rectW, rectH);
                ctx.clip();
            },
        };
    },

    /**
     * 取得容器「內容區」的寬高（CSS 像素），已扣除 padding。
     *
     * ⚠️ p5.js 實驗的 canvas 由 p5 建立，套不到 `#physicsCanvas` 的
     * `width: 100% / height: 100%`，尺寸只能由 `p.createCanvas()` 傳入的值決定。
     * 若直接傳 `container.clientWidth`，**padding 會被算進去**，canvas 因而比
     * 容器的內容區大一圈：
     *   橫向 —— `.canvas-wrapper` 為了裝下 canvas 而變寬，grid 的 `1fr` 跟著
     *           撐開，三欄總寬超過 100vw，右側欄位被 `overflow: hidden` 切掉。
     *   縱向 —— 底部被 `overflow: hidden` 裁掉。
     *
     * @param {HTMLElement} el
     * @returns {{w: number, h: number}}
     *
     * @example
     *   const { w, h } = PhysicsUtils.contentSize(container);
     *   p.createCanvas(w, h);
     */
    contentSize(el) {
        const cs = getComputedStyle(el);
        const px = (v) => parseFloat(v) || 0;
        return {
            w: el.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight),
            h: el.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom),
        };
    },

    /**
     * 安全繪製文字（邊界夾取 + 可選背景）
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {object} [opts]
     * @param {string} [opts.font]
     * @param {string} [opts.color='#1e293b']
     * @param {string} [opts.align='left']
     * @param {string} [opts.baseline='alphabetic']
     * @param {string} [opts.bg] - 背景色（如 'rgba(255,255,255,0.85)'）
     * @param {number} [opts.padding=4]
     * @param {number} opts.W - canvas CSS 寬度（必填）
     * @param {number} opts.H - canvas CSS 高度（必填）
     */
    drawSafeText(ctx, text, x, y, opts = {}) {
        const W = opts.W, H = opts.H;
        const font = opts.font || PhysicsUtils.FONTS.LABEL;
        const color = opts.color || '#1e293b';
        const align = opts.align || 'left';
        const baseline = opts.baseline || 'alphabetic';
        const padding = opts.padding != null ? opts.padding : 4;

        ctx.save();
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;

        const m = ctx.measureText(text);
        const tw = m.width;
        const th = parseFloat(font) || 13;

        // 計算文字邊界框
        let lx = x, ly = y;
        if (align === 'center') lx = x - tw / 2;
        else if (align === 'right') lx = x - tw;

        // 夾取到 canvas 範圍內
        const minX = padding, maxX = W - tw - padding;
        const minY = padding + th, maxY = H - padding;
        if (lx < minX) lx = minX;
        if (lx > maxX) lx = maxX;
        if (ly < minY) ly = minY;
        if (ly > maxY) ly = maxY;

        // 可選背景
        if (opts.bg) {
            ctx.fillStyle = opts.bg;
            ctx.fillRect(lx - padding, ly - th - padding + 2, tw + padding * 2, th + padding * 2 - 2);
        }

        ctx.fillStyle = color;
        ctx.fillText(text, lx, ly);
        ctx.restore();
    },

    /**
     * 自動定位圖例（右上角，邊界保護）
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array<{color: string, label: string}>} entries
     * @param {number} W - canvas CSS 寬度
     * @param {number} H - canvas CSS 高度
     */
    drawLegend(ctx, entries, W, H) {
        const legendW = 160;
        const legendX = Math.max(10, W - legendW - 10);
        const legendY = 14;

        ctx.save();
        ctx.font = PhysicsUtils.FONTS.LEGEND;
        ctx.textAlign = 'left';

        entries.forEach((entry, i) => {
            const ey = legendY + i * 18;
            ctx.fillStyle = entry.color;
            ctx.fillRect(legendX, ey, 14, 3);
            ctx.fillStyle = '#1e293b';
            ctx.fillText(entry.label, legendX + 20, ey + 5);
        });

        ctx.restore();
    },

    // =========================================================================
    // 初始化
    // =========================================================================

    /**
     * 初始化 Canvas 和控制面板
     * @returns {{ canvas, ctx, ctrlPanel, guardEl }}
     */
    initCanvas() {
        const canvas = document.getElementById('physicsCanvas');
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const ctrlPanel = document.getElementById('controlPanel');
        const guardEl = ctrlPanel || canvas;
        return { canvas, ctx, ctrlPanel, guardEl };
    },

    /**
     * 註冊 resize 監聽（含 HiDPI 支援）
     * 設定 canvas.width/height 為物理像素，canvas.cssWidth/cssHeight 為 CSS 像素
     * @param {HTMLCanvasElement} canvas
     * @returns {Function} resizeCanvas
     */
    setupResize(canvas) {
        function resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.cssWidth = w;
            canvas.cssHeight = h;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return resizeCanvas;
    },

    /**
     * 每幀開始時呼叫：重設 HiDPI transform + 清除畫布
     * @param {CanvasRenderingContext2D} ctx
     * @param {HTMLCanvasElement} canvas
     */
    beginFrame(ctx, canvas) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.cssWidth, canvas.cssHeight);
    },

    /**
     * 註冊 pagehide cleanup
     * @param {number} animationFrameId
     * @param {Function} resizeCanvas
     * @param {Function} [onCleanup] - 額外的清理邏輯
     */
    setupCleanup(animationFrameId, resizeCanvas, onCleanup) {
        function cleanup() {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resizeCanvas);
            if (onCleanup) onCleanup();
        }
        window.addEventListener('pagehide', cleanup);
    },

    // =========================================================================
    // 繪圖工具
    // =========================================================================

    /**
     * 統一箭頭繪製
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @param {object} [opts]
     * @param {string} [opts.color='#000000']
     * @param {number} [opts.width=3]
     * @param {boolean} [opts.dashed=false]
     * @param {boolean} [opts.shadow=false]
     * @param {string} [opts.label] - 標籤文字
     */
    drawArrow(ctx, x1, y1, x2, y2, opts = {}) {
        const color = opts.color || '#000000';
        const width = opts.width || 3;
        const dashed = opts.dashed || false;
        const shadow = opts.shadow || false;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) return;

        ctx.save();

        if (shadow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
        }

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;

        if (dashed) ctx.setLineDash([6, 4]);

        // 箭頭
        const angle = Math.atan2(dy, dx);
        const headLen = Math.min(14, Math.max(8, len * 0.3));

        // 箭身停在箭頭底部
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2 - headLen * Math.cos(angle), y2 - headLen * Math.sin(angle));
        ctx.stroke();

        // 三角形箭頭
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // 標籤
        if (opts.label) {
            ctx.save();
            ctx.font = '700 13px "Inter", monospace';
            ctx.fillStyle = color;
            const m = ctx.measureText(opts.label);
            const lx = (x1 + x2) / 2 - m.width / 2;
            const ly = (y1 + y2) / 2 - 10;
            ctx.fillText(opts.label, lx, ly);
            ctx.restore();
        }
    },

    /**
     * 統一球體繪製（漸層 + 高光 + 描邊）
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - 中心 X
     * @param {number} y - 中心 Y
     * @param {number} r - 半徑
     * @param {string} color - 主色（如 '#2563eb'）
     * @param {object} [opts]
     * @param {string} [opts.darkColor] - 深色（預設自動加深）
     * @param {string} [opts.lightColor] - 淺色（預設自動加亮）
     * @param {string} [opts.strokeColor='#1e3a8a']
     * @param {string} [opts.label] - 球內文字
     */
    drawBall(ctx, x, y, r, color, opts = {}) {
        const darkColor = opts.darkColor || PhysicsUtils._darken(color);
        const lightColor = opts.lightColor || PhysicsUtils._lighten(color);
        const strokeColor = opts.strokeColor || '#1e3a8a';

        // 漸層
        const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
        grad.addColorStop(0, lightColor);
        grad.addColorStop(0.6, color);
        grad.addColorStop(1, darkColor);

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 描邊
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 高光
        ctx.beginPath();
        ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fill();

        // 標籤
        if (opts.label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${Math.max(10, r * 0.7)}px "Inter", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(opts.label, x, y);
        }
    },

    /** 內部：顏色加深 */
    _darken(hex) {
        const rgb = PhysicsUtils._hexToRgb(hex);
        return `rgb(${Math.max(0, rgb.r - 60)}, ${Math.max(0, rgb.g - 60)}, ${Math.max(0, rgb.b - 60)})`;
    },

    /** 內部：顏色加亮 */
    _lighten(hex) {
        const rgb = PhysicsUtils._hexToRgb(hex);
        return `rgb(${Math.min(255, rgb.r + 80)}, ${Math.min(255, rgb.g + 80)}, ${Math.min(255, rgb.b + 80)})`;
    },

    /** 內部：Hex 轉 RGB */
    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    // =========================================================================
    // UI 控制
    // =========================================================================

    /**
     * 綁定滑桿輸入
     * @param {string} sliderId
     * @param {string} valId - 顯示數值的 span ID
     * @param {Function} setter - 設定參數的函數 (value) => void
     * @param {Function} [formatter] - 格式化函數 (value) => string，預設 toFixed(1)
     */
    bindSlider(sliderId, valId, setter, formatter) {
        const slider = document.getElementById(sliderId);
        const valEl = document.getElementById(valId);
        if (!slider) return;
        const fmt = formatter || (v => parseFloat(v).toFixed(1));
        slider.addEventListener('input', function () {
            const v = parseFloat(this.value);
            setter(v);
            if (valEl) valEl.innerText = fmt(v);
        });
    },

    /**
     * 設定暫停按鈕（統一風格：白底→藍底）
     * @param {string} btnId
     * @param {object} stateObj - { isPaused: boolean }
     * @param {Function} loopFn - 動畫迴圈函數
     * @param {Function} [onToggle] - 切換時的額外回調
     */
    setupPauseBtn(btnId, stateObj, loopFn, onToggle) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            stateObj.isPaused = !stateObj.isPaused;
            btn.textContent = stateObj.isPaused ? '播放 PLAY' : '暫停 PAUSE';
            btn.style.backgroundColor = stateObj.isPaused ? '#2563eb' : '#ffffff';
            btn.style.color = stateObj.isPaused ? '#ffffff' : '#000000';
            btn.style.border = stateObj.isPaused ? 'none' : '1px solid #000000';
            if (!stateObj.isPaused) {
                stateObj.lastTimestamp = performance.now();
                requestAnimationFrame(loopFn);
            }
            if (onToggle) onToggle(stateObj.isPaused);
        });
    },

    /**
     * 設定開始按鈕
     * @param {string} startBtnId
     * @param {string} pauseBtnId
     * @param {object} stateObj - { isRunning: boolean, isPaused: boolean }
     * @param {Function} [onStart] - 開始時的額外回調
     */
    setupStartBtn(startBtnId, pauseBtnId, stateObj, onStart) {
        const startBtn = document.getElementById(startBtnId);
        const pauseBtn = document.getElementById(pauseBtnId);
        if (!startBtn) return;
        startBtn.addEventListener('click', () => {
            stateObj.isRunning = true;
            stateObj.isPaused = false;
            startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'block';
            if (onStart) onStart();
        });
    },

    /**
     * 設定重設按鈕
     * @param {string} btnId
     * @param {Function} resetFn - 重設邏輯
     */
    setupResetBtn(btnId, resetFn) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', resetFn);
    },

    // =========================================================================
    // 數據面板
    // =========================================================================

    /**
     * 注入數據卡片
     * @param {Array<{label: string, id: string, unit: string, highlight?: boolean}>} cards
     * @returns {Function} updateCards - 更新卡片數值的函數 ({ id: value }) => void
     */
    createDataCards(cards) {
        const dataGrid = document.querySelector('.data-cards-grid');
        if (!dataGrid) return () => { };

        dataGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
        dataGrid.innerHTML = cards.map(c => `
            <div class="data-card${c.highlight ? ' highlight' : ''}">
                <span class="card-label">${c.label}</span>
                <div class="card-num-wrapper">
                    <span id="${c.id}" class="card-num">0</span>
                    <span class="card-unit">${c.unit}</span>
                </div>
            </div>
        `).join('');

        return function updateCards(values) {
            for (const [id, val] of Object.entries(values)) {
                const el = document.getElementById(id);
                if (el) el.innerText = typeof val === 'number' ? val.toFixed(2) : val;
            }
        };
    },

    // =========================================================================
    // 圖表
    // =========================================================================

    /**
     * 建立 Chart.js 圖表（標準配置）
     * @param {object} config
     * @param {string} config.canvasId - canvas 元素 ID
     * @param {string} [config.type='line'] - 圖表類型
     * @param {string} config.label - 資料集標籤
     * @param {string} config.borderColor - 線條顏色
     * @param {string} config.xTitle - X 軸標題
     * @param {string} config.yTitle - Y 軸標題
     * @param {number} [config.borderWidth=2.5]
     * @param {number} [config.tension=0.1]
     * @param {number} [config.maxPoints=300]
     * @returns {{ chart, pushData(t, v) }}
     */
    createChart(config) {
        const canvasEl = document.getElementById(config.canvasId);
        if (!canvasEl || typeof Chart === 'undefined') return null;

        const chart = new Chart(canvasEl, {
            type: config.type || 'line',
            data: {
                labels: [],
                datasets: [{
                    label: config.label,
                    data: [],
                    borderColor: config.borderColor || '#2563eb',
                    borderWidth: config.borderWidth || 2.5,
                    pointRadius: 0,
                    fill: false,
                    tension: config.tension !== undefined ? config.tension : 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        title: { display: true, text: config.xTitle, font: { family: 'monospace', weight: '700' } },
                        grid: { display: false },
                        ticks: { font: { family: 'monospace' }, maxTicksLimit: 8 }
                    },
                    y: {
                        title: { display: true, text: config.yTitle, font: { family: 'monospace', weight: '700' } },
                        ticks: { font: { family: 'monospace' } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        const maxPoints = config.maxPoints || 300;

        return {
            chart,
            pushData(t, v) {
                chart.data.labels.push(t);
                chart.data.datasets[0].data.push(v);
                if (chart.data.labels.length > maxPoints) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }
                chart.update('none');
            },
            clear() {
                chart.data.labels = [];
                chart.data.datasets[0].data = [];
                chart.update();
            }
        };
    },

    /**
     * 顯示圖表容器並注入 canvas
     * @param {string} containerId - chartContainer 的 ID
     * @param {Array<{canvasId: string, title: string}>} charts
     */
    prepareChartContainer(containerId, charts) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.style.display = 'block';
        // 隱藏原有的預設圖表
        const origTitle = container.querySelector('.pane-meta-title');
        if (origTitle) origTitle.style.display = 'none';
        const origWrapper = container.querySelector('.chart-wrapper');
        if (origWrapper) origWrapper.style.display = 'none';

        charts.forEach(c => {
            container.insertAdjacentHTML('beforeend', `
                <div class="pane-meta-title" style="margin-top: 20px; margin-bottom: 10px;">// ${c.title}</div>
                <div class="chart-wrapper">
                    <canvas id="${c.canvasId}"></canvas>
                </div>
            `);
        });
    },

    // =========================================================================
    // 控制面板公式
    // =========================================================================

    /**
     * 生成控制面板底部的公式 HTML
     * @param {string} title - 公式標題
     * @param {string} formula - LaTeX 公式（不含 $$）
     * @returns {string} HTML 字串
     */
    formulaBox(title, formula) {
        return `
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">${title}</div>
                <div>$$${formula}$$</div>
            </div>
        `;
    },

    /**
     * 觸發 MathJax 渲染
     * @param {HTMLElement} element
     */
    typesetMath(element) {
        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise([element]);
        }
    }
};
