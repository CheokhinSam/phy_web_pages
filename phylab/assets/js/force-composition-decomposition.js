/**
 * ⚖️ 力的合成與分解
 * 平行四邊形法則與三角形法的互動模擬
 */
function initForceComposition() {
    // ==========================================================================
    // A. 初始化
    // ==========================================================================
    const { canvas, ctx, ctrlPanel, guardEl } = PhysicsUtils.initCanvas();
    if (!canvas) return;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ==========================================================================
    // B. 狀態變數
    // ==========================================================================
    let F1 = 5;            // 力1大小 (N)
    let F2 = 4;            // 力2大小 (N)
    let angleDeg = 60;     // 兩力夾角 (度)
    let mode = 'compose';  // compose 或 decompose
    let method = 'parallelogram'; // parallelogram 或 triangle

    let isPaused = true;
    let lastTimestamp = 0;
    let animationFrameId;

    const SCALE = 70; // 1N = 70px

    // ==========================================================================
    // C. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>力 F₁</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="f1Val" style="color: #ef4444;">5.0</span> N
                    </span>
                </label>
                <input type="range" id="f1Slider" min="1" max="10" step="0.1" value="5">
            </div>
            <div class="control-box">
                <label>
                    <span>力 F₂</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="f2Val" style="color: #3b82f6;">4.0</span> N
                    </span>
                </label>
                <input type="range" id="f2Slider" min="1" max="10" step="0.1" value="4">
            </div>
            <div class="control-box">
                <label>
                    <span>夾角 <i>θ</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="thetaVal" style="color: #8b5cf6;">60</span>°
                    </span>
                </label>
                <input type="range" id="thetaSlider" min="0" max="180" step="1" value="60">
            </div>
            <div class="control-box">
                <label><span>模式</span></label>
                <select id="modeSelect" style="width:100%; padding:8px; font-weight:700; font-size:0.95rem; border:2px solid #000; background:#fff; cursor:pointer;">
                    <option value="compose">合成（兩個力 → 合力）</option>
                    <option value="decompose">分解（一個力 → 兩個分力）</option>
                </select>
            </div>
            <div class="control-box" id="methodBox">
                <label><span>方法</span></label>
                <select id="methodSelect" style="width:100%; padding:8px; font-weight:700; font-size:0.95rem; border:2px solid #000; background:#fff; cursor:pointer;">
                    <option value="parallelogram">平行四邊形法</option>
                    <option value="triangle">三角形法</option>
                </select>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="pauseBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">播放動畫 PLAY</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
            ${PhysicsUtils.formulaBox('力的合成', 'F = \\sqrt{F_1^2 + F_2^2 + 2F_1 F_2 \\cos\\theta}')}
        `;
        PhysicsUtils.typesetMath(ctrlPanel);

        PhysicsUtils.bindSlider('f1Slider', 'f1Val', v => F1 = v, v => v.toFixed(1));
        PhysicsUtils.bindSlider('f2Slider', 'f2Val', v => F2 = v, v => v.toFixed(1));
        PhysicsUtils.bindSlider('thetaSlider', 'thetaVal', v => angleDeg = v, v => parseInt(v));

        document.getElementById('modeSelect').addEventListener('change', e => {
            mode = e.target.value;
            document.getElementById('methodBox').style.display = mode === 'compose' ? 'block' : 'none';
        });

        document.getElementById('methodSelect').addEventListener('change', e => {
            method = e.target.value;
        });
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '力 F₁', id: 'cardF1', unit: 'N' },
        { label: '力 F₂', id: 'cardF2', unit: 'N' },
        { label: '合力 F', id: 'cardF', unit: 'N', highlight: true },
        { label: '夾角 θ', id: 'cardTheta', unit: '°', highlight: true },
    ]);

    // ==========================================================================
    // E. 圖表（不適用，靜態實驗）
    // ==========================================================================

    // ==========================================================================
    // F. 物理計算
    // ==========================================================================
    function calcResultant() {
        const theta = angleDeg * Math.PI / 180;
        const F = Math.sqrt(F1 * F1 + F2 * F2 + 2 * F1 * F2 * Math.cos(theta));
        const alpha = Math.atan2(F2 * Math.sin(theta), F1 + F2 * Math.cos(theta));
        return { F, alpha };
    }

    // ==========================================================================
    // G. 渲染
    // ==========================================================================
    let animProgress = 1; // 0→1 動畫進度

    function drawSim() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const { F, alpha } = calcResultant();
        const theta = angleDeg * Math.PI / 180;

        PhysicsUtils.beginFrame(ctx, canvas);

        // --- 標題 ---
        ctx.font = '900 16px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('FORCE COMPOSITION / 力的合成與分解', 20, 30);

        // 模式標籤
        ctx.font = '700 12px "Inter", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#6366f1';
        ctx.fillText(mode === 'compose' ? '● 合成模式' : '● 分解模式', W - 20, 30);

        if (mode === 'compose') {
            drawCompose(W, H, F, alpha, theta);
        } else {
            drawDecompose(W, H, W * 0.5, H * 0.5, F, alpha, theta);
        }
    }

    function drawCompose(W, H, F, alpha, theta) {
        const p = animProgress;

        // 自動縮放
        const maxForce = Math.max(F1, F2, F);
        const maxArrowLen = Math.min(W * 0.6, H * 0.55);
        const sc = Math.min(SCALE, maxArrowLen / (maxForce * 1.05));

        const f1x = F1 * sc;
        const f2x = F2 * sc * Math.cos(theta);
        const f2y = -F2 * sc * Math.sin(theta);
        const frx = (f1x + f2x) * p;
        const fry = f2y * p;

        // 計算圖形邊界，讓整個圖形置中
        const shapeMinX = Math.min(0, f2x) * p;
        const shapeMaxX = Math.max(f1x, f1x + f2x) * p;
        const shapeMinY = Math.min(0, f2y) * p;
        const shapeMaxY = Math.max(0, f2y) * p;
        const shapeCX = (shapeMinX + shapeMaxX) / 2;
        const shapeCY = (shapeMinY + shapeMaxY) / 2;
        const cx = W * 0.5 - shapeCX;
        const cy = H * 0.48 - shapeCY;

        if (method === 'parallelogram' && p >= 1) {
            // 輔助虛線
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx + f1x, cy);
            ctx.lineTo(cx + f1x + f2x, cy + f2y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx + f2x, cy + f2y);
            ctx.lineTo(cx + f1x + f2x, cy + f2y);
            ctx.stroke();
            ctx.restore();
        }

        // F₁
        PhysicsUtils.drawArrow(ctx, cx, cy, cx + f1x * p, cy, {
            color: '#ef4444', width: 3, shadow: true
        });
        if (p >= 1) {
            drawLabel(cx + f1x, cy - 32, `F₁ = ${F1.toFixed(1)} N`, '#ef4444');
        }

        // F₂
        PhysicsUtils.drawArrow(ctx, cx, cy, cx + f2x * p, cy + f2y * p, {
            color: '#3b82f6', width: 3, shadow: true
        });
        if (p >= 1) {
            drawLabel(cx + f2x + 20, cy + f2y - 18, `F₂ = ${F2.toFixed(1)} N`, '#3b82f6');
        }

        // 角度弧線
        if (p >= 1) {
            const arcR = 30;
            ctx.beginPath();
            ctx.arc(cx, cy, arcR, -theta, 0);
            ctx.strokeStyle = 'rgba(139,92,246,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = '600 12px "Inter", monospace';
            ctx.fillStyle = '#8b5cf6';
            ctx.textAlign = 'center';
            ctx.fillText(`θ=${angleDeg}°`, cx + arcR + 16, cy - 8);
        }

        // 合力
        PhysicsUtils.drawArrow(ctx, cx, cy, cx + frx, cy + fry, {
            color: '#22c55e', width: 4, shadow: true
        });
        if (p >= 1) {
            drawLabel(cx + frx + 16, cy + fry - 22, `F = ${F.toFixed(2)} N`, '#16a34a');
        }
    }

    function drawDecompose(W, H, ox, oy, F, alpha, theta) {
        const p = animProgress;

        // 自動縮放
        const maxLen = Math.min(W * 0.55, H * 0.5);
        const sc = Math.min(SCALE, maxLen / (F * 1.05));

        const fx = F * sc * Math.cos(alpha) * p;
        const fy = -F * sc * Math.sin(alpha) * p;

        // 計算圖形邊界，讓整個圖形置中
        const shapeMinX = Math.min(0, fx);
        const shapeMaxX = Math.max(0, fx);
        const shapeMinY = Math.min(0, fy);
        const shapeMaxY = Math.max(0, fy);
        ox = W * 0.5 - (shapeMinX + shapeMaxX) / 2;
        oy = H * 0.48 - (shapeMinY + shapeMaxY) / 2;

        // 原力 F（綠色）
        PhysicsUtils.drawArrow(ctx, ox, oy, ox + fx, oy + fy, {
            color: '#22c55e', width: 4, shadow: true
        });
        if (p >= 1) {
            drawLabel(ox + fx + 16, oy + fy - 22, `F = ${F.toFixed(2)} N`, '#16a34a');
        }

        // 分力 F₁（紅色，水平分量）
        const f1px = fx;
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(239,68,68,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox + fx, oy + fy);
        ctx.lineTo(ox + f1px, oy);
        ctx.stroke();
        ctx.restore();

        PhysicsUtils.drawArrow(ctx, ox, oy, ox + f1px, oy, {
            color: '#ef4444', width: 3, shadow: true
        });
        if (p >= 1) {
            drawLabel(ox + f1px, oy - 32, `F₁ = ${(F * Math.cos(alpha)).toFixed(2)} N`, '#ef4444');
        }

        // 分力 F₂（藍色，垂直分量）
        const f2py = fy;
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(59,130,246,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox + fx, oy + fy);
        ctx.lineTo(ox, oy + f2py);
        ctx.stroke();
        ctx.restore();

        PhysicsUtils.drawArrow(ctx, ox, oy, ox, oy + f2py, {
            color: '#3b82f6', width: 3, shadow: true
        });
        if (p >= 1) {
            drawLabel(ox - 24, oy + f2py - 16, `F₂ = ${(F * Math.sin(alpha)).toFixed(2)} N`, '#3b82f6');
        }

        // 角度標示（動畫完成後才顯示）
        if (p >= 1) {
            const arcR = 45;
            ctx.beginPath();
            ctx.arc(ox, oy, arcR, -alpha, 0);
            ctx.strokeStyle = 'rgba(139,92,246,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = '600 12px "Inter", monospace';
            ctx.fillStyle = '#8b5cf6';
            ctx.textAlign = 'left';
            ctx.fillText(`α=${(alpha * 180 / Math.PI).toFixed(1)}°`, ox + arcR + 8, oy - 6);
        }
    }

    function drawLabel(x, y, text, color) {
        ctx.font = '700 12px "Inter", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const m = ctx.measureText(text);
        const pad = 3;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x - m.width / 2 - pad, y - 7 - pad, m.width + pad * 2, 14 + pad * 2);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    // ==========================================================================
    // H. 主迴圈
    // ==========================================================================
    let animTime = 0;
    const ANIM_DURATION = 1.2; // 秒

    function loop(ts) {
        if (!document.contains(guardEl)) return;

        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;

        if (!isPaused) {
            animTime += dt;
            animProgress = Math.min(animTime / ANIM_DURATION, 1);
            // ease-out
            animProgress = 1 - Math.pow(1 - animProgress, 3);
        }

        drawSim();

        const { F } = calcResultant();
        updateCards({
            cardF1: F1.toFixed(1),
            cardF2: F2.toFixed(1),
            cardF: F.toFixed(2),
            cardTheta: angleDeg,
        });

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // I. 按鈕事件
    // ==========================================================================
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            if (isPaused) {
                pauseBtn.textContent = '播放動畫 PLAY';
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
            animTime = 0;
            animProgress = 0;

            if (pauseBtn) {
                pauseBtn.textContent = '播放動畫 PLAY';
                pauseBtn.style.backgroundColor = '#2563eb';
                pauseBtn.style.color = '#ffffff';
                pauseBtn.style.border = 'none';
            }
        });
    }

    // ==========================================================================
    // J. 啟動
    // ==========================================================================
    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);

    PhysicsUtils.setupCleanup(animationFrameId, resizeCanvas);
}

initForceComposition();
