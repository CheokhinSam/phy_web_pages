/**
 * 🍎 自由落體運動 — 觀察不同質量物體的自由落體
 * 可選擇是否顯示第二個物體，比較質量對自由落體的影響。
 */
function initFreeFall() {
    // ==========================================================================
    // A. 初始化
    // ==========================================================================
    const { canvas, ctx, ctrlPanel, guardEl } = PhysicsUtils.initCanvas();
    if (!canvas) return;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // B. 狀態變數
    // ==========================================================================
    let height = 100;        // 初始高度 (m)
    let g = 9.8;             // 重力加速度 (m/s²)
    let airResistance = 0;   // 空氣阻力係數 (0-1)
    let showSecond = false;  // 是否顯示第二個物體
    let isRunning = false;
    let isPaused = true;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;
    let frameCount = 0;

    const state = { isRunning, isPaused, lastTimestamp };

    // 物體狀態
    const obj1 = { name: '蘋果', mass: 0.2, radius: 10, color: '#ef4444', darkColor: '#991b1b', x: 0, y: 0, v: 0, a: 0, fallen: false };
    const obj2 = { name: '鐵球', mass: 5, radius: 24, color: '#64748b', darkColor: '#334155', x: 0, y: 0, v: 0, a: 0, fallen: false };

    // ==========================================================================
    // C. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>初始高度 <i>h₀</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="heightVal" style="color: #2563eb;">100</span> m
                    </span>
                </label>
                <input type="range" id="heightSlider" min="10" max="200" step="5" value="100">
            </div>
            <div class="control-box">
                <label>
                    <span>重力加速度 <i>g</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="gVal" style="color: #2563eb;">9.8</span> m/s²
                    </span>
                </label>
                <input type="range" id="gSlider" min="1" max="20" step="0.1" value="9.8">
            </div>
            <div class="control-box">
                <label>
                    <span>空氣阻力</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="airVal" style="color: #2563eb;">0.0</span>
                    </span>
                </label>
                <input type="range" id="airSlider" min="0" max="0.5" step="0.01" value="0">
            </div>
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0;">
                    <input type="checkbox" id="showSecondCheck" style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
                    <span style="font-weight: 700; font-size: 0.95rem;">加入第二個物體（比較）</span>
                </label>
                <div id="obj2Info" style="display: none; margin-top: 10px; padding: 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 30px; height: 30px; background: #64748b; border-radius: 50%; border: 2px solid #334155;"></div>
                        <div>
                            <div style="font-weight: 700; font-size: 0.9rem;">⚙️ 鐵球</div>
                            <div style="font-size: 0.8rem; color: #64748b;">5 kg（蘋果的 25 倍）</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">釋放 RELEASE</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            ${PhysicsUtils.formulaBox('核心公式', 'h = \\frac{1}{2}gt^2 \\quad v = gt')}
            <div class="control-box" style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 0.85rem; line-height: 1.6; color: #475569;">
                <div style="font-weight: 700; margin-bottom: 6px;">💡 伽利略的發現</div>
                <div>沒有空氣阻力時，</div>
                <div>不同質量的物體同時落地！</div>
                <div>勾選上方選項加入第二個物體。</div>
            </div>
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        // 滑桿綁定
        PhysicsUtils.bindSlider('heightSlider', 'heightVal', v => height = v, v => v.toFixed(0));
        PhysicsUtils.bindSlider('gSlider', 'gVal', v => g = v, v => v.toFixed(1));
        PhysicsUtils.bindSlider('airSlider', 'airVal', v => airResistance = v, v => v.toFixed(2));

        // Checkbox 控制
        const showSecondCheck = document.getElementById('showSecondCheck');
        const obj2Info = document.getElementById('obj2Info');
        showSecondCheck.addEventListener('change', function() {
            showSecond = this.checked;
            obj2Info.style.display = showSecond ? 'block' : 'none';
            // 重設動畫
            resetSimulation();
        });
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '時間 TIME', id: 'cardTime', unit: 's', highlight: true },
        { label: '🍎 蘋果速度', id: 'cardV1', unit: 'm/s', highlight: true },
        { label: '⚙️ 鐵球速度', id: 'cardV2', unit: 'm/s' },
        { label: '速度差', id: 'cardDiff', unit: 'm/s' },
    ]);

    // ==========================================================================
    // E. 物理計算
    // ==========================================================================
    function calcPhysics(t, mass) {
        let a = g;
        if (airResistance > 0) {
            const dragFactor = airResistance * (0.2 / mass);
            a = g * (1 - Math.min(dragFactor, 0.95));
        }
        const fallen = 0.5 * a * t * t;
        const v = a * t;
        return { fallen, v, a };
    }

    function resetSimulation() {
        isRunning = false;
        isPaused = true;
        simTime = 0;
        frameCount = 0;
        obj1.y = height; obj1.v = 0; obj1.a = 0; obj1.fallen = false;
        obj2.y = height; obj2.v = 0; obj2.a = 0; obj2.fallen = false;
        state.isRunning = false;
        state.isPaused = true;

        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        document.getElementById('pauseBtn').style.backgroundColor = '#ffffff';
        document.getElementById('pauseBtn').style.color = '#000000';
        document.getElementById('pauseBtn').style.border = '1px solid #000000';

        updateCards({ cardTime: '0.00', cardV1: '0.00', cardV2: '0.00', cardDiff: '0.00' });
    }

    // ==========================================================================
    // F. 渲染
    // ==========================================================================
    function drawSim() {
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;

        // --- 場景設定 ---
        const groundY = H * 0.85;
        const topY = H * 0.1;
        const sceneH = groundY - topY;

        // 物體 X 位置
        const leftX = showSecond ? W * 0.35 : W * 0.5;
        const rightX = W * 0.65;

        // 高度轉像素
        const maxHeightPx = sceneH * 0.9;
        const meterToPx = maxHeightPx / Math.max(height, 10);

        // --- 背景 ---
        const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        skyGrad.addColorStop(0, '#e0f2fe');
        skyGrad.addColorStop(1, '#f0f9ff');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, groundY);

        // 地面
        ctx.fillStyle = '#166534';
        ctx.fillRect(0, groundY, W, H - groundY);
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // --- 高度標尺 ---
        const rulerX = showSecond ? W * 0.5 : W * 0.25;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(rulerX, topY);
        ctx.lineTo(rulerX, groundY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '600 10px monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';
        const stepSize = height > 100 ? 20 : 10;
        for (let m = 0; m <= height; m += stepSize) {
            const py = groundY - m * meterToPx;
            if (py < topY) break;
            ctx.beginPath();
            ctx.moveTo(rulerX - 4, py);
            ctx.lineTo(rulerX + 4, py);
            ctx.stroke();
            ctx.fillText(m + 'm', rulerX - 6, py + 3);
        }

        // --- 計算物體位置 ---
        const phys1 = calcPhysics(simTime, obj1.mass);
        obj1.x = leftX;
        obj1.y = Math.max(0, height - phys1.fallen);
        obj1.v = phys1.v;
        obj1.a = phys1.a;
        if (phys1.fallen >= height) obj1.fallen = true;

        if (showSecond) {
            const phys2 = calcPhysics(simTime, obj2.mass);
            obj2.x = rightX;
            obj2.y = Math.max(0, height - phys2.fallen);
            obj2.v = phys2.v;
            obj2.a = phys2.a;
            if (phys2.fallen >= height) obj2.fallen = true;
        }

        // --- 繪製物體 ---
        function drawObject(obj, index) {
            const ballY = groundY - obj.y * meterToPx;

            // 物體（漸層球體）
            const grad = ctx.createRadialGradient(
                obj.x - obj.radius * 0.25, ballY - obj.radius * 0.25, obj.radius * 0.1,
                obj.x, ballY, obj.radius
            );
            grad.addColorStop(0, PhysicsUtils._lighten(obj.color));
            grad.addColorStop(0.6, obj.color);
            grad.addColorStop(1, obj.darkColor);
            ctx.beginPath();
            ctx.arc(obj.x, ballY, obj.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = obj.darkColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 高光
            ctx.beginPath();
            ctx.arc(obj.x - obj.radius * 0.25, ballY - obj.radius * 0.3, obj.radius * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fill();

            // 標籤
            ctx.font = '700 11px monospace';
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.fillText(index === 0 ? '🍎 0.2kg' : '⚙️ 5kg', obj.x, ballY + obj.radius + 16);

            // 速度箭頭
            if (obj.v > 0.5 && !obj.fallen) {
                const arrowLen = Math.min(obj.v * 3, 80);
                PhysicsUtils.drawArrow(ctx, obj.x + obj.radius + 5, ballY, obj.x + obj.radius + 5, ballY + arrowLen, {
                    color: index === 0 ? '#ef4444' : '#64748b',
                    width: 2.5,
                    shadow: true
                });
            }

            // 高度標示
            if (!obj.fallen && obj.y > 0.5) {
                ctx.font = '700 11px monospace';
                ctx.fillStyle = index === 0 ? '#ef4444' : '#475569';
                ctx.textAlign = 'center';
                ctx.fillText(`${obj.y.toFixed(1)}m`, obj.x, ballY - obj.radius - 10);
            }

            // 落地效果
            if (obj.fallen) {
                ctx.beginPath();
                ctx.arc(obj.x, groundY, 15, Math.PI, 0);
                ctx.strokeStyle = index === 0 ? 'rgba(239,68,68,0.5)' : 'rgba(100,116,139,0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.font = '800 12px monospace';
                ctx.fillStyle = index === 0 ? '#ef4444' : '#475569';
                ctx.textAlign = 'center';
                ctx.fillText('落地', obj.x, groundY + 22);
            }
        }

        drawObject(obj1, 0);
        if (showSecond) drawObject(obj2, 1);

        // --- 同時落地指示線 ---
        if (showSecond && obj1.fallen && obj2.fallen) {
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(leftX, groundY - 5);
            ctx.lineTo(rightX, groundY - 5);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = '800 14px monospace';
            ctx.fillStyle = '#22c55e';
            ctx.textAlign = 'center';
            ctx.fillText('同時落地！', W * 0.5, groundY + 38);
        }

        // --- 狀態標籤 ---
        ctx.font = '700 13px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'right';
        const allFallen = showSecond ? (obj1.fallen && obj2.fallen) : obj1.fallen;
        if (allFallen) {
            ctx.fillText('實驗完成', W - 20, 24);
        } else if (isRunning && !isPaused) {
            ctx.fillText('自由落體中...', W - 20, 24);
        } else {
            ctx.fillText('準備釋放', W - 20, 24);
        }
    }

    // ==========================================================================
    // G. 主迴圈
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;

        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;

        const allFallen = showSecond ? (obj1.fallen && obj2.fallen) : obj1.fallen;
        if (!isPaused && !allFallen) {
            simTime += dt;
        }

        PhysicsUtils.beginFrame(ctx, canvas);
        drawSim();

        const phys1 = calcPhysics(simTime, obj1.mass);
        const phys2 = showSecond ? calcPhysics(simTime, obj2.mass) : { v: 0 };

        updateCards({
            cardTime: simTime.toFixed(2),
            cardV1: phys1.v.toFixed(2),
            cardV2: showSecond ? phys2.v.toFixed(2) : '-',
            cardDiff: showSecond ? Math.abs(phys1.v - phys2.v).toFixed(2) : '-'
        });

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // H. 按鈕事件
    // ==========================================================================
    PhysicsUtils.setupStartBtn('startBtn', 'pauseBtn', state, () => {
        isRunning = true;
        isPaused = false;
        obj1.y = height; obj1.v = 0; obj1.a = 0; obj1.fallen = false;
        if (showSecond) { obj2.y = height; obj2.v = 0; obj2.a = 0; obj2.fallen = false; }
        simTime = 0;
        lastTimestamp = performance.now();
    });

    PhysicsUtils.setupPauseBtn('pauseBtn', state, loop, paused => {
        isPaused = paused;
    });

    PhysicsUtils.setupResetBtn('resetBtn', resetSimulation);

    // ==========================================================================
    // I. 啟動
    // ==========================================================================
    obj1.y = height;
    obj2.y = height;
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    PhysicsUtils.setupCleanup(animationFrameId, resizeCanvas);
}

initFreeFall();
