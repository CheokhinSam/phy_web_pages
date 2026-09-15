/**
 * 🌌 萬有引力實驗
 * 兩個天體之間的引力視覺化，可調質量和距離
 */
function initGravitation() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    let mass1 = 5.0;   // 天體1質量 (×10³⁰ kg)
    let mass2 = 3.0;   // 天體2質量 (×10³⁰ kg)
    let distance = 5.0; // 距離 (×10¹⁰ m)
    let G = 6.67;       // 引力常數 (×10⁻¹¹)
    let isPaused = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;

    const guardEl = ctrlPanel;

    // ==========================================================================
    // B. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>天體1質量 M₁</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="m1Val" style="color: #2563eb;">5.0</span> ×10³⁰ kg
                    </span>
                </label>
                <input type="range" id="m1Slider" min="1.0" max="20.0" step="0.5" value="5.0">
            </div>
            <div class="control-box">
                <label>
                    <span>天體2質量 M₂</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="m2Val" style="color: #2563eb;">3.0</span> ×10³⁰ kg
                    </span>
                </label>
                <input type="range" id="m2Slider" min="1.0" max="20.0" step="0.5" value="3.0">
            </div>
            <div class="control-box">
                <label>
                    <span>距離 r</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="rVal" style="color: #2563eb;">5.0</span> ×10¹⁰ m
                    </span>
                </label>
                <input type="range" id="rSlider" min="2.0" max="15.0" step="0.5" value="5.0">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="pauseBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
        `;

        const m1Slider = document.getElementById('m1Slider');
        const m2Slider = document.getElementById('m2Slider');
        const rSlider = document.getElementById('rSlider');

        function updateParams() {
            mass1 = parseFloat(m1Slider.value);
            mass2 = parseFloat(m2Slider.value);
            distance = parseFloat(rSlider.value);
            document.getElementById('m1Val').textContent = mass1.toFixed(1);
            document.getElementById('m2Val').textContent = mass2.toFixed(1);
            document.getElementById('rVal').textContent = distance.toFixed(1);
        }

        m1Slider.addEventListener('input', updateParams);
        m2Slider.addEventListener('input', updateParams);
        rSlider.addEventListener('input', updateParams);

        document.getElementById('pauseBtn').addEventListener('click', () => {
            isPaused = !isPaused;
            document.getElementById('pauseBtn').textContent = isPaused ? '播放 PLAY' : '暫停 PAUSE';
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            mass1 = 5.0;
            mass2 = 3.0;
            distance = 5.0;
            isPaused = false;
            simTime = 0;
            m1Slider.value = 5.0;
            m2Slider.value = 3.0;
            rSlider.value = 5.0;
            updateParams();
            document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        });

        updateParams();
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    let cardForce, cardAcc1, cardAcc2, cardPE;
    if (dataGrid) {
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">引力 F</span>
                <div class="card-num-wrapper">
                    <span id="cardForce" class="card-num">0.0</span>
                    <span class="card-unit">N</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">M₁ 加速度</span>
                <div class="card-num-wrapper">
                    <span id="cardAcc1" class="card-num">0.0</span>
                    <span class="card-unit">m/s²</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">M₂ 加速度</span>
                <div class="card-num-wrapper">
                    <span id="cardAcc2" class="card-num">0.0</span>
                    <span class="card-unit">m/s²</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">位能 U</span>
                <div class="card-num-wrapper">
                    <span id="cardPE" class="card-num">0.0</span>
                    <span class="card-unit">J</span>
                </div>
            </div>
        `;
        cardForce = document.getElementById('cardForce');
        cardAcc1 = document.getElementById('cardAcc1');
        cardAcc2 = document.getElementById('cardAcc2');
        cardPE = document.getElementById('cardPE');
    }

    // ==========================================================================
    // D. 物理計算
    // ==========================================================================
    function calcPhysics() {
        const m1 = mass1 * 1e30;
        const m2 = mass2 * 1e30;
        const r = distance * 1e10;
        const Greal = G * 1e-11;

        const force = Greal * m1 * m2 / (r * r);
        const acc1 = force / m1;
        const acc2 = force / m2;
        const potentialEnergy = -Greal * m1 * m2 / r;

        return { force, acc1, acc2, potentialEnergy };
    }

    // ==========================================================================
    // E. 渲染
    // ==========================================================================
    function drawSim() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const centerY = H * 0.45;
        const { force, acc1, acc2, potentialEnergy } = calcPhysics();

        // 背景
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, W, H);

        // 星空
        drawStars();

        // 計算位置
        const centerX = W * 0.5;
        const separation = Math.min(distance * 30, W * 0.35);
        const x1 = centerX - separation / 2;
        const x2 = centerX + separation / 2;

        // 天體大小（與質量成正比）
        const r1 = Math.sqrt(mass1) * 12;
        const r2 = Math.sqrt(mass2) * 12;

        // 引力線
        drawForceLines(x1, centerY, r1, x2, centerY, r2, force);

        // 天體1
        drawBody(x1, centerY, r1, '#3b82f6', 'M₁');

        // 天體2
        drawBody(x2, centerY, r2, '#f97316', 'M₂');

        // 距離標示
        drawDistance(x1, centerY + Math.max(r1, r2) + 40, x2, centerY + Math.max(r1, r2) + 40, distance);

        // 公式
        ctx.font = '600 14px "Inter", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('F = G·M₁·M₂ / r²', centerX, H - 30);

        // 更新數據卡
        if (cardForce) cardForce.innerText = force.toExponential(2);
        if (cardAcc1) cardAcc1.innerText = acc1.toExponential(2);
        if (cardAcc2) cardAcc2.innerText = acc2.toExponential(2);
        if (cardPE) cardPE.innerText = potentialEnergy.toExponential(2);
    }

    function drawStars() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 50; i++) {
            const x = (i * 137.5) % W;
            const y = (i * 97.3) % H;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawBody(x, y, r, color, label) {
        // 發光效果
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
        glow.addColorStop(0, color);
        glow.addColorStop(0.5, color + '80');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // 實體
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // 標籤
        ctx.font = '700 14px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y - r - 15);
    }

    function drawForceLines(x1, y1, r1, x2, y2, r2, force) {
        const numLines = 5;
        const angle = Math.atan2(y2 - y1, x2 - x1);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;

        for (let i = 0; i < numLines; i++) {
            const offset = (i - (numLines - 1) / 2) * 8;
            const perpX = Math.cos(angle + Math.PI / 2) * offset;
            const perpY = Math.sin(angle + Math.PI / 2) * offset;

            ctx.beginPath();
            ctx.moveTo(x1 + r1 * Math.cos(angle) + perpX, y1 + r1 * Math.sin(angle) + perpY);
            ctx.lineTo(x2 - r2 * Math.cos(angle) + perpX, y2 - r2 * Math.sin(angle) + perpY);
            ctx.stroke();
        }

        // 力的方向箭頭
        const arrowSize = Math.min(force / 1e20, 20);
        if (arrowSize > 5) {
            drawForceArrow(x1, y1, angle, arrowSize, '#3b82f6');
            drawForceArrow(x2, y2, angle + Math.PI, arrowSize, '#f97316');
        }
    }

    function drawForceArrow(x, y, angle, size, color) {
        const endX = x + Math.cos(angle) * size * 15;
        const endY = y + Math.sin(angle) * size * 15;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 箭頭
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 10 * Math.cos(angle - 0.4), endY - 10 * Math.sin(angle - 0.4));
        ctx.lineTo(endX - 10 * Math.cos(angle + 0.4), endY - 10 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
    }

    function drawDistance(x1, y, x2, y2, dist) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;

        // 左端線
        ctx.beginPath();
        ctx.moveTo(x1, y - 5);
        ctx.lineTo(x1, y + 5);
        ctx.stroke();

        // 右端線
        ctx.beginPath();
        ctx.moveTo(x2, y2 - 5);
        ctx.lineTo(x2, y2 + 5);
        ctx.stroke();

        // 連接線
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 距離標籤
        ctx.font = '600 13px "Inter", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`r = ${dist.toFixed(1)} ×10¹⁰ m`, (x1 + x2) / 2, y - 15);
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
        drawSim();

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

initGravitation();
