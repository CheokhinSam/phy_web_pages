function initProjectile() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return; 
    const ctx = canvas.getContext('2d');
    
    const ctrlPanel = document.getElementById('controlPanel');

// 1. 動態注入左側操作面板（已修正 Flex 佈局下的文字與單位間距）
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>初速度 <i>v</i>₀</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vVal" style="color: #2563eb;">30</span> m/s
                    </span>
                </label>
                <input type="range" id="vSlider" min="10" max="50" value="30">
            </div>
            <div class="control-box">
                <label>
                    <span>發射角度 <i>θ</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">30</span>°
                    </span>
                </label>
                <input type="range" id="aSlider" min="-60" max="90" value="30">
            </div>
            <div class="control-box">
                <label>
                    <span>初始高度 <i>h</i>₀</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="hVal" style="color: #2563eb;">15</span> m
                    </span>
                </label>
                <input type="range" id="hSlider" min="0" max="40" value="15">
            </div>
            <div class="control-box" style="gap: 10px;">
                <button id="fireBtn">發射 / FIRE</button>
                <button id="pauseBtn" style="background-color: #ffffff; color: #000000; border: 1px solid #000000; margin-top: 10px;">暫停 / PAUSE</button>
                <button id="rstBtn" style="background-color: #ffffff; color: #000000; border: 1px solid #000000; margin-top: 10px;">重設 / RESET</button>
            </div>
        `;
    }

    // 💡 2. 開啟並初始化右側 Chart.js 圖表 (此實驗有圖表)
    const chartContainer = document.getElementById('chartContainer');
    const chartCtx = document.getElementById('realtimeChart');
    let myChart = null;
    let vxChart = null;
    let vyChart = null;

    if (chartContainer && chartCtx) {
        chartContainer.style.display = 'block'; // 顯示圖表區

        // 高度-時間圖
        myChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '高度 y (m)',
                    data: [],
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '時間 (s)', font: { weight: 'bold' } }, grid: { display: false } },
                    y: { title: { display: true, text: '高度 y (m)', font: { weight: 'bold' } }, min: 0 }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 動態建立 vx-t 和 vy-t 圖表容器 + 放大按鈕（最下方）
        let extraChartsHTML = `
            <div style="margin-top: 30px; margin-bottom: 10px;">
                <div class="pane-meta-title">// VELOCITY GRAPH</div>
            </div>
            <div class="chart-wrapper">
                <canvas id="vxChart"></canvas>
            </div>
            <div class="chart-wrapper" style="margin-top: 20px;">
                <canvas id="vyChart"></canvas>
            </div>
            <button id="zoomChartBtn" style="display: block; width: 100%; margin-top: 20px; padding: 10px; background: #000000; color: #ffffff; border: none; font-weight: 700; font-size: 0.85rem; cursor: pointer; letter-spacing: 1px;">放大圖表 / EXPAND</button>
        `;
        chartContainer.insertAdjacentHTML('beforeend', extraChartsHTML);

        // 放大/縮小圖表
        let isExpanded = false;
        document.getElementById('zoomChartBtn').addEventListener('click', () => {
            isExpanded = !isExpanded;
            let btn = document.getElementById('zoomChartBtn');
            let wrappers = chartContainer.querySelectorAll('.chart-wrapper');
            if (isExpanded) {
                btn.innerText = '縮小圖表 / COLLAPSE';
                chartContainer.style.position = 'fixed';
                chartContainer.style.top = '0';
                chartContainer.style.left = '0';
                chartContainer.style.width = '100vw';
                chartContainer.style.height = '100vh';
                chartContainer.style.zIndex = '9999';
                chartContainer.style.background = '#ffffff';
                chartContainer.style.padding = '30px';
                chartContainer.style.overflow = 'auto';
                wrappers.forEach(w => w.style.height = '40vh');
            } else {
                btn.innerText = '放大圖表 / EXPAND';
                chartContainer.style.position = '';
                chartContainer.style.top = '';
                chartContainer.style.left = '';
                chartContainer.style.width = '';
                chartContainer.style.height = '';
                chartContainer.style.zIndex = '';
                chartContainer.style.background = '';
                chartContainer.style.padding = '';
                chartContainer.style.overflow = '';
                wrappers.forEach(w => w.style.height = '');
            }
            // 重繪圖表以適應新尺寸
            setTimeout(() => {
                if (myChart) myChart.resize();
                if (vxChart) vxChart.resize();
                if (vyChart) vyChart.resize();
            }, 100);
        });

        // 水平速度-時間圖
        vxChart = new Chart(document.getElementById('vxChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'vx (m/s)',
                    data: [],
                    borderColor: '#22c55e',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '時間 (s)', font: { weight: 'bold' } }, grid: { display: false } },
                    y: { title: { display: true, text: 'vx (m/s)', font: { weight: 'bold', color: '#22c55e' } } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 垂直速度-時間圖
        vyChart = new Chart(document.getElementById('vyChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'vy (m/s)',
                    data: [],
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '時間 (s)', font: { weight: 'bold' } }, grid: { display: false } },
                    y: { title: { display: true, text: 'vy (m/s)', font: { weight: 'bold', color: '#8b5cf6' } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    const resizeCanvas = PhysicsUtils.setupResize(canvas);
    window.addEventListener('resize', () => { resetSim(); });

    const vSlider = document.getElementById('vSlider');
    const aSlider = document.getElementById('aSlider');
    const hSlider = document.getElementById('hSlider');
    const vVal = document.getElementById('vVal');
    const aVal = document.getElementById('aVal');
    const hVal = document.getElementById('hVal');
    const fireBtn = document.getElementById('fireBtn');
    const rstBtn = document.getElementById('rstBtn');

    if (vSlider) vSlider.oninput = () => vVal.innerText = vSlider.value;
    if (aSlider) aSlider.oninput = () => aVal.innerText = aSlider.value;
    if (hSlider) hSlider.oninput = () => { hVal.innerText = hSlider.value; resetSim(); };

    const g = 9.81;
    const meterToPixel = 8; 
    let simTime = 0;
    let initV = 0;
    let initH = 0;
    let angleRad = 0;
    let isMoving = false;
    let isPaused = false;

    let peakHeight_m = 0;
    let currentX_m = 0;
    let currentY_m = 0;

    let startX_px = 60;
    let startY_px = canvas.cssHeight - 60;
    let path = [];
    let lastTimestamp = 0;
    let frameCount = 0;
    const maxChartPoints = 500;

    // 注入專屬拋體運動的數據卡片
    const dataGrid = document.getElementById('dataCardsGrid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(160px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card">
                <span class="card-label">飛行時間 TIME</span>
                <div class="card-num-wrapper"><span id="cardTime" class="card-num">0.00</span><span class="card-unit">s</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">水平位置 POS_X</span>
                <div class="card-num-wrapper"><span id="cardX" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">當前高度 POS_Y</span>
                <div class="card-num-wrapper"><span id="cardY" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">最高高度 MAX_H</span>
                <div class="card-num-wrapper"><span id="cardMaxH" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
            <div class="data-card highlight" style="grid-column: span 2;">
                <span class="card-label">最終水平射程 RANGE_R</span>
                <div class="card-num-wrapper"><span id="cardRange" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
        `;
    }

    const cardTime = document.getElementById('cardTime');
    const cardX = document.getElementById('cardX');
    const cardY = document.getElementById('cardY');
    const cardMaxH = document.getElementById('cardMaxH');
    const cardRange = document.getElementById('cardRange');

    function updateCards(t, x, y, hMax, r) {
        if (cardTime) cardTime.innerText = t.toFixed(2);
        if (cardX) cardX.innerText = x.toFixed(2);
        if (cardY) cardY.innerText = y.toFixed(2);
        if (cardMaxH) cardMaxH.innerText = hMax.toFixed(2);
        if (cardRange) cardRange.innerText = r.toFixed(2);
    }

    function resetSim() {
        isMoving = false;
        isPaused = false;
        simTime = 0;
        path = [];
        startY_px = canvas.cssHeight - 60; 
        initH = parseFloat(hSlider.value);
        
        peakHeight_m = initH;
        currentX_m = 0;
        currentY_m = initH;
        
        updateCards(0, 0, initH, initH, 0);

        // 清空圖表數據
        if (myChart) {
            myChart.data.labels = [0];
            myChart.data.datasets[0].data = [initH];
            myChart.update();
        }
        if (vxChart) {
            vxChart.data.labels = [0];
            vxChart.data.datasets[0].data = [initV * Math.cos(angleRad)];
            vxChart.update();
        }
        if (vyChart) {
            vyChart.data.labels = [0];
            vyChart.data.datasets[0].data = [initV * Math.sin(angleRad)];
            vyChart.update();
        }

        let ballY_px = startY_px - (initH * meterToPixel);
        draw(startX_px, ballY_px, 0, 0);
    }

    function fire() {
        if (isMoving) return;
        simTime = 0;
        path = [];
        initV = parseFloat(vSlider.value);
        initH = parseFloat(hSlider.value);
        angleRad = parseFloat(aSlider.value) * Math.PI / 180;
        isMoving = true;
        peakHeight_m = initH;

        if (myChart) {
            myChart.data.labels = [];
            myChart.data.datasets[0].data = [];
        }
        if (vxChart) {
            vxChart.data.labels = [];
            vxChart.data.datasets[0].data = [];
        }
        if (vyChart) {
            vyChart.data.labels = [];
            vyChart.data.datasets[0].data = [];
        }

        lastTimestamp = performance.now();
        animationFrameId = requestAnimationFrame(loop);
    }

    function loop(currentTimestamp) {
        if (!document.contains(guardEl)) return;
        if (!isMoving || isPaused) {
            animationFrameId = requestAnimationFrame(loop);
            return;
        }

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.1) dt = 0.1; 

        simTime += dt;

        currentX_m = initV * Math.cos(angleRad) * simTime;
        currentY_m = initH + (initV * Math.sin(angleRad) * simTime) - (0.5 * g * simTime * simTime);

        if (currentY_m > peakHeight_m) peakHeight_m = currentY_m;

        let currentX_px = startX_px + (currentX_m * meterToPixel);
        let currentY_px = startY_px - (currentY_m * meterToPixel);

        if (currentY_m <= 0 && simTime > 0.02) {
            currentY_px = startY_px;
            currentY_m = 0;
            let t_land = (initV * Math.sin(angleRad) + Math.sqrt(Math.pow(initV * Math.sin(angleRad), 2) + 2 * g * initH)) / g;
            currentX_m = initV * Math.cos(angleRad) * t_land;
            isMoving = false;
        }

        updateCards(simTime, currentX_m, currentY_m, peakHeight_m, isMoving ? 0 : currentX_m);

        // 💡 即時將數據推進 Chart.js 並更新圖表（每 10 幀更新一次）
        frameCount++;
        let tLabel = simTime.toFixed(2);
        let vxNow = initV * Math.cos(angleRad);
        let vyNow = initV * Math.sin(angleRad) - g * simTime;

        if (myChart) {
            myChart.data.labels.push(tLabel);
            myChart.data.datasets[0].data.push(currentY_m);
            if (myChart.data.labels.length > maxChartPoints) {
                myChart.data.labels.shift();
                myChart.data.datasets[0].data.shift();
            }
        }
        if (vxChart) {
            vxChart.data.labels.push(tLabel);
            vxChart.data.datasets[0].data.push(vxNow);
            if (vxChart.data.labels.length > maxChartPoints) {
                vxChart.data.labels.shift();
                vxChart.data.datasets[0].data.shift();
            }
        }
        if (vyChart) {
            vyChart.data.labels.push(tLabel);
            vyChart.data.datasets[0].data.push(vyNow);
            if (vyChart.data.labels.length > maxChartPoints) {
                vyChart.data.labels.shift();
                vyChart.data.datasets[0].data.shift();
            }
        }
        if (frameCount % 10 === 0) {
            if (myChart) myChart.update('none');
            if (vxChart) vxChart.update('none');
            if (vyChart) vyChart.update('none');
        }

        path.push({ x: currentX_px, y: currentY_px });

        // 計算當前速度分量
        let vx = initV * Math.cos(angleRad);
        let vy = initV * Math.sin(angleRad) - g * simTime;

        draw(currentX_px, currentY_px, vx, vy);

        if (isMoving) animationFrameId = requestAnimationFrame(loop);
    }

    function draw(ballX, ballY, vx, vy) {
        vx = vx || 0;
        vy = vy || 0;

        PhysicsUtils.beginFrame(ctx, canvas);
        ctx.beginPath();
        ctx.moveTo(0, startY_px);
        ctx.lineTo(canvas.cssWidth, startY_px);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (initH > 0) {
            ctx.beginPath();
            ctx.moveTo(startX_px, startY_px);
            ctx.lineTo(startX_px, startY_px - (initH * meterToPixel));
            ctx.lineTo(0, startY_px - (initH * meterToPixel));
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
            if (i === 0) ctx.moveTo(path[i].x, path[i].y);
            else ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 速度向量箭頭
        let speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0.1) {
            let arrowScale = 2.5;
            let endX = ballX + vx * arrowScale;
            let endY = ballY - vy * arrowScale; // 注意 Y 軸反轉

            // 箭頭主體
            ctx.save();
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 6;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(ballX, ballY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // 箭頭尖端
            let angle = Math.atan2(-(vy * arrowScale), vx * arrowScale);
            let headLen = 12;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // 速度數值標籤
            ctx.save();
            ctx.font = '700 14px "Inter", sans-serif';
            let label = `v = ${speed.toFixed(1)} m/s`;
            let m = ctx.measureText(label);
            let pad = 5;
            let labelX = endX + 10;
            let labelY = endY - 10;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(labelX - pad, labelY - 12, m.width + pad * 2, 20, 3);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, labelX, labelY - 2);
            ctx.restore();

            // --- 水平分量箭頭 (vx) ---
            if (Math.abs(vx) > 0.1) {
                let hxEnd = ballX + vx * arrowScale;
                ctx.save();
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(ballX, ballY);
                ctx.lineTo(hxEnd, ballY);
                ctx.stroke();
                ctx.setLineDash([]);

                // 尖端
                let hAngle = vx > 0 ? 0 : Math.PI;
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.moveTo(hxEnd, ballY);
                ctx.lineTo(hxEnd - 10 * Math.cos(hAngle - Math.PI / 6), ballY - 10 * Math.sin(hAngle - Math.PI / 6));
                ctx.lineTo(hxEnd - 10 * Math.cos(hAngle + Math.PI / 6), ballY - 10 * Math.sin(hAngle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // vx 標籤
                ctx.save();
                ctx.font = '700 13px "Inter", sans-serif';
                let vxLabel = `vx = ${Math.abs(vx).toFixed(1)}`;
                let vxM = ctx.measureText(vxLabel);
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath();
                ctx.roundRect(hxEnd + (vx > 0 ? 6 : -vxM.width - 16), ballY - 22, vxM.width + 10, 18, 3);
                ctx.fill();
                ctx.fillStyle = '#22c55e';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(vxLabel, hxEnd + (vx > 0 ? 11 : -vxM.width - 11), ballY - 13);
                ctx.restore();
            }

            // --- 垂直分量箭頭 (vy) ---
            if (Math.abs(vy) > 0.1) {
                let vyEnd = ballY - vy * arrowScale;
                ctx.save();
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(ballX, ballY);
                ctx.lineTo(ballX, vyEnd);
                ctx.stroke();
                ctx.setLineDash([]);

                // 尖端
                let vAngle = vy > 0 ? -Math.PI / 2 : Math.PI / 2;
                ctx.fillStyle = '#8b5cf6';
                ctx.beginPath();
                ctx.moveTo(ballX, vyEnd);
                ctx.lineTo(ballX - 10 * Math.cos(vAngle - Math.PI / 6), vyEnd - 10 * Math.sin(vAngle - Math.PI / 6));
                ctx.lineTo(ballX - 10 * Math.cos(vAngle + Math.PI / 6), vyEnd - 10 * Math.sin(vAngle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // vy 標籤
                ctx.save();
                ctx.font = '700 13px "Inter", sans-serif';
                let vyLabel = `vy = ${Math.abs(vy).toFixed(1)}`;
                let vyM = ctx.measureText(vyLabel);
                let vyLabelY = vy > 0 ? vyEnd - 8 : vyEnd + 8;
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath();
                ctx.roundRect(ballX + 12, vyLabelY - 10, vyM.width + 10, 18, 3);
                ctx.fill();
                ctx.fillStyle = '#8b5cf6';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(vyLabel, ballX + 17, vyLabelY - 1);
                ctx.restore();
            }
        }
    }

    if (fireBtn) fireBtn.onclick = fire;
    if (rstBtn) rstBtn.onclick = resetSim;

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.onclick = () => {
        if (!isMoving) return;
        isPaused = !isPaused;
        pauseBtn.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
        pauseBtn.style.backgroundColor = isPaused ? "#2563eb" : "#ffffff";
        pauseBtn.style.color = isPaused ? "#ffffff" : "#000000";
    };
    
    // 迴圈 guard：快取 DOM 節點，避免每幀查詢
    const guardEl = vSlider;

    resetSim();
}

initProjectile();