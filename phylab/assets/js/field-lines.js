/**
 * 🧲 磁場與磁力線
 *
 * 這一頁只做一件事：把**同一個磁場**用四種方式呈現，而且四種必須一致。
 *
 *   ① 磁力線        場的形狀
 *   ② 羅盤指針      場在某一點的方向（跟著滑鼠跑，就是真的「用指針探測」）
 *   ③ B–r 圖        場隨距離怎麼衰減
 *   ④ 數字卡片      同一個 B 的大小
 *
 * 四者全部來自 `MagneticKit.fieldAt()`。磁力線是**追出來的**，不是畫死的
 * 曲線；羅盤指針的角度是**問場要的**，不是版面排好的角度。所以把任何一個
 * 滑桿拉動，四張圖會一起變，而且永遠互相吻合。
 *
 * ==========================================================================
 * ⚠️ 為什麼羅盤指針比磁力線更值得畫
 * ==========================================================================
 * 磁力線是「很多條線」，學生看到的是形狀；指針是「一個方向」，學生看到的
 * 是可以量的東西。真實的實驗室裡，磁場就是這樣被探索出來的——把一只小
 * 指南針放在磁場裡，看它指哪裡，一點一點描出磁力線。這一頁讓那件事變成
 * 可以隨時重做的動作：把滑鼠移到任何位置。
 *
 * ==========================================================================
 * ⚠️ 三種場源共用一條公式
 * ==========================================================================
 * 長直導線、螺線管、條形磁鐵的磁場都被 `∮B·dl = μ₀I` 管，所以面板上的
 * 核心關係對三種模式都成立（螺線管的 `B = μ₀NI/ℓ` 就是拿它繞一圈算出來的）。
 * 這也是為什麼切換場源不需要換公式——它們本來就是同一條定律的三個長相。
 */
(function () {
    'use strict';

    // ======================================================================
    // 邏輯世界（900×900，見 lab-scene.js）
    // ======================================================================
    // 場景中央放場源，探針預設在右邊 250 世界單位處。
    // 世界對應的真實尺度：**900 世界單位 = 20 cm**。這個換算只用來把世界
    // 距離變成有意義的公分數（卡片與 B–r 圖的橫軸），磁力線本身不需要它。
    const CX = 450, CY = 450;
    const M_PER_UNIT = 0.20 / 900;
    const CM = u => u * M_PER_UNIT * 100;

    // 三種場源的幾何。長度都用世界單位，換算成公尺時走 M_PER_UNIT。
    //
    // ⚠️ 條形磁鐵的極強度 p 不是隨便填的。雙極模型的磁極表面磁場是
    //    B = μ₀p/(4πr²)，r 用極到管端的距離（130 世界單位 = 2.9 cm）去算，
    //    p = 90 只給出 1 mT 上下——比螺線管的管內場小三個數量級，卡片上
    //    會印成 0.00 mT。p = 180 給出約 20 mT，才是真實強磁鐵的量級。
    const MAGNET = { kind: 'magnet', x: CX, y: CY, angle: 0, len: 260, p: 180 };
    const LEN_SOL = 380;

    /** 磁場的顯示格式。三種場源差了三個數量級，固定兩位小數會讓導線那一頁
     *  永遠顯示 0.00——所以要依大小自動決定小數位。 */
    function fmtB(mT) {
        const a = Math.abs(mT);
        if (a === 0) return '0.000';
        if (a < 0.01) return mT.toExponential(2);
        if (a < 1) return mT.toFixed(3);
        return mT.toFixed(2);
    }

    /** 這一幀的場源清單。**唯一**產生場的地方——磁力線、羅盤、圖、卡片都吃它。
     *
     *  ⚠️ `u` 一定要填。MagneticKit 用的是 SI 常數，而這裡的座標是**世界
     *     單位**（900 單位 = 20 cm）。少了 u，磁力線的形狀完全正確、卡片上
     *     的數字卻差 2×10⁷ 倍——第一版就是這樣：同一點物理上是 8 mT，畫面
     *     印 3.98e-7 mT。圖看不出來，一定要看數字。 */
    function sourcesFor(panel) {
        const mode = panel.src;
        if (mode === 'wire') {
            return [{ kind: 'wire', x: CX, y: CY, I: panel.I, u: M_PER_UNIT }];
        }
        if (mode === 'solenoid') {
            return [{ kind: 'solenoid', x: CX, y: CY, angle: 0,
                      N: panel.N, I: panel.I, len: LEN_SOL, u: M_PER_UNIT }];
        }
        return [Object.assign({}, MAGNET, { u: M_PER_UNIT })];
    }

    /** 探針量到的東西。指標在畫面上是羅盤，在卡片上是這幾個數。 */
    function probeReading(sources, probe) {
        const b = MagneticKit.fieldAt(sources, probe.x, probe.y);
        const mag = Math.hypot(b.bx, b.by);
        // 離**最近的那個場源中心**的距離（卡片要的是「多遠」，不是「在哪」）
        let r = Infinity;
        for (const s of sources) r = Math.min(r, Math.hypot(probe.x - s.x, probe.y - s.y));
        return {
            b, mag, r,
            angle: Math.atan2(b.by, b.bx) * 180 / Math.PI,
            // 沿著畫面內垂直於軸的方向量到的半徑（螺線管內部要扣掉半徑才合理，
            // 但導線與磁鐵沒有這個問題，所以一律用中心距離，卡片標題寫「中心距離」）
        };
    }

    /** 磁力線條數：就是這次會追幾條線，讓「疏／密」是一個看得到的數字。 */
    function lineCount(panel, sources) {
        return MagneticScene.autoSeeds(sources, { perPole: DENSITY[panel.dens].perPole }).length;
    }

    const DENSITY = {
        sparse: { perPole: 6,  radii: [110, 240, 360] },
        normal: { perPole: 10, radii: [70, 140, 225, 330] },
        dense:  { perPole: 16, radii: [55, 105, 160, 220, 290, 360] },
    };

    // ⚠️ 探針一定要在 MagneticScene.run() **之前**宣告。run() 會同步呼叫
    //    refresh() → model()，也就是在 IIFE 還沒跑完的時候就讀 probe；
    //    宣告寫在下面的話這裡會直接 TDZ ReferenceError。
    //    （lab-scene.js 的 buildPanel 就是為了同一個理由才不在建構時回呼。）
    const probe = { x: CX + 250, y: CY - 150 };

    // ======================================================================
    // 羅盤指針：會擺盪，不是瞬間貼上去
    // ======================================================================
    // 真實的指南針被放到磁場裡會來回擺幾下才停。這裡用一個臨界阻尼的彈簧
    // 模擬那個過程，順便讓「場的方向」是一個**動態**被看出來的東西。
    let needleAngle = 0, needleVel = 0;

    function stepNeedle(target, dt) {
        // 角度差要先解到 (−π, π]，否則從 179° 轉到 −179° 會繞一大圈
        let d = target - needleAngle;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const k = 240, c = 2 * Math.sqrt(k) * 0.75;      // 略欠阻尼
        needleVel += (k * d - c * needleVel) * dt;
        needleAngle += needleVel * dt;
    }

    function drawCompass(p, view, x, y, angle, o) {
        const R = (o && o.r) || 26;
        const cx = view.toScreenX(x), cy = view.toScreenY(y);
        const Rpx = view.len(R);

        p.noStroke();
        p.fill(255, 255, 255, 235);
        p.ellipse(cx, cy, Rpx * 2, Rpx * 2);
        MagneticScene.strokeOn(p, MagneticScene.C_DIM, view.len(1.5, 1));
        p.noFill();
        p.ellipse(cx, cy, Rpx * 2, Rpx * 2);

        p.push();
        p.translate(cx, cy);
        p.rotate(angle);
        // 紅的一半指向 B 的方向，另一半是白的（就像真的磁針）
        p.noStroke();
        p.fill(239, 68, 68);
        p.triangle(Rpx * 0.86, 0, -Rpx * 0.12, -Rpx * 0.24, -Rpx * 0.12, Rpx * 0.24);
        p.fill(226, 232, 240);
        p.triangle(-Rpx * 0.86, 0, -Rpx * 0.12, Rpx * 0.24, -Rpx * 0.12, -Rpx * 0.24);
        p.pop();

        p.noStroke();
        p.fill(30, 41, 59);
        p.ellipse(cx, cy, view.len(3, 2), view.len(3, 2));
    }

    // ======================================================================
    // 對外
    // ======================================================================
    MagneticScene.run({
        formula: '\\oint \\vec{B} \\cdot d\\vec{l} = \\mu_0 I',
        formulaFallback: '∮ B · dl = μ₀ I',

        controls: {
            selects: [
                { key: 'src', label: '場源', def: 'magnet', options: [
                    { v: 'magnet',   t: '條形磁鐵' },
                    { v: 'wire',     t: '長直導線（垂直於畫面）' },
                    { v: 'solenoid', t: '螺線管（軸在畫面內）' },
                ] },
                { key: 'dens', label: '磁力線密度', def: 'normal', live: true, options: [
                    { v: 'sparse', t: '疏（看得清楚）' },
                    { v: 'normal', t: '中' },
                    { v: 'dense',  t: '密（課本的樣子）' },
                ] },
            ],
            sliders: [
                { key: 'I', label: '電流 I', def: 5, min: 1, max: 10, step: 0.5, unit: 'A', dec: 1 },
                { key: 'N', label: '螺線管匝數 N', def: 200, min: 50, max: 400, step: 10, unit: '匝', dec: 0 },
            ],
        },

        cards: [
            { label: '探針處磁場 |B|', id: 'cardB', unit: 'mT', highlight: true },
            { label: '到場源中心的距離', id: 'cardR', unit: 'cm', highlight: true },
            { label: '場的方向', id: 'cardAng', unit: '°' },
            { label: '電流 I', id: 'cardI', unit: 'A' },
            { label: '匝數 N', id: 'cardN', unit: '匝' },
            { label: '磁力線條數', id: 'cardLines', unit: '條' },
        ],

        // 探針預設在場源右邊 250 世界單位處；滑鼠一進畫布就交給滑鼠。
        model(t, panel) {
            const sources = sourcesFor(panel);
            return { sources, probe: Object.assign({}, probe) };
        },

        values(t, panel, sol) {
            const { sources, probe: q } = sol;
            const rd = probeReading(sources, q);
            return {
                cardB: fmtB(rd.mag * 1000),
                cardR: CM(rd.r).toFixed(2),
                cardAng: rd.angle.toFixed(0),
                // 電流與匝數只在它們真的影響場源的模式下才印數字；磁鐵模式下
                // 那兩個滑桿不接任何東西，印「—」比印一個沒有作用的數字誠實。
                cardI: panel.src === 'magnet' ? '—' : panel.I.toFixed(1),
                cardN: panel.src === 'solenoid' ? panel.N.toFixed(0) : '—',
                cardLines: String(lineCount(panel, sources)),
            };
        },

        titleText(t, panel, sol) {
            const { sources, probe: q } = sol;
            const rd = probeReading(sources, q);
            const where = panel.src === 'wire' ? '長直導線'
                        : panel.src === 'solenoid' ? '螺線管' : '條形磁鐵';
            const extra = panel.src === 'solenoid'
                ? `　管內 B = μ₀NI/ℓ = ${fmtB(MagneticKit.solenoidField(
                      panel.N, panel.I, LEN_SOL * M_PER_UNIT) * 1000)} mT`
                : '';
            return `${where}　探針處 |B| = ${fmtB(rd.mag * 1000)} mT`
                 + `（距中心 ${CM(rd.r).toFixed(2)} cm）${extra}`;
        },

        draw(p, view, t, panel, sol) {
            // 滑鼠在畫布裡就把探針移過去——這一頁的「做實驗」就是這個動作：
            // 把指針放到某個位置，讀它指的方向和大小。
            const m = worldFromMouse(p, view);
            if (m) { probe.x = m.x; probe.y = m.y; }
            drawScene(p, view, panel, sol.sources, probe);
        },
    });

    /** 畫一整個場景。探針位置由呼叫端決定（滑鼠或預設點）。 */
    function drawScene(p, view, panel, sources, q) {
        // 壞掉的場源要當場說出來，不要安靜地畫一張錯的圖
        const diag = MagneticKit.check(sources);
        if (!diag.ok) {
            MagneticScene.worldBadge(p, view, CX, CY - 300,
                                '⚠ ' + diag.errors[0], { size: 18, col: [220, 38, 38] });
            return;
        }

        // 磁力線先畫（在場源底下）
        MagneticScene.drawFieldLines(p, view, sources, DENSITY[panel.dens]);

        // 場源
        for (const s of sources) {
            MagneticScene.drawSource(p, view, s, { poleLabels: panel.src !== 'magnet' });
        }

        // B–r 圖：沿著 +x 射線取樣。三者形狀完全不同——導線是 1/r 的
        // 雙曲線、螺線管是「先平後掉」、磁鐵是「先峰後掉」——這三種
        // 形狀本身就是這一頁要教的東西。
        drawBrGraph(p, view, sources, q);

        // 羅盤指針（最後畫，壓在最上面）
        const rd = probeReading(sources, q);
        const target = rd.mag > 1e-14 ? Math.atan2(rd.b.by, rd.b.bx) : needleAngle;
        stepNeedle(target, 1 / 60);
        drawCompass(p, view, q.x, q.y, needleAngle);
        MagneticScene.worldBadge(p, view, q.x, q.y + view.len(46, 26),
                            `|B| = ${fmtB(rd.mag * 1000)} mT`,
                            { size: 13, col: [30, 64, 175] });
    }

    /**
     * 某一點離最近一個**磁極**的距離。導線沒有極，用它自己的位置。
     * 只在這裡用來決定「這個取樣點能不能信」。
     */
    function poleDist(sources, x, y) {
        let d = Infinity;
        for (const s of sources) {
            if (s.kind === 'wire') {
                d = Math.min(d, Math.hypot(x - s.x, y - s.y));
            } else {
                const pol = MagneticKit.magnetPoles(s);
                d = Math.min(d, Math.hypot(x - pol.n.x, y - pol.n.y),
                                Math.hypot(x - pol.s.x, y - pol.s.y));
            }
        }
        return d;
    }

    /**
     * B–r 圖：從場源中心**朝著探針的方向**取樣 |B|。
     *
     * 沿著探針的方向取樣，圖上的紅點才會**正好落在曲線上**——學生把滑鼠
     * 移到哪裡，圖就是往那個方向切一刀的剖面。取樣點直接呼叫 `fieldMag()`，
     * 和磁力線、羅盤用的是同一個場。
     *
     * ⚠️ 但條形磁鐵的兩個極是雙極模型的**奇異點**：取樣點一旦踩上去，
     *    |B| 會衝到無窮大，整張圖只剩一根針，其他部分全被壓成 0
     *    （第一版沿著水平軸取樣，就是這樣壞掉的）。所以離極太近的取樣點
     *    一律**跳過**——那個區域本來就超出模型能講的範圍，畫出來也是假的。
     */
    /**
     * 座標軸上限，挑成「好看的」數字：刻度間距取 1／2／2.5／5 ×10ⁿ，
     * 上限就是間距 × 格數，所以刻度標籤永遠是 0.05、0.10、0.15 這種。
     *
     * ⚠️ 不能只取 10 的次方去湊（第一版就是那樣）。取出來的上限讓間距變成
     *    0.0375，格線本身畫得整整齊齊，標籤卻被四捨五入成 0.04、0.08、0.11、
     *    0.16——**格線在騙人**。物理圖表上這比畫得醜嚴重得多。
     */
    function niceMax(maxB, ticks) {
        if (!(maxB > 0)) return 1;
        const raw = maxB / ticks;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const n = raw / pow;                       // 1 ≤ n < 10
        // 1／2／2.5／4／5 都是「一眼看得出規律」的間距。夾在中間的 3、6、7
        // 不要用——刻度會變成 0.03、0.06、0.09 那種讀不出節奏的數列。
        const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5
                   : n <= 4 ? 4 : n <= 5 ? 5 : 10) * pow;
        return step * ticks;
    }

    const POLE_FLOOR = 34;                 // 世界單位，約 0.75 cm
    function drawBrGraph(p, view, sources, probe) {
        const N = 84;
        const r0 = 12, r1 = 430;
        // 從中心指向探針的方向；探針正好在中心時退回 +y
        let ux = probe.x - CX, uy = probe.y - CY;
        const um = Math.hypot(ux, uy);
        if (!(um > 1e-6)) { ux = 0; uy = 1; } else { ux /= um; uy /= um; }

        const pts = [];
        let maxB = 0;
        for (let i = 0; i < N; i++) {
            const r = r0 + (r1 - r0) * i / (N - 1);
            const x = CX + ux * r, y = CY + uy * r;
            if (poleDist(sources, x, y) < POLE_FLOOR) continue;   // 奇異點附近，跳過
            const m = MagneticKit.fieldMag(sources, x, y) * 1000;
            pts.push({ x: CM(r), y: m });
            maxB = Math.max(maxB, m);
        }
        if (!(maxB > 0)) maxB = 1;
        const yMax = niceMax(maxB, 4);

        const rd = probeReading(sources, probe);
        MagneticScene.drawGraph(p, view, {
            x: 150, y: 560, w: 600, h: 205,
            xMin: 0, xMax: CM(r1), yMin: 0, yMax,
            xTicks: 5, yTicks: 4,
            xLabel: '離中心的距離 r', xUnit: 'cm',
            yLabel: '磁場 |B|', yUnit: 'mT',
            // 場源就在圖的正上方，磁力線會穿過標題；把標題那一條也蓋成底
            plate: true,
            title: '沿著探針方向的 |B|–r',
            series: [{ pts, col: [37, 99, 235], r: 2.5, join: true }],
            marker: { x: CM(rd.r), y: Math.min(rd.mag * 1000, yMax), col: [220, 38, 38] },
        });
    }

    /** 滑鼠 → 世界座標。view 只提供正向換算，這裡自己反過來。 */
    function worldFromMouse(p, view) {
        if (!(p.mouseX > 0) || !(p.mouseY > 0)) return null;
        const r = view.rect;
        if (p.mouseX < r.x || p.mouseX > r.x + r.w) return null;
        if (p.mouseY < r.y || p.mouseY > r.y + r.h) return null;
        return {
            x: (p.mouseX - view.offsetX) / view.scale,
            y: (p.mouseY - view.offsetY) / view.scale,
        };
    }

    if (typeof window !== 'undefined') {
        window.__page = {
            MAGNET, LEN_SOL, CX, CY, M_PER_UNIT, DENSITY,
            sourcesFor, probeReading, worldFromMouse,
            setProbe(x, y) { probe.x = x; probe.y = y; },
            getProbe() { return Object.assign({}, probe); },
            probes: { probe },
        };
    }
})();
