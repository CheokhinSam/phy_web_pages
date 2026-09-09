/**
 * 💡 串聯電路與並聯電路 - 實驗腳本（重新設計版）
 * 含電子流動畫、電壓控制、長條圖比較、接點標示
 */
function initSeriesParallel() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    const R_BULB = 10.0;
    let voltage = 12.0;
    let mode = 'series';
    let numBulbs = 3;
    let isRunning = false;
    let simTime = 0;

    const numElectrons = 35;
    let seriesElectrons = [];
    let parallelElectrons = { main: [], branches: [] };

    function rebuildElectrons() {
        seriesElectrons = [];
        parallelElectrons = { main: [], branches: [] };
        if (mode === 'series') {
            for (let i = 0; i < numElectrons; i++) seriesElectrons.push(i / numElectrons);
        } else {
            const perBranch = Math.floor(numElectrons / (numBulbs + 1));
            const mainCount = numElectrons - perBranch * numBulbs;
            for (let i = 0; i < mainCount; i++) parallelElectrons.main.push(i / mainCount);
            for (let b = 0; b < numBulbs; b++) {
                parallelElectrons.branches[b] = [];
                for (let i = 0; i < perBranch; i++) parallelElectrons.branches[b].push(i / perBranch);
            }
        }
    }
    rebuildElectrons();

    function calc() {
        const R_total = mode === 'series' ? R_BULB * numBulbs : R_BULB / numBulbs;
        const I_total = voltage / R_total;
        const P_total = voltage * I_total;
        const P_bulb = mode === 'series' ? (I_total * I_total * R_BULB) : (voltage * voltage / R_BULB);
        const V_bulb = mode === 'series' ? I_total * R_BULB : voltage;
        const I_bulb = mode === 'series' ? I_total : voltage / R_BULB;
        return { R_total, I_total, P_total, P_bulb, V_bulb, I_bulb };
    }

    // ==========================================================================
    // B. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label><span>電路模式</span></label>
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button id="modeSeries" style="flex: 1; background: #000; color: #fff; border: none; padding: 8px; font-weight: 700; cursor: pointer; font-size: 0.85rem;">串聯 SERIES</button>
                    <button id="modeParallel" style="flex: 1; background: #fff; color: #000; border: 1px solid #000; padding: 8px; font-weight: 700; cursor: pointer; font-size: 0.85rem;">並聯 PARALLEL</button>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>燈泡數量</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="bulbVal" style="color: #2563eb;">3</span> 個
                    </span>
                </label>
                <div style="display: flex; gap: 8px; margin-top: 6px;">
                    <button id="bulbMinus" style="flex: 1; padding: 8px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 1.1rem;">−</button>
                    <button id="bulbPlus" style="flex: 1; padding: 8px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 1.1rem;">＋</button>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>電源電壓 <i>V</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vVal" style="color: #2563eb;">12.0</span> V
                    </span>
                </label>
                <input type="range" id="vSlider" min="3.0" max="12.0" step="0.5" value="12.0">
            </div>
            <div class="control-box" style="margin-top: 10px;">
                <button id="startBtn" style="width: 100%; background-color: #2563eb; color: #ffffff; margin-bottom: 8px;">開始 / START</button>
                <button id="pauseBtn" style="display: none; width: 100%; margin-bottom: 8px;">暫停 / PAUSE</button>
                <button id="resetBtn" style="width: 100%; background-color: #ffffff; color: #000000; border: 1px solid #000000;">重設 / RESET</button>
            </div>
        `;

        const modeSeries = document.getElementById('modeSeries');
        const modeParallel = document.getElementById('modeParallel');
        const bulbMinus = document.getElementById('bulbMinus');
        const bulbPlus = document.getElementById('bulbPlus');
        const bulbVal = document.getElementById('bulbVal');
        const vSlider = document.getElementById('vSlider');
        const vVal = document.getElementById('vVal');
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');

        function updateModeButtons() {
            if (mode === 'series') {
                modeSeries.style.background = '#000';
                modeSeries.style.color = '#fff';
                modeSeries.style.border = 'none';
                modeParallel.style.background = '#fff';
                modeParallel.style.color = '#000';
                modeParallel.style.border = '1px solid #000';
            } else {
                modeParallel.style.background = '#000';
                modeParallel.style.color = '#fff';
                modeParallel.style.border = 'none';
                modeSeries.style.background = '#fff';
                modeSeries.style.color = '#000';
                modeSeries.style.border = '1px solid #000';
            }
        }

        modeSeries.onclick = () => { mode = 'series'; updateModeButtons(); rebuildElectrons(); updateCards(); updateChart(); };
        modeParallel.onclick = () => { mode = 'parallel'; updateModeButtons(); rebuildElectrons(); updateCards(); updateChart(); };

        bulbMinus.onclick = () => {
            if (numBulbs > 1) { numBulbs--; bulbVal.innerText = numBulbs; rebuildElectrons(); updateCards(); updateChart(); }
        };
        bulbPlus.onclick = () => {
            if (numBulbs < 6) { numBulbs++; bulbVal.innerText = numBulbs; rebuildElectrons(); updateCards(); updateChart(); }
        };

        vSlider.addEventListener('input', () => {
            voltage = parseFloat(vSlider.value);
            vVal.innerText = voltage.toFixed(1);
            updateCards();
            updateChart();
        });

        if (startBtn) startBtn.onclick = () => {
            isRunning = true;
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'block';
        };
        if (pauseBtn) pauseBtn.onclick = () => {
            isRunning = !isRunning;
            pauseBtn.innerText = isRunning ? "暫停 / PAUSE" : "播放 / PLAY";
            pauseBtn.style.backgroundColor = isRunning ? "#000000" : "#2563eb";
        };
        if (resetBtn) resetBtn.onclick = () => {
            mode = 'series';
            numBulbs = 3;
            voltage = 12.0;
            isRunning = false;
            simTime = 0;
            vSlider.value = 12.0;
            vVal.innerText = '12.0';
            bulbVal.innerText = '3';
            updateModeButtons();
            rebuildElectrons();
            startBtn.style.display = 'block';
            pauseBtn.style.display = 'none';
            updateCards();
            updateChart();
        };
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card">
                <span class="card-label">總電阻 R_TOTAL</span>
                <div class="card-num-wrapper">
                    <span id="dashR" class="card-num">30.0</span>
                    <span class="card-unit">Ω</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">總電流 I_TOTAL</span>
                <div class="card-num-wrapper">
                    <span id="dashI" class="card-num">0.40</span>
                    <span class="card-unit">A</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">單燈功率 P_BULB</span>
                <div class="card-num-wrapper">
                    <span id="dashPb" class="card-num">1.60</span>
                    <span class="card-unit">W</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">總功率 P_TOTAL</span>
                <div class="card-num-wrapper">
                    <span id="dashPt" class="card-num">4.80</span>
                    <span class="card-unit">W</span>
                </div>
            </div>
        `;
    }

    const dashR = document.getElementById('dashR');
    const dashI = document.getElementById('dashI');
    const dashPb = document.getElementById('dashPb');
    const dashPt = document.getElementById('dashPt');

    function updateCards() {
        const d = calc();
        if (dashR) dashR.innerText = d.R_total.toFixed(1);
        if (dashI) dashI.innerText = d.I_total.toFixed(2);
        if (dashPb) dashPb.innerText = d.P_bulb.toFixed(2);
        if (dashPt) dashPt.innerText = d.P_total.toFixed(2);
    }

    // ==========================================================================
    // D. Chart.js 長條圖（數據與圖表 tab）
    // ==========================================================================
    const chartContainer = document.getElementById('chartContainer');
    let viChart = null;

    if (chartContainer) {
        chartContainer.style.display = 'block';
        const origTitle = chartContainer.querySelector('.pane-meta-title');
        if (origTitle) origTitle.style.display = 'none';
        const origWrapper = chartContainer.querySelector('.chart-wrapper');
        if (origWrapper) origWrapper.style.display = 'none';

        chartContainer.insertAdjacentHTML('beforeend', `
            <div class="pane-meta-title" style="margin-top: 30px; margin-bottom: 10px;">// BULB V &amp; I COMPARISON</div>
            <div class="chart-wrapper">
                <canvas id="viComparisonChart"></canvas>
            </div>
        `);

        setTimeout(() => {
            const canvasEl = document.getElementById('viComparisonChart');
            if (!canvasEl) return;
            viChart = new Chart(canvasEl, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        { label: '電壓 V (V)', data: [], backgroundColor: 'rgba(37,99,235,0.7)', borderColor: '#2563eb', borderWidth: 1 },
                        { label: '電流 I (A)', data: [], backgroundColor: 'rgba(245,158,11,0.7)', borderColor: '#f59e0b', borderWidth: 1 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: '數值 (V / A)', font: { family: 'monospace', weight: '700' } },
                            ticks: { font: { family: 'monospace' } }
                        },
                        x: {
                            ticks: { font: { family: 'monospace' } }
                        }
                    },
                    plugins: { legend: { labels: { font: { family: 'monospace' } } } }
                }
            });
            updateChart();
        }, 50);
    }

    function updateChart() {
        if (!viChart) return;
        const d = calc();
        const labels = [];
        const vData = [];
        const iData = [];
        for (let i = 0; i < numBulbs; i++) {
            labels.push('L' + (i + 1));
            vData.push(d.V_bulb);
            iData.push(d.I_bulb);
        }
        viChart.data.labels = labels;
        viChart.data.datasets[0].data = vData;
        viChart.data.datasets[1].data = iData;
        viChart.update('none');
    }

    // ==========================================================================
    // E. Canvas 渲染
    // ==========================================================================
    const guardEl = document.getElementById('bulbPlus');
    let lastTimestamp = performance.now();
    let animationFrameId;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    const maxPower = (12 * 12) / R_BULB;

    // ==========================================================================
    // F. 主迴路
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;
        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;
        if (isRunning) simTime += dt;

        PhysicsUtils.beginFrame(ctx, canvas);
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const d = calc();
        const brightness = Math.min(d.P_bulb / maxPower, 1.0);

        if (mode === 'series') {
            drawSeriesCircuit(ctx, W, H, numBulbs, brightness, d);
        } else {
            drawParallelCircuit(ctx, W, H, numBulbs, brightness, d);
        }

        if (isRunning) {
            if (mode === 'series') updateSeriesElectrons(dt, d);
            else updateParallelElectrons(dt, d);
        }
        drawElectrons(ctx);

        drawBarChart(ctx, W, H, numBulbs, d);
        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // G. 串聯電路
    // ==========================================================================
    function drawSeriesCircuit(c, W, H, n, brightness, d) {
        const padX = W * 0.12;
        const padTop = H * 0.08;
        const padBot = H * 0.30;
        const loopW = W - padX * 2;
        const loopH = H - padTop - padBot;
        const TL = { x: padX, y: padTop };
        const TR = { x: padX + loopW, y: padTop };
        const BR = { x: padX + loopW, y: padTop + loopH };
        const BL = { x: padX, y: padTop + loopH };
        const cx = (TL.x + TR.x) / 2;
        const cy = (TL.y + BL.y) / 2;

        // 導線
        c.strokeStyle = '#1e293b';
        c.lineWidth = 2.5;

        // 底部導線 + 電池
        const batX = cx;
        drawLine(c, BL.x, BL.y, batX - 25, BL.y);
        drawLine(c, batX + 25, BL.y, BR.x, BR.y);
        drawBattery(c, batX, BL.y, voltage);

        // 右側導線
        drawLine(c, BR.x, BR.y, TR.x, TR.y);

        // 左側導線（含安培計間隙）
        drawLine(c, BL.x, BL.y, BL.x, cy + 32);
        drawLine(c, BL.x, cy - 32, TL.x, TL.y);
        drawMeter(c, BL.x, cy, 'A', d.I_total.toFixed(2) + ' A', '#2563eb');

        // 頂部導線 + 燈泡
        const bulbAreaL = TL.x + loopW * 0.08;
        const bulbAreaR = TR.x - loopW * 0.08;
        const bulbSpacing = (bulbAreaR - bulbAreaL) / n;
        const bulbY = TL.y;

        drawLine(c, TL.x, TL.y, bulbAreaL, TL.y);

        for (let i = 0; i < n; i++) {
            const bx = bulbAreaL + (i + 0.5) * bulbSpacing;
            drawBulb(c, bx, bulbY, brightness, d.P_bulb);
            if (i < n - 1) {
                const nextX = bulbAreaL + (i + 1.5) * bulbSpacing;
                drawLine(c, bx + 18, bulbY, nextX - 18, bulbY);
            }
        }

        const lastBulbX = bulbAreaL + (n - 0.5) * bulbSpacing;
        drawLine(c, lastBulbX + 18, TL.y, TR.x, TR.y);

        // 電流方向箭頭
        drawCurrentArrow(c, cx, padTop + loopH * 0.25, Math.PI / 2);
        drawCurrentArrow(c, TR.x - loopW * 0.25, cy, 0);
        drawCurrentArrow(c, cx, padTop + loopH * 0.75, -Math.PI / 2);
        drawCurrentArrow(c, TL.x + loopW * 0.25, cy, Math.PI);

        // 標示
        c.font = '700 13px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#475569';
        c.fillText('I = ' + d.I_total.toFixed(2) + ' A（全部相同）', cx, TL.y - 16);
    }

    // ==========================================================================
    // H. 並聯電路
    // ==========================================================================
    function drawParallelCircuit(c, W, H, n, brightness, d) {
        const padX = W * 0.15;
        const padTop = H * 0.08;
        const padBot = H * 0.30;
        const loopH = H - padTop - padBot;
        const leftX = padX;
        const rightX = W - padX;
        const topY = padTop;
        const botY = padTop + loopH;
        const cx = (leftX + rightX) / 2;

        // 導線
        c.strokeStyle = '#1e293b';
        c.lineWidth = 2.5;

        // 底部導線 + 電池
        const batX = cx;
        drawLine(c, leftX, botY, batX - 25, botY);
        drawLine(c, batX + 25, botY, rightX, botY);
        drawBattery(c, batX, botY, voltage);

        // 右側垂直導線
        drawLine(c, rightX, botY, rightX, topY);

        // 左側垂直導線（完整，不含安培計）
        drawLine(c, leftX, botY, leftX, topY);

        // 頂部水平導線
        drawLine(c, leftX, topY, rightX, topY);

        // 安培計放在頂部導線左側（不阻礙支路）
        const ampX = leftX + (rightX - leftX) * 0.08;
        drawLine(c, leftX, topY, ampX - 32, topY);
        drawLine(c, ampX + 32, topY, rightX, topY);
        drawMeter(c, ampX, topY, 'A', d.I_total.toFixed(2) + ' A', '#2563eb');

        // 支路（佔據中間區域）
        const branchTop = topY + loopH * 0.18;
        const branchBot = botY - loopH * 0.10;
        const branchSpacing = (branchBot - branchTop) / n;

        for (let i = 0; i < n; i++) {
            const by = branchTop + (i + 0.5) * branchSpacing;
            drawLine(c, leftX, by, cx - 18, by);
            drawLine(c, cx + 18, by, rightX, by);
            drawBulb(c, cx, by, brightness, d.P_bulb);
            drawJunctionDot(c, leftX, by);
            drawJunctionDot(c, rightX, by);
        }

        // 支路電流箭頭
        for (let i = 0; i < n; i++) {
            const by = branchTop + (i + 0.5) * branchSpacing;
            drawCurrentArrow(c, cx - 50, by, 0);
        }

        // 主迴路箭頭
        drawCurrentArrow(c, leftX, botY - loopH * 0.2, -Math.PI / 2);
        drawCurrentArrow(c, rightX, topY + loopH * 0.2, -Math.PI / 2);

        // 標示
        c.font = '700 13px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#475569';
        c.fillText('V = ' + voltage.toFixed(1) + ' V（每個燈泡相同）', cx, topY - 16);
    }

    // ==========================================================================
    // I. 元件繪製輔助
    // ==========================================================================

    function drawLine(c, x1, y1, x2, y2) {
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
    }

    function drawBattery(c, x, y, v) {
        c.strokeStyle = '#1e293b';
        c.fillStyle = '#1e293b';
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - 22, y - 18); c.lineTo(x - 22, y + 18); c.stroke();
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(x - 10, y - 10); c.lineTo(x - 10, y + 10); c.stroke();
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(x + 6, y - 18); c.lineTo(x + 6, y + 18); c.stroke();
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(x + 18, y - 10); c.lineTo(x + 18, y + 10); c.stroke();

        c.font = '700 14px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('+', x - 32, y);
        c.fillText('−', x + 30, y);

        c.font = '700 13px monospace';
        c.fillStyle = '#475569';
        c.textBaseline = 'top';
        c.fillText(v.toFixed(1) + ' V', x, y + 22);
    }

    function drawMeter(c, x, y, label, reading, color) {
        const r = 30;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = '#ffffff';
        c.fill();
        c.strokeStyle = color;
        c.lineWidth = 2.5;
        c.stroke();

        c.font = '900 20px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = color;
        c.fillText(label, x, y - 5);

        c.font = '700 12px monospace';
        c.fillStyle = '#475569';
        c.fillText(reading, x, y + 14);
    }

    function drawBulb(c, x, y, brightness, power) {
        const r = 16;

        if (brightness > 0.01) {
            const glowR = r + 20 + brightness * 25;
            const glow = c.createRadialGradient(x, y, r * 0.5, x, y, glowR);
            const alpha = brightness * 0.5;
            glow.addColorStop(0, `rgba(251, 191, 36, ${alpha})`);
            glow.addColorStop(0.5, `rgba(251, 191, 36, ${alpha * 0.3})`);
            glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
            c.fillStyle = glow;
            c.beginPath();
            c.arc(x, y, glowR, 0, Math.PI * 2);
            c.fill();
        }

        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        const bulbColor = brightness > 0.01
            ? `rgb(${251}, ${Math.round(191 - brightness * 80)}, ${Math.round(36 + (1 - brightness) * 100)})`
            : '#e2e8f0';
        c.fillStyle = bulbColor;
        c.fill();
        c.strokeStyle = '#92400e';
        c.lineWidth = 2;
        c.stroke();

        c.strokeStyle = brightness > 0.3 ? '#fbbf24' : '#94a3b8';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x - 5, y + 6);
        c.lineTo(x - 3, y - 4);
        c.lineTo(x + 3, y + 4);
        c.lineTo(x + 5, y - 6);
        c.stroke();

        c.font = '600 9px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#475569';
        c.fillText(power.toFixed(1) + 'W', x, y + r + 12);
    }

    function drawJunctionDot(c, x, y) {
        c.beginPath();
        c.arc(x, y, 5, 0, Math.PI * 2);
        c.fillStyle = '#1e293b';
        c.fill();
    }

    function drawCurrentArrow(c, x, y, angle) {
        const size = 6;
        c.save();
        c.translate(x, y);
        c.rotate(angle);
        c.beginPath();
        c.moveTo(size, 0);
        c.lineTo(-size, -size * 0.6);
        c.lineTo(-size, size * 0.6);
        c.closePath();
        c.fillStyle = '#94a3b8';
        c.fill();
        c.restore();
    }

    // ==========================================================================
    // J. 電子動畫
    // ==========================================================================

    function drawElectron(c, x, y, i) {
        const glowR = 8 + Math.sin(simTime * 4 + i) * 2;
        const glow = c.createRadialGradient(x, y, 1, x, y, glowR);
        glow.addColorStop(0, 'rgba(37, 99, 235, 0.6)');
        glow.addColorStop(0.5, 'rgba(37, 99, 235, 0.2)');
        glow.addColorStop(1, 'rgba(37, 99, 235, 0)');
        c.fillStyle = glow;
        c.beginPath();
        c.arc(x, y, glowR, 0, Math.PI * 2);
        c.fill();

        c.fillStyle = '#2563eb';
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.fill();

        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.beginPath();
        c.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2);
        c.fill();
    }

    function getSeriesElectronPos(frac, TL, TR, BR, BL) {
        const loopW = TR.x - TL.x;
        const loopH = BR.y - TR.y;
        const totalLen = 2 * loopW + 2 * loopH;
        let d = frac * totalLen;
        if (d < loopW) return { x: TL.x + d, y: TL.y };
        if (d < loopW + loopH) return { x: TR.x, y: TR.y + (d - loopW) };
        if (d < 2 * loopW + loopH) return { x: BR.x - (d - loopW - loopH), y: BR.y };
        return { x: BL.x, y: BL.y - (d - 2 * loopW - loopH) };
    }

    function updateSeriesElectrons(dt, d) {
        const padX = canvas.cssWidth * 0.12;
        const padTop = canvas.cssHeight * 0.08;
        const padBot = canvas.cssHeight * 0.30;
        const loopW = canvas.cssWidth - padX * 2;
        const loopH = canvas.cssHeight - padTop - padBot;
        const totalLen = 2 * loopW + 2 * loopH;
        const TL = { x: padX, y: padTop };
        const TR = { x: padX + loopW, y: padTop };
        const BR = { x: padX + loopW, y: padTop + loopH };
        const BL = { x: padX, y: padTop + loopH };

        const speedFactor = 150;
        const moveStep = (d.I_total * speedFactor * dt) / totalLen;
        for (let i = 0; i < seriesElectrons.length; i++) {
            seriesElectrons[i] = (seriesElectrons[i] + moveStep) % 1.0;
        }
    }

    function updateParallelElectrons(dt, d) {
        const padX = canvas.cssWidth * 0.15;
        const padTop = canvas.cssHeight * 0.08;
        const padBot = canvas.cssHeight * 0.30;
        const loopH = canvas.cssHeight - padTop - padBot;
        const leftX = padX;
        const rightX = canvas.cssWidth - padX;
        const topY = padTop;
        const botY = padTop + loopH;
        const TL = { x: leftX, y: topY };
        const TR = { x: rightX, y: topY };
        const BR = { x: rightX, y: botY };
        const BL = { x: leftX, y: botY };
        const totalLen = 2 * (rightX - leftX) + 2 * loopH;
        const branchWidth = rightX - leftX;

        const speedFactor = 150;

        // 主迴路
        const mainStep = (d.I_total * speedFactor * dt) / totalLen;
        for (let i = 0; i < parallelElectrons.main.length; i++) {
            parallelElectrons.main[i] = (parallelElectrons.main[i] + mainStep) % 1.0;
        }

        // 各支路
        const branchStep = (d.I_bulb * speedFactor * dt) / branchWidth;
        for (let b = 0; b < parallelElectrons.branches.length; b++) {
            for (let i = 0; i < parallelElectrons.branches[b].length; i++) {
                parallelElectrons.branches[b][i] = (parallelElectrons.branches[b][i] + branchStep) % 1.0;
            }
        }
    }

    function drawElectrons(c) {
        if (mode === 'series') {
            const padX = canvas.cssWidth * 0.12;
            const padTop = canvas.cssHeight * 0.08;
            const padBot = canvas.cssHeight * 0.30;
            const loopW = canvas.cssWidth - padX * 2;
            const loopH = canvas.cssHeight - padTop - padBot;
            const TL = { x: padX, y: padTop };
            const TR = { x: padX + loopW, y: padTop };
            const BR = { x: padX + loopW, y: padTop + loopH };
            const BL = { x: padX, y: padTop + loopH };

            for (let i = 0; i < seriesElectrons.length; i++) {
                const pos = getSeriesElectronPos(seriesElectrons[i], TL, TR, BR, BL);
                drawElectron(c, pos.x, pos.y, i);
            }
        } else {
            const padX = canvas.cssWidth * 0.15;
            const padTop = canvas.cssHeight * 0.08;
            const padBot = canvas.cssHeight * 0.30;
            const loopH = canvas.cssHeight - padTop - padBot;
            const leftX = padX;
            const rightX = canvas.cssWidth - padX;
            const topY = padTop;
            const botY = padTop + loopH;
            const TL = { x: leftX, y: topY };
            const TR = { x: rightX, y: topY };
            const BR = { x: rightX, y: botY };
            const BL = { x: leftX, y: botY };

            // 主迴路電子
            for (let i = 0; i < parallelElectrons.main.length; i++) {
                const pos = getSeriesElectronPos(parallelElectrons.main[i], TL, TR, BR, BL);
                drawElectron(c, pos.x, pos.y, i);
            }

            // 支路電子
            const branchTop = topY + loopH * 0.12;
            const branchBot = botY - loopH * 0.12;
            const branchSpacing = (branchBot - branchTop) / numBulbs;
            let electronIdx = 100;
            for (let b = 0; b < parallelElectrons.branches.length; b++) {
                const by = branchTop + (b + 0.5) * branchSpacing;
                for (let i = 0; i < parallelElectrons.branches[b].length; i++) {
                    const frac = parallelElectrons.branches[b][i];
                    const ex = leftX + frac * (rightX - leftX);
                    drawElectron(c, ex, by, electronIdx++);
                }
            }
        }
    }

    // ==========================================================================
    // K. Canvas 底部長條圖
    // ==========================================================================
    function drawBarChart(c, W, H, n, d) {
        const chartTop = H * 0.76;
        const chartBot = H * 0.94;
        const chartLeft = W * 0.12;
        const chartRight = W * 0.88;
        const chartH = chartBot - chartTop;
        const chartW = chartRight - chartLeft;

        // 分隔線
        c.strokeStyle = '#e2e8f0';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(chartLeft, chartTop - 10);
        c.lineTo(chartRight, chartTop - 10);
        c.stroke();

        // 標題
        c.font = '700 12px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#475569';
        c.fillText('各燈泡電壓與電流比較', W / 2, chartTop - 16);

        const barGroupWidth = chartW / n;
        const barWidth = barGroupWidth * 0.28;
        const maxV = voltage;
        const maxI = d.I_total * 1.2 || 1;

        for (let i = 0; i < n; i++) {
            const bx = chartLeft + (i + 0.5) * barGroupWidth;

            // 電壓長條（藍）
            const vHeight = (d.V_bulb / maxV) * chartH * 0.85;
            c.fillStyle = '#2563eb';
            c.fillRect(bx - barWidth - 2, chartBot - vHeight, barWidth, vHeight);

            // 電流長條（琥珀）
            const iHeight = (d.I_bulb / maxI) * chartH * 0.85;
            c.fillStyle = '#f59e0b';
            c.fillRect(bx + 2, chartBot - iHeight, barWidth, iHeight);

            // 標籤
            c.font = '600 10px monospace';
            c.textAlign = 'center';
            c.fillStyle = '#64748b';
            c.textBaseline = 'top';
            c.fillText('L' + (i + 1), bx, chartBot + 4);
        }

        // 圖例
        c.textBaseline = 'middle';
        c.fillStyle = '#2563eb';
        c.fillRect(chartLeft, chartBot + 20, 10, 10);
        c.fillStyle = '#475569';
        c.font = '600 10px monospace';
        c.textAlign = 'left';
        c.fillText('電壓 V (V)', chartLeft + 14, chartBot + 25);

        c.fillStyle = '#f59e0b';
        c.fillRect(chartRight - 90, chartBot + 20, 10, 10);
        c.fillStyle = '#475569';
        c.fillText('電流 I (A)', chartRight - 76, chartBot + 25);
    }

    requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initSeriesParallel();
