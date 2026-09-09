/**
 * 📈 速度時間圖 — 觀察不同運動的速度-時間圖形特徵
 * 等速、等加速度、減速、靜止四種模式，即時繪製 v-t 圖。
 */
function initVelocityTimeGraph() {
    // ==========================================================================
    // A. 初始化
    // ==========================================================================
    const { canvas, ctx, ctrlPanel, guardEl } = PhysicsUtils.initCanvas();
    if (!canvas) return;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // B. 狀態變數
    // ==========================================================================
    let mode = 'constant';   // constant | accelerate | decelerate | stationary
    let v0 = 5;              // 初速度 (m/s)
    let a = 2;               // 加速度 (m/s²)
    let isRunning = false;
    let isPaused = true;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;
    let frameCount = 0;

    const state = { isRunning, isPaused, lastTimestamp };

    // 軌跡資料（用於 Canvas 上繪製 v-t 曲線）
    const trail = [];
    const maxTrail = 600;

    // ==========================================================================
    // C. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>運動模式</span>
                </label>
                <select id="modeSelect" style="width: 100%; padding: 8px; font-size: 0.9rem; font-weight: 700; border: 1px solid #000; background: #fff; cursor: pointer;">
                    <option value="constant">等速運動</option>
                    <option value="accelerate">等加速度運動</option>
                    <option value="decelerate">減速運動</option>
                    <option value="stationary">靜止</option>
                </select>
            </div>
            <div class="control-box" id="v0Box">
                <label>
                    <span>初速度 <i>v₀</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="v0Val" style="color: #2563eb;">5.0</span> m/s
                    </span>
                </label>
                <input type="range" id="v0Slider" min="-15" max="15" step="0.5" value="5">
            </div>
            <div class="control-box" id="aBox">
                <label>
                    <span>加速度 <i>a</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">2.0</span> m/s²
                    </span>
                </label>
                <input type="range" id="aSlider" min="-8" max="8" step="0.5" value="2">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            ${PhysicsUtils.formulaBox('核心公式', 'v = v_0 + at')}
            <div class="control-box" style="margin-top: 12px;">
                <button id="refBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; letter-spacing: 1px;">常見圖形 REFERENCE</button>
            </div>
            <div id="refPanel" style="display: none; margin-top: 12px; padding: 12px; background: #fff; border: 2px solid #000; border-radius: 6px;">
                <div style="font-weight: 900; font-size: 0.85rem; margin-bottom: 10px; letter-spacing: 0.5px;">常見 v-t 圖形</div>
                <div id="refGrid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;"></div>
            </div>
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        // 常見圖形參考面板
        const refBtn = document.getElementById('refBtn');
        const refPanel = document.getElementById('refPanel');
        refBtn.addEventListener('click', () => {
            refPanel.style.display = refPanel.style.display === 'none' ? 'block' : 'none';
        });

        // 繪製參考圖形
        const refData = [
            { name: '靜止', desc: 'v = 0', fn: t => 0, color: '#94a3b8' },
            { name: '等速（正向）', desc: 'v > 0', fn: t => 5, color: '#22c55e' },
            { name: '等速（反向）', desc: 'v < 0', fn: t => -5, color: '#8b5cf6' },
            { name: '等加速度', desc: 'a > 0', fn: t => 2 * t, color: '#2563eb' },
            { name: '減速停止', desc: 'a < 0', fn: t => { const ts = 3; return t < ts ? 6 - 2 * t : 0; }, color: '#ef4444' },
            { name: '先正後負', desc: 'v 先+後−', fn: t => { const ts = 2; return t < ts ? 4 - 2 * t : 0; }, color: '#f59e0b' },
        ];

        const refGrid = document.getElementById('refGrid');
        refData.forEach(item => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'text-align: center;';

            const cvs = document.createElement('canvas');
            cvs.width = 120;
            cvs.height = 80;
            cvs.style.cssText = 'width: 100%; height: 60px; border: 1px solid #e2e8f0; border-radius: 4px; background: #fafafa; cursor: pointer;';
            wrap.appendChild(cvs);

            const label = document.createElement('div');
            label.style.cssText = 'font-size: 0.75rem; font-weight: 700; margin-top: 4px; color: #1e293b;';
            label.textContent = item.name;
            wrap.appendChild(label);

            const desc = document.createElement('div');
            desc.style.cssText = 'font-size: 0.65rem; color: #64748b; font-family: monospace;';
            desc.textContent = item.desc;
            wrap.appendChild(desc);

            refGrid.appendChild(wrap);

            // 繪製迷你圖
            const rctx = cvs.getContext('2d');
            const rw = cvs.width, rh = cvs.height;
            rctx.fillStyle = '#fafafa';
            rctx.fillRect(0, 0, rw, rh);

            // 軸
            rctx.strokeStyle = '#cbd5e1';
            rctx.lineWidth = 1;
            rctx.beginPath();
            rctx.moveTo(20, 5);
            rctx.lineTo(20, rh - 10);
            rctx.lineTo(rw - 5, rh - 10);
            rctx.stroke();

            // 零線
            const zeroY = rh / 2 + 2;
            rctx.strokeStyle = '#e2e8f0';
            rctx.beginPath();
            rctx.moveTo(20, zeroY);
            rctx.lineTo(rw - 5, zeroY);
            rctx.stroke();

            // 曲線
            rctx.beginPath();
            const maxT = 4;
            const maxV = 10;
            for (let i = 0; i <= 80; i++) {
                const t = (i / 80) * maxT;
                const v = item.fn(t);
                const px = 20 + (t / maxT) * (rw - 25);
                const py = zeroY - (v / maxV) * (rh - 20);
                if (i === 0) rctx.moveTo(px, py);
                else rctx.lineTo(px, py);
            }
            rctx.strokeStyle = item.color;
            rctx.lineWidth = 2.5;
            rctx.stroke();

            // 點擊切換模式
            cvs.addEventListener('click', () => {
                if (item.name === '靜止') modeSelect.value = 'stationary';
                else if (item.name === '等速（正向）') { modeSelect.value = 'constant'; v0Slider.value = 5; v0 = 5; document.getElementById('v0Val').textContent = '5.0'; }
                else if (item.name === '等速（反向）') { modeSelect.value = 'constant'; v0Slider.value = -5; v0 = -5; document.getElementById('v0Val').textContent = '-5.0'; }
                else if (item.name === '等加速度') { modeSelect.value = 'accelerate'; v0Slider.value = 0; aSlider.value = 2; v0 = 0; a = 2; document.getElementById('v0Val').textContent = '0.0'; document.getElementById('aVal').textContent = '2.0'; }
                else if (item.name === '減速停止') { modeSelect.value = 'decelerate'; v0Slider.value = 6; aSlider.value = 2; v0 = 6; a = 2; document.getElementById('v0Val').textContent = '6.0'; document.getElementById('aVal').textContent = '2.0'; }
                else if (item.name === '先正後負') { modeSelect.value = 'accelerate'; v0Slider.value = 4; aSlider.value = -2; v0 = 4; a = -2; document.getElementById('v0Val').textContent = '4.0'; document.getElementById('aVal').textContent = '-2.0'; }
                updateModeVisibility();

                // 自動重設並開始
                isRunning = true;
                isPaused = false;
                simTime = 0;
                frameCount = 0;
                trail.length = 0;
                state.isRunning = true;
                state.isPaused = false;
                lastTimestamp = performance.now();
                document.getElementById('startBtn').style.display = 'none';
                document.getElementById('pauseBtn').style.display = 'block';
            });
        });

        // 模式切換
        const modeSelect = document.getElementById('modeSelect');
        const v0Box = document.getElementById('v0Box');
        const aBox = document.getElementById('aBox');

        function updateModeVisibility() {
            mode = modeSelect.value;
            v0Box.style.display = (mode === 'stationary') ? 'none' : '';
            aBox.style.display = (mode === 'accelerate' || mode === 'decelerate') ? '' : 'none';
        }
        modeSelect.addEventListener('change', updateModeVisibility);
        updateModeVisibility();

        PhysicsUtils.bindSlider('v0Slider', 'v0Val', v => v0 = v, v => v.toFixed(1));
        PhysicsUtils.bindSlider('aSlider', 'aVal', v => a = v, v => v.toFixed(1));
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '時間 TIME', id: 'cardTime', unit: 's', highlight: true },
        { label: '速度 VEL', id: 'cardV', unit: 'm/s', highlight: true },
        { label: '加速度 ACC', id: 'cardA', unit: 'm/s²' },
        { label: '位移 POS', id: 'cardX', unit: 'm' },
    ]);

    // ==========================================================================
    // E. 物理計算
    // ==========================================================================
    function calcPhysics(t) {
        let v, acc, x;
        switch (mode) {
            case 'constant':
                v = v0;
                acc = 0;
                x = v0 * t;
                break;
            case 'accelerate':
                v = v0 + a * t;
                acc = a;
                x = v0 * t + 0.5 * a * t * t;
                break;
            case 'decelerate':
                // 減速到停止（加速度方向與速度相反）
                if (Math.abs(v0) < 0.01) {
                    v = 0; acc = 0; x = 0;
                } else {
                    const decA = Math.abs(a);
                    const sign = v0 > 0 ? 1 : -1;
                    const tStop = Math.abs(v0) / decA;
                    if (t >= tStop) {
                        v = 0;
                        acc = 0;
                        x = sign * Math.abs(v0) * tStop - sign * 0.5 * decA * tStop * tStop;
                    } else {
                        v = v0 - sign * decA * t;
                        acc = -sign * decA;
                        x = v0 * t - sign * 0.5 * decA * t * t;
                    }
                }
                break;
            case 'stationary':
                v = 0;
                acc = 0;
                x = 0;
                break;
            default:
                v = 0; acc = 0; x = 0;
        }
        return { v, acc, x };
    }

    // ==========================================================================
    // F. 渲染
    // ==========================================================================
    function drawSim() {
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        const { v, acc, x } = calcPhysics(simTime);

        // --- 上半部：物體運動場景 ---
        const sceneH = H * 0.42;
        const roadY = sceneH * 0.6;

        // 天空漸層
        const skyGrad = ctx.createLinearGradient(0, 0, 0, roadY - 30);
        skyGrad.addColorStop(0, '#e0f2fe');
        skyGrad.addColorStop(1, '#f0f9ff');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, roadY - 30);

        // 地面
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, roadY - 30, W, sceneH - roadY + 30);

        // 道路
        const roadH = 50;
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, roadY - roadH / 2, W, roadH);

        // 道路中心虛線
        ctx.setLineDash([15, 10]);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, roadY);
        ctx.lineTo(W, roadY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 刻度
        const startX = 80;
        const meterToPx = Math.min(6, (W - 120) / 80);
        ctx.font = '600 10px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        for (let m = 0; m <= 100; m += 10) {
            const px = startX + m * meterToPx;
            if (px > W - 20) break;
            ctx.beginPath();
            ctx.moveTo(px, roadY + roadH / 2);
            ctx.lineTo(px, roadY + roadH / 2 + 6);
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillText(m + 'm', px, roadY + roadH / 2 + 16);
        }

        // 起點線
        ctx.beginPath();
        ctx.moveTo(startX, roadY - roadH / 2);
        ctx.lineTo(startX, roadY + roadH / 2);
        ctx.strokeStyle = 'rgba(100,116,139,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 物體位置
        const ballX = startX + x * meterToPx;
        const ballY = roadY;
        const ballR = 14;

        if (ballX > -50 && ballX < W + 50) {
            // 位移箭頭
            if (Math.abs(x) > 0.3 && (isRunning || simTime > 0)) {
                PhysicsUtils.drawArrow(ctx, startX, roadY - ballR - 20, ballX, roadY - ballR - 20, {
                    color: '#2563eb', width: 2.5, label: `x = ${x.toFixed(1)} m`
                });
            }

            // 球體
            PhysicsUtils.drawBall(ctx, ballX, ballY, ballR, '#2563eb');

            // 速度箭頭
            if (Math.abs(v) > 0.3) {
                const arrowLen = v * 5;
                const arrowStartX = ballX + (v > 0 ? ballR + 2 : -ballR - 2);
                PhysicsUtils.drawArrow(ctx, arrowStartX, ballY, arrowStartX + arrowLen, ballY, {
                    color: '#ef4444', width: 4, shadow: true, label: `v = ${v.toFixed(1)} m/s`
                });
            }
        }

        // --- 下半部：v-t 圖 ---
        const graphTop = sceneH + 10;
        const graphH = H - graphTop - 20;
        const graphLeft = 60;
        const graphRight = W - 20;
        const graphW = graphRight - graphLeft;

        // 圖表背景
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(graphLeft, graphTop, graphW, graphH);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(graphLeft, graphTop, graphW, graphH);

        // 標題
        ctx.font = '800 12px monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'left';
        ctx.fillText('v-t 圖  VELOCITY-TIME', graphLeft, graphTop - 4);

        // 軸標籤
        ctx.font = '700 11px monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText('時間 t (s)', graphLeft + graphW / 2, graphTop + graphH + 16);
        ctx.save();
        ctx.translate(graphLeft - 40, graphTop + graphH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('速度 v (m/s)', 0, 0);
        ctx.restore();

        // 計算圖表範圍
        const maxT = Math.max(10, simTime + 2);
        let maxV = 10;
        for (const pt of trail) {
            if (Math.abs(pt.v) > maxV) maxV = Math.abs(pt.v);
        }
        maxV = Math.max(maxV, 10) * 1.2;

        // 網格線
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const gy = graphTop + (graphH / 5) * i;
            ctx.beginPath();
            ctx.moveTo(graphLeft, gy);
            ctx.lineTo(graphRight, gy);
            ctx.stroke();
        }

        // 軸刻度
        ctx.font = '600 10px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        for (let t = 0; t <= maxT; t += Math.ceil(maxT / 6)) {
            const px = graphLeft + (t / maxT) * graphW;
            ctx.fillText(t + 's', px, graphTop + graphH + 4);
        }
        ctx.textAlign = 'right';
        const vSteps = 4;
        for (let i = -vSteps; i <= vSteps; i++) {
            const val = (maxV / vSteps) * i;
            const py = graphTop + graphH / 2 - (val / maxV) * (graphH / 2);
            if (py >= graphTop && py <= graphTop + graphH) {
                ctx.fillText(val.toFixed(0) + 'm/s', graphLeft - 4, py + 3);
            }
        }

        // 零線
        const zeroY = graphTop + graphH / 2;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(graphLeft, zeroY);
        ctx.lineTo(graphRight, zeroY);
        ctx.stroke();

        // 繪製 v-t 曲線
        if (trail.length > 1) {
            ctx.beginPath();
            let started = false;
            for (const pt of trail) {
                const px = graphLeft + (pt.t / maxT) * graphW;
                const py = zeroY - (pt.v / maxV) * (graphH / 2);
                if (px < graphLeft || px > graphRight) continue;
                if (!started) { ctx.moveTo(px, py); started = true; }
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // 當前位置標記
            const lastPt = trail[trail.length - 1];
            const lpx = graphLeft + (lastPt.t / maxT) * graphW;
            const lpy = zeroY - (lastPt.v / maxV) * (graphH / 2);
            if (lpx >= graphLeft && lpx <= graphRight) {
                ctx.beginPath();
                ctx.arc(lpx, lpy, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#2563eb';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // 模式標籤
        const modeLabels = {
            constant: '等速運動 v = const',
            accelerate: '等加速度 a > 0',
            decelerate: '減速運動 a < 0',
            stationary: '靜止 v = 0'
        };
        ctx.font = '700 13px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'right';
        ctx.fillText(modeLabels[mode], W - 20, 24);
    }

    // ==========================================================================
    // G. 主迴圈
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;

        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;
        if (!isPaused) simTime += dt;

        const { v, acc, x } = calcPhysics(simTime);

        // 記錄軌跡
        if (!isPaused) {
            frameCount++;
            if (frameCount % 2 === 0) {
                trail.push({ t: simTime, v: v });
                if (trail.length > maxTrail) trail.shift();
            }
        }

        PhysicsUtils.beginFrame(ctx, canvas);
        drawSim();

        updateCards({
            cardTime: simTime.toFixed(2),
            cardV: v.toFixed(2),
            cardA: acc.toFixed(1),
            cardX: x.toFixed(2)
        });

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // H. 按鈕事件
    // ==========================================================================
    PhysicsUtils.setupStartBtn('startBtn', 'pauseBtn', state, () => {
        isRunning = true;
        isPaused = false;
        lastTimestamp = performance.now();
    });

    PhysicsUtils.setupPauseBtn('pauseBtn', state, loop, paused => {
        isPaused = paused;
    });

    PhysicsUtils.setupResetBtn('resetBtn', () => {
        isRunning = false;
        isPaused = true;
        simTime = 0;
        frameCount = 0;
        trail.length = 0;
        state.isRunning = false;
        state.isPaused = true;

        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        document.getElementById('pauseBtn').style.backgroundColor = '#ffffff';
        document.getElementById('pauseBtn').style.color = '#000000';
        document.getElementById('pauseBtn').style.border = '1px solid #000000';

        updateCards({ cardTime: '0.00', cardV: '0.00', cardA: '0.0', cardX: '0.00' });
    });

    // ==========================================================================
    // I. 啟動
    // ==========================================================================
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    PhysicsUtils.setupCleanup(animationFrameId, resizeCanvas);
}

initVelocityTimeGraph();
