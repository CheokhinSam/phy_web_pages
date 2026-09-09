/**
 * ⚡ 歐姆定律 - 實驗腳本
 * 標準電路：電池（下）→ 安培計（左）→ 定值電阻 + 滑動變阻器（上）→ 伏特計並聯
 */
function initOhmsLaw() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    let voltage = 5.0;
    let rheostatR = 10.0;
    const fixedR = 10.0; // 定值電阻固定 10Ω
    let totalR, current;
    let isRunning = false;
    let simTime = 0;

    function calcCurrent() {
        totalR = fixedR + rheostatR;
        current = voltage / totalR;
    }
    calcCurrent();

    // ==========================================================================
    // A. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>電源電壓 <i>V</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vVal" style="color: #2563eb;">5.0</span> V
                    </span>
                </label>
                <input type="range" id="vSlider" min="1.0" max="15.0" step="0.5" value="5.0">
            </div>
            <div class="control-box">
                <label>
                    <span>滑動變阻器 <i>R</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="rVal" style="color: #2563eb;">10.0</span> Ω
                    </span>
                </label>
                <input type="range" id="rSlider" min="0.0" max="40.0" step="0.5" value="10.0">
            </div>
            <div class="control-box" style="margin-top: 10px;">
                <button id="startBtn" style="width: 100%; background-color: #2563eb; color: #ffffff; margin-bottom: 8px;">開始 / START</button>
                <button id="pauseBtn" style="display: none; width: 100%; margin-bottom: 8px;">暫停 / PAUSE</button>
                <button id="resetBtn" style="width: 100%; background-color: #ffffff; color: #000000; border: 1px solid #000000;">重設 / RESET</button>
            </div>
        `;

        const vSlider = document.getElementById('vSlider');
        const rSlider = document.getElementById('rSlider');
        const vVal = document.getElementById('vVal');
        const rVal = document.getElementById('rVal');
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');

        function updateValues() {
            voltage = parseFloat(vSlider.value);
            rheostatR = parseFloat(rSlider.value);
            calcCurrent();
            vVal.innerText = voltage.toFixed(1);
            rVal.innerText = rheostatR.toFixed(1);
            updateCards();
            updateVIChart();
        }

        vSlider.addEventListener('input', updateValues);
        rSlider.addEventListener('input', updateValues);

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
            voltage = 5.0;
            rheostatR = 10.0;
            calcCurrent();
            simTime = 0;
            isRunning = false;
            vSlider.value = 5.0;
            rSlider.value = 10.0;
            vVal.innerText = '5.0';
            rVal.innerText = '10.0';
            electrons = [];
            for (let i = 0; i < numElectrons; i++) electrons.push(i / numElectrons);
            startBtn.style.display = 'block';
            pauseBtn.style.display = 'none';
            viChartData = [];
            if (viChart) {
                viChart.data.datasets[0].data = [];
                viChart.update();
            }
            updateCards();
        };
    }

    // ==========================================================================
    // B. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(160px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card">
                <span class="card-label">電源電壓 VOLTAGE</span>
                <div class="card-num-wrapper">
                    <span id="dashV" class="card-num">5.0</span>
                    <span class="card-unit">V</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">總電阻 TOTAL_R</span>
                <div class="card-num-wrapper">
                    <span id="dashR" class="card-num">20.0</span>
                    <span class="card-unit">Ω</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">電路電流 CURRENT</span>
                <div class="card-num-wrapper">
                    <span id="dashI" class="card-num">0.25</span>
                    <span class="card-unit">A</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">電功率 POWER</span>
                <div class="card-num-wrapper">
                    <span id="dashP" class="card-num">1.25</span>
                    <span class="card-unit">W</span>
                </div>
            </div>
        `;
    }

    const dashV = document.getElementById('dashV');
    const dashR = document.getElementById('dashR');
    const dashI = document.getElementById('dashI');
    const dashP = document.getElementById('dashP');

    function updateCards() {
        if (dashV) dashV.innerText = voltage.toFixed(1);
        if (dashR) dashR.innerText = totalR.toFixed(1);
        if (dashI) dashI.innerText = current.toFixed(2);
        if (dashP) dashP.innerText = (voltage * current).toFixed(2);
    }

    // ==========================================================================
    // B2. V-I 特性曲線
    // ==========================================================================
    const chartContainer = document.getElementById('chartContainer');
    let viChart = null;
    let viChartData = [];

    if (chartContainer) {
        chartContainer.style.display = 'block';
        const origTitle = chartContainer.querySelector('.pane-meta-title');
        if (origTitle) origTitle.style.display = 'none';
        const origWrapper = chartContainer.querySelector('.chart-wrapper');
        if (origWrapper) origWrapper.style.display = 'none';

        chartContainer.insertAdjacentHTML('beforeend', `
            <div class="pane-meta-title" style="margin-top: 30px; margin-bottom: 10px;">// V-I CHARACTERISTIC</div>
            <div class="chart-wrapper">
                <canvas id="viChart"></canvas>
            </div>
        `);

        setTimeout(() => {
            const canvasEl = document.getElementById('viChart');
            if (!canvasEl) return;
            viChart = new Chart(canvasEl, {
                type: 'scatter',
                data: {
                    datasets: [{
                        data: [],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37,99,235,0.6)',
                        pointRadius: 4,
                        showLine: true,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    scales: {
                        x: {
                            type: 'linear',
                            title: { display: true, text: '電壓 V (V)', font: { family: 'monospace', weight: '700' } },
                            min: 0, max: 16,
                            ticks: { font: { family: 'monospace' } }
                        },
                        y: {
                            title: { display: true, text: '電流 I (A)', font: { family: 'monospace', weight: '700' } },
                            min: 0,
                            ticks: { font: { family: 'monospace' } }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
            drawVIReferenceLine();
        }, 50);
    }

    function drawVIReferenceLine() {
        if (!viChart) return;
        const points = [];
        for (let v = 0; v <= 15; v += 0.5) {
            points.push({ x: v, y: v / totalR });
        }
        viChart.data.datasets[0].data = points;
        viChart.update('none');
    }

    function updateVIChart() {
        drawVIReferenceLine();
    }

    // ==========================================================================
    // C. 電子動畫
    // ==========================================================================
    const guardEl = document.getElementById('vSlider');
    let electrons = [];
    const numElectrons = 35;
    for (let i = 0; i < numElectrons; i++) electrons.push(i / numElectrons);

    let lastTimestamp = performance.now();
    let animationFrameId;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // D. 渲染主循環
    // ==========================================================================
    function loop(currentTimestamp) {
        if (!document.contains(guardEl)) return;

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.1) dt = 0.1;

        if (isRunning) simTime += dt;

        PhysicsUtils.beginFrame(ctx, canvas);

        // ---- 電路佈局 ----
        const cx = canvas.cssWidth / 2;
        const cy = canvas.cssHeight / 2;
        const loopW = canvas.cssWidth * 0.65;
        const loopH = canvas.cssHeight * 0.55;

        // 四個角座標（順時針：左上→右上→右下→左下）
        const TL = { x: cx - loopW / 2, y: cy - loopH / 2 };
        const TR = { x: cx + loopW / 2, y: cy - loopH / 2 };
        const BR = { x: cx + loopW / 2, y: cy + loopH / 2 };
        const BL = { x: cx - loopW / 2, y: cy + loopH / 2 };

        // 1. 主電路導線
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;

        // 左側：BL → TL（底部左到頂部左）
        ctx.beginPath();
        ctx.moveTo(BL.x, BL.y);
        ctx.lineTo(TL.x, TL.y);
        ctx.stroke();

        // 頂部左半：TL → 電阻左端
        const resLeftX = cx - loopW * 0.2;
        const resRightX = cx + loopW * 0.05;
        ctx.beginPath();
        ctx.moveTo(TL.x, TL.y);
        ctx.lineTo(resLeftX, TL.y);
        ctx.stroke();

        // 頂部中間（電阻）
        drawResistor(ctx, resLeftX, TL.y, resRightX - resLeftX, fixedR);

        // 頂部：電阻右端 → 變阻器左端
        const rheoLeftX = cx + loopW * 0.12;
        const rheoRightX = cx + loopW * 0.35;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(resRightX, TL.y);
        ctx.lineTo(rheoLeftX, TL.y);
        ctx.stroke();

        // 頂部右半（滑動變阻器）
        drawRheostat(ctx, rheoLeftX, TL.y, rheoRightX - rheoLeftX, rheostatR);

        // 頂部：變阻器右端 → TR
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(rheoRightX, TL.y);
        ctx.lineTo(TR.x, TR.y);
        ctx.stroke();

        // 右側：TR → BR
        ctx.beginPath();
        ctx.moveTo(TR.x, TR.y);
        ctx.lineTo(BR.x, BR.y);
        ctx.stroke();

        // 底部：BR → BL（中間是電池）
        const batLeftX = cx - 25;
        const batRightX = cx + 25;
        ctx.beginPath();
        ctx.moveTo(BR.x, BR.y);
        ctx.lineTo(batRightX, BR.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(batLeftX, BR.y);
        ctx.lineTo(BL.x, BL.y);
        ctx.stroke();

        // 2. 安培計（左側中點）
        const ampY = cy;
        drawMeter(ctx, BL.x, ampY, 'A', current.toFixed(2) + ' A', '#2563eb');

        // 3. 電池（底部中央）
        drawBattery(ctx, cx, BR.y, voltage);

        // 4. 伏特計（並聯在定值電阻上方）
        const vmCenterX = (resLeftX + resRightX) / 2;
        const vmY = TL.y - 60;
        // 連接線
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(resLeftX, TL.y);
        ctx.lineTo(resLeftX, vmY);
        ctx.lineTo(resRightX, vmY);
        ctx.lineTo(resRightX, TL.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // 伏特計圓
        const vmV = current * fixedR;
        drawMeter(ctx, vmCenterX, vmY, 'V', vmV.toFixed(2) + ' V', '#f59e0b');

        // 5. 電子流（沿主迴路）
        const totalLen = (loopW + loopH) * 2;
        const speedFactor = 150;
        const moveStep = isRunning ? (current * speedFactor * dt) / totalLen : 0;

        for (let i = 0; i < electrons.length; i++) {
            if (isRunning) electrons[i] = (electrons[i] + moveStep) % 1.0;

            let d = electrons[i] * totalLen;
            let eX, eY;

            if (d < loopW) {
                // 頂部：左→右
                eX = TL.x + d;
                eY = TL.y;
            } else if (d < loopW + loopH) {
                // 右側：上→下
                eX = TR.x;
                eY = TR.y + (d - loopW);
            } else if (d < loopW * 2 + loopH) {
                // 底部：右→左
                eX = BR.x - (d - loopW - loopH);
                eY = BR.y;
            } else {
                // 左側：下→上
                eX = BL.x;
                eY = BL.y - (d - loopW * 2 - loopH);
            }

            // 電子光暈
            const glowR = 6 + Math.sin(simTime * 4 + i) * 1;
            const glow = ctx.createRadialGradient(eX, eY, 1, eX, eY, glowR);
            glow.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
            glow.addColorStop(1, 'rgba(37, 99, 235, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(eX, eY, glowR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#2563eb';
            ctx.beginPath();
            ctx.arc(eX, eY, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.arc(eX - 1, eY - 1, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        updateCards();
        animationFrameId = requestAnimationFrame(loop);
    }

    // ---- 繪製元件輔助函數（標準電路符號） ----

    // 電阻：鋸齒符號 (IEEE/ANSI)
    function drawResistor(c, x, y, w, r) {
        const h = 16;
        const peaks = 7;
        const segW = w / peaks;
        c.strokeStyle = '#1e293b';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + segW * 0.25, y);
        for (let i = 0; i < peaks; i++) {
            const px = x + segW * 0.25 + i * segW;
            c.lineTo(px + segW * 0.25, y - h);
            c.lineTo(px + segW * 0.75, y + h);
        }
        c.lineTo(x + w - segW * 0.25, y);
        c.lineTo(x + w, y);
        c.stroke();

        // 標籤
        c.font = '700 14px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#475569';
        c.fillText('R = ' + r.toFixed(0) + ' Ω', x + w / 2, y - 28);
    }

    // 滑動變阻器：鋸齒 + 箭頭
    function drawRheostat(c, x, y, w, r) {
        const h = 16;
        const peaks = 7;
        const segW = w / peaks;
        c.strokeStyle = '#1e293b';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + segW * 0.25, y);
        for (let i = 0; i < peaks; i++) {
            const px = x + segW * 0.25 + i * segW;
            c.lineTo(px + segW * 0.25, y - h);
            c.lineTo(px + segW * 0.75, y + h);
        }
        c.lineTo(x + w - segW * 0.25, y);
        c.lineTo(x + w, y);
        c.stroke();

        // 滑動箭頭（從上方斜插入）
        const sliderFrac = Math.min(r / 40, 1);
        const arrowX = x + segW * 0.25 + sliderFrac * (w - segW * 0.5);
        c.strokeStyle = '#dc2626';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(arrowX - 18, y - h - 18);
        c.lineTo(arrowX, y);
        c.stroke();
        // 箭頭尖端
        c.fillStyle = '#dc2626';
        c.beginPath();
        c.moveTo(arrowX, y + 3);
        c.lineTo(arrowX - 8, y - 8);
        c.lineTo(arrowX + 8, y - 8);
        c.closePath();
        c.fill();

        // 標籤
        c.font = '700 14px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#475569';
        c.fillText('R = ' + r.toFixed(1) + ' Ω', x + w / 2, y - 36);
    }

    // 電表：圓圈 + 標籤 + 讀數
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

    // 電池：長短平行線符號
    function drawBattery(c, x, y, v) {
        c.strokeStyle = '#1e293b';
        c.fillStyle = '#1e293b';
        // 長線（正極）
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - 22, y - 18);
        c.lineTo(x - 22, y + 18);
        c.stroke();
        // 短線（負極）
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(x - 10, y - 10);
        c.lineTo(x - 10, y + 10);
        c.stroke();
        // 第二組
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x + 6, y - 18);
        c.lineTo(x + 6, y + 18);
        c.stroke();
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(x + 18, y - 10);
        c.lineTo(x + 18, y + 10);
        c.stroke();

        // + - 標記
        c.font = '700 14px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('+', x - 32, y);
        c.fillText('−', x + 30, y);

        // 電壓標籤
        c.font = '700 13px monospace';
        c.fillStyle = '#475569';
        c.fillText(v.toFixed(1) + ' V', x, y + 30);
    }

    animationFrameId = requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initOhmsLaw();
