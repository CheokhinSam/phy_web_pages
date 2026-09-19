/**
 * 🌀 彈簧振子
 * 水平彈簧-質量系統，按開始後振動
 */
function initSpringOscillator() {
    // ==========================================================================
    // A. 初始化
    // ==========================================================================
    const { canvas, ctx, ctrlPanel, guardEl } = PhysicsUtils.initCanvas();
    if (!canvas) return;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // B. 狀態變數
    // ==========================================================================
    let k = 20;           // 彈簧常數 (N/m)
    let mass = 1.0;       // 質量 (kg)

    let x = 0;            // 位移 (m)，正 = 右
    let vel = 0;          // 速度 (m/s)
    let simTime = 0;
    let isRunning = false;
    let isPaused = false;
    let lastTimestamp = performance.now();
    let animationFrameId;
    let frameCount = 0;

    const state = { isRunning, isPaused, lastTimestamp };

    const PX_PER_M = 150;
    const BALL_R = 24;

    // ==========================================================================
    // C. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>彈簧常數 <i>k</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="kVal" style="color: #2563eb;">20.0</span> N/m
                    </span>
                </label>
                <input type="range" id="kSlider" min="5" max="80" step="1" value="20">
            </div>
            <div class="control-box">
                <label>
                    <span>質量 <i>m</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="mVal" style="color: #2563eb;">1.0</span> kg
                    </span>
                </label>
                <input type="range" id="mSlider" min="0.2" max="5.0" step="0.1" value="1.0">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; letter-spacing: 1px;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            <div class="control-box" id="shmExprBox" style="padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.8; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">簡諧運動參數</div>
                <div style="font-family: monospace; font-size: 0.8rem;">
                    <div>角頻率 <span style="color: #2563eb; font-weight: 800;">ω</span> = <span id="shmOmega" style="color: #2563eb; font-weight: 800;">4.47</span> rad/s</div>
                    <div>週期 <span style="color: #2563eb; font-weight: 800;">T</span> = <span id="shmT" style="color: #2563eb; font-weight: 800;">1.405</span> s</div>
                </div>
            </div>
            ${PhysicsUtils.formulaBox('運動方程', 'm\\ddot{x} + b\\dot{x} + kx = 0')}
            ${PhysicsUtils.formulaBox('週期公式', 'T = 2\\pi\\sqrt{\\frac{m}{k}}')}
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        PhysicsUtils.bindSlider('kSlider', 'kVal', v => { k = v; updateSHMExpr(); }, v => v.toFixed(1));
        PhysicsUtils.bindSlider('mSlider', 'mVal', v => { mass = v; updateSHMExpr(); }, v => v.toFixed(1));

        updateSHMExpr();
    }

    function updateSHMExpr() {
        const omega = Math.sqrt(k / mass);
        const T = 2 * Math.PI / omega;
        const el = id => document.getElementById(id);
        if (el('shmOmega')) el('shmOmega').textContent = omega.toFixed(2);
        if (el('shmT')) el('shmT').textContent = T.toFixed(3);
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '時間 TIME', id: 'cardTime', unit: 's', highlight: true },
        { label: '位移 x', id: 'cardX', unit: 'm', highlight: true },
        { label: '速度 v', id: 'cardV', unit: 'm/s' },
        { label: '加速度 a', id: 'cardA', unit: 'm/s²' },
    ]);

    // ==========================================================================
    // E. 圖表
    // ==========================================================================
    PhysicsUtils.prepareChartContainer('chartContainer', [
        { canvasId: 'xtChart', title: 'DISPLACEMENT-TIME GRAPH' }
    ]);
    const xtChartObj = setTimeout(() => PhysicsUtils.createChart({
        canvasId: 'xtChart',
        label: '位移 x (m)',
        borderColor: '#2563eb',
        xTitle: '時間 t (s)',
        yTitle: '位移 x (m)',
        maxPoints: 400
    }), 50);

    // ==========================================================================
    // F. 物理計算
    // ==========================================================================
    function calcAccel(xVal) {
        return -k * xVal / mass;
    }

    // ==========================================================================
    // G. 渲染
    // ==========================================================================
    function getLayout() {
        const W = canvas.cssWidth;
        const wallX = W * 0.1;
        const eqX = W * 0.42;
        const ballX = eqX + x * PX_PER_M;
        const centerY = canvas.cssHeight * 0.45;
        return { W, wallX, eqX, ballX, centerY };
    }

    function drawSpring(x1, y1, x2) {
        const dx = x2 - x1;
        const len = Math.abs(dx);
        if (len < 10) return;

        const coils = 14;
        const amp = 14;
        const leadIn = 15;
        const leadOut = 15;
        const springLen = len - leadIn - leadOut;

        ctx.save();
        ctx.translate(x1, y1);

        const grad = ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0, '#666');
        grad.addColorStop(0.5, '#999');
        grad.addColorStop(1, '#666');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;
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

    function drawSim() {
        const { W, wallX, eqX, ballX, centerY } = getLayout();

        // 地面
        const floorY = centerY + BALL_R + 8;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(wallX - 10, floorY);
        ctx.lineTo(W - 20, floorY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wallX - 10, floorY + 2);
        ctx.lineTo(W - 20, floorY + 2);
        ctx.stroke();

        // 牆壁
        const wallW = 18;
        const wallH = 100;
        const wallGrad = ctx.createLinearGradient(wallX - wallW, 0, wallX, 0);
        wallGrad.addColorStop(0, '#a0845c');
        wallGrad.addColorStop(0.5, '#c9a96e');
        wallGrad.addColorStop(1, '#8b7355');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(wallX - wallW, centerY - wallH / 2, wallW, wallH);

        ctx.strokeStyle = '#7a6548';
        ctx.lineWidth = 1;
        for (let i = 0; i < 7; i++) {
            const yy = centerY - wallH / 2 + 5 + i * 15;
            ctx.beginPath();
            ctx.moveTo(wallX - wallW, yy);
            ctx.lineTo(wallX - 4, yy + 12);
            ctx.stroke();
        }

        // 平衡位置虛線
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(eqX, centerY - 65);
        ctx.lineTo(eqX, centerY + 85);
        ctx.stroke();
        ctx.restore();

        ctx.font = '700 13px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(37, 99, 235, 0.5)';
        ctx.textAlign = 'center';
        ctx.fillText('平衡位置', eqX, centerY - 70);

        // 彈簧
        drawSpring(wallX, centerY, ballX - BALL_R, centerY);

        // 速度箭頭（球上方）
        if (Math.abs(vel) > 0.15) {
            const vArrowLen = vel * PX_PER_M * 0.25;
            PhysicsUtils.drawArrow(ctx, ballX, centerY - BALL_R - 18, ballX + vArrowLen, centerY - BALL_R - 18, {
                color: '#ea580c',
                width: 3.5,
                shadow: true,
                label: 'v'
            });
        }

        // 彈力箭頭（球下方第一層）
        if (Math.abs(x) > 0.02) {
            const fSpring = -k * x;
            const fArrowLen = fSpring * PX_PER_M * 0.008;
            PhysicsUtils.drawArrow(ctx, ballX, centerY + BALL_R + 18, ballX + fArrowLen, centerY + BALL_R + 18, {
                color: '#8b5cf6',
                width: 3.5,
                label: 'F'
            });
        }

        // 加速度箭頭（球下方第二層）
        const acc = calcAccel(x);
        if (Math.abs(acc) > 0.1) {
            const aArrowLen = acc * PX_PER_M * 0.008;
            PhysicsUtils.drawArrow(ctx, ballX, centerY + BALL_R + 48, ballX + aArrowLen, centerY + BALL_R + 48, {
                color: '#0ea5e9',
                width: 3.5,
                shadow: true,
                label: 'a'
            });
        }

        // 位移標示（球下方第三層）
        if (Math.abs(x) > 0.02) {
            const arrowColor = x > 0 ? '#ef4444' : '#22c55e';
            PhysicsUtils.drawArrow(ctx, eqX, centerY + BALL_R + 78, ballX, centerY + BALL_R + 78, {
                color: arrowColor,
                width: 3.5,
                label: 'x = ' + x.toFixed(2) + ' m'
            });
        }

        // 小球
        PhysicsUtils.drawBall(ctx, ballX, centerY, BALL_R, '#2563eb');

        // 圖例
        const legendX = W - 160;
        const legendY = 14;
        ctx.font = '700 12px "Inter", sans-serif';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#ea580c';
        ctx.fillRect(legendX, legendY, 14, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('速度 v', legendX + 20, legendY + 5);

        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(legendX, legendY + 18, 14, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('彈力 F', legendX + 20, legendY + 23);

        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(legendX, legendY + 36, 14, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('加速度 a', legendX + 20, legendY + 41);

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(legendX, legendY + 54, 14, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('位移 x', legendX + 20, legendY + 59);
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
            for (let i = 0; i < subSteps; i++) {
                const a = calcAccel(x);
                vel += a * subDt;
                x += vel * subDt;
            }
            simTime += dt;
        }

        PhysicsUtils.beginFrame(ctx, canvas);
        drawSim();

        const a = calcAccel(x);
        updateCards({
            cardTime: simTime.toFixed(2),
            cardX: x.toFixed(3),
            cardV: vel.toFixed(3),
            cardA: a.toFixed(3)
        });

        if (frameCount++ % 3 === 0 && isRunning) {
            const chart = typeof xtChartObj === 'object' && xtChartObj !== null ? xtChartObj : null;
            if (chart && chart.pushData) chart.pushData(simTime.toFixed(2), x);
        }

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // I. 按鈕事件
    // ==========================================================================
    PhysicsUtils.setupStartBtn('startBtn', 'pauseBtn', state, () => {
        isRunning = true;
        isPaused = false;
        x = 1.0;   // 初始位移 1m
        vel = 0;
        simTime = 0;
        lastTimestamp = performance.now();
    });

    PhysicsUtils.setupPauseBtn('pauseBtn', state, loop, paused => {
        isPaused = paused;
    });

    PhysicsUtils.setupResetBtn('resetBtn', () => {
        isRunning = false;
        isPaused = false;
        simTime = 0;
        x = 0;
        vel = 0;
        state.isRunning = false;
        state.isPaused = false;

        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        document.getElementById('pauseBtn').style.backgroundColor = '#ffffff';
        document.getElementById('pauseBtn').style.color = '#000000';
        document.getElementById('pauseBtn').style.border = '1px solid #000000';

        const chart = typeof xtChartObj === 'object' && xtChartObj !== null ? xtChartObj : null;
        if (chart && chart.clear) chart.clear();
        updateCards({ cardTime: '0.00', cardX: '0.000', cardV: '0.000', cardA: '0.000' });
    });

    // ==========================================================================
    // J. 啟動
    // ==========================================================================
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    PhysicsUtils.setupCleanup(animationFrameId, resizeCanvas);
}

initSpringOscillator();
