/**
 * 🔥 熱傳導模擬 — 傅立葉熱傳導定律
 * 金屬棒左端加熱，觀察溫度傳播與微觀粒子振動
 */
function initConduction() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ===== 物理參數 =====
    const N = 80;                    // 分割段數（更多段 = 更平滑）
    const rodLength = 0.1;           // 物體長度 (m) = 10cm
    const dx = rodLength / N;
    const rho = 7800;
    const cp = 500;

    // 材質資料庫
    const materials = {
        copper:    { name: '銅 Copper',      k: 401 },
        aluminum:  { name: '鋁 Aluminum',    k: 237 },
        iron:      { name: '鐵 Iron',        k: 80  },
        steel:     { name: '不鏽鋼 Steel',   k: 16  },
        glass:     { name: '玻璃 Glass',     k: 1.0 },
        wood:      { name: '木材 Wood',      k: 0.15}
    };

    let materialKey = 'copper';
    let k = materials[materialKey].k;

    let T_hot = 100;
    let T_cold = 25;
    let temp = new Array(N).fill(25);

    let isRunning = false;
    let isPaused = false;
    let showParticles = false;
    let simTime = 0;
    let lastTimestamp = 0;
    let animationFrameId;

    // ===== 粒子系統 =====
    let particles = [];
    const GRID_COLS = 20;   // 沿長度方向的列數
    const GRID_ROWS = 6;    // 沿高度方向的行數

    function initParticles() {
        particles = [];
        let margin = 0.04; // 兩端留白
        for (let r = 0; r < GRID_ROWS; r++) {
            // 奇數行少一顆，避免六角偏移後超出邊界
            let cols = (r % 2 === 1) ? GRID_COLS - 1 : GRID_COLS;
            for (let c = 0; c < cols; c++) {
                let bx = margin + c / (cols - 1) * (1 - 2 * margin);
                particles.push({
                    col: c,
                    row: r,
                    baseXNorm: bx,
                    baseYNorm: (r + 0.5) / GRID_ROWS,
                    phase: Math.random() * Math.PI * 2,
                    offsetX: 0,
                    offsetY: 0
                });
            }
        }
    }
    initParticles();

    // ============================================================
    // A. 控制面板
    // ============================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>左端溫度 <i>T</i><sub>hot</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="thVal" style="color: #ef4444;">100</span> °C
                    </span>
                </label>
                <input type="range" id="thSlider" min="50" max="500" step="5" value="100">
            </div>
            <div class="control-box">
                <label>
                    <span>右端溫度 <i>T</i><sub>cold</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="tcVal" style="color: #3b82f6;">25</span> °C
                    </span>
                </label>
                <input type="range" id="tcSlider" min="0" max="100" step="1" value="25">
            </div>
            <div class="control-box">
                <label><span>材質 Material</span></label>
                <select id="matSelect" style="width:100%; padding:8px; font-weight:700; font-size:0.95rem; border:2px solid #000; background:#fff; cursor:pointer;">
                    <option value="copper">銅 Copper (k=401)</option>
                    <option value="aluminum">鋁 Aluminum (k=237)</option>
                    <option value="iron">鐵 Iron (k=80)</option>
                    <option value="steel">不鏽鋼 Steel (k=16)</option>
                    <option value="glass">玻璃 Glass (k=1.0)</option>
                    <option value="wood">木材 Wood (k=0.15)</option>
                </select>
            </div>
            <div class="control-box" style="margin-top: 8px;">
                <button id="startBtn" style="width: 100%; padding: 12px; background: #ef4444; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.95rem; letter-spacing: 1px;">開始加熱 / START</button>
            </div>
            <div class="control-box" style="display: flex; gap: 8px;">
                <button id="pauseBtn" style="flex:1; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.85rem;" disabled>暫停 / PAUSE</button>
                <button id="resetBtn" style="flex:1; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.85rem;">重設 / RESET</button>
            </div>
            <div class="control-box">
                <button id="particleBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.85rem; letter-spacing: 1px;">顯示粒子 / SHOW PARTICLES</button>
            </div>
            <div class="control-box" style="margin-top: auto; border-top: 2px solid #000; padding-top: 12px; background: #fff;">
                <label style="margin-bottom: 4px; color: #64748b; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">FOURIER'S LAW / 傅立葉定律</label>
                <div style="font-size: 1.1rem; font-weight: 900; font-family: Cambria, serif; color: #000; margin-bottom: 4px;">$$q = -k \\frac{dT}{dx}$$</div>
                <label style="font-size: 0.8rem; color: #1e293b; display: block;">穩態：$T(x) = T_{hot} + (T_{cold}-T_{hot})\\frac{x}{L}$</label>
            </div>
        `;

        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset([ctrlPanel]);
        }

        const thSlider = document.getElementById('thSlider');
        const tcSlider = document.getElementById('tcSlider');
        const matSelect = document.getElementById('matSelect');
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        const particleBtn = document.getElementById('particleBtn');

        thSlider.addEventListener('input', () => {
            T_hot = parseFloat(thSlider.value);
            document.getElementById('thVal').innerText = T_hot;
        });
        tcSlider.addEventListener('input', () => {
            T_cold = parseFloat(tcSlider.value);
            document.getElementById('tcVal').innerText = T_cold;
        });
        matSelect.addEventListener('change', () => {
            materialKey = matSelect.value;
            k = materials[materialKey].k;
        });

        startBtn.addEventListener('click', () => {
            isRunning = true;
            isPaused = false;
            startBtn.style.display = 'none';
            pauseBtn.disabled = false;
            temp[0] = T_hot;
            temp[N - 1] = T_cold;
            lastTimestamp = performance.now();
            loop(performance.now());
        });

        pauseBtn.addEventListener('click', () => {
            if (!isRunning) return;
            isPaused = !isPaused;
            pauseBtn.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
            pauseBtn.style.backgroundColor = isPaused ? "#2563eb" : "#ffffff";
            pauseBtn.style.color = isPaused ? "#ffffff" : "#000000";
            if (!isPaused) {
                lastTimestamp = performance.now();
                loop(performance.now());
            }
        });

        resetBtn.addEventListener('click', () => {
            isRunning = false;
            isPaused = false;
            simTime = 0;
            temp = new Array(N).fill(25);
            initParticles();
            startBtn.style.display = 'block';
            pauseBtn.disabled = true;
            pauseBtn.innerText = "暫停 / PAUSE";
            pauseBtn.style.backgroundColor = "#ffffff";
            pauseBtn.style.color = "#000000";
            updateCards();
            draw();
        });

        particleBtn.addEventListener('click', () => {
            showParticles = !showParticles;
            particleBtn.innerText = showParticles ? "隱藏粒子 / HIDE PARTICLES" : "顯示粒子 / SHOW PARTICLES";
            particleBtn.style.backgroundColor = showParticles ? "#2563eb" : "#000000";
            draw();
        });
    }

    // ============================================================
    // B. Canvas 尺寸
    // ============================================================
    const resizeCanvas = PhysicsUtils.setupResize(canvas);
    window.addEventListener('resize', () => { draw(); });

    // ============================================================
    // C. 數據卡片
    // ============================================================
    const dataGrid = document.getElementById('dataCardsGrid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card">
                <span class="card-label">左端溫度 T_LEFT</span>
                <div class="card-num-wrapper"><span id="cardTl" class="card-num">25.0</span><span class="card-unit">°C</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">右端溫度 T_RIGHT</span>
                <div class="card-num-wrapper"><span id="cardTr" class="card-num">25.0</span><span class="card-unit">°C</span></div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">溫度差 ΔT</span>
                <div class="card-num-wrapper"><span id="cardDt" class="card-num">0.0</span><span class="card-unit">°C</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">熱導率 k</span>
                <div class="card-num-wrapper"><span id="cardK" class="card-num">401</span><span class="card-unit">W/m·K</span></div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">熱通量 q</span>
                <div class="card-num-wrapper"><span id="cardQ" class="card-num">0.0</span><span class="card-unit">W/m²</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">模擬時間 TIME</span>
                <div class="card-num-wrapper"><span id="cardTime" class="card-num">0.00</span><span class="card-unit">s</span></div>
            </div>
        `;
    }

    function updateCards() {
        const el = (id) => document.getElementById(id);
        if (el('cardTl')) el('cardTl').innerText = temp[0].toFixed(1);
        if (el('cardTr')) el('cardTr').innerText = temp[N - 1].toFixed(1);
        if (el('cardDt')) el('cardDt').innerText = (temp[0] - temp[N - 1]).toFixed(1);
        if (el('cardK'))  el('cardK').innerText = k.toFixed(1);
        let q = k * (temp[0] - temp[N - 1]) / rodLength;
        if (el('cardQ'))  el('cardQ').innerText = Math.abs(q).toFixed(1);
        if (el('cardTime')) el('cardTime').innerText = simTime.toFixed(2);
    }

    // ============================================================
    // D. 圖表
    // ============================================================
    const chartContainer = document.getElementById('chartContainer');
    const chartCtx = document.getElementById('realtimeChart');
    let tempChart = null;

    if (chartContainer && chartCtx) {
        chartContainer.style.display = 'block';
        chartContainer.insertAdjacentHTML('afterbegin', `
            <div style="margin-top: 15px; margin-bottom: 10px;">
                <div class="pane-meta-title">// TEMPERATURE DISTRIBUTION</div>
            </div>
        `);

        tempChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '溫度 T (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        title: { display: true, text: '位置 x (m)', font: { weight: 'bold' } },
                        grid: { display: false }
                    },
                    y: {
                        title: { display: true, text: '溫度 T (°C)', font: { weight: 'bold' } },
                        min: 0
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateChart() {
        if (!tempChart) return;
        let labels = [];
        let data = [];
        for (let i = 0; i < N; i++) {
            labels.push((i * dx).toFixed(3));
            data.push(temp[i]);
        }
        tempChart.data.labels = labels;
        tempChart.data.datasets[0].data = data;
        tempChart.update('none');
    }

    // ============================================================
    // E. 物理引擎 — 熱傳導
    // ============================================================
    function updateHeat(dt) {
        let alpha = k / (rho * cp);
        let newTemp = [...temp];
        for (let i = 1; i < N - 1; i++) {
            let d2T = (temp[i + 1] - 2 * temp[i] + temp[i - 1]) / (dx * dx);
            newTemp[i] += alpha * d2T * dt;
        }
        newTemp[0] = T_hot;
        newTemp[N - 1] = T_cold;
        temp = newTemp;
    }

    // ============================================================
    // F. 溫度取樣（用於粒子和漸層）
    // ============================================================
    function getTempAt(normX) {
        // normX: 0~1，插值取溫度
        let idx = normX * (N - 1);
        let i = Math.floor(idx);
        let frac = idx - i;
        if (i >= N - 1) return temp[N - 1];
        return temp[i] * (1 - frac) + temp[i + 1] * frac;
    }

    // ============================================================
    // G. 粒子更新
    // ============================================================
    function updateParticles(dt) {
        for (let p of particles) {
            let T = getTempAt(p.baseXNorm);
            let intensity = Math.max(0, (T - 20) / 480);
            let amp = 1 + intensity * 5;
            let freq = 2 + intensity * 12;
            p.phase += dt * freq;
            p.offsetX = amp * Math.sin(p.phase);
            p.offsetY = amp * Math.cos(p.phase * 0.7 + p.col * 0.4);
        }
    }

    // ============================================================
    // H. 溫度 → 顏色（平滑漸層，使用多色階插值）
    // ============================================================
    function tempToColor(T) {
        let t = Math.max(0, Math.min(1, (T - 20) / 480));

        // 定義色階：0=冷藍 → 0.3=青 → 0.5=綠黃 → 0.7=橙 → 1.0=熱紅
        const stops = [
            { pos: 0.0,  r: 40,  g: 90,  b: 200 },  // 深藍
            { pos: 0.2,  r: 50,  g: 160, b: 220 },  // 天藍
            { pos: 0.35, r: 80,  g: 210, b: 180 },  // 青綠
            { pos: 0.5,  r: 230, g: 220, b: 60  },  // 黃
            { pos: 0.65, r: 250, g: 160, b: 40  },  // 橙
            { pos: 0.8,  r: 240, g: 80,  b: 30  },  // 深橙紅
            { pos: 1.0,  r: 200, g: 30,  b: 20  }   // 暗紅
        ];

        // 找到 t 所在的兩個色階，線性插值
        let lo = stops[0], hi = stops[stops.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
            if (t >= stops[i].pos && t <= stops[i + 1].pos) {
                lo = stops[i];
                hi = stops[i + 1];
                break;
            }
        }

        let range = hi.pos - lo.pos;
        let u = range > 0 ? (t - lo.pos) / range : 0;
        let r = lo.r + (hi.r - lo.r) * u;
        let g = lo.g + (hi.g - lo.g) * u;
        let b = lo.b + (hi.b - lo.b) * u;
        return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    }

    // ============================================================
    // I. 繪圖
    // ============================================================
    function draw() {
        PhysicsUtils.beginFrame(ctx, canvas);

        let rodLeft = 100;
        let rodRight = canvas.cssWidth - 80;
        let rodW = rodRight - rodLeft;
        let rodTop = canvas.cssHeight * 0.3;
        let rodH = canvas.cssHeight * 0.35;
        let rodBot = rodTop + rodH;

        // --- 背景網格 ---
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        for (let gx = rodLeft; gx <= rodRight; gx += rodW / 10) {
            ctx.beginPath();
            ctx.moveTo(gx, rodTop - 30);
            ctx.lineTo(gx, rodBot + 30);
            ctx.stroke();
        }

        // --- 物體：用 canvas 繪製平滑漸層 ---
        // 先畫一個與物體等大的離屏漸層
        let grad = ctx.createLinearGradient(rodLeft, 0, rodRight, 0);
        let gradSteps = 40; // 漸層色階數量
        for (let i = 0; i <= gradSteps; i++) {
            let normX = i / gradSteps;
            let T = getTempAt(normX);
            grad.addColorStop(normX, tempToColor(T));
        }
        ctx.fillStyle = grad;
        ctx.fillRect(rodLeft, rodTop, rodW, rodH);

        // 物體邊框
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(rodLeft, rodTop, rodW, rodH);

        // --- 溫度刻度標籤 ---
        ctx.font = '700 12px "Inter", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        for (let i = 0; i <= 10; i++) {
            let x = rodLeft + (i / 10) * rodW;
            let T_at_x = getTempAt(i / 10);
            ctx.fillText(T_at_x.toFixed(0) + '°', x, rodBot + 20);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, rodBot);
            ctx.lineTo(x, rodBot + 6);
            ctx.stroke();
        }

        // 位置標籤
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('0 m', rodLeft, rodBot + 38);
        ctx.fillText((rodLength / 2).toFixed(2) + ' m', rodLeft + rodW / 2, rodBot + 38);
        ctx.fillText(rodLength.toFixed(1) + ' m', rodRight, rodBot + 38);

        // --- 左端熱源 🔥 ---
        ctx.font = '40px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔥', rodLeft - 45, rodTop + rodH / 2 + 14);
        ctx.font = '700 13px "Inter", sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(T_hot + '°C', rodLeft - 45, rodTop - 15);
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('HOT', rodLeft - 45, rodTop - 30);

        // --- 右端冷源 ❄️ ---
        ctx.font = '40px serif';
        ctx.fillText('❄️', rodRight + 45, rodTop + rodH / 2 + 14);
        ctx.font = '700 13px "Inter", sans-serif';
        ctx.fillStyle = '#3b82f6';
        ctx.fillText(T_cold + '°C', rodRight + 45, rodTop - 15);
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('COLD', rodRight + 45, rodTop - 30);

        // --- 材質標籤 ---
        ctx.font = '800 14px "Inter", monospace';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText(materials[materialKey].name + '  k = ' + k + ' W/m·K', rodLeft + rodW / 2, rodTop - 20);

        // --- 粒子視圖 ---
        if (showParticles) {
            drawParticles(rodLeft, rodTop, rodW, rodH);
        }

        // --- 標題 ---
        ctx.font = '900 16px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('HEAT CONDUCTION / 熱傳導', 20, 30);
    }

    // ============================================================
    // J. 粒子繪圖（六角排列 + 漸層背景）
    // ============================================================
    function drawParticles(rodLeft, rodTop, rodW, rodH) {
        // 先畫半透明遮罩，讓粒子更突出
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(rodLeft, rodTop, rodW, rodH);

        let pRadius = Math.min(rodW / GRID_COLS * 0.38, rodH / GRID_ROWS * 0.38);
        pRadius = Math.max(pRadius, 4);

        // 限制粒子在金屬棒範圍內
        let minRX = rodLeft + pRadius;
        let maxRX = rodLeft + rodW - pRadius;
        let minRY = rodTop + pRadius;
        let maxRY = rodTop + rodH - pRadius;

        for (let p of particles) {
            let baseX = rodLeft + p.baseXNorm * rodW;
            let baseY = rodTop + p.baseYNorm * rodH;
            let x = Math.max(minRX, Math.min(maxRX, baseX + p.offsetX));
            let y = Math.max(minRY, Math.min(maxRY, baseY + p.offsetY));
            let T = getTempAt(p.baseXNorm);

            // 粒子外圈（光暈）
            let intensity = Math.max(0, (T - 20) / 480);
            if (intensity > 0.1) {
                ctx.beginPath();
                ctx.arc(x, y, pRadius * 1.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,${Math.round(180 - intensity * 120)},${Math.round(60 - intensity * 40)},${intensity * 0.2})`;
                ctx.fill();
            }

            // 粒子本體
            ctx.beginPath();
            ctx.arc(x, y, pRadius, 0, Math.PI * 2);
            ctx.fillStyle = tempToColor(T);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 高光
            ctx.beginPath();
            ctx.arc(x - pRadius * 0.25, y - pRadius * 0.25, pRadius * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fill();
        }
    }

    // ============================================================
    // K. 動畫迴圈
    // ============================================================
    function loop(currentTimestamp) {
        if (!isRunning || isPaused) return;

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.05) dt = 0.05;

        simTime += dt;

        // 時間壓縮（每幀模擬較多時間步，加速可視化）
        let simSteps = 2000;
        let simDt = dt / simSteps;
        for (let s = 0; s < simSteps; s++) {
            updateHeat(simDt);
        }

        updateParticles(dt);
        updateCards();
        updateChart();
        draw();

        animationFrameId = requestAnimationFrame(loop);
    }

    // ============================================================
    // L. 初始繪製
    // ============================================================
    updateCards();
    draw();
}

initConduction();
