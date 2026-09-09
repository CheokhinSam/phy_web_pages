# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website (samexplorer.dev) with an interactive physics simulation lab built with Jekyll and HTML5 Canvas. Simulations run in-browser with no server-side processing. UI and content are in Traditional Chinese (zh-TW).

## Site Structure

```
samexplorer.dev/           ← root landing page (pure HTML, no Jekyll)
samexplorer.dev/phylab/    ← physics lab (Jekyll, baseurl: /phylab)
```

- `index.html` — root landing page (pure HTML, no front matter)
- `phylab/` — all physics lab pages and assets
- `_experiments/` — Jekyll collection (at root, outputs to /phylab/experiments/)
- `_layouts/` — Jekyll layouts (at root, used by experiments and theme pages)

## Development Commands

```bash
# Install dependencies (first time only)
bundle install

# Run local dev server with live reload
bundle exec jekyll serve

# Build static site to _site/
bundle exec jekyll build
```

## Architecture

### Jekyll Collections

Experiments are defined in `_experiments/` as markdown files with YAML frontmatter. The `theme` field determines which category page displays them:

- `mechanics` → phylab/mechanics.html
- `electricity` → phylab/electricity.html
- `waves` → phylab/waves.html
- `thermal` → phylab/thermal.html
- `magnetism` → phylab/magnetism.html
- `modern-physics` → phylab/modern-physics.html
- `astrophysics` → phylab/astrophysics.html

Each theme page filters experiments by theme and sorts by `order`.

### Current Experiments (27 total)

**力學 mechanics (14)**
| order | Title |
|-------|-------|
| 1 | 🚶 參考系（Canvas 版） |
| 2 | 🚀 加速度 |
| 3 | 📈 位移時間圖 |
| 4 | 📈 速度時間圖 |
| 5 | 🍎 自由落體運動 |
| 6 | ⚖️ 力的合成與分解 |
| 7 | ⚛️ 牛頓第二運動定律 |
| 8 | 💥 兩球碰撞與動量守恆 |
| 9 | ⚾ 拋體運動模擬 |
| 10 | 🔮 單擺運動實驗 |
| 11 | 🪂 終端速度 |
| 12 | 🌌 萬有引力定律 |
| 13 | 🚶🚲🚗 參考系（p5.js 版） |
| 14 | 🔮 單擺運動實驗 2 |

**電學 electricity (2)**
| 1 | ⚡ 歐姆定律 |
| 2 | 💡 串聯電路與並聯電路 |

**磁學 magnetism (2)**
| 1 | ⚙️ 直流電動機 |
| 2 | 🧲 洛倫茲力 |

**波動 waves (5)**
| 1 | 🌊 橫波與縱波 |
| 2 | 🌊 水波的反射 |
| 3 | 🌊 水波折射 |
| 4 | 🌀 彈簧振子 |
| 5 | 🌀 簡諧運動圖像 |

**熱學 thermal (2)**
| 1 | 🔥 熱傳導 |
| 2 | 🌊 熱對流 |

**天文物理 astrophysics (1)**
| 1 | 🪐 克卜勒定律 |

**近代物理 modern-physics (1)**
| 1 | 🔬 光電效應 |

### Experiment File Structure

Every experiment in `_experiments/*.md` follows this pattern:

```yaml
---
layout: experiment
title: "Emoji + Title"
js_file: "/assets/js/simulation-name.js"  # loaded via relative_url → /phylab/assets/js/...
order: N          # determines sort position within theme
theme: "category" # must match a theme page
parent_url: "/theme-page/"  # optional: back button target
description: "一句話描述"  # used in search results and cards
keywords: "關鍵字1 關鍵字2 關鍵字3"  # space-separated, used for search
questions: |      # optional: rendered in "探究思考" tab
  Markdown content
---
```

The markdown body becomes the "實驗描述" tab content.

**keywords 欄位：**
- 用空格分隔多個關鍵字
- 包含實驗的別名、常用術語、同義詞
- 用於搜尋功能（首頁 + 分類頁）
- 範例：位移時間圖 → `"x-t圖 位置時間 運動圖形 斜率 等速 加速"`

### Layout

`_layouts/experiment.html` (root level) provides a three-column layout:
- **Left sidebar**: navigation, experiment title, control panel (injected by JS)
- **Center**: `<canvas id="physicsCanvas">` for the simulation
- **Right sidebar**: tabs for description, live data dashboard, and questions

### JavaScript Simulations

Each simulation is a standalone JS file in `phylab/assets/js/`. They:
1. Find `#physicsCanvas` and get its 2D context
2. Inject HTML controls into `#controlPanel`
3. Run an animation loop drawing to the canvas
4. Update data cards in the right sidebar (e.g., `#cardTime`, `#cardX`)

**HiDPI/Retina 支援：**
`PhysicsUtils.setupResize()` 自動處理 HiDPI。使用 `canvas.cssWidth` / `canvas.cssHeight` 取得 CSS 像素（定位用），`PhysicsUtils.beginFrame(ctx, canvas)` 每幀重設 transform + 清除畫布：
```javascript
const resizeCanvas = PhysicsUtils.setupResize(canvas);
// 渲染迴圈中：
PhysicsUtils.beginFrame(ctx, canvas);
const W = canvas.cssWidth;
const H = canvas.cssHeight;
```

### Search Functionality

Both index and theme pages have search boxes:
- **Index page**: Searches all experiments across all themes
- **Theme pages**: Filters experiments within current theme
- **Search fields**: title + description + keywords
- **Multi-keyword**: Space-separated terms (all must match)
- **Implementation**: Client-side JavaScript filtering

### Styles

- `phylab/assets/css/main-style.css` — landing/category pages (includes search box styles)
- `phylab/assets/css/lab-style.css` — experiment pages (three-column layout)

### External Dependencies (CDN)

- MathJax 3.2.2 — LaTeX rendering in experiment descriptions
- Chart.js 4.4.7 — real-time data visualization
- Inter font (Google Fonts)

## Adding a New Experiment

**使用 `/new-experiment` skill（推薦）：**
1. 自動詢問實驗標題、描述、控制參數、視覺化方式
2. 自動計算 order、parent_url、檔名
3. 使用 PhysicsUtils 工具庫生成完整程式碼
4. 建立 JS + MD 檔案

**手動建立：**
1. 複製 `phylab/assets/js/_template.js` → `phylab/assets/js/simulation-name.js`
2. 修改 `initTEMPLATE()` 函數名為 `initXxx()`
3. 填入物理邏輯（`calcPhysics`）和視覺化（`drawSim`）
4. 建立 `_experiments/NN-name.md`（含 `keywords` 欄位）
5. 實驗自動出現在對應的 theme 頁面

**模板結構（使用 PhysicsUtils）：**
- A. 初始化 — `PhysicsUtils.initCanvas()` + HiDPI 支援
- B. 狀態變數 — 定義可變參數
- C. 控制面板 — 用 `.control-box` 注入，底部用 `PhysicsUtils.formulaBox()` 放公式
- D. 數據面板 — `PhysicsUtils.createDataCards()` 注入，至少 4 張卡片
- E. 圖表（如適用）— `PhysicsUtils.createChart()`
- F. 物理計算 — `calcPhysics()` 函數
- G. 渲染 — `drawSim()` 函數
- H. 主迴圈 — dt clamping (max 0.1s) + DOM guard
- I. 按鈕事件 — `PhysicsUtils.setupStartBtn/PauseBtn/ResetBtn()`
- J. 啟動 — `requestAnimationFrame(loop)` + `PhysicsUtils.setupCleanup()`

**必須遵守：**
- 使用 `PhysicsUtils` 工具庫處理共用邏輯
- 使用 `requestAnimationFrame` + dt clamping (max 0.1s)
- 加入 `document.contains(guardEl)` DOM 檢查
- 加入 `PhysicsUtils.setupCleanup()` 註冊 pagehide 清理
- 控制項用 `.control-box` class
- 使用 `PhysicsUtils.setupResize()` + `beginFrame()` 自動 HiDPI，用 `canvas.cssWidth/cssHeight` 定位

**視覺風格：**
- 建立或修改實驗時，必須先讀取 `.claude/experiment-style-guide.md`
- 配色、字體、按鈕、卡片、圖表、動畫引擎等規範都在 style guide 中

## Key Files

- `index.html` — root landing page (pure HTML, links to /phylab/)
- `_config.yml` — Jekyll config, baseurl: /phylab, defines the `experiments` collection
- `_layouts/experiment.html` — shared experiment page template
- `_layouts/theme.html` — category page template (with search)
- `phylab/index.html` — physics lab homepage with search and links to 7 theme categories
- `phylab/assets/js/physics-utils.js` — shared utility library (initCanvas, drawArrow, drawBall, bindSlider, createDataCards, createChart, formulaBox, typesetMath, etc.)
- `phylab/assets/js/_template.js` — experiment template using PhysicsUtils
- `phylab/assets/css/main-style.css` — landing/category pages (includes search styles)
- `phylab/assets/css/lab-style.css` — experiment page styles (controls, tabs, data cards)
- `.claude/experiment-style-guide.md` — visual style guide for experiments
- `.claude/experiment-quality-checklist.md` — quality checklist for new experiments
- `.claude/commands/new-experiment.md` — skill for creating new experiments
