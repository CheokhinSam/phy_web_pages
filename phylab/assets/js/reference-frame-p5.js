/**
 * 🚶🚲🚗 參考系 2（p5.js + KaTeX 版）
 * Instance mode p5 sketch, KaTeX formula rendering
 *
 * ⚠️ 這個檔案是新實驗的黃金範例。它示範了標準的座標系統做法：
 *    先在檔頭宣告一個固定尺寸的「邏輯世界」，所有座標與尺寸都用世界單位，
 *    繪製前才經 PhysicsUtils.fitViewWH() 換算成像素。
 *    新實驗請照這個結構寫，不要用 p.width * 0.5 這類畫布比例定位。
 */

// ==========================================================================
// 邏輯世界（世界單位）
// --------------------------------------------------------------------------
// 所有座標與尺寸一律用世界單位表示，繪製時經 PhysicsUtils.fitViewWH()
// 換算成像素。位置與尺寸因此必然同步縮放，不會因為 canvas 長寬比改變
// 而相對跑掉——這是舊版混用「畫布比例定位 + 寫死像素尺寸」的修正。
//
// 世界長寬比建議接近畫布實際長寬比，以減少留白：
//   桌面三欄（≥1200px）中間欄約 54vw × 100dvh，偏瘦高
//   窄螢幕堆疊（<1200px）為 100vw × 60vh，偏扁寬
//   這裡取 1000 × 900 折衷。
// ==========================================================================
const WORLD_W = 1000;
const WORLD_H = 900;

// --- 場景垂直分佈 ---
const GRASS_TOP = 495;          // 草地起點
const ROAD_TOP  = 540;          // 路面上緣
const ROAD_H    = 80;           // 路面厚度

// --- 道路上的基準線 ---
const LANE_Y   = ROAD_TOP + 40; // 車道虛線
const BIKE_Y   = ROAD_TOP + 27;
const CAR_Y    = ROAD_TOP + 13;
const ARROW_Y  = ROAD_TOP + 93;
const PERSON_Y = ROAD_TOP + 100;

// --- 物件尺寸 ---
const CAR_W = 88, CAR_H = 38;
const BIKE_WHEEL_D = 30, BIKE_WHEEL_DX = 23;
const TREE_SPACING = 190;
const TREE_TRUNK_W = 10, TREE_TRUNK_H = 62;
const TREE_CANOPY_D = 70;
const TITLE_H = 60;

// --- 起始位置 ---
const BIKE_START_X   = WORLD_W * 0.20;
const CAR_START_X    = WORLD_W * 0.15;
const PERSON_START_X = WORLD_W * 0.80;

// --- 速度 → 世界位移（每秒幾世界單位）---
const SPEED_TO_WORLD = 50;

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
            // 務必用 contentSize()（扣除 padding），不要用 container.clientWidth：
            // clientWidth 含 padding，canvas 會比容器內容區大一圈而溢出，
            // 把三欄版面的右欄推出畫面。
            const { w, h } = PhysicsUtils.contentSize(container);
            const cnv = p.createCanvas(w || 800, h || 500);
            cnv.style('display', 'block');
            cnv.style('flex-shrink', '0');
            p.textFont('Inter');
        };

        p.windowResized = () => {
            const { w, h } = PhysicsUtils.contentSize(container);
            if (w > 0 && h > 0) p.resizeCanvas(w, h);
        };

        p.draw = () => {
            if (!document.contains(guardEl)) return;
            const dt = p.min(p.deltaTime / 1000, 0.1);
            if (isStarted && !isPaused) simTime += dt;

            // 每幀建立 view —— 畫布尺寸可能隨視窗改變，不可快取到外面
            const view = PhysicsUtils.fitViewWH(p.width, p.height, WORLD_W, WORLD_H);
            drawScene(p, view);

            if (isStarted) updateDataCards();
        };

        // ======================================================================
        // 繪圖（一律以世界單位思考，再經 view 換算）
        // ======================================================================
        function drawScene(p, view) {
            // 一切繪製都裁切在世界範圍內。
            // 世界長寬比與畫布不同時 contain 會留白；不裁切的話，
            // 樹木、草地這些滿版元素會溢到留白區，看起來像破圖。
            p.push();
            view.clip(p.drawingContext);

            drawSky(p, view);
            drawGround(p, view);
            drawRoad(p, view);

            const lineOffset = getBackgroundOffset();
            drawLaneLine(p, view, lineOffset);
            drawTrees(p, view, lineOffset);

            // 物件位置（世界座標）
            const bikeX   = getBikeX();
            const carX    = getCarX();
            const personX = getPersonX();

            if (isVisible(bikeX))   drawBike(p, view, bikeX, BIKE_Y);
            if (isVisible(carX))    drawCar(p, view, carX, CAR_Y);
            if (isVisible(personX)) drawPerson(p, view, personX, PERSON_Y);

            drawVelocityArrows(p, view, bikeX, carX, personX);
            drawReferenceMarker(p, view, bikeX, carX);
            drawTitleBar(p, view);

            p.pop();
        }

        // --- 天空 ---
        function drawSky(p, view) {
            const r = view.rect;
            const skyTop = view.toScreenY(0);
            const roadTop = view.toScreenY(ROAD_TOP);
            for (let y = Math.floor(skyTop); y < roadTop; y++) {
                const t = (y - skyTop) / (roadTop - skyTop);
                p.stroke(p.lerpColor(p.color(135, 206, 235), p.color(176, 224, 230), t));
                p.line(r.x, y, r.x + r.w, y);
            }
        }

        // --- 草地 ---
        function drawGround(p, view) {
            const r = view.rect;
            p.noStroke();
            p.fill(134, 239, 172);
            const y = view.toScreenY(GRASS_TOP);
            p.rect(r.x, y, r.w, r.y + r.h - y);
        }

        // --- 馬路 ---
        function drawRoad(p, view) {
            const r = view.rect;
            p.noStroke();
            p.fill(75, 85, 99);
            p.rect(r.x, view.toScreenY(ROAD_TOP), r.w, view.len(ROAD_H));
        }

        // --- 車道線 ---
        function drawLaneLine(p, view, offset) {
            const r = view.rect;
            const dash = view.len(35, 12);       // 一個「虛線 + 間隔」的週期
            const y = view.toScreenY(LANE_Y);
            p.stroke(251, 191, 36);
            p.strokeWeight(view.len(4, 2));
            p.drawingContext.setLineDash([dash * 0.55, dash * 0.45]);
            p.line(r.x + (offset % dash), y, r.x + r.w + dash, y);
            p.drawingContext.setLineDash([]);
            p.noStroke();
        }

        // --- 背景偏移（世界單位）---
        function getBackgroundOffset() {
            if (reference === 'ground') return 0;
            if (reference === 'bike') return -bikeSpeed * simTime * SPEED_TO_WORLD;
            return -carSpeed * simTime * SPEED_TO_WORLD;
        }

        // --- 位置計算（世界座標）---
        function getBikeX() {
            if (reference === 'bike') return BIKE_START_X + (BIKE_START_X - CAR_START_X);
            if (reference === 'ground') return BIKE_START_X + bikeSpeed * simTime * SPEED_TO_WORLD;
            return BIKE_START_X + (bikeSpeed - carSpeed) * simTime * SPEED_TO_WORLD;
        }
        function getCarX() {
            if (reference === 'car') return CAR_START_X + (CAR_START_X - BIKE_START_X);
            if (reference === 'ground') return CAR_START_X + carSpeed * simTime * SPEED_TO_WORLD;
            return CAR_START_X + (carSpeed - bikeSpeed) * simTime * SPEED_TO_WORLD;
        }
        function getPersonX() {
            if (reference === 'ground') return PERSON_START_X - personSpeed * simTime * SPEED_TO_WORLD;
            if (reference === 'bike') return PERSON_START_X - (personSpeed + bikeSpeed) * simTime * SPEED_TO_WORLD;
            return PERSON_START_X - (personSpeed + carSpeed) * simTime * SPEED_TO_WORLD;
        }

        // 是否還在世界範圍內（留一點邊界寬容值）
        function isVisible(worldX) {
            return worldX > -80 && worldX < WORLD_W + 80;
        }

        // --- 樹木 ---
        // 沿世界左右緣鋪滿，不隨畫布寬度改變——樹的數量和位置在任何螢幕上都一致。
        function drawTrees(p, view, offset) {
            const r = view.rect;
            const spacing = view.len(TREE_SPACING);
            const roadTop = view.toScreenY(ROAD_TOP);
            const trunkW = view.len(TREE_TRUNK_W);
            const trunkH = view.len(TREE_TRUNK_H);
            const canopy = view.len(TREE_CANOPY_D);

            const pxOffset = offset * view.scale;
            const startX = r.x + (pxOffset % spacing) - spacing;

            for (let x = startX; x < r.x + r.w + spacing; x += spacing) {
                p.fill(113, 63, 18);
                p.noStroke();
                p.rect(x - trunkW / 2, roadTop - trunkH, trunkW, trunkH);
                p.fill(34, 197, 94);
                p.circle(x, roadTop - trunkH - canopy * 0.3, canopy);
            }
        }

        // --- 自行車 ---
        function drawBike(p, view, worldX, worldY) {
            const dx = view.toScreenX(worldX);
            const y  = view.toScreenY(worldY);
            const wheelD  = view.len(BIKE_WHEEL_D);
            const wheelDX = view.len(BIKE_WHEEL_DX);
            const s = view.scale;

            p.strokeWeight(view.len(3, 1.5));
            p.stroke(30, 41, 59);
            p.noFill();
            p.circle(dx - wheelDX, y + 10 * s, wheelD);
            p.circle(dx + wheelDX, y + 10 * s, wheelD);

            p.stroke(59, 130, 246);
            p.strokeWeight(view.len(4, 2));
            p.line(dx - wheelDX, y + 10 * s, dx, y - 13 * s);
            p.line(dx, y - 13 * s, dx + wheelDX, y + 10 * s);
            p.line(dx, y - 13 * s, dx + 15 * s, y - 13 * s);
            p.line(dx + 13 * s, y - 19 * s, dx + 18 * s, y - 6 * s);

            p.noStroke();
            p.fill(30, 41, 59);
            p.circle(dx, y - 28 * s, view.len(15, 6));
        }

        // --- 汽車 ---
        function drawCar(p, view, worldX, worldY) {
            const dx = view.toScreenX(worldX);
            const y  = view.toScreenY(worldY);
            const w = view.len(CAR_W);
            const h = view.len(CAR_H);
            const s = view.scale;

            p.noStroke();
            p.fill(239, 68, 68);
            p.rect(dx - w / 2, y - h * 0.4, w, h, view.len(8, 3));

            p.fill(220, 38, 38);
            p.rect(dx - w * 0.28, y - h * 0.92, w * 0.57, h * 0.66, view.len(5, 2));

            p.fill(191, 219, 254);
            p.rect(dx - w * 0.23, y - h * 0.87, w * 0.20, h * 0.47);
            p.rect(dx + w * 0.02, y - h * 0.87, w * 0.20, h * 0.47);

            p.fill(30, 41, 59);
            const wheel = view.len(20, 7);
            p.circle(dx - w * 0.28, y + 23 * s, wheel);
            p.circle(dx + w * 0.28, y + 23 * s, wheel);
        }

        // --- 行人 ---
        function drawPerson(p, view, worldX, worldY) {
            const dx = view.toScreenX(worldX);
            const y  = view.toScreenY(worldY);
            const s = view.scale;

            p.fill(30, 41, 59);
            p.noStroke();
            p.circle(dx, y - 25 * s, view.len(18, 7));

            p.stroke(30, 41, 59);
            p.strokeWeight(view.len(4, 2));
            p.line(dx, y - 16 * s, dx, y + 6 * s);
            p.line(dx, y + 6 * s, dx - 10 * s, y + 22 * s);
            p.line(dx, y + 6 * s, dx + 10 * s, y + 22 * s);
            p.line(dx, y - 6 * s, dx - 13 * s, y + 2 * s);
            p.line(dx, y - 6 * s, dx + 13 * s, y + 2 * s);
        }

        // --- 速度箭頭 ---
        function drawVelocityArrows(p, view, bikeX, carX, personX) {
            const arrowY = view.toScreenY(ARROW_Y);

            if (isVisible(bikeX)) {
                const v = getRelativeSpeed('bike');
                drawVelocityArrow(p, view, bikeX, arrowY,
                    v * SPEED_TO_WORLD * 0.3, [59, 130, 246], `v=${v.toFixed(1)}`);
            }
            if (isVisible(carX)) {
                const v = getRelativeSpeed('car');
                drawVelocityArrow(p, view, carX, arrowY,
                    v * SPEED_TO_WORLD * 0.3, [239, 68, 68], `v=${v.toFixed(1)}`);
            }
            if (isVisible(personX)) {
                const v = getRelativeSpeed('person');
                drawVelocityArrow(p, view, personX, arrowY + view.len(33),
                    v * SPEED_TO_WORLD * 0.3, [34, 197, 94], `v=${Math.abs(v).toFixed(1)}`);
            }
        }

        function drawVelocityArrow(p, view, worldX, y, worldLen, col, label) {
            const x1 = view.toScreenX(worldX);
            const lenPx = Math.abs(view.len(worldLen));

            p.fill(col);
            p.noStroke();
            p.textAlign(p.CENTER);
            p.textSize(view.len(17, 10));
            p.textStyle(p.BOLD);

            if (lenPx < 3) {
                p.text('v=0', x1, y - view.len(10, 6));
                return;
            }

            const x2 = x1 + (worldLen >= 0 ? lenPx : -lenPx);
            const angle = Math.atan2(0, x2 - x1);
            const headLen = p.constrain(lenPx * 0.3, view.len(11, 6), view.len(19, 10));

            p.stroke(col);
            p.strokeWeight(view.len(5, 2));
            p.line(x1, y, x2 - headLen * Math.cos(angle), y);

            p.noStroke();
            p.fill(col);
            p.triangle(
                x2, y,
                x2 - headLen * Math.cos(angle - Math.PI / 6), y - headLen * Math.sin(angle - Math.PI / 6),
                x2 - headLen * Math.cos(angle + Math.PI / 6), y - headLen * Math.sin(angle + Math.PI / 6)
            );

            p.text(label, (x1 + x2) / 2, y - view.len(10, 6));
        }

        // --- 參照物標記 ---
        function drawReferenceMarker(p, view, bikeX, carX) {
            p.fill(251, 191, 36);
            p.noStroke();
            p.textAlign(p.CENTER);
            p.textSize(view.len(18, 11));
            p.textStyle(p.BOLD);

            if (reference === 'ground') {
                p.text('▼ 地面靜止', view.toScreenX(WORLD_W / 2), view.toScreenY(ROAD_TOP - 22));
            } else if (reference === 'bike') {
                p.text('▼ 參照物', view.toScreenX(bikeX), view.toScreenY(BIKE_Y - 105));
            } else {
                p.text('▼ 參照物', view.toScreenX(carX), view.toScreenY(CAR_Y - 130));
            }
        }

        // --- 底部標題列 ---
        function drawTitleBar(p, view) {
            const r = view.rect;
            const barH = view.len(TITLE_H);
            const barTop = r.y + r.h - barH;
            p.noStroke();
            p.fill(0, 0, 0, 178);
            p.rect(r.x, barTop, r.w, barH);
            p.fill(251, 191, 36);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(view.len(19, 12));
            p.textStyle(p.BOLD);
            p.text('同一事件，不同參考系 = 不同描述', r.x + r.w / 2, barTop + barH / 2);
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
