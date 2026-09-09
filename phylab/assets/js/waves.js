/**
 * 🌊 橫波與縱波對比 — 簡潔版
 * 上方：橫波（質點上下動）
 * 下方：縱波（質點左右動）
 */
function initWavesSimulation() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ===== 參數 =====
    let frequency = 1.5;
    let amplitude = 25;
    let waveSpeed = 150;
    let isPaused = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;

    // Canvas 表示的物理長度 (cm)
    const PHYSICAL_LENGTH = 300;

    // ===== 控制面板 =====
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label>
                    <span>頻率 <i>f</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="fVal" style="color: #2563eb;">1.5</span> Hz
                    </span>
                </label>
                <input type="range" id="fSlider" min="0.5" max="3.0" step="0.1" value="1.5">
            </div>
            <div class="control-box">
                <label>
                    <span>振幅 <i>A</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="aVal" style="color: #2563eb;">25</span> cm
                    </span>
                </label>
                <input type="range" id="aSlider" min="10" max="45" step="1" value="25">
            </div>
            <div class="control-box">
                <label>
                    <span>波速 <i>v</i></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vVal" style="color: #2563eb;">150</span> cm/s
                    </span>
                </label>
                <input type="range" id="vSlider" min="60" max="300" step="10" value="150">
            </div>
            <div class="control-box" style="display: flex; gap: 8px;">
                <button id="pauseBtn" style="flex: 1; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; font-size: 0.85rem; letter-spacing: 1px;">暫停 / PAUSE</button>
                <button id="resetBtn" style="flex: 1; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; font-size: 0.85rem; letter-spacing: 1px;">重設 / RESET</button>
            </div>
            <div class="control-box" style="margin-top: auto; border-top: 2px solid #000; padding-top: 12px; background: #fff;">
                <label style="margin-bottom: 4px; color: #64748b; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">WAVE FORMULA / 波動公式</label>
                <div style="font-size: 1.2rem; font-weight: 900; font-family: Cambria, serif; color: #000; margin-bottom: 6px;">$$v = f \\cdot \\lambda$$</div>
                <label style="font-size: 0.85rem; color: #1e293b; display: block;">波長 $\\lambda = $ <span id="lambdaVal" style="font-family: monospace; font-weight: 900; color: #2563eb;">100.0</span> cm</label>
            </div>
        `;

        if (window.MathJax && window.MathJax.typeset) window.MathJax.typeset([ctrlPanel]);

        const fSlider = document.getElementById('fSlider');
        const aSlider = document.getElementById('aSlider');
        const vSlider = document.getElementById('vSlider');

        function updateParams() {
            frequency = parseFloat(fSlider.value);
            amplitude = parseFloat(aSlider.value);
            waveSpeed = parseFloat(vSlider.value);
            document.getElementById('fVal').innerText = frequency.toFixed(1);
            document.getElementById('aVal').innerText = amplitude;
            document.getElementById('vVal').innerText = waveSpeed;
            document.getElementById('lambdaVal').innerText = (waveSpeed / frequency).toFixed(1);
        }

        fSlider.addEventListener('input', updateParams);
        aSlider.addEventListener('input', updateParams);
        vSlider.addEventListener('input', updateParams);

        document.getElementById('pauseBtn').addEventListener('click', function() {
            isPaused = !isPaused;
            this.innerText = isPaused ? "繼續 / RESUME" : "暫停 / PAUSE";
            this.style.backgroundColor = isPaused ? "#2563eb" : "#000000";
            if (!isPaused) {
                lastTimestamp = performance.now();
                requestAnimationFrame(loop);
            }
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            simTime = 0;
            isPaused = false;
            let pb = document.getElementById('pauseBtn');
            pb.innerText = "暫停 / PAUSE";
            pb.style.backgroundColor = "#000000";
        });

        updateParams();
    }

    // ===== Canvas =====
    const resizeCanvas = PhysicsUtils.setupResize(canvas);

    // ===== 繪圖 =====
    function drawArrow(x1, y1, x2, y2, color) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        let angle = Math.atan2(y2 - y1, x2 - x1);
        let headLen = 8;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
        ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
    }

    // 物理座標 → 像素 X
    function physToPixelX(physX, margin, waveW) {
        return margin + (physX / PHYSICAL_LENGTH) * waveW;
    }

    // 像素 X → 物理座標
    function pixelToPhysX(px, margin, waveW) {
        return ((px - margin) / waveW) * PHYSICAL_LENGTH;
    }

    function loop(currentTimestamp) {
        let dt = (currentTimestamp - lastTimestamp) / 1000;
        lastTimestamp = currentTimestamp;
        if (dt > 0.1) dt = 0.1;
        if (!isPaused) simTime += dt;

        PhysicsUtils.beginFrame(ctx, canvas);

        let lambda = waveSpeed / frequency;
        let k = (2 * Math.PI) / lambda;
        let omega = 2 * Math.PI * frequency;
        let margin = 50;
        let waveW = canvas.cssWidth - margin * 2;
        let numDots = 40;

        // 上下兩區
        let zoneH = canvas.cssHeight * 0.42;
        let transY = zoneH * 0.55;
        let longY = zoneH + zoneH * 0.55;
        let topGap = 60;

        // =============================================
        // 橫波（上方）
        // =============================================
        ctx.font = '800 14px "Inter", sans-serif';
        ctx.fillStyle = '#2563eb';
        ctx.textAlign = 'left';
        ctx.fillText('TRANSVERSE / 橫波', margin, 28);
        ctx.font = '500 11px "Inter", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('質點上下振動 ↕  垂直於波的傳播方向 →', margin, 44);

        // 基線
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(margin - 10, transY);
        ctx.lineTo(canvas.cssWidth - margin + 10, transY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 波傳播方向
        drawArrow(margin, topGap - 5, margin + 70, topGap - 5, '#94a3b8');
        ctx.font = '600 10px "Inter", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText('波速 v →', margin + 75, topGap - 1);

        // 波形曲線（用物理座標）
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let px = margin; px <= canvas.cssWidth - margin; px++) {
            let physX = pixelToPhysX(px, margin, waveW);
            let phase = omega * simTime - k * physX;
            let yVal = amplitude * Math.sin(phase);
            if (px === margin) ctx.moveTo(px, transY - yVal);
            else ctx.lineTo(px, transY - yVal);
        }
        ctx.stroke();

        // 質點
        let trackIdx = 8;
        for (let i = 0; i < numDots; i++) {
            let physX = (i / (numDots - 1)) * PHYSICAL_LENGTH;
            let px = physToPixelX(physX, margin, waveW);
            let phase = omega * simTime - k * physX;
            let disp = amplitude * Math.sin(phase);
            let py = transY - disp;

            if (i === trackIdx) {
                // 振動範圍線
                ctx.strokeStyle = 'rgba(234, 88, 12, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(px, transY - amplitude);
                ctx.lineTo(px, transY + amplitude);
                ctx.stroke();
                ctx.setLineDash([]);

                // 振動方向雙箭頭
                drawArrow(px, transY - amplitude + 5, px, transY - amplitude - 5, '#ea580c');
                drawArrow(px, transY + amplitude - 5, px, transY + amplitude + 5, '#ea580c');

                // 追蹤質點
                ctx.fillStyle = '#ea580c';
                ctx.beginPath();
                ctx.arc(px, py, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else {
                ctx.fillStyle = '#2563eb';
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 波長標註
        let lambdaPx = (lambda / PHYSICAL_LENGTH) * waveW;
        if (lambdaPx > 20 && margin + lambdaPx < canvas.cssWidth - margin) {
            let ly = transY + amplitude + 25;
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 1.5;
            ctx.fillStyle = '#2563eb';
            ctx.beginPath(); ctx.moveTo(margin, ly - 5); ctx.lineTo(margin, ly + 5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(margin + lambdaPx, ly - 5); ctx.lineTo(margin + lambdaPx, ly + 5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(margin, ly); ctx.lineTo(margin + lambdaPx, ly); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(margin, ly); ctx.lineTo(margin + 6, ly - 3); ctx.lineTo(margin + 6, ly + 3); ctx.fill();
            ctx.beginPath(); ctx.moveTo(margin + lambdaPx, ly); ctx.lineTo(margin + lambdaPx - 6, ly - 3); ctx.lineTo(margin + lambdaPx - 6, ly + 3); ctx.fill();
            ctx.font = '700 12px "Inter", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('λ = ' + lambda.toFixed(1) + ' cm', margin + lambdaPx / 2, ly - 10);
        }

        // =============================================
        // 縱波（下方）
        // =============================================
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, zoneH);
        ctx.lineTo(canvas.cssWidth - margin, zoneH);
        ctx.stroke();

        ctx.font = '800 14px "Inter", sans-serif';
        ctx.fillStyle = '#ea580c';
        ctx.textAlign = 'left';
        ctx.fillText('LONGITUDINAL / 縱波', margin, zoneH + 28);
        ctx.font = '500 11px "Inter", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('質點左右振動 ↔  平行於波的傳播方向 →', margin, zoneH + 44);

        // 基線
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(margin - 10, longY);
        ctx.lineTo(canvas.cssWidth - margin + 10, longY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 波傳播方向
        drawArrow(margin, zoneH + topGap - 5, margin + 70, zoneH + topGap - 5, '#94a3b8');
        ctx.font = '600 10px "Inter", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText('波速 v →', margin + 75, zoneH + topGap - 1);

        // 畫縱波質點
        let longDots = [];
        for (let i = 0; i < numDots; i++) {
            let physX = (i / (numDots - 1)) * PHYSICAL_LENGTH;
            let eqPx = physToPixelX(physX, margin, waveW);
            let phase = omega * simTime - k * physX;
            let disp = amplitude * 0.8 * Math.sin(phase);
            // 縱波：位移是水平的，轉換為像素
            let dispPx = (disp / PHYSICAL_LENGTH) * waveW;
            longDots.push({ eqPx: eqPx, x: eqPx + dispPx, physX: physX, phase: phase });
        }

        // 密部/疏部色帶
        for (let i = 0; i < longDots.length - 1; i++) {
            let d1 = longDots[i];
            let d2 = longDots[i + 1];
            let gap = d2.x - d1.x;
            let eqGapPx = (PHYSICAL_LENGTH / (numDots - 1) / PHYSICAL_LENGTH) * waveW;
            let density = 1 - gap / eqGapPx;
            let alpha = Math.max(0, Math.min(0.25, density * 0.25));
            ctx.fillStyle = `rgba(234, 88, 12, ${alpha})`;
            ctx.fillRect(d1.x, longY - 15, d2.x - d1.x, 30);
        }

        // 質點
        for (let i = 0; i < longDots.length; i++) {
            let d = longDots[i];

            if (i === trackIdx) {
                // 振動範圍線
                let halfRangePx = (amplitude * 0.8 / PHYSICAL_LENGTH) * waveW;
                ctx.strokeStyle = 'rgba(234, 88, 12, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(d.eqPx - halfRangePx, longY);
                ctx.lineTo(d.eqPx + halfRangePx, longY);
                ctx.stroke();
                ctx.setLineDash([]);

                // 雙箭頭
                drawArrow(d.eqPx - halfRangePx + 5, longY, d.eqPx - halfRangePx - 5, longY, '#ea580c');
                drawArrow(d.eqPx + halfRangePx - 5, longY, d.eqPx + halfRangePx + 5, longY, '#ea580c');

                // 追蹤質點
                ctx.fillStyle = '#ea580c';
                ctx.beginPath();
                ctx.arc(d.x, longY, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // 平衡位置
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(d.eqPx, longY - 12);
                ctx.lineTo(d.eqPx, longY + 12);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ctx.fillStyle = '#ea580c';
                ctx.beginPath();
                ctx.arc(d.x, longY, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 密部/疏部標籤
        ctx.font = '600 10px "Inter", sans-serif';
        ctx.fillStyle = '#ea580c';
        ctx.textAlign = 'center';
        let compIdx = Math.floor(numDots * 0.25);
        let compX = longDots[compIdx] ? longDots[compIdx].x : margin + waveW * 0.25;
        ctx.fillText('密部', compX, longY + 30);
        let rareIdx = Math.floor(numDots * 0.75);
        let rareX = longDots[rareIdx] ? longDots[rareIdx].x : margin + waveW * 0.75;
        ctx.fillText('疏部', rareX, longY + 30);

        // =============================================
        // 底部：波形對比圖
        // =============================================
        let graphTop = canvas.cssHeight * 0.88;
        let graphH = canvas.cssHeight - graphTop - 15;
        let graphMid = graphTop + graphH / 2;

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(margin - 5, graphTop - 5, waveW + 10, graphH + 10);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin - 5, graphTop - 5, waveW + 10, graphH + 10);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(margin, graphMid);
        ctx.lineTo(margin + waveW, graphMid);
        ctx.stroke();

        // 兩種波的波形（用物理座標）
        function drawWaveform(color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let px = margin; px <= canvas.cssWidth - margin; px++) {
                let physX = pixelToPhysX(px, margin, waveW);
                let phase = omega * simTime - k * physX;
                let yVal = amplitude * Math.sin(phase);
                let drawY = graphMid - yVal * (graphH / 2 - 5) / amplitude;
                if (px === margin) ctx.moveTo(px, drawY);
                else ctx.lineTo(px, drawY);
            }
            ctx.stroke();
        }

        drawWaveform('#2563eb');  // 橫波
        drawWaveform('#ea580c');  // 縱波

        // 圖例
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(margin + waveW - 140, graphTop + 3, 12, 3);
        ctx.fillStyle = '#000';
        ctx.font = '600 9px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('橫波', margin + waveW - 124, graphTop + 8);

        ctx.fillStyle = '#ea580c';
        ctx.fillRect(margin + waveW - 140, graphTop + 14, 12, 3);
        ctx.fillStyle = '#000';
        ctx.fillText('縱波', margin + waveW - 124, graphTop + 19);

        ctx.fillStyle = '#000';
        ctx.font = '700 10px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('WAVEFORM / 波形圖', margin, graphTop - 8);

        animationFrameId = requestAnimationFrame(loop);
    }

    const guardEl = document.getElementById('fSlider') || canvas;

    function cleanup() {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    }
    window.addEventListener('pagehide', cleanup);

    animationFrameId = requestAnimationFrame(loop);
}

initWavesSimulation();
