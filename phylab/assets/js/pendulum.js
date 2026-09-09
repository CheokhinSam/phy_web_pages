/**
 * 🔮 單擺運動實驗 - 實驗腳本（升級版）
 * 完美適應原本的 experiment.html 模板結構（動態覆寫右側數據面板）
 */
function initPendulum() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 動態注入左側操作面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>擺長 <i>L</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="lVal" style="color: #2563eb;">2.0</span> m
                    </span>
                </label>
                <input type="range" id="lSlider" min="0.5" max="3.5" value="2.0" step="0.1">
            </div>
            <div class="control-box">
                <label>
                    <span>重力加速度 <i>g</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="gVal" style="color: #2563eb;">9.8</span> m/s²
                    </span>
                </label>
                <input type="range" id="gSlider" min="1.0" max="20.0" value="9.8" step="0.1">
            </div>
            <div class="control-box">
                <label>
                    <span>初始角度 θ₀</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="a0Val" style="color: #2563eb;">45</span>°
                    </span>
                </label>
                <input type="range" id="a0Slider" min="5" max="90" value="45" step="1">
            </div>
            <div class="control-box" style="margin-top: 15px;">
                <button id="startBtn" style="width: 100%; background-color: #2563eb; color: #ffffff; margin-bottom: 8px;">開始 / START</button>
                <button id="pauseBtn" style="display: none; width: 100%; margin-bottom: 8px;">暫停 / PAUSE</button>
                <button id="resetBtn" style="width: 100%; background-color: #ffffff; color: #000000; border: 1px solid #000000;">重設 / RESET</button>
            </div>
        `;
    }

    // Canvas 自適應
    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    const lSlider = document.getElementById('lSlider');
    const gSlider = document.getElementById('gSlider');
    const a0Slider = document.getElementById('a0Slider');
    const lVal = document.getElementById('lVal');
    const gVal = document.getElementById('gVal');
    const a0Val = document.getElementById('a0Val');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    if (lSlider) lSlider.oninput = () => lVal.innerText = parseFloat(lSlider.value).toFixed(1);
    if (gSlider) gSlider.oninput = () => gVal.innerText = parseFloat(gSlider.value).toFixed(1);
    if (a0Slider) a0Slider.oninput = () => a0Val.innerText = parseInt(a0Slider.value);

    // ==========================================================================
    // B. 覆寫右側數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(160px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">模擬時間 TIME</span>
                <div class="card-num-wrapper">
                    <span id="dashTime" class="card-num">0.00</span>
                    <span class="card-unit">s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">擺動角度 ANGLE</span>
                <div class="card-num-wrapper">
                    <span id="dashAngle" class="card-num">0.0</span>
                    <span class="card-unit">°</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">角速度 ANG_VEL</span>
                <div class="card-num-wrapper">
                    <span id="dashVel" class="card-num">0.00</span>
                    <span class="card-unit">rad/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">機械能 MECH_E</span>
                <div class="card-num-wrapper">
                    <span id="dashEnergy" class="card-num">0.00</span>
                    <span class="card-unit">J</span>
                </div>
            </div>
        `;
    }

    const dashTime = document.getElementById('dashTime');
    const dashAngle = document.getElementById('dashAngle');
    const dashVel = document.getElementById('dashVel');
    const dashEnergy = document.getElementById('dashEnergy');

    // ==========================================================================
    // B2. 注入 Chart.js 角度-時間圖表
    // ==========================================================================
    const chartContainer = document.getElementById('chartContainer');
    if (chartContainer) {
        // 隱藏原本的 HEIGHT GRAPH 標題與 canvas
        chartContainer.style.display = 'block';
        const origTitle = chartContainer.querySelector('.pane-meta-title');
        if (origTitle) origTitle.style.display = 'none';
        const origWrapper = chartContainer.querySelector('.chart-wrapper');
        if (origWrapper) origWrapper.style.display = 'none';

        // 注入角度圖表
        chartContainer.insertAdjacentHTML('beforeend', `
            <div class="pane-meta-title" style="margin-top: 30px; margin-bottom: 10px;">// ANGLE GRAPH</div>
            <div class="chart-wrapper">
                <canvas id="angleChart"></canvas>
            </div>
            <div class="pane-meta-title" style="margin-top: 30px; margin-bottom: 10px;">// ENERGY BAR</div>
            <div class="chart-wrapper" style="height: 180px;">
                <canvas id="energyChart"></canvas>
            </div>
            <div id="zoomChartBtnWrap" style="text-align: center; margin-top: 10px;">
                <button id="zoomChartBtn" style="background: #000; color: #fff; border: none; padding: 6px 16px; font-family: monospace; font-weight: 700; font-size: 0.85rem; cursor: pointer;">放大圖表 / EXPAND</button>
            </div>
        `);
    }

    // 等待 DOM 注入完成後建立圖表
    let angleChart = null;
    let angleChartData = [];
    let energyChart = null;

    function createChart() {
        const a0 = parseInt(a0Slider.value);
        const L = parseFloat(lSlider.value);
        const g = parseFloat(gSlider.value);
        const initEnergy = g * L * (1 - Math.cos(a0 * Math.PI / 180));

        const canvasEl = document.getElementById('angleChart');
        if (!canvasEl) return;
        angleChart = new Chart(canvasEl, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
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
                animation: false,
                scales: {
                    x: { display: true, title: { display: true, text: '時間 t (s)', font: { family: 'monospace', weight: '700' } }, ticks: { font: { family: 'monospace' }, maxTicksLimit: 8 } },
                    y: {
                        display: true,
                        min: -a0, max: a0,
                        title: { display: true, text: '角度 θ (°)', font: { family: 'monospace', weight: '700' } },
                        ticks: { font: { family: 'monospace' } }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 能量長條圖（水平）
        const energyCanvasEl = document.getElementById('energyChart');
        if (!energyCanvasEl) return;
        energyChart = new Chart(energyCanvasEl, {
            type: 'bar',
            data: {
                labels: ['動能 KE', '位能 PE', '總能量 E'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#22c55e', '#3b82f6', '#94a3b8'],
                    borderColor: ['#16a34a', '#2563eb', '#64748b'],
                    borderWidth: 1,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        display: true,
                        min: 0, max: initEnergy * 1.05,
                        title: { display: true, text: '能量 (J)', font: { family: 'monospace', weight: '700' } },
                        ticks: { font: { family: 'monospace' } }
                    },
                    y: { display: true, ticks: { font: { family: 'monospace', weight: '700', size: 13 } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
    setTimeout(createChart, 50);

    // 放大/縮小圖表
    setTimeout(() => {
        const zoomBtn = document.getElementById('zoomChartBtn');
        if (zoomBtn && chartContainer) {
            let zoomed = false;
            zoomBtn.onclick = () => {
                zoomed = !zoomed;
                if (zoomed) {
                    chartContainer.style.position = 'fixed';
                    chartContainer.style.top = '0';
                    chartContainer.style.left = '0';
                    chartContainer.style.width = '100vw';
                    chartContainer.style.height = '100vh';
                    chartContainer.style.zIndex = '9999';
                    chartContainer.style.background = '#fff';
                    chartContainer.style.padding = '20px';
                    chartContainer.style.overflow = 'auto';
                    document.querySelectorAll('.chart-wrapper').forEach(w => w.style.height = '40vh');
                    zoomBtn.textContent = '縮小圖表 / COLLAPSE';
                } else {
                    chartContainer.style.position = '';
                    chartContainer.style.top = '';
                    chartContainer.style.left = '';
                    chartContainer.style.width = '';
                    chartContainer.style.height = '';
                    chartContainer.style.zIndex = '';
                    chartContainer.style.background = '';
                    chartContainer.style.padding = '';
                    chartContainer.style.overflow = '';
                    document.querySelectorAll('.chart-wrapper').forEach(w => w.style.height = '');
                    zoomBtn.textContent = '放大圖表 / EXPAND';
                }
                setTimeout(() => {
                    if (angleChart) angleChart.resize();
                    if (energyChart) energyChart.resize();
                }, 100);
            };
        }
    }, 100);

    // ==========================================================================
    // C. 物理參數
    // ==========================================================================
    const guardEl = lSlider;
    const meterToPixel = 140;
    let angle = Math.PI / 4;
    let angleVelocity = 0;
    let isRunning = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;
    const damping = 0.9995;

    // 軌跡點陣列
    const trail = [];
    const maxTrail = 150;

    // ==========================================================================
    // D. 物理引擎 + Canvas 渲染
    // ==========================================================================
    function loop(currentTimestamp) {
        if (!document.contains(guardEl)) return;

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.1) dt = 0.1;

        if (isRunning) {
            const L = parseFloat(lSlider.value);
            const g = parseFloat(gSlider.value);

            // 半隱式歐拉（Symplectic Euler）— 能量守恆優於標準歐拉
            const alpha = -(g / L) * Math.sin(angle);
            angleVelocity += alpha * dt;
            angleVelocity *= damping;
            angle += angleVelocity * dt;

            simTime += dt;
        }

        // 數據更新
        if (dashTime) dashTime.innerText = simTime.toFixed(2);
        if (dashAngle) dashAngle.innerText = (Math.abs(angle) * 180 / Math.PI).toFixed(1);
        if (dashVel) dashVel.innerText = angleVelocity.toFixed(2);

        // 計算能量（m = 1 kg 歸一化）
        const L = parseFloat(lSlider.value);
        const g = parseFloat(gSlider.value);
        const KE = 0.5 * L * L * angleVelocity * angleVelocity;  // ½mL²ω², m=1
        const PE = g * L * (1 - Math.cos(angle));                  // mgL(1-cosθ), m=1
        const totalE = KE + PE;
        if (dashEnergy) dashEnergy.innerText = totalE.toFixed(3);

        // 能量圖表更新
        if (energyChart && isRunning) {
            energyChart.data.datasets[0].data = [KE, PE, totalE];
            energyChart.update('none');
        }

        // 角度圖表資料
        if (angleChart && isRunning) {
            angleChartData.push({ t: simTime, v: angle * 180 / Math.PI });
            if (angleChartData.length > 500) angleChartData.shift();
            angleChart.data.labels = angleChartData.map(d => d.t.toFixed(2));
            angleChart.data.datasets[0].data = angleChartData.map(d => d.v);
            angleChart.update('none');
        }

        // ==========================================================================
        // Canvas 渲染
        // ==========================================================================
        PhysicsUtils.beginFrame(ctx, canvas);

        const originX = canvas.cssWidth / 2;
        const originY = 80;
        const L_px = L * meterToPixel;

        const ballX = originX + L_px * Math.sin(angle);
        const ballY = originY + L_px * Math.cos(angle);

        // 軌跡記錄
        if (isRunning) {
            trail.push({ x: ballX, y: ballY });
            if (trail.length > maxTrail) trail.shift();
        }

        // 1. 天花板 — 木紋色長條 + 陰影
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        const ceilW = 120, ceilH = 14;
        const ceilGrad = ctx.createLinearGradient(originX - ceilW / 2, originY - ceilH, originX - ceilW / 2, originY);
        ceilGrad.addColorStop(0, '#a0845c');
        ceilGrad.addColorStop(0.5, '#c9a96e');
        ceilGrad.addColorStop(1, '#8b7355');
        ctx.fillStyle = ceilGrad;
        ctx.beginPath();
        ctx.roundRect(originX - ceilW / 2, originY - ceilH, ceilW, ceilH, 3);
        ctx.fill();
        ctx.restore();

        // 2. 垂直虛線參考線
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX, originY + L_px + 40);
        ctx.stroke();
        ctx.restore();

        // 3. 角度弧線標示
        if (Math.abs(angle) > 0.02) {
            const arcR = 50;
            const startAngle = Math.PI / 2; // 垂直向下
            const endAngle = Math.PI / 2 - angle;
            ctx.beginPath();
            ctx.arc(originX, originY, arcR, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // 角度文字
            const midAngle = (startAngle + endAngle) / 2;
            const textR = arcR + 14;
            ctx.fillStyle = 'rgba(37, 99, 235, 0.7)';
            ctx.font = '600 13px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                (angle * 180 / Math.PI).toFixed(1) + '°',
                originX + textR * Math.cos(midAngle),
                originY + textR * Math.sin(midAngle)
            );
        }

        // 4. 軌跡
        if (trail.length > 1) {
            for (let i = 1; i < trail.length; i++) {
                const alpha = i / trail.length * 0.35;
                ctx.beginPath();
                ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                ctx.lineTo(trail[i].x, trail[i].y);
                ctx.strokeStyle = `rgba(37, 99, 235, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // 5. 擺線 — 漸層
        const stringGrad = ctx.createLinearGradient(originX, originY, ballX, ballY);
        stringGrad.addColorStop(0, '#555');
        stringGrad.addColorStop(1, '#999');
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(ballX, ballY);
        ctx.strokeStyle = stringGrad;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 6. 擺錘 — 徑向漸層 + 高光
        const ballR = 22;
        // 主體漸層
        const ballGrad = ctx.createRadialGradient(ballX - 5, ballY - 5, 2, ballX, ballY, ballR);
        ballGrad.addColorStop(0, '#60a5fa');
        ballGrad.addColorStop(0.6, '#2563eb');
        ballGrad.addColorStop(1, '#1e40af');
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();
        // 描邊
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2;
        ctx.stroke();
        // 高光
        ctx.beginPath();
        ctx.arc(ballX - 6, ballY - 7, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fill();

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // E. 按鈕控制
    // ==========================================================================
    if (startBtn) {
        startBtn.onclick = () => {
            isRunning = true;
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'flex';
        };
    }

    if (pauseBtn) {
        pauseBtn.onclick = () => {
            isRunning = !isRunning;
            pauseBtn.innerText = isRunning ? "暫停 / PAUSE" : "播放 / PLAY";
            pauseBtn.style.backgroundColor = isRunning ? "#000000" : "#2563eb";
        };
    }

    if (resetBtn) {
        resetBtn.onclick = () => {
            const a0Deg = parseInt(a0Slider.value);
            const a0 = a0Deg * Math.PI / 180;
            const L = parseFloat(lSlider.value);
            const g = parseFloat(gSlider.value);
            angle = a0;
            angleVelocity = 0;
            simTime = 0;
            isRunning = false;
            trail.length = 0;
            angleChartData = [];
            if (angleChart) {
                angleChart.options.scales.y.min = -a0Deg;
                angleChart.options.scales.y.max = a0Deg;
                angleChart.data.labels = [];
                angleChart.data.datasets[0].data = [];
                angleChart.update();
            }
            if (energyChart) {
                const initE = g * L * (1 - Math.cos(a0));
                energyChart.options.scales.x.max = initE * 1.05;
                energyChart.data.datasets[0].data = [0, 0, 0];
                energyChart.update();
            }
            startBtn.style.display = 'flex';
            pauseBtn.style.display = 'none';
            pauseBtn.innerText = "暫停 / PAUSE";
            pauseBtn.style.backgroundColor = "#000000";
        };
    }

    // 啟動
    animationFrameId = requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initPendulum();
