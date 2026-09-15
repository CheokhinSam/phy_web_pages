/**
 * 🌀 豎直彈簧振子（p5.js + KaTeX 版）
 * 垂直懸掛的彈簧-質量系統。
 *
 * 這個實驗和水平版（spring-oscillator.js）的差別，也是它唯一值得存在的理由：
 *   掛上重物後，重力把平衡位置往下拉 mg/k，
 *   但若改從「新的平衡位置」量位移，重力項就完全消掉：
 *       m·ÿ = mg − k(Δx₀ + y) = −k·y      （因為 k·Δx₀ = mg）
 *   所以 T = 2π√(m/k) 與 g 無關。
 *   切換地球／月球／火星時，平衡位置會大幅移動，但週期紋風不動。
 *
 * 座標系統：檔頭宣告固定尺寸的邏輯世界，所有座標與尺寸都用世界單位，
 * 繪製前才經 PhysicsUtils.fitViewWH() 換算成像素（見 style guide 開頭）。
 */

// ==========================================================================
// 邏輯世界（世界單位）
// ==========================================================================
const WORLD_W = 700;
const WORLD_H = 1000;

// --- 天花板 ---
const CEIL_Y = 96;              // 天花板下緣
const CEIL_H = 26;              // 橫樑厚度
const HATCH_SPACING = 24;       // 支撐斜線間距
// 天花板到最低允許懸掛點的距離。扣掉下面這塊之後剩下的 1000−96−650 = 254
// 世界單位，要留給 mg 箭頭（76）、箭頭標籤和底部標題列（62），不能給滿。
const H_AVAIL = 650;

// --- 公尺 → 世界單位 的縮放（隨參數調整，僅在極端設定下才會變動）---
// 因為 hang = total × S ≤ H_AVAIL 恆成立，重物最低點必在 CEIL_Y + 650 以內，
// 箭頭再往下 76 也還在標題列上方 —— 場景永遠不會撞到 bar。
const S_MAX = 490;              // 上限：預設參數下固定在這裡，切換 g 不會縮放
const S_MIN = 160;              // 下限：最長的參數組合（3.08 m）需要 211，用不到

// --- 重物 ---
const WEIGHT_X = 350;           // 重物中心 X（世界座標）
const WEIGHT_W = 78;
const WEIGHT_H = 66;

// --- 彈簧 ---
const COIL_COUNT = 12;          // 完整圈數
const COIL_AMP = 19;            // 鋸齒半振幅
const COIL_LEAD = 24;           // 兩端直線段

// --- 向量箭頭 ---
const FORCE_REF_LEN = 76;       // mg 箭頭長度（固定），彈力依比例伸縮
const VEL_REF_LEN = 74;         // 速度箭頭在全速時的長度
const ARROW_X_R = WEIGHT_X + WEIGHT_W / 2 + 34;   // 力箭頭（右側）
const ARROW_X_L = WEIGHT_X - WEIGHT_W / 2 - 34;   // 速度箭頭（左側）
const DX0_MARK_X = 596;         // Δx₀ 尺寸標示的位置

const BOTTOM_BAR_H = 62;

// 振幅上限。彈簧只能拉、不能推 —— 一旦重物升到自然長度以上，彈簧就會鬆弛
// （伸長量 ≤ 0，張力歸零），重物變成自由落體，簡諧運動的前提當場失效。
// 而重物最高會升到 y = −A，所以「A < Δx₀」就是維持簡諧運動的條件。
// 不夾住的話，在月球上（Δx₀ 只有地球的 1/6）拉 0.12 m 就會鬆弛，
// 週期實測會比 2π√(m/k) 多出 4%，整個實驗要教的「T 與 g 無關」直接變成錯的。
const AMP_SLIDER_MAX = 0.30;    // 振幅滑桿的名目上限
const AMP_FRAC = 0.85;          // 實際上限 = AMP_FRAC × Δx₀，留 15% 餘裕

// Δx₀ 跨了三個數量級（月球＋重彈簧 ≈ 0.003 m，地球＋軟彈簧 ≈ 1.18 m），
// 固定小數位會讓小的一端全部印成 0.003，看不出變化。
const fmtLen = v => v >= 0.1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(4) : v.toFixed(5);

function initVerticalSpring() {
    // --- 取得容器，移除原始 canvas，讓 p5 自行建立 ---
    const origCanvas = document.getElementById('physicsCanvas');
    if (!origCanvas) return;
    const container = origCanvas.parentElement;
    origCanvas.remove();
    const ctrlPanel = document.getElementById('controlPanel');
    const guardEl = ctrlPanel || container;

    // ==========================================================================
    // A. 參數
    // ==========================================================================
    const PLANETS = [
        { name: '地球', emoji: '🌍', g: 9.8 },
        { name: '月球', emoji: '🌙', g: 1.6 },
        { name: '火星', emoji: '🪐', g: 3.7 },
    ];
    let planetIdx = 0;
    let mass = 1.0;        // kg
    let springK = 40;      // N/m
    let naturalL = 0.9;    // 彈簧自然長度 (m)
    let amp = 0.12;        // 初始振幅 (m)

    // ==========================================================================
    // B. 狀態
    // ==========================================================================
    let y = amp;           // 位移，從「掛重物後的平衡位置」量起，向下為正 (m)
    let v = 0;             // 速度，向下為正 (m/s)
    let simTime = 0;
    let isStarted = false;
    let isPaused = false;
    let frameCount = 0;
    let chartX = null;
    let chartE = null;

    // ==========================================================================
    // C. 導出量
    // ==========================================================================
    const gravity = () => PLANETS[planetIdx].g;
    const getDx0 = () => mass * gravity() / springK;          // 靜態伸長量 mg/k
    const getOmega = () => Math.sqrt(springK / mass);
    const getPeriod = () => 2 * Math.PI / getOmega();
    // 振幅上限 = min(滑桿上限, 0.85·Δx₀)，見檔頭 AMP_FRAC 的說明
    const getAmpMax = () => Math.min(AMP_SLIDER_MAX, AMP_FRAC * getDx0());

    // 公尺 → 世界單位。以「最遠可達的懸掛長度」反推，確保永遠塞得進畫面。
    // 用 amp（而非當下的 y）計算，所以振動過程中不會逐幀縮放。
    function scaleOf() {
        const total = naturalL + getDx0() + amp;
        return Math.max(S_MIN, Math.min(S_MAX, H_AVAIL / Math.max(total, 0.05)));
    }

    // 重物是掛在彈簧末端（吊點）「下方」WEIGHT_H/2 處，所以重物中心比吊點低。
    // 參考線、力箭頭、速度箭頭一律以重物中心為準：位移 y 描述的是重物的位置，
    // 學生眼睛跟著的也是重物本身。若拿吊點當基準畫平衡線，重物來回的中心會落在
    // 藍線下方半個方塊，看起來就像「平衡位置畫高了」。
    const MASS_MARK_DY = WEIGHT_H / 2;

    // 重物中心的螢幕 y（yy = 相對平衡位置的位移，向下為正）
    function massCenterScreenY(view, S, yy) {
        return view.toScreenY(CEIL_Y + (naturalL + getDx0() + yy) * S + MASS_MARK_DY);
    }

    // ==========================================================================
    // D. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        const katexOr = (tex, fallback) => (typeof katex !== 'undefined')
            ? katex.renderToString(tex, { throwOnError: false, displayMode: true })
            : `<div style="font-size:1rem;font-weight:700;">${fallback}</div>`;

        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>重力場</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="gVal" style="color: #2563eb;">9.8</span> m/s²
                    </span>
                </label>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-top: 8px;">
                    <button id="btnEarth" class="planet-btn active">🌍 地球</button>
                    <button id="btnMoon" class="planet-btn">🌙 月球</button>
                    <button id="btnMars" class="planet-btn">🪐 火星</button>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>質量 m</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="mVal" style="color: #2563eb;">1.0</span> kg
                    </span>
                </label>
                <input type="range" id="mSlider" min="0.2" max="3.0" step="0.1" value="1.0">
            </div>
            <div class="control-box">
                <label>
                    <span>彈簧常數 k</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="kVal" style="color: #2563eb;">40</span> N/m
                    </span>
                </label>
                <input type="range" id="kSlider" min="25" max="100" step="5" value="40">
            </div>
            <div class="control-box">
                <label>
                    <span>自然長度 L₀</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="l0Val" style="color: #2563eb;">0.90</span> m
                    </span>
                </label>
                <input type="range" id="l0Slider" min="0.6" max="1.6" step="0.05" value="0.9">
            </div>
            <div class="control-box">
                <label>
                    <span>初始振幅 A</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">0.12</span> m
                    </span>
                </label>
                <input type="range" id="aSlider" min="0.02" max="0.30" step="0.01" value="0.12">
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="startBtn" style="width: 100%; padding: 12px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.95rem; letter-spacing: 1px;">開始 START</button>
                <button id="pauseBtn" style="display: none; width: 100%; padding: 12px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.95rem; margin-top: 6px;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 12px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.95rem; margin-top: 6px;">重設 RESET</button>
            </div>
            <div class="control-box" style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">懸掛後的平衡條件</div>
                <div>${katexOr('mg = k\\,\\Delta x_0', 'mg = k·Δx₀')}</div>
            </div>
            <div class="control-box" style="margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                <div style="font-weight: 700; margin-bottom: 6px;">振動週期（與 g 無關）</div>
                <div>${katexOr('T = 2\\pi\\sqrt{\\dfrac{m}{k}}', 'T = 2π√(m/k)')}</div>
            </div>
        `;

        // 行星切換按鈕樣式
        const style = document.createElement('style');
        style.textContent = `
            .planet-btn {
                padding: 9px 4px; background: #fff; color: #000;
                border: 1px solid #000; font-weight: 700; cursor: pointer;
                font-size: 0.78rem; font-family: monospace;
                transition: background 0.15s, color 0.15s;
            }
            .planet-btn.active { background: #000; color: #fff; border-color: #000; }
            .planet-btn:hover { opacity: 0.82; }
        `;
        document.head.appendChild(style);

        const el = id => document.getElementById(id);
        const mSlider = el('mSlider');
        const kSlider = el('kSlider');
        const l0Slider = el('l0Slider');
        const aSlider = el('aSlider');

        function updateParamLabels() {
            el('gVal').textContent = gravity().toFixed(1);
            el('mVal').textContent = mass.toFixed(1);
            el('kVal').textContent = springK.toFixed(0);
            el('l0Val').textContent = naturalL.toFixed(2);
            el('aVal').textContent = fmtLen(amp);
        }

        // Δx₀ 隨 m / k / g 變動，振幅上限也跟著變。把上限同步到滑桿上，
        // 並把超出的振幅夾回來 —— 例如在地球把 A 拉到 0.20 再切到月球，
        // Δx₀ 從 0.245 掉到 0.040，A 必須跟著退到 0.034，否則彈簧會鬆弛。
        function syncAmpSlider() {
            const ampMax = getAmpMax();
            // 極端參數下 ampMax 可能比名目下限 0.02 還小，此時下限要跟著讓開
            const ampMin = Math.min(0.02, ampMax * 0.2);
            const step = Math.max((ampMax - ampMin) / 60, 1e-4);

            aSlider.min = ampMin.toFixed(4);
            aSlider.max = ampMax.toFixed(4);
            aSlider.step = step.toFixed(4);

            amp = Math.max(ampMin, Math.min(amp, ampMax));
            aSlider.value = amp;
        }

        function updatePlanetButtons() {
            const ids = ['btnEarth', 'btnMoon', 'btnMars'];
            ids.forEach((id, i) => el(id).classList.toggle('active', i === planetIdx));
        }

        // 這四個控制項都會改變 Δx₀（或振幅本身），一定要一起同步滑桿範圍
        function onParamChange() {
            syncAmpSlider();

            // 只夾滑桿不夠。振動中切換行星時，重物正帶著舊的振幅在跑 ——
            // 地球的 A=0.12 換到月球（上限剩 0.034）之後，若放著不管，
            // 重物會直接衝破自然長度、彈簧鬆弛，簡諧運動當場失效。
            // 這裡把「當下的振動振幅」A = √(y² + v²/ω²) 壓回上限內；
            // y 與 v 同乘一個比例，所以相位不變，只是振幅縮小。
            if (isStarted) {
                const omega = getOmega();
                const curAmp = Math.sqrt(y * y + (v * v) / (omega * omega));
                const cap = getAmpMax();
                if (curAmp > cap && curAmp > 1e-9) {
                    const factor = cap / curAmp;
                    y *= factor;
                    v *= factor;
                }
            }

            updateParamLabels();
        }

        ['btnEarth', 'btnMoon', 'btnMars'].forEach((id, i) => {
            el(id).addEventListener('click', () => {
                planetIdx = i;
                updatePlanetButtons();
                onParamChange();
            });
        });

        mSlider.addEventListener('input', () => { mass = parseFloat(mSlider.value); onParamChange(); });
        kSlider.addEventListener('input', () => { springK = parseFloat(kSlider.value); onParamChange(); });
        l0Slider.addEventListener('input', () => { naturalL = parseFloat(l0Slider.value); updateParamLabels(); });
        aSlider.addEventListener('input', () => { amp = parseFloat(aSlider.value); updateParamLabels(); });

        onParamChange();

        el('startBtn').addEventListener('click', () => {
            isStarted = true;
            isPaused = false;
            el('startBtn').style.display = 'none';
            el('pauseBtn').style.display = 'block';
        });

        el('pauseBtn').addEventListener('click', () => {
            isPaused = !isPaused;
            el('pauseBtn').textContent = isPaused ? '播放 PLAY' : '暫停 PAUSE';
            el('pauseBtn').style.backgroundColor = isPaused ? '#2563eb' : '#ffffff';
            el('pauseBtn').style.color = isPaused ? '#ffffff' : '#000000';
            el('pauseBtn').style.border = isPaused ? 'none' : '1px solid #000000';
        });

        el('resetBtn').addEventListener('click', () => {
            isStarted = false;
            isPaused = false;
            simTime = 0;
            y = amp;
            v = 0;
            el('startBtn').style.display = 'block';
            el('pauseBtn').style.display = 'none';
            el('pauseBtn').textContent = '暫停 PAUSE';
            if (chartX && chartX.clear) chartX.clear();
            if (chartE && chartE.clear) chartE.clear();
        });
    }

    // ==========================================================================
    // E. 數據卡片
    // ==========================================================================
    const updateCards = PhysicsUtils.createDataCards([
        { label: '時間 TIME', id: 'cardT', unit: 's' },
        { label: '位移 x', id: 'cardX', unit: 'm' },
        { label: '速度 v', id: 'cardV', unit: 'm/s' },
        { label: '加速度 a', id: 'cardA', unit: 'm/s²' },
        { label: '週期 T', id: 'cardPeriod', unit: 's', highlight: true },
        { label: '靜態伸長 Δx₀', id: 'cardDx0', unit: 'm', highlight: true },
        { label: '動能 Ek', id: 'cardEk', unit: 'J' },
        { label: '力學能 E', id: 'cardE', unit: 'J' },
    ]);

    // ==========================================================================
    // F. 圖表
    // ==========================================================================
    PhysicsUtils.prepareChartContainer('chartContainer', [
        { canvasId: 'vsXtChart', title: 'DISPLACEMENT-TIME 位移-時間' },
        { canvasId: 'vsEtChart', title: 'MECHANICAL ENERGY 力學能-時間' },
    ]);

    setTimeout(() => {
        chartX = PhysicsUtils.createChart({
            canvasId: 'vsXtChart',
            label: '位移 x (m)',
            borderColor: '#2563eb',
            xTitle: '時間 t (s)',
            yTitle: '位移 x (m)',
            maxPoints: 400,
        });
        chartE = PhysicsUtils.createChart({
            canvasId: 'vsEtChart',
            label: '力學能 E (J)',
            borderColor: '#22c55e',
            xTitle: '時間 t (s)',
            yTitle: '力學能 E (J)',
            maxPoints: 400,
        });
    }, 50);

    // ==========================================================================
    // G. 物理
    // ==========================================================================
    // 取向下為正。彈簧伸長量 s = Δx₀ + y（相對自然長度）。
    //   s > 0：a = g − k·s/m
    //   s ≤ 0：彈簧鬆弛，不施力，a = g（自由落體）
    // 在 s > 0 時，因 k·Δx₀ = mg，化簡後就是 a = −k·y/m，與 g 無關。
    function accel(yy) {
        const s = getDx0() + yy;
        if (s <= 0) return gravity();
        return gravity() - springK * s / mass;
    }

    // 力學能（含重力位能與彈性位能，以平衡位置為重力位能零點）。
    // 這個量在「有鬆弛」與「無鬆弛」兩段都守恆，且交界處連續。
    function energy() {
        const s = Math.max(0, getDx0() + y);
        return 0.5 * mass * v * v + 0.5 * springK * s * s - mass * gravity() * y;
    }

    // ==========================================================================
    // H. p5.js Instance Mode Sketch
    // ==========================================================================
    const sketch = (p) => {
        p.setup = () => {
            // 務必用 contentSize()（扣 padding）。用 container.clientWidth 的話，
            // canvas 會比容器內容區大 60px，把三欄版面的右欄推出畫面。
            const { w, h } = PhysicsUtils.contentSize(container);
            const cnv = p.createCanvas(w || 640, h || 800);
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

            if (!isStarted) {
                // 尚未開始：重物靜止在「平衡位置下方 A 處」，等於先拉開再放手。
                // 這樣調整振幅滑桿時會即時看到重物上下移動。
                y = amp;
                v = 0;
            } else if (!isPaused) {
                // 半隱式歐拉（symplectic）。子步數依 ω·dt 自適應：固定 10 步的話，
                // 掉幀到 dt=0.1 又碰上 ω=22.4（m=0.2 / k=100）時 ω·subDt 會到 0.22，
                // 能量誤差飆到 13%，振幅會慢慢自己長大。夾在 8~40 步，保持
                // ω·subDt ≲ 0.056。
                const SUB = Math.min(40, Math.max(8, Math.ceil(dt * getOmega() * 20)));
                const subDt = dt / SUB;
                for (let i = 0; i < SUB; i++) {
                    v += accel(y) * subDt;
                    y += v * subDt;
                }
                simTime += dt;
            }

            // 每幀建立 view —— 畫布尺寸可能隨視窗改變，不可快取到外面
            const view = PhysicsUtils.fitViewWH(p.width, p.height, WORLD_W, WORLD_H);
            p.clear();
            drawScene(p, view);

            if (isStarted) updateDataCards();

            if (frameCount++ % 3 === 0 && isStarted && !isPaused) {
                const t = simTime.toFixed(2);
                if (chartX && chartX.pushData) chartX.pushData(t, y);
                if (chartE && chartE.pushData) chartE.pushData(t, energy());
            }
        };

        // ======================================================================
        // 繪圖：一律先想世界座標，再經 view 換算
        // ======================================================================
        function drawScene(p, view) {
            p.push();
            view.clip(p.drawingContext);   // 不裁切的話，滿版元素會溢到留白區

            drawCeiling(p, view);
            drawReferenceLines(p, view);
            drawSpringAndWeight(p, view);
            drawForceArrows(p, view);
            drawVelocityArrow(p, view);
            drawBottomBar(p, view);

            p.pop();
        }

        // --- 天花板（含斜線表示剛性支撐）---
        function drawCeiling(p, view) {
            const r = view.rect;
            const y = view.toScreenY(CEIL_Y);
            const h = view.len(CEIL_H);
            const sp = view.len(HATCH_SPACING);

            p.stroke(148, 163, 184);
            p.strokeWeight(view.len(2.5, 1.5));
            for (let x = r.x - h * 2; x < r.x + r.w + h * 2; x += sp) {
                p.line(x, y - h * 1.9, x + h * 1.9, y);
            }

            p.noStroke();
            p.fill(30, 41, 59);
            p.rect(r.x, y, r.w, h);
        }

        // --- 兩條參考線：自然長度 與 掛重物後的平衡位置 ---
        function drawReferenceLines(p, view) {
            const r = view.rect;
            const S = scaleOf();
            // 兩條線都對齊重物中心的高度（見 MASS_MARK_DY）。同時平移，所以
            // 兩線之間的距離仍然是 Δx₀，量出來的伸長量不受影響。
            const natY = view.toScreenY(CEIL_Y + naturalL * S + MASS_MARK_DY);
            const eqY = massCenterScreenY(view, S, 0);

            p.strokeWeight(view.len(2.5, 1.5));
            p.drawingContext.setLineDash([view.len(15, 7), view.len(11, 5)]);
            p.stroke(148, 163, 184);
            p.line(r.x, natY, r.x + r.w, natY);
            p.stroke(37, 99, 235);
            p.line(r.x, eqY, r.x + r.w, eqY);
            p.drawingContext.setLineDash([]);

            // 標籤一律靠左，兩線太近時把「自然長度」往上挪開
            const tooClose = Math.abs(eqY - natY) < view.len(34, 20);
            const natLabelY = tooClose ? eqY - view.len(38, 22) : natY;

            p.noStroke();
            p.textAlign(p.LEFT, p.CENTER);
            p.textSize(view.len(19, 11));
            p.textStyle(p.BOLD);

            const lx = view.toScreenX(16);
            const natTxt = '自然長度 L₀';
            const eqTxt = '平衡位置 x = 0';

            // 標籤先鋪一塊底色再寫字。這兩條線橫貫整個世界，
            // 不鋪底的話虛線會直接穿過文字，看起來像刪節線。
            p.fill(248, 250, 252);
            [natTxt, eqTxt].forEach((txt, i) => {
                const y = i === 0 ? natLabelY : eqY;
                p.rect(lx - view.len(6, 4), y - view.len(13, 8),
                    p.textWidth(txt) + view.len(12, 8), view.len(26, 16));
            });

            p.fill(148, 163, 184);
            p.text(natTxt, lx, natLabelY);
            p.fill(37, 99, 235);
            p.text(eqTxt, lx, eqY);

            // Δx₀ 尺寸標示（兩線太近就省略，免得糊成一團）
            const gap = eqY - natY;
            if (gap > view.len(48, 26)) {
                const mx = view.toScreenX(DX0_MARK_X);
                const tick = view.len(9, 5);

                p.stroke(100, 116, 139);
                p.strokeWeight(view.len(2, 1.4));
                p.line(mx, natY, mx, eqY);
                p.line(mx - tick, natY, mx + tick, natY);
                p.line(mx - tick, eqY, mx + tick, eqY);

                p.noStroke();
                p.fill(71, 85, 105);
                p.textAlign(p.CENTER, p.BOTTOM);
                p.textSize(view.len(17, 10));
                p.text(`Δx₀ = ${fmtLen(getDx0())} m`, mx, natY - view.len(10, 6));
            }
        }

        // --- 彈簧 ---
        function drawSpring(p, view, cx, yTop, yBottom) {
            const len = yBottom - yTop;
            if (len < view.len(14, 8)) return;

            const lead = Math.min(view.len(COIL_LEAD), len * 0.18);
            const coilLen = len - lead * 2;
            const seg = coilLen / (COIL_COUNT * 2);
            const ampPx = view.len(COIL_AMP);

            p.noFill();
            p.stroke(120, 126, 138);
            p.strokeWeight(view.len(4, 2));
            p.strokeJoin(p.ROUND);

            p.beginShape();
            p.vertex(cx, yTop);
            for (let i = 0; i <= COIL_COUNT * 2; i++) {
                const yy = yTop + lead + i * seg;
                const ends = (i === 0 || i === COIL_COUNT * 2);
                const xx = ends ? cx : cx + (i % 2 ? ampPx : -ampPx);
                p.vertex(xx, yy);
            }
            p.vertex(cx, yBottom);
            p.endShape();
        }

        // --- 彈簧 + 重物 ---
        function drawSpringAndWeight(p, view) {
            const S = scaleOf();
            const wx = view.toScreenX(WEIGHT_X);
            const w = view.len(WEIGHT_W);
            const h = view.len(WEIGHT_H);
            const cy = massCenterScreenY(view, S, y);
            const attachY = cy - h / 2;          // 彈簧末端＝重物頂面

            drawSpring(p, view, wx, view.toScreenY(CEIL_Y), attachY);

            p.stroke(15, 23, 42);
            p.strokeWeight(view.len(3, 1.5));
            p.fill(37, 99, 235);
            p.rect(wx - w / 2, cy - h / 2, w, h, view.len(7, 3));

            p.noStroke();
            p.fill(255, 255, 255, 72);
            p.rect(wx - w / 2 + w * 0.13, cy - h / 2 + h * 0.14, w * 0.22, h * 0.46, view.len(4, 2));

            p.fill(255);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(view.len(22, 12));
            p.textStyle(p.BOLD);
            p.text(`${mass.toFixed(1)} kg`, wx, cy);
        }

        // --- 力的向量：mg（下）與彈力（上），以重物中心為共同起點 ---
        function drawForceArrows(p, view) {
            const S = scaleOf();
            const cy = massCenterScreenY(view, S, y);
            const ax = view.toScreenX(ARROW_X_R);

            const mgN = mass * gravity();
            const s = getDx0() + y;
            const fN = s > 0 ? springK * s : 0;

            const mgLen = view.len(FORCE_REF_LEN);
            const fLen = Math.min(mgLen * (fN / mgN), mgLen * 2.4);

            drawArrowPx(p, view, ax, cy, ax, cy + mgLen, [239, 68, 68], `${mgN.toFixed(1)} N`, 'mg');

            if (fLen > 2) {
                drawArrowPx(p, view, ax, cy, ax, cy - fLen, [139, 92, 246], `${fN.toFixed(1)} N`, 'F');
            }
        }

        // --- 速度（垂直，畫在左側避開力的箭頭）---
        function drawVelocityArrow(p, view) {
            if (Math.abs(v) < 0.02) return;

            const S = scaleOf();
            const cy = massCenterScreenY(view, S, y);
            const ax = view.toScreenX(ARROW_X_L);

            // 以當前參數下的最大速率當滿刻度，任何設定下都讀得到
            const vRef = Math.max(amp * getOmega(), 1e-6);
            const len = Math.min(Math.abs(v) / vRef, 1) * view.len(VEL_REF_LEN);
            const dir = v >= 0 ? 1 : -1;

            drawArrowPx(p, view, ax, cy, ax, cy + dir * len, [234, 88, 12],
                `${Math.abs(v).toFixed(2)} m/s`, 'v');
        }

        // --- 通用箭頭（像素座標；標籤放在箭尖外側）---
        function drawArrowPx(p, view, x1, y1, x2, y2, col, numLabel, symLabel) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 3) return;

            const ang = Math.atan2(dy, dx);
            const head = Math.min(len * 0.36, view.len(20, 11));

            p.stroke(col);
            p.strokeWeight(view.len(4.5, 2));
            p.line(x1, y1, x2 - head * Math.cos(ang), y2 - head * Math.sin(ang));

            p.noStroke();
            p.fill(col);
            p.triangle(
                x2, y2,
                x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6),
                x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6)
            );

            const below = dy >= 0;
            const off = view.len(9, 6);
            p.textSize(view.len(17, 10));
            p.textStyle(p.BOLD);
            p.textAlign(p.CENTER, below ? p.TOP : p.BOTTOM);
            p.text(`${symLabel} = ${numLabel}`, x2, y2 + (below ? off : -off));
        }

        // --- 底部標題列 ---
        function drawBottomBar(p, view) {
            const r = view.rect;
            const barH = view.len(BOTTOM_BAR_H);
            const barTop = r.y + r.h - barH;

            p.noStroke();
            p.fill(0, 0, 0, 178);
            p.rect(r.x, barTop, r.w, barH);

            p.fill(251, 191, 36);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(view.len(19, 11));
            p.textStyle(p.BOLD);
            p.text('重力只移動平衡位置，週期 T = 2π√(m/k) 不變',
                r.x + r.w / 2, barTop + barH / 2);
        }

        // --- 更新數據卡片 ---
        function updateDataCards() {
            const s = getDx0() + y;
            updateCards({
                cardT: simTime.toFixed(2),
                cardX: y.toFixed(3),
                cardV: v.toFixed(3),
                cardA: accel(y).toFixed(3),
                cardPeriod: getPeriod().toFixed(3),
                cardDx0: fmtLen(getDx0()),
                cardEk: (0.5 * mass * v * v).toFixed(3),
                cardE: energy().toFixed(3),
            });
        }
    };

    // ==========================================================================
    // I. 啟動 p5（延遲確保 DOM 佈局完成）
    // ==========================================================================
    setTimeout(() => {
        new p5(sketch, container);
    }, 100);
}

initVerticalSpring();
