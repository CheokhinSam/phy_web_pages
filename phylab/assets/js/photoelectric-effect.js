/**
 * 🔬 光電效應 - 實驗腳本（仿真實驗室視覺版）
 * 深色實驗桌 + 金屬儀器 + 玻璃真空管 + 光束 + 電子動畫
 */
function initPhotoelectricEffect() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 物理常數與狀態
    // ==========================================================================
    const h_eV = 4.1357e-15;
    const metals = {
        'Cs': { name: '銫 Cs', phi: 1.95, color: '#b0b8c4', surface: '#c8cdd4' },
        'Na': { name: '鈉 Na', phi: 2.28, color: '#d0d4d8', surface: '#e0e4e8' },
        'K':  { name: '鉀 K',  phi: 2.30, color: '#a8b0b8', surface: '#bcc4cc' },
        'Zn': { name: '鋅 Zn', phi: 3.63, color: '#7a8a9a', surface: '#8a9aaa' },
        'Pt': { name: '鉑 Pt', phi: 5.65, color: '#606870', surface: '#707880' }
    };

    let frequency = 600;
    let intensity = 5;
    let metalKey = 'Na';
    let retardingV = 0;
    let isRunning = false;
    let simTime = 0;

    let photons = [];
    let electrons = [];

    // ==========================================================================
    // B. 物理計算
    // ==========================================================================
    function calc() {
        const phi = metals[metalKey].phi;
        const E_photon = h_eV * frequency * 1e12;
        const K_max = Math.max(E_photon - phi, 0);
        const f0 = phi / h_eV / 1e12;
        const V_stop = K_max;
        const canEmit = frequency >= f0;
        const electronReachAnode = canEmit && (retardingV < V_stop);
        const current = electronReachAnode ? intensity * 0.8 : 0;
        return { phi, E_photon, K_max, f0, V_stop, canEmit, electronReachAnode, current };
    }

    function freqToColor(f) {
        if (f < 380) return { r: 60, g: 0, b: 0 };
        if (f < 480) return { r: 200, g: 40, b: 40 };
        if (f < 510) return { r: 220, g: 120, b: 20 };
        if (f < 540) return { r: 220, g: 190, b: 30 };
        if (f < 580) return { r: 60, g: 170, b: 50 };
        if (f < 620) return { r: 40, g: 120, b: 180 };
        if (f < 680) return { r: 70, g: 50, b: 180 };
        if (f < 750) return { r: 120, g: 30, b: 160 };
        return { r: 140, g: 40, b: 200 };
    }

    function freqToWavelength(f) {
        return (3e8 / (f * 1e12)) * 1e9;
    }

    // ==========================================================================
    // C. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>光頻率 <i>f</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="fVal" style="color: #2563eb;">600</span> THz
                    </span>
                </label>
                <input type="range" id="fSlider" min="300" max="900" step="10" value="600">
                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; font-family: monospace; margin-top: 2px;">
                    <span>300 紅外</span><span>可見光</span><span>900 紫外</span>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>光強度 <i>I</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="iVal" style="color: #2563eb;">5</span>
                    </span>
                </label>
                <input type="range" id="iSlider" min="1" max="10" step="1" value="5">
            </div>
            <div class="control-box">
                <label><span>金屬靶材</span></label>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">
                    <button class="metal-btn" data-metal="Cs" style="flex: 1; padding: 6px 2px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.75rem;">銫</button>
                    <button class="metal-btn" data-metal="Na" style="flex: 1; padding: 6px 2px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.75rem;">鈉</button>
                    <button class="metal-btn" data-metal="K" style="flex: 1; padding: 6px 2px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.75rem;">鉀</button>
                    <button class="metal-btn" data-metal="Zn" style="flex: 1; padding: 6px 2px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.75rem;">鋅</button>
                    <button class="metal-btn" data-metal="Pt" style="flex: 1; padding: 6px 2px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.75rem;">鉑</button>
                </div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px; font-family: monospace;">
                    φ = <span id="phiDisplay">2.28</span> eV　f₀ = <span id="f0Display">551</span> THz
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>逆向電壓 <i>V<sub>s</sub></i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vsVal" style="color: #2563eb;">0.0</span> V
                    </span>
                </label>
                <input type="range" id="vsSlider" min="0" max="5.0" step="0.1" value="0">
            </div>
            <div class="control-box" style="margin-top: 10px;">
                <button id="startBtn" style="width: 100%; background-color: #2563eb; color: #ffffff; margin-bottom: 8px;">開始 / START</button>
                <button id="pauseBtn" style="display: none; width: 100%; margin-bottom: 8px;">暫停 / PAUSE</button>
                <button id="resetBtn" style="width: 100%; background-color: #ffffff; color: #000000; border: 1px solid #000000;">重設 / RESET</button>
            </div>
        `;

        const fSlider = document.getElementById('fSlider');
        const iSlider = document.getElementById('iSlider');
        const vsSlider = document.getElementById('vsSlider');
        const fVal = document.getElementById('fVal');
        const iVal = document.getElementById('iVal');
        const vsVal = document.getElementById('vsVal');
        const phiDisplay = document.getElementById('phiDisplay');
        const f0Display = document.getElementById('f0Display');
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');
        const metalBtns = document.querySelectorAll('.metal-btn');

        function updateMetalButtons() {
            metalBtns.forEach(btn => {
                if (btn.dataset.metal === metalKey) {
                    btn.style.background = '#000'; btn.style.color = '#fff'; btn.style.border = 'none';
                } else {
                    btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.border = '1px solid #000';
                }
            });
            const d = calc();
            phiDisplay.innerText = d.phi.toFixed(2);
            f0Display.innerText = Math.round(d.f0);
        }

        metalBtns.forEach(btn => {
            btn.onclick = () => { metalKey = btn.dataset.metal; updateMetalButtons(); updateCards(); updateIVChart(); };
        });

        fSlider.addEventListener('input', () => {
            frequency = parseInt(fSlider.value);
            fVal.innerText = frequency;
            updateCards(); updateIVChart();
        });
        iSlider.addEventListener('input', () => {
            intensity = parseInt(iSlider.value);
            iVal.innerText = intensity;
            updateCards();
        });
        vsSlider.addEventListener('input', () => {
            retardingV = parseFloat(vsSlider.value);
            vsVal.innerText = retardingV.toFixed(1);
            updateCards(); updateIVChart();
        });

        if (startBtn) startBtn.onclick = () => { isRunning = true; startBtn.style.display = 'none'; pauseBtn.style.display = 'block'; };
        if (pauseBtn) pauseBtn.onclick = () => {
            isRunning = !isRunning;
            pauseBtn.innerText = isRunning ? "暫停 / PAUSE" : "播放 / PLAY";
            pauseBtn.style.backgroundColor = isRunning ? "#000000" : "#2563eb";
        };
        if (resetBtn) resetBtn.onclick = () => {
            frequency = 600; intensity = 5; metalKey = 'Na'; retardingV = 0; isRunning = false; simTime = 0;
            fSlider.value = 600; iSlider.value = 5; vsSlider.value = 0;
            fVal.innerText = '600'; iVal.innerText = '5'; vsVal.innerText = '0.0';
            photons = []; electrons = [];
            updateMetalButtons(); startBtn.style.display = 'block'; pauseBtn.style.display = 'none';
            updateCards(); updateIVChart();
        };
        updateMetalButtons();
    }

    // ==========================================================================
    // D. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(140px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card"><span class="card-label">光子能量 E</span><div class="card-num-wrapper"><span id="dashE" class="card-num">0.00</span><span class="card-unit">eV</span></div></div>
            <div class="data-card"><span class="card-label">功函數 φ</span><div class="card-num-wrapper"><span id="dashPhi" class="card-num">2.28</span><span class="card-unit">eV</span></div></div>
            <div class="data-card highlight"><span class="card-label">最大動能 K</span><div class="card-num-wrapper"><span id="dashK" class="card-num">0.00</span><span class="card-unit">eV</span></div></div>
            <div class="data-card"><span class="card-label">停止電壓 V<sub>s</sub></span><div class="card-num-wrapper"><span id="dashVs" class="card-num">0.00</span><span class="card-unit">V</span></div></div>
            <div class="data-card"><span class="card-label">光電流 I</span><div class="card-num-wrapper"><span id="dashI" class="card-num">0.0</span><span class="card-unit">μA</span></div></div>
        `;
    }

    const dashE = document.getElementById('dashE');
    const dashPhi = document.getElementById('dashPhi');
    const dashK = document.getElementById('dashK');
    const dashVs = document.getElementById('dashVs');
    const dashI = document.getElementById('dashI');

    function updateCards() {
        const d = calc();
        if (dashE) dashE.innerText = d.E_photon.toFixed(2);
        if (dashPhi) dashPhi.innerText = d.phi.toFixed(2);
        if (dashK) dashK.innerText = d.K_max.toFixed(2);
        if (dashVs) dashVs.innerText = d.V_stop.toFixed(2);
        if (dashI) dashI.innerText = d.current.toFixed(1);
    }

    // ==========================================================================
    // E. Chart.js I-V 曲線
    // ==========================================================================
    const chartContainer = document.getElementById('chartContainer');
    let ivChart = null;

    if (chartContainer) {
        chartContainer.style.display = 'block';
        const origTitle = chartContainer.querySelector('.pane-meta-title');
        if (origTitle) origTitle.style.display = 'none';
        const origWrapper = chartContainer.querySelector('.chart-wrapper');
        if (origWrapper) origWrapper.style.display = 'none';

        chartContainer.insertAdjacentHTML('beforeend', `
            <div class="pane-meta-title" style="margin-top: 30px; margin-bottom: 10px;">// I-V CHARACTERISTIC</div>
            <div class="chart-wrapper"><canvas id="ivChart"></canvas></div>
        `);

        setTimeout(() => {
            const canvasEl = document.getElementById('ivChart');
            if (!canvasEl) return;
            ivChart = new Chart(canvasEl, {
                type: 'scatter',
                data: {
                    datasets: [
                        { label: 'I-V 曲線', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', pointRadius: 0, showLine: true, borderWidth: 2, fill: true },
                        { label: '目前狀態', data: [], borderColor: '#dc2626', backgroundColor: '#dc2626', pointRadius: 6, showLine: false }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, animation: false,
                    scales: {
                        x: { type: 'linear', title: { display: true, text: '逆向電壓 V_s (V)', font: { family: 'monospace', weight: '700' } }, min: 0, max: 5.5, ticks: { font: { family: 'monospace' } } },
                        y: { title: { display: true, text: '光電流 I (μA)', font: { family: 'monospace', weight: '700' } }, min: 0, ticks: { font: { family: 'monospace' } } }
                    },
                    plugins: { legend: { labels: { font: { family: 'monospace' } } } }
                }
            });
            updateIVChart();
        }, 50);
    }

    function updateIVChart() {
        if (!ivChart) return;
        const d = calc();
        const points = [];
        const maxI = intensity * 0.8;
        for (let v = 0; v <= 5.5; v += 0.1) {
            points.push({ x: v, y: (v < d.V_stop) ? maxI : 0 });
        }
        ivChart.data.datasets[0].data = points;
        ivChart.data.datasets[1].data = [{ x: retardingV, y: d.current }];
        ivChart.options.scales.y.max = Math.max(maxI * 1.2, 1);
        ivChart.update('none');
    }

    // ==========================================================================
    // F. Canvas 渲染 - 仿真實驗室
    // ==========================================================================
    const guardEl = document.getElementById('fSlider');
    let lastTimestamp = performance.now();
    let animationFrameId;

    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ---- 繪圖輔助 ----

    function drawMetalGradient(c, x, y, w, h, baseColor, isHighlight) {
        const grad = c.createLinearGradient(x, y, x, y + h);
        if (isHighlight) {
            grad.addColorStop(0, '#e8ecf0');
            grad.addColorStop(0.3, '#d0d4d8');
            grad.addColorStop(0.7, '#b8bcc0');
            grad.addColorStop(1, '#a0a4a8');
        } else {
            grad.addColorStop(0, '#4a5568');
            grad.addColorStop(0.3, '#3a4558');
            grad.addColorStop(0.7, '#2d3748');
            grad.addColorStop(1, '#1a202c');
        }
        c.fillStyle = grad;
        c.beginPath();
        c.roundRect(x, y, w, h, 3);
        c.fill();
    }

    function drawScrew(c, x, y) {
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fillStyle = '#718096';
        c.fill();
        c.strokeStyle = '#4a5568';
        c.lineWidth = 0.5;
        c.stroke();
        c.beginPath();
        c.moveTo(x - 2, y);
        c.lineTo(x + 2, y);
        c.strokeStyle = '#4a5568';
        c.lineWidth = 0.8;
        c.stroke();
    }

    function drawLED(c, x, y, text, color) {
        c.fillStyle = '#1a1a2e';
        c.beginPath();
        c.roundRect(x - 28, y - 10, 56, 20, 2);
        c.fill();
        c.strokeStyle = '#0d0d1a';
        c.lineWidth = 1;
        c.stroke();
        c.font = '700 11px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = color || '#00ff88';
        c.fillText(text, x, y);
    }

    // ---- 元件繪製 ----

    function drawTableSurface(c, W, H) {
        // 深色防靜電桌面
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1a1d23');
        grad.addColorStop(0.5, '#14161a');
        grad.addColorStop(1, '#0f1114');
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);

        // 桌面紋理（細微格線）
        c.strokeStyle = 'rgba(255,255,255,0.015)';
        c.lineWidth = 0.5;
        for (let x = 0; x < W; x += 40) {
            c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
        }
        for (let y = 0; y < H; y += 40) {
            c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
        }
    }

    function drawLightSource(c, x, y, w, h) {
        // 主機身
        drawMetalGradient(c, x, y, w, h, '#4a5568', false);

        // 機身標籤
        c.font = '700 9px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#a0aec0';
        c.fillText('MONOCHROMATOR', x + w / 2, y + 12);

        // 濾光輪（旋轉圓盤）
        const wheelX = x + w * 0.7;
        const wheelY = y + h * 0.5;
        const wheelR = h * 0.25;
        c.beginPath();
        c.arc(wheelX, wheelY, wheelR, 0, Math.PI * 2);
        c.fillStyle = '#2d3748';
        c.fill();
        c.strokeStyle = '#718096';
        c.lineWidth = 1.5;
        c.stroke();

        // 濾光輪上的顏色扇區
        const colors = ['#dc2626', '#ea580c', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + simTime * 0.3;
            c.beginPath();
            c.moveTo(wheelX, wheelY);
            c.arc(wheelX, wheelY, wheelR - 2, angle, angle + Math.PI / 3);
            c.closePath();
            c.fillStyle = colors[i];
            c.globalAlpha = 0.6;
            c.fill();
            c.globalAlpha = 1;
        }

        // LED 數位顯示屏
        const wl = freqToWavelength(frequency);
        drawLED(c, x + w * 0.35, y + h * 0.3, wl.toFixed(0) + ' nm', '#00ccff');
        drawLED(c, x + w * 0.35, y + h * 0.65, frequency + ' THz', '#00ff88');

        // 螺絲
        drawScrew(c, x + 8, y + 8);
        drawScrew(c, x + w - 8, y + 8);
        drawScrew(c, x + 8, y + h - 8);
        drawScrew(c, x + w - 8, y + h - 8);

        // 出光口
        const apertureX = x + w;
        const apertureY = y + h * 0.5;
        c.fillStyle = '#0d0d0d';
        c.beginPath();
        c.roundRect(apertureX, apertureY - 8, 12, 16, 2);
        c.fill();
        c.strokeStyle = '#718096';
        c.lineWidth = 1;
        c.stroke();
    }

    function drawLightBeam(c, x1, y, x2, intensity) {
        const col = freqToColor(frequency);
        const alpha = 0.15 + intensity * 0.04;

        // 外層光暈
        const grad = c.createLinearGradient(x1, y - 20, x1, y + 20);
        grad.addColorStop(0, `rgba(${col.r}, ${col.g}, ${col.b}, 0)`);
        grad.addColorStop(0.3, `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.3})`);
        grad.addColorStop(0.5, `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`);
        grad.addColorStop(0.7, `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.3})`);
        grad.addColorStop(1, `rgba(${col.r}, ${col.g}, ${col.b}, 0)`);
        c.fillStyle = grad;
        c.fillRect(x1, y - 20, x2 - x1, 40);

        // 核心光束
        c.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 1.5})`;
        c.fillRect(x1, y - 3, x2 - x1, 6);

        // 光束中的粒子感
        if (isRunning) {
            for (let i = 0; i < intensity * 2; i++) {
                const px = x1 + Math.random() * (x2 - x1);
                const py = y + (Math.random() - 0.5) * 8;
                c.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${0.3 + Math.random() * 0.4})`;
                c.beginPath();
                c.arc(px, py, 1 + Math.random(), 0, Math.PI * 2);
                c.fill();
            }
        }
    }

    function drawPhototube(c, x, y, w, h) {
        // 金屬支架
        drawMetalGradient(c, x - 8, y - h / 2 - 10, w + 16, 10, '#4a5568', false);
        drawMetalGradient(c, x - 8, y + h / 2, w + 16, 10, '#4a5568', false);

        // 玻璃管身
        const glassGrad = c.createLinearGradient(x, y - h / 2, x, y + h / 2);
        glassGrad.addColorStop(0, 'rgba(200, 220, 240, 0.15)');
        glassGrad.addColorStop(0.3, 'rgba(200, 220, 240, 0.08)');
        glassGrad.addColorStop(0.5, 'rgba(200, 220, 240, 0.05)');
        glassGrad.addColorStop(0.7, 'rgba(200, 220, 240, 0.08)');
        glassGrad.addColorStop(1, 'rgba(200, 220, 240, 0.15)');
        c.fillStyle = glassGrad;
        c.beginPath();
        c.roundRect(x, y - h / 2, w, h, h / 2);
        c.fill();

        // 玻璃邊框
        c.strokeStyle = 'rgba(160, 180, 200, 0.4)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.roundRect(x, y - h / 2, w, h, h / 2);
        c.stroke();

        // 玻璃反光
        c.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 10, y - h / 2 + 5);
        c.lineTo(x + w - 10, y - h / 2 + 5);
        c.stroke();

        // 陰極板（左側）
        const metal = metals[metalKey];
        const cathodeX = x + w * 0.2;
        const cathodeW = 8;
        const cathodeGrad = c.createLinearGradient(cathodeX, y - h * 0.35, cathodeX, y + h * 0.35);
        cathodeGrad.addColorStop(0, metal.surface);
        cathodeGrad.addColorStop(0.5, metal.color);
        cathodeGrad.addColorStop(1, metal.surface);
        c.fillStyle = cathodeGrad;
        c.fillRect(cathodeX, y - h * 0.35, cathodeW, h * 0.7);
        c.strokeStyle = '#475569';
        c.lineWidth = 1;
        c.strokeRect(cathodeX, y - h * 0.35, cathodeW, h * 0.7);

        // 陽極（右側金屬網）
        const anodeX = x + w * 0.75;
        c.strokeStyle = '#94a3b8';
        c.lineWidth = 1;
        for (let i = -h * 0.3; i <= h * 0.3; i += 4) {
            c.beginPath();
            c.moveTo(anodeX, y + i);
            c.lineTo(anodeX + 3, y + i);
            c.stroke();
        }

        // 標籤
        c.font = '600 8px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#94a3b8';
        c.fillText('陰極', cathodeX + cathodeW / 2, y + h / 2 + 18);
        c.fillText('陽極', anodeX + 1, y + h / 2 + 18);

        // 真空管標示
        c.font = '600 8px monospace';
        c.fillStyle = '#64748b';
        c.fillText('VACUUM PHOTOTUBE', x + w / 2, y - h / 2 - 16);

        return { cathodeX: cathodeX + cathodeW, anodeX: anodeX, tubeY: y, tubeH: h };
    }

    function drawGalvanometer(c, x, y, w, h, current) {
        // 外殼
        drawMetalGradient(c, x, y, w, h, '#2d3748', false);

        // 面板
        c.fillStyle = '#0f1118';
        c.beginPath();
        c.roundRect(x + 6, y + 6, w - 12, h - 20, 3);
        c.fill();

        // 指針刻度背景
        const meterX = x + w / 2;
        const meterY = y + h * 0.4;
        const meterR = Math.min(w, h) * 0.28;

        // 刻度弧線
        c.strokeStyle = '#2d3748';
        c.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const angle = Math.PI + (i / 10) * Math.PI;
            const inner = meterR - 6;
            const outer = meterR + (i % 5 === 0 ? 6 : 3);
            c.beginPath();
            c.moveTo(meterX + Math.cos(angle) * inner, meterY + Math.sin(angle) * inner);
            c.lineTo(meterX + Math.cos(angle) * outer, meterY + Math.sin(angle) * outer);
            c.stroke();
        }

        // 指針
        const needleAngle = Math.PI + (Math.min(current, 50) / 50) * Math.PI;
        c.strokeStyle = '#ef4444';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(meterX, meterY);
        c.lineTo(meterX + Math.cos(needleAngle) * (meterR - 4), meterY + Math.sin(needleAngle) * (meterR - 4));
        c.stroke();

        // 中心軸
        c.beginPath();
        c.arc(meterX, meterY, 3, 0, Math.PI * 2);
        c.fillStyle = '#718096';
        c.fill();

        // 數位顯示
        drawLED(c, x + w / 2, y + h - 14, current.toFixed(1) + ' μA', current > 0 ? '#00ff88' : '#ff4444');

        // 標籤
        c.font = '700 8px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#a0aec0';
        c.fillText('GALVANOMETER', x + w / 2, y + 14);
        c.fillText('0-50 μA', x + w / 2, y + 24);

        drawScrew(c, x + 8, y + 8);
        drawScrew(c, x + w - 8, y + 8);
    }

    function drawPowerSupply(c, x, y, w, h, voltage) {
        // 外殼
        drawMetalGradient(c, x, y, w, h, '#2d3748', false);

        // 電壓顯示
        drawLED(c, x + w / 2, y + h * 0.3, voltage.toFixed(1) + ' V', '#ff6644');

        // 旋鈕
        const knobX = x + w / 2;
        const knobY = y + h * 0.65;
        const knobR = 14;
        c.beginPath();
        c.arc(knobX, knobY, knobR, 0, Math.PI * 2);
        const knobGrad = c.createRadialGradient(knobX - 3, knobY - 3, 1, knobX, knobY, knobR);
        knobGrad.addColorStop(0, '#718096');
        knobGrad.addColorStop(1, '#2d3748');
        c.fillStyle = knobGrad;
        c.fill();
        c.strokeStyle = '#4a5568';
        c.lineWidth = 1.5;
        c.stroke();

        // 旋鈕指示線
        const knobAngle = -Math.PI / 2 + (voltage / 5) * Math.PI;
        c.strokeStyle = '#e2e8f0';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(knobX, knobY);
        c.lineTo(knobX + Math.cos(knobAngle) * (knobR - 4), knobY + Math.sin(knobAngle) * (knobR - 4));
        c.stroke();

        // 標籤
        c.font = '700 8px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#a0aec0';
        c.fillText('DC POWER SUPPLY', x + w / 2, y + 14);
        c.fillText('REVERSE BIAS', x + w / 2, y + h - 8);

        drawScrew(c, x + 8, y + 8);
        drawScrew(c, x + w - 8, y + 8);
    }

    function drawSpectrumBar(c, x, y, w, h) {
        // 背景
        c.fillStyle = '#0a0a12';
        c.beginPath();
        c.roundRect(x, y, w, h, 4);
        c.fill();
        c.strokeStyle = '#2d3748';
        c.lineWidth = 1;
        c.stroke();

        // 光譜條
        const specX = x + 10;
        const specW = w - 20;
        const specH = h * 0.4;
        const specY = y + 8;

        // 可見光光譜
        for (let i = 0; i < specW; i++) {
            const f = 380 + (i / specW) * 370; // 380-750 THz
            const col = freqToColor(f);
            c.fillStyle = `rgb(${col.r}, ${col.g}, ${col.b})`;
            c.fillRect(specX + i, specY, 1, specH);
        }

        // 目前頻率指示器
        const posX = specX + ((frequency - 380) / 370) * specW;
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(posX, specY + specH + 2);
        c.lineTo(posX - 4, specY + specH + 8);
        c.lineTo(posX + 4, specY + specH + 8);
        c.closePath();
        c.fill();

        // 波長標示
        const wl = freqToWavelength(frequency);
        c.font = '700 10px monospace';
        c.textAlign = 'center';
        c.fillStyle = '#e2e8f0';
        c.fillText(wl.toFixed(0) + ' nm', x + w / 2, y + h - 8);
    }

    function drawInfoBox(c, x, y, d) {
        // 半透明資訊框
        c.fillStyle = 'rgba(15, 17, 24, 0.85)';
        c.beginPath();
        c.roundRect(x, y, 130, 70, 6);
        c.fill();
        c.strokeStyle = 'rgba(37, 99, 235, 0.3)';
        c.lineWidth = 1;
        c.stroke();

        c.font = '600 9px monospace';
        c.textAlign = 'left';
        c.fillStyle = '#94a3b8';
        c.fillText('φ = ' + d.phi.toFixed(2) + ' eV', x + 10, y + 16);
        c.fillText('f₀ = ' + Math.round(d.f0) + ' THz', x + 10, y + 30);

        c.fillStyle = d.canEmit ? '#22c55e' : '#ef4444';
        c.fillText('K_max = ' + d.K_max.toFixed(2) + ' eV', x + 10, y + 44);

        c.fillStyle = '#3b82f6';
        c.fillText('V_stop = ' + d.V_stop.toFixed(2) + ' V', x + 10, y + 58);
    }

    function drawWiring(c, points, color) {
        c.strokeStyle = color || '#dc2626';
        c.lineWidth = 1.5;
        c.setLineDash([]);
        c.beginPath();
        c.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            c.lineTo(points[i].x, points[i].y);
        }
        c.stroke();
    }

    // ---- 光子與電子 ----

    function spawnPhoton(cathodeX, tubeY, tubeH) {
        const col = freqToColor(frequency);
        const y = tubeY + (Math.random() - 0.5) * tubeH * 0.5;
        return { x: 60, y: y, vx: 200 + Math.random() * 30, color: col, alive: true };
    }

    function updatePhotons(dt, cathodeX, tubeY, tubeH) {
        const spawnRate = intensity * 3;
        if (isRunning && Math.random() < spawnRate * dt) {
            photons.push(spawnPhoton(cathodeX, tubeY, tubeH));
        }
        for (let i = photons.length - 1; i >= 0; i--) {
            const p = photons[i];
            p.x += p.vx * dt;
            if (p.x >= cathodeX - 5) {
                const d = calc();
                if (d.canEmit && Math.random() < 0.6) {
                    const speed = 50 + d.K_max * 35;
                    electrons.push({
                        x: cathodeX + 5, y: p.y,
                        vx: speed, vy: (Math.random() - 0.5) * 20,
                        alive: true, age: 0
                    });
                }
                p.alive = false;
            }
            if (p.x > cathodeX + 20) p.alive = false;
        }
        photons = photons.filter(p => p.alive);
    }

    function drawPhotons(c) {
        for (const p of photons) {
            const { r, g, b } = p.color;
            const glow = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, 8);
            glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
            glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            c.fillStyle = glow;
            c.beginPath();
            c.arc(p.x, p.y, 8, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = `rgb(${r}, ${g}, ${b})`;
            c.beginPath();
            c.arc(p.x, p.y, 3, 0, Math.PI * 2);
            c.fill();
        }
    }

    function updateElectrons(dt, anodeX, cathodeX) {
        const d = calc();
        const decel = retardingV > 0 ? retardingV * 35 : 0;
        for (let i = electrons.length - 1; i >= 0; i--) {
            const e = electrons[i];
            e.age += dt;
            if (retardingV > 0 && e.vx > 0) {
                e.vx -= decel * dt;
                if (e.vx <= 0) e.vx = -30;
            }
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            if (e.x >= anodeX) e.alive = false;
            if (e.x < cathodeX - 20) e.alive = false;
            if (e.age > 5) e.alive = false;
        }
        electrons = electrons.filter(e => e.alive);
    }

    function drawElectrons(c) {
        for (const e of electrons) {
            const glowR = 7 + Math.sin(simTime * 5 + e.y) * 1.5;
            const glow = c.createRadialGradient(e.x, e.y, 1, e.x, e.y, glowR);
            glow.addColorStop(0, 'rgba(37, 99, 235, 0.5)');
            glow.addColorStop(0.5, 'rgba(37, 99, 235, 0.15)');
            glow.addColorStop(1, 'rgba(37, 99, 235, 0)');
            c.fillStyle = glow;
            c.beginPath();
            c.arc(e.x, e.y, glowR, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#2563eb';
            c.beginPath();
            c.arc(e.x, e.y, 3.5, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = 'rgba(255,255,255,0.5)';
            c.beginPath();
            c.arc(e.x - 1, e.y - 1, 1.2, 0, Math.PI * 2);
            c.fill();
        }
    }

    // ---- 主迴路 ----

    function loop(ts) {
        if (!document.contains(guardEl)) return;
        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;
        if (isRunning) simTime += dt;

        PhysicsUtils.beginFrame(ctx, canvas);
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const d = calc();

        // ---- 佈局 ----
        const tableY = H * 0.05;

        // 光源
        const srcX = W * 0.03;
        const srcY = tableY + H * 0.18;
        const srcW = W * 0.20;
        const srcH = H * 0.16;

        // 光束
        const beamY = srcY + srcH / 2;
        const beamStart = srcX + srcW + 12;

        // 光電管
        const tubeX = W * 0.38;
        const tubeY = beamY;
        const tubeW = W * 0.30;
        const tubeH = H * 0.14;

        // 光譜顯示器
        const specX = tubeX + tubeW * 0.1;
        const specY = tableY + H * 0.02;
        const specW = tubeW * 0.8;
        const specH = H * 0.10;

        // 電流計
        const galvX = W * 0.03;
        const galvY = tableY + H * 0.58;
        const galvW = W * 0.18;
        const galvH = H * 0.18;

        // 電源
        const pwrX = W * 0.03;
        const pwrY = galvY + galvH + H * 0.04;
        const pwrW = W * 0.18;
        const pwrH = H * 0.14;

        // 資訊框
        const infoX = W * 0.72;
        const infoY = tableY + H * 0.04;

        // ---- 繪製 ----

        // 桌面
        drawTableSurface(ctx, W, H);

        // 光源
        drawLightSource(ctx, srcX, srcY, srcW, srcH);

        // 光譜顯示器
        drawSpectrumBar(ctx, specX, specY, specW, specH);

        // 光束
        const beamEnd = tubeX + tubeW * 0.2;
        drawLightBeam(ctx, beamStart, beamY, beamEnd, intensity);

        // 光電管
        const tube = drawPhototube(ctx, tubeX, tubeY, tubeW, tubeH);

        // 電流計
        drawGalvanometer(ctx, galvX, galvY, galvW, galvH, d.current);

        // 電源
        drawPowerSupply(ctx, pwrX, pwrY, pwrW, pwrH, retardingV);

        // 資訊框
        drawInfoBox(ctx, infoX, infoY, d);

        // 接線（紅色=陽極，黑色=陰極）
        const anodeContactX = tubeX + tubeW * 0.78;
        const cathodeContactX = tubeX + tubeW * 0.18;
        drawWiring(ctx, [
            { x: anodeContactX, y: tubeY + tubeH / 2 + 10 },
            { x: anodeContactX, y: galvY + galvH / 2 },
            { x: galvX + galvW, y: galvY + galvH / 2 }
        ], '#dc2626');
        drawWiring(ctx, [
            { x: cathodeContactX, y: tubeY + tubeH / 2 + 10 },
            { x: cathodeContactX, y: pwrY + pwrH / 2 },
            { x: pwrX + pwrW, y: pwrY + pwrH / 2 }
        ], '#1e293b');

        // 接線標籤
        ctx.font = '500 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#dc2626';
        ctx.fillText('陽極接線', (anodeContactX + galvX + galvW) / 2, galvY + galvH / 2 - 6);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('陰極接線', (cathodeContactX + pwrX + pwrW) / 2, pwrY + pwrH / 2 - 6);

        // 更新和繪製粒子
        if (isRunning) {
            updatePhotons(dt, tube.cathodeX, tube.tubeY, tube.tubeH);
            updateElectrons(dt, tube.anodeX, tube.cathodeX);
        }
        drawPhotons(ctx);
        drawElectrons(ctx);

        // 截止頻率警告
        if (!d.canEmit) {
            ctx.font = '700 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ef4444';
            ctx.fillText('⚠ f < f₀ = ' + Math.round(d.f0) + ' THz — 無光電效應', W / 2, tableY + H * 0.52);
        }

        updateCards();
        animationFrameId = requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initPhotoelectricEffect();
