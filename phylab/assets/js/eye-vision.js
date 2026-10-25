/**
 * 👁️ 眼睛與視覺（近視、遠視、散光與矯正）
 *
 * 這一頁把眼睛簡化成「一片凸透鏡 ＋ 視網膜」：
 *   平行光 → 眼球（凸透鏡）→ 折射 → 視網膜上的像。
 * 眼睛的焦距太短，焦點落在視網膜前面，就是近視；太長，焦點落在
 * 視網膜後面，就是遠視。散光則是兩個互相垂直的方向焦距不同：這
 * 一頁取「一個方向正視、一個方向近視」，所以一個焦點落在視網膜上、
 * 另一個落在視網膜前，視網膜上一個方向清楚、另一個方向散開。
 *
 * ==========================================================================
 * ⚠️ 課本上的眼睛透鏡公式與這一頁的符號
 * ==========================================================================
 * 眼球透鏡到視網膜的距離固定是 130 個世界單位（換算成 26 mm）。
 * 眼球透鏡的焦距 f 取正（凸透鏡），物在很遠的地方，所以 u ≈ ∞，
 * 透鏡公式 1/u + 1/v = 1/f 就變成 v ≈ f：
 *
 *   正視：f = 130 → 焦點正好在視網膜
 *   近視：f =  90 → 焦點在視網膜前 40（8.0 mm）
 *   遠視：f = 180 → 焦點在視網膜後 50（10.0 mm）
 *   散光：一個方向 90（近視）、另一個方向 130（正視）→ 一個焦點在
 *         視網膜前、一個正好在視網膜上（單純近視性散光）
 *
 * 畫面是示意圖，眼睛的尺寸與焦距比例都放大了；數字卡片才是換算成 mm
 * 之後的結果。
 *
 * ==========================================================================
 * ⚠️ 矯正透鏡的算法：先讓眼鏡的像落在「眼球透鏡要的物距」
 * ==========================================================================
 * 眼鏡（焦距 f_s）把遠方平行光變成一個像，這個像就是眼球透鏡的物。
 * 眼球透鏡要讓最後的像落在視網膜（v₂ = 130），所以它需要的物距 u₂ 是
 *
 *   1/u₂ = 1/f_eye − 1/130
 *
 * 眼鏡的像在 x_I = 700 − u₂（眼球左邊 u₂ 處），而眼鏡在 x = 550，
 * 所以眼鏡的焦距 f_s = x_I − 550。近視的眼睛 f_eye 太短，u₂ 是正的、
 * x_I 落在眼鏡左邊，f_s 是負的 → 凹透鏡；遠視反過來，f_s 是正的 →
 * 凸透鏡。散光只有近視的那一個方向需要矯正（另一個方向 f_s = null，
 * 代表平的），所以是一片凹的柱面透鏡。
 *
 * ==========================================================================
 * ⚠️ 焦點在視網膜後面時，光線只畫到視網膜，再用虛線補到焦點
 * ==========================================================================
 * 光線進入眼球後，真正被接收的是視網膜上的位置；焦點若在視網膜後方，
 * 光線在視網膜上還沒有交會。畫面上把實線停在視網膜，再用虛線延伸到
 * 焦點，才不會讓人以為光線真的在眼球後面轉彎。
 */

(function () {
    'use strict';

    const EYE_LENS_X = 700;
    const RETINA_X = 830;
    const RETINA_DIST = 130;        // 眼球透鏡到視網膜：26 mm
    const SPECTACLE_X = 550;
    const AXIS_Y = 440;
    const MM = 5;                   // 1 mm = 5 個世界單位
    const EYE_CX = 740;
    const EYE_R = 105;
    // 視網膜在眼球後壁，但它的上下端必須落在眼球輪廓裡面。
    // x = 830 時圓的弦半高只有 54；直接畫到 ±105 會讓視網膜穿出眼球。
    const RETINA_HALF_H = Math.sqrt(
        EYE_R * EYE_R - (RETINA_X - EYE_CX) * (RETINA_X - EYE_CX));
    const EYE_HALF = 28;            // 眼球透鏡孔徑的半高
    const SPECTACLE_HALF = 55;
    const PUPIL_MIN = 2;
    const PUPIL_MAX = 6;
    const PULSE_SPEED = 460;
    const SCENE_RECT = { x0: 40, y0: 40, x1: 892, y1: 780 };

    const C_ASTIG1 = [37, 99, 235];     // 散光的第一個主平面：藍
    const C_ASTIG2 = [245, 158, 11];    // 散光的第二個主平面：琥珀
    const C_RETINA = [190, 18, 60];     // 視網膜：暗紅
    const C_BLUR = [225, 29, 72];       // 模糊圈：紅
    const C_IRIS = [120, 53, 15];       // 虹膜／瞳孔：棕

    const EYE_F = {
        normal: 130,
        myopia: 90,
        hyperopia: 180,
        astigma1: 90,
        astigma2: 130,
    };
    const MODE_LABEL = {
        normal: '正視',
        myopia: '近視',
        hyperopia: '遠視',
        astigma: '散光',
    };
    const MODES = ['normal', 'myopia', 'hyperopia', 'astigma'];

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function eyeFOf(mode) {
        if (mode === 'myopia') return EYE_F.myopia;
        if (mode === 'hyperopia') return EYE_F.hyperopia;
        return EYE_F.normal;
    }
    function focusX(eyeF) { return EYE_LENS_X + eyeF; }
    function offsetMmAt(fx) { return (fx - RETINA_X) / MM; }
    function yAtRetina(yEye, fx) {
        return yEye * (fx - RETINA_X) / (fx - EYE_LENS_X);
    }
    function blurHalfAt(fx, pupilHalf) {
        return Math.abs(yAtRetina(pupilHalf, fx));
    }
    function blurMmAt(fx, pupilHalf) {
        return 2 * blurHalfAt(fx, pupilHalf) / MM;
    }

    /**
     * 矯正眼鏡的焦距：讓眼球透鏡的像落在視網膜。
     * 回傳 null 代表眼球本身已經是正視（不需要眼鏡）。
     */
    function correctionF(eyeF) {
        const invU2 = 1 / eyeF - 1 / RETINA_DIST;
        if (Math.abs(invU2) < 1e-12) return null;
        const u2 = 1 / invU2;
        const xImage = EYE_LENS_X - u2;
        return xImage - SPECTACLE_X;
    }

    function signedMm(v) {
        if (Math.abs(v) < 5e-12) return '0.0';
        return (v > 0 ? '+' : '') + v.toFixed(1);
    }

    // ======================================================================
    // 光路：每一條光線都是「入射 →（眼鏡）→ 眼球透鏡 → 視網膜」
    // ======================================================================

    function makeIncoming(yEye) {
        return {
            segments: [{
                a: { x: 60, y: AXIS_Y + yEye },
                b: { x: EYE_LENS_X, y: AXIS_Y + yEye },
            }],
            yEye,
        };
    }

    function makeOutgoing(yEye, fx) {
        const yRet = yAtRetina(yEye, fx);
        return {
            segments: [{
                a: { x: EYE_LENS_X, y: AXIS_Y + yEye },
                b: { x: RETINA_X, y: AXIS_Y + yRet },
            }],
            yEye,
            yRet,
        };
    }

    /**
     * 一條完整光線。xImage 是眼鏡成像的位置；沒有眼鏡時傳 null。
     * 眼鏡的像在 xImage，光線從眼鏡到眼球透鏡要瞄準它，所以眼球上的
     * 高度由「眼鏡上的高度」按相似三角形換算。
     */
    function makeFullRay(yEye, fx, xImage) {
        const segments = [];
        let ySpectacle = yEye;
        if (xImage != null) {
            ySpectacle = yEye * (SPECTACLE_X - xImage) / (EYE_LENS_X - xImage);
            segments.push({
                a: { x: 60, y: AXIS_Y + ySpectacle },
                b: { x: SPECTACLE_X, y: AXIS_Y + ySpectacle },
            });
            segments.push({
                a: { x: SPECTACLE_X, y: AXIS_Y + ySpectacle },
                b: { x: EYE_LENS_X, y: AXIS_Y + yEye },
            });
        } else {
            segments.push({
                a: { x: 60, y: AXIS_Y + yEye },
                b: { x: EYE_LENS_X, y: AXIS_Y + yEye },
            });
        }
        const yRet = yAtRetina(yEye, fx);
        segments.push({
            a: { x: EYE_LENS_X, y: AXIS_Y + yEye },
            b: { x: RETINA_X, y: AXIS_Y + yRet },
        });
        return { segments, yEye, yRet, ySpectacle };
    }

    function pathLength(segments) {
        let total = 0;
        for (const s of segments) {
            total += Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
        }
        return total;
    }

    /** 焦點在視網膜後時，從視網膜上的交點補到焦點的那一段虛線。 */
    function focusExtension(bundle, ray) {
        if (!bundle.beyondRetina) return null;
        return {
            a: { x: RETINA_X, y: AXIS_Y + ray.yRet },
            b: { x: bundle.focusX, y: AXIS_Y },
        };
    }

    function pointOnSegments(segments, s) {
        if (!segments || segments.length === 0) return null;
        let left = Math.max(0, s);
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
            if (left <= len || i === segments.length - 1) {
                const f = len > 1e-12 ? clamp(left / len, 0, 1) : 0;
                return {
                    x: seg.a.x + (seg.b.x - seg.a.x) * f,
                    y: seg.a.y + (seg.b.y - seg.a.y) * f,
                };
            }
            left -= len;
        }
        const last = segments[segments.length - 1];
        return { x: last.b.x, y: last.b.y };
    }

    // ======================================================================
    // 狀態
    // ======================================================================

    function makeBundle(o) {
        const pupilHalf = o.pupilHalf;
        const fx = o.corrected ? RETINA_X : focusX(o.eyeF);
        const fSpec = o.corrected ? correctionF(o.eyeF) : null;
        const xImage = fSpec == null ? null : SPECTACLE_X + fSpec;
        const rays = [1, -1].map(sign => {
            const yEye = sign * pupilHalf;
            return o.outgoingOnly
                ? makeOutgoing(yEye, fx)
                : makeFullRay(yEye, fx, xImage);
        });
        return {
            eyeF: o.eyeF,
            focusX: fx,
            fSpec,
            xImage,
            color: o.color,
            tag: o.tag || '',
            pupilHalf,
            rays,
            blurHalf: blurHalfAt(fx, pupilHalf),
            blurMm: blurMmAt(fx, pupilHalf),
            beyondRetina: fx > RETINA_X + 1e-9,
        };
    }

    function spectacleOf(mode, bundles, corrected) {
        if (!corrected || mode === 'normal') return null;
        const f1 = bundles[0].fSpec;
        const f2 = bundles.length > 1 ? bundles[1].fSpec : f1;
        // 散光一定是柱面透鏡：只有其中一個主平面需要矯正，另一個是平的
        // （fSpec 為 null），所以不能只看「兩個焦距同號」就判成球面鏡。
        let type;
        if (mode === 'astigma') type = 'cylindrical';
        else type = f1 < 0 ? 'concave' : 'convex';
        const label = mode === 'myopia' ? '凹透鏡'
            : mode === 'hyperopia' ? '凸透鏡' : '柱面透鏡';
        // 柱面透鏡要畫成凹的還是凸的，看哪一個主平面被矯正。
        const active = [f1, f2].filter(f => f != null);
        const cylinder = type === 'cylindrical'
            ? (active[0] < 0 ? 'concave' : 'convex') : null;
        return { on: true, f1, f2, type, label, cylinder };
    }

    function focusMarks(state) {
        if (state.corrected && state.mode === 'astigma') {
            return [{ x: RETINA_X, text: 'F₁、F₂', align: 'center' }];
        }
        if (state.corrected || state.mode === 'normal') {
            return [{ x: RETINA_X, text: '焦點', align: 'center' }];
        }
        if (state.mode === 'astigma') {
            // 一個焦點在視網膜前、一個在視網膜上：兩張標籤往相反方向
            // 錯開（前焦點靠左、視網膜焦點靠右），才不會擠在一起。
            return [
                { x: state.bundles[0].focusX, text: 'F₁', align: 'right' },
                { x: state.bundles[1].focusX, text: 'F₂', align: 'left' },
            ];
        }
        const fx = state.bundles[0].focusX;
        return [{ x: fx, text: '焦點', align: fx > 850 ? 'right' : 'center' }];
    }

    function retinaBlurSegments(state) {
        const out = [];
        const active = [];
        state.bundles.forEach((b, i) => {
            if (b.blurHalf > 0.5) active.push(i);
        });
        // 只有一條模糊圈時就畫在視網膜上；兩條時左右對稱錯開。
        const spread = state.mode === 'astigma' && active.length > 1 ? 7 : 0;
        active.forEach((bi, k) => {
            const b = state.bundles[bi];
            const x = RETINA_X + spread * (2 * k - (active.length - 1));
            out.push({
                x,
                y1: AXIS_Y - b.blurHalf,
                y2: AXIS_Y + b.blurHalf,
                col: state.mode === 'astigma' ? b.color : C_BLUR,
                bundle: bi,
            });
        });
        return out;
    }

    function eyeState(panel) {
        panel = panel || {};
        const mode = MODES.indexOf(panel.mode) >= 0 ? panel.mode : 'normal';
        const rawPupil = Number(panel.pupil);
        const pupil = clamp(Number.isFinite(rawPupil) ? rawPupil : 4,
                            PUPIL_MIN, PUPIL_MAX);
        const pupilHalf = pupil / 2 * MM;
        const corrected = mode !== 'normal' && panel.correction === 'on';
        let bundles;
        let commonIncoming = null;

        if (mode === 'astigma') {
            if (corrected) {
                bundles = [
                    makeBundle({
                        eyeF: EYE_F.astigma1, color: C_ASTIG1, tag: 'F₁',
                        pupilHalf, corrected: true, outgoingOnly: false,
                    }),
                    makeBundle({
                        eyeF: EYE_F.astigma2, color: C_ASTIG2, tag: 'F₂',
                        pupilHalf, corrected: true, outgoingOnly: false,
                    }),
                ];
            } else {
                // 同一個瞳孔裡的兩個主平面共用入射光；分開的只有眼球透鏡
                // 之後的兩條路徑。畫面上才不會有兩組幾乎重合的入射線。
                commonIncoming = [1, -1].map(sign => makeIncoming(sign * pupilHalf));
                bundles = [
                    makeBundle({
                        eyeF: EYE_F.astigma1, color: C_ASTIG1, tag: 'F₁',
                        pupilHalf, corrected: false, outgoingOnly: true,
                    }),
                    makeBundle({
                        eyeF: EYE_F.astigma2, color: C_ASTIG2, tag: 'F₂',
                        pupilHalf, corrected: false, outgoingOnly: true,
                    }),
                ];
            }
        } else {
            bundles = [makeBundle({
                eyeF: eyeFOf(mode),
                color: mode === 'normal' ? C_ASTIG2 : C_ASTIG2,
                tag: '',
                pupilHalf,
                corrected,
                outgoingOnly: false,
            })];
        }

        const pulsePaths = bundles.map(b => {
            const upper = b.rays[0];
            if (commonIncoming) {
                return commonIncoming[0].segments.concat(upper.segments);
            }
            return upper.segments;
        });

        return {
            mode,
            label: MODE_LABEL[mode],
            corrected,
            pupil,
            pupilHalf,
            eyeFs: bundles.map(b => b.eyeF),
            focusXs: bundles.map(b => b.focusX),
            offsetsMm: bundles.map(b => offsetMmAt(b.focusX)),
            blurMms: bundles.map(b => b.blurMm),
            bundles,
            commonIncoming,
            pulsePaths,
            spectacle: spectacleOf(mode, bundles, corrected),
            focusMarks: focusMarks({ mode, corrected, bundles }),
            blurSegments: retinaBlurSegments({
                mode, corrected, bundles,
            }),
        };
    }

    function pulsePoint(state, t, i) {
        const segs = state.pulsePaths[i] || state.pulsePaths[0];
        if (!segs || segs.length === 0) return null;
        const total = pathLength(segs);
        if (!(total > 0)) return null;
        let s = (t * PULSE_SPEED + i * 0.5 * total) % total;
        if (s < 0) s += total;
        return pointOnSegments(segs, s);
    }

    // ======================================================================
    // 畫面
    // ======================================================================

    function drawEyeBody(p, view) {
        const cx = view.toScreenX(EYE_CX);
        const cy = view.toScreenY(AXIS_Y);
        const rx = OpticsScene.L(view, EYE_R);
        const ry = rx;

        p.push();
        p.noStroke();
        p.fill(236, 253, 245, 120);
        p.ellipse(cx, cy, rx * 2, ry * 2);
        p.pop();

        p.push();
        p.noFill();
        OpticsScene.strokeOn(p, OpticsScene.C_EYE, OpticsScene.L(view, 2.6, 1.8));
        p.ellipse(cx, cy, rx * 2, ry * 2);
        p.pop();

        // 角膜（眼球最前面那一小段，畫粗一點）
        p.push();
        p.noFill();
        OpticsScene.strokeOn(p, OpticsScene.C_EYE, OpticsScene.L(view, 5, 3));
        p.arc(cx, cy, rx * 2, ry * 2, Math.PI - 0.48, Math.PI + 0.48);
        p.pop();

        // 視網膜：眼球後壁的一條厚線（長度是圓在 x=830 的弦，不是直徑）
        p.push();
        OpticsScene.strokeOn(p, C_RETINA, OpticsScene.L(view, 5.5, 3));
        p.line(view.toScreenX(RETINA_X),
               view.toScreenY(AXIS_Y - RETINA_HALF_H),
               view.toScreenX(RETINA_X),
               view.toScreenY(AXIS_Y + RETINA_HALF_H));
        p.pop();
    }

    function drawCylindricalLens(p, view, type) {
        OpticsScene.drawThinLens(p, view, SPECTACLE_X, AXIS_Y,
                                 SPECTACLE_HALF, type || 'convex', {
                                     halfW: 13,
                                     col: [13, 148, 136],
                                     fill: [204, 251, 241],
                                     alpha: 170,
                                     w: 2.8,
                                 });
        // 幾條垂直細線，讓它看起來是一片柱面透鏡，而不是球面透鏡。
        for (const dx of [-6, 0, 6]) {
            OpticsScene.dashed(p, view,
                { x: SPECTACLE_X + dx, y: AXIS_Y - 38 },
                { x: SPECTACLE_X + dx, y: AXIS_Y + 38 },
                [13, 148, 136], { w: 1.2, dash: [5, 5] });
        }
    }

    function drawScene(p, view, t, panel, state) {
        const OS = OpticsScene;

        // 主軸
        OS.dashed(p, view, { x: 60, y: AXIS_Y }, { x: 885, y: AXIS_Y },
                  OS.C_NORMAL, { w: 1.3 });
        OS.worldBadge(p, view, 70, AXIS_Y - 18, '主軸',
                      { size: 12, col: OS.C_NORMAL, align: 'left' });

        // 眼睛本體（先畫，光線疊在上面）
        drawEyeBody(p, view);

        // 入射光（散光未矯正時，兩個主平面共用同一組入射線）
        if (state.commonIncoming) {
            for (const ray of state.commonIncoming) {
                for (const seg of ray.segments) {
                    OS.line(p, view, seg.a, seg.b, C_ASTIG2,
                            { w: 2.6, arrowAt: 0.55, head: 10 });
                }
            }
        }

        // 每一條光線（含眼鏡）
        for (const b of state.bundles) {
            for (const ray of b.rays) {
                for (const seg of ray.segments) {
                    OS.line(p, view, seg.a, seg.b, b.color,
                            { w: 2.5, arrowAt: 0.58, head: 10 });
                }
            }
            // 焦點在視網膜後：實線停在視網膜，虛線補到焦點
            for (const ray of b.rays) {
                const ext = focusExtension(b, ray);
                if (ext) OS.dashed(p, view, ext.a, ext.b, b.color, { w: 1.7 });
            }
        }

        // 矯正眼鏡
        if (state.spectacle) {
            if (state.spectacle.type === 'cylindrical') {
                drawCylindricalLens(p, view, state.spectacle.cylinder);
            } else {
                OS.drawThinLens(p, view, SPECTACLE_X, AXIS_Y,
                                SPECTACLE_HALF, state.spectacle.type, {
                                    halfW: 14,
                                    col: [13, 148, 136],
                                    fill: [204, 251, 241],
                                    alpha: 170,
                                    w: 2.8,
                                });
            }
            OS.worldBadge(p, view, SPECTACLE_X, 330,
                          `矯正眼鏡（${state.spectacle.label}）`,
                          { size: 13, col: [13, 148, 136], align: 'center' });
        }

        // 眼球透鏡
        OS.drawThinLens(p, view, EYE_LENS_X, AXIS_Y, EYE_HALF, 'convex', {
            halfW: 10,
            col: OS.C_EYE,
            fill: [219, 234, 254],
            alpha: 150,
            w: 2.8,
        });

        // 瞳孔：兩條虹膜把孔徑夾出來
        const irisGap = state.pupilHalf;
        for (const sign of [-1, 1]) {
            const y1 = AXIS_Y + sign * (irisGap + 5);
            const y2 = AXIS_Y + sign * (irisGap + 23);
            OS.line(p, view, { x: EYE_LENS_X - 7, y: y1 },
                    { x: EYE_LENS_X - 7, y: y2 }, C_IRIS, { w: 6 });
        }

        // 焦點（散光的兩個主平面用光線的顏色，才對得起來）
        for (let i = 0; i < state.focusMarks.length; i++) {
            const mk = state.focusMarks[i];
            const col = state.mode === 'astigma' && !state.corrected
                ? state.bundles[i].color : OS.C_NORMAL;
            OS.drawDot(p, view, mk.x, AXIS_Y, col, 6);
            OS.worldBadge(p, view, mk.x, 505, mk.text,
                          { size: 12, col, align: mk.align });
        }

        // 視網膜上的模糊圈：先墊一圈白色，才不會和暗紅色的視網膜混在一起
        for (const seg of state.blurSegments) {
            OS.line(p, view, { x: seg.x, y: seg.y1 }, { x: seg.x, y: seg.y2 },
                    [255, 255, 255], { w: 12 });
            OS.line(p, view, { x: seg.x, y: seg.y1 }, { x: seg.x, y: seg.y2 },
                    seg.col, { w: 7 });
        }
        // 對焦在視網膜上的主平面：模糊圈縮成一點。散光時要留著這一顆，
        // 另一條模糊圈才對比得出來「一個方向清楚、一個方向散開」。
        state.bundles.forEach((b, i) => {
            if (b.blurHalf > 0.5) return;
            const col = state.mode === 'astigma' && !state.corrected
                ? b.color : C_BLUR;
            OS.drawDot(p, view, RETINA_X, AXIS_Y, [255, 255, 255], 10);
            OS.drawDot(p, view, RETINA_X, AXIS_Y, col, 6);
        });

        // 標籤
        OS.worldBadge(p, view, EYE_CX, 600, '眼球',
                      { size: 13, col: OS.C_EYE, align: 'center' });
        OS.worldBadge(p, view, EYE_LENS_X, 300, '眼球透鏡',
                      { size: 12, col: OS.C_EYE, align: 'center' });
        OS.worldBadge(p, view, RETINA_X, 320, '視網膜',
                      { size: 12, col: C_RETINA, align: 'center' });
        OS.worldBadge(p, view, EYE_LENS_X - 9,
                      AXIS_Y + state.pupilHalf + 39, '瞳孔',
                      { size: 11, col: C_IRIS, align: 'center' });

        // 左上角的狀態與「示意圖」提醒
        OS.worldBadge(p, view, 70, 84, `${state.label}眼`,
                      { size: 16, col: OS.C_LABEL, align: 'left' });
        OS.worldBadge(p, view, 70, 120, '示意圖，比例已放大',
                      { size: 11, col: OS.C_NORMAL, align: 'left' });
        if (state.mode === 'astigma') {
            OS.worldBadge(p, view, 70, 152, '藍／橙：散光的兩個主平面',
                          { size: 11, col: OS.C_NORMAL, align: 'left' });
        }

        // 光脈衝
        if (panel.started) {
            for (let i = 0; i < state.pulsePaths.length; i++) {
                const q = pulsePoint(state, t, i);
                if (q) {
                    OS.drawPulse(p, view, q.x, q.y,
                                 state.bundles[i].color, { r: 8 });
                }
            }
        }
    }

    // ======================================================================
    // 頁面
    // ======================================================================

    const CARD = (label, id, unit, highlight) => ({ label, id, unit, highlight });

    function cardValues(state) {
        const eyeF = state.eyeFs.map(f => (f / MM).toFixed(1));
        const focus = state.corrected || state.mode === 'normal'
            ? ['0.0'] : state.offsetsMm.map(signedMm);
        const blur = state.corrected || state.mode === 'normal'
            ? ['0.0'] : state.blurMms.map(v => v.toFixed(1));
        return {
            cardState: state.label,
            cardEyeF: eyeF.join('／'),
            cardFocus: focus.join('／'),
            cardBlur: blur.join('／'),
            cardCorrection: state.spectacle
                ? state.spectacle.label
                : (state.mode === 'normal' ? '不需要' : '無'),
            cardPupil: state.pupil.toFixed(1),
        };
    }

    function titleTextOf(state) {
        if (state.mode === 'normal') {
            return '正視眼　平行光聚焦在視網膜上';
        }
        if (state.corrected) {
            const two = state.mode === 'astigma';
            return `${state.label}眼　${state.spectacle.label}矯正後`
                 + `${two ? '兩焦點都' : '焦點'}回到視網膜`;
        }
        if (state.mode === 'astigma') {
            const front = state.bundles.find(
                b => b.focusX < RETINA_X - 1e-9);
            const back = state.bundles.find(
                b => b.focusX > RETINA_X + 1e-9);
            const onRetina = state.bundles.some(
                b => Math.abs(b.focusX - RETINA_X) < 1e-9);
            const bits = [];
            if (onRetina) bits.push('一個焦點在視網膜上');
            if (front) {
                bits.push('另一個在視網膜前 '
                    + Math.abs(offsetMmAt(front.focusX)).toFixed(1) + ' mm');
            }
            if (back) {
                bits.push('另一個在視網膜後 '
                    + offsetMmAt(back.focusX).toFixed(1) + ' mm');
            }
            const blur = state.blurMms.filter(v => v > 0.05)
                .map(v => v.toFixed(1)).join('／');
            return `散光眼　${bits.join('、')}　模糊圈 ${blur} mm`;
        }
        const where = state.mode === 'myopia' ? '前' : '後';
        const mm = Math.abs(state.offsetsMm[0]).toFixed(1);
        return `${state.label}眼　焦點在視網膜${where} ${mm} mm`
             + `　模糊圈 ${state.blurMms[0].toFixed(1)} mm`;
    }

    OpticsScene.run({
        formula: '\\frac{1}{u}+\\frac{1}{v}=\\frac{1}{f}',
        formulaFallback: '1/u + 1/v = 1/f',

        controls: {
            selects: [
                {
                    key: 'mode', label: '眼睛的狀態', def: 'normal', live: true,
                    options: [
                        { v: 'normal', t: '正視眼' },
                        { v: 'myopia', t: '近視眼' },
                        { v: 'hyperopia', t: '遠視眼' },
                        { v: 'astigma', t: '散光眼' },
                    ],
                },
                {
                    key: 'correction', label: '矯正眼鏡', def: 'off', live: true,
                    when: p => p.mode !== 'normal',
                    options: [
                        { v: 'off', t: '不戴眼鏡' },
                        { v: 'on', t: '戴上矯正眼鏡' },
                    ],
                },
            ],
            sliders: [
                { key: 'pupil', label: '瞳孔孔徑', def: 4, min: 2, max: 6,
                  step: 0.5, unit: 'mm', dec: 1 },
            ],
        },

        cards: [
            CARD('狀態', 'cardState', '', true),
            CARD('眼球焦距', 'cardEyeF', 'mm'),
            CARD('焦點偏移', 'cardFocus', 'mm'),
            CARD('模糊圈直徑', 'cardBlur', 'mm'),
            CARD('矯正方式', 'cardCorrection', ''),
            CARD('瞳孔孔徑', 'cardPupil', 'mm'),
        ],

        model(t, panel) {
            return eyeState(panel);
        },

        values(t, panel, state) {
            return cardValues(state);
        },

        titleText(t, panel, state) {
            return titleTextOf(state);
        },

        draw(p, view, t, panel, sol, state) {
            drawScene(p, view, t, panel, state);
        },
    });

    // ======================================================================
    // 給驗證器的出口
    // ======================================================================
    if (typeof window !== 'undefined') {
        window.__page = {
            EYE_LENS_X, RETINA_X, RETINA_DIST, SPECTACLE_X, AXIS_Y,
            MM, EYE_CX, EYE_R, RETINA_HALF_H, EYE_HALF, SPECTACLE_HALF,
            PUPIL_MIN, PUPIL_MAX, PULSE_SPEED, SCENE_RECT,
            EYE_F, MODE_LABEL, MODES,
            clamp, eyeFOf, focusX, offsetMmAt, yAtRetina, blurHalfAt,
            blurMmAt, correctionF, signedMm, makeIncoming, makeOutgoing,
            makeFullRay, pathLength, pointOnSegments, focusExtension, makeBundle,
            spectacleOf, focusMarks, retinaBlurSegments, eyeState,
            pulsePoint, cardValues, titleTextOf, drawCylindricalLens,
            drawScene,
        };
    }
})();
