/**
 * 🌊 熱對流模擬 — 對流循環
 * 容器底部加熱、頂部冷卻，觀察粒子形成對流胞
 */
function initConvection() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ===== 參數 =====
    let T_hot = 80;
    let T_cold = 20;
    let viscosity = 0.3;
    let isRunning = false;
    let isPaused = false;
    let showVelocity = false;
    let simTime = 0;
    let lastTimestamp = 0;

    // 容器比例
    const CONTAINER_RATIO_W = 0.38;
    const CONTAINER_RATIO_H = 0.72;

    // 粒子
    const NUM_PARTICLES = 200;
    let particles = [];
    // 軌跡歷史
    const TRAIL_LEN = 12;
    let trails = [];

    function initParticles() {
        particles = [];
        trails = [];
        for (let i = 0; i < NUM_PARTICLES; i++) {
            let px = Math.random();
            let py = Math.random();
            particles.push({
                x: px, y: py,
                vx: 0, vy: 0,
                temp: T_hot + (T_cold - T_hot) * py,
                phase: Math.random() * Math.PI * 2,
                size: 3.5 + Math.random() * 1.5
            });
            trails.push([]);
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
                    <span>底部溫度 <i>T</i><sub>hot</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="thVal" style="color: #ef4444;">80</span> °C
                    </span>
                </label>
                <input type="range" id="thSlider" min="30" max="200" step="5" value="80">
            </div>
            <div class="control-box">
                <label>
                    <span>頂部溫度 <i>T</i><sub>cold</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="tcVal" style="color: #3b82f6;">20</span> °C
                    </span>
                </label>
                <input type="range" id="tcSlider" min="0" max="50" step="1" value="20">
            </div>
            <div class="control-box">
                <label><span>粘度 Viscosity</span></label>
                <select id="viscSelect" style="width:100%; padding:8px; font-weight:700; font-size:0.95rem; border:2px solid #000; background:#fff; cursor:pointer;">
                    <option value="0.08">低 Low（水）</option>
                    <option value="0.25" selected>中 Medium（油）</option>
                    <option value="0.6">高 High（蜂蜜）</option>
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
                <button id="velBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.85rem; letter-spacing: 1px;">顯示流速 / SHOW VELOCITY</button>
            </div>
            <div class="control-box" style="margin-top: auto; border-top: 2px solid #000; padding-top: 12px; background: #fff;">
                <label style="margin-bottom: 4px; color: #64748b; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">BUOYANCY / 浮力</label>
                <div style="font-size: 1rem; font-weight: 900; font-family: Cambria, serif; color: #000; margin-bottom: 4px;">$$F = \\rho_0 \\beta \\Delta T g$$</div>
                <label style="font-size: 0.8rem; color: #1e293b; display: block;">對流條件：$Ra > 1708$</label>
            </div>
        `;

        if (window.MathJax && window.MathJax.typeset) window.MathJax.typeset([ctrlPanel]);

        document.getElementById('thSlider').addEventListener('input', function() {
            T_hot = parseFloat(this.value);
            document.getElementById('thVal').innerText = T_hot;
        });
        document.getElementById('tcSlider').addEventListener('input', function() {
            T_cold = parseFloat(this.value);
            document.getElementById('tcVal').innerText = T_cold;
        });
        document.getElementById('viscSelect').addEventListener('change', function() {
            viscosity = parseFloat(this.value);
        });

        document.getElementById('startBtn').addEventListener('click', () => {
            isRunning = true;
            isPaused = false;
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('pauseBtn').disabled = false;
            lastTimestamp = performance.now();
            loop(performance.now());
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            if (!isRunning) return;
            isPaused = !isPaused;
            let btn = document.getElementById('pauseBtn');
            btn.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
            btn.style.backgroundColor = isPaused ? "#2563eb" : "#ffffff";
            btn.style.color = isPaused ? "#ffffff" : "#000000";
            if (!isPaused) {
                lastTimestamp = performance.now();
                loop(performance.now());
            }
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            isRunning = false;
            isPaused = false;
            simTime = 0;
            initParticles();
            document.getElementById('startBtn').style.display = 'block';
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('pauseBtn').innerText = "暫停 / PAUSE";
            document.getElementById('pauseBtn').style.backgroundColor = "#ffffff";
            document.getElementById('pauseBtn').style.color = "#000000";
            updateCards();
            draw();
        });

        document.getElementById('velBtn').addEventListener('click', () => {
            showVelocity = !showVelocity;
            let btn = document.getElementById('velBtn');
            btn.innerText = showVelocity ? "隱藏流速 / HIDE VELOCITY" : "顯示流速 / SHOW VELOCITY";
            btn.style.backgroundColor = showVelocity ? "#2563eb" : "#000000";
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
                <span class="card-label">底部溫度 T_HOT</span>
                <div class="card-num-wrapper"><span id="cardTh" class="card-num">80.0</span><span class="card-unit">°C</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">頂部溫度 T_COLD</span>
                <div class="card-num-wrapper"><span id="cardTc" class="card-num">20.0</span><span class="card-unit">°C</span></div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">溫度差 ΔT</span>
                <div class="card-num-wrapper"><span id="cardDt" class="card-num">60.0</span><span class="card-unit">°C</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">平均流速 V_AVG</span>
                <div class="card-num-wrapper"><span id="cardV" class="card-num">0.0</span><span class="card-unit">cm/s</span></div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">瑞利數 Ra</span>
                <div class="card-num-wrapper"><span id="cardRa" class="card-num">0</span><span class="card-unit">—</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">模擬時間 TIME</span>
                <div class="card-num-wrapper"><span id="cardTime" class="card-num">0.00</span><span class="card-unit">s</span></div>
            </div>
        `;
    }

    function updateCards() {
        const el = (id) => document.getElementById(id);
        if (el('cardTh')) el('cardTh').innerText = T_hot.toFixed(1);
        if (el('cardTc')) el('cardTc').innerText = T_cold.toFixed(1);
        if (el('cardDt')) el('cardDt').innerText = (T_hot - T_cold).toFixed(1);

        let avgV = 0;
        for (let p of particles) avgV += Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        avgV = avgV / particles.length * 80;
        if (el('cardV')) el('cardV').innerText = avgV.toFixed(1);

        let dT = Math.max(0, T_hot - T_cold);
        let Ra = Math.round(9.8 * 2.1e-4 * dT * Math.pow(0.1, 3) / (1e-6 * 1.4e-7));
        if (el('cardRa')) el('cardRa').innerText = Ra > 1e6 ? (Ra / 1e6).toFixed(1) + 'M' : Ra.toString();
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
                <div class="pane-meta-title">// VERTICAL TEMPERATURE</div>
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
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                indexAxis: 'y',
                scales: {
                    x: { title: { display: true, text: '溫度 T (°C)', font: { weight: 'bold' } }, min: 0 },
                    y: { title: { display: true, text: '高度', font: { weight: 'bold' } }, reverse: true }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateChart() {
        if (!tempChart) return;
        let bins = 15;
        let binSum = new Array(bins).fill(0);
        let binCount = new Array(bins).fill(0);
        for (let p of particles) {
            let b = Math.min(Math.floor(p.y * bins), bins - 1);
            binSum[b] += p.temp;
            binCount[b]++;
        }
        let labels = [], data = [];
        for (let i = 0; i < bins; i++) {
            labels.push(((i + 0.5) / bins).toFixed(2));
            data.push(binCount[i] > 0 ? binSum[i] / binCount[i] : (T_hot + T_cold) / 2);
        }
        tempChart.data.labels = labels;
        tempChart.data.datasets[0].data = data;
        tempChart.update('none');
    }

    // ============================================================
    // E. 物理引擎 — 對流
    // ============================================================

    // 對流速度場：根據位置返回 (vx, vy)
    // 兩個對流胞：左半順時針，右半逆時針
    function getConvectionVelocity(x, y) {
        let dT = Math.max(0.1, T_hot - T_cold);
        let strength = dT * 0.015;

        // 左半胞：順時針（右→上→左→下）
        // 右半胞：逆時針（左→上→右→下）
        let vx = 0, vy = 0;

        // 中心偏移量
        let lx = x * 2;          // 左半 0~1
        let rx = (x - 0.5) * 2;  // 右半 0~1

        if (x < 0.5) {
            // 左半胞：順時針
            // 底部向右，右邊向上，頂部向左，左邊向下
            vx = strength * (y - 0.5) * 1.2;
            vy = -strength * (lx - 0.5) * 1.2;
        } else {
            // 右半胞：逆時針
            // 底部向左，左邊向上，頂部向右，右邊向下
            vx = -strength * (y - 0.5) * 1.2;
            vy = -strength * (rx - 0.5) * 1.2;
        }

        // 底部邊界：加熱產生上升力
        if (y > 0.85) {
            let heatForce = dT * 0.03 * (1 - (1 - y) / 0.15);
            vy -= heatForce;
        }

        // 頂部邊界：冷卻產生下沉力
        if (y < 0.15) {
            let coolForce = dT * 0.02 * (1 - y / 0.15);
            vy += coolForce;
        }

        return { vx, vy };
    }

    function updateParticles(dt) {
        let drag = viscosity;

        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];

            // 取得該位置的對流速度場
            let field = getConvectionVelocity(p.x, p.y);

            // 浮力驅動
            p.vx += (field.vx - p.vx) * dt * 3;
            p.vy += (field.vy - p.vy) * dt * 3;

            // 流體阻力
            p.vx *= (1 - drag * dt * 3);
            p.vy *= (1 - drag * dt * 3);

            // 速度限制
            let maxV = 1.5;
            let speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > maxV) {
                p.vx = p.vx / speed * maxV;
                p.vy = p.vy / speed * maxV;
            }

            // 微小隨機擾動
            p.vx += (Math.random() - 0.5) * 0.15 * dt;
            p.vy += (Math.random() - 0.5) * 0.15 * dt;

            // 位置更新
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // 溫度跟隨垂直位置
            p.temp = T_hot + (T_cold - T_hot) * p.y;

            // 邊界：反彈 + 保持在容器內
            if (p.x < 0.01) { p.x = 0.01; p.vx = Math.abs(p.vx) * 0.6; }
            if (p.x > 0.99) { p.x = 0.99; p.vx = -Math.abs(p.vx) * 0.6; }
            if (p.y < 0.01) { p.y = 0.01; p.vy = Math.abs(p.vy) * 0.4; }
            if (p.y > 0.99) { p.y = 0.99; p.vy = -Math.abs(p.vy) * 0.4; }

            // 相位
            p.phase += dt * (3 + speed * 2);

            // 軌跡
            trails[i].push({ x: p.x, y: p.y });
            if (trails[i].length > TRAIL_LEN) trails[i].shift();
        }
    }

    // ============================================================
    // F. 溫度 → 顏色
    // ============================================================
    function tempToColor(T) {
        let t = Math.max(0, Math.min(1, (T - 10) / 190));
        const stops = [
            { pos: 0.0,  r: 40,  g: 90,  b: 200 },
            { pos: 0.2,  r: 50,  g: 160, b: 220 },
            { pos: 0.35, r: 80,  g: 210, b: 180 },
            { pos: 0.5,  r: 230, g: 220, b: 60  },
            { pos: 0.65, r: 250, g: 160, b: 40  },
            { pos: 0.8,  r: 240, g: 80,  b: 30  },
            { pos: 1.0,  r: 200, g: 30,  b: 20  }
        ];
        let lo = stops[0], hi = stops[stops.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
            if (t >= stops[i].pos && t <= stops[i + 1].pos) { lo = stops[i]; hi = stops[i + 1]; break; }
        }
        let u = (hi.pos - lo.pos) > 0 ? (t - lo.pos) / (hi.pos - lo.pos) : 0;
        return `rgb(${Math.round(lo.r + (hi.r - lo.r) * u)},${Math.round(lo.g + (hi.g - lo.g) * u)},${Math.round(lo.b + (hi.b - lo.b) * u)})`;
    }

    // ============================================================
    // G. 繪圖
    // ============================================================
    function draw() {
        PhysicsUtils.beginFrame(ctx, canvas);

        let cw = canvas.cssWidth * CONTAINER_RATIO_W;
        let ch = canvas.cssHeight * CONTAINER_RATIO_H;
        let cx = (canvas.cssWidth - cw) / 2;
        let cy = (canvas.cssHeight - ch) / 2;

        // 背景
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.cssWidth, canvas.cssHeight);

        // 容器內部漸層背景
        let grad = ctx.createLinearGradient(0, cy + ch, 0, cy);
        grad.addColorStop(0.0, tempToColor(T_hot));
        grad.addColorStop(0.5, tempToColor((T_hot + T_cold) / 2));
        grad.addColorStop(1.0, tempToColor(T_cold));
        ctx.fillStyle = grad;
        ctx.fillRect(cx, cy, cw, ch);

        // 底部熱源
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cx, cy + ch - 6, cw, 6);
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔥', cx - 35, cy + ch + 8);
        ctx.font = '700 12px "Inter", sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(T_hot + '°C', cx - 35, cy + ch + 25);

        // 頂部冷源
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(cx, cy, cw, 6);
        ctx.font = '28px serif';
        ctx.fillText('❄️', cx - 35, cy + 12);
        ctx.font = '700 12px "Inter", sans-serif';
        ctx.fillStyle = '#3b82f6';
        ctx.fillText(T_cold + '°C', cx - 35, cy - 5);

        // 容器邊框
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, cw, ch);

        // 繪製軌跡
        drawTrails(cx, cy, cw, ch);

        // 繪製粒子
        drawParticles(cx, cy, cw, ch);

        // 速度箭頭
        if (showVelocity) drawVelocityArrows(cx, cy, cw, ch);

        // 標題
        ctx.font = '900 16px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('THERMAL CONVECTION / 熱對流', 20, 30);

        // 圖例
        ctx.font = '600 12px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('● 熱（上升）', cx + cw + 20, cy + ch * 0.3);
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('● 冷（下沉）', cx + cw + 20, cy + ch * 0.7);
    }

    function drawTrails(cx, cy, cw, ch) {
        let margin = 8;

        for (let i = 0; i < particles.length; i++) {
            let trail = trails[i];
            if (trail.length < 3) continue;

            // 只畫部分粒子的軌跡（避免太雜）
            if (i % 3 !== 0) continue;

            let p = particles[i];
            let speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed < 0.08) continue;

            ctx.beginPath();
            for (let j = 0; j < trail.length; j++) {
                let tx = cx + margin + trail[j].x * (cw - margin * 2);
                let ty = cy + margin + trail[j].y * (ch - margin * 2);
                if (j === 0) ctx.moveTo(tx, ty);
                else ctx.lineTo(tx, ty);
            }
            let alpha = Math.min(0.4, speed * 0.5);
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    function drawParticles(cx, cy, cw, ch) {
        let margin = 8;

        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            let px = cx + margin + p.x * (cw - margin * 2);
            let py = cy + margin + p.y * (ch - margin * 2);
            let speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            let pulse = 1 + 0.12 * Math.sin(p.phase);

            // 粒子大小：基礎 + 速度
            let baseR = p.size * 0.8;
            let r = (baseR + speed * 8) * pulse;
            r = Math.max(r, 2.5);

            // 光暈（速度越快越亮）
            if (speed > 0.06) {
                ctx.beginPath();
                ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
                let glow = Math.min(0.5, speed * 0.8);
                ctx.fillStyle = `rgba(255,255,255,${glow})`;
                ctx.fill();
            }

            // 粒子本體
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle = tempToColor(p.temp);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.6;
            ctx.stroke();

            // 高光
            ctx.beginPath();
            ctx.arc(px - r * 0.2, py - r * 0.2, r * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();
        }
    }

    function drawVelocityArrows(cx, cy, cw, ch) {
        let margin = 8;
        let gridN = 6;
        let cellW = (cw - margin * 2) / gridN;
        let cellH = (ch - margin * 2) / gridN;

        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';

        for (let gy = 0; gy < gridN; gy++) {
            for (let gx = 0; gx < gridN; gx++) {
                let avgVx = 0, avgVy = 0, count = 0;
                let x0 = gx / gridN, x1 = (gx + 1) / gridN;
                let y0 = gy / gridN, y1 = (gy + 1) / gridN;

                for (let p of particles) {
                    if (p.x >= x0 && p.x < x1 && p.y >= y0 && p.y < y1) {
                        avgVx += p.vx;
                        avgVy += p.vy;
                        count++;
                    }
                }

                if (count > 0) {
                    avgVx /= count;
                    avgVy /= count;
                    let mag = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
                    if (mag < 0.03) continue;

                    let ax = cx + margin + (gx + 0.5) * cellW;
                    let ay = cy + margin + (gy + 0.5) * cellH;
                    let len = Math.min(mag * 50, cellW * 0.4);
                    let angle = Math.atan2(avgVy, avgVx);
                    let endX = ax + len * Math.cos(angle);
                    let endY = ay + len * Math.sin(angle);

                    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    let headLen = 5;
                    ctx.beginPath();
                    ctx.moveTo(endX, endY);
                    ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
                    ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    }

    // ============================================================
    // H. 動畫迴圈
    // ============================================================
    function loop(currentTimestamp) {
        if (!isRunning || isPaused) return;

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.05) dt = 0.05;

        simTime += dt;

        let steps = 80;
        let subDt = dt / steps;
        for (let s = 0; s < steps; s++) {
            updateParticles(subDt);
        }

        updateCards();
        updateChart();
        draw();

        animationFrameId = requestAnimationFrame(loop);
    }

    // ============================================================
    // I. 初始繪製
    // ============================================================
    updateCards();
    draw();
}

initConvection();
