// 🪂 終端速度與流體阻力 — 跳傘員自由落體模擬
function initTerminalVelocity() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ===== 物理參數 =====
    let mass = 70;          // 跳傘員質量 (kg)
    let gravity = 9.8;      // 重力加速度 (m/s²)
    let kBase = 0.35;       // 無降落傘阻力係數（腹部朝下 ≈ 0.3–0.5）
    let kPara = 1.5;        // 有降落傘阻力係數
    let k = kBase;          // 當前阻力係數

    let v = 0;              // 速度 (m/s)，向下為正
    let altitude = 4000;    // 當前高度 (m)
    let scrollOffset = 0;   // 背景捲動偏移
    let parachuteOpen = false;
    let isPaused = false;
    let simStarted = false;
    let simTime = 0;
    let lastTimestamp = 0;
    let animationFrameId;

    // 雲朵
    let clouds = [];
    function initClouds() {
        clouds = [];
        for (let i = 0; i < 12; i++) {
            clouds.push({
                x: Math.random() * 1200,
                y: Math.random() * 2000,
                w: 60 + Math.random() * 100,
                h: 20 + Math.random() * 30,
                speed: 0.3 + Math.random() * 0.5
            });
        }
    }
    initClouds();

    // 星星（高空可見）
    let stars = [];
    for (let i = 0; i < 80; i++) {
        stars.push({
            x: Math.random() * 1200,
            y: Math.random() * 600,
            r: 0.5 + Math.random() * 1.5,
            brightness: 0.3 + Math.random() * 0.7,
            twinkleSpeed: 1 + Math.random() * 3
        });
    }

    // 風速粒子
    let windParticles = [];

    // ===== 控制台 =====
    if (ctrlPanel) {
        ctrlPanel.style.maxHeight = 'calc(100vh - 120px)';
        ctrlPanel.style.overflowY = 'auto';
        ctrlPanel.style.display = 'flex';
        ctrlPanel.style.flexDirection = 'column';
        ctrlPanel.style.gap = '12px';
        ctrlPanel.style.paddingRight = '8px';

        ctrlPanel.innerHTML = `
            <div class="control-group" style="margin: 0;">
                <label>質量 <i>m</i>: <span id="mVal">70</span> kg</label>
                <input type="range" id="mSlider" min="40" max="120" step="1" value="70" style="width:100%;">
            </div>
            <div class="control-group" style="margin: 0;">
                <label>重力加速度 <i>g</i>: <span id="gVal">9.8</span> m/s²</label>
                <input type="range" id="gSlider" min="1.0" max="20.0" step="0.1" value="9.8" style="width:100%;">
            </div>
            <div class="control-group" style="margin: 0;">
                <label>阻力係數 <i>k</i>: <span id="kVal">0.350</span></label>
                <input type="range" id="kSlider" min="0.05" max="0.60" step="0.01" value="0.35" style="width:100%;">
            </div>
            <div class="control-group" style="margin: 0;">
                <button id="startBtn" style="width: 100%; padding: 14px; background: #16a34a; color: #ffffff; border: none; font-weight: 700; cursor: pointer; font-size: 1rem; letter-spacing: 1px;">開始 / START</button>
            </div>
            <div class="control-group" style="margin: 0;">
                <button id="chuteBtn" style="width: 100%; padding: 12px; background: #2563eb; color: #ffffff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; letter-spacing: 1px;" disabled>打開降落傘 / OPEN PARACHUTE</button>
            </div>
            <div class="control-group" style="margin: 0; display: flex; gap: 8px;">
                <button id="pauseBtn" style="flex: 1; padding: 8px; background: #000000; color: #ffffff; border: none; font-weight: 700; cursor: pointer; font-size: 0.85rem;" disabled>暫停 / PAUSE</button>
                <button id="resetBtn" style="flex: 1; padding: 8px; background: #ffffff; color: #000000; border: 1px solid #000000; font-weight: 700; cursor: pointer; font-size: 0.85rem;">重設 / RESET</button>
            </div>
            <div class="control-group" style="margin-top: auto; border-top: 2px solid #000000; padding-top: 10px; background: #ffffff;">
                <label style="margin-bottom: 2px; color: #64748b; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">DRAG FORCE / 空氣阻力</label>
                <div style="font-size: 1.1rem; font-weight: 900; font-family: Cambria, serif; color: #000000; margin-bottom: 4px;">$$F_d = kv^2$$</div>
                <label style="font-size: 0.8rem; color: #1e293b; display: block;">終端速度 $v_t = \\sqrt{\\frac{mg}{k}}$</label>
            </div>
        `;

        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset([ctrlPanel]);
        }

        const mSlider = document.getElementById('mSlider');
        const gSlider = document.getElementById('gSlider');
        const kSlider = document.getElementById('kSlider');
        const startBtn = document.getElementById('startBtn');
        const chuteBtn = document.getElementById('chuteBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');

        startBtn.addEventListener('click', () => {
            simStarted = true;
            startBtn.style.display = 'none';
            chuteBtn.disabled = false;
            pauseBtn.disabled = false;
            lastTimestamp = performance.now();
            requestAnimationFrame(loop);
        });

        mSlider.addEventListener('input', () => {
            mass = parseFloat(mSlider.value);
            document.getElementById('mVal').innerText = mass;
        });
        gSlider.addEventListener('input', () => {
            gravity = parseFloat(gSlider.value);
            document.getElementById('gVal').innerText = gravity.toFixed(1);
        });
        kSlider.addEventListener('input', () => {
            k = parseFloat(kSlider.value);
            document.getElementById('kVal').innerText = k.toFixed(3);
        });

        chuteBtn.addEventListener('click', () => {
            parachuteOpen = !parachuteOpen;
            if (parachuteOpen) {
                k = kPara;
                kSlider.min = '0.8';
                kSlider.max = '2.5';
                kSlider.step = '0.05';
                kSlider.value = kPara;
                document.getElementById('kVal').innerText = kPara.toFixed(2);
                chuteBtn.innerText = "關閉降落傘 / CLOSE PARACHUTE";
                chuteBtn.style.backgroundColor = "#ef4444";
            } else {
                k = kBase;
                kSlider.min = '0.05';
                kSlider.max = '0.60';
                kSlider.step = '0.01';
                kSlider.value = kBase;
                document.getElementById('kVal').innerText = kBase.toFixed(3);
                chuteBtn.innerText = "打開降落傘 / OPEN PARACHUTE";
                chuteBtn.style.backgroundColor = "#2563eb";
            }
        });

        pauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            pauseBtn.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
            pauseBtn.style.backgroundColor = isPaused ? "#2563eb" : "#000000";
        });

        resetBtn.addEventListener('click', () => {
            cancelAnimationFrame(animationFrameId);
            v = 0;
            altitude = 4000;
            scrollOffset = 0;
            simTime = 0;
            lastChartTime = 0;
            if (myChart) {
                myChart.data.labels = [];
                myChart.data.datasets[0].data = [];
                myChart.update();
            }
            parachuteOpen = false;
            isPaused = false;
            simStarted = false;
            k = kBase;
            kSlider.min = '0.05';
            kSlider.max = '0.60';
            kSlider.step = '0.01';
            kSlider.value = kBase;
            document.getElementById('kVal').innerText = kBase.toFixed(3);
            chuteBtn.innerText = "打開降落傘 / OPEN PARACHUTE";
            chuteBtn.style.backgroundColor = "#2563eb";
            chuteBtn.disabled = true;
            pauseBtn.innerText = "暫停 / PAUSE";
            pauseBtn.style.backgroundColor = "#000000";
            pauseBtn.disabled = true;
            startBtn.style.display = 'block';
            initClouds();
            windParticles = [];
            draw(0, 0, 0);
        });
    }

    const guardEl = ctrlPanel;

    // ===== 數據卡片 =====
    const dataGrid = document.getElementById('dataCardsGrid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(140px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">高度 ALTITUDE</span>
                <div class="card-num-wrapper"><span id="cardAlt" class="card-num">4000</span><span class="card-unit">m</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">模擬時間 TIME</span>
                <div class="card-num-wrapper"><span id="cardTime" class="card-num">0.0</span><span class="card-unit">s</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">速度 VELOCITY</span>
                <div class="card-num-wrapper"><span id="cardV" class="card-num">0.0</span><span class="card-unit">m/s</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">加速度 ACCEL</span>
                <div class="card-num-wrapper"><span id="cardA" class="card-num">9.80</span><span class="card-unit">m/s²</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">重力 GRAVITY</span>
                <div class="card-num-wrapper"><span id="cardFg" class="card-num">686</span><span class="card-unit">N</span></div>
            </div>
            <div class="data-card" style="grid-column: span 2;">
                <span class="card-label">阻力 DRAG</span>
                <div class="card-num-wrapper"><span id="cardFd" class="card-num">0</span><span class="card-unit">N</span></div>
            </div>
        `;
    }

    const cardAlt = document.getElementById('cardAlt');
    const cardTime = document.getElementById('cardTime');
    const cardV = document.getElementById('cardV');
    const cardA = document.getElementById('cardA');
    const cardFg = document.getElementById('cardFg');
    const cardFd = document.getElementById('cardFd');

    // ===== Chart.js 速度-時間圖 =====
    const chartContainer = document.getElementById('chartContainer');
    const chartCtx = document.getElementById('realtimeChart');
    let myChart = null;
    let lastChartTime = 0;

    if (chartContainer && chartCtx) {
        chartContainer.style.display = 'block';
        myChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '速度 v (m/s)',
                    data: [],
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '時間 t (s)', font: { weight: 'bold' } }, grid: { display: false } },
                    y: { title: { display: true, text: '速度 v (m/s)', font: { weight: 'bold' } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ===== Canvas 自適應 =====
    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ===== 物理迴圈 =====
    function loop(currentTimestamp) {
        if (!document.contains(guardEl)) return;
        if (!simStarted) return;

        if (isPaused) {
            lastTimestamp = currentTimestamp;
            animationFrameId = requestAnimationFrame(loop);
            return;
        }

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.1) dt = 0.1;

        simTime += dt;

        // 物理：F_net = mg - kv²（向下為正）
        const fg = mass * gravity;
        const fd_old = k * v * v;
        const fnet = fg - fd_old;
        const accel = fnet / mass;

        v += accel * dt;
        if (v < 0) v = 0;

        // 更新高度
        altitude -= v * dt;
        if (altitude < 0) altitude = 0;

        // 用更新後的速度重新計算阻力
        const fd = k * v * v;

        scrollOffset += v * dt * 8;

        // 更新數據卡片
        if (cardAlt) cardAlt.innerText = altitude.toFixed(0);
        if (cardTime) cardTime.innerText = simTime.toFixed(1);
        if (cardV) cardV.innerText = v.toFixed(1);
        if (cardA) cardA.innerText = accel.toFixed(2);
        if (cardFg) cardFg.innerText = fg.toFixed(0);
        if (cardFd) cardFd.innerText = fd.toFixed(0);

        // 更新圖表（每 0.1 秒一個數據點）
        if (myChart && simTime - lastChartTime >= 0.1) {
            myChart.data.labels.push(simTime.toFixed(1));
            myChart.data.datasets[0].data.push(v);
            myChart.update('none');
            lastChartTime = simTime;
        }

        draw(fg, fd, accel);
        animationFrameId = requestAnimationFrame(loop);
    }

    // ===== 渲染 =====
    function draw(fg, fd, accel) {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        let altRatio = Math.min(altitude / 4000, 1);

        // --- 天空漸層（多段，高空深邃、低空明亮） ---
        let skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        let topR = Math.floor(8 + altRatio * 12);
        let topG = Math.floor(12 + altRatio * 18);
        let topB = Math.floor(35 + altRatio * 45);
        let midR = Math.floor(40 + altRatio * 30);
        let midG = Math.floor(80 + altRatio * 60);
        let midB = Math.floor(160 + altRatio * 50);
        let botR = Math.floor(100 + altRatio * 30);
        let botG = Math.floor(180 + altRatio * 20);
        let botB = Math.floor(240 + altRatio * 10);
        skyGrad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
        skyGrad.addColorStop(0.35, `rgb(${midR},${midG},${midB})`);
        skyGrad.addColorStop(0.7, `rgb(${Math.floor((midR + botR) / 2)},${Math.floor((midG + botG) / 2)},${Math.floor((midB + botB) / 2)})`);
        skyGrad.addColorStop(1, `rgb(${botR},${botG},${botB})`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // --- 星空（高空可見，帶閃爍） ---
        let starAlpha = Math.max(0, (altRatio - 0.4) / 0.6);
        if (starAlpha > 0) {
            stars.forEach(s => {
                let twinkle = 0.5 + 0.5 * Math.sin(simTime * s.twinkleSpeed + s.x);
                let a = s.brightness * twinkle * starAlpha;
                ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
                ctx.beginPath();
                ctx.arc(s.x % W, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // --- 雲朵（多圓堆疊 + 陰影） ---
        clouds.forEach(c => {
            let cy = ((c.y - scrollOffset * c.speed) % (H + 200)) - 100;
            if (cy < -80) cy += H + 200;
            let cx = c.x % W;
            // 陰影
            ctx.fillStyle = 'rgba(180,200,220,0.12)';
            for (let i = 0; i < 4; i++) {
                let ox = (i - 1.5) * c.w * 0.22;
                let oy = 3;
                ctx.beginPath();
                ctx.ellipse(cx + ox, cy + oy, c.w * 0.28 + i * 3, c.h * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            // 主體
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            for (let i = 0; i < 4; i++) {
                let ox = (i - 1.5) * c.w * 0.22;
                ctx.beginPath();
                ctx.ellipse(cx + ox, cy, c.w * 0.28 + i * 3, c.h * 0.45, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // --- 風速粒子 ---
        if (v > 2 && altitude > 0) {
            let spawnRate = Math.min(Math.floor(v / 5), 5);
            for (let i = 0; i < spawnRate; i++) {
                let side = Math.random() > 0.5 ? 1 : -1;
                windParticles.push({
                    x: side * (Math.random() * 40 + 10),
                    y: Math.random() * H,
                    len: 15 + Math.random() * v * 1.5,
                    speed: 8 + v * 0.6 + Math.random() * 3,
                    alpha: 0.15 + Math.random() * 0.25
                });
            }
        }
        ctx.lineWidth = 1.5;
        for (let i = windParticles.length - 1; i >= 0; i--) {
            let p = windParticles[i];
            p.y -= p.speed * 0.8;
            if (p.y + p.len < 0) { windParticles.splice(i, 1); continue; }
            let a = p.alpha * Math.min(1, (p.y + p.len) / (H * 0.3));
            ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(W / 2 + p.x, p.y);
            ctx.lineTo(W / 2 + p.x, p.y + p.len);
            ctx.stroke();
        }

        // --- 跳傘員位置 ---
        const skyX = W / 2;
        const skyY = H * 0.55;
        let landed = altitude <= 0 && v < 0.1;

        // --- 地面 ---
        if (altitude < 500) {
            let groundAlpha = Math.min(1, (500 - altitude) / 300);
            let groundY = H * 0.82;
            ctx.fillStyle = `rgba(34,120,50,${(0.85 * groundAlpha).toFixed(2)})`;
            ctx.fillRect(0, groundY, W, H - groundY);
            ctx.fillStyle = `rgba(60,40,20,${(0.4 * groundAlpha).toFixed(2)})`;
            ctx.fillRect(0, groundY + 12, W, H - groundY - 12);
            // 跑道
            ctx.fillStyle = `rgba(80,80,80,${(0.5 * groundAlpha).toFixed(2)})`;
            ctx.fillRect(W * 0.3, groundY + 2, W * 0.4, 10);
            ctx.strokeStyle = `rgba(255,255,255,${(0.6 * groundAlpha).toFixed(2)})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(W * 0.32, groundY + 7);
            ctx.lineTo(W * 0.68, groundY + 7);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- 力向量箭頭 ---
        const arrowScale = 0.5;
        const maxLen = H * 0.3;
        let fgLen = Math.min(fg * arrowScale, maxLen);
        let fdLen = Math.min(fd * arrowScale, maxLen);

        // 重力箭頭（綠色，向下）
        drawArrow(skyX, skyY + 20, skyX, skyY + 20 + fgLen, '#22c55e', 5);
        drawForceLabel(skyX, skyY + 20 + fgLen / 2, `F_g = ${fg.toFixed(0)} N`, '#22c55e');

        // 阻力箭頭（紅色，向上）
        if (fd > 0.5) {
            drawArrow(skyX, skyY - 20, skyX, skyY - 20 - fdLen, '#ef4444', 5);
            drawForceLabel(skyX, skyY - 20 - fdLen / 2, `F_d = ${fd.toFixed(0)} N`, '#ef4444');
        }

        // 終端速度標記
        let isTerminal = Math.abs(fg - fd) < fg * 0.05 && v > 1;
        if (isTerminal) {
            ctx.save();
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#facc15';
            ctx.font = '700 14px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★ TERMINAL VELOCITY / 終端速度 ★', skyX, skyY - 75);
            ctx.restore();
        }

        // --- 降落傘 ---
        if (parachuteOpen) {
            let chuteW = 120;
            let chuteH = 55;
            let chuteTop = skyY - 72 - chuteH;
            let chuteBot = skyY - 72;
            let cx = skyX;

            // --- 繩索（6 條，從傘緣收束到身體） ---
            ctx.strokeStyle = 'rgba(80,80,80,0.6)';
            ctx.lineWidth = 1;
            let ropeCount = 6;
            for (let i = 0; i < ropeCount; i++) {
                let t = (i / (ropeCount - 1)) * 2 - 1; // -1 to 1
                let attachX = cx + t * chuteW * 0.48;
                let attachY = chuteBot - 2;
                let bodyX = skyX + t * 7;
                let bodyY = skyY - 6;
                ctx.beginPath();
                ctx.moveTo(attachX, attachY);
                ctx.quadraticCurveTo(
                    (attachX + bodyX) / 2 + t * 6,
                    (attachY + bodyY) / 2 + 8,
                    bodyX, bodyY
                );
                ctx.stroke();
            }

            // --- 傘面（半橢圓形穹頂） ---
            let segs = 8;
            for (let i = 0; i < segs; i++) {
                let a0 = Math.PI + (i / segs) * Math.PI;
                let a1 = Math.PI + ((i + 1) / segs) * Math.PI;
                let x0 = cx + Math.cos(a0) * (chuteW / 2);
                let y0 = chuteBot + Math.sin(a0) * chuteH;
                let x1 = cx + Math.cos(a1) * (chuteW / 2);
                let y1 = chuteBot + Math.sin(a1) * chuteH;

                // 每片瓣葉顏色（紅白交替）
                let isRed = i % 2 === 0;
                ctx.fillStyle = isRed ? '#dc2626' : '#f1f5f9';
                ctx.beginPath();
                ctx.moveTo(cx, chuteBot);
                ctx.lineTo(x0, y0);
                ctx.arc(cx, chuteBot, chuteW / 2, a0, a1);
                ctx.closePath();
                ctx.fill();

                // 瓣葉邊線
                ctx.strokeStyle = isRed ? '#991b1b' : '#94a3b8';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }

            // 穹頂外框
            ctx.strokeStyle = '#7f1d1d';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, chuteBot, chuteW / 2, chuteH, 0, Math.PI, 0);
            ctx.stroke();

            // 底部弧線（傘口）
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(cx, chuteBot, chuteW / 2, 6, 0, 0, Math.PI);
            ctx.stroke();

            // 頂部排氣孔
            ctx.fillStyle = 'rgba(15,23,42,0.25)';
            ctx.beginPath();
            ctx.ellipse(cx, chuteBot - chuteH + 4, 7, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // 穹頂高光（左上）
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, chuteBot, chuteW / 2, chuteH, 0, Math.PI, 0);
            ctx.clip();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.beginPath();
            ctx.ellipse(cx - chuteW * 0.15, chuteBot - chuteH * 0.55, chuteW * 0.28, chuteH * 0.45, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // --- 跳傘員身體 ---
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        let bodyAngle = parachuteOpen ? -Math.PI * 0.35 : 0;

        ctx.save();
        ctx.translate(skyX, skyY);
        ctx.rotate(bodyAngle);

        // 身體（填充深色連身衣）
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 頭盔
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(22, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 面罩反光
        ctx.fillStyle = 'rgba(165,215,250,0.45)';
        ctx.beginPath();
        ctx.arc(25, -2, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // 雙臂
        let armUp = parachuteOpen ? -20 : -16;
        let armDn = parachuteOpen ? 16 : 5;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(20, armUp);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(20, armDn);
        ctx.stroke();
        // 手
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(20, armUp, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(20, armDn, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // 雙腿
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(-28, -10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(-28, 10);
        ctx.stroke();
        // 鞋
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-28, -10, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-28, 10, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // --- 標題 ---
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 20px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText("TERMINAL VELOCITY / 終端速度實驗", 15, 30);

        // --- 高度標示（右上角） ---
        ctx.fillStyle = '#facc15';
        ctx.font = '700 24px "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${altitude.toFixed(0)} m`, W - 15, 30);

        // --- 高度標尺（漸層色條 + 光暈標記） ---
        let barX = W - 25;
        let barTop = 60;
        let barH = H - 100;
        let barGrad = ctx.createLinearGradient(0, barTop, 0, barTop + barH);
        barGrad.addColorStop(0, 'rgba(30,58,138,0.5)');
        barGrad.addColorStop(0.5, 'rgba(200,220,255,0.3)');
        barGrad.addColorStop(1, 'rgba(30,58,138,0.5)');
        ctx.strokeStyle = barGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(barX, barTop);
        ctx.lineTo(barX, barTop + barH);
        ctx.stroke();

        let altMarkerY = barTop + (1 - altitude / 4000) * barH;
        ctx.save();
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(barX, altMarkerY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 高度刻度
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '500 16px "Inter", sans-serif';
        ctx.textAlign = 'right';
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        for (let alt = 0; alt <= 4000; alt += 1000) {
            let y = barTop + (1 - alt / 4000) * barH;
            ctx.fillText(`${alt}m`, barX - 10, y + 3);
            ctx.beginPath();
            ctx.moveTo(barX - 4, y);
            ctx.lineTo(barX, y);
            ctx.stroke();
        }
    }

    // ===== 力標籤（帶半透明背景框） =====
    function drawForceLabel(x, y, text, color) {
        ctx.save();
        ctx.font = '700 25px "Inter", sans-serif';
        let m = ctx.measureText(text);
        let pad = 10;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(x + 10, y - 15, m.width + pad * 2, 36, 5);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 10 + pad, y + 1);
        ctx.restore();
    }

    // ===== 繪製向量箭頭（帶光暈） =====
    function drawArrow(x1, y1, x2, y2, color, thickness) {
        let angle = Math.atan2(y2 - y1, x2 - x1);
        let headLen = 16;
        // 光暈
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // 初始靜態畫面
    draw(0, 0, 0);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initTerminalVelocity();
