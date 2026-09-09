/**
 * 🌊 水波折射實驗
 * 深水區/淺水區波速、波長、折射角視覺化（平面波前設計）
 */
function initWaveRefraction() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    let isDeepToShallow = true;
    let incidentAngle = 30;
    let vDeep = 2.0;
    let vShallow = 0.8;
    let frequency = 1.0;
    let showNormal = true;
    let isPaused = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;

    const guardEl = ctrlPanel;

    // 波速/波長輔助函數
    function getIncidentVelocity() { return isDeepToShallow ? vDeep : vShallow; }
    function getRefractedVelocity() { return isDeepToShallow ? vShallow : vDeep; }
    function getIncidentWavelength() { return getIncidentVelocity() / frequency; }
    function getRefractedWavelength() { return getRefractedVelocity() / frequency; }

    // ==========================================================================
    // B. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label><span>折射方向</span></label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px;">
                    <button id="btnDeepToShallow" class="ref-btn active">深→淺</button>
                    <button id="btnShallowToDeep" class="ref-btn">淺→深</button>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>入射角 θ₁</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="angleVal" style="color: #2563eb;">30</span>°
                    </span>
                </label>
                <input type="range" id="angleSlider" min="10" max="80" step="1" value="30">
            </div>
            <div class="control-box">
                <label>
                    <span>深水波速 v<sub>深</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vDeepVal" style="color: #2563eb;">2.0</span> m/s
                    </span>
                </label>
                <input type="range" id="vDeepSlider" min="1.0" max="3.0" step="0.1" value="2.0">
            </div>
            <div class="control-box">
                <label>
                    <span>淺水波速 v<sub>淺</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vShallowVal" style="color: #2563eb;">0.8</span> m/s
                    </span>
                </label>
                <input type="range" id="vShallowSlider" min="0.3" max="1.5" step="0.1" value="0.8">
            </div>
            <div class="control-box">
                <label>
                    <span>頻率 f</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="fVal" style="color: #2563eb;">1.0</span> Hz
                    </span>
                </label>
                <input type="range" id="fSlider" min="0.5" max="2.0" step="0.1" value="1.0">
            </div>
            <div class="control-box">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="normalToggle" checked style="accent-color: #2563eb;">
                    <span>顯示法線</span>
                </label>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="pauseBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .ref-btn { padding: 8px 4px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.8rem; font-family: monospace; }
            .ref-btn.active { background: #000; color: #fff; border: none; }
            .ref-btn:hover { opacity: 0.85; }
        `;
        document.head.appendChild(style);

        document.getElementById('btnDeepToShallow').addEventListener('click', () => {
            isDeepToShallow = true;
            updateDirectionButtons();
        });
        document.getElementById('btnShallowToDeep').addEventListener('click', () => {
            isDeepToShallow = false;
            updateDirectionButtons();
        });

        function updateDirectionButtons() {
            document.getElementById('btnDeepToShallow').classList.toggle('active', isDeepToShallow);
            document.getElementById('btnShallowToDeep').classList.toggle('active', !isDeepToShallow);
        }

        const angleSlider = document.getElementById('angleSlider');
        const vDeepSlider = document.getElementById('vDeepSlider');
        const vShallowSlider = document.getElementById('vShallowSlider');
        const fSlider = document.getElementById('fSlider');

        function updateParams() {
            incidentAngle = parseInt(angleSlider.value);
            vDeep = parseFloat(vDeepSlider.value);
            vShallow = parseFloat(vShallowSlider.value);
            frequency = parseFloat(fSlider.value);
            document.getElementById('angleVal').textContent = incidentAngle;
            document.getElementById('vDeepVal').textContent = vDeep.toFixed(1);
            document.getElementById('vShallowVal').textContent = vShallow.toFixed(1);
            document.getElementById('fVal').textContent = frequency.toFixed(1);
        }

        angleSlider.addEventListener('input', updateParams);
        vDeepSlider.addEventListener('input', updateParams);
        vShallowSlider.addEventListener('input', updateParams);
        fSlider.addEventListener('input', updateParams);

        document.getElementById('normalToggle').addEventListener('change', (e) => {
            showNormal = e.target.checked;
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            isPaused = !isPaused;
            document.getElementById('pauseBtn').textContent = isPaused ? '播放 PLAY' : '暫停 PAUSE';
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            isDeepToShallow = true;
            incidentAngle = 30;
            vDeep = 2.0;
            vShallow = 0.8;
            frequency = 1.0;
            showNormal = true;
            isPaused = false;
            simTime = 0;
            angleSlider.value = 30;
            vDeepSlider.value = 2.0;
            vShallowSlider.value = 0.8;
            fSlider.value = 1.0;
            document.getElementById('normalToggle').checked = true;
            updateParams();
            updateDirectionButtons();
            document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        });

        updateParams();
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    let cardTheta1, cardTheta2, cardVInc, cardVRefr, cardLInc, cardLRefr;
    if (dataGrid) {
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">入射角 θ₁</span>
                <div class="card-num-wrapper">
                    <span id="cardTheta1" class="card-num">30.0</span>
                    <span class="card-unit">°</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">折射角 θ₂</span>
                <div class="card-num-wrapper">
                    <span id="cardTheta2" class="card-num">0.0</span>
                    <span class="card-unit">°</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">入射側波速</span>
                <div class="card-num-wrapper">
                    <span id="cardVInc" class="card-num">2.0</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">折射側波速</span>
                <div class="card-num-wrapper">
                    <span id="cardVRefr" class="card-num">0.8</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">入射側波長</span>
                <div class="card-num-wrapper">
                    <span id="cardLInc" class="card-num">0.0</span>
                    <span class="card-unit">m</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">折射側波長</span>
                <div class="card-num-wrapper">
                    <span id="cardLRefr" class="card-num">0.0</span>
                    <span class="card-unit">m</span>
                </div>
            </div>
        `;
        cardTheta1 = document.getElementById('cardTheta1');
        cardTheta2 = document.getElementById('cardTheta2');
        cardVInc = document.getElementById('cardVInc');
        cardVRefr = document.getElementById('cardVRefr');
        cardLInc = document.getElementById('cardLInc');
        cardLRefr = document.getElementById('cardLRefr');
    }

    // ==========================================================================
    // D. 物理計算
    // ==========================================================================
    function calcRefraction() {
        const v1 = getIncidentVelocity();
        const v2 = getRefractedVelocity();
        const theta1Rad = incidentAngle * Math.PI / 180;
        const sinTheta2 = (v2 / v1) * Math.sin(theta1Rad);

        if (Math.abs(sinTheta2) > 1) {
            return { theta2: 90, totalReflection: true };
        }

        const theta2Rad = Math.asin(sinTheta2);
        return { theta2: theta2Rad * 180 / Math.PI, totalReflection: false };
    }

    // ==========================================================================
    // E. 渲染
    // ==========================================================================
    const SCALE = 80;

    function drawBackground() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;

        // 深水區背景（深藍）
        const deepGrad = ctx.createLinearGradient(0, 0, bX, 0);
        deepGrad.addColorStop(0, '#0a1628');
        deepGrad.addColorStop(1, '#101e38');
        ctx.fillStyle = deepGrad;
        ctx.fillRect(0, 0, bX, H);

        // 淺水區背景（淺藍）
        const shallowGrad = ctx.createLinearGradient(bX, 0, W, 0);
        shallowGrad.addColorStop(0, '#1a3a6a');
        shallowGrad.addColorStop(1, '#2563a0');
        ctx.fillStyle = shallowGrad;
        ctx.fillRect(bX, 0, W - bX, H);

        // 區域標籤
        ctx.font = '700 14px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        if (isDeepToShallow) {
            ctx.fillText('深水區 DEEP', bX * 0.25, 30);
            ctx.fillText('淺水區 SHALLOW', bX + (W - bX) * 0.5, 30);
        } else {
            ctx.fillText('淺水區 SHALLOW', bX * 0.25, 30);
            ctx.fillText('深水區 DEEP', bX + (W - bX) * 0.5, 30);
        }

        // 波速標籤
        ctx.font = '600 13px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(`v₁ = ${getIncidentVelocity().toFixed(1)} m/s`, bX * 0.25, H - 25);
        ctx.fillText(`v₂ = ${getRefractedVelocity().toFixed(1)} m/s`, bX + (W - bX) * 0.5, H - 25);
    }

    function drawBoundary() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;

        // 分界線（實線）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bX, 0);
        ctx.lineTo(bX, H);
        ctx.stroke();

        // 法線（虛線）
        if (showNormal) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.moveTo(bX, 0);
            ctx.lineTo(bX, H);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = '600 11px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillText('法線 NORMAL', bX, 50);
        }
    }

    function drawWavefronts() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;
        const lambdaInc = getIncidentWavelength();
        const lambdaRefr = getRefractedWavelength();
        const { theta2, totalReflection } = calcRefraction();

        const theta1Rad = incidentAngle * Math.PI / 180;
        const theta2Rad = theta2 * Math.PI / 180;

        const lambdaIncPx = lambdaInc * SCALE;
        const lambdaRefrPx = lambdaRefr * SCALE;
        const phase = simTime * frequency * 2 * Math.PI;

        // --- 入射波前（左側）---
        const incDirX = Math.cos(theta1Rad);
        const incDirY = -Math.sin(theta1Rad);
        const incWfX = Math.sin(theta1Rad);
        const incWfY = Math.cos(theta1Rad);

        const incGrad = ctx.createLinearGradient(0, centerY - 200, 0, centerY + 200);
        incGrad.addColorStop(0, 'rgba(34, 211, 238, 0.15)');
        incGrad.addColorStop(0.5, 'rgba(34, 211, 238, 0.55)');
        incGrad.addColorStop(1, 'rgba(34, 211, 238, 0.15)');
        ctx.strokeStyle = incGrad;
        ctx.lineWidth = 2.5;

        const numWF = 25;
        for (let i = -numWF; i <= numWF; i++) {
            const offset = i * lambdaIncPx + (phase / (2 * Math.PI)) * lambdaIncPx;
            const baseX = bX + offset * incDirX;
            const baseY = centerY + offset * incDirY;
            const len = 220;
            const x1 = baseX - incWfX * len;
            const y1 = baseY - incWfY * len;
            const x2 = baseX + incWfX * len;
            const y2 = baseY + incWfY * len;

            ctx.beginPath();
            if (x1 < bX && x2 < bX) {
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
            } else if (x1 < bX) {
                ctx.moveTo(x1, y1);
                const t = (bX - x1) / (x2 - x1);
                ctx.lineTo(bX, y1 + t * (y2 - y1));
            } else if (x2 < bX) {
                const t = (bX - x2) / (x1 - x2);
                ctx.moveTo(bX, y2 + t * (y1 - y2));
                ctx.lineTo(x2, y2);
            }
            ctx.stroke();
        }

        // --- 折射波前（右側）---
        if (!totalReflection) {
            const refDirX = Math.cos(theta2Rad);
            const refDirY = -Math.sin(theta2Rad);
            const refWfX = Math.sin(theta2Rad);
            const refWfY = Math.cos(theta2Rad);

            const refGrad = ctx.createLinearGradient(bX, centerY - 200, W, centerY + 200);
            refGrad.addColorStop(0, 'rgba(251, 146, 60, 0.15)');
            refGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.55)');
            refGrad.addColorStop(1, 'rgba(251, 146, 60, 0.15)');
            ctx.strokeStyle = refGrad;
            ctx.lineWidth = 2.5;

            for (let i = -numWF; i <= numWF; i++) {
                const offset = i * lambdaRefrPx + (phase / (2 * Math.PI)) * lambdaRefrPx;
                const baseX = bX + offset * refDirX;
                const baseY = centerY + offset * refDirY;
                const len = 220;
                const x1 = baseX - refWfX * len;
                const y1 = baseY - refWfY * len;
                const x2 = baseX + refWfX * len;
                const y2 = baseY + refWfY * len;

                ctx.beginPath();
                if (x1 > bX && x2 > bX) {
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                } else if (x1 > bX) {
                    ctx.moveTo(x1, y1);
                    const t = (x1 - bX) / (x1 - x2);
                    ctx.lineTo(bX, y1 + t * (y2 - y1));
                } else if (x2 > bX) {
                    const t = (x2 - bX) / (x2 - x1);
                    ctx.moveTo(bX, y2 + t * (y1 - y2));
                    ctx.lineTo(x2, y2);
                }
                ctx.stroke();
            }
        }
    }

    function drawIncidentRay() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;
        const { theta2, totalReflection } = calcRefraction();

        const theta1Rad = incidentAngle * Math.PI / 180;
        const theta2Rad = theta2 * Math.PI / 180;
        const rayLen = 180;

        // 入射光線
        const startX = bX - rayLen * Math.cos(theta1Rad);
        const startY = centerY + rayLen * Math.sin(theta1Rad);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(bX, centerY);
        ctx.stroke();
        drawArrow(ctx, startX, startY, bX, centerY, '#22d3ee');

        // 折射光線
        if (!totalReflection) {
            const refrEndX = bX + rayLen * Math.cos(theta2Rad);
            const refrEndY = centerY + rayLen * Math.sin(theta2Rad);
            ctx.strokeStyle = '#fb923c';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(bX, centerY);
            ctx.lineTo(refrEndX, refrEndY);
            ctx.stroke();
            drawArrow(ctx, bX, centerY, refrEndX, refrEndY, '#fb923c');
        }
    }

    function drawArrow(c, x1, y1, x2, y2, color) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 10;
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
        c.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
        c.closePath();
        c.fill();
    }

    function drawAngleArcs() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;
        const { theta2, totalReflection } = calcRefraction();

        const theta1Rad = incidentAngle * Math.PI / 180;
        const theta2Rad = theta2 * Math.PI / 180;
        const arcR = 60;

        // θ₁ 弧線
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bX, centerY, arcR, -Math.PI / 2, -Math.PI / 2 + theta1Rad);
        ctx.stroke();

        // θ₁ 數值
        const la1 = -Math.PI / 2 + theta1Rad / 2;
        const la1x = bX + Math.cos(la1) * (arcR + 20);
        const la1y = centerY + Math.sin(la1) * (arcR + 20);
        ctx.font = '700 13px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(`θ₁=${incidentAngle}°`, la1x, la1y);

        // θ₂ 弧線
        if (!totalReflection) {
            ctx.strokeStyle = '#fb923c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bX, centerY, arcR, Math.PI / 2 - theta2Rad, Math.PI / 2);
            ctx.stroke();

            // θ₂ 數值
            const la2 = Math.PI / 2 - theta2Rad / 2;
            const la2x = bX + Math.cos(la2) * (arcR + 20);
            const la2y = centerY + Math.sin(la2) * (arcR + 20);
            ctx.fillStyle = '#fb923c';
            ctx.fillText(`θ₂=${theta2.toFixed(1)}°`, la2x, la2y);
        } else {
            ctx.font = '700 14px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ef4444';
            ctx.fillText('全反射', bX + 100, centerY + 20);
        }
    }

    function drawSideWaveform() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const graphH = 80;
        const graphTop = H - graphH - 40;
        const graphBot = H - 40;
        const centerY = (graphTop + graphBot) / 2;
        const phase = simTime * frequency * 2 * Math.PI;

        // 背景半透明
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, graphTop, W, graphH);

        // 分界線
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bX, graphTop);
        ctx.lineTo(bX, graphBot);
        ctx.stroke();

        // 繪製波形
        ctx.lineWidth = 2;

        // 左側（入射波）
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        for (let x = 0; x < bX; x++) {
            const lambdaPx = getIncidentWavelength() * SCALE;
            const k = (2 * Math.PI) / lambdaPx;
            const amp = 25;
            const y = centerY + amp * Math.sin(k * x + phase);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 右側（折射波）
        const { totalReflection } = calcRefraction();
        if (!totalReflection) {
            ctx.strokeStyle = '#fb923c';
            ctx.beginPath();
            for (let x = bX; x < W; x++) {
                const lambdaPx = getRefractedWavelength() * SCALE;
                const k = (2 * Math.PI) / lambdaPx;
                const amp = 25;
                const y = centerY + amp * Math.sin(k * x + phase);
                if (x === bX) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // 標籤
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(`λ₁ = ${getIncidentWavelength().toFixed(2)} m`, 10, graphTop + 12);
        ctx.fillStyle = '#fb923c';
        ctx.textAlign = 'right';
        ctx.fillText(`λ₂ = ${getRefractedWavelength().toFixed(2)} m`, W - 10, graphTop + 12);
    }

    function updateCards() {
        const { theta2, totalReflection } = calcRefraction();
        if (cardTheta1) cardTheta1.innerText = incidentAngle.toFixed(1);
        if (cardTheta2) cardTheta2.innerText = totalReflection ? '全反射' : theta2.toFixed(1);
        if (cardVInc) cardVInc.innerText = getIncidentVelocity().toFixed(1);
        if (cardVRefr) cardVRefr.innerText = getRefractedVelocity().toFixed(1);
        if (cardLInc) cardLInc.innerText = getIncidentWavelength().toFixed(2);
        if (cardLRefr) cardLRefr.innerText = getRefractedWavelength().toFixed(2);
    }

    // ==========================================================================
    // F. 主迴圈
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;
        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;
        if (!isPaused) simTime += dt;

        PhysicsUtils.beginFrame(ctx, canvas);
        drawBackground();
        drawWavefronts();
        drawBoundary();
        drawIncidentRay();
        drawAngleArcs();
        drawSideWaveform();
        updateCards();

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // G. 初始化
    // ==========================================================================
    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initWaveRefraction();
