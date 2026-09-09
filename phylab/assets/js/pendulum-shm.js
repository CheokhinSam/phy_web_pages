/**
 * 🌀 單擺的簡諧運動
 * 展示單擺的週期運動，觀察角度、回復力與能量的變化。
 */
function initPendulumShm() {
    // ==========================================================================
    // A. 初始化
    // ==========================================================================
    const { canvas, ctx, ctrlPanel, guardEl } = PhysicsUtils.initCanvas();
    if (!canvas) return;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // B. 狀態變數
    // ==========================================================================
    let length = 2.0;        // 擺長 L (m)
    let mass = 1.0;          // 質量 m (kg)
    let gravity = 9.8;       // 重力加速度 g (m/s²)
    let initAngleDeg = 5;    // 初始角度 (°)

    let angle, angVel, simTime, trail;
    let isRunning = false;
    let isPaused = false;
    let lastTimestamp = performance.now();
    let animationFrameId;
    let frameCount = 0;

    const state = { isRunning, isPaused, lastTimestamp };

    function resetState() {
        const a0 = initAngleDeg * Math.PI / 180;
        angle = a0;
        angVel = 0;
        simTime = 0;
        trail = [];
    }
    resetState();

    // ==========================================================================
    // C. 控制面板
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
                <input type="range" id="lSlider" min="0.5" max="4.0" step="0.1" value="2.0">
            </div>
            <div class="control-box">
                <label>
                    <span>質量 <i>m</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="mVal" style="color: #2563eb;">1.0</span> kg
                    </span>
                </label>
                <input type="range" id="mSlider" min="0.5" max="5.0" step="0.1" value="1.0">
            </div>
            <div class="control-box">
                <label>
                    <span>重力加速度 <i>g</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="gVal" style="color: #2563eb;">9.8</span> m/s²
                    </span>
                </label>
                <input type="range" id="gSlider" min="1.0" max="25.0" step="0.1" value="9.8">
            </div>
            <div class="control-box">
                <label>
                    <span>初始角度 <i>θ₀</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="a0Val" style="color: #2563eb;">5</span>°
                    </span>
                </label>
                <input type="range" id="a0Slider" min="3" max="60" step="1" value="5">
            </div>
            <div class="control-box" id="shmInfoBox" style="padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.8; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">單擺參數</div>
                <div style="font-family: monospace; font-size: 0.8rem;">
                    <div>角頻率 ω₀ = <span id="shmOmega" style="color: #2563eb; font-weight: 800;">2.21</span> rad/s</div>
                    <div>週期 T = <span id="shmT" style="color: #2563eb; font-weight: 800;">2.84</span> s</div>
                    <div>頻率 f = <span id="shmF" style="color: #2563eb; font-weight: 800;">0.35</span> Hz</div>
                </div>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; letter-spacing: 1px;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            ${PhysicsUtils.formulaBox('單擺週期', 'T = 2\\pi\\sqrt{\\frac{L}{g}}')}
            ${PhysicsUtils.formulaBox('回復力', 'F = -mg\\sin\\theta')}
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        PhysicsUtils.bindSlider('lSlider', 'lVal', v => { length = v; updateSHMInfo(); });
        PhysicsUtils.bindSlider('mSlider', 'mVal', v => { mass = v; });
        PhysicsUtils.bindSlider('gSlider', 'gVal', v => { gravity = v; updateSHMInfo(); });
        PhysicsUtils.bindSlider('a0Slider', 'a0Val', v => { initAngleDeg = v; }, v => parseInt(v).toString());

        updateSHMInfo();
    }

    function updateSHMInfo() {
        const omega0 = Math.sqrt(gravity / length);
        const T = 2 * Math.PI / omega0;
        const f = 1 / T;
        const el = id => document.getElementById(id);
        if (el('shmOmega')) el('shmOmega').textContent = omega0.toFixed(2);
        if (el('shmT')) el('shmT').textContent = T.toFixed(2);
        if (el('shmF')) el('shmF').textContent = f.toFixed(2);
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '時間 TIME', id: 'cardTime', unit: 's', highlight: true },
        { label: '角度 θ', id: 'cardAngle', unit: '°' },
        { label: '回復力 F', id: 'cardF', unit: 'N' },
        { label: '角速度 ω', id: 'cardOmega', unit: 'rad/s' },
        { label: '週期 T', id: 'cardPeriod', unit: 's' },
    ]);

    // ==========================================================================
    // E. 圖表
    // ==========================================================================
    PhysicsUtils.prepareChartContainer('chartContainer', [
        { canvasId: 'thetaChart', title: 'ANGLE-TIME GRAPH' },
        { canvasId: 'energyChart', title: 'ENERGY BAR' },
    ]);

    const thetaChartObj = PhysicsUtils.createChart({
        canvasId: 'thetaChart',
        label: '角度 θ (°)',
        borderColor: '#2563eb',
        xTitle: '時間 t (s)',
        yTitle: '角度 θ (°)',
        maxPoints: 400
    });

    // 能量長條圖
    let energyChart = null;
    const initEnergy = mass * gravity * length * (1 - Math.cos(initAngleDeg * Math.PI / 180));
    const energyCanvas = document.getElementById('energyChart');
    if (energyCanvas && typeof Chart !== 'undefined') {
        energyChart = new Chart(energyCanvas, {
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
                        min: 0,
                        max: initEnergy * 1.05 || 1,
                        title: { display: true, text: '能量 (J)', font: { family: 'monospace', weight: '700' } },
                        ticks: { font: { family: 'monospace' } }
                    },
                    y: { display: true, ticks: { font: { family: 'monospace', weight: '700', size: 12 } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ==========================================================================
    // F. 物理計算
    // ==========================================================================
    const SCALE = 90; // px per meter

    function physicsStep(dt) {
        // 半隱式歐拉（Symplectic Euler）
        const alpha = -(gravity / length) * Math.sin(angle);
        angVel += alpha * dt;
        angle += angVel * dt;
    }

    function getSHMQuantities() {
        const F_restore = -mass * gravity * Math.sin(angle);
        const omega0 = Math.sqrt(gravity / length);
        const T = 2 * Math.PI / omega0;
        const KE = 0.5 * mass * length * length * angVel * angVel;
        const PE = mass * gravity * length * (1 - Math.cos(angle));
        return { F_restore, omega0, T, KE, PE };
    }

    // ==========================================================================
    // G. 渲染
    // ==========================================================================
    function drawSim() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;

        // --- 上半部：單擺 ---
        const pendOx = W * 0.5;
        const pendOy = H * 0.07;
        const maxLp = H * 0.42; // 限制擺長不超過畫面42%
        const lp = Math.min(length * SCALE, maxLp);

        const ballX = pendOx + lp * Math.sin(angle);
        const ballY = pendOy + lp * Math.cos(angle);

        // 軌跡記錄
        if (isRunning && !isPaused) {
            trail.push({ x: ballX, y: ballY });
            if (trail.length > 180) trail.shift();
        }

        // 天花板
        const cw = PhysicsUtils.scaled(100, W), ch = PhysicsUtils.scaled(10, W);
        const ceilGrad = ctx.createLinearGradient(pendOx - cw / 2, pendOy - ch, pendOx - cw / 2, pendOy);
        ceilGrad.addColorStop(0, '#a0845c');
        ceilGrad.addColorStop(0.5, '#c9a96e');
        ceilGrad.addColorStop(1, '#8b7355');
        ctx.fillStyle = ceilGrad;
        ctx.beginPath();
        ctx.roundRect(pendOx - cw / 2, pendOy - ch, cw, ch, 3);
        ctx.fill();

        // 垂直參考虛線
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pendOx, pendOy);
        ctx.lineTo(pendOx, pendOy + lp + 40);
        ctx.stroke();
        ctx.restore();

        // 角度弧線
        if (Math.abs(angle) > 0.02) {
            const arcR = PhysicsUtils.scaled(40, W);
            const s = Math.PI / 2;
            const e = Math.PI / 2 - angle;
            ctx.beginPath();
            ctx.arc(pendOx, pendOy, arcR, Math.min(s, e), Math.max(s, e));
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            const mid = (s + e) / 2;
            const tr = arcR + PhysicsUtils.scaled(12, W);
            PhysicsUtils.drawSafeText(ctx, (angle * 180 / Math.PI).toFixed(1) + '°',
                pendOx + tr * Math.cos(mid), pendOy + tr * Math.sin(mid), {
                    font: PhysicsUtils.FONTS.ANGLE, color: 'rgba(37, 99, 235, 0.7)', W, H
                });
        }

        // 軌跡
        for (let i = 1; i < trail.length; i++) {
            const a = i / trail.length * 0.35;
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.strokeStyle = `rgba(37, 99, 235, ${a})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 擺線
        const stringGrad = ctx.createLinearGradient(pendOx, pendOy, ballX, ballY);
        stringGrad.addColorStop(0, '#555');
        stringGrad.addColorStop(1, '#999');
        ctx.beginPath();
        ctx.moveTo(pendOx, pendOy);
        ctx.lineTo(ballX, ballY);
        ctx.strokeStyle = stringGrad;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 擺錘
        PhysicsUtils.drawBall(ctx, ballX, ballY, PhysicsUtils.scaled(20, W), '#2563eb');

        // 力的向量
        const F_LEN = PhysicsUtils.scaled(35, W);
        // 重力 mg
        const mgLen = mass * gravity * F_LEN / 15;
        PhysicsUtils.drawArrow(ctx, ballX, ballY, ballX, ballY + mgLen, {
            color: '#64748b', width: 2, dashed: true, label: 'mg'
        });

        // 切向回復力（紅色）
        const Ft = -mass * gravity * Math.sin(angle);
        const ftLen = Math.abs(Ft) * F_LEN / 10;
        if (ftLen > 3) {
            const tangDx = Math.cos(angle);
            const tangDy = -Math.sin(angle);
            const s = Ft > 0 ? 1 : -1;
            PhysicsUtils.drawArrow(ctx, ballX, ballY, ballX + s * tangDx * ftLen, ballY + s * tangDy * ftLen, {
                color: '#ef4444', width: 3, shadow: true, label: 'F'
            });
        }

        // --- 下半部：彈簧振子對比 ---
        const springOx = W * 0.5;
        const springOy = H * 0.72;
        const eqX = springOx;

        // 用相同的 SHM 參數畫彈簧振子
        const omega0 = Math.sqrt(gravity / length);
        const shmX = length * angle; // 小角度近似位移
        const springBallX = eqX + shmX * SCALE * 0.8;

        // 牆壁
        const wallX = springOx - PhysicsUtils.scaled(80, W);
        const wallW = PhysicsUtils.scaled(14, W), wallH = PhysicsUtils.scaled(60, W);
        const wallGrad = ctx.createLinearGradient(wallX - wallW, 0, wallX, 0);
        wallGrad.addColorStop(0, '#a0845c');
        wallGrad.addColorStop(0.5, '#c9a96e');
        wallGrad.addColorStop(1, '#8b7355');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(wallX - wallW, springOy - wallH / 2, wallW, wallH);

        // 彈簧
        drawSpring(ctx, wallX, springOy, springBallX - 16, springOy);

        // 平衡位置
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(eqX, springOy - 50);
        ctx.lineTo(eqX, springOy + 50);
        ctx.stroke();
        ctx.restore();

        PhysicsUtils.drawSafeText(ctx, '平衡', eqX, springOy - PhysicsUtils.scaled(54, W), {
            font: PhysicsUtils.FONTS.SMALL, color: 'rgba(139, 92, 246, 0.5)', align: 'center', W, H
        });

        // 彈簧振子球
        PhysicsUtils.drawBall(ctx, springBallX, springOy, PhysicsUtils.scaled(16, W), '#8b5cf6');

        // 位移標示
        const springDx = springBallX - eqX;
        if (Math.abs(springDx) > 5) {
            PhysicsUtils.drawArrow(ctx, eqX, springOy + 35, springBallX, springOy + 35, {
                color: '#8b5cf6', width: 2, label: 'x'
            });
        }

        // --- 圖例 ---
        PhysicsUtils.drawLegend(ctx, [
            { color: '#2563eb', label: '單擺軌跡' },
            { color: '#ef4444', label: '回復力 F' },
            { color: '#8b5cf6', label: '彈簧振子' },
        ], W, H);
    }

    function drawSpring(ctx, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const len = Math.abs(dx);
        if (len < 10) return;

        const coils = 10;
        const amp = PhysicsUtils.scaled(10, canvas.cssWidth);
        const leadIn = PhysicsUtils.scaled(10, canvas.cssWidth);
        const leadOut = PhysicsUtils.scaled(10, canvas.cssWidth);
        const springLen = len - leadIn - leadOut;

        ctx.save();
        ctx.translate(x1, y1);

        const grad = ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0, '#8b5cf6');
        grad.addColorStop(0.5, '#a78bfa');
        grad.addColorStop(1, '#8b5cf6');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(leadIn, 0);

        const segLen = springLen / (coils * 2);
        for (let i = 0; i < coils * 2; i++) {
            const px = leadIn + (i + 1) * segLen;
            const py = (i % 2 === 0 ? -1 : 1) * amp;
            ctx.lineTo(px, py);
        }

        ctx.lineTo(len, 0);
        ctx.stroke();
        ctx.restore();
    }

    // ==========================================================================
    // H. 主迴圈
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;

        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;

        if (isRunning && !isPaused) {
            const subSteps = 8;
            const subDt = dt / subSteps;
            for (let i = 0; i < subSteps; i++) physicsStep(subDt);
            simTime += dt;
        }

        PhysicsUtils.beginFrame(ctx, canvas);
        drawSim();

        const q = getSHMQuantities();
        updateCards({
            cardTime: simTime.toFixed(2),
            cardAngle: (angle * 180 / Math.PI).toFixed(1),
            cardF: q.F_restore.toFixed(3),
            cardOmega: angVel.toFixed(3),
            cardPeriod: q.T.toFixed(3)
        });

        // 每 3 幀更新圖表
        if (frameCount++ % 3 === 0 && isRunning && !isPaused) {
            if (thetaChartObj) thetaChartObj.pushData(simTime.toFixed(2), angle * 180 / Math.PI);

            if (energyChart) {
                energyChart.data.datasets[0].data = [q.KE, q.PE, q.KE + q.PE];
                energyChart.update('none');
            }
        }

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // I. 按鈕事件
    // ==========================================================================
    PhysicsUtils.setupStartBtn('startBtn', 'pauseBtn', state, () => {
        isRunning = true;
        isPaused = false;
        resetState();
        lastTimestamp = performance.now();

        // 重設圖表
        if (thetaChartObj) thetaChartObj.clear();
        if (thetaChartObj && thetaChartObj.chart) {
            thetaChartObj.chart.options.scales.y.min = -initAngleDeg * 1.2;
            thetaChartObj.chart.options.scales.y.max = initAngleDeg * 1.2;
            thetaChartObj.chart.update('none');
        }
        if (energyChart) {
            const ie = mass * gravity * length * (1 - Math.cos(initAngleDeg * Math.PI / 180));
            energyChart.options.scales.x.max = ie * 1.05 || 1;
            energyChart.data.datasets[0].data = [0, 0, 0];
            energyChart.update('none');
        }
    });

    PhysicsUtils.setupPauseBtn('pauseBtn', state, loop, paused => isPaused = paused);

    PhysicsUtils.setupResetBtn('resetBtn', () => {
        isRunning = false;
        isPaused = false;
        state.isRunning = false;
        state.isPaused = false;
        resetState();

        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        document.getElementById('pauseBtn').style.backgroundColor = '#ffffff';
        document.getElementById('pauseBtn').style.color = '#000000';
        document.getElementById('pauseBtn').style.border = '1px solid #000000';

        updateCards({ cardTime: '0.00', cardAngle: initAngleDeg.toFixed(0), cardF: '0.000', cardOmega: '0.000', cardPeriod: getSHMQuantities().T.toFixed(3) });

        if (thetaChartObj) thetaChartObj.clear();
        if (energyChart) {
            energyChart.data.datasets[0].data = [0, 0, 0];
            energyChart.update();
        }
    });

    // ==========================================================================
    // J. 啟動
    // ==========================================================================
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    PhysicsUtils.setupCleanup(animationFrameId, resizeCanvas);
}

initPendulumShm();
