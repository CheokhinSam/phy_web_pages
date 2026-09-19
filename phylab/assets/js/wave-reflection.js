// 水波反射虛擬實驗核心 JavaScript (支援 0° 正向入射 + 平面/圓形波切換 + 完美裁剪)
function initWaveReflectionSimulation() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // 1. 核心物理參數
    let incidentAngleDeg = 30; // 入射角 (度) - 現在支援 0 度了！
    let wavelength = 30;       // 波長 λ (cm)
    let waveSpeed = 80;        // 波速 v (cm/s)
    let waveType = 'plane';    // 波形類型: 'plane' 或 'circular'
    let isPaused = false;
    let showWavefronts = true; // 是否顯示波前線條

    // 2. 動態注入控制面板 (滑桿 min 改為 0)
    if (ctrlPanel) {
        ctrlPanel.style.maxHeight = 'calc(100vh - 120px)';
        ctrlPanel.style.overflowY = 'auto';
        ctrlPanel.style.display = 'flex';
        ctrlPanel.style.flexDirection = 'column';
        ctrlPanel.style.gap = '12px';
        ctrlPanel.style.paddingRight = '8px';

        ctrlPanel.innerHTML = `
            <div class="control-group" style="margin: 0;">
                <label style="font-weight: 700;">波形類型 / WAVE TYPE</label>
                <select id="waveTypeSelect" style="width:100%; padding: 6px; font-weight: 700; border: 2px solid #000000; background: #ffffff; cursor: pointer; font-size: 0.85rem;">
                    <option value="plane" selected>平面波 (Plane Wave)</option>
                    <option value="circular">圓形波 (Circular Wave)</option>
                </select>
            </div>
            <div class="control-group" style="margin: 0;">
                <label>入射角 $\\theta_i$: <span id="iAngleVal">30</span>°</label>
                <input type="range" id="angleSlider" min="0" max="75" step="1" value="30" style="width:100%;">
            </div>
            <div class="control-group" style="margin: 0;">
                <label>水波波長 $\\lambda$: <span id="lambdaVal">30</span> cm</label>
                <input type="range" id="lambdaSlider" min="20" max="60" step="1" value="30" style="width:100%;">
            </div>
            <div class="control-group" style="margin: 0;">
                <label>波傳播速度 $v$: <span id="vVal">80</span> cm/s</label>
                <input type="range" id="vSlider" min="40" max="150" step="5" value="80" style="width:100%;">
            </div>
            <div class="control-group" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="wavefrontCheck" checked style="width: 16px; height: 16px; cursor: pointer;">
                <label for="wavefrontCheck" style="margin: 0; cursor: pointer; font-size: 0.9rem;">顯示獨立波前 (Wavefronts)</label>
            </div>
            <div class="control-group" style="margin: 0; display: flex; gap: 8px;">
                <button id="pauseBtn" style="flex: 1; padding: 8px; background: #000000; color: #ffffff; border: none; font-weight: 700; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">暫停 / PAUSE</button>
                <button id="resetBtn" style="flex: 1; padding: 8px; background: #ffffff; color: #000000; border: 1px solid #000000; font-weight: 700; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;">重設 / RESET</button>
            </div>
            
            <div class="control-group" style="margin-top: auto; border-top: 2px solid #000000; padding-top: 10px; background: #ffffff;">
                <label style="margin-bottom: 2px; color: #64748b; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">LAW OF REFLECTION / 反射定律</label>
                <div style="font-size: 1.3rem; font-weight: 900; font-family: Cambria, serif; color: #000000; margin-bottom: 4px;">$$\\theta_i = \\theta_r$$</div>
                <label style="font-size: 0.85rem; color: #1e293b; display: block;">當前反射角 $\\theta_r = $ <span id="rAngleVal" style="font-family: monospace; font-weight: 900; color: #ea580c;">30</span>°</label>
            </div>
        `;

        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset([ctrlPanel]);
        }

        const waveTypeSelect = document.getElementById('waveTypeSelect');
        const angleSlider = document.getElementById('angleSlider');
        const lambdaSlider = document.getElementById('lambdaSlider');
        const vSlider = document.getElementById('vSlider');
        const wavefrontCheck = document.getElementById('wavefrontCheck');
        const pauseBtn = document.getElementById('pauseBtn');

        function updateParams() {
            waveType = waveTypeSelect.value;
            incidentAngleDeg = parseFloat(angleSlider.value);
            wavelength = parseFloat(lambdaSlider.value);
            waveSpeed = parseFloat(vSlider.value);
            showWavefronts = wavefrontCheck.checked;

            document.getElementById('iAngleVal').innerText = incidentAngleDeg;
            document.getElementById('rAngleVal').innerText = incidentAngleDeg;
            document.getElementById('lambdaVal').innerText = wavelength;
            document.getElementById('vVal').innerText = waveSpeed;
        }

        waveTypeSelect.addEventListener('change', updateParams);
        angleSlider.addEventListener('input', updateParams);
        lambdaSlider.addEventListener('input', updateParams);
        vSlider.addEventListener('input', updateParams);
        wavefrontCheck.addEventListener('change', updateParams);
        
        pauseBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            pauseBtn.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
            pauseBtn.style.background = isPaused ? "#2563eb" : "#000000";
        });

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            simTime = 0;
            isPaused = false;
            pauseBtn.innerText = "暫停 / PAUSE";
            pauseBtn.style.background = "#000000";
        });

        updateParams();
    }

    // 迴圈 guard：快取 DOM 節點，避免每幀查詢
    const guardEl = ctrlPanel;

    // 3. Canvas 自適應
    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;

    // 數據卡片。這一頁原本完全沒有即時數據——角度只能靠畫面上兩個小字讀，
    // 波長、頻率、波前跑到哪了全都看不到。θᵢ = θᵣ 是這一頁的主角，
    // 所以讓兩個角度並排放在最上面，數字一樣這件事用眼睛比對就好。
    const updateCards = PhysicsUtils.createDataCards([
        { label: '入射角 ΘI',   id: 'cardThetaI',  unit: '°',   highlight: true },
        { label: '反射角 ΘR',   id: 'cardThetaR',  unit: '°',   highlight: true },
        { label: '波長 Λ',      id: 'cardLambda',  unit: 'cm' },
        { label: '波速 V',      id: 'cardV',       unit: 'cm/s' },
        { label: '頻率 F = V/Λ', id: 'cardF',      unit: 'Hz' },
        { label: '入射波前進距離', id: 'cardIncD', unit: 'cm' },
        { label: '反射波前進距離', id: 'cardRefD', unit: 'cm' },
    ]);

    function drawArrow(x1, y1, x2, y2, color, thickness = 2) {
        const headLength = 10;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = thickness;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
        ctx.fill();
    }

    // 4. 渲染主循環
    function loop(currentTimestamp) {
        if (!document.contains(guardEl)) return;

        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.1) dt = 0.1;
        if (!isPaused) simTime += dt;

        PhysicsUtils.beginFrame(ctx, canvas);

        // 水面拉高到 0.80：原本 0.75 讓畫面下方四分之一的畫布是空的
        // （水面底下只放得下兩行標籤），射線本身的長度卻被上方的空間綁住。
        const surfaceY = canvas.cssHeight * 0.80;
        const incX = canvas.cssWidth / 2;
        const incY = surfaceY;

        const rad = (incidentAngleDeg * Math.PI) / 180;

        // 射線長度：上限一個來自高度（入射點下面還要留水面），一個來自寬度
        // （角度大的時候射線會往左右掃出去）。
        // ⚠️ 原本寫死 `min(W/2 − 40, surfaceY − 40)`——W/2 − 40 在 30° 這個
        //    預設角度只用到畫面高度的一半多一點，畫面上方三分之一全是空的。
        //    真正的寬度限制是「水平分量 ≤ 半個畫面寬」，所以要除以 sin θ，
        //    不是直接拿半寬當上限。sin 0 用 0.12 夾住，免得 0° 時除以零。
        const rayLength = Math.min(surfaceY - 60,
            (canvas.cssWidth / 2 - 60) / Math.max(Math.sin(rad), 0.12));

        // 計算幾何射線的端點
        const startX = incX - rayLength * Math.sin(rad);
        const startY = incY - rayLength * Math.cos(rad);
        const endX = incX + rayLength * Math.sin(rad);
        const endY = incY - rayLength * Math.cos(rad);

        // ==========================================
        // 🟢 畫布裁剪：完美切齊撞牆線條
        // ==========================================
        if (showWavefronts) {
            ctx.save(); 
            ctx.beginPath();
            ctx.rect(0, 0, canvas.cssWidth, surfaceY); 
            ctx.clip(); 

            let travelDist = simTime * waveSpeed;

            if (waveType === 'plane') {
                // 【平面波模式】
                const wWidth = 120; // 稍微加寬確保 0 度時覆蓋全寬
                let incOffset = travelDist % wavelength;
                ctx.strokeStyle = '#2563eb'; 
                ctx.lineWidth = 2.5;
                for (let d = incOffset; d < rayLength + wWidth; d += wavelength) {
                    let pX = startX + d * Math.sin(rad);
                    let pY = startY + d * Math.cos(rad);
                    ctx.beginPath();
                    ctx.moveTo(pX - wWidth * Math.cos(rad), pY + wWidth * Math.sin(rad));
                    ctx.lineTo(pX + wWidth * Math.cos(rad), pY - wWidth * Math.sin(rad));
                    ctx.stroke();
                }

                let refOffset = (travelDist - rayLength) % wavelength;
                if (refOffset < 0) refOffset += wavelength;
                ctx.strokeStyle = '#ea580c'; 
                for (let d = refOffset - wWidth; d < rayLength; d += wavelength) {
                    let pX = incX + d * Math.sin(rad);
                    let pY = incY - d * Math.cos(rad);
                    ctx.beginPath();
                    ctx.moveTo(pX - wWidth * Math.cos(rad), pY - wWidth * Math.sin(rad));
                    ctx.lineTo(pX + wWidth * Math.cos(rad), pY + wWidth * Math.sin(rad));
                    ctx.stroke();
                }

            } else if (waveType === 'circular') {
                // 【圓形波模式】
                let maxR = Math.max(canvas.cssWidth, canvas.cssHeight) * 1.5;
                let baseOffset = travelDist % wavelength;

                // 1. 入射圓形波 (以波源為中心)
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2.5;
                for (let r = baseOffset; r < maxR; r += wavelength) {
                    ctx.beginPath();
                    ctx.arc(startX, startY, r, 0, 2 * Math.PI);
                    ctx.stroke();
                }

                // 2. 反射圓形波 (虛擬鏡像源)
                const imageSourceX = startX;
                const imageSourceY = 2 * surfaceY - startY; 
                const distToWall = surfaceY - startY;       

                ctx.strokeStyle = '#ea580c';
                for (let r = baseOffset; r < maxR; r += wavelength) {
                    if (r > distToWall) {
                        ctx.beginPath();
                        ctx.arc(imageSourceX, imageSourceY, r, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                }
            }

            ctx.restore(); 
        }

        // ==========================================
        // 🟢 介面與幾何線條繪製
        // ==========================================
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(40, surfaceY); ctx.lineTo(canvas.cssWidth - 40, surfaceY); ctx.stroke();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        for (let x = 45; x < canvas.cssWidth - 40; x += 15) {
            ctx.beginPath(); ctx.moveTo(x, surfaceY); ctx.lineTo(x - 8, surfaceY + 12); ctx.stroke();
        }
        ctx.fillStyle = '#64748b';
        ctx.font = '700 12px "Inter", sans-serif';
        ctx.fillText("REFLECTING SURFACE / 固定反射界面", 50, surfaceY + 28);

        // 繪製法線 (當角度為 0 時，虛線會被箭頭覆蓋，因此微調層次)
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(incX, surfaceY - rayLength - 20); ctx.lineTo(incX, surfaceY + 10); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#64748b';
        ctx.font = '500 11px "Inter", sans-serif';
        ctx.fillText("法線 (Normal)", incX - 35, surfaceY - rayLength - 25);

        // 繪製幾何箭頭 (0度時，兩線重合，做輕微的水平偏移以利學生看清兩根箭頭)
        if (incidentAngleDeg === 0) {
            drawArrow(startX - 4, startY, incX - 4, incY, '#2563eb', 2.5); // 入射藍線左移 4px
            drawArrow(incX + 4, incY, endX + 4, endY, '#ea580c', 2.5);   // 反射橘線右移 4px
        } else {
            drawArrow(startX, startY, incX, incY, '#2563eb', 2.5);
            drawArrow(incX, incY, endX, endY, '#ea580c', 2.5);
        }

        // 射線名稱：入射端點的文字往左長（右對齊），反射端點往右長（左對齊）。
        // 原本兩邊都寫死一個向左的偏移量，小角度時 startX ≈ endX，兩行字
        // 就疊在同一個位置；改成各自往畫面外側展開，不管角度多小都不會撞。
        // ⚠️ 端點現在貼近畫布邊緣（見上面 rayLength），往外的文字會被切掉，
        //    所以要夾回畫布裡。
        ctx.font = '700 13px "Inter", sans-serif';
        const PAD = 10;
        const tInc = incidentAngleDeg === 0 ? 'Incident Ray' : 'Incident Ray (入射波線)';
        const tRef = incidentAngleDeg === 0 ? 'Reflected Ray' : 'Reflected Ray (反射波線)';
        const dy = incidentAngleDeg === 0 ? 20 : 4;
        // 圓形波模式時端點落在同心圓裡面，純文字會被波前線蓋掉，所以要底色。
        const rayLabel = (text, x, y, align, color) => {
            const w = ctx.measureText(text).width;
            const left = align === 'right' ? x - w : x;
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillRect(left - 5, y - 14, w + 10, 20);
            ctx.textAlign = align;
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
        };
        rayLabel(tInc,
            Math.max(startX - 12, PAD + ctx.measureText(tInc).width), startY + dy, 'right', '#2563eb');
        rayLabel(tRef,
            Math.min(endX + 12, canvas.cssWidth - PAD - ctx.measureText(tRef).width), endY + dy, 'left', '#ea580c');
        ctx.textAlign = 'left';

        // 角度弧線標註 (大於 2 度才顯示，避免 0 度時字體重疊)
        // ⚠️ 兩個標籤原本半徑都是 45，而且都再往左扣 10 px。角度小的時候
        //    cos(1.5π ± rad/2) 幾乎相等，θᵢ 和 θᵣ 兩行字就直接疊在一起。
        //    改成不同半徑（內圈 θᵢ、外圈 θᵣ），就算角度是 0 也差 26 px。
        if (incidentAngleDeg > 2) {
            const R_I = 30, R_R = 74;

            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(incX, incY, R_I, 1.5 * Math.PI - rad, 1.5 * Math.PI); ctx.stroke();

            ctx.strokeStyle = '#ea580c';
            ctx.beginPath(); ctx.arc(incX, incY, R_R, 1.5 * Math.PI, 1.5 * Math.PI + rad); ctx.stroke();

            // 兩個角度標籤正好落在波前的交會處，純文字會被線條切得看不清，
            // 所以先鋪一塊底色（同 drawTitleBar 的作法）。θᵢ 在內圈、θᵣ 在外圈。
            const label = (text, R, angle, color) => {
                const x = incX + R * Math.cos(angle);
                const y = incY + R * Math.sin(angle);
                ctx.font = '700 13px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const w = ctx.measureText(text).width;
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.fillRect(x - w / 2 - 4, y - 9, w + 8, 18);
                ctx.fillStyle = color;
                ctx.fillText(text, x, y);
            };
            label(`θi=${incidentAngleDeg}°`, R_I, 1.5 * Math.PI - rad / 2, '#2563eb');
            label(`θr=${incidentAngleDeg}°`, R_R, 1.5 * Math.PI + rad / 2, '#ea580c');
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }

        // 更新數據卡片（θᵢ = θᵣ 是這一頁的主角，兩張並排放在最上面）
        updateCards({
            cardThetaI: incidentAngleDeg.toFixed(0),
            cardThetaR: incidentAngleDeg.toFixed(0),
            cardLambda: wavelength.toFixed(0),
            cardV:      waveSpeed.toFixed(0),
            cardF:      (waveSpeed / wavelength).toFixed(2),
            cardIncD:   (simTime * waveSpeed).toFixed(0),
            cardRefD:   Math.max(0, simTime * waveSpeed - rayLength).toFixed(0),
        });

        animationFrameId = requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);
}

initWaveReflectionSimulation();