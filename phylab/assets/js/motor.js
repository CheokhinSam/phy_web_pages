/**
 * ⚙️ 直流電動機模擬 — 截面圖
 * 兩個圓圈表示線圈截面：×=電流入，•=電流出
 */
function initMotor() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ===== 參數 =====
    let voltage = 6;
    let magneticField = 1.0;
    let numTurns = 10;
    let resistance = 2.0;
    let isOn = false;

    // 物理狀態
    let angle = 0.5;
    let angularVel = 0;
    let current = 0;
    let lastTimestamp = 0;
    let animationFrameId;

    // ============================================================
    // A. 控制面板
    // ============================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>電壓 <i>V</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="voltVal" style="color: #2563eb;">6.0</span> V
                    </span>
                </label>
                <input type="range" id="voltSlider" min="1" max="12" step="0.5" value="6">
            </div>
            <div class="control-box">
                <label>
                    <span>磁場強度 <i>B</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="bVal" style="color: #2563eb;">1.00</span> T
                    </span>
                </label>
                <input type="range" id="bSlider" min="0.1" max="2.0" step="0.05" value="1.0">
            </div>
            <div class="control-box">
                <label>
                    <span>線圈匝數 <i>N</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="nVal" style="color: #2563eb;">10</span> 匝
                    </span>
                </label>
                <input type="range" id="nSlider" min="1" max="50" step="1" value="10">
            </div>
            <div class="control-box">
                <label>
                    <span>電阻 <i>R</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="rVal" style="color: #2563eb;">2.0</span> Ω
                    </span>
                </label>
                <input type="range" id="rSlider" min="0.5" max="10" step="0.1" value="2.0">
            </div>
            <div class="control-box" style="margin-top: 8px;">
                <button id="onOffBtn" style="width: 100%; padding: 14px; background: #16a34a; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 1rem; letter-spacing: 1px;">ON / 開啟</button>
            </div>
            <div class="control-box">
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.85rem;">重設 / RESET</button>
            </div>
            <div class="control-box" style="margin-top: auto; border-top: 2px solid #000; padding-top: 12px; background: #fff;">
                <label style="margin-bottom: 4px; color: #64748b; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">AMPERE FORCE / 安培力</label>
                <div style="font-size: 1rem; font-weight: 900; font-family: Cambria, serif; color: #000; margin-bottom: 4px;">$$F = N \\cdot B \\cdot I \\cdot L$$</div>
                <label style="font-size: 0.8rem; color: #1e293b; display: block;">× = 電流入紙面 &nbsp; • = 電流出紙面</label>
            </div>
        `;

        if (window.MathJax && window.MathJax.typeset) window.MathJax.typeset([ctrlPanel]);

        document.getElementById('voltSlider').addEventListener('input', function() {
            voltage = parseFloat(this.value);
            document.getElementById('voltVal').innerText = voltage.toFixed(1);
        });
        document.getElementById('bSlider').addEventListener('input', function() {
            magneticField = parseFloat(this.value);
            document.getElementById('bVal').innerText = magneticField.toFixed(2);
        });
        document.getElementById('nSlider').addEventListener('input', function() {
            numTurns = parseInt(this.value);
            document.getElementById('nVal').innerText = numTurns;
        });
        document.getElementById('rSlider').addEventListener('input', function() {
            resistance = parseFloat(this.value);
            document.getElementById('rVal').innerText = resistance.toFixed(1);
        });

        document.getElementById('onOffBtn').addEventListener('click', function() {
            isOn = !isOn;
            this.innerText = isOn ? 'OFF / 關閉' : 'ON / 開啟';
            this.style.backgroundColor = isOn ? '#ef4444' : '#16a34a';
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            isOn = false;
            angle = 0.5;
            angularVel = 0;
            let btn = document.getElementById('onOffBtn');
            btn.innerText = 'ON / 開啟';
            btn.style.backgroundColor = '#16a34a';
        });
    }

    // ============================================================
    // B. Canvas
    // ============================================================
    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ============================================================
    // C. 數據卡片
    // ============================================================
    const dataGrid = document.getElementById('dataCardsGrid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(130px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card">
                <span class="card-label">電流 I</span>
                <div class="card-num-wrapper"><span id="cardI" class="card-num">0.0</span><span class="card-unit">A</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">力矩 τ</span>
                <div class="card-num-wrapper"><span id="cardTorque" class="card-num">0.0</span><span class="card-unit">N·m</span></div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">轉速 RPM</span>
                <div class="card-num-wrapper"><span id="cardRPM" class="card-num">0</span><span class="card-unit">rpm</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">功率 P</span>
                <div class="card-num-wrapper"><span id="cardPower" class="card-num">0.0</span><span class="card-unit">W</span></div>
            </div>
        `;
    }

    function updateCards() {
        const el = (id) => document.getElementById(id);
        let rpm = Math.round(angularVel * 60 / (2 * Math.PI));
        if (el('cardI')) el('cardI').innerText = current.toFixed(2);
        let torque = numTurns * magneticField * current * 0.1 * 0.05;
        if (el('cardTorque')) el('cardTorque').innerText = torque.toFixed(3);
        if (el('cardRPM')) el('cardRPM').innerText = rpm;
        if (el('cardPower')) el('cardPower').innerText = (torque * angularVel).toFixed(2);
    }

    // ============================================================
    // D. 物理引擎
    // ============================================================
    function update(dt) {
        if (!isOn) {
            angularVel *= (1 - 3 * dt);
            if (Math.abs(angularVel) < 0.05) angularVel = 0;
            angle += angularVel * dt;
            current = 0;
            return;
        }

        current = voltage / resistance;
        let torque = numTurns * magneticField * current * 0.1 * 0.05;
        let effectiveTorque = torque * Math.abs(Math.sin(angle));

        angularVel += effectiveTorque / 0.05 * dt;
        angularVel *= (1 - 0.8 * dt);
        if (angularVel > 30) angularVel = 30;
        angle += angularVel * dt;
    }

    // ============================================================
    // E. 繪圖 — 截面圖
    // ============================================================
    function drawCross(x, y, r, type) {
        // type: 'cross' = ×（入紙面）, 'dot' = •（出紙面）
        // 外圈
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (type === 'cross') {
            // × 符號
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2.5;
            let d = r * 0.6;
            ctx.beginPath();
            ctx.moveTo(x - d, y - d);
            ctx.lineTo(x + d, y + d);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + d, y - d);
            ctx.lineTo(x - d, y + d);
            ctx.stroke();
        } else {
            // • 符號
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawArrow(fromX, fromY, toX, toY, color) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        let dx = toX - fromX;
        let dy = toY - fromY;
        let len = Math.sqrt(dx * dx + dy * dy);
        if (len < 5) return;
        let ux = dx / len, uy = dy / len;

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - ux * 10 + uy * 5, toY - uy * 10 - ux * 5);
        ctx.lineTo(toX - ux * 10 - uy * 5, toY - uy * 10 + ux * 5);
        ctx.closePath();
        ctx.fill();
    }

    function draw() {
        PhysicsUtils.beginFrame(ctx, canvas);

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.cssWidth, canvas.cssHeight);

        let cx = canvas.cssWidth * 0.5;
        let cy = canvas.cssHeight * 0.45;
        let scale = Math.min(canvas.cssWidth / 600, canvas.cssHeight / 450);

        // 磁鐵
        let magW = 55 * scale;
        let magH = 160 * scale;
        let gap = 130 * scale;

        // N 極（左）
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cx - gap / 2 - magW, cy - magH / 2, magW, magH);
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - gap / 2 - magW, cy - magH / 2, magW, magH);
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${20 * scale}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', cx - gap / 2 - magW / 2, cy);

        // S 極（右）
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(cx + gap / 2, cy - magH / 2, magW, magH);
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx + gap / 2, cy - magH / 2, magW, magH);
        ctx.fillStyle = '#fff';
        ctx.fillText('S', cx + gap / 2 + magW / 2, cy);
        ctx.textBaseline = 'alphabetic';

        // 磁場線
        ctx.strokeStyle = 'rgba(100,116,139,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        for (let i = -3; i <= 3; i++) {
            let y = cy + i * 18 * scale;
            ctx.beginPath();
            ctx.moveTo(cx - gap / 2, y);
            ctx.lineTo(cx + gap / 2, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.fillStyle = '#94a3b8';
        ctx.font = `600 ${11 * scale}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('B →', cx, cy - magH / 2 - 12);

        // ============================================================
        // 線圈截面：兩個圓圈，繞中心旋轉
        // ============================================================
        let coilR = 50 * scale;   // 旋轉半徑
        let wireR = 12 * scale;   // 截面圓半徑

        // 兩個截面的位置（旋轉）
        let x1 = cx + coilR * Math.cos(angle);   // 左/右交替
        let y1 = cy + coilR * Math.sin(angle);   // 上/下交替
        let x2 = cx - coilR * Math.cos(angle);   // 對稱
        let y2 = cy - coilR * Math.sin(angle);

        // 旋轉中心
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        // 連接線（旋轉軸的概念）
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 判斷哪邊是 ×（入），哪邊是 •（出）
        // 電流方向取決於旋轉角度（換向器效果）
        // 假設左半周：左邊×右邊•，右半周：左邊•右邊×
        let sinA = Math.sin(angle);
        let isLeftCross = sinA >= 0;  // 簡化：用 sin 判斷換向

        // 畫兩個截面
        drawCross(x1, y1, wireR, isLeftCross ? 'cross' : 'dot');
        drawCross(x2, y2, wireR, isLeftCross ? 'dot' : 'cross');

        // 截面標籤
        ctx.font = `600 ${9 * scale}px "Inter", sans-serif`;
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText(isLeftCross ? '× 入' : '• 出', x1, y1 + wireR + 14);
        ctx.fillText(isLeftCross ? '• 出' : '× 入', x2, y2 + wireR + 14);

        // ============================================================
        // 力的箭頭（F = I × B）
        // ============================================================
        if (isOn && current > 0.01) {
            let forceMag = numTurns * magneticField * current * 0.1 * 0.05;
            let arrowLen = Math.min(forceMag * 100 * scale, 40 * scale);

            // 左邊截面的力（× 時向下，• 時向上）
            let f1dir = isLeftCross ? 1 : -1;  // × 受力向下
            let f1endY = y1 + f1dir * arrowLen;
            drawArrow(x1, y1, x1, f1endY, '#ef4444');
            ctx.font = `700 ${12 * scale}px "Inter", monospace`;
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'center';
            ctx.fillText('F', x1 + 18, (y1 + f1endY) / 2 + 4);

            // 右邊截面的力（方向相反）
            let f2dir = -f1dir;
            let f2endY = y2 + f2dir * arrowLen;
            drawArrow(x2, y2, x2, f2endY, '#ef4444');
            ctx.fillText('F', x2 - 18, (y2 + f2endY) / 2 + 4);
        }

        // 標題
        ctx.font = '900 16px "Inter", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText('DC MOTOR / 直流電動機', 20, 30);

        // 轉速
        let rpm = Math.round(angularVel * 60 / (2 * Math.PI));
        ctx.font = '800 28px "Inter", monospace';
        ctx.fillStyle = isOn ? '#16a34a' : '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(rpm + ' RPM', canvas.cssWidth - 20, 40);

        // 圖例
        ctx.font = `600 ${10 * scale}px "Inter", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#000';
        ctx.fillText('× = 電流入紙面', 20, canvas.cssHeight - 30);
        ctx.fillText('• = 電流出紙面', 20, canvas.cssHeight - 15);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('F = 力（安培力）', 180, canvas.cssHeight - 15);
    }

    // ============================================================
    // F. 動畫迴圈
    // ============================================================
    function loop(currentTimestamp) {
        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.05) dt = 0.05;

        update(dt);
        updateCards();
        draw();

        animationFrameId = requestAnimationFrame(loop);
    }

    const guardEl = document.getElementById('voltSlider') || canvas;

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);

    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(loop);
}

initMotor();
