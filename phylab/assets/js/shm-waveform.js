/**
 * 🌀 簡諧運動圖像
 * 上方：彈簧振子動畫（按開始振動）
 * 下方：x-t 圖 + 相位控制，觀察波形平移
 */
function initSHMWaveform() {
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
    let dampingCoeff = 0; // 阻尼（預設 0 觀察純簡諧運動）
    let phase = 0;        // 相位 φ (rad)
    let amplitude = 1.0;  // 振幅 A (m)

    let x = 0;            // 位移 (m)
    let vel = 0;          // 速度 (m/s)
    let simTime = 0;
    let isRunning = false;
    let isPaused = false;
    let lastTimestamp = performance.now();
    let animationFrameId;
    let frameCount = 0;

    // x-t 資料點
    const xtData = [];
    const XT_MAX = 600;

    const state = { isRunning, isPaused, lastTimestamp };

    const PX_PER_M = 140;
    const BALL_R = 20;

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
            <div class="control-box">
                <label>
                    <span>相位 <i>φ</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="phiVal" style="color: #8b5cf6;">0</span>°
                    </span>
                </label>
                <input type="range" id="phiSlider" min="0" max="360" step="90" value="0">
                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #64748b; font-family: monospace; margin-top: 2px;">
                    <span>0</span><span>π/2</span><span>π</span><span>3π/2</span><span>2π</span>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>振幅 <i>A</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="ampVal" style="color: #2563eb;">1.00</span> m
                    </span>
                </label>
                <input type="range" id="ampSlider" min="0.2" max="1.5" step="0.05" value="1.0">
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
                    <div>頻率 <span style="color: #2563eb; font-weight: 800;">f</span> = <span id="shmF" style="color: #2563eb; font-weight: 800;">0.712</span> Hz</div>
                </div>
            </div>
            ${PhysicsUtils.formulaBox('位移公式', 'x(t) = A\\sin(\\omega t + \\phi)')}
            ${PhysicsUtils.formulaBox('週期公式', 'T = 2\\pi\\sqrt{\\frac{m}{k}}')}
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        PhysicsUtils.bindSlider('kSlider', 'kVal', v => { k = v; updateSHMExpr(); }, v => v.toFixed(1));
        PhysicsUtils.bindSlider('mSlider', 'mVal', v => { mass = v; updateSHMExpr(); }, v => v.toFixed(1));
        PhysicsUtils.bindSlider('phiSlider', 'phiVal', v => {
            phase = v * Math.PI / 180;
            const omega = Math.sqrt(k / mass);
            if (isRunning) {
                x = amplitude * Math.sin(omega * simTime + phase);
                vel = amplitude * omega * Math.cos(omega * simTime + phase);
            } else {
                x = amplitude * Math.sin(phase);
                vel = 0;
            }
        }, v => v.toFixed(0));
        PhysicsUtils.bindSlider('ampSlider', 'ampVal', v => { amplitude = v; }, v => v.toFixed(2));

        updateSHMExpr();
    }

    function updateSHMExpr() {
        const omega = Math.sqrt(k / mass);
        const T = 2 * Math.PI / omega;
        const f = 1 / T;
        const el = id => document.getElementById(id);
        if (el('shmOmega')) el('shmOmega').textContent = omega.toFixed(2);
        if (el('shmT')) el('shmT').textContent = T.toFixed(3);
        if (el('shmF')) el('shmF').textContent = f.toFixed(3);
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
    // F. 物理計算
    // ==========================================================================
    function calcAccel(xVal, vVal) {
        return (-k * xVal - dampingCoeff * vVal) / mass;
    }

    // ==========================================================================
    // G. 渲染
    // ==========================================================================
    function getLayout() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const simH = H * 0.48;
        const graphTop = simH + 8;
        const graphH = H - graphTop - 8;
        const wallX = W * 0.08;
        const eqX = W * 0.36;
        const ballX = eqX + x * PX_PER_M;
        const centerY = simH * 0.5;
        return { W, H, wallX, eqX, ballX, centerY, simH, graphTop, graphH };
    }

    function drawSpring(x1, y1, x2) {
        const dx = x2 - x1;
        const len = Math.abs(dx);
        if (len < 10) return;

        const coils = 13;
        const amp = 12;
        const leadIn = 12;
        const leadOut = 12;
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
        const floorY = centerY + BALL_R + 6;
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
        const wallW = 16;
        const wallH = 80;
        const wallGrad = ctx.createLinearGradient(wallX - wallW, 0, wallX, 0);
        wallGrad.addColorStop(0, '#a0845c');
        wallGrad.addColorStop(0.5, '#c9a96e');
        wallGrad.addColorStop(1, '#8b7355');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(wallX - wallW, centerY - wallH / 2, wallW, wallH);

        ctx.strokeStyle = '#7a6548';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const yy = centerY - wallH / 2 + 5 + i * 14;
            ctx.beginPath();
            ctx.moveTo(wallX - wallW, yy);
            ctx.lineTo(wallX - 3, yy + 11);
            ctx.stroke();
        }

        // 平衡位置虛線
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(eqX, centerY - 50);
        ctx.lineTo(eqX, centerY + 50);
        ctx.stroke();
        ctx.restore();

        ctx.font = '600 10px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(37, 99, 235, 0.45)';
        ctx.textAlign = 'center';
        ctx.fillText('平衡位置', eqX, centerY - 55);

        // 彈簧
        drawSpring(wallX, centerY, ballX - BALL_R, centerY);

        // 位移標示
        if (Math.abs(x) > 0.02) {
            const arrowColor = x > 0 ? '#ef4444' : '#22c55e';
            PhysicsUtils.drawArrow(ctx, eqX, centerY + 40, ballX, centerY + 40, {
                color: arrowColor,
                width: 2.5,
                label: 'x = ' + x.toFixed(2) + ' m'
            });
        }

        // 速度箭頭
        if (Math.abs(vel) > 0.15) {
            const vArrowLen = vel * PX_PER_M * 0.2;
            PhysicsUtils.drawArrow(ctx, ballX, centerY - BALL_R - 10, ballX + vArrowLen, centerY - BALL_R - 10, {
                color: '#ea580c',
                width: 2.5,
                shadow: true,
                label: 'v'
            });
        }

        // 彈力箭頭
        if (Math.abs(x) > 0.02) {
            const fSpring = -k * x;
            const fArrowLen = fSpring * PX_PER_M * 0.006;
            PhysicsUtils.drawArrow(ctx, ballX, centerY + BALL_R + 10, ballX + fArrowLen, centerY + BALL_R + 10, {
                color: '#8b5cf6',
                width: 2.5,
                label: 'F'
            });
        }

        // 小球
        PhysicsUtils.drawBall(ctx, ballX, centerY, BALL_R, '#2563eb');

        // 圖例
        const legendX = W - 140;
        const legendY = 12;
        ctx.font = '600 10px "Inter", sans-serif';
        ctx.textAlign = 'left';

        ctx.fillStyle = '#ea580c';
        ctx.fillRect(legendX, legendY, 12, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('速度 v', legendX + 18, legendY + 4);

        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(legendX, legendY + 14, 12, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('彈力 F', legendX + 18, legendY + 18);

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(legendX, legendY + 28, 12, 3);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('位移 x', legendX + 18, legendY + 32);
    }

    // --- x-t 圖 ---
    function drawXTGraph() {
        const { W, graphTop, graphH } = getLayout();
        const mL = 50;
        const mR = 16;
        const mT = 28;
        const mB = 32;
        const gL = mL;
        const gR = W - mR;
        const gT = graphTop + mT;
        const gB = graphTop + graphH - mB;
        const gW = gR - gL;
        const gH = gB - gT;
        const gMid = gT + gH / 2;

        const omega = Math.sqrt(k / mass);
        const T = 2 * Math.PI / omega;

        // 背景框
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(gL - 2, gT - 2, gW + 4, gH + 4);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(gL - 2, gT - 2, gW + 4, gH + 4);

        // 標題
        ctx.font = '800 11px "Inter", monospace';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'left';
        ctx.fillText('DISPLACEMENT-TIME GRAPH / 位移-時間圖', gL, graphTop + 14);

        // 中心線
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gL, gMid);
        ctx.lineTo(gR, gMid);
        ctx.stroke();

        // Y 軸標籤
        ctx.font = '600 10px "Inter", monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'right';
        ctx.fillText('+A', gL - 5, gT + 10);
        ctx.fillText('0', gL - 5, gMid + 4);
        ctx.fillText('-A', gL - 5, gB + 4);

        // X 軸：時間
        const tWin = 4 * T;
        const tStart = Math.max(0, simTime - tWin * 0.85);
        const tEnd = tStart + tWin;

        // 時間刻度
        const tStep = T;
        ctx.font = '600 9px "Inter", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        for (let tM = Math.ceil(tStart / tStep) * tStep; tM <= tEnd; tM += tStep) {
            const px = gL + ((tM - tStart) / tWin) * gW;
            if (px < gL || px > gR) continue;
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(px, gT);
            ctx.lineTo(px, gB);
            ctx.stroke();
            ctx.fillText(tM.toFixed(1), px, gB + 13);
        }
        ctx.fillText('t (s)', gR + 2, gB + 13);

        // 理論曲線：x(t) = A·cos(ωt + φ)
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (let px = gL; px <= gR; px += 2) {
            const t = tStart + ((px - gL) / gW) * tWin;
            const xVal = amplitude * Math.sin(omega * t + phase);
            const py = gMid - (xVal / amplitude) * (gH / 2 - 4);
            if (!started) { ctx.moveTo(px, py); started = true; }
            else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // 模擬軌跡（紅色）
        if (xtData.length > 1) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            let s2 = false;
            for (let i = 0; i < xtData.length; i++) {
                const d = xtData[i];
                if (d.t < tStart) continue;
                const px = gL + ((d.t - tStart) / tWin) * gW;
                const py = gMid - (d.x / amplitude) * (gH / 2 - 4);
                if (px < gL || px > gR) continue;
                if (!s2) { ctx.moveTo(px, py); s2 = true; }
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // 當前時間紅點
        if (simTime >= tStart && simTime <= tEnd) {
            const cPx = gL + ((simTime - tStart) / tWin) * gW;
            const cPy = gMid - (x / amplitude) * (gH / 2 - 4);

            ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(cPx, gT);
            ctx.lineTo(cPx, gB);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.beginPath();
            ctx.arc(cPx, cPy, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // 公式 + 相位顯示
        const phiDeg = (phase * 180 / Math.PI).toFixed(0);
        ctx.font = '700 11px "Inter", monospace';
        ctx.fillStyle = '#2563eb';
        ctx.textAlign = 'right';
        ctx.fillText('x(t) = A·sin(ωt + φ)', gR - 4, gT + 14);

        ctx.font = '800 12px "Inter", monospace';
        ctx.fillStyle = '#8b5cf6';
        ctx.fillText('φ = ' + phiDeg + '°', gR - 4, gT + 28);

        // 圖例
        const lX = gR - 150;
        const lY = gT + 40;
        ctx.font = '600 10px "Inter", sans-serif';
        ctx.textAlign = 'left';

        ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(lX, lY); ctx.lineTo(lX + 14, lY); ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.fillText('理論曲線', lX + 20, lY + 4);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(lX, lY + 14); ctx.lineTo(lX + 14, lY + 14); ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.fillText('模擬軌跡', lX + 20, lY + 18);
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
                const a = calcAccel(x, vel);
                vel += a * subDt;
                x += vel * subDt;
            }
            simTime += dt;

            if (frameCount % 2 === 0) {
                xtData.push({ t: simTime, x: x });
                if (xtData.length > XT_MAX) xtData.shift();
            }
        }

        PhysicsUtils.beginFrame(ctx, canvas);
        drawSim();
        drawXTGraph();

        const a = calcAccel(x, vel);
        updateCards({
            cardTime: simTime.toFixed(2),
            cardX: x.toFixed(3),
            cardV: vel.toFixed(3),
            cardA: a.toFixed(3)
        });

        frameCount++;
        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // I. 按鈕事件
    // ==========================================================================
    PhysicsUtils.setupStartBtn('startBtn', 'pauseBtn', state, () => {
        isRunning = true;
        isPaused = false;
        // 初始條件：x = A·sin(φ), v = Aω·cos(φ)
        const omega = Math.sqrt(k / mass);
        x = amplitude * Math.sin(phase);
        vel = amplitude * omega * Math.cos(phase);
        simTime = 0;
        xtData.length = 0;
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
        xtData.length = 0;
        state.isRunning = false;
        state.isPaused = false;

        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        document.getElementById('pauseBtn').style.backgroundColor = '#ffffff';
        document.getElementById('pauseBtn').style.color = '#000000';
        document.getElementById('pauseBtn').style.border = '1px solid #000000';

        updateCards({ cardTime: '0.00', cardX: '0.000', cardV: '0.000', cardA: '0.000' });
    });

    // ==========================================================================
    // J. 啟動
    // ==========================================================================
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    PhysicsUtils.setupCleanup(animationFrameId, resizeCanvas);
}

initSHMWaveform();
