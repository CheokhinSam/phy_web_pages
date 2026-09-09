/**
 * 🚲🚗 參考系實驗
 * 單一場景，切換不同參考系觀察
 */
function initReferenceFrame() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    let bikeSpeed = 2.0;
    let carSpeed = 5.0;
    let personSpeed = 1.5; // 行人速度（向左）
    let reference = 'ground'; // 'ground', 'bike', 'car'
    let isStarted = false;
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
                <label><span>選擇參照物</span></label>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-top: 8px;">
                    <button id="btnGround" class="ref-btn active">🏠 地面</button>
                    <button id="btnBike" class="ref-btn">🚲 自行車</button>
                    <button id="btnCar" class="ref-btn">🚗 汽車</button>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>🚲 自行車速度</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="bikeVal" style="color: #2563eb;">2.0</span> m/s
                    </span>
                </label>
                <input type="range" id="bikeSlider" min="0.5" max="5" step="0.5" value="2.0">
            </div>
            <div class="control-box">
                <label>
                    <span>🚗 汽車速度</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="carVal" style="color: #ef4444;">5.0</span> m/s
                    </span>
                </label>
                <input type="range" id="carSlider" min="1" max="10" step="0.5" value="5.0">
            </div>
            <div class="control-box">
                <label>
                    <span>🚶 行人速度</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="personVal" style="color: #22c55e;">1.5</span> m/s
                    </span>
                </label>
                <input type="range" id="personSlider" min="0.5" max="4" step="0.5" value="1.5">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 10px; background: #2563eb; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .ref-btn { padding: 8px 4px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.75rem; font-family: monospace; }
            .ref-btn.active { background: #000; color: #fff; border: none; }
            .ref-btn:hover { opacity: 0.85; }
        `;
        document.head.appendChild(style);

        document.getElementById('btnGround').addEventListener('click', () => { reference = 'ground'; updateRefButtons(); });
        document.getElementById('btnBike').addEventListener('click', () => { reference = 'bike'; updateRefButtons(); });
        document.getElementById('btnCar').addEventListener('click', () => { reference = 'car'; updateRefButtons(); });

        function updateRefButtons() {
            document.getElementById('btnGround').classList.toggle('active', reference === 'ground');
            document.getElementById('btnBike').classList.toggle('active', reference === 'bike');
            document.getElementById('btnCar').classList.toggle('active', reference === 'car');
        }

        const bikeSlider = document.getElementById('bikeSlider');
        const carSlider = document.getElementById('carSlider');
        const personSlider = document.getElementById('personSlider');

        function updateParams() {
            bikeSpeed = parseFloat(bikeSlider.value);
            carSpeed = parseFloat(carSlider.value);
            personSpeed = parseFloat(personSlider.value);
            document.getElementById('bikeVal').textContent = bikeSpeed.toFixed(1);
            document.getElementById('carVal').textContent = carSpeed.toFixed(1);
            document.getElementById('personVal').textContent = personSpeed.toFixed(1);
        }

        bikeSlider.addEventListener('input', updateParams);
        carSlider.addEventListener('input', updateParams);
        personSlider.addEventListener('input', updateParams);

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
            bikeSpeed = 2.0;
            carSpeed = 5.0;
            personSpeed = 1.5;
            reference = 'ground';
            isStarted = false;
            isPaused = false;
            simTime = 0;
            bikeSlider.value = 2.0;
            carSlider.value = 5.0;
            personSlider.value = 1.5;
            updateParams();
            updateRefButtons();
            document.getElementById('startBtn').style.display = 'block';
            document.getElementById('pauseBtn').style.display = 'none';
        });

        updateParams();
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    let cardBikeV, cardCarV, cardPersonV, cardConclusion;
    if (dataGrid) {
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">自行車速度</span>
                <div class="card-num-wrapper">
                    <span id="cardBikeV" class="card-num">2.0</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">汽車速度</span>
                <div class="card-num-wrapper">
                    <span id="cardCarV" class="card-num">5.0</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">行人速度</span>
                <div class="card-num-wrapper">
                    <span id="cardPersonV" class="card-num">1.5</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card" style="grid-column: span 2;">
                <span class="card-label">觀察結論</span>
                <div style="font-size: 0.9rem; margin-top: 4px; color: #fbbf24;">
                    <span id="cardConclusion">以地面為參照，自行車和汽車向右，行人向左</span>
                </div>
            </div>
        `;
        cardBikeV = document.getElementById('cardBikeV');
        cardCarV = document.getElementById('cardCarV');
        cardPersonV = document.getElementById('cardPersonV');
        cardConclusion = document.getElementById('cardConclusion');
    }

    // ==========================================================================
    // D. 渲染
    // ==========================================================================
    const SCALE = 40;

    function drawSim() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;

        // 天空
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
        skyGrad.addColorStop(0, '#87ceeb');
        skyGrad.addColorStop(1, '#b0e0e6');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H * 0.6);

        // 草地
        ctx.fillStyle = '#86efac';
        ctx.fillRect(0, H * 0.55, W, H * 0.45);

        // 馬路
        const roadY = H * 0.6;
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(0, roadY, W, 60);

        // 車道線
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.setLineDash([20, 15]);
        const lineOffset = getBackgroundOffset();
        ctx.beginPath();
        ctx.moveTo(lineOffset % 35, roadY + 30);
        ctx.lineTo(W + 35, roadY + 30);
        ctx.stroke();
        ctx.setLineDash([]);

        // 樹木
        drawTrees(W, roadY, lineOffset);

        // 物體
        const bikeX = getBikeX(W);
        const carX = getCarX(W);
        const personX = getPersonX(W);

        // 只在螢幕內繪製
        if (bikeX > -50 && bikeX < W + 50) {
            drawBike(bikeX, roadY + 20);
        }
        if (carX > -50 && carX < W + 50) {
            drawCar(carX, roadY + 10);
        }
        if (personX > -20 && personX < W + 20) {
            drawPerson(personX, roadY + 75);
        }

        // 速度箭頭（各自獨立顯示）
        drawVelocityArrows(bikeX, carX, personX, roadY + 70);

        // 參照物標記
        drawReferenceMarker(W, H);

        // 底部標題
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, H - 45, W, 45);
        ctx.font = '700 16px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('同一事件，不同參考系 = 不同描述', W / 2, H - 18);

        updateDataCards();
    }

    function getBackgroundOffset() {
        if (reference === 'ground') return 0;
        if (reference === 'bike') return -bikeSpeed * simTime * SCALE;
        return -carSpeed * simTime * SCALE;
    }

    function getBikeX(W) {
        if (reference === 'bike') return W * 0.5;
        if (reference === 'ground') return W * 0.2 + bikeSpeed * simTime * SCALE;
        return W * 0.5 + (bikeSpeed - carSpeed) * simTime * SCALE;
    }

    function getCarX(W) {
        if (reference === 'car') return W * 0.5;
        if (reference === 'ground') return W * 0.15 + carSpeed * simTime * SCALE;
        return W * 0.5 + (carSpeed - bikeSpeed) * simTime * SCALE;
    }

    function getPersonX(W) {
        // 行人向左走（負方向）
        if (reference === 'ground') return W * 0.8 - personSpeed * simTime * SCALE;
        if (reference === 'bike') return W * 0.8 - (personSpeed + bikeSpeed) * simTime * SCALE;
        return W * 0.8 - (personSpeed + carSpeed) * simTime * SCALE;
    }

    function drawTrees(W, roadY, offset) {
        const spacing = 150;
        const numTrees = Math.ceil(W / spacing) + 3;
        const startX = (offset % spacing) - spacing;

        for (let i = 0; i < numTrees; i++) {
            const x = startX + i * spacing;
            if (x > -50 && x < W + 50) {
                // 樹幹
                ctx.fillStyle = '#713f12';
                ctx.fillRect(x - 4, roadY - 50, 8, 50);

                // 樹冠
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.arc(x, roadY - 65, 28, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawBike(x, y) {
        // 避開邊界
        const drawX = Math.max(30, Math.min(x, canvas.cssWidth - 30));

        // 車輪
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(drawX - 18, y + 8, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(drawX + 18, y + 8, 12, 0, Math.PI * 2);
        ctx.stroke();

        // 車架
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(drawX - 18, y + 8);
        ctx.lineTo(drawX, y - 10);
        ctx.lineTo(drawX + 18, y + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(drawX, y - 10);
        ctx.lineTo(drawX + 12, y - 10);
        ctx.stroke();

        // 車把
        ctx.beginPath();
        ctx.moveTo(drawX + 10, y - 15);
        ctx.lineTo(drawX + 14, y - 5);
        ctx.stroke();

        // 人
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(drawX, y - 22, 6, 0, Math.PI * 2);
        ctx.fill();

    }

    function drawCar(x, y) {
        const drawX = Math.max(40, Math.min(x, canvas.cssWidth - 40));

        // 車身
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(drawX - 35, y - 12, 70, 30, 6);
        ctx.fill();

        // 車頂
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(drawX - 20, y - 28, 40, 20, 4);
        ctx.fill();

        // 車窗
        ctx.fillStyle = '#bfdbfe';
        ctx.fillRect(drawX - 16, y - 26, 14, 14);
        ctx.fillRect(drawX + 2, y - 26, 14, 14);

        // 車輪
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(drawX - 20, y + 18, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(drawX + 20, y + 18, 8, 0, Math.PI * 2);
        ctx.fill();

    }

    function drawPerson(x, y) {
        const drawX = Math.max(15, Math.min(x, canvas.cssWidth - 15));

        // 頭
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(drawX, y - 20, 7, 0, Math.PI * 2);
        ctx.fill();

        // 身體
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(drawX, y - 13);
        ctx.lineTo(drawX, y + 5);
        ctx.stroke();

        // 腿
        ctx.beginPath();
        ctx.moveTo(drawX, y + 5);
        ctx.lineTo(drawX - 8, y + 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(drawX, y + 5);
        ctx.lineTo(drawX + 8, y + 18);
        ctx.stroke();

        // 手
        ctx.beginPath();
        ctx.moveTo(drawX, y - 5);
        ctx.lineTo(drawX - 10, y + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(drawX, y - 5);
        ctx.lineTo(drawX + 10, y + 2);
        ctx.stroke();
    }

    function drawVelocityArrows(bikeX, carX, personX, arrowY) {
        // 自行車速度箭頭（跟隨自行車）
        if (bikeX > -50 && bikeX < canvas.cssWidth + 50) {
            const bikeV = getRelativeSpeed('bike');
            const bikeDrawX = Math.max(30, Math.min(bikeX, canvas.cssWidth - 30));
            if (Math.abs(bikeV) > 0.1) {
                const arrowLen = bikeV * 12;
                drawArrow(bikeDrawX, arrowY, bikeDrawX + arrowLen, arrowY, '#3b82f6', `v=${bikeV.toFixed(1)}`);
            } else {
                ctx.font = '700 13px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#3b82f6';
                ctx.fillText('v=0', bikeDrawX, arrowY - 5);
            }
        }

        // 汽車速度箭頭（跟隨汽車）
        if (carX > -50 && carX < canvas.cssWidth + 50) {
            const carV = getRelativeSpeed('car');
            const carDrawX = Math.max(40, Math.min(carX, canvas.cssWidth - 40));
            if (Math.abs(carV) > 0.1) {
                const arrowLen = carV * 12;
                drawArrow(carDrawX, arrowY, carDrawX + arrowLen, arrowY, '#ef4444', `v=${carV.toFixed(1)}`);
            } else {
                ctx.font = '700 13px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#ef4444';
                ctx.fillText('v=0', carDrawX, arrowY - 5);
            }
        }

        // 行人速度箭頭（跟隨行人）
        if (personX > -20 && personX < canvas.cssWidth + 20) {
            const personV = getRelativeSpeed('person');
            const personDrawX = Math.max(15, Math.min(personX, canvas.cssWidth - 15));
            if (Math.abs(personV) > 0.1) {
                const arrowLen = personV * 12;
                drawArrow(personDrawX, arrowY + 25, personDrawX + arrowLen, arrowY + 25, '#22c55e', `v=${Math.abs(personV).toFixed(1)}`);
            } else {
                ctx.font = '700 13px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#22c55e';
                ctx.fillText('v=0', personDrawX, arrowY + 20);
            }
        }
    }

    function getRelativeSpeed(obj) {
        if (reference === 'ground') {
            if (obj === 'bike') return bikeSpeed;
            if (obj === 'car') return carSpeed;
            if (obj === 'person') return -personSpeed; // 向左
        } else if (reference === 'bike') {
            if (obj === 'bike') return 0;
            if (obj === 'car') return carSpeed - bikeSpeed;
            if (obj === 'person') return -(personSpeed + bikeSpeed); // 向左更快
        } else {
            if (obj === 'bike') return bikeSpeed - carSpeed;
            if (obj === 'car') return 0;
            if (obj === 'person') return -(personSpeed + carSpeed); // 向左更快
        }
    }

    function drawArrow(x1, y1, x2, y2, color, label) {
        const angle = Math.atan2(y2 - y1, x2 - x1);

        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 箭頭
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 12 * Math.cos(angle - 0.4), y2 - 12 * Math.sin(angle - 0.4));
        ctx.lineTo(x2 - 12 * Math.cos(angle + 0.4), y2 - 12 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();

        // 標籤
        ctx.font = '700 13px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        ctx.fillText(label, (x1 + x2) / 2, y1 - 12);
    }

    function drawReferenceMarker(W, H) {
        const refLabels = {
            ground: '以地面為參照物',
            bike: '以自行車為參照物',
            car: '以汽車為參照物'
        };

        // 標記參照物
        ctx.font = '700 14px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';

        if (reference === 'ground') {
            ctx.fillText('▼ 地面靜止', W / 2, H * 0.58);
        } else if (reference === 'bike') {
            const bikeX = getBikeX(W);
            ctx.fillText('▼ 參照物', bikeX, H * 0.48);
        } else {
            const carX = getCarX(W);
            ctx.fillText('▼ 參照物', carX, H * 0.45);
        }
    }

    function updateDataCards() {
        const bikeV = getRelativeSpeed('bike');
        const carV = getRelativeSpeed('car');
        const personV = getRelativeSpeed('person');

        if (cardBikeV) cardBikeV.innerText = bikeV.toFixed(1);
        if (cardCarV) cardCarV.innerText = carV.toFixed(1);
        if (cardPersonV) cardPersonV.innerText = Math.abs(personV).toFixed(1);

        if (cardConclusion) {
            if (reference === 'ground') {
                cardConclusion.innerText = '自行車和汽車向右，行人向左';
            } else if (reference === 'bike') {
                cardConclusion.innerText = '自行車靜止，汽車向右，行人向左更快';
            } else {
                cardConclusion.innerText = '汽車靜止，自行車和行人向左';
            }
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

        if (isStarted && !isPaused) {
            simTime += dt;
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

initReferenceFrame();
