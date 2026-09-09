/**
 * 💥 兩球碰撞與動量守恆
 * 無摩擦水平面上的兩球碰撞模擬
 */
function initCollision() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ===== 參數 =====
    let m1 = 2, m2 = 2;
    let v1 = 3, v2 = -2;
    let restitution = 1.0;   // 恢復係數
    let collisionType = 'elastic';

    // 物理狀態
    let ball1 = { x: 0, v: 0 };
    let ball2 = { x: 0, v: 0 };
    let hasCollided = false;   // 是否發生過碰撞（用於數據顯示）
    let ballsTouching = false; // 兩球目前是否接觸中
    let wallHitDetected = false; // 是否撞過牆
    let ball1PostV = 0;  // 碰撞後球1速度（用於守恆比較）
    let ball2PostV = 0;  // 碰撞後球2速度（用於守恆比較）
    let isPaused = true;
    let simTime = 0;
    let lastTimestamp = 0;
    let animationFrameId;

    // 畫面參數
    const TRACK_Y_RATIO = 0.45;
    const BALL_BASE_R = 20;
    const PX_PER_M = 80;  // 1 公尺 = 80 像素

    // ============================================================
    // A. 控制面板
    // ============================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>球1 質量 <i>m</i>₁</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="m1Val" style="color: #ef4444;">2.0</span> kg
                    </span>
                </label>
                <input type="range" id="m1Slider" min="0.5" max="10" step="0.1" value="2">
            </div>
            <div class="control-box">
                <label>
                    <span>球1 初速 <i>v</i>₁</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="v1Val" style="color: #ef4444;">+3.0</span> m/s
                    </span>
                </label>
                <input type="range" id="v1Slider" min="-5" max="5" step="0.1" value="3">
            </div>
            <div class="control-box">
                <label>
                    <span>球2 質量 <i>m</i>₂</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="m2Val" style="color: #3b82f6;">2.0</span> kg
                    </span>
                </label>
                <input type="range" id="m2Slider" min="0.5" max="10" step="0.1" value="2">
            </div>
            <div class="control-box">
                <label>
                    <span>球2 初速 <i>v</i>₂</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="v2Val" style="color: #3b82f6;">-2.0</span> m/s
                    </span>
                </label>
                <input type="range" id="v2Slider" min="-5" max="5" step="0.1" value="-2">
            </div>
            <div class="control-box">
                <label><span>碰撞類型</span></label>
                <select id="typeSelect" style="width:100%; padding:8px; font-weight:700; font-size:0.95rem; border:2px solid #000; background:#fff; cursor:pointer;">
                    <option value="elastic">完全彈性 (e=1.0)</option>
                    <option value="partial">部分彈性 (e=0.5)</option>
                    <option value="inelastic">完全非彈性 (e=0)</option>
                    <option value="custom">自訂 e</option>
                </select>
            </div>
            <div class="control-box" id="customEBox" style="display:none;">
                <label>
                    <span>恢復係數 <i>e</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="eVal" style="color: #2563eb;">1.00</span>
                    </span>
                </label>
                <input type="range" id="eSlider" min="0" max="1" step="0.01" value="1">
            </div>
            <div class="control-box" style="margin-top: 8px;">
                <button id="startBtn" style="width: 100%; padding: 12px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.95rem; letter-spacing: 1px;">開始碰撞 / COLLIDE</button>
            </div>
            <div class="control-box" style="display: flex; gap: 8px;">
                <button id="pauseBtn" style="flex:1; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.85rem;" disabled>暫停 / PAUSE</button>
                <button id="resetBtn" style="flex:1; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.85rem;">重設 / RESET</button>
            </div>
            <div class="control-box" style="margin-top: auto; border-top: 2px solid #000; padding-top: 12px; background: #fff;">
                <label style="margin-bottom: 4px; color: #64748b; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">MOMENTUM / 動量守恆</label>
                <div style="font-size: 0.95rem; font-weight: 900; font-family: Cambria, serif; color: #000; margin-bottom: 4px;">$$m_1 v_1 + m_2 v_2 = m_1 v_1' + m_2 v_2'$$</div>
            </div>
        `;

        if (window.MathJax && window.MathJax.typeset) window.MathJax.typeset([ctrlPanel]);

        const m1Slider = document.getElementById('m1Slider');
        const v1Slider = document.getElementById('v1Slider');
        const m2Slider = document.getElementById('m2Slider');
        const v2Slider = document.getElementById('v2Slider');
        const typeSelect = document.getElementById('typeSelect');
        const eSlider = document.getElementById('eSlider');
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');

        m1Slider.addEventListener('input', () => {
            m1 = parseFloat(m1Slider.value);
            document.getElementById('m1Val').innerText = m1.toFixed(1);
            if (!hasCollided) resetSim();
        });
        v1Slider.addEventListener('input', () => {
            v1 = parseFloat(v1Slider.value);
            document.getElementById('v1Val').innerText = (v1 >= 0 ? '+' : '') + v1.toFixed(1);
            if (!hasCollided) resetSim();
        });
        m2Slider.addEventListener('input', () => {
            m2 = parseFloat(m2Slider.value);
            document.getElementById('m2Val').innerText = m2.toFixed(1);
            if (!hasCollided) resetSim();
        });
        v2Slider.addEventListener('input', () => {
            v2 = parseFloat(v2Slider.value);
            document.getElementById('v2Val').innerText = (v2 >= 0 ? '+' : '') + v2.toFixed(1);
            if (!hasCollided) resetSim();
        });

        typeSelect.addEventListener('change', () => {
            collisionType = typeSelect.value;
            let customBox = document.getElementById('customEBox');
            if (collisionType === 'custom') {
                customBox.style.display = 'block';
                restitution = parseFloat(eSlider.value);
            } else {
                customBox.style.display = 'none';
                restitution = collisionType === 'elastic' ? 1.0 : collisionType === 'partial' ? 0.5 : 0;
            }
        });

        eSlider.addEventListener('input', () => {
            restitution = parseFloat(eSlider.value);
            document.getElementById('eVal').innerText = restitution.toFixed(2);
        });

        startBtn.addEventListener('click', () => {
            startSim();
        });

        pauseBtn.addEventListener('click', () => {
            if (simTime <= 0) return;
            isPaused = !isPaused;
            pauseBtn.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
            pauseBtn.style.backgroundColor = isPaused ? "#2563eb" : "#ffffff";
            pauseBtn.style.color = isPaused ? "#ffffff" : "#000000";
            if (!isPaused) {
                lastTimestamp = performance.now();
                animationFrameId = requestAnimationFrame(loop);
            }
        });

        resetBtn.addEventListener('click', () => {
            resetSim();
        });
    }

    // ============================================================
    // B. Canvas
    // ============================================================
    const resizeCanvas = PhysicsUtils.setupResize(canvas);
    window.addEventListener('resize', () => { draw(); });

    // ============================================================
    // C. 數據卡片
    // ============================================================
    const dataGrid = document.getElementById('dataCardsGrid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(140px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card">
                <span class="card-label">碰撞前動量 P₀</span>
                <div class="card-num-wrapper"><span id="cardP0" class="card-num">2.0</span><span class="card-unit">kg·m/s</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">碰撞後動量 P'</span>
                <div class="card-num-wrapper"><span id="cardPf" class="card-num">—</span><span class="card-unit">kg·m/s</span></div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">動量守恆</span>
                <div class="card-num-wrapper"><span id="cardCheck" class="card-num">—</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">球1 速度 v₁</span>
                <div class="card-num-wrapper"><span id="cardV1" class="card-num">+3.0</span><span class="card-unit">m/s</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">球2 速度 v₂</span>
                <div class="card-num-wrapper"><span id="cardV2" class="card-num">-2.0</span><span class="card-unit">m/s</span></div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">動能 E_k</span>
                <div class="card-num-wrapper"><span id="cardEk" class="card-num">13.0</span><span class="card-unit">J</span></div>
            </div>
        `;
    }

    function updateCards() {
        const el = (id) => document.getElementById(id);
        let pBefore = m1 * v1 + m2 * v2;
        if (el('cardP0')) el('cardP0').innerText = pBefore.toFixed(1);

        let pNow = m1 * ball1.v + m2 * ball2.v;
        let ek = 0.5 * m1 * ball1.v * ball1.v + 0.5 * m2 * ball2.v * ball2.v;

        if (el('cardPf')) el('cardPf').innerText = pNow.toFixed(1);
        if (el('cardV1')) el('cardV1').innerText = (ball1.v >= 0 ? '+' : '') + ball1.v.toFixed(1);
        if (el('cardV2')) el('cardV2').innerText = (ball2.v >= 0 ? '+' : '') + ball2.v.toFixed(1);
        if (el('cardEk')) el('cardEk').innerText = ek.toFixed(1);

        // 動量守恆判斷：只看球與球之間的碰撞
        // 撞牆 = 外力介入，動量本來就不守恆
        if (el('cardCheck')) {
            if (wallHitDetected) {
                el('cardCheck').innerText = '⚠ 牆壁外力';
                el('cardCheck').style.color = '#f59e0b';
            } else if (hasCollided) {
                // 碰撞後、尚未撞牆 → 比較碰撞前後
                let pAfterCollision = m1 * ball1PostV + m2 * ball2PostV;
                let match = Math.abs(pNow - pAfterCollision) < 0.05;
                el('cardCheck').innerText = match ? '✓ 守恆' : '✗ 不守恆';
                el('cardCheck').style.color = match ? '#16a34a' : '#ef4444';
            } else {
                el('cardCheck').innerText = '—';
                el('cardCheck').style.color = '#000';
            }
        }
    }

    // ============================================================
    // D. 物理引擎
    // ============================================================
    function getBallRadius(mass) {
        return BALL_BASE_R + mass * 3;
    }

    function resetSim() {
        hasCollided = false;
        ballsTouching = false;
        wallHitDetected = false;
        isPaused = true;
        simTime = 0;
        ball1.x = canvas.cssWidth * 0.3;
        ball1.v = v1;
        ball2.x = canvas.cssWidth * 0.7;
        ball2.v = v2;
        document.getElementById('startBtn').style.display = 'block';
        let pb = document.getElementById('pauseBtn');
        pb.disabled = true;
        pb.innerText = "暫停 / PAUSE";
        pb.style.backgroundColor = "#ffffff";
        pb.style.color = "#000000";
        updateCards();
        draw();
    }

    function startSim() {
        hasCollided = false;
        ballsTouching = false;
        isPaused = false;
        simTime = 0;
        ball1.x = canvas.cssWidth * 0.3;
        ball1.v = v1;
        ball2.x = canvas.cssWidth * 0.7;
        ball2.v = v2;
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('pauseBtn').disabled = false;
        lastTimestamp = performance.now();
        animationFrameId = requestAnimationFrame(loop);
    }

    function doCollision() {
        // 動量守恆 + 恢復係數
        let v1f = ((m1 - restitution * m2) * v1 + (1 + restitution) * m2 * v2) / (m1 + m2);
        let v2f = ((m2 - restitution * m1) * v2 + (1 + restitution) * m1 * v1) / (m1 + m2);
        ball1.v = v1f;
        ball2.v = v2f;
        ball1PostV = v1f;
        ball2PostV = v2f;
        wallHitDetected = false;
        hasCollided = true;
    }

    // ============================================================
    // E. 繪圖
    // ============================================================
    function draw() {
        PhysicsUtils.beginFrame(ctx, canvas);

        let trackY = canvas.cssHeight * TRACK_Y_RATIO;

        // 背景
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.cssWidth, canvas.cssHeight);

        // 水平軌道
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, trackY);
        ctx.lineTo(canvas.cssWidth - 20, trackY);
        ctx.stroke();

        // 軌道刻度
        ctx.font = '600 9px "Inter", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 10; i++) {
            let x = 20 + (i / 10) * (canvas.cssWidth - 40);
            ctx.fillText((i * 1).toString(), x, trackY + 18);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, trackY);
            ctx.lineTo(x, trackY + 8);
            ctx.stroke();
        }
        ctx.fillText('位置 (m)', canvas.cssWidth / 2, trackY + 32);

        // 速度箭頭
        function drawVelocityArrow(x, y, v, color, label) {
            if (Math.abs(v) < 0.01) return;
            let len = Math.abs(v) * 25;
            let dir = v > 0 ? 1 : -1;
            let startX = x;
            let endX = x + dir * len;

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();

            // 箭頭
            let headLen = 8;
            ctx.beginPath();
            ctx.moveTo(endX, y);
            ctx.lineTo(endX - dir * headLen, y - 5);
            ctx.lineTo(endX - dir * headLen, y + 5);
            ctx.closePath();
            ctx.fill();

            // 標籤
            ctx.font = '700 11px "Inter", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(label + ' = ' + (v >= 0 ? '+' : '') + v.toFixed(1) + ' m/s', (startX + endX) / 2, y - 14);
        }

        // 球1
        let r1 = getBallRadius(m1);
        let r2 = getBallRadius(m2);

        // 繪製球的函數
        function drawBall(x, y, r, mainColor, darkColor, label, mass, v, arrowColor) {
            // 球體（實色）
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();

            // 邊框
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();

            // 標籤（球內）
            ctx.fillStyle = '#fff';
            ctx.font = `800 ${Math.max(10, r * 0.6)}px "Inter", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y + 1);
            ctx.textBaseline = 'alphabetic';

            // 質量標籤
            ctx.fillStyle = darkColor;
            ctx.font = '700 11px "Inter", monospace';
            ctx.fillText(mass.toFixed(1) + ' kg', x, y - r - 8);

            // 速度箭頭
            drawVelocityArrow(x, y - r - 25, v, arrowColor, label === '1' ? 'v₁' : 'v₂');
        }

        // 球1（紅色系）
        drawBall(ball1.x, trackY, r1, '#ef4444', '#991b1b', '1', m1, ball1.v, '#ef4444');

        // 球2（藍色系）
        drawBall(ball2.x, trackY, r2, '#3b82f6', '#1e40af', '2', m2, ball2.v, '#3b82f6');

        // 碰撞效果
        if (hasCollided && simTime < 0.3) {
            let intensity = 1 - simTime / 0.3;
            let cx = (ball1.x + ball2.x) / 2;
            let cy = trackY;

            // 爆炸光芒
            for (let i = 0; i < 8; i++) {
                let angle = (i / 8) * Math.PI * 2;
                let len = (r1 + r2) * 0.8 * intensity;
                ctx.strokeStyle = `rgba(255, 200, 0, ${intensity * 0.8})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
                ctx.stroke();
            }

            // 爆炸圈
            ctx.strokeStyle = `rgba(255, 100, 0, ${intensity * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, (r1 + r2) * 1.2 * (1 - intensity * 0.5), 0, Math.PI * 2);
            ctx.stroke();
        }

        // 標題
        ctx.font = '900 16px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('MOMENTUM COLLISION / 動量碰撞', 20, 30);

        // 狀態標籤
        ctx.font = '700 12px "Inter", monospace';
        ctx.textAlign = 'right';
        if (hasCollided) {
            ctx.fillStyle = '#16a34a';
            ctx.fillText('● 碰撞後', canvas.cssWidth - 20, 30);
        } else {
            ctx.fillStyle = '#f59e0b';
            ctx.fillText('● 等待碰撞', canvas.cssWidth - 20, 30);
        }

        // 碰撞類型標籤
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';
        let typeLabel = collisionType === 'elastic' ? '完全彈性 e=1.0' :
                        collisionType === 'partial' ? '部分彈性 e=' + restitution.toFixed(2) :
                        collisionType === 'inelastic' ? '完全非彈性 e=0' :
                        '自訂 e=' + restitution.toFixed(2);
        ctx.fillText(typeLabel, canvas.cssWidth - 20, 48);
    }

    // ============================================================
    // F. 動畫迴圈
    // ============================================================
    function loop(currentTimestamp) {
        if (isPaused) return;

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.05) dt = 0.05;

        simTime += dt;

        // 位置更新
        ball1.x += ball1.v * PX_PER_M * dt;
        ball2.x += ball2.v * PX_PER_M * dt;

        // 碰撞檢測（球心距離 < 半徑和）
        let r1 = getBallRadius(m1);
        let r2 = getBallRadius(m2);
        let dist = Math.abs(ball1.x - ball2.x);
        let touching = dist < r1 + r2;

        if (touching && !ballsTouching) {
            // 剛接觸 → 執行碰撞
            doCollision();
        }
        ballsTouching = touching;

        // 邊界反彈（牆壁 = 外力）
        if (ball1.x - r1 < 20) { ball1.x = 20 + r1; ball1.v = Math.abs(ball1.v); wallHitDetected = true; }
        if (ball1.x + r1 > canvas.cssWidth - 20) { ball1.x = canvas.cssWidth - 20 - r1; ball1.v = -Math.abs(ball1.v); wallHitDetected = true; }
        if (ball2.x - r2 < 20) { ball2.x = 20 + r2; ball2.v = Math.abs(ball2.v); wallHitDetected = true; }
        if (ball2.x + r2 > canvas.cssWidth - 20) { ball2.x = canvas.cssWidth - 20 - r2; ball2.v = -Math.abs(ball2.v); wallHitDetected = true; }

        updateCards();
        draw();

        animationFrameId = requestAnimationFrame(loop);
    }

    // ============================================================
    // G. 初始繪製
    // ============================================================
    const guardEl = document.getElementById('v1Slider') || canvas;

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);

    resetSim();
}

initCollision();
