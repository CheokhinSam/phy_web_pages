// 斜拋的座標尺：純函式，Node 可讀（見 verify-projectile.js ⑳）。
//
// ⚠️ 公尺 → 像素只有一把尺，而且它跟著參數走。預設值（30 m/s、30°、15 m）
//    的射程是 100.1 m：固定 8 px/m 的舊寫法讓球在 861 px 處落地，而 1600 px
//    視窗的畫布只有 804 px 寬（1100 px 視窗更只有 450 px）——球會在落地前
//    飛出畫布右緣，而 errs=0、卡片數字全對、圖也在跳，只有截圖看得出來。
//    所以 fitScale() 依參數算出「整條彈道（含最高點）塞得進畫布」的尺度，
//    上限仍是原本的 8 px/m。
var ProjectileKit = (function () {
    const G = 9.81;
    const MAX_SCALE = 8;      // px/m 上限＝舊版的固定值
    const PAD_RIGHT = 80;     // 落地點右側留白（px）：球的半徑＋落地那一刻的紅色向量（預設 65 px）
    const PAD_TOP = 30;       // 最高點上方留白（px）
    const MIN_MAJOR_PX = 32;  // 主格線的像素下限（再小就把學生數格子用的尺糊掉）
    const MIN_MINOR_PX = 6;   // 副刻度的像素下限
    const GRID_STEPS = [1, 2, 5, 10, 20, 50, 100];
    const START_X = 60;       // 發射點的 x（y 尺的豎線就是發射柱的延長線）
    const GROUND_INSET = 60;  // 地面離畫布底緣的高度（下面留給 x 尺）
    const BALL_R = 8;         // 球的半徑（畫球與「停在地面上」共用）
    const DOT_R = 5.5;        // 閃光點的半徑上限（跟水平拋射同一顆）
    const DOT_MIN = 2.2;      // 閃光點的半徑下限（還看得出是一顆點）

    // 對照球那一條鉛直線的 x：**一定要在發射柱左邊，而且要在高度尺的數字
    // 左邊**。彈道的 x 恆 ≥ START_X（v₀cosθ ≥ 0，θ = 90° 時剛好貼著柱子），
    // 右邊任何位置球都會穿過去，所以只剩左邊。而左邊被兩樣東西佔滿：數字
    // 右對齊在 START_X − 16 = 44、3 位數約 21 px 寬（最高到 167 m），佔
    // [23, 44]；刻度線從 48 伸到 60。中間沒有 16 px 寬的走道，所以 13 是
    // 唯一兩邊都空的位子：13 ± 8 = [5, 21]，離畫布左緣 5 px、離數字帶 2 px。
    const TWIN_X = 13;

    // 落地時間：h₀ 以上自由落下＋初速的豎直分量。
    // 這是落地時間唯一的一個家——模擬迴圈呼叫它、驗證器拿獨立積分對照它。
    function flightTime(v0, angleRad, h0) {
        const vy = v0 * Math.sin(angleRad);
        return (vy + Math.sqrt(vy * vy + 2 * G * h0)) / G;
    }

    function landingDistance(v0, angleRad, h0) {
        return v0 * Math.cos(angleRad) * flightTime(v0, angleRad, h0);
    }

    // 最高高度：向上的初速分量用完就到了（往下射的話最高點就是發射點）。
    function apexHeight(v0, angleRad, h0) {
        const vy = v0 * Math.sin(angleRad);
        return vy > 0 ? h0 + (vy * vy) / (2 * G) : h0;
    }

    // 一個像素代表幾公尺：讓落地點與最高點都落進畫布，上限 MAX_SCALE。
    function fitScale(cssWidth, startX, startY, range_m, apex_m) {
        const fitX = (cssWidth - PAD_RIGHT - startX) / Math.max(range_m, 1e-6);
        const fitY = (startY - PAD_TOP) / Math.max(apex_m, 1e-6);
        const s = Math.min(MAX_SCALE, fitX, fitY);
        return (isFinite(s) && s > 0) ? s : MAX_SCALE;
    }

    // 格距：主格（含數字）挑 1/2/5/10/20/50/100 m 裡第一個 ≥ MIN_MAJOR_PX 的階；
    // 副刻度是主格的五分之一，小於 MIN_MINOR_PX 就只留主格。
    function gridStepFor(pxPerM) {
        let major = GRID_STEPS[GRID_STEPS.length - 1];
        for (let i = 0; i < GRID_STEPS.length; i++) {
            if (GRID_STEPS[i] * pxPerM >= MIN_MAJOR_PX) { major = GRID_STEPS[i]; break; }
        }
        const minor = (major % 5 === 0 && (major / 5) * pxPerM >= MIN_MINOR_PX) ? major / 5 : major;
        return { major: major, minor: minor };
    }

    // 三個速度標籤的版面：純幾何，先到先贏。
    //
    // ⚠️ 箭尖錨定的標籤在最高點附近一定會撞在一起：那裡的 vy ≈ 0，合速度
    //    就是水平分量，紅色與綠色箭頭的尖端是同一個點，兩個方塊疊在同一個
    //    地方（只有截圖看得出來——卡片數字、爆框計數全部正常）。所以每一顆
    //    標籤都給一組候選位，依序挑第一個「不撞到已放好的、也不撞到球、
    //    不越過地面尺」的；四個候選位都塞不下就不畫那一顆（極端參數的降級）。
    function placeVelocityLabels(o) {
        const s = o.arrowScale;
        const endX = o.ballX + o.vx * s;      // 紅色箭尖
        const endY = o.ballY - o.vy * s;
        const hxEnd = endX;                   // 綠色箭尖（同 x）
        const vyEnd = endY;                   // 紫色箭尖（同 y）
        const placed = [{ x: o.ballX - 10, y: o.ballY - 10, w: 20, h: 20 }]; // 球自己
        const fits = b => b.x >= 6 && b.x + b.w <= o.W - 6 &&
                          b.y >= 6 && b.y + b.h <= o.groundY - 3;
        const free = b => fits(b) && !placed.some(p =>
            b.x < p.x + p.w && p.x < b.x + b.w && b.y < p.y + p.h && p.y < b.y + b.h);
        const put = (cands, box) => {
            for (const c of cands) {
                const b = { x: c[0], y: c[1], w: box.w, h: box.h };
                if (free(b)) { placed.push(b); return b; }
            }
            return null;
        };
        const vW = o.boxes.v.w, vxW = o.boxes.vx.w, vyW = o.boxes.vy.w;
        const v = put([[endX + 5, endY - 22], [endX - vW - 15, endY - 22],
                       [endX + 5, endY + 2], [endX - vW - 15, endY + 2]], o.boxes.v);
        const vxOut = o.vx >= 0 ? hxEnd + 6 : hxEnd - vxW - 6;   // 箭尖外側
        const vxIn = o.vx >= 0 ? hxEnd - vxW - 6 : hxEnd + 6;    // 往回（疊在箭上）
        const vx = put([[vxOut, o.ballY - 22], [vxOut, o.ballY + 4],
                        [vxIn, o.ballY - 22], [vxIn, o.ballY + 4],
                        [o.ballX - vxW - 18, o.ballY - 22]], o.boxes.vx);
        const vyTip = o.vy > 0 ? vyEnd - 18 : vyEnd - 2;
        const vyAlt = o.vy > 0 ? vyEnd + 2 : vyEnd - 18;
        const vy = put([[o.ballX + 12, vyTip], [o.ballX - vyW - 12, vyTip],
                        [o.ballX + 12, vyAlt], [o.ballX - vyW - 12, vyAlt]], o.boxes.vy);
        return { v: v, vx: vx, vy: vy };
    }

    // 這一刻在哪裡（公尺）。t 先夾進 [0, T]——落地之後球就停在終點，軌跡的
    // 「走過的那一段」也停在整條曲線的終點，不會繞到地面下面再爬回來。
    // **位置只有這一個家**：球、閃光點、對照球、地上那顆投影圈全部問它。
    function positionAt(v0, angleRad, h0, t) {
        const T = flightTime(v0, angleRad, h0);
        const tc = t < 0 ? 0 : (t > T ? T : t);
        const vy = v0 * Math.sin(angleRad);
        const y = h0 + vy * tc - 0.5 * G * tc * tc;
        return { t: tc, T: T, x: v0 * Math.cos(angleRad) * tc, y: y > 0 ? y : 0 };
    }

    // 閃光時刻（不含 t = 0，那是發射的那一刻）：第 k 顆**正好**是 k·dt，
    // 不是累加出來的 t += dt——浮點累加在 dt = 0.2／0.3 會漂掉最後一位
    // （實測 1.2000000000000002 vs 1.2），而 dt = 0.25 剛好是二進位精確值、
    // 完全看不出來（README 陷阱十八）。這一支和水平拋射的 strobeTimes()
    // 是同一個合約：這份清單就是「等時距」這四個字的定義，畫面只能照它畫。
    function strobeTimes(T, dt) {
        const out = [];
        for (let k = 1; k * dt <= T + 1e-9; k++) out.push(k * dt);
        return out;
    }

    // 畫面要畫的那一份清單（含 t = 0 那一顆：發射的閃光）。每一顆都自帶
    // 座標，頁面不准自己再算一份軌跡。
    function strobeDots(v0, angleRad, h0, dt) {
        const T = flightTime(v0, angleRad, h0);
        const out = [positionAt(v0, angleRad, h0, 0)];
        for (const ts of strobeTimes(T, dt)) out.push(positionAt(v0, angleRad, h0, ts));
        return out;
    }

    // 公尺 → 畫布像素（兩軸共用同一把尺）。畫面上每一個座標都走這裡：
    // 球、軌跡、閃光點、對照球、投影圈，一個都不准自己再算一次。
    function toPx(x_m, y_m, pxPerM, startX, startY) {
        return { x: startX + x_m * pxPerM, y: startY - y_m * pxPerM };
    }

    // 「踩在地上」：球心最低只到地面往上一個半徑（球是踩在地上的，不是陷進去
    // 的）。半徑由呼叫者給——閃光點用自己縮小後的那一個，不是球的半徑。
    function restOnGround(yPx, groundY, r) {
        return Math.min(yPx, groundY - r);
    }

    // 軌跡的取樣點（公尺）。整條彈道與「走過的那一段」的差別只有 tEnd 與
    // 取樣點數這兩個參數：整條是 (T, 90)、走過的是 (simTime, 依長度縮放)。
    function samplePath(v0, angleRad, h0, tEnd, n) {
        const steps = Math.max(1, Math.round(n));
        const out = [];
        for (let i = 0; i <= steps; i++) {
            const q = positionAt(v0, angleRad, h0, tEnd * i / steps);
            out.push({ x: q.x, y: q.y });
        }
        return out;
    }

    // 畫面上相鄰兩顆閃光點的最小間距（px）。閃光點的半徑由它決定：θ = 90°
    // 的垂直上拋在最高點附近，相鄰兩顆的高度差只有 ½gΔt²——v₀ = 10、Δt = 0.2、
    // 8 px/m 時是 1.3 px，全尺寸（r = 5.5）當場糊成一團，而那正是這一頁要
    // 學生數的東西。只有一顆（T < Δt）時回 Infinity。
    function minStrobeGap(v0, angleRad, h0, dt, pxPerM) {
        const d = strobeDots(v0, angleRad, h0, dt);
        let min = Infinity;
        for (let i = 1; i < d.length; i++) {
            const dx = (d[i].x - d[i - 1].x) * pxPerM;
            const dy = (d[i].y - d[i - 1].y) * pxPerM;
            const g = Math.sqrt(dx * dx + dy * dy);
            if (g < min) min = g;
        }
        return min;
    }

    // 閃光點的半徑：兩個上限取小的——(1) 顆數（最長的飛行 10.9 s 配最短的
    // 間隔會到 54 顆），(2) 最小間距的 45%（最高點附近兩顆擠在一起）。
    // 下限 2.2 px 還看得出是一顆點；上限就是 DOT_R，**不會被放大**。
    function dotRadius(count, minGapPx) {
        const byCount = DOT_R * Math.sqrt(12 / Math.max(count, 1));
        const byGap = 0.45 * minGapPx;
        return Math.max(DOT_MIN, Math.min(DOT_R, byCount, byGap));
    }

    // 三種模式各畫什麼——這是**規格**，不是能從程式碼推出來的性質：每一個
    // 旗標都要有一條指名道姓的斷言守著（README 陷阱十八）。軌跡、走過的那
    // 一段、對照球在三個模式都畫；三個模式各自是**一種讀法**：
    //   完整    速度箭頭（球上的那一組）
    //   閃光點  沒有速度箭頭，換來等時距格線（數間距用的）
    //   分解    沒有閃光點，換來地面投影圈（看兩個方向各自的一維運動）
    const MODE_LIST = [
        { id: 'full',   label: '完整' },
        { id: 'dots',   label: '只看閃光點' },
        { id: 'decomp', label: '只看分解' }
    ];
    const MODE_SPEC = {
        full:   { path: true, travelled: true, strobe: true,  strobeGrid: false, twin: true, projection: false, arrows: true },
        dots:   { path: true, travelled: true, strobe: true,  strobeGrid: true,  twin: true, projection: false, arrows: false },
        decomp: { path: true, travelled: true, strobe: false, strobeGrid: false, twin: true, projection: true,  arrows: true }
    };
    function modeSpec(mode) { return MODE_SPEC[mode] || MODE_SPEC.full; }

    return {
        G: G, MAX_SCALE: MAX_SCALE, PAD_RIGHT: PAD_RIGHT, PAD_TOP: PAD_TOP,
        MIN_MAJOR_PX: MIN_MAJOR_PX, MIN_MINOR_PX: MIN_MINOR_PX,
        DOT_R: DOT_R, DOT_MIN: DOT_MIN, BALL_R: BALL_R,
        START_X: START_X, GROUND_INSET: GROUND_INSET, TWIN_X: TWIN_X,
        flightTime: flightTime, landingDistance: landingDistance,
        apexHeight: apexHeight, fitScale: fitScale, gridStepFor: gridStepFor,
        placeVelocityLabels: placeVelocityLabels,
        positionAt: positionAt, toPx: toPx, restOnGround: restOnGround,
        samplePath: samplePath, strobeTimes: strobeTimes, strobeDots: strobeDots,
        minStrobeGap: minStrobeGap, dotRadius: dotRadius,
        modeSpec: modeSpec, MODE_LIST: MODE_LIST
    };
})();

function initProjectile() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return; 
    const ctx = canvas.getContext('2d');
    
    const ctrlPanel = document.getElementById('controlPanel');

// 1. 動態注入左側操作面板（已修正 Flex 佈局下的文字與單位間距）
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>初速度 <i>v</i>₀</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vVal" style="color: #2563eb;">30</span> m/s
                    </span>
                </label>
                <input type="range" id="vSlider" min="10" max="50" value="30">
            </div>
            <div class="control-box">
                <label>
                    <span>發射角度 <i>θ</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">30</span>°
                    </span>
                </label>
                <input type="range" id="aSlider" min="-60" max="90" value="30">
            </div>
            <div class="control-box">
                <label>
                    <span>初始高度 <i>h</i>₀</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="hVal" style="color: #2563eb;">15</span> m
                    </span>
                </label>
                <input type="range" id="hSlider" min="0" max="40" value="15">
            </div>
            <div class="control-box">
                <label>
                    <span>畫面模式</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="viewVal" style="color: #2563eb;">完整</span>
                    </span>
                </label>
                <select id="viewSel" style="width: 100%; padding: 8px; font-size: 0.9rem; font-weight: 700; border: 1px solid #000; background: #fff; cursor: pointer;">
                    <option value="full">完整（軌跡＋閃光點＋對照球）</option>
                    <option value="dots">只看閃光點（加畫等時距格線）</option>
                    <option value="decomp">只看分解（加畫地面投影）</option>
                </select>
            </div>
            <div class="control-box" id="strobeBox">
                <label>
                    <span>閃光間隔 Δt</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="sVal" style="color: #ea580c;">0.50</span> s
                    </span>
                </label>
                <input type="range" id="sSlider" min="0.2" max="1" step="0.05" value="0.5">
            </div>
            <div class="control-box" style="gap: 10px;">
                <button id="fireBtn">發射 / FIRE</button>
                <button id="pauseBtn" style="background-color: #ffffff; color: #000000; border: 1px solid #000000; margin-top: 10px;">暫停 / PAUSE</button>
                <button id="rstBtn" style="background-color: #ffffff; color: #000000; border: 1px solid #000000; margin-top: 10px;">重設 / RESET</button>
            </div>
        `;
    }

    // 💡 2. 開啟並初始化右側 Chart.js 圖表 (此實驗有圖表)
    const chartContainer = document.getElementById('chartContainer');
    const chartCtx = document.getElementById('realtimeChart');
    let myChart = null;
    let vxChart = null;
    let vyChart = null;

    if (chartContainer && chartCtx) {
        chartContainer.style.display = 'block'; // 顯示圖表區

        // 高度-時間圖
        myChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '高度 y (m)',
                    data: [],
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '時間 (s)', font: { weight: 'bold' } }, grid: { display: false } },
                    y: { title: { display: true, text: '高度 y (m)', font: { weight: 'bold' } }, min: 0 }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 動態建立 vx-t 和 vy-t 圖表容器 + 放大按鈕（最下方）
        let extraChartsHTML = `
            <div style="margin-top: 30px; margin-bottom: 10px;">
                <div class="pane-meta-title">// VELOCITY GRAPH</div>
            </div>
            <div class="chart-wrapper">
                <canvas id="vxChart"></canvas>
            </div>
            <div class="chart-wrapper" style="margin-top: 20px;">
                <canvas id="vyChart"></canvas>
            </div>
            <button id="zoomChartBtn" style="display: block; width: 100%; margin-top: 20px; padding: 10px; background: #000000; color: #ffffff; border: none; font-weight: 700; font-size: 0.85rem; cursor: pointer; letter-spacing: 1px;">放大圖表 / EXPAND</button>
        `;
        chartContainer.insertAdjacentHTML('beforeend', extraChartsHTML);

        // 放大/縮小圖表
        let isExpanded = false;
        document.getElementById('zoomChartBtn').addEventListener('click', () => {
            isExpanded = !isExpanded;
            let btn = document.getElementById('zoomChartBtn');
            let wrappers = chartContainer.querySelectorAll('.chart-wrapper');
            if (isExpanded) {
                btn.innerText = '縮小圖表 / COLLAPSE';
                chartContainer.style.position = 'fixed';
                chartContainer.style.top = '0';
                chartContainer.style.left = '0';
                chartContainer.style.width = '100vw';
                chartContainer.style.height = '100vh';
                chartContainer.style.zIndex = '9999';
                chartContainer.style.background = '#ffffff';
                chartContainer.style.padding = '30px';
                chartContainer.style.overflow = 'auto';
                wrappers.forEach(w => w.style.height = '40vh');
            } else {
                btn.innerText = '放大圖表 / EXPAND';
                chartContainer.style.position = '';
                chartContainer.style.top = '';
                chartContainer.style.left = '';
                chartContainer.style.width = '';
                chartContainer.style.height = '';
                chartContainer.style.zIndex = '';
                chartContainer.style.background = '';
                chartContainer.style.padding = '';
                chartContainer.style.overflow = '';
                wrappers.forEach(w => w.style.height = '');
            }
            // 重繪圖表以適應新尺寸
            setTimeout(() => {
                if (myChart) myChart.resize();
                if (vxChart) vxChart.resize();
                if (vyChart) vyChart.resize();
            }, 100);
        });

        // 水平速度-時間圖
        vxChart = new Chart(document.getElementById('vxChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'vx (m/s)',
                    data: [],
                    borderColor: '#22c55e',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '時間 (s)', font: { weight: 'bold' } }, grid: { display: false } },
                    y: { title: { display: true, text: 'vx (m/s)', font: { weight: 'bold', color: '#22c55e' } } }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 垂直速度-時間圖
        vyChart = new Chart(document.getElementById('vyChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'vy (m/s)',
                    data: [],
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: '時間 (s)', font: { weight: 'bold' } }, grid: { display: false } },
                    y: { title: { display: true, text: 'vy (m/s)', font: { weight: 'bold', color: '#8b5cf6' } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    const resizeCanvas = PhysicsUtils.setupResize(canvas);
    window.addEventListener('resize', () => { resetSim(); });

    const vSlider = document.getElementById('vSlider');
    const aSlider = document.getElementById('aSlider');
    const hSlider = document.getElementById('hSlider');
    const vVal = document.getElementById('vVal');
    const aVal = document.getElementById('aVal');
    const hVal = document.getElementById('hVal');
    const viewSel = document.getElementById('viewSel');
    const viewVal = document.getElementById('viewVal');
    const sSlider = document.getElementById('sSlider');
    const sVal = document.getElementById('sVal');
    const strobeBox = document.getElementById('strobeBox');
    const fireBtn = document.getElementById('fireBtn');
    const rstBtn = document.getElementById('rstBtn');

    // 三個滑桿都重設：v 與 θ 會改變射程，尺度（格線與彈道共用的那把尺）跟著改，
    // 畫面才不會停在上一組參數的格子裡。
    if (vSlider) vSlider.oninput = () => { vVal.innerText = vSlider.value; resetSim(); };
    if (aSlider) aSlider.oninput = () => { aVal.innerText = aSlider.value; resetSim(); };
    if (hSlider) hSlider.oninput = () => { hVal.innerText = hSlider.value; resetSim(); };

    const g = ProjectileKit.G;
    let meterToPixel = ProjectileKit.MAX_SCALE;   // 唯一寫入點是 applyScale()
    let simTime = 0;
    let initV = 0;
    let initH = 0;
    let angleRad = 0;
    let isMoving = false;
    let isPaused = false;

    let peakHeight_m = 0;
    let currentX_m = 0;
    let currentY_m = 0;

    const BALL_R = ProjectileKit.BALL_R;
    const startX_px = ProjectileKit.START_X;
    let startY_px = canvas.cssHeight - ProjectileKit.GROUND_INSET;
    // 軌跡不再是逐幀累積的點陣列（`path` 已經拿掉）：整條彈道是解析的，
    // 畫的時候才從 ProjectileKit.positionAt 取樣。走過的長度＝simTime。
    let mode = 'full';
    let strobeDt = 0.5;
    // 上一幀畫在哪裡：rAF 迴圈落地後就停了，即時控制項（模式、閃光間隔）
    // 要自己把畫面重畫一次，靠的就是這一組。
    let lastFrame = { x: startX_px, y: startY_px, vx: 0, vy: 0 };
    let lastTimestamp = 0;
    let frameCount = 0;
    const maxChartPoints = 500;

    // 畫面模式與閃光間隔是**即時**控制項，不像三支滑桿會重設模擬——學生比對
    // 間距時最想看的就是同一條飛行中的彈道。它們只影響「畫什麼」，不影響物理。
    function syncVisibility() {
        // ⚠️ 收起來寫 `''` 不要寫 `'block'`：`.control-box` 是 display:flex
        if (strobeBox) strobeBox.style.display = ProjectileKit.modeSpec(mode).strobe ? '' : 'none';
        if (viewVal) {
            const m = ProjectileKit.MODE_LIST.filter(x => x.id === mode)[0];
            viewVal.innerText = m ? m.label : '完整';
        }
    }

    function redrawNow() {
        draw(lastFrame.x, lastFrame.y, lastFrame.vx, lastFrame.vy);
    }

    if (viewSel) viewSel.onchange = () => {
        mode = viewSel.value;
        syncVisibility();
        redrawNow();
    };
    if (sSlider) sSlider.oninput = () => {
        strobeDt = parseFloat(sSlider.value);
        if (sVal) sVal.innerText = strobeDt.toFixed(2);
        redrawNow();
    };

    // 注入專屬拋體運動的數據卡片
    const dataGrid = document.getElementById('dataCardsGrid');
    if (dataGrid) {
        dataGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(160px, 1fr))";
        dataGrid.innerHTML = `
            <div class="data-card">
                <span class="card-label">飛行時間 TIME</span>
                <div class="card-num-wrapper"><span id="cardTime" class="card-num">0.00</span><span class="card-unit">s</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">水平位置 POS_X</span>
                <div class="card-num-wrapper"><span id="cardX" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">當前高度 POS_Y</span>
                <div class="card-num-wrapper"><span id="cardY" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
            <div class="data-card">
                <span class="card-label">最高高度 MAX_H</span>
                <div class="card-num-wrapper"><span id="cardMaxH" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
            <div class="data-card highlight" style="grid-column: span 2;">
                <span class="card-label">最終水平射程 RANGE_R</span>
                <div class="card-num-wrapper"><span id="cardRange" class="card-num">0.00</span><span class="card-unit">m</span></div>
            </div>
        `;
    }

    const cardTime = document.getElementById('cardTime');
    const cardX = document.getElementById('cardX');
    const cardY = document.getElementById('cardY');
    const cardMaxH = document.getElementById('cardMaxH');
    const cardRange = document.getElementById('cardRange');

    function updateCards(t, x, y, hMax, r) {
        if (cardTime) cardTime.innerText = t.toFixed(2);
        if (cardX) cardX.innerText = x.toFixed(2);
        if (cardY) cardY.innerText = y.toFixed(2);
        if (cardMaxH) cardMaxH.innerText = hMax.toFixed(2);
        if (cardRange) cardRange.innerText = r.toFixed(2);
    }

    // 三個滑桿是唯一的使用者輸入：先讀它們，再把尺度調到整條彈道塞得進畫布。
    // （尺度只在重設與發射時算——飛行途中不能改，不然軌跡的像素會前後不一致。）
    function readInputs() {
        initV = parseFloat(vSlider.value);
        initH = parseFloat(hSlider.value);
        angleRad = parseFloat(aSlider.value) * Math.PI / 180;
    }

    function applyScale() {
        meterToPixel = ProjectileKit.fitScale(
            canvas.cssWidth, startX_px, startY_px,
            ProjectileKit.landingDistance(initV, angleRad, initH),
            ProjectileKit.apexHeight(initV, angleRad, initH));
    }

    function resetSim() {
        isMoving = false;
        isPaused = false;
        simTime = 0;
        startY_px = canvas.cssHeight - ProjectileKit.GROUND_INSET;
        readInputs();
        applyScale();
        syncVisibility();

        peakHeight_m = initH;
        currentX_m = 0;
        currentY_m = initH;
        
        updateCards(0, 0, initH, initH, 0);

        // 清空圖表數據
        if (myChart) {
            myChart.data.labels = [0];
            myChart.data.datasets[0].data = [initH];
            myChart.update();
        }
        if (vxChart) {
            vxChart.data.labels = [0];
            vxChart.data.datasets[0].data = [initV * Math.cos(angleRad)];
            vxChart.update();
        }
        if (vyChart) {
            vyChart.data.labels = [0];
            vyChart.data.datasets[0].data = [initV * Math.sin(angleRad)];
            vyChart.update();
        }

        // h₀ = 0 時球在地面上：球心抬高一個半徑，不然會半顆陷進尺裡
        const ballY_px = ProjectileKit.restOnGround(startY_px - (initH * meterToPixel), startY_px, BALL_R);
        lastFrame = { x: startX_px, y: ballY_px, vx: 0, vy: 0 };
        draw(startX_px, ballY_px, 0, 0);
    }

    function fire() {
        if (isMoving) return;
        simTime = 0;
        readInputs();
        applyScale();
        syncVisibility();
        isMoving = true;
        peakHeight_m = initH;

        if (myChart) {
            myChart.data.labels = [];
            myChart.data.datasets[0].data = [];
        }
        if (vxChart) {
            vxChart.data.labels = [];
            vxChart.data.datasets[0].data = [];
        }
        if (vyChart) {
            vyChart.data.labels = [];
            vyChart.data.datasets[0].data = [];
        }

        lastTimestamp = performance.now();
        animationFrameId = requestAnimationFrame(loop);
    }

    function loop(currentTimestamp) {
        if (!document.contains(guardEl)) return;
        if (!isMoving || isPaused) {
            animationFrameId = requestAnimationFrame(loop);
            return;
        }

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.1) dt = 0.1; 

        simTime += dt;

        // 位置只有一個家（ProjectileKit.positionAt）：球、走過的軌跡、閃光點、
        // 對照球、地面的投影圈全部走同一個函式，畫面不可能各算一份。
        // t 在 positionAt 裡就夾進 [0, T] 了，落地之後不會繞到地面下。
        const pos = ProjectileKit.positionAt(initV, angleRad, initH, simTime);
        currentX_m = pos.x;
        currentY_m = pos.y;

        if (currentY_m > peakHeight_m) peakHeight_m = currentY_m;

        const px = ProjectileKit.toPx(currentX_m, currentY_m, meterToPixel, startX_px, startY_px);
        const currentX_px = px.x;
        const currentY_px = px.y;

        // 落地：時間停在真正的落地時刻 T，不是「多跑了半個影格」的那個數字
        // ——卡片上的飛行時間才會和公式算出來的一模一樣（實測 3.87 → 3.85）。
        // 位置不用再調：positionAt 已經把 t 夾到 T，x 就是射程、y 就是 0。
        if (simTime >= pos.T) {
            simTime = pos.T;
            isMoving = false;
        }

        updateCards(simTime, currentX_m, currentY_m, peakHeight_m, isMoving ? 0 : currentX_m);

        // 💡 即時將數據推進 Chart.js 並更新圖表（每 10 幀更新一次）
        frameCount++;
        let tLabel = simTime.toFixed(2);
        let vxNow = initV * Math.cos(angleRad);
        let vyNow = initV * Math.sin(angleRad) - g * simTime;

        if (myChart) {
            myChart.data.labels.push(tLabel);
            myChart.data.datasets[0].data.push(currentY_m);
            if (myChart.data.labels.length > maxChartPoints) {
                myChart.data.labels.shift();
                myChart.data.datasets[0].data.shift();
            }
        }
        if (vxChart) {
            vxChart.data.labels.push(tLabel);
            vxChart.data.datasets[0].data.push(vxNow);
            if (vxChart.data.labels.length > maxChartPoints) {
                vxChart.data.labels.shift();
                vxChart.data.datasets[0].data.shift();
            }
        }
        if (vyChart) {
            vyChart.data.labels.push(tLabel);
            vyChart.data.datasets[0].data.push(vyNow);
            if (vyChart.data.labels.length > maxChartPoints) {
                vyChart.data.labels.shift();
                vyChart.data.datasets[0].data.shift();
            }
        }
        if (frameCount % 10 === 0) {
            if (myChart) myChart.update('none');
            if (vxChart) vxChart.update('none');
            if (vyChart) vyChart.update('none');
        }

        // 計算當前速度分量
        let vx = initV * Math.cos(angleRad);
        let vy = initV * Math.sin(angleRad) - g * simTime;

        // 落地的球停在「地面上」（球心抬高一個半徑），不然會壓到尺的刻度
        const ballY_px = ProjectileKit.restOnGround(currentY_px, startY_px, BALL_R);
        lastFrame = { x: currentX_px, y: ballY_px, vx: vx, vy: vy };
        draw(currentX_px, ballY_px, vx, vy);

        if (isMoving) animationFrameId = requestAnimationFrame(loop);
    }

    // 公尺格線與兩把尺：x 軸原點在發射點、y 軸原點在地面（跟平拋同一套語言）。
    // 飛行中要能直接讀出「現在多高、離發射點多遠」，所以格線畫在彈道底下。
    function drawGrid() {
        const W = canvas.cssWidth;
        const step = ProjectileKit.gridStepFor(meterToPixel);
        const majorPx = step.major * meterToPixel;
        const topY = 16;
        const MUTE = '#94a3b8';

        ctx.save();

        // 淡格線只畫主格距——副刻度只有尺上的小短線，不然畫面會糊成一片
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.30)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = Math.ceil(-startX_px / majorPx); startX_px + k * majorPx <= W; k++) {
            const x = startX_px + k * majorPx;
            if (x < 0.5) continue;
            ctx.moveTo(x, startY_px);
            ctx.lineTo(x, topY);
        }
        for (let y = startY_px - majorPx; y >= topY; y -= majorPx) {
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
        }
        ctx.stroke();

        // y 尺：豎線就是發射柱往上的延長線，刻度往左伸（不壓到彈道）
        ctx.strokeStyle = MUTE;
        ctx.fillStyle = MUTE;
        ctx.font = '600 12px "Inter", sans-serif';
        ctx.beginPath();
        ctx.moveTo(startX_px, startY_px);
        ctx.lineTo(startX_px, topY);
        ctx.stroke();
        ctx.beginPath();
        for (let m = step.minor; startY_px - m * meterToPixel >= topY; m += step.minor) {
            const y = startY_px - m * meterToPixel;
            ctx.moveTo(startX_px, y);
            ctx.lineTo(startX_px - (m % step.major === 0 ? 12 : 6), y);
        }
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        for (let m = step.major; startY_px - m * meterToPixel >= topY; m += step.major) {
            ctx.fillText(String(m), startX_px - 16, startY_px - m * meterToPixel - 4);
        }

        // x 尺：刻度往地面下伸，數字在下方（跟平拋一樣），單位接在最後一格後面
        ctx.beginPath();
        for (let m = step.minor; startX_px + m * meterToPixel <= W - 2; m += step.minor) {
            const x = startX_px + m * meterToPixel;
            ctx.moveTo(x, startY_px);
            ctx.lineTo(x, startY_px + (m % step.major === 0 ? 13 : 6));
        }
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        let lastMajor = 0;
        for (let m = step.major; startX_px + m * meterToPixel <= W - 16; m += step.major) {
            ctx.fillText(String(m), startX_px + m * meterToPixel, startY_px + 16);
            lastMajor = m;
        }
        if (lastMajor && startX_px + lastMajor * meterToPixel + 26 <= W) {
            ctx.textAlign = 'left';
            ctx.fillText('m', startX_px + lastMajor * meterToPixel + 8, startY_px + 16);
        }

        ctx.restore();
    }

    // 一顆速度標籤：深色底＋對應顏色的文字，位置由 ProjectileKit 排好
    // （槽位是 null 就不畫——極端參數下四個候選位都塞不下）。
    function drawVectorLabel(slot, text, color, font) {
        if (!slot) return;
        ctx.save();
        ctx.font = font;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(slot.x, slot.y, slot.w, slot.h, 3);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, slot.x + 5, slot.y + slot.h / 2);
        ctx.restore();
    }

    // 閃光點：等時距的殘影（含 t = 0 那一顆＝發射的那一刻）。時刻與座標全部
    // 來自 ProjectileKit，畫面不准自己再算一份軌跡；半徑也由 kit 依「顆數」
    // 與「螢幕上最小的那個間距」決定（θ = 90° 的上拋在最高點附近會擠在一起）。
    function drawStrobe() {
        const dots = ProjectileKit.strobeDots(initV, angleRad, initH, strobeDt);
        const shown = dots.filter(d => d.t <= simTime + 1e-9);
        if (!shown.length) return;
        const r = ProjectileKit.dotRadius(
            shown.length,
            ProjectileKit.minStrobeGap(initV, angleRad, initH, strobeDt, meterToPixel));
        const grid = ProjectileKit.modeSpec(mode).strobeGrid;

        ctx.save();
        if (grid) {
            // 等時距格線：每一顆拉一條水平（回高度尺，讀高度）與一條鉛直
            // （下到地面尺，讀水平位置）。鉛直的那些每一段都一樣寬——那就是
            // 「水平等速」；水平間距一段比一段大——那就是「豎直在加速」。
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            for (const d of shown) {
                const q = ProjectileKit.toPx(d.x, d.y, meterToPixel, startX_px, startY_px);
                const qy = ProjectileKit.restOnGround(q.y, startY_px, r);
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
                ctx.beginPath();
                ctx.moveTo(startX_px, qy);
                ctx.lineTo(q.x, qy);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(234, 88, 12, 0.5)';
                ctx.beginPath();
                ctx.moveTo(q.x, qy);
                ctx.lineTo(q.x, startY_px);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        for (const d of shown) {
            const q = ProjectileKit.toPx(d.x, d.y, meterToPixel, startX_px, startY_px);
            const qy = ProjectileKit.restOnGround(q.y, startY_px, r);
            ctx.beginPath();
            ctx.arc(q.x, qy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#ea580c';
            ctx.fill();
            // 太小的點不描白圈（會糊成一圈白）
            if (r >= 4) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke(); }
        }
        ctx.restore();
    }

    // 對照球：**三種模式都畫**。它從同一個高度、以同樣的豎直初速丟出去，
    // 所以任何一刻都和拋體同高（兩者的高度來自同一個 positionAt），也就
    // 同時落地。它證明的是「豎直方向自己走，和水平分量無關」——那條水平
    // 虛線就是這句話的圖。
    //
    // ⚠️ 它畫在 TWIN_X（發射柱**左邊**那一條窄走道，見 kit 的常數說明），
    //    不是在發射柱上：柱子是整張畫布最擠的一條線（尺的脊柱、刻度、h₀ 的
    //    角標全疊在上面），而且 θ = 90° 時彈道整個貼在柱子上——對照球畫在
    //    柱子上會整場和拋體重疊，那條水平虛線長度 0，「永遠同高」的證據當場
    //    消失；畫在左邊則連 θ = 90° 都看得出兩顆一起上下。
    function drawTwin(ballX) {
        const q = ProjectileKit.positionAt(initV, angleRad, initH, simTime);
        const p = ProjectileKit.toPx(q.x, q.y, meterToPixel, startX_px, startY_px);
        const twinY = ProjectileKit.restOnGround(p.y, startY_px, BALL_R);
        const launchY = ProjectileKit.restOnGround(startY_px - (initH * meterToPixel), startY_px, BALL_R);

        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.67)';
        // 鉛直那一條：從發射高度量到現在的高度（豎直分量的位移）
        ctx.beginPath();
        ctx.moveTo(ProjectileKit.TWIN_X, launchY);
        ctx.lineTo(ProjectileKit.TWIN_X, twinY);
        ctx.stroke();
        // 水平那一條：兩顆球永遠同高
        ctx.beginPath();
        ctx.moveTo(ProjectileKit.TWIN_X, twinY);
        ctx.lineTo(ballX, twinY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(ProjectileKit.TWIN_X, twinY, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // 「只看分解」多畫的那一顆：地面上的空心圈。它和拋體同時出發、沿地面
    // 等速前進，球永遠落在它的正上方——那條鉛直虛線的長度就是「現在多高」。
    function drawProjection(ballX, ballY) {
        const gy = startY_px - (BALL_R - 2);
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.6)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(ballX, gy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ballX, gy, BALL_R - 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function draw(ballX, ballY, vx, vy) {
        vx = vx || 0;
        vy = vy || 0;

        PhysicsUtils.beginFrame(ctx, canvas);
        drawGrid();
        ctx.beginPath();
        ctx.moveTo(0, startY_px);
        ctx.lineTo(canvas.cssWidth, startY_px);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (initH > 0) {
            ctx.beginPath();
            ctx.moveTo(startX_px, startY_px);
            ctx.lineTo(startX_px, startY_px - (initH * meterToPixel));
            ctx.lineTo(0, startY_px - (initH * meterToPixel));
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // ── 彈道的兩層 ────────────────────────────────────────────────
        // 整條彈道先淡淡畫好（淺灰虛線，取樣自落地時刻 T）：還沒按發射就畫在
        // 那裡，可以先預測球會走到哪裡，再看著它沿著那條線走完。走過的那一段
        // 是實線（淺藍，取樣到 simTime），落地之後兩條完全重合。
        const spec = ProjectileKit.modeSpec(mode);
        const T = ProjectileKit.flightTime(initV, angleRad, initH);
        const tEnd = Math.min(Math.max(simTime, 0), T);

        if (spec.path && T > 0) {
            const pts = ProjectileKit.samplePath(initV, angleRad, initH, T, 90);
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const q = ProjectileKit.toPx(pts[i].x, pts[i].y, meterToPixel, startX_px, startY_px);
                if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
            }
            ctx.setLineDash([6, 5]);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.restore();
        }

        if (spec.travelled && T > 0 && tEnd > 1e-6) {
            const n = Math.max(2, Math.ceil(90 * tEnd / T));
            const pts = ProjectileKit.samplePath(initV, angleRad, initH, tEnd, n);
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const q = ProjectileKit.toPx(pts[i].x, pts[i].y, meterToPixel, startX_px, startY_px);
                if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
            }
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
        }

        if (spec.twin) drawTwin(ballX);
        if (spec.strobe) drawStrobe();
        if (spec.projection) drawProjection(ballX, ballY);

        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 速度向量箭頭（「只看閃光點」模式不畫：那個模式的讀法是數閃光點的間距）
        let speed = Math.sqrt(vx * vx + vy * vy);
        // 紅色（合速度）與紫色（豎直分量）的箭尖在落地那一刻都會插進地面、壓到
        // 尺的數字——插進地面就不畫（跟平拋的紫箭頭同一條規矩）。
        const vFits = (ballY - vy * 2.5) <= startY_px - 2;
        // 綠色水平分量也有畫不進去的時候：v₀ = 50、θ = 0 的箭長是 125 px，而
        // 落地點在 W − PAD_RIGHT（80），箭尖會飛出畫布右緣 45 px——PAD_RIGHT
        // 是照預設值（30 m/s → 65 px）編的。畫不進去就不畫，和紅／紫同一條規矩。
        const hFits = ballX + vx * 2.5 <= canvas.cssWidth - 4;
        if (spec.arrows && speed > 0.1) {
            let arrowScale = 2.5;
            let endX = ballX + vx * arrowScale;
            let endY = ballY - vy * arrowScale; // 注意 Y 軸反轉

            // 紅色箭頭：落地那一刻箭尖會插進地面，插進地面就不畫
            if (vFits) {
                ctx.save();
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 6;
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(ballX, ballY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // 箭頭尖端
                let angle = Math.atan2(-(vy * arrowScale), vx * arrowScale);
                let headLen = 12;
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // 速度數值標籤：先量三串字的寬度，再交給 ProjectileKit 排版
            // （先到先贏、後到的避開先放好的；最高點附近三個箭尖幾乎同一點）
            ctx.save();
            ctx.font = '700 14px "Inter", sans-serif';
            let vText = `v = ${speed.toFixed(1)} m/s`;
            let vW = ctx.measureText(vText).width;
            ctx.font = '700 13px "Inter", sans-serif';
            let vxText = `vx = ${Math.abs(vx).toFixed(1)}`;
            let vyText = `vy = ${Math.abs(vy).toFixed(1)}`;
            let vxW = ctx.measureText(vxText).width;
            let vyW = ctx.measureText(vyText).width;
            ctx.restore();
            const slots = ProjectileKit.placeVelocityLabels({
                ballX: ballX, ballY: ballY, vx: vx, vy: vy, arrowScale: 2.5,
                W: canvas.cssWidth, groundY: startY_px,
                boxes: { v: { w: vW + 10, h: 20 },
                         vx: { w: vxW + 10, h: 18 },
                         vy: { w: vyW + 10, h: 18 } }
            });
            // 三顆標籤最後才畫（見下面）：方塊是不透明的，畫在箭桿後面的是箭。

            // --- 水平分量箭頭 (vx) ---
            if (Math.abs(vx) > 0.1 && hFits) {
                let hxEnd = ballX + vx * arrowScale;
                ctx.save();
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(ballX, ballY);
                ctx.lineTo(hxEnd, ballY);
                ctx.stroke();
                ctx.setLineDash([]);

                // 尖端
                let hAngle = vx > 0 ? 0 : Math.PI;
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.moveTo(hxEnd, ballY);
                ctx.lineTo(hxEnd - 10 * Math.cos(hAngle - Math.PI / 6), ballY - 10 * Math.sin(hAngle - Math.PI / 6));
                ctx.lineTo(hxEnd - 10 * Math.cos(hAngle + Math.PI / 6), ballY - 10 * Math.sin(hAngle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // --- 垂直分量箭頭 (vy) ---
            // vFits：落地那一刻 v_y 最大、箭尖會插進地面壓到尺的數字——不畫。
            if (Math.abs(vy) > 0.1 && vFits) {
                let vyEnd = ballY - vy * arrowScale;
                ctx.save();
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(ballX, ballY);
                ctx.lineTo(ballX, vyEnd);
                ctx.stroke();
                ctx.setLineDash([]);

                // 尖端
                let vAngle = vy > 0 ? -Math.PI / 2 : Math.PI / 2;
                ctx.fillStyle = '#8b5cf6';
                ctx.beginPath();
                ctx.moveTo(ballX, vyEnd);
                ctx.lineTo(ballX - 10 * Math.cos(vAngle - Math.PI / 6), vyEnd - 10 * Math.sin(vAngle - Math.PI / 6));
                ctx.lineTo(ballX - 10 * Math.cos(vAngle + Math.PI / 6), vyEnd - 10 * Math.sin(vAngle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // 三顆標籤一起最後畫：只要箭桿穿過任何一顆方塊，先畫的一方就會被
            // 箭頭蓋掉字（紫箭頭穿過紅色標籤會蓋掉一位數字）。標籤畫在最後，
            // 箭桿就從不透明的方塊底下穿過去。
            if (vFits) drawVectorLabel(slots.v, vText, '#ef4444', '700 14px "Inter", sans-serif');
            if (Math.abs(vx) > 0.1 && hFits) drawVectorLabel(slots.vx, vxText, '#22c55e', '700 13px "Inter", sans-serif');
            if (Math.abs(vy) > 0.1 && vFits) drawVectorLabel(slots.vy, vyText, '#8b5cf6', '700 13px "Inter", sans-serif');
        }
    }

    if (fireBtn) fireBtn.onclick = fire;
    if (rstBtn) rstBtn.onclick = resetSim;

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.onclick = () => {
        if (!isMoving) return;
        isPaused = !isPaused;
        pauseBtn.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
        pauseBtn.style.backgroundColor = isPaused ? "#2563eb" : "#ffffff";
        pauseBtn.style.color = isPaused ? "#ffffff" : "#000000";
    };
    
    // 迴圈 guard：快取 DOM 節點，避免每幀查詢
    const guardEl = vSlider;

    resetSim();
}

if (typeof document !== 'undefined') initProjectile();