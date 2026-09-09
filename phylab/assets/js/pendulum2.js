/**
 * 🔮 單擺運動實驗 2
 * 力分解、相空間圖、自動週期量測、阻尼控制、小角度近似比較
 */
function initPendulum2() {
    // ==========================================================================
    // A. 初始化
    // ==========================================================================
    const { canvas, ctx, ctrlPanel, guardEl } = PhysicsUtils.initCanvas();
    if (!canvas) return;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // B. 狀態變數
    // ==========================================================================
    let length = 2.0;
    let gravity = 9.8;
    let initAngleDeg = 30;
    let dampingCoeff = 0.0;

    let angle, angVel, simTime, prevAngle, trail, crossings, measuredPeriod;
    let isRunning = false;
    let isPaused = false;
    let lastTimestamp = performance.now();
    let animationFrameId;

    let showForces = false;
    let showComparison = false;
    let compData = { active: false, startAngle: 0, omega0: 0, phi: 0, length: 2.0, gravity: 9.8 };

    const state = { isRunning, isPaused, lastTimestamp };

    function resetState() {
        const a0 = initAngleDeg * Math.PI / 180;
        angle = a0;
        angVel = 0;
        simTime = 0;
        prevAngle = a0;
        trail = [];
        crossings = [];
        measuredPeriod = 0;
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
                        <span id="a0Val" style="color: #2563eb;">30</span>°
                    </span>
                </label>
                <input type="range" id="a0Slider" min="5" max="90" step="1" value="30">
            </div>
            <div class="control-box">
                <label>
                    <span>阻尼係數 <i>b</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="dampVal" style="color: #2563eb;">0.00</span>
                    </span>
                </label>
                <input type="range" id="dampSlider" min="0" max="2.0" step="0.05" value="0">
            </div>
            <div class="control-box">
                <label><span>視覺選項</span></label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px;">
                    <button id="toggleForces" class="toggle-btn">📐 力分解</button>
                    <button id="toggleComp" class="toggle-btn">📐 小角度近似</button>
                </div>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; letter-spacing: 1px;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            ${PhysicsUtils.formulaBox('週期公式', 'T = 2\\pi\\sqrt{\\frac{L}{g}}')}
            ${PhysicsUtils.formulaBox('運動方程', '\\ddot{\\theta} + \\frac{g}{L}\\sin\\theta = 0')}
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        const style = document.createElement('style');
        style.textContent = `.toggle-btn{padding:8px 4px;background:#fff;color:#000;border:1px solid #000;font-weight:700;cursor:pointer;font-size:.75rem;font-family:monospace}.toggle-btn.active{background:#000;color:#fff;border:none}`;
        document.head.appendChild(style);

        // 滑桿綁定
        PhysicsUtils.bindSlider('lSlider', 'lVal', v => length = v);
        PhysicsUtils.bindSlider('gSlider', 'gVal', v => gravity = v);
        PhysicsUtils.bindSlider('a0Slider', 'a0Val', v => initAngleDeg = v, v => parseInt(v).toString());
        PhysicsUtils.bindSlider('dampSlider', 'dampVal', v => dampingCoeff = v, v => v.toFixed(2));

        // 切換按鈕
        const btnForces = document.getElementById('toggleForces');
        const btnComp = document.getElementById('toggleComp');
        if (btnForces) btnForces.addEventListener('click', () => {
            showForces = !showForces;
            btnForces.classList.toggle('active', showForces);
        });
        if (btnComp) btnComp.addEventListener('click', () => {
            showComparison = !showComparison;
            btnComp.classList.toggle('active', showComparison);
            if (!showComparison) {
                compData.active = false;
                if (phaseChart) {
                    phaseChart.data.datasets[1].data = [];
                    phaseChart.update('none');
                }
            }
        });
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '模擬時間 TIME', id: 'cardTime', unit: 's', highlight: true },
        { label: '擺動角度 ANGLE', id: 'cardAngle', unit: '°' },
        { label: '角速度 ANG_VEL', id: 'cardOmega', unit: 'rad/s' },
        { label: '量測週期 T', id: 'cardPeriod', unit: 's', highlight: true },
    ]);

    // ==========================================================================
    // E. 圖表
    // ==========================================================================
    PhysicsUtils.prepareChartContainer('chartContainer', [
        { canvasId: 'angleChart', title: 'ANGLE-TIME GRAPH' },
        { canvasId: 'phaseChart', title: 'PHASE PORTRAIT (θ vs ω)' },
        { canvasId: 'energyChart', title: 'ENERGY BAR' },
    ]);

    const a0Rad = initAngleDeg * Math.PI / 180;
    const initOmegaMax = Math.sqrt(2 * gravity / length * (1 - Math.cos(a0Rad)));

    // 角度-時間圖
    const angleChartObj = PhysicsUtils.createChart({
        canvasId: 'angleChart',
        label: '角度 θ (°)',
        borderColor: '#2563eb',
        xTitle: '時間 t (s)',
        yTitle: '角度 θ (°)',
        maxPoints: 400
    });
    const angleChart = angleChartObj ? angleChartObj.chart : null;
    const pushAngle = angleChartObj ? angleChartObj.pushData : () => {};

    // 相空間圖
    let phaseChart = null;
    const phaseCanvas = document.getElementById('phaseChart');
    if (phaseCanvas && typeof Chart !== 'undefined') {
        phaseChart = new Chart(phaseCanvas, {
            type: 'line',
            data: {
                datasets: [{
                    label: '數值解',
                    data: [],
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0,
                    fill: false
                }, {
                    label: '小角度近似',
                    data: [],
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    tension: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: '角度 θ (°)', font: { family: 'monospace', weight: '700' } },
                        min: -initAngleDeg * 1.2,
                        max: initAngleDeg * 1.2,
                        ticks: { font: { family: 'monospace' } }
                    },
                    y: {
                        type: 'linear',
                        title: { display: true, text: '角速度 ω (rad/s)', font: { family: 'monospace', weight: '700' } },
                        min: -initOmegaMax * 1.2,
                        max: initOmegaMax * 1.2,
                        ticks: { font: { family: 'monospace' } }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { font: { family: 'monospace', size: 11 } } }
                }
            }
        });
    }

    // 能量長條圖
    let energyChart = null;
    const initEnergy = gravity * length * (1 - Math.cos(a0Rad));
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
                        max: initEnergy * 1.05,
                        title: { display: true, text: '能量 (J/kg)', font: { family: 'monospace', weight: '700' } },
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
    const SCALE = 120;

    function getBallPos() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const ox = w * 0.5;
        const oy = h * 0.18;
        const lp = length * SCALE;
        return {
            x: ox + lp * Math.sin(angle),
            y: oy + lp * Math.cos(angle),
            ox, oy, lp
        };
    }

    function getForces() {
        const T = gravity * Math.cos(angle) + length * angVel * angVel;
        const Ft = -gravity * Math.sin(angle);
        const Fg_r = -gravity * Math.cos(angle);
        return { T, Ft, Fg_r };
    }

    function detectPeriod() {
        if (prevAngle < 0 && angle >= 0 && Math.abs(angle) < 0.3) {
            crossings.push(simTime);
            if (crossings.length > 10) crossings.shift();
            if (crossings.length >= 3) {
                const p = crossings[crossings.length - 1] - crossings[crossings.length - 3];
                if (p > 0.1 && p < 20) measuredPeriod = p / 2;
            }
        }
    }

    function physicsStep(dt) {
        prevAngle = angle;
        const alpha = -(gravity / length) * Math.sin(angle) - dampingCoeff * angVel;
        angVel += alpha * dt;
        angle += angVel * dt;
        simTime += dt;
        detectPeriod();
    }

    function getSmallAngleResult(t) {
        const theta0 = compData.startAngle;
        const omega0 = compData.omega0;
        const phi = compData.phi;
        const th = theta0 * Math.cos(omega0 * t + phi);
        const om = -theta0 * omega0 * Math.sin(omega0 * t + phi);
        return { theta: th * 180 / Math.PI, omega: om };
    }

    // ==========================================================================
    // G. 渲染
    // ==========================================================================
    function drawCeiling(ox, oy) {
        const cw = 100, ch = 10;
        const grad = ctx.createLinearGradient(ox - cw / 2, oy - ch, ox - cw / 2, oy);
        grad.addColorStop(0, '#a0845c');
        grad.addColorStop(0.5, '#c9a96e');
        grad.addColorStop(1, '#8b7355');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(ox - cw / 2, oy - ch, cw, ch, 3);
        ctx.fill();
    }

    function drawRefLine(ox, oy, lp) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox, oy + lp + 30);
        ctx.stroke();
        ctx.restore();
    }

    function drawAngleArc(ox, oy) {
        if (Math.abs(angle) < 0.02) return;
        const r = 45;
        const s = Math.PI / 2;
        const e = Math.PI / 2 - angle;
        ctx.beginPath();
        ctx.arc(ox, oy, r, Math.min(s, e), Math.max(s, e));
        ctx.strokeStyle = 'rgba(37,99,235,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        const mid = (s + e) / 2;
        const tr = r + 12;
        ctx.fillStyle = 'rgba(37,99,235,0.7)';
        ctx.font = '600 12px "Inter", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((angle * 180 / Math.PI).toFixed(1) + '°', ox + tr * Math.cos(mid), oy + tr * Math.sin(mid));
    }

    function drawTrail() {
        for (let i = 1; i < trail.length; i++) {
            const a = i / trail.length * 0.35;
            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.strokeStyle = `rgba(37,99,235,${a})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    function drawString(ox, oy, bx, by) {
        const g = ctx.createLinearGradient(ox, oy, bx, by);
        g.addColorStop(0, '#555');
        g.addColorStop(1, '#999');
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    function drawBob(bx, by) {
        PhysicsUtils.drawBall(ctx, bx, by, 20, '#2563eb');
    }

    function drawForceArrows(bx, by) {
        const F_LEN = 40;
        const fg_y = gravity * F_LEN / 10;
        const { Ft, Fg_r } = getForces();
        const ftLen = Math.abs(Ft) * F_LEN / 10;
        const frLen = Math.abs(Fg_r) * F_LEN / 10;
        const tangDx = Math.cos(angle);
        const tangDy = -Math.sin(angle);
        const radDx = -Math.sin(angle);
        const radDy = -Math.cos(angle);

        // mg（灰色虛線）
        PhysicsUtils.drawArrow(ctx, bx, by, bx, by + fg_y, { color: '#64748b', width: 2, dashed: true, label: 'mg' });

        // 切向分量（紅色）
        if (ftLen > 3) {
            const s = Ft > 0 ? 1 : -1;
            PhysicsUtils.drawArrow(ctx, bx, by, bx + s * tangDx * ftLen, by + s * tangDy * ftLen, { color: '#ef4444', width: 3, shadow: true, label: 'mg·sinθ' });
        }

        // 徑向分量（紫色）
        if (frLen > 3) {
            PhysicsUtils.drawArrow(ctx, bx, by, bx + radDx * frLen, by + radDy * frLen, { color: '#8b5cf6', width: 3, label: 'mg·cosθ' });
        }

        // 張力（綠色）
        const tLen = Math.abs(getForces().T) * F_LEN / 10;
        if (tLen > 3) {
            PhysicsUtils.drawArrow(ctx, bx, by, bx + radDx * tLen, by + radDy * tLen, { color: '#22c55e', width: 3, label: 'T' });
        }
    }

    function drawComparisonPendulum(ox, oy) {
        if (!compData.active || !isRunning) return;
        const r = getSmallAngleResult(simTime);
        if (Math.abs(r.theta) > 90) return;
        const th = r.theta * Math.PI / 180;
        const lp = length * SCALE;
        const cx = ox + lp * Math.sin(th);
        const cy = oy + lp * Math.cos(th);

        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.restore();
    }

    function drawPeriodDisplay(lp) {
        if (measuredPeriod <= 0) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const pY = h * 0.18 + lp + 50;
        ctx.font = '700 14px "Inter", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        const theo = 2 * Math.PI * Math.sqrt(length / gravity);
        ctx.fillText(`T(量測) = ${measuredPeriod.toFixed(3)}s　T(理論) = ${theo.toFixed(3)}s`, w * 0.5, pY);
    }

    // --- 主場景渲染 ---
    function drawScene() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const p = getBallPos();

        if (isRunning) {
            trail.push({ x: p.x, y: p.y });
            if (trail.length > 200) trail.shift();
        }

        drawCeiling(p.ox, p.oy);
        drawRefLine(p.ox, p.oy, p.lp);
        drawAngleArc(p.ox, p.oy);
        drawTrail();
        drawComparisonPendulum(p.ox, p.oy);
        drawString(p.ox, p.oy, p.x, p.y);
        drawBob(p.x, p.y);
        if (showForces) drawForceArrows(p.x, p.y);
        drawPeriodDisplay(p.lp);
    }

    // --- 圖表更新 ---
    function updateCharts() {
        const angleDeg = angle * 180 / Math.PI;

        // 角度圖
        pushAngle(simTime.toFixed(2), angleDeg);

        // 相空間
        if (phaseChart) {
            phaseChart.data.datasets[0].data.push({ x: angleDeg, y: angVel });
            if (phaseChart.data.datasets[0].data.length > 500) phaseChart.data.datasets[0].data.shift();

            if (showComparison && compData.active && Math.abs(angleDeg) < 45) {
                const r = getSmallAngleResult(simTime);
                phaseChart.data.datasets[1].data.push({ x: r.theta, y: r.omega });
                if (phaseChart.data.datasets[1].data.length > 500) phaseChart.data.datasets[1].data.shift();
            }
            phaseChart.update('none');
        }

        // 能量
        if (energyChart) {
            const KE = 0.5 * length * length * angVel * angVel;
            const PE = gravity * length * (1 - Math.cos(angle));
            energyChart.data.datasets[0].data = [KE, PE, KE + PE];
            energyChart.update('none');
        }
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
            // 8 步小步積分
            const subSteps = 8;
            const subDt = dt / subSteps;
            for (let i = 0; i < subSteps; i++) physicsStep(subDt);

            // 更新量測週期顯示
            if (measuredPeriod > 0 && dashPeriod) {
                const theo = 2 * Math.PI * Math.sqrt(length / gravity);
                dashPeriod.textContent = measuredPeriod.toFixed(2);
            }
        }

        // 卡片更新
        updateCards({
            cardTime: simTime.toFixed(2),
            cardAngle: (angle * 180 / Math.PI).toFixed(1),
            cardOmega: angVel.toFixed(3),
            cardPeriod: measuredPeriod > 0 ? measuredPeriod.toFixed(3) : '—'
        });

        // 渲染
        PhysicsUtils.beginFrame(ctx, canvas);
        drawScene();

        // 每 3 幀更新圖表
        if (frameCount++ % 3 === 0 && isRunning && !isPaused) updateCharts();

        animationFrameId = requestAnimationFrame(loop);
    }

    let frameCount = 0;
    const dashPeriod = document.getElementById('cardPeriod');

    // ==========================================================================
    // I. 按鈕事件
    // ==========================================================================
    PhysicsUtils.setupStartBtn('startBtn', 'pauseBtn', state, () => {
        isRunning = true;
        isPaused = false;
        resetState();
        if (showComparison) {
            compData.active = true;
            compData.startAngle = initAngleDeg * Math.PI / 180;
            compData.omega0 = Math.sqrt(gravity / length);
            compData.phi = 0;
            compData.length = length;
            compData.gravity = gravity;
        }
        if (angleChart) {
            angleChart.data.labels = [];
            angleChart.data.datasets[0].data = [];
            angleChart.options.scales.y.min = -initAngleDeg * 1.1;
            angleChart.options.scales.y.max = initAngleDeg * 1.1;
            angleChart.update('none');
        }
        if (phaseChart) {
            phaseChart.data.datasets[0].data = [];
            phaseChart.data.datasets[1].data = [];
            const omegaMax = Math.sqrt(2 * gravity / length * (1 - Math.cos(initAngleDeg * Math.PI / 180)));
            phaseChart.options.scales.x.min = -initAngleDeg * 1.2;
            phaseChart.options.scales.x.max = initAngleDeg * 1.2;
            phaseChart.options.scales.y.min = -omegaMax * 1.2;
            phaseChart.options.scales.y.max = omegaMax * 1.2;
            phaseChart.update('none');
        }
        if (energyChart) {
            energyChart.data.datasets[0].data = [0, 0, 0];
            const ie = gravity * length * (1 - Math.cos(initAngleDeg * Math.PI / 180));
            energyChart.options.scales.x.max = ie * 1.05;
            energyChart.update('none');
        }
        lastTimestamp = performance.now();
    });

    PhysicsUtils.setupPauseBtn('pauseBtn', state, loop, paused => isPaused = paused);

    PhysicsUtils.setupResetBtn('resetBtn', () => {
        isRunning = false;
        isPaused = false;
        state.isRunning = false;
        state.isPaused = false;
        resetState();
        compData.active = false;

        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        document.getElementById('pauseBtn').style.backgroundColor = '#ffffff';
        document.getElementById('pauseBtn').style.color = '#000000';
        document.getElementById('pauseBtn').style.border = '1px solid #000000';

        updateCards({ cardTime: '0.00', cardAngle: initAngleDeg.toFixed(0), cardOmega: '0.000', cardPeriod: '—' });

        if (angleChartObj) angleChartObj.clear();
        if (phaseChart) {
            phaseChart.data.datasets[0].data = [];
            phaseChart.data.datasets[1].data = [];
            phaseChart.options.scales.x.min = -initAngleDeg * 1.2;
            phaseChart.options.scales.x.max = initAngleDeg * 1.2;
            const omegaMax = Math.sqrt(2 * gravity / length * (1 - Math.cos(initAngleDeg * Math.PI / 180)));
            phaseChart.options.scales.y.min = -omegaMax * 1.2;
            phaseChart.options.scales.y.max = omegaMax * 1.2;
            phaseChart.update();
        }
        if (energyChart) {
            energyChart.data.datasets[0].data = [0, 0, 0];
            const ie = gravity * length * (1 - Math.cos(initAngleDeg * Math.PI / 180));
            energyChart.options.scales.x.max = ie * 1.05;
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

initPendulum2();
