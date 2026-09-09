/**
 * 🚶🚲🚗 參考系 2（p5.js + KaTeX 版）
 * Instance mode p5 sketch, KaTeX formula rendering
 */
function initReferenceFrameP5() {
    const origCanvas = document.getElementById('physicsCanvas');
    if (!origCanvas) return;
    const container = origCanvas.parentElement;
    origCanvas.remove();
    const ctrlPanel = document.getElementById('controlPanel');
    const guardEl = ctrlPanel || container;

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    let bikeSpeed = 2.0;
    let carSpeed = 5.0;
    let personSpeed = 1.5;
    let reference = 'ground';
    let isStarted = false;
    let isPaused = false;
    let simTime = 0;

    const SCALE = 40;

    // ==========================================================================
    // B. 控制面板（KaTeX 公式）
    // ==========================================================================
    if (ctrlPanel) {
        const formulaHTML = (typeof katex !== 'undefined')
            ? katex.renderToString('\\vec{v}_{相對} = \\vec{v}_{絕對} - \\vec{v}_{參照}', { throwOnError: false, displayMode: true })
            : '<div style="font-size:1.1rem;font-weight:700;">v<sub>相對</sub> = v<sub>絕對</sub> − v<sub>參照</sub></div>';

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
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">速度變換公式</div>
                <div>${formulaHTML}</div>
            </div>
        `;

        // 樣式
        const style = document.createElement('style');
        style.textContent = `
            .ref-btn { padding: 8px 4px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.75rem; font-family: monospace; }
            .ref-btn.active { background: #000; color: #fff; border: none; }
            .ref-btn:hover { opacity: 0.85; }
        `;
        document.head.appendChild(style);

        // 事件綁定
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
            bikeSpeed = 2.0; carSpeed = 5.0; personSpeed = 1.5;
            reference = 'ground'; isStarted = false; isPaused = false; simTime = 0;
            bikeSlider.value = 2.0; carSlider.value = 5.0; personSlider.value = 1.5;
            updateParams(); updateRefButtons();
            document.getElementById('startBtn').style.display = 'block';
            document.getElementById('pauseBtn').style.display = 'none';
        });

        updateParams();
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '自行車速度', id: 'cardBikeV', unit: 'm/s', highlight: true },
        { label: '汽車速度', id: 'cardCarV', unit: 'm/s', highlight: true },
        { label: '行人速度', id: 'cardPersonV', unit: 'm/s' },
        { label: '觀察結論', id: 'cardConclusion', unit: '' },
    ]);

    // ==========================================================================
    // D. 相對速度計算
    // ==========================================================================
    function getRelativeSpeed(obj) {
        if (reference === 'ground') {
            if (obj === 'bike') return bikeSpeed;
            if (obj === 'car') return carSpeed;
            if (obj === 'person') return -personSpeed;
        } else if (reference === 'bike') {
            if (obj === 'bike') return 0;
            if (obj === 'car') return carSpeed - bikeSpeed;
            if (obj === 'person') return -(personSpeed + bikeSpeed);
        } else {
            if (obj === 'bike') return bikeSpeed - carSpeed;
            if (obj === 'car') return 0;
            if (obj === 'person') return -(personSpeed + carSpeed);
        }
    }

    // ==========================================================================
    // E. p5.js Instance Mode Sketch
    // ==========================================================================
    const sketch = (p) => {
        p.setup = () => {
            const w = container.clientWidth || container.offsetWidth || 800;
            const h = container.clientHeight || container.offsetHeight || 500;
            const cnv = p.createCanvas(w, h);
            cnv.style('display', 'block');
            cnv.style('flex-shrink', '0');
            p.textFont('Inter');
        };

        p.windowResized = () => {
            const w = container.clientWidth || container.offsetWidth || 800;
            const h = container.clientHeight || container.offsetHeight || 500;
            if (w > 0 && h > 0) p.resizeCanvas(w, h);
        };

        p.draw = () => {
            if (!document.contains(guardEl)) return;
            const dt = p.min(p.deltaTime / 1000, 0.1);
            if (isStarted && !isPaused) simTime += dt;

            const W = p.width;
            const H = p.height;

            // 天空
            for (let y = 0; y < H * 0.6; y++) {
                const t = y / (H * 0.6);
                p.stroke(p.lerpColor(p.color(135, 206, 235), p.color(176, 224, 230), t));
                p.line(0, y, W, y);
            }

            // 草地
            p.noStroke();
            p.fill(134, 239, 172);
            p.rect(0, H * 0.55, W, H * 0.45);

            // 馬路
            const roadY = H * 0.6;
            p.fill(75, 85, 99);
            p.rect(0, roadY, W, 60);

            // 車道線
            const lineOffset = getBackgroundOffset();
            p.stroke(251, 191, 36);
            p.strokeWeight(3);
            p.drawingContext.setLineDash([20, 15]);
            p.line(lineOffset % 35, roadY + 30, W + 35, roadY + 30);
            p.drawingContext.setLineDash([]);
            p.noStroke();

            // 樹木
            drawTrees(p, W, roadY, lineOffset);

            // 物體位置
            const bikeX = getBikeX(W);
            const carX = getCarX(W);
            const personX = getPersonX(W);

            if (bikeX > -50 && bikeX < W + 50) drawBike(p, bikeX, roadY + 20);
            if (carX > -50 && carX < W + 50) drawCar(p, carX, roadY + 10);
            if (personX > -20 && personX < W + 20) drawPerson(p, personX, roadY + 75);

            // 速度箭頭
            drawVelocityArrows(p, bikeX, carX, personX, roadY + 70, W);

            // 參照物標記
            drawReferenceMarker(p, W, H);

            // 底部標題
            p.noStroke();
            p.fill(0, 0, 0, 178);
            p.rect(0, H - 45, W, 45);
            p.fill(251, 191, 36);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(15);
            p.textStyle(p.BOLD);
            p.text('同一事件，不同參考系 = 不同描述', W / 2, H - 22);

            // 更新數據卡片
            updateDataCards();
        };

        // --- 背景偏移 ---
        function getBackgroundOffset() {
            if (reference === 'ground') return 0;
            if (reference === 'bike') return -bikeSpeed * simTime * SCALE;
            return -carSpeed * simTime * SCALE;
        }

        // --- 位置計算 ---
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
            if (reference === 'ground') return W * 0.8 - personSpeed * simTime * SCALE;
            if (reference === 'bike') return W * 0.8 - (personSpeed + bikeSpeed) * simTime * SCALE;
            return W * 0.8 - (personSpeed + carSpeed) * simTime * SCALE;
        }

        // --- 樹木 ---
        function drawTrees(p, W, roadY, offset) {
            const spacing = 150;
            const num = Math.ceil(W / spacing) + 3;
            const startX = (offset % spacing) - spacing;
            for (let i = 0; i < num; i++) {
                const x = startX + i * spacing;
                if (x > -50 && x < W + 50) {
                    p.fill(113, 63, 18);
                    p.noStroke();
                    p.rect(x - 4, roadY - 50, 8, 50);
                    p.fill(34, 197, 94);
                    p.circle(x, roadY - 65, 56);
                }
            }
        }

        // --- 自行車 ---
        function drawBike(p, x, y) {
            const dx = p.constrain(x, 30, p.width - 30);
            p.strokeWeight(2.5);
            p.stroke(30, 41, 59);
            p.noFill();
            p.circle(dx - 18, y + 8, 24);
            p.circle(dx + 18, y + 8, 24);

            p.stroke(59, 130, 246);
            p.strokeWeight(3);
            p.line(dx - 18, y + 8, dx, y - 10);
            p.line(dx, y - 10, dx + 18, y + 8);
            p.line(dx, y - 10, dx + 12, y - 10);
            p.line(dx + 10, y - 15, dx + 14, y - 5);

            p.noStroke();
            p.fill(30, 41, 59);
            p.circle(dx, y - 22, 12);
        }

        // --- 汽車 ---
        function drawCar(p, x, y) {
            const dx = p.constrain(x, 40, p.width - 40);
            p.noStroke();
            p.fill(239, 68, 68);
            p.rect(dx - 35, y - 12, 70, 30, 6);
            p.fill(220, 38, 38);
            p.rect(dx - 20, y - 28, 40, 20, 4);
            p.fill(191, 219, 254);
            p.rect(dx - 16, y - 26, 14, 14);
            p.rect(dx + 2, y - 26, 14, 14);
            p.fill(30, 41, 59);
            p.circle(dx - 20, y + 18, 16);
            p.circle(dx + 20, y + 18, 16);
        }

        // --- 行人 ---
        function drawPerson(p, x, y) {
            const dx = p.constrain(x, 15, p.width - 15);
            p.fill(30, 41, 59);
            p.noStroke();
            p.circle(dx, y - 20, 14);

            p.stroke(30, 41, 59);
            p.strokeWeight(3);
            p.line(dx, y - 13, dx, y + 5);
            p.line(dx, y + 5, dx - 8, y + 18);
            p.line(dx, y + 5, dx + 8, y + 18);
            p.line(dx, y - 5, dx - 10, y + 2);
            p.line(dx, y - 5, dx + 10, y + 2);
        }

        // --- 速度箭頭 ---
        function drawVelocityArrows(p, bikeX, carX, personX, arrowY, W) {
            // 自行車
            if (bikeX > -50 && bikeX < W + 50) {
                const v = getRelativeSpeed('bike');
                const dx = p.constrain(bikeX, 30, W - 30);
                if (Math.abs(v) > 0.1) {
                    drawArrow(p, dx, arrowY, dx + v * 12, arrowY, [59, 130, 246], `v=${v.toFixed(1)}`);
                } else {
                    p.noStroke(); p.fill(59, 130, 246);
                    p.textAlign(p.CENTER); p.textSize(13); p.textStyle(p.BOLD);
                    p.text('v=0', dx, arrowY - 8);
                }
            }
            // 汽車
            if (carX > -50 && carX < W + 50) {
                const v = getRelativeSpeed('car');
                const dx = p.constrain(carX, 40, W - 40);
                if (Math.abs(v) > 0.1) {
                    drawArrow(p, dx, arrowY, dx + v * 12, arrowY, [239, 68, 68], `v=${v.toFixed(1)}`);
                } else {
                    p.noStroke(); p.fill(239, 68, 68);
                    p.textAlign(p.CENTER); p.textSize(13); p.textStyle(p.BOLD);
                    p.text('v=0', dx, arrowY - 8);
                }
            }
            // 行人
            if (personX > -20 && personX < W + 20) {
                const v = getRelativeSpeed('person');
                const dx = p.constrain(personX, 15, W - 15);
                if (Math.abs(v) > 0.1) {
                    drawArrow(p, dx, arrowY + 25, dx + v * 12, arrowY + 25, [34, 197, 94], `v=${Math.abs(v).toFixed(1)}`);
                } else {
                    p.noStroke(); p.fill(34, 197, 94);
                    p.textAlign(p.CENTER); p.textSize(13); p.textStyle(p.BOLD);
                    p.text('v=0', dx, arrowY + 18);
                }
            }
        }

        function drawArrow(p, x1, y1, x2, y2, col, label) {
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = p.constrain(Math.abs(x2 - x1) * 0.3, 8, 14);

            // 箭身（停在箭頭底部）
            p.stroke(col);
            p.strokeWeight(4);
            p.line(x1, y1, x2 - headLen * Math.cos(angle), y2 - headLen * Math.sin(angle));

            // 三角形箭頭
            p.noStroke();
            p.fill(col);
            p.triangle(
                x2, y2,
                x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6),
                x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6)
            );

            // 標籤
            p.fill(col);
            p.textAlign(p.CENTER);
            p.textSize(13);
            p.textStyle(p.BOLD);
            p.noStroke();
            p.text(label, (x1 + x2) / 2, y1 - 14);
        }

        // --- 參照物標記 ---
        function drawReferenceMarker(p, W, H) {
            p.fill(251, 191, 36);
            p.noStroke();
            p.textAlign(p.CENTER);
            p.textSize(14);
            p.textStyle(p.BOLD);

            if (reference === 'ground') {
                p.text('▼ 地面靜止', W / 2, H * 0.58);
            } else if (reference === 'bike') {
                p.text('▼ 參照物', getBikeX(W), H * 0.48);
            } else {
                p.text('▼ 參照物', getCarX(W), H * 0.45);
            }
        }

        // --- 更新數據卡片 ---
        function updateDataCards() {
            const bv = getRelativeSpeed('bike');
            const cv = getRelativeSpeed('car');
            const pv = getRelativeSpeed('person');

            updateCards({
                cardBikeV: bv.toFixed(1),
                cardCarV: cv.toFixed(1),
                cardPersonV: Math.abs(pv).toFixed(1),
                cardConclusion: reference === 'ground'
                    ? '自行車和汽車向右，行人向左'
                    : reference === 'bike'
                        ? '自行車靜止，汽車向右，行人向左更快'
                        : '汽車靜止，自行車和行人向左',
            });
        }
    };

    // ==========================================================================
    // F. 啟動 p5（延遲確保 DOM 佈局完成）
    // ==========================================================================
    setTimeout(() => {
        new p5(sketch, container);
    }, 100);
}

initReferenceFrameP5();
