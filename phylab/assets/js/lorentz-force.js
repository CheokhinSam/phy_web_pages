/**
 * 🧲 洛倫茲力實驗
 * 帶電粒子在磁場中的圓周運動
 */
function initLorentzForce() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    let magneticField = 1.0;   // 磁場強度 B (T)
    let particleMass = 1.0;    // 粒子質量 m (×10⁻³⁰ kg)
    let particleCharge = 1.0;  // 粒子電荷 q (×10⁻¹⁹ C)
    let initVelocity = 2.0;    // 初速度 v (×10⁶ m/s)
    let showFieldDots = true;  // 顯示磁場方向
    let showTrail = true;      // 顯示軌跡
    let isStarted = false;     // 是否已開始
    let isPaused = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;

    const guardEl = ctrlPanel;

    // 粒子狀態
    let particleX, particleY;
    let particleAngle = 0;
    let trailPoints = [];
    const MAX_TRAIL = 300;
    let totalAngle = 0;
    let periodCount = 0;

    // ==========================================================================
    // B. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>磁場強度 B</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="bVal" style="color: #2563eb;">1.0</span> T
                    </span>
                </label>
                <input type="range" id="bSlider" min="0.1" max="5.0" step="0.1" value="1.0">
            </div>
            <div class="control-box">
                <label>
                    <span>粒子質量 m</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="mVal" style="color: #2563eb;">1.0</span> ×10⁻³⁰ kg
                    </span>
                </label>
                <input type="range" id="mSlider" min="0.1" max="5.0" step="0.1" value="1.0">
            </div>
            <div class="control-box">
                <label>
                    <span>粒子電荷 q</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="qVal" style="color: #2563eb;">+1.0</span> ×10⁻¹⁹ C
                    </span>
                </label>
                <input type="range" id="qSlider" min="-3.0" max="3.0" step="0.5" value="1.0">
            </div>
            <div class="control-box">
                <label>
                    <span>初速度 v</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vVal" style="color: #2563eb;">2.0</span> ×10⁶ m/s
                    </span>
                </label>
                <input type="range" id="vSlider" min="0.5" max="5.0" step="0.1" value="2.0">
            </div>
            <div class="control-box">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="fieldToggle" checked style="accent-color: #2563eb;">
                    <span>顯示磁場</span>
                </label>
            </div>
            <div class="control-box">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="trailToggle" checked style="accent-color: #2563eb;">
                    <span>顯示軌跡</span>
                </label>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
        `;

        const bSlider = document.getElementById('bSlider');
        const mSlider = document.getElementById('mSlider');
        const qSlider = document.getElementById('qSlider');
        const vSlider = document.getElementById('vSlider');

        function updateParams() {
            magneticField = parseFloat(bSlider.value);
            particleMass = parseFloat(mSlider.value);
            particleCharge = parseFloat(qSlider.value);
            initVelocity = parseFloat(vSlider.value);
            document.getElementById('bVal').textContent = magneticField.toFixed(1);
            document.getElementById('mVal').textContent = particleMass.toFixed(1);
            document.getElementById('qVal').textContent = (particleCharge >= 0 ? '+' : '') + particleCharge.toFixed(1);
            document.getElementById('vVal').textContent = initVelocity.toFixed(1);
        }

        bSlider.addEventListener('input', updateParams);
        mSlider.addEventListener('input', updateParams);
        qSlider.addEventListener('input', updateParams);
        vSlider.addEventListener('input', updateParams);

        document.getElementById('fieldToggle').addEventListener('change', (e) => {
            showFieldDots = e.target.checked;
        });

        document.getElementById('trailToggle').addEventListener('change', (e) => {
            showTrail = e.target.checked;
            trailPoints = [];
        });

        document.getElementById('startBtn').addEventListener('click', () => {
            isStarted = true;
            isPaused = false;
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('pauseBtn').style.display = 'block';
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            isPaused = !isPaused;
            document.getElementById('pauseBtn').textContent = isPaused ? '播放 PLAY' : '暫停 PAUSE';
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            magneticField = 1.0;
            particleMass = 1.0;
            particleCharge = 1.0;
            initVelocity = 2.0;
            isStarted = false;
            isPaused = false;
            simTime = 0;
            bSlider.value = 1.0;
            mSlider.value = 1.0;
            qSlider.value = 1.0;
            vSlider.value = 2.0;
            updateParams();
            initParticle();
            document.getElementById('startBtn').style.display = 'block';
            document.getElementById('pauseBtn').style.display = 'none';
        });

        updateParams();
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    let cardRadius, cardPeriod, cardOmega, cardForce;
    if (dataGrid) {
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">軌道半徑 r</span>
                <div class="card-num-wrapper">
                    <span id="cardRadius" class="card-num">0.0</span>
                    <span class="card-unit">m</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">週期 T</span>
                <div class="card-num-wrapper">
                    <span id="cardPeriod" class="card-num">0.0</span>
                    <span class="card-unit">s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">角速度 ω</span>
                <div class="card-num-wrapper">
                    <span id="cardOmega" class="card-num">0.0</span>
                    <span class="card-unit">rad/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">洛倫茲力 F</span>
                <div class="card-num-wrapper">
                    <span id="cardForce" class="card-num">0.0</span>
                    <span class="card-unit">N</span>
                </div>
            </div>
        `;
        cardRadius = document.getElementById('cardRadius');
        cardPeriod = document.getElementById('cardPeriod');
        cardOmega = document.getElementById('cardOmega');
        cardForce = document.getElementById('cardForce');
    }

    // ==========================================================================
    // D. 物理計算
    // ==========================================================================

    function calcPhysics() {
        const m = particleMass * 1e-30;
        const q = Math.abs(particleCharge) * 1e-19;
        const B = magneticField;
        const v = initVelocity * 1e6;

        // 真實物理量（顯示用）
        const radius = (m * v) / (q * B);
        const period = (2 * Math.PI * m) / (q * B);
        const omega = (q * B) / m;
        const force = q * v * B;

        return { radius, period, omega, force };
    }

    // 視覺化用：基於參數計算像素半徑和角速度
    function getVisualRadius() {
        // 半徑：B 越大越小，m 越大越大，v 越大越大
        const baseR = Math.min(canvas.cssWidth, canvas.cssHeight) * 0.35;
        const r = baseR * (particleMass / magneticField) * (initVelocity / 2);
        return Math.max(30, Math.min(r, Math.min(canvas.cssWidth, canvas.cssHeight) * 0.45));
    }

    function getVisualOmega() {
        // 角速度：B 越大越快，m 越大越慢，q 越大越快
        // 負電荷轉反方向
        const baseOmega = 2.0; // 基礎角速度 rad/s
        const direction = particleCharge >= 0 ? 1 : -1;
        return direction * baseOmega * (magneticField / particleMass) * Math.abs(particleCharge);
    }

    function initParticle() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        particleX = W * 0.5;
        particleY = H * 0.5;
        particleAngle = -Math.PI / 2; // 從頂部開始

        trailPoints = [];
        totalAngle = 0;
        periodCount = 0;
    }

    // ==========================================================================
    // E. 渲染
    // ==========================================================================
    function drawSim() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;

        // 背景
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, W, H);

        // 磁場方向（× 表示垂直進入屏幕）
        if (showFieldDots) {
            drawMagneticField();
        }

        // 軌跡
        if (showTrail) {
            drawTrail();
        }

        // 預測圓周軌道
        drawPredictedOrbit();

        // 粒子
        drawParticle();

        // 力的方向
        drawForceVector();

        // 公式
        ctx.font = '600 13px "Inter", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('F = qv × B', 20, H - 70);
        ctx.fillText('r = mv/(qB)', 20, H - 50);
        ctx.fillText('T = 2πm/(qB)', 20, H - 30);

        // 磁場方向指示
        ctx.font = '700 14px "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';
        ctx.fillText('B ⊗ 垂直進入屏幕', W - 20, 30);

        // 更新數據卡
        updateDataCards();
    }

    function drawMagneticField() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const spacing = 50;

        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(147, 197, 253, 0.15)';

        for (let x = spacing; x < W; x += spacing) {
            for (let y = spacing; y < H; y += spacing) {
                // ⊗ 符號表示磁場進入屏幕
                ctx.fillText('⊗', x, y);
            }
        }
    }

    function drawPredictedOrbit() {
        const centerX = canvas.cssWidth * 0.5;
        const centerY = canvas.cssHeight * 0.5;
        const radius = getVisualRadius();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 半徑標示
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();

        ctx.font = '600 11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillText(`r = ${calcPhysics().radius.toExponential(2)} m`, centerX + radius / 2, centerY - 10);
    }

    function drawParticle() {
        const charge = particleCharge;
        const color = charge > 0 ? '#ef4444' : '#3b82f6';
        const label = charge > 0 ? '+' : '−';

        // 發光
        const glow = ctx.createRadialGradient(particleX, particleY, 0, particleX, particleY, 20);
        glow.addColorStop(0, color);
        glow.addColorStop(0.5, color + '60');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(particleX, particleY, 20, 0, Math.PI * 2);
        ctx.fill();

        // 實體
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(particleX, particleY, 8, 0, Math.PI * 2);
        ctx.fill();

        // 電荷標記
        ctx.font = '700 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(label, particleX, particleY);
    }

    function drawTrail() {
        if (trailPoints.length < 2) return;

        const trailColor = particleCharge >= 0 ? '239, 68, 68' : '59, 130, 246';
        ctx.lineWidth = 2;
        for (let i = 1; i < trailPoints.length; i++) {
            const alpha = (i / trailPoints.length) * 0.6;
            ctx.strokeStyle = `rgba(${trailColor}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(trailPoints[i - 1].x, trailPoints[i - 1].y);
            ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
            ctx.stroke();
        }
    }

    function drawForceVector() {
        // 洛倫茲力方向：F = qv × B（指向圓心）
        const centerX = canvas.cssWidth * 0.5;
        const centerY = canvas.cssHeight * 0.5;

        // 力指向圓心（向心力）
        const dx = centerX - particleX;
        const dy = centerY - particleY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const fx = dx / dist;
        const fy = dy / dist;

        const forceLen = 35;
        const endX = particleX + fx * forceLen;
        const endY = particleY + fy * forceLen;

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(particleX, particleY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 箭頭
        const angle = Math.atan2(fy, fx);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 10 * Math.cos(angle - 0.4), endY - 10 * Math.sin(angle - 0.4));
        ctx.lineTo(endX - 10 * Math.cos(angle + 0.4), endY - 10 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();

        // 標籤
        ctx.font = '700 11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('F', endX + fx * 15, endY + fy * 15);
    }

    function updateDataCards() {
        const { radius, period, omega, force } = calcPhysics();
        if (cardRadius) cardRadius.innerText = radius.toExponential(2);
        if (cardPeriod) cardPeriod.innerText = period.toExponential(2);
        if (cardOmega) cardOmega.innerText = omega.toExponential(2);
        if (cardForce) cardForce.innerText = force.toExponential(2);
    }

    // ==========================================================================
    // F. 主迴圈
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;
        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;

        if (isStarted && !isPaused) {
            simTime += dt;

            // 視覺化圓周運動
            const omega = getVisualOmega();
            const radius = getVisualRadius();
            const centerX = canvas.cssWidth * 0.5;
            const centerY = canvas.cssHeight * 0.5;

            // 更新角度
            particleAngle += omega * dt;

            // 計算位置（圓周運動）
            particleX = centerX + radius * Math.cos(particleAngle);
            particleY = centerY + radius * Math.sin(particleAngle);

            // 記錄軌跡
            trailPoints.push({ x: particleX, y: particleY });
            if (trailPoints.length > MAX_TRAIL) trailPoints.shift();

            // 計算週期數
            const angleDiff = omega * dt;
            totalAngle += Math.abs(angleDiff);
            periodCount = Math.floor(totalAngle / (2 * Math.PI));
        }

        PhysicsUtils.beginFrame(ctx, canvas);
        drawSim();

        animationFrameId = requestAnimationFrame(loop);
    }

    // ==========================================================================
    // G. 初始化
    // ==========================================================================
    const resizeCanvas = PhysicsUtils.setupResize(canvas);
    window.addEventListener('resize', () => { initParticle(); });

    requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initLorentzForce();
