/**
 * 🪐 克卜勒定律實驗
 * 行星軌道運動視覺化：橢圓軌道、面積定律、週期定律
 */
function initKepler() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    let semiMajorAxis = 150;   // 半長軸 a (px)
    let eccentricity = 0.3;    // 離心率 e (0~0.9)
    let showAreaTrace = true;  // 顯示面積追蹤
    let showOrbitPath = true;  // 顯示軌道
    let orbitSpeed = 1.0;      // 軌道速度倍率
    let isPaused = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;

    const guardEl = ctrlPanel;

    // 軌道參數 — 使用平近點角 M，以 Kepler 方程轉換為真近點角 θ
    let meanAnomaly = 0;       // 平近點角 M (rad)
    let trailPoints = [];
    const MAX_TRAIL = 200;

    // 面積追蹤
    let areaSamples = [];
    let lastAreaTime = 0;
    const AREA_INTERVAL = 0.3;

    // ==========================================================================
    // B. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>半長軸 a</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">150</span> px
                    </span>
                </label>
                <input type="range" id="aSlider" min="80" max="250" step="5" value="150">
            </div>
            <div class="control-box">
                <label>
                    <span>離心率 e</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="eVal" style="color: #2563eb;">0.30</span>
                    </span>
                </label>
                <input type="range" id="eSlider" min="0" max="0.9" step="0.02" value="0.3">
            </div>
            <div class="control-box">
                <label>
                    <span>速度倍率</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="spdVal" style="color: #2563eb;">1.0</span>×
                    </span>
                </label>
                <input type="range" id="spdSlider" min="0.2" max="3.0" step="0.2" value="1.0">
            </div>
            <div class="control-box">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="areaToggle" checked style="accent-color: #2563eb;">
                    <span>顯示面積追蹤</span>
                </label>
            </div>
            <div class="control-box">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="orbitToggle" checked style="accent-color: #2563eb;">
                    <span>顯示軌道路徑</span>
                </label>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="pauseBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
        `;

        const aSlider = document.getElementById('aSlider');
        const eSlider = document.getElementById('eSlider');
        const spdSlider = document.getElementById('spdSlider');

        function updateParams() {
            semiMajorAxis = parseInt(aSlider.value);
            eccentricity = parseFloat(eSlider.value);
            orbitSpeed = parseFloat(spdSlider.value);
            document.getElementById('aVal').textContent = semiMajorAxis;
            document.getElementById('eVal').textContent = eccentricity.toFixed(2);
            document.getElementById('spdVal').textContent = orbitSpeed.toFixed(1);
        }

        aSlider.addEventListener('input', updateParams);
        eSlider.addEventListener('input', updateParams);
        spdSlider.addEventListener('input', updateParams);

        document.getElementById('areaToggle').addEventListener('change', (e) => {
            showAreaTrace = e.target.checked;
            areaSamples = [];
        });

        document.getElementById('orbitToggle').addEventListener('change', (e) => {
            showOrbitPath = e.target.checked;
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            isPaused = !isPaused;
            document.getElementById('pauseBtn').textContent = isPaused ? '播放 PLAY' : '暫停 PAUSE';
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            semiMajorAxis = 150;
            eccentricity = 0.3;
            orbitSpeed = 1.0;
            showAreaTrace = true;
            showOrbitPath = true;
            isPaused = false;
            simTime = 0;
            meanAnomaly = 0;
            trailPoints = [];
            areaSamples = [];
            aSlider.value = 150;
            eSlider.value = 0.3;
            spdSlider.value = 1.0;
            updateParams();
            document.getElementById('areaToggle').checked = true;
            document.getElementById('orbitToggle').checked = true;
            document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        });

        updateParams();
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    let cardPeriod, cardSpeed, cardR, cardAreaRate;
    if (dataGrid) {
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">週期 T</span>
                <div class="card-num-wrapper">
                    <span id="cardPeriod" class="card-num">0.0</span>
                    <span class="card-unit">s</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">軌道速度 v</span>
                <div class="card-num-wrapper">
                    <span id="cardSpeed" class="card-num">0.0</span>
                    <span class="card-unit">km/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">目前距離 r</span>
                <div class="card-num-wrapper">
                    <span id="cardR" class="card-num">0.0</span>
                    <span class="card-unit">AU</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">面積掃過率</span>
                <div class="card-num-wrapper">
                    <span id="cardAreaRate" class="card-num">0.0</span>
                    <span class="card-unit">const</span>
                </div>
            </div>
        `;
        cardPeriod = document.getElementById('cardPeriod');
        cardSpeed = document.getElementById('cardSpeed');
        cardR = document.getElementById('cardR');
        cardAreaRate = document.getElementById('cardAreaRate');
    }

    // ==========================================================================
    // D. 物理計算 — Kepler 方程 + 真近點角
    // ==========================================================================

    /**
     * 解 Kepler 方程 M = E - e·sin(E)（Newton-Raphson 迭代）
     * @param {number} M - 平近點角 (rad)
     * @param {number} e - 離心率
     * @returns {number} 偏近點角 E (rad)
     */
    function solveKeplerEquation(M, e) {
        let E = M; // 初始猜測
        for (let i = 0; i < 10; i++) {
            const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
            E -= dE;
            if (Math.abs(dE) < 1e-8) break;
        }
        return E;
    }

    /**
     * 偏近點角 E → 真近點角 θ
     */
    function eccentricToTrueAnomaly(E, e) {
        return 2 * Math.atan2(
            Math.sqrt(1 + e) * Math.sin(E / 2),
            Math.sqrt(1 - e) * Math.cos(E / 2)
        );
    }

    /**
     * 真近點角 θ → 軌道上的位置（相對於焦點）
     */
    function trueAnomalyToPosition(ta) {
        const a = semiMajorAxis;
        const e = eccentricity;
        const r = a * (1 - e * e) / (1 + e * Math.cos(ta));
        return { x: r * Math.cos(ta), y: r * Math.sin(ta), r: r };
    }

    /**
     * 軌道週期（Kepler 第三定律：T² ∝ a³）
     */
    function orbitalPeriod() {
        return Math.pow(semiMajorAxis / 100, 1.5) * 10;
    }

    /**
     * 目前的軌道速度（vis-viva 方程：v² ∝ 2/r - 1/a）
     */
    function orbitalSpeedAt(r) {
        const a = semiMajorAxis;
        return Math.sqrt(Math.abs(2 / r - 1 / a)) * 80;
    }

    /**
     * 目前的瞬時角速度 dθ/dt（由 dM/dt 推導）
     * dθ/dt = dM/dt × (a/r)² × √(1-e²)
     * 這是 Kepler 面積定律的直接結果
     */
    function currentAngularSpeed(meanAnomRate) {
        const e = eccentricity;
        const E = solveKeplerEquation(meanAnomaly, e);
        const theta = eccentricToTrueAnomaly(E, e);
        const r = semiMajorAxis * (1 - e * e) / (1 + e * Math.cos(theta));
        const a = semiMajorAxis;
        return meanAnomRate * (a * a) / (r * r) * Math.sqrt(1 - e * e);
    }

    // ==========================================================================
    // E. 渲染
    // ==========================================================================
    function drawSim() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const centerX = W * 0.5;
        const centerY = H * 0.5;

        // 背景
        ctx.fillStyle = '#060a14';
        ctx.fillRect(0, 0, W, H);

        // 星空
        drawStars();

        // 從平近點角經 Kepler 方程得到真近點角
        const E = solveKeplerEquation(meanAnomaly, eccentricity);
        const trueAnomaly = eccentricToTrueAnomaly(E, eccentricity);

        // 當前行星位置
        const pos = trueAnomalyToPosition(trueAnomaly);
        const px = centerX + pos.x;
        const py = centerY + pos.y;

        // 記錄軌跡
        trailPoints.push({ x: px, y: py, t: simTime });
        if (trailPoints.length > MAX_TRAIL) trailPoints.shift();

        // 面積追蹤
        if (showAreaTrace && !isPaused) {
            if (simTime - lastAreaTime > AREA_INTERVAL) {
                areaSamples.push({ x: px, y: py, t: simTime });
                if (areaSamples.length > 8) areaSamples.shift();
                lastAreaTime = simTime;
            }
        }

        // 繪製軌道
        if (showOrbitPath) {
            drawOrbit(centerX, centerY);
        }

        // 繪製面積扇形
        if (showAreaTrace) {
            drawAreaSweeps(centerX, centerY);
        }

        // 繪製軌跡
        drawTrail();

        // 繪製太陽（焦點）
        drawSun(centerX, centerY);

        // 繪製行星
        drawPlanet(px, py);

        // 繪製輔助線
        drawRadiusLine(centerX, centerY, px, py);

        // 公式標示
        ctx.font = '600 13px "Inter", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('T² ∝ a³', 20, H - 50);
        ctx.fillText('dA/dt = const', 20, H - 30);

        // 更新數據卡
        updateDataCards(pos.r);
    }

    function drawStars() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let i = 0; i < 80; i++) {
            const x = (i * 137.5 + 50) % W;
            const y = (i * 97.3 + 30) % H;
            ctx.beginPath();
            ctx.arc(x, y, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawOrbit(cx, cy) {
        const a = semiMajorAxis;
        const e = eccentricity;
        const b = a * Math.sqrt(1 - e * e);
        const c = a * e;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx + c, cy, a, b, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 焦點標記
        ctx.fillStyle = 'rgba(255, 200, 100, 0.3)';
        ctx.beginPath();
        ctx.arc(cx + c, cy, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawSun(cx, cy) {
        // 發光
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
        glow.addColorStop(0, '#fbbf24');
        glow.addColorStop(0.3, '#f59e0b80');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.fill();

        // 實體
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();

        // 標籤
        ctx.font = '700 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('太陽', cx, cy - 28);
    }

    function drawPlanet(x, y) {
        // 發光
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 25);
        glow.addColorStop(0, '#60a5fa');
        glow.addColorStop(0.5, '#3b82f680');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 25, 0, Math.PI * 2);
        ctx.fill();

        // 實體
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        // 標籤
        ctx.font = '700 11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#93c5fd';
        ctx.fillText('行星', x, y - 18);
    }

    function drawTrail() {
        if (trailPoints.length < 2) return;

        ctx.lineWidth = 1.5;
        for (let i = 1; i < trailPoints.length; i++) {
            const alpha = i / trailPoints.length;
            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.moveTo(trailPoints[i - 1].x, trailPoints[i - 1].y);
            ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
            ctx.stroke();
        }
    }

    function drawRadiusLine(cx, cy, px, py) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawAreaSweeps(cx, cy) {
        if (areaSamples.length < 2) return;

        const colors = [
            'rgba(251, 191, 36, 0.2)',
            'rgba(251, 191, 36, 0.25)',
            'rgba(251, 191, 36, 0.3)',
            'rgba(251, 191, 36, 0.35)',
            'rgba(251, 191, 36, 0.4)',
            'rgba(251, 191, 36, 0.45)',
            'rgba(251, 191, 36, 0.5)',
            'rgba(251, 191, 36, 0.55)'
        ];

        for (let i = 0; i < areaSamples.length - 1; i++) {
            const s1 = areaSamples[i];
            const s2 = areaSamples[i + 1];

            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.closePath();
            ctx.fill();
        }
    }

    function updateDataCards(r) {
        if (cardPeriod) cardPeriod.innerText = orbitalPeriod().toFixed(1);
        if (cardSpeed) cardSpeed.innerText = orbitalSpeedAt(r).toFixed(1);
        if (cardR) cardR.innerText = (r / 100).toFixed(2);

        // 面積掃過率 dA/dt = (1/2) × r² × dθ/dt = L/(2m) = 常數
        // 等效於 (1/2) × √(μa(1-e²))，歸一化為 a × √(1-e²) × 常數
        if (cardAreaRate) {
            const rate = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity) * 0.5;
            cardAreaRate.innerText = rate.toFixed(1);
        }
    }

    // ==========================================================================
    // F. 主迴圈
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;
        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;
        if (!isPaused) {
            simTime += dt;
            // Kepler 面積定律：dM/dt = 常數（平近點角等速增加）
            const meanAnomRate = orbitSpeed * 2 * Math.PI / orbitalPeriod();
            meanAnomaly += meanAnomRate * dt;
            if (meanAnomaly > Math.PI * 2) meanAnomaly -= Math.PI * 2;
        }

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

initKepler();
