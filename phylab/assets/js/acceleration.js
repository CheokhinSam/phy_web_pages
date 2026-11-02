/**
 * 🚀 加速度實驗 - 等加速度直線運動
 * 調整初速度與加速度，觀察物體的運動狀態、速度變化與位移關係。
 */
function initAcceleration() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>初速度 <i>v₀</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="v0Val" style="color: #2563eb;">0</span> m/s
                    </span>
                </label>
                <input type="range" id="v0Slider" min="-20" max="20" step="1" value="0">
            </div>
            <div class="control-box">
                <label>
                    <span>加速度 <i>a</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">2.0</span> m/s²
                    </span>
                </label>
                <input type="range" id="aSlider" min="-10" max="10" step="0.5" value="2">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">核心公式</div>
                <div>$$v = v_0 + at$$</div>
                <div>$$x = v_0 t + \\frac{1}{2}at^2$$</div>
            </div>
        `;
        // 觸發 MathJax 渲染
        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise([ctrlPanel]);
        }
    }

    // ==========================================================================
    // B. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">時間 TIME</span>
                <div class="card-num-wrapper">
                    <span id="cardTime" class="card-num">0.00</span>
                    <span class="card-unit">s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">位移 POS</span>
                <div class="card-num-wrapper">
                    <span id="cardX" class="card-num">0.0</span>
                    <span class="card-unit">m</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">速度 VEL</span>
                <div class="card-num-wrapper">
                    <span id="cardV" class="card-num">0.0</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">加速度 ACC</span>
                <div class="card-num-wrapper">
                    <span id="cardA" class="card-num">2.0</span>
                    <span class="card-unit">m/s²</span>
                </div>
            </div>
        `;
    }

    const cardTime = document.getElementById('cardTime');
    const cardX = document.getElementById('cardX');
    const cardV = document.getElementById('cardV');
    const cardA = document.getElementById('cardA');

    // ==========================================================================
    // C. Chart.js 圖表
    // ==========================================================================
    const chartContainer = document.getElementById('chartContainer');
    if (chartContainer) {
        chartContainer.style.display = 'block';
        const origTitle = chartContainer.querySelector('.pane-meta-title');
        if (origTitle) origTitle.style.display = 'none';
        const origWrapper = chartContainer.querySelector('.chart-wrapper');
        if (origWrapper) origWrapper.style.display = 'none';

        chartContainer.insertAdjacentHTML('beforeend', `
            <div class="pane-meta-title" style="margin-top: 20px; margin-bottom: 10px;">// VELOCITY-TIME GRAPH</div>
            <div class="chart-wrapper">
                <canvas id="vChart"></canvas>
            </div>
            <div class="pane-meta-title" style="margin-top: 30px; margin-bottom: 10px;">// POSITION-TIME GRAPH</div>
            <div class="chart-wrapper">
                <canvas id="xChart"></canvas>
            </div>
        `);
    }

    let vChart = null;
    let xChart = null;
    const maxChartPoints = 300;

    function createCharts() {
        const vCanvas = document.getElementById('vChart');
        const xCanvas = document.getElementById('xChart');
        if (!vCanvas || !xCanvas) return;

        vChart = new Chart(vCanvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '速度 v (m/s)',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { title: { display: true, text: '時間 t (s)', font: { family: 'monospace', weight: '700' } }, grid: { display: false }, ticks: { font: { family: 'monospace' }, maxTicksLimit: 8 } },
                    y: { title: { display: true, text: '速度 v (m/s)', font: { family: 'monospace', weight: '700' } }, ticks: { font: { family: 'monospace' } } }
                },
                plugins: { legend: { display: false } }
            }
        });

        xChart = new Chart(xCanvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '位移 x (m)',
                    data: [],
                    borderColor: '#2563eb',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { title: { display: true, text: '時間 t (s)', font: { family: 'monospace', weight: '700' } }, grid: { display: false }, ticks: { font: { family: 'monospace' }, maxTicksLimit: 8 } },
                    y: { title: { display: true, text: '位移 x (m)', font: { family: 'monospace', weight: '700' } }, ticks: { font: { family: 'monospace' } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
    setTimeout(createCharts, 50);

    // ==========================================================================
    // D. 物理參數
    // ==========================================================================
    const guardEl = ctrlPanel;
    let v0 = 0;
    let a = 2.0;
    let simTime = 0;
    let currentX = 0;
    let currentV = 0;
    let isRunning = false;
    let isPaused = false;
    let lastTimestamp = performance.now();
    let animationFrameId;

    // ==========================================================================
    // 邏輯世界（世界單位）
    // --------------------------------------------------------------------------
    // 所有座標與尺寸一律用世界單位表示，繪製時經 PhysicsUtils.fitView()
    // 換算成像素。位置與尺寸因此必然同步縮放，不會因為 canvas 長寬比改變
    // 而相對跑掉——這是舊版混用「H 比例定位 + 寫死像素尺寸」的修正。
    // ==========================================================================
    const WORLD_W = 1000;
    const WORLD_H = 700;
    const U_PER_M = 1.8;      // 1 公尺 = 1.8 世界單位 → 全寬可見約 500 m
    const START_X = 80;       // 起點 x（世界單位）
    const ROAD_Y = 385;       // 道路中心線 y（世界單位，約世界高度的 55%）
    const ROAD_H = 80;        // 路面厚度
    const CAR_W = 60;
    const CAR_H = 30;
    const TICK_MAX_M = 500;   // 刻度範圍固定，不隨畫布寬度改變
    const TICK_STEP_M = 50;

    // ==========================================================================
    // E. 物理計算
    // ==========================================================================
    function calcPhysics(t) {
        const v = v0 + a * t;
        const x = v0 * t + 0.5 * a * t * t;
        return { v, x };
    }

    // ==========================================================================
    // F. 渲染
    // ==========================================================================
    function drawSim() {
        const view = PhysicsUtils.fitView(canvas, WORLD_W, WORLD_H);
        const W = view.W;
        const H = view.H;
        const roadYPx = view.toScreenY(ROAD_Y);
        const roadH = view.len(ROAD_H);
        const roadTop = roadYPx - roadH / 2;
        const startX = view.toScreenX(START_X);
        const carWidth = view.len(CAR_W);
        const carHeight = view.len(CAR_H);

        // 背景 — 天空漸層
        const skyGrad = ctx.createLinearGradient(0, 0, 0, roadYPx);
        skyGrad.addColorStop(0, '#e0f2fe');
        skyGrad.addColorStop(1, '#f0f9ff');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, roadYPx);

        // 背景 — 地面
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, roadYPx, W, H - roadYPx);

        // 道路
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, roadTop, W, roadH);

        // 道路中心虛線
        ctx.setLineDash([view.len(20), view.len(15)]);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = view.len(3);
        ctx.beginPath();
        ctx.moveTo(0, roadYPx);
        ctx.lineTo(W, roadYPx);
        ctx.stroke();
        ctx.setLineDash([]);

        // 刻度標記（固定 0–500 m，不隨畫布寬度改變）
        ctx.font = `600 ${view.len(11, 9)}px monospace`;
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        for (let m = 0; m <= TICK_MAX_M; m += TICK_STEP_M) {
            const px = view.toScreenX(START_X + m * U_PER_M);
            if (px > W - 20) break;
            ctx.beginPath();
            ctx.moveTo(px, roadTop + roadH);
            ctx.lineTo(px, roadTop + roadH + view.len(8));
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = view.len(1.5, 1);
            ctx.stroke();
            ctx.fillText(m + 'm', px, roadTop + roadH + view.len(20));
        }

        // 物體位置（世界單位 → 像素）
        const { v, x } = calcPhysics(simTime);
        const carCenterX = view.toScreenX(START_X + x * U_PER_M);
        const refY = roadYPx - carHeight / 2;

        // 如果物體超出畫面，不繪製
        if (carCenterX > -100 && carCenterX < W + 100) {
            // 軌跡（位移標記）
            if (isRunning || simTime > 0) {
                ctx.save();
                ctx.setLineDash([view.len(4), view.len(4)]);
                ctx.strokeStyle = 'rgba(37, 99, 235, 0.3)';
                ctx.lineWidth = view.len(1.5, 1);
                ctx.beginPath();
                ctx.moveTo(startX, refY - view.len(10));
                ctx.lineTo(carCenterX, refY - view.len(10));
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                // 位移箭頭
                if (Math.abs(x) > 0.5) {
                    drawArrow(ctx, startX, refY - view.len(25), carCenterX, refY - view.len(25), '#2563eb', view.len(2.5, 1.5), view);
                    // 位移標籤
                    ctx.save();
                    ctx.font = `700 ${view.len(13, 10)}px monospace`;
                    const label = `x = ${x.toFixed(1)} m`;
                    const m = ctx.measureText(label);
                    const lx = (startX + carCenterX) / 2 - m.width / 2;
                    ctx.fillStyle = 'rgba(37, 99, 235, 0.85)';
                    ctx.fillText(label, lx, refY - view.len(32));
                    ctx.restore();
                }
            }

            // 繪製小車
            drawCar(ctx, carCenterX, roadYPx, carWidth, carHeight, v, view);

            // 速度向量
            if (Math.abs(v) > 0.3) {
                const arrowLen = v * view.len(3);
                const arrowY = refY - view.len(5);
                const arrowStartX = carCenterX + (v > 0 ? carWidth / 2 : -carWidth / 2);
                drawArrow(ctx, arrowStartX, arrowY, arrowStartX + arrowLen, arrowY, '#ef4444', view.len(3, 2), view);

                // 速度標籤
                ctx.save();
                ctx.font = `700 ${view.len(13, 10)}px monospace`;
                const vLabel = `v = ${v.toFixed(1)} m/s`;
                const vm = ctx.measureText(vLabel);
                const vlX = arrowStartX + arrowLen + (v > 0 ? 8 : -vm.width - 8);
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.fillText(vLabel, vlX, arrowY - 5);
                ctx.restore();
            }
        }

        // 加速度標示（右上角）
        ctx.save();
        ctx.font = `700 ${view.len(14, 10)}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillStyle = a >= 0 ? '#22c55e' : '#ef4444';
        ctx.fillText(`a = ${a.toFixed(1)} m/s²`, W - 20, view.len(30, 22));
        ctx.restore();

        // 起點標示
        ctx.save();
        ctx.font = `600 ${view.len(11, 9)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.fillText('START', startX, roadTop - view.len(5));
        ctx.beginPath();
        ctx.moveTo(startX, roadTop - view.len(2));
        ctx.lineTo(startX, roadTop + roadH);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawCar(ctx, cx, roadY, w, h, v, view) {
        const x = cx - w / 2;
        const y = roadY - h / 2 - view.len(8);

        // 車身陰影
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = view.len(8);
        ctx.shadowOffsetY = view.len(4);

        // 車身主體
        const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
        bodyGrad.addColorStop(0, '#3b82f6');
        bodyGrad.addColorStop(1, '#1d4ed8');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, view.len(6));
        ctx.fill();
        ctx.restore();

        // 車窗
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        const winW = w * 0.35;
        const winH = h * 0.5;
        const winY = y + view.len(3);
        const winX1 = x + w * 0.15;
        const winX2 = x + w * 0.52;
        ctx.beginPath();
        ctx.roundRect(winX1, winY, winW, winH, view.len(3));
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(winX2, winY, winW * 0.8, winH, view.len(3));
        ctx.fill();

        // 車輪
        const wheelR = view.len(7);
        const wheelY = y + h;
        const wheelX1 = x + w * 0.2;
        const wheelX2 = x + w * 0.75;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(wheelX1, wheelY, wheelR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(wheelX2, wheelY, wheelR, 0, Math.PI * 2);
        ctx.fill();
        // 輪框
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(wheelX1, wheelY, view.len(3), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(wheelX2, wheelY, view.len(3), 0, Math.PI * 2);
        ctx.fill();

        // 方向指示（車頭箭頭）
        if (v > 0.5) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(x + w + view.len(2), y + h / 2);
            ctx.lineTo(x + w - view.len(6), y + view.len(4));
            ctx.lineTo(x + w - view.len(6), y + h - view.len(4));
            ctx.closePath();
            ctx.fill();
        } else if (v < -0.5) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(x - view.len(2), y + h / 2);
            ctx.lineTo(x + view.len(6), y + view.len(4));
            ctx.lineTo(x + view.len(6), y + h - view.len(4));
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, width, view) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(dy, dx);
        const headLen = Math.min(view.len(10), len * 0.3);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ==========================================================================
    // G. 主迴圈
    // ==========================================================================
    let frameCount = 0;

    function loop(ts) {
        if (!document.contains(guardEl)) return;

        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;

        if (isRunning && !isPaused) {
            simTime += dt;
            const { v, x } = calcPhysics(simTime);
            currentV = v;
            currentX = x;

            // 更新數據卡片
            if (cardTime) cardTime.innerText = simTime.toFixed(2);
            if (cardX) cardX.innerText = x.toFixed(1);
            if (cardV) cardV.innerText = v.toFixed(1);
            if (cardA) cardA.innerText = a.toFixed(1);

            // 更新圖表
            frameCount++;
            if (vChart && frameCount % 3 === 0) {
                const tLabel = simTime.toFixed(1);
                vChart.data.labels.push(tLabel);
                vChart.data.datasets[0].data.push(v);
                if (vChart.data.labels.length > maxChartPoints) {
                    vChart.data.labels.shift();
                    vChart.data.datasets[0].data.shift();
                }
                vChart.update('none');

                xChart.data.labels.push(tLabel);
                xChart.data.datasets[0].data.push(x);
                if (xChart.data.labels.length > maxChartPoints) {
                    xChart.data.labels.shift();
                    xChart.data.datasets[0].data.shift();
                }
                xChart.update('none');
            }
        }

        PhysicsUtils.beginFrame(ctx, canvas);
        drawSim();
        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // H. 按鈕事件
    // ==========================================================================
    const v0Slider = document.getElementById('v0Slider');
    const aSlider = document.getElementById('aSlider');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (v0Slider) {
        v0Slider.oninput = () => {
            v0 = parseFloat(v0Slider.value);
            document.getElementById('v0Val').textContent = v0;
            if (!isRunning) {
                currentV = v0;
                if (cardV) cardV.innerText = v0.toFixed(1);
            }
        };
    }
    if (aSlider) {
        aSlider.oninput = () => {
            a = parseFloat(aSlider.value);
            document.getElementById('aVal').textContent = a.toFixed(1);
            if (cardA) cardA.innerText = a.toFixed(1);
        };
    }

    if (startBtn) {
        startBtn.onclick = () => {
            v0 = parseFloat(v0Slider.value);
            a = parseFloat(aSlider.value);
            isRunning = true;
            isPaused = false;
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'block';
        };
    }

    if (pauseBtn) {
        pauseBtn.onclick = () => {
            isPaused = !isPaused;
            pauseBtn.textContent = isPaused ? '播放 PLAY' : '暫停 PAUSE';
            if (!isPaused) lastTimestamp = performance.now();
        };
    }

    if (resetBtn) {
        resetBtn.onclick = () => {
            isRunning = false;
            isPaused = false;
            simTime = 0;
            currentX = 0;
            currentV = parseFloat(v0Slider.value);
            frameCount = 0;

            startBtn.style.display = 'block';
            pauseBtn.style.display = 'none';
            pauseBtn.textContent = '暫停 PAUSE';

            if (cardTime) cardTime.innerText = '0.00';
            if (cardX) cardX.innerText = '0.0';
            if (cardV) cardV.innerText = currentV.toFixed(1);
            if (cardA) cardA.innerText = parseFloat(aSlider.value).toFixed(1);

            if (vChart) {
                vChart.data.labels = [];
                vChart.data.datasets[0].data = [];
                vChart.update();
            }
            if (xChart) {
                xChart.data.labels = [];
                xChart.data.datasets[0].data = [];
                xChart.update();
            }
        };
    }

    // ==========================================================================
    // I. 初始化
    // ==========================================================================
    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initAcceleration();
