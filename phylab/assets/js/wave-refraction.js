/**
 * 🌊 水波折射實驗
 * 深水區/淺水區波速、波長、折射角視覺化（平面波前設計）
 *
 * ⚠️ 這一頁的**法線是橫的**（水平線），分界線才是鉛直那條。波前、光線、
 *    角度弧全部從這條水平法線量起。另外兩件事也是同一個幾何的後果：
 *      ‧ 全反射只可能發生在「淺 → 深」（慢 → 快）——「深 → 淺」時
 *        sinθ₂ = (v₂/v₁)·sinθ₁ 永遠小於 1，再大的入射角都折射得出去。
 *      ‧ 反射波是入射波對**分界線**的鏡射，所以兩者的波前一定在分界線上
 *        接在同一點（波的連續性）。
 */

// ==========================================================================
// 面板上的數字：預設值與滑桿範圍
// --------------------------------------------------------------------------
// ⚠️ 滑桿的 min/max/value、狀態變數的初值、以及「重設」寫回去的值，**一律
//    引用這裡**，不要在 HTML 或處理函式裡再寫一次字面值。寫成兩份的話，
//    改了常數而滑桿沒改，畫面完全正常——只有**驗證器拿得到的那一組**和
//    學生拉得到的那一組不一樣（README 陷阱二十二）。
//
// ⚠️ 預設方向是**深 → 淺**，而這個方向**永遠不會全反射**（見檔頭）。所以
//    載入頁面時看到的是一般的折射，不是全反射——要看全反射得先把方向切到
//    「淺 → 深」，再把入射角拉過 23.6°。驗證器 ㉓ 有一條斷言在釘這件事。
//
// ⚠️ **預設入射角必須留在臨界角以下**（20° < θc = asin(0.8/2.0) ≈ 23.6°）。
//    原本是 30°——於是切到「淺 → 深」的**第一眼就是全反射**：學生還沒動
//    滑桿，折射側就整個空了，而 md 寫的是「再把入射角拉過 24°」。預設值
//    在 θc 以上的話，那一句課文永遠對不上畫面（而且「拉過臨界角」這個
//    教學動作根本沒得做）。㉓ 用一條前提斷言（REFR_ANGLE_DEF < θc）加一條
//    「切過去先看到折射」釘住這件事，另附反面（把預設值改回 30° 要變紅）。
// ==========================================================================
const REFR_DEEP_TO_SHALLOW_DEF = true;
const REFR_ANGLE_MIN = 10, REFR_ANGLE_MAX = 80, REFR_ANGLE_DEF = 20;
const REFR_VDEEP_MIN = 1.0, REFR_VDEEP_MAX = 3.0, REFR_VDEEP_DEF = 2.0;
const REFR_VSHALLOW_MIN = 0.3, REFR_VSHALLOW_MAX = 1.5, REFR_VSHALLOW_DEF = 0.8;
const REFR_F_MIN = 0.5, REFR_F_MAX = 2.0, REFR_F_DEF = 1.0;
/** 光線的長度（畫布像素）。只影響畫多長，不影響角度。 */
const REFR_RAY_LEN = 180;

// ==========================================================================
// 純物理與幾何（不碰 DOM，Node 抓進去就能逐位斷言）
// --------------------------------------------------------------------------
// ⚠️ 這是**畫面上真正在用的那一份**，不是照著繪製碼重寫的第二份。
//    波前線段、光線端點與角度弧都呼叫這裡的函式，驗證器也讀同一份。
// ==========================================================================
var WaveRefraction = (function () {
    'use strict';

    /**
     * 臨界角（度）。**只有「慢 → 快」才有**。
     *
     * ⚠️ 從快介質射向慢介質（深 → 淺）時 sinθ₂ = (v₂/v₁)·sinθ₁ 永遠 ≤ 1，
     *    再大的入射角都折射得出去，此時回傳 **null**——不是 90，也不是
     *    Infinity。寫成 90 會讓「有沒有臨界角」這件事失去守門員。
     */
    function criticalAngle(v1, v2) {
        if (!(v2 > v1)) return null;
        return Math.asin(v1 / v2) * 180 / Math.PI;
    }

    /**
     * 折射定律。回傳折射角、是否全反射、反射角、反射率。
     *
     * ⚠️ 反射角 θᵣ **永遠**等於入射角 θ₁（反射定律），全反射時也一樣。
     *
     * ⚠️ `reflectance` 只在全反射時有值（1）。非全反射時是 **null 不是 0**：
     *    真實的分界面上部分反射一直都在，這一頁只是沒有畫它——「沒有畫」
     *    不可以寫成「沒有反射」，一個 0 會被資料卡片顯示成事實。
     */
    function refract(angle1Deg, v1, v2) {
        const sinT2 = (v2 / v1) * Math.sin(angle1Deg * Math.PI / 180);
        const total = Math.abs(sinT2) > 1;
        return {
            theta1: angle1Deg,
            theta2: total ? null : Math.asin(sinT2) * 180 / Math.PI,
            thetaR: angle1Deg,
            totalReflection: total,
            reflectance: total ? 1 : null,
        };
    }

    /**
     * 某一支波前線段的兩端（畫布座標）。
     *
     *   入射（mirrorX = false）：行進方向 (cosθ, −sinθ)，波前沿 (sinθ, cosθ)
     *   反射（mirrorX = true） ：行進方向 (−cosθ, −sinθ)，波前沿 (−sinθ, cosθ)
     *
     * 反射波就是入射波對**分界線**（x = cx 這條鉛直線）的鏡射。波前 i 用
     * 同一個 offset 同時算入射與反射，兩者在分界線上就會接在同一點——
     * 那不是巧合，是下面 boundaryCrossY 的同一條式子。
     */
    function wavefrontSegment(cx, cy, offset, angleDeg, mirrorX, len) {
        const th = angleDeg * Math.PI / 180;
        const d = mirrorX ? -1 : 1;
        const bx = cx + d * offset * Math.cos(th);
        const by = cy - offset * Math.sin(th);
        const wx = d * Math.sin(th);
        const wy = Math.cos(th);
        return {
            x1: bx - wx * len, y1: by - wy * len,
            x2: bx + wx * len, y2: by + wy * len,
        };
    }

    /**
     * 這支波前打在分界線上的高度（**相對中心**的 y）。
     *
     * ⚠️ 入射與反射共用這一個值，這就是波的連續性：反射波前是從入射波前
     *    撞上分界線的那一點折返的。驗證器會拿 wavefrontSegment 的兩端自己
     *    解一次直線與 x = cx 的交點，再跟這裡對——兩份獨立的算法。
     */
    function boundaryCrossY(offset, angleDeg) {
        return -offset / Math.sin(angleDeg * Math.PI / 180);
    }

    /**
     * 三條光線的端點（畫布座標）。三條都通過交點 (cx, cy)，也就是分界線
     * 與法線的交點。
     *
     *   入射 incident ：從**左下**射向交點，方向 ( cosθ₁, −sinθ₁)
     *   反射 reflected：從交點射向**左上**，方向 (−cosθ₁, −sinθ₁)
     *                   ——入射方向對**法線**的鏡射，θᵣ = θ₁
     *   折射 refracted：從交點射向**右上**，方向 ( cosθ₂, −sinθ₂)
     *
     * ⚠️ 入射與折射的方向 y 分量**同號**（兩者都在法線的同一側）。這一條
     *    不變式就是這一頁最容易寫錯的地方：折射的 y 寫成 +sinθ₂ 的話，
     *    畫出來的是折射光線對法線的鏡射——角度對、長度對、方向反了，而
     *    畫面上沒有任何錯誤訊息（README 陷阱九）。驗證器斷言的就是這一條。
     *
     * ⚠️ 兩支「另一邊」的光線是**互斥**的，用 null 表示「這個模型裡不存在」
     *    而不是長度 0：非全反射時這一頁不畫反射波（真實界面上部分反射一直
     *    都在，這一頁只是沒有畫它，見 refract 的 reflectance），全反射時
     *    折射波真的出不去。
     */
    function rays(cx, cy, angle1Deg, v1, v2, len) {
        const r = refract(angle1Deg, v1, v2);
        const th1 = angle1Deg * Math.PI / 180;
        const out = {
            incident: {
                x1: cx - len * Math.cos(th1), y1: cy + len * Math.sin(th1),
                x2: cx, y2: cy,
            },
            reflected: null,
            refracted: null,
        };
        if (r.totalReflection) {
            out.reflected = {
                x1: cx, y1: cy,
                x2: cx - len * Math.cos(th1), y2: cy - len * Math.sin(th1),
            };
        } else {
            const th2 = r.theta2 * Math.PI / 180;
            out.refracted = {
                x1: cx, y1: cy,
                x2: cx + len * Math.cos(th2), y2: cy - len * Math.sin(th2),
            };
        }
        return out;
    }

    return { criticalAngle, refract, wavefrontSegment, boundaryCrossY, rays };
})();

function initWaveRefraction() {
    const canvas = document.getElementById('physicsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const ctrlPanel = document.getElementById('controlPanel');

    // ==========================================================================
    // A. 狀態變數
    // ==========================================================================
    let isDeepToShallow = REFR_DEEP_TO_SHALLOW_DEF;
    let incidentAngle = REFR_ANGLE_DEF;
    let vDeep = REFR_VDEEP_DEF;
    let vShallow = REFR_VSHALLOW_DEF;
    let frequency = REFR_F_DEF;
    let showNormal = true;
    let isPaused = false;
    let simTime = 0;
    let lastTimestamp = performance.now();
    let animationFrameId;

    const guardEl = ctrlPanel;

    // 波速/波長輔助函數
    function getIncidentVelocity() { return isDeepToShallow ? vDeep : vShallow; }
    function getRefractedVelocity() { return isDeepToShallow ? vShallow : vDeep; }
    function getIncidentWavelength() { return getIncidentVelocity() / frequency; }
    function getRefractedWavelength() { return getRefractedVelocity() / frequency; }

    // ==========================================================================
    // B. 控制面板
    // ==========================================================================
    if (ctrlPanel) {
        ctrlPanel.innerHTML = `
            <div class="control-box">
                <label><span>折射方向</span></label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px;">
                    <button id="btnDeepToShallow" class="ref-btn active">深→淺</button>
                    <button id="btnShallowToDeep" class="ref-btn">淺→深</button>
                </div>
            </div>
            <div class="control-box">
                <label>
                    <span>入射角 θ₁</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="angleVal" style="color: #2563eb;">${REFR_ANGLE_DEF}</span>°
                    </span>
                </label>
                <input type="range" id="angleSlider" min="${REFR_ANGLE_MIN}" max="${REFR_ANGLE_MAX}" step="1" value="${REFR_ANGLE_DEF}">
            </div>
            <div class="control-box">
                <label>
                    <span>深水波速 v<sub>深</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vDeepVal" style="color: #2563eb;">${REFR_VDEEP_DEF.toFixed(1)}</span> m/s
                    </span>
                </label>
                <input type="range" id="vDeepSlider" min="${REFR_VDEEP_MIN}" max="${REFR_VDEEP_MAX}" step="0.1" value="${REFR_VDEEP_DEF.toFixed(1)}">
            </div>
            <div class="control-box">
                <label>
                    <span>淺水波速 v<sub>淺</sub></span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="vShallowVal" style="color: #2563eb;">${REFR_VSHALLOW_DEF.toFixed(1)}</span> m/s
                    </span>
                </label>
                <input type="range" id="vShallowSlider" min="${REFR_VSHALLOW_MIN}" max="${REFR_VSHALLOW_MAX}" step="0.1" value="${REFR_VSHALLOW_DEF.toFixed(1)}">
            </div>
            <div class="control-box">
                <label>
                    <span>頻率 f</span>
                    <span style="font-family: monospace; font-weight: 800;">
                        <span id="fVal" style="color: #2563eb;">${REFR_F_DEF.toFixed(1)}</span> Hz
                    </span>
                </label>
                <input type="range" id="fSlider" min="${REFR_F_MIN}" max="${REFR_F_MAX}" step="0.1" value="${REFR_F_DEF.toFixed(1)}">
            </div>
            <div class="control-box">
                <label style="cursor: pointer;">
                    <input type="checkbox" id="normalToggle" checked style="accent-color: #2563eb;">
                    <span>顯示法線</span>
                </label>
            </div>
            <div class="control-box" style="margin-top: 12px;">
                <button id="pauseBtn" style="width: 100%; padding: 10px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; font-size: 0.9rem;">暫停 PAUSE</button>
                <button id="resetBtn" style="width: 100%; padding: 10px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.9rem; margin-top: 6px;">重設 RESET</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .ref-btn { padding: 8px 4px; background: #fff; color: #000; border: 1px solid #000; font-weight: 700; cursor: pointer; font-size: 0.8rem; font-family: monospace; }
            .ref-btn.active { background: #000; color: #fff; border: none; }
            .ref-btn:hover { opacity: 0.85; }
        `;
        document.head.appendChild(style);

        document.getElementById('btnDeepToShallow').addEventListener('click', () => {
            isDeepToShallow = true;
            updateDirectionButtons();
        });
        document.getElementById('btnShallowToDeep').addEventListener('click', () => {
            isDeepToShallow = false;
            updateDirectionButtons();
        });

        function updateDirectionButtons() {
            document.getElementById('btnDeepToShallow').classList.toggle('active', isDeepToShallow);
            document.getElementById('btnShallowToDeep').classList.toggle('active', !isDeepToShallow);
        }

        const angleSlider = document.getElementById('angleSlider');
        const vDeepSlider = document.getElementById('vDeepSlider');
        const vShallowSlider = document.getElementById('vShallowSlider');
        const fSlider = document.getElementById('fSlider');

        function updateParams() {
            incidentAngle = parseInt(angleSlider.value);
            vDeep = parseFloat(vDeepSlider.value);
            vShallow = parseFloat(vShallowSlider.value);
            frequency = parseFloat(fSlider.value);
            document.getElementById('angleVal').textContent = incidentAngle;
            document.getElementById('vDeepVal').textContent = vDeep.toFixed(1);
            document.getElementById('vShallowVal').textContent = vShallow.toFixed(1);
            document.getElementById('fVal').textContent = frequency.toFixed(1);
        }

        angleSlider.addEventListener('input', updateParams);
        vDeepSlider.addEventListener('input', updateParams);
        vShallowSlider.addEventListener('input', updateParams);
        fSlider.addEventListener('input', updateParams);

        document.getElementById('normalToggle').addEventListener('change', (e) => {
            showNormal = e.target.checked;
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            isPaused = !isPaused;
            document.getElementById('pauseBtn').textContent = isPaused ? '播放 PLAY' : '暫停 PAUSE';
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            isDeepToShallow = REFR_DEEP_TO_SHALLOW_DEF;
            incidentAngle = REFR_ANGLE_DEF;
            vDeep = REFR_VDEEP_DEF;
            vShallow = REFR_VSHALLOW_DEF;
            frequency = REFR_F_DEF;
            showNormal = true;
            isPaused = false;
            simTime = 0;
            angleSlider.value = REFR_ANGLE_DEF;
            vDeepSlider.value = REFR_VDEEP_DEF;
            vShallowSlider.value = REFR_VSHALLOW_DEF;
            fSlider.value = REFR_F_DEF;
            document.getElementById('normalToggle').checked = true;
            updateParams();
            updateDirectionButtons();
            document.getElementById('pauseBtn').textContent = '暫停 PAUSE';
        });

        updateParams();
    }

    // ==========================================================================
    // C. 數據面板
    // ==========================================================================
    const dataGrid = document.querySelector('.data-cards-grid');
    let cardTheta1, cardTheta2, cardVInc, cardVRefr, cardLInc, cardLRefr;
    let cardReflectWrap, cardReflect;
    if (dataGrid) {
        dataGrid.innerHTML = `
            <div class="data-card highlight">
                <span class="card-label">入射角 θ₁</span>
                <div class="card-num-wrapper">
                    <span id="cardTheta1" class="card-num">20.0</span>
                    <span class="card-unit">°</span>
                </div>
            </div>
            <div class="data-card highlight">
                <span class="card-label">折射角 θ₂</span>
                <div class="card-num-wrapper">
                    <span id="cardTheta2" class="card-num">0.0</span>
                    <span class="card-unit">°</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">入射側波速</span>
                <div class="card-num-wrapper">
                    <span id="cardVInc" class="card-num">2.0</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">折射側波速</span>
                <div class="card-num-wrapper">
                    <span id="cardVRefr" class="card-num">0.8</span>
                    <span class="card-unit">m/s</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">入射側波長</span>
                <div class="card-num-wrapper">
                    <span id="cardLInc" class="card-num">0.0</span>
                    <span class="card-unit">m</span>
                </div>
            </div>
            <div class="data-card">
                <span class="card-label">折射側波長</span>
                <div class="card-num-wrapper">
                    <span id="cardLRefr" class="card-num">0.0</span>
                    <span class="card-unit">m</span>
                </div>
            </div>
            <div class="data-card" id="cardReflectWrap" style="display: none;">
                <span class="card-label">反射率 R</span>
                <div class="card-num-wrapper">
                    <span id="cardReflect" class="card-num">100</span>
                    <span class="card-unit">%</span>
                </div>
            </div>
        `;
        cardTheta1 = document.getElementById('cardTheta1');
        cardTheta2 = document.getElementById('cardTheta2');
        cardVInc = document.getElementById('cardVInc');
        cardVRefr = document.getElementById('cardVRefr');
        cardLInc = document.getElementById('cardLInc');
        cardLRefr = document.getElementById('cardLRefr');
        cardReflectWrap = document.getElementById('cardReflectWrap');
        cardReflect = document.getElementById('cardReflect');
    }

    // ==========================================================================
    // D. 物理計算
    // ==========================================================================
    /**
     * 這一幀的暫存。
     *
     * ⚠️ 一幀裡面 `calcRefraction()` 被叫 **5 次**（畫波前、畫角度弧、畫側欄
     *    註記、畫側欄波形、更新卡片），每一次都重跑一遍 Snell 的 asin／sin；
     *    六條波前漸層也是每一幀重新 `createLinearGradient()`，而它們只跟著
     *    畫布尺寸走。畫面完全一樣——**這種重複不會有任何症狀**，只會白燒
     *    CPU。所以改成「一幀算一次」：`loop()` 開頭清掉，其餘一律讀這一份。
     *
     * 快取在**幀**上而不是在**輸入值**上，是因為輸入值（滑鼠拖出來的滑桿、
     * 視窗尺寸）在一幀中間不會變——反過來說，用輸入值當鍵的話，一旦哪天
     * 有人多接了一個會在一幀內變動的量，快取就會靜默地回舊值。
     */
    const frame = { refraction: null, gradients: new Map() };

    /**
     * 這一頁的所有角度都從同一個地方出來——純物理那一支。繪製碼只消費它，
     * 不自己再算一次（畫的與算的必須是同一份資料）。
     */
    function calcRefraction() {
        if (!frame.refraction) {
            frame.refraction = WaveRefraction.refract(
                incidentAngle, getIncidentVelocity(), getRefractedVelocity());
        }
        return frame.refraction;
    }

    /**
     * 波前漸層的快取：同一幀裡同一條漸層只建一次。
     * 鍵要含畫布尺寸與深淺方向——那兩個一改，漸層就真的不一樣了。
     */
    function gradient(key, build) {
        let g = frame.gradients.get(key);
        if (!g) { g = build(); frame.gradients.set(key, g); }
        return g;
    }

    /** 這一頁的臨界角（度）；「深 → 淺」時是 null，因為不可能全反射。 */
    function criticalAngle() {
        return WaveRefraction.criticalAngle(getIncidentVelocity(), getRefractedVelocity());
    }

    // ==========================================================================
    // E. 渲染
    // ==========================================================================
    const SCALE = 80;

    function drawBackground() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;

        // 水深用顏色編碼：深水＝深藍、淺水＝淺藍。
        // ⚠️ 哪一邊是深水會隨「折射方向」對調，顏色必須跟著對調。只換標籤
        //    不換顏色的話，切到「淺 → 深」時左半邊會寫著「淺水區 SHALLOW」
        //    卻塗成深藍——標籤和色碼互相打臉，而畫面上不會有任何錯誤訊息。
        const DEEP = ['#0a1628', '#101e38'];
        const SHALLOW = ['#1a3a6a', '#2563a0'];
        const leftPair = isDeepToShallow ? DEEP : SHALLOW;
        const rightPair = isDeepToShallow ? SHALLOW : DEEP;

        // 這兩條漸層只跟畫布尺寸與深淺方向有關——一幀一次，不是一次畫一格。
        const leftGrad = gradient(`bgL|${bX}|${isDeepToShallow}`, () => {
            const g = ctx.createLinearGradient(0, 0, bX, 0);
            g.addColorStop(0, leftPair[0]);
            g.addColorStop(1, leftPair[1]);
            return g;
        });
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, bX, H);

        const rightGrad = gradient(`bgR|${bX}|${isDeepToShallow}`, () => {
            const g = ctx.createLinearGradient(bX, 0, W, 0);
            g.addColorStop(0, rightPair[0]);
            g.addColorStop(1, rightPair[1]);
            return g;
        });
        ctx.fillStyle = rightGrad;
        ctx.fillRect(bX, 0, W - bX, H);

        // 區域標籤
        ctx.font = '700 14px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        if (isDeepToShallow) {
            ctx.fillText('深水區 DEEP', bX * 0.25, 30);
            ctx.fillText('淺水區 SHALLOW', bX + (W - bX) * 0.5, 30);
        } else {
            ctx.fillText('淺水區 SHALLOW', bX * 0.25, 30);
            ctx.fillText('深水區 DEEP', bX + (W - bX) * 0.5, 30);
        }

        // 波速標籤
        ctx.font = '600 13px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(`v₁ = ${getIncidentVelocity().toFixed(1)} m/s`, bX * 0.25, H - 25);
        ctx.fillText(`v₂ = ${getRefractedVelocity().toFixed(1)} m/s`, bX + (W - bX) * 0.5, H - 25);
    }

    function drawBoundary() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;

        // 分界線（實線，鉛直）——波前的折返點都落在這條線上
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bX, 0);
        ctx.lineTo(bX, H);
        ctx.stroke();

        // 法線（虛線，水平）——角度一律從這條線量起。
        // ⚠️ 它和分界線是**兩條互相垂直的線**：分界線鉛直、法線水平。
        //    以前這裡把法線畫在分界線上面（同一條線、兩個名字），
        //    角度弧卻從鉛直方向量起——三份幾何各說各話。
        if (showNormal) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(W, centerY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = '600 11px "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            labelText('法線 NORMAL', 10, centerY - 12);
        }
    }

    /**
     * 把一條線段只畫在分界線的其中一側。
     *   keepLeft = true  → 只留 x < bX（入射波、反射波）
     *   keepLeft = false → 只留 x > bX（折射波）
     * 兩端都在另一側時什麼都不畫（空的 path，stroke 是 no-op）。
     */
    function strokeHalf(x1, y1, x2, y2, bX, keepLeft) {
        const inside = keepLeft ? (x) => x < bX : (x) => x > bX;
        ctx.beginPath();
        if (inside(x1) && inside(x2)) {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        } else if (inside(x1)) {
            const t = (bX - x1) / (x2 - x1);
            ctx.moveTo(x1, y1);
            ctx.lineTo(bX, y1 + t * (y2 - y1));
        } else if (inside(x2)) {
            const t = (bX - x2) / (x1 - x2);
            ctx.moveTo(bX, y2 + t * (y1 - y2));
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
    }

    function drawWavefronts() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;
        const { theta2, totalReflection } = calcRefraction();

        const lambdaIncPx = getIncidentWavelength() * SCALE;
        const lambdaRefrPx = getRefractedWavelength() * SCALE;
        const phase = simTime * frequency * 2 * Math.PI;
        const p = phase / (2 * Math.PI);

        // ⚠️ 三組波前共用同一個 index k。這不是省事，是波的連續性：同一支
        //    入射波前撞上分界線的那一點，就是折射波前與反射波前離開的那一
        //    點。折射那一組看起來「波長不同、卻對得上」，是因為
        //    λ₁/sinθ₁ = λ₂/sinθ₂（Snell）——沿分界線的間距本來就相等。
        const numWF = 25;
        const len = 220;

        // --- 入射波前（左側）---
        const incGrad = gradient(`wf|inc|${centerY}`, () => {
            const g = ctx.createLinearGradient(0, centerY - 200, 0, centerY + 200);
            g.addColorStop(0, 'rgba(34, 211, 238, 0.15)');
            g.addColorStop(0.5, 'rgba(34, 211, 238, 0.55)');
            g.addColorStop(1, 'rgba(34, 211, 238, 0.15)');
            return g;
        });
        ctx.strokeStyle = incGrad;
        ctx.lineWidth = 2.5;

        for (let i = -numWF; i <= numWF; i++) {
            const s = WaveRefraction.wavefrontSegment(
                bX, centerY, (i + p) * lambdaIncPx, incidentAngle, false, len);
            strokeHalf(s.x1, s.y1, s.x2, s.y2, bX, true);
        }

        // --- 反射波前（左側，與入射交叉）---
        // 只在全反射時畫（見 calcRefraction 的說明）。反射波留在**入射
        // 介質**裡、波速沒變，所以波長和入射波一模一樣（λᵣ = λ₁），
        // 整組只是對分界線鏡射——同一個 offset、同一個 k。
        if (totalReflection) {
            const rflGrad = gradient(`wf|rfl|${centerY}`, () => {
                const g = ctx.createLinearGradient(0, centerY - 200, 0, centerY + 200);
                g.addColorStop(0, 'rgba(52, 211, 153, 0.15)');
                g.addColorStop(0.5, 'rgba(52, 211, 153, 0.6)');
                g.addColorStop(1, 'rgba(52, 211, 153, 0.15)');
                return g;
            });
            ctx.strokeStyle = rflGrad;
            ctx.lineWidth = 2.5;

            for (let i = -numWF; i <= numWF; i++) {
                const s = WaveRefraction.wavefrontSegment(
                    bX, centerY, (i + p) * lambdaIncPx, incidentAngle, true, len);
                strokeHalf(s.x1, s.y1, s.x2, s.y2, bX, true);
            }
        }

        // --- 折射波前（右側）---
        if (!totalReflection) {
            const refGrad = gradient(`wf|ref|${centerY}|${bX}|${W}`, () => {
                const g = ctx.createLinearGradient(bX, centerY - 200, W, centerY + 200);
                g.addColorStop(0, 'rgba(251, 146, 60, 0.15)');
                g.addColorStop(0.5, 'rgba(251, 146, 60, 0.55)');
                g.addColorStop(1, 'rgba(251, 146, 60, 0.15)');
                return g;
            });
            ctx.strokeStyle = refGrad;
            ctx.lineWidth = 2.5;

            for (let i = -numWF; i <= numWF; i++) {
                const s = WaveRefraction.wavefrontSegment(
                    bX, centerY, (i + p) * lambdaRefrPx, theta2, false, len);
                strokeHalf(s.x1, s.y1, s.x2, s.y2, bX, false);
            }
        }
    }

    function drawIncidentRay() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;

        // ⚠️ 端點全部向 WaveRefraction.rays() 要，這一支只負責畫。折射光線
        //    的 y 是**減** sinθ₂（在法線的同一側）——以前這裡自己算，寫成加，
        //    畫出來的是折射光線對法線的鏡射：角度對、長度對、方向反了。
        const R = WaveRefraction.rays(bX, centerY, incidentAngle,
            getIncidentVelocity(), getRefractedVelocity(), REFR_RAY_LEN);

        function seg(s, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();
            drawArrow(ctx, s.x1, s.y1, s.x2, s.y2, color);
        }

        seg(R.incident, '#22d3ee');            // 入射（左下 → 交點）
        if (R.reflected) seg(R.reflected, '#34d399');   // 反射（交點 → 左上，全反射時才有）
        if (R.refracted) seg(R.refracted, '#fb923c');   // 折射（交點 → 右上）
    }

    function drawArrow(c, x1, y1, x2, y2, color) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 10;
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
        c.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
        c.closePath();
        c.fill();
    }

    /** 從交點沿角度 a（弧度）、半徑 r 的標籤位置。 */
    function arcLabelAt(bX, centerY, a, r) {
        return { x: bX + Math.cos(a) * r, y: centerY + Math.sin(a) * r };
    }

    /**
     * 帶一圈暗邊的文字。
     * ⚠️ 角度標籤壓在波前上面——波前是一整片網格，不會剛好閃開文字。
     *    沒有暗邊的話「θ₂=11.5°」會被一條線從中間穿過去。
     */
    function labelText(text, x, y) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(6, 12, 26, 0.65)';
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
    }

    /**
     * 在 maxW 之內塞得下的字級（從 fontPx 逐點往下找，下限 9 px），回傳可以
     * 直接餵給 `ctx.font` 的字串。
     *
     * ⚠️ 折射側只有**半張畫布**，而全反射那兩行說明是全頁最長的字串。寫死
     *    字級的話，在最窄的版面（1100 px 視窗 → 畫布 448 px → 右半邊 222 px）
     *    上它會**剛好頂到分界線**（實測只剩 1 px），再窄一點就壓到左半邊的
     *    θᵣ 標籤——而 1600 px 的截圖上完全看不出來（README 陷阱二十：判準
     *    要用**最窄**的那個尺度量）。
     */
    function fitFontSize(text, maxW, fontPx, weight) {
        let size = fontPx;
        ctx.font = `${weight} ${size}px "Inter", sans-serif`;
        while (size > 9 && ctx.measureText(text).width > maxW) {
            size--;
            ctx.font = `${weight} ${size}px "Inter", sans-serif`;
        }
        return `${weight} ${size}px "Inter", sans-serif`;
    }

    /**
     * 三條角度弧，全部從**同一條水平法線**量起：
     *   θ₁ 在法線下方、入射側（左下）  θᵣ 在法線上方、入射側（左上）
     *   θ₂ 在法線上方、折射側（右上）
     */
    function drawAngleArcs() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;
        const { theta2, totalReflection } = calcRefraction();

        const theta1Rad = incidentAngle * Math.PI / 180;
        const arcR = 60;

        ctx.lineWidth = 2;
        ctx.font = '700 13px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // θ₁：入射光線與法線的夾角。入射光線在左下，弧就畫在左下。
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(bX, centerY, arcR, Math.PI - theta1Rad, Math.PI);
        ctx.stroke();
        const la1 = arcLabelAt(bX, centerY, Math.PI - theta1Rad / 2, arcR + 20);
        ctx.fillStyle = '#22d3ee';
        labelText(`θ₁=${incidentAngle}°`, la1.x, la1.y);

        if (totalReflection) {
            // θᵣ：反射光線與法線的夾角，與 θ₁ 對稱（在法線的另一側）。
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bX, centerY, arcR, Math.PI, Math.PI + theta1Rad);
            ctx.stroke();
            const laR = arcLabelAt(bX, centerY, Math.PI + theta1Rad / 2, arcR + 20);
            ctx.fillStyle = '#34d399';
            labelText(`θᵣ=${incidentAngle}°`, laR.x, laR.y);
        } else {
            const theta2Rad = theta2 * Math.PI / 180;
            ctx.strokeStyle = '#fb923c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bX, centerY, arcR, -theta2Rad, 0);
            ctx.stroke();
            const la2 = arcLabelAt(bX, centerY, -theta2Rad / 2, arcR + 20);
            ctx.fillStyle = '#fb923c';
            labelText(`θ₂=${theta2.toFixed(1)}°`, la2.x, la2.y);
        }
        ctx.lineWidth = 2;
    }

    /**
     * 右半邊的說明文字。全反射時折射側真的什麼都沒有——那段空白就是這一頁
     * 要教的事，所以字直接寫在那片空白中間。
     */
    function drawSideNotes() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const centerY = H * 0.5;
        const cx2 = bX + (W - bX) * 0.5;
        const { totalReflection, reflectance } = calcRefraction();
        const thC = criticalAngle();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 臨界角提示（只有「淺 → 深」才有；「深 → 淺」時是 null）。
        // 折射側在「淺 → 深」時是深水區（深色底），所以這行字一定在暗底上。
        if (thC !== null) {
            ctx.font = '600 12px "Inter", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText(`臨界角 θc = ${thC.toFixed(1)}°`, cx2, 55);
        }

        if (totalReflection) {
            const maxW = (W - bX) - 32;      // 右半邊，兩側各留 16 px
            const title = '全反射 TOTAL REFLECTION';
            const msg = `能量全部反射回入射介質　反射率 ${(reflectance * 100).toFixed(0)}%`;

            ctx.font = fitFontSize(title, maxW, 17, 700);
            ctx.fillStyle = '#ef4444';
            ctx.fillText(title, cx2, centerY - 16);

            ctx.font = fitFontSize(msg, maxW, 12, 600);
            ctx.fillStyle = 'rgba(239,68,68,0.85)';
            ctx.fillText(msg, cx2, centerY + 12);
        }
    }

    function drawSideWaveform() {
        const W = canvas.cssWidth;
        const H = canvas.cssHeight;
        const bX = W * 0.5;
        const graphH = 80;
        const graphTop = H - graphH - 40;
        const graphBot = H - 40;
        const centerY = (graphTop + graphBot) / 2;
        const phase = simTime * frequency * 2 * Math.PI;

        // 背景半透明
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, graphTop, W, graphH);

        // 分界線
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bX, graphTop);
        ctx.lineTo(bX, graphBot);
        ctx.stroke();

        // 繪製波形
        ctx.lineWidth = 2;

        // 左側（入射波）
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        for (let x = 0; x < bX; x++) {
            const lambdaPx = getIncidentWavelength() * SCALE;
            const k = (2 * Math.PI) / lambdaPx;
            const amp = 25;
            const y = centerY + amp * Math.sin(k * x + phase);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 右側（折射波）
        const { totalReflection } = calcRefraction();
        if (!totalReflection) {
            ctx.strokeStyle = '#fb923c';
            ctx.beginPath();
            for (let x = bX; x < W; x++) {
                const lambdaPx = getRefractedWavelength() * SCALE;
                const k = (2 * Math.PI) / lambdaPx;
                const amp = 25;
                const y = centerY + amp * Math.sin(k * x + phase);
                if (x === bX) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // 標籤
        ctx.font = '600 11px "Inter", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(`λ₁ = ${getIncidentWavelength().toFixed(2)} m`, 10, graphTop + 12);

        // 折射側沒有波時不要留下一個指著空白的 λ₂
        if (totalReflection) {
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'right';
            ctx.fillText('無折射波', W - 10, graphTop + 12);
        } else {
            ctx.fillStyle = '#fb923c';
            ctx.textAlign = 'right';
            ctx.fillText(`λ₂ = ${getRefractedWavelength().toFixed(2)} m`, W - 10, graphTop + 12);
        }
    }

    function updateCards() {
        const { theta2, totalReflection, reflectance } = calcRefraction();
        if (cardTheta1) cardTheta1.innerText = incidentAngle.toFixed(1);
        if (cardTheta2) cardTheta2.innerText = totalReflection ? '全反射' : theta2.toFixed(1);

        // 反射率只在全反射時出現。非全反射時這一頁沒有畫反射波，卡片就
        // 不顯示任何數字——**不可以顯示 0**，那會變成一條不存在的宣稱
        // （見 WaveRefraction.refract 的說明）。
        if (cardReflectWrap) {
            cardReflectWrap.style.display = reflectance === null ? 'none' : '';
        }
        if (cardReflect) cardReflect.innerText = reflectance === null ? '' : '100';

        if (cardVInc) cardVInc.innerText = getIncidentVelocity().toFixed(1);
        if (cardVRefr) cardVRefr.innerText = getRefractedVelocity().toFixed(1);
        if (cardLInc) cardLInc.innerText = getIncidentWavelength().toFixed(2);
        if (cardLRefr) cardLRefr.innerText = getRefractedWavelength().toFixed(2);
    }

    // ==========================================================================
    // F. 主迴圈
    // ==========================================================================
    function loop(ts) {
        if (!document.contains(guardEl)) return;
        let dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        if (dt > 0.1) dt = 0.1;
        if (!isPaused) simTime += dt;

        // 這一幀的暫存從這裡開始算。**一定要在 `isPaused` 的提早返回之後**：
        // 暫停的時候下面照樣畫，快取若沒清，畫面上會是暫停那一刻的角度。
        frame.refraction = null;
        frame.gradients.clear();

        PhysicsUtils.beginFrame(ctx, canvas);
        drawBackground();
        drawWavefronts();
        drawBoundary();
        drawIncidentRay();
        drawAngleArcs();
        drawSideNotes();
        drawSideWaveform();
        updateCards();

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

// ⚠️ 這個守衛不可省：驗證器用 new Function() 把整支讀進 Node 執行，
//    少了它會在 `document is not defined` 當場爆掉。
if (typeof document !== 'undefined') initWaveRefraction();

// 匯出純物理那一支與面板上的常數，驗證器才進得來（README 陷阱十九：
// __page 是一份**明列的出口清單**，沒有掛上去的東西驗證器看不到）。
if (typeof window !== 'undefined') {
    window.__page = {
        WaveRefraction,
        REFR_DEEP_TO_SHALLOW_DEF,
        REFR_ANGLE_MIN, REFR_ANGLE_MAX, REFR_ANGLE_DEF,
        REFR_VDEEP_MIN, REFR_VDEEP_MAX, REFR_VDEEP_DEF,
        REFR_VSHALLOW_MIN, REFR_VSHALLOW_MAX, REFR_VSHALLOW_DEF,
        REFR_F_MIN, REFR_F_MAX, REFR_F_DEF,
        REFR_RAY_LEN,
    };
}
