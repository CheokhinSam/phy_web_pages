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

    let lastTimestamp = 0;
    let animationFrameId;

    const SCALE = 70; // 1N = 70px
    const INIT = { F1: 5, F2: 4, angleDeg: 60 };

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
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem;">重設 RESET</button>
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
        // 自動縮放
        const maxForce = Math.max(F1, F2, F);
        const maxArrowLen = Math.min(W * 0.6, H * 0.55);
        const sc = Math.min(SCALE, maxArrowLen / (maxForce * 1.05));

        const f1x = F1 * sc;
        const f2x = F2 * sc * Math.cos(theta);
        const f2y = -F2 * sc * Math.sin(theta);
        const frx = f1x + f2x;
        const fry = f2y;

        // 計算圖形邊界，讓整個圖形置中
        const shapeMinX = Math.min(0, f2x);
        const shapeMaxX = Math.max(f1x, f1x + f2x);
        const shapeMinY = Math.min(0, f2y);
        const shapeMaxY = Math.max(0, f2y);
        const shapeCX = (shapeMinX + shapeMaxX) / 2;
        const shapeCY = (shapeMinY + shapeMaxY) / 2;
        const cx = W * 0.5 - shapeCX;
        const cy = H * 0.48 - shapeCY;

        if (method === 'parallelogram') {
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
        PhysicsUtils.drawArrow(ctx, cx, cy, cx + f1x, cy, {
            color: '#ef4444', width: 3, shadow: true
        });
        drawLabel(cx + f1x, cy - 32, `F₁ = ${F1.toFixed(1)} N`, '#ef4444');

        // F₂
        PhysicsUtils.drawArrow(ctx, cx, cy, cx + f2x, cy + f2y, {
            color: '#3b82f6', width: 3, shadow: true
        });
        drawLabel(cx + f2x + 20, cy + f2y - 18, `F₂ = ${F2.toFixed(1)} N`, '#3b82f6');

        // 角度弧線
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

        // 合力
        PhysicsUtils.drawArrow(ctx, cx, cy, cx + frx, cy + fry, {
            color: '#22c55e', width: 4, shadow: true
        });
        drawLabel(cx + frx + 16, cy + fry - 22, `F = ${F.toFixed(2)} N`, '#16a34a');
    }

    function drawDecompose(W, H, ox, oy, F, alpha, theta) {
        // 自動縮放
        const maxLen = Math.min(W * 0.55, H * 0.5);
        const sc = Math.min(SCALE, maxLen / (F * 1.05));

        const fx = F * sc * Math.cos(alpha);
        const fy = -F * sc * Math.sin(alpha);

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
        drawLabel(ox + fx + 16, oy + fy - 22, `F = ${F.toFixed(2)} N`, '#16a34a');

        // 分力 F₁（紅色，水平分量）
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(239,68,68,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox + fx, oy + fy);
        ctx.lineTo(ox + fx, oy);
        ctx.stroke();
        ctx.restore();

        PhysicsUtils.drawArrow(ctx, ox, oy, ox + fx, oy, {
            color: '#ef4444', width: 3, shadow: true
        });
        drawLabel(ox + fx, oy - 32, `F₁ = ${(F * Math.cos(alpha)).toFixed(2)} N`, '#ef4444');

        // 分力 F₂（藍色，垂直分量）
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(59,130,246,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox + fx, oy + fy);
        ctx.lineTo(ox, oy + fy);
        ctx.stroke();
        ctx.restore();

        PhysicsUtils.drawArrow(ctx, ox, oy, ox, oy + fy, {
            color: '#3b82f6', width: 3, shadow: true
        });
        drawLabel(ox - 24, oy + fy - 16, `F₂ = ${(F * Math.sin(alpha)).toFixed(2)} N`, '#3b82f6');

        // 角度標示
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
    function loop(ts) {
        if (!document.contains(guardEl)) return;

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
    const resetBtn = document.getElementById('resetBtn');

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            F1 = INIT.F1;
            F2 = INIT.F2;
            angleDeg = INIT.angleDeg;
            mode = 'compose';
            method = 'parallelogram';

            document.getElementById('f1Slider').value = F1;
            document.getElementById('f1Val').textContent = F1.toFixed(1);
            document.getElementById('f2Slider').value = F2;
            document.getElementById('f2Val').textContent = F2.toFixed(1);
            document.getElementById('thetaSlider').value = angleDeg;
            document.getElementById('thetaVal').textContent = angleDeg;
            document.getElementById('modeSelect').value = 'compose';
            document.getElementById('methodSelect').value = 'parallelogram';
            document.getElementById('methodBox').style.display = 'block';
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
