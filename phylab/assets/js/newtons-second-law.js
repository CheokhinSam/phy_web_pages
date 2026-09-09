/**
 * ⚛️ 牛頓第二運動定律 (F=ma)
 * 水平面上物體受力運動模擬
 */
function initNewtonsSecondLaw() {
    // ==========================================================================
    // A. 初始化
    // ==========================================================================
    const { canvas, ctx, ctrlPanel, guardEl } = PhysicsUtils.initCanvas();
    if (!canvas) return;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // B. 狀態變數
    // ==========================================================================
    let appliedForce = 10;
    let mass = 2;
    let mu = 0.1;
    const g = 9.8;

    let position = 0;
    let velocity = 0;
    let acceleration = 0;
    let simTime = 0;
    let isPaused = true;
    let lastTimestamp = 0;
    let animationFrameId;
    let frameCount = 0;

    const PX_PER_M = 50;

    // ==========================================================================
    // C. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>施力 <i>F</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="fVal" style="color: #ef4444;">10.0</span> N
                    </span>
                </label>
                <input type="range" id="fSlider" min="0" max="50" step="0.5" value="10">
            </div>
            <div class="control-box">
                <label>
                    <span>質量 <i>m</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="mVal" style="color: #2563eb;">2.0</span> kg
                    </span>
                </label>
                <input type="range" id="mSlider" min="0.5" max="10" step="0.1" value="2">
            </div>
            <div class="control-box">
                <label>
                    <span>摩擦係數 <i>μ</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="muVal" style="color: #8b5cf6;">0.10</span>
                    </span>
                </label>
                <input type="range" id="muSlider" min="0" max="0.5" step="0.01" value="0.1">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 12px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; letter-spacing: 1px;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            ${PhysicsUtils.formulaBox('牛頓第二定律', 'F_{net} = ma \\quad \\Rightarrow \\quad a = \\frac{F - \\mu mg}{m}')}
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        PhysicsUtils.bindSlider('fSlider', 'fVal', v => appliedForce = v, v => v.toFixed(1));
        PhysicsUtils.bindSlider('mSlider', 'mVal', v => mass = v, v => v.toFixed(1));
        PhysicsUtils.bindSlider('muSlider', 'muVal', v => mu = v, v => v.toFixed(2));
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '時間 TIME', id: 'cardTime', unit: 's' },
        { label: '淨力 F_net', id: 'cardFnet', unit: 'N', highlight: true },
        { label: '加速度 a', id: 'cardAcc', unit: 'm/s²', highlight: true },
        { label: '速度 v', id: 'cardV', unit: 'm/s' },
        { label: '位移 x', id: 'cardX', unit: 'm' },
        { label: '摩擦力 f', id: 'cardFric', unit: 'N' },
    ]);

    // ==========================================================================
    // E. 圖表
    // ==========================================================================
    PhysicsUtils.prepareChartContainer('chartContainer', [
        { canvasId: 'vChart', title: 'VELOCITY-TIME GRAPH' },
        { canvasId: 'aChart', title: 'ACCELERATION-TIME GRAPH' }
    ]);

    let vChart = null;
    let aChart = null;
    setTimeout(() => {
        vChart = PhysicsUtils.createChart({
            canvasId: 'vChart',
            label: '速度 v (m/s)',
            borderColor: '#ef4444',
            xTitle: '時間 t (s)',
            yTitle: '速度 v (m/s)'
        });
        aChart = PhysicsUtils.createChart({
            canvasId: 'aChart',
            label: '加速度 a (m/s²)',
            borderColor: '#2563eb',
            xTitle: '時間 t (s)',
            yTitle: '加速度 a (m/s²)'
        });
    }, 50);

    // ==========================================================================
    // F. 物理計算
    // ==========================================================================
    function calcPhysics() {
        const friction = mu * mass * g;
        const netForce = appliedForce - friction;
        const acc = netForce / mass;
        return { friction, netForce, acc };
    }

    // ==========================================================================
    // G. 渲染
    // ==========================================================================
    function drawSim() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const { friction, netForce, acc } = calcPhysics();

        PhysicsUtils.beginFrame(ctx, canvas);

        // --- 地面 ---
        const groundY = H * 0.6;
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
        groundGrad.addColorStop(0, '#cbd5e1');
        groundGrad.addColorStop(0.4, '#94a3b8');
        groundGrad.addColorStop(1, '#64748b');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, W, H - groundY);

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // 地面紋理
        ctx.save();
        ctx.strokeStyle = 'rgba(71,85,105,0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(x + 20, H);
            ctx.stroke();
        }
        ctx.restore();

        // --- 物體 ---
        const blockW = 50 + mass * 6;
        const blockH = 36 + mass * 3;
        const blockX = 80 + position * PX_PER_M;
        const blockY = groundY - blockH;

        const blockGrad = ctx.createLinearGradient(blockX, blockY, blockX, groundY);
        blockGrad.addColorStop(0, '#d4a56a');
        blockGrad.addColorStop(0.3, '#c08b50');
        blockGrad.addColorStop(0.6, '#a0723a');
        blockGrad.addColorStop(1, '#7a5528');
        ctx.fillStyle = blockGrad;
        ctx.beginPath();
        ctx.roundRect(blockX, blockY, blockW, blockH, 4);
        ctx.fill();
        ctx.strokeStyle = '#5c3d1a';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${Math.max(12, blockH * 0.35)}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${mass.toFixed(1)} kg`, blockX + blockW / 2, blockY + blockH / 2);

        // --- 力箭頭 ---
        // 施力（紅色，方塊上方，向右）
        if (appliedForce > 0.1) {
            const fLen = Math.min(appliedForce * 2.5, 150);
            const fy = blockY - 25;
            PhysicsUtils.drawArrow(ctx, blockX + blockW / 2, fy, blockX + blockW / 2 + fLen, fy, {
                color: '#ef4444', width: 3, shadow: true
            });
            ctx.font = '700 13px "Inter", monospace';
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'left';
            ctx.fillText(`F = ${appliedForce.toFixed(1)} N`, blockX + blockW / 2 + fLen + 8, fy + 4);
        }

        // 摩擦力（橙色，方塊下方，向左）
        if (friction > 0.1) {
            const frLen = Math.min(friction * 2.5, 100);
            const fy = blockY + blockH + 25;
            PhysicsUtils.drawArrow(ctx, blockX + blockW / 2, fy, blockX + blockW / 2 - frLen, fy, {
                color: '#f59e0b', width: 2.5
            });
            ctx.font = '700 12px "Inter", monospace';
            ctx.fillStyle = '#f59e0b';
            ctx.textAlign = 'right';
            ctx.fillText(`f = ${friction.toFixed(1)} N`, blockX + blockW / 2 - frLen - 8, fy + 4);
        }

        // 加速度（藍色，最上方）
        if (Math.abs(acc) > 0.05) {
            const aLen = Math.min(Math.abs(acc) * 12, 120);
            const aDir = acc > 0 ? 1 : -1;
            const ay = blockY - 55;
            PhysicsUtils.drawArrow(ctx, blockX + blockW / 2, ay, blockX + blockW / 2 + aDir * aLen, ay, {
                color: '#2563eb', width: 3, shadow: true
            });
            ctx.font = '700 13px "Inter", monospace';
            ctx.fillStyle = '#2563eb';
            ctx.textAlign = 'center';
            ctx.fillText(`a = ${acc.toFixed(2)} m/s²`, blockX + blockW / 2 + aDir * aLen / 2, ay - 16);
        }

        // --- 刻度尺 ---
        ctx.font = '600 10px "Inter", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        for (let m = 0; m <= 20; m++) {
            const sx = 80 + m * PX_PER_M;
            if (sx > W - 20) break;
            ctx.fillText(`${m}m`, sx, groundY + 18);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(sx, groundY);
            ctx.lineTo(sx, groundY + 6);
            ctx.stroke();
        }

        // --- 標題 ---
        ctx.font = '900 16px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('NEWTON 2ND LAW / 牛頓第二定律', 20, 30);

        // 狀態
        ctx.font = '700 12px "Inter", monospace';
        ctx.textAlign = 'right';
        if (!isPaused && acc > 0.05) {
            ctx.fillStyle = '#16a34a';
            ctx.fillText('● 加速中', W - 20, 30);
        } else if (!isPaused && Math.abs(acc) < 0.05) {
            ctx.fillStyle = '#f59e0b';
            ctx.fillText('● 等速 / 靜止', W - 20, 30);
        } else if (!isPaused && acc < -0.05) {
            ctx.fillStyle = '#ef4444';
            ctx.fillText('● 減速中', W - 20, 30);
        } else {
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('● 等待開始', W - 20, 30);
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

        if (!isPaused) {
            const { friction, netForce, acc } = calcPhysics();
            acceleration = acc;

            velocity += acceleration * dt;

            // 淨力 ≤ 0 且速度接近 0 → 停止
            if (velocity < 0.01 && netForce <= 0) {
                velocity = 0;
                acceleration = 0;
            }
            // 淨力 < 0 但物體在動 → 減速
            if (netForce < 0 && velocity > 0) {
                // 正常減速，不額外處理
            }

            position += velocity * dt;
            if (position < 0) { position = 0; velocity = 0; }

            simTime += dt;

            frameCount++;
            if (frameCount % 3 === 0) {
                if (vChart) vChart.pushData(simTime.toFixed(2), velocity);
                if (aChart) aChart.pushData(simTime.toFixed(2), acceleration);
            }
        }

        drawSim();

        const { friction, netForce } = calcPhysics();
        updateCards({
            cardTime: simTime.toFixed(2),
            cardFnet: netForce.toFixed(2),
            cardAcc: acceleration.toFixed(2),
            cardV: velocity.toFixed(2),
            cardX: position.toFixed(2),
            cardFric: friction.toFixed(2),
        });

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // I. 按鈕事件
    // ==========================================================================
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            isPaused = false;
            startBtn.style.display = 'none';
            if (pauseBtn) {
                pauseBtn.style.display = 'block';
                pauseBtn.textContent = '暫停 PAUSE';
                pauseBtn.style.backgroundColor = '#ffffff';
                pauseBtn.style.color = '#000000';
                pauseBtn.style.border = '1px solid #000000';
            }
            lastTimestamp = performance.now();
        });
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            if (isPaused) {
                pauseBtn.textContent = '播放 PLAY';
                pauseBtn.style.backgroundColor = '#2563eb';
                pauseBtn.style.color = '#ffffff';
                pauseBtn.style.border = 'none';
            } else {
                pauseBtn.textContent = '暫停 PAUSE';
                pauseBtn.style.backgroundColor = '#ffffff';
                pauseBtn.style.color = '#000000';
                pauseBtn.style.border = '1px solid #000000';
                lastTimestamp = performance.now();
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            isPaused = true;
            simTime = 0;
            position = 0;
            velocity = 0;
            acceleration = 0;
            frameCount = 0;

            if (startBtn) startBtn.style.display = 'block';
            if (pauseBtn) {
                pauseBtn.style.display = 'none';
                pauseBtn.textContent = '暫停 PAUSE';
                pauseBtn.style.backgroundColor = '#ffffff';
                pauseBtn.style.color = '#000000';
                pauseBtn.style.border = '1px solid #000000';
            }

            if (vChart) vChart.clear();
            if (aChart) aChart.clear();

            updateCards({
                cardTime: '0.00',
                cardFnet: '0.00',
                cardAcc: '0.00',
                cardV: '0.00',
                cardX: '0.00',
                cardFric: (mu * mass * g).toFixed(2),
            });
        });
    }

    // ==========================================================================
    // J. 啟動
    // ==========================================================================
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    PhysicsUtils.setupCleanup(animationFrameId, resizeCanvas);
}

initNewtonsSecondLaw();
