(function () {
  const COLS = 10;
  const ROWS = 20;
  const OPTION_ORDER = ["A", "B", "C", "D", "E"];
  const OPTION_COLUMN_START = 2;
  const DROP_INTERVAL = 700;
  const STAGE_DURATION = 75;

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const timerEl = document.getElementById("timer");
  const chapterEl = document.getElementById("chapter-label");
  const stageEl = document.getElementById("stage-label");
  const trustEl = document.getElementById("trust-score");
  const clarityEl = document.getElementById("clarity-score");
  const resultsEl = document.getElementById("results-score");
  const feedbackEl = document.getElementById("feedback-text");
  const scenarioTextEl = document.getElementById("scenario-text");
  const optionsEls = {
    A: document.getElementById("opt-A"),
    B: document.getElementById("opt-B"),
    C: document.getElementById("opt-C"),
    D: document.getElementById("opt-D"),
    E: document.getElementById("opt-E")
  };
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const accuracyText = document.getElementById("accuracy-text");
  const distributionText = document.getElementById("distribution-text");
  const reflectionList = document.getElementById("reflection-list");
  const resultsCanvas = document.getElementById("results-canvas");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const nextBtn = document.getElementById("next-btn");
  const exportBtn = document.getElementById("export-btn");
  const closeOverlayBtn = document.getElementById("close-overlay");
  const touchLeftBtn = document.getElementById("touch-left");
  const touchRightBtn = document.getElementById("touch-right");
  const touchDownBtn = document.getElementById("touch-down");

  let animationId = null;
  let levels = [];
  let stageIndex = 0;
  let currentStage = null;
  let board = createBoard(COLS, ROWS);
  let currentPiece = null;
  let lastFrameTime = 0;
  let dropCounter = 0;
  let state = "ready";
  let timeRemaining = STAGE_DURATION;
  let timerInterval = null;
  let scenarioQueue = [];
  let scenarioPointer = 0;
  let stageStats = null;

  const FALLBACK_LEVELS = [...getFallbackLevels()];

  const SHAPES = createShapeSet();

  function init() {
    loadLevels()
      .then((data) => {
        levels = data && data.length ? data : FALLBACK_LEVELS;
      })
      .catch((err) => {
        console.warn("加载 levels.json 失败，使用内置关卡", err);
        levels = FALLBACK_LEVELS;
      })
      .finally(() => {
        if (!levels.length) {
          levels = FALLBACK_LEVELS;
        }
        stageIndex = 0;
        prepareStage(stageIndex);
        bindEvents();
        draw();
      });
  }

  function bindEvents() {
    document.addEventListener("keydown", handleKeyDown);
    startBtn.addEventListener("click", () => {
      if (state === "running") return;
      restartStage();
    });
    pauseBtn.addEventListener("click", () => {
      if (state === "running") {
        setState("paused");
      } else if (state === "paused") {
        setState("running");
      }
    });
    nextBtn.addEventListener("click", () => {
      goToNextStage();
    });
    exportBtn.addEventListener("click", handleExport);
    closeOverlayBtn.addEventListener("click", () => {
      overlay.hidden = true;
    });

    const touchHandler = (dir) => () => {
      if (state !== "running") return;
      if (dir === "left") moveHorizontal(-1);
      if (dir === "right") moveHorizontal(1);
      if (dir === "down") softDrop();
    };
    touchLeftBtn.addEventListener("click", touchHandler("left"));
    touchRightBtn.addEventListener("click", touchHandler("right"));
    touchDownBtn.addEventListener("click", touchHandler("down"));
  }
  function handleKeyDown(event) {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === "p") {
      if (state === "running") {
        setState("paused");
      } else if (state === "paused") {
        setState("running");
      }
      return;
    }
    if (key === "r") {
      restartStage();
      return;
    }
    if (state !== "running") return;
    switch (event.key) {
      case "ArrowLeft":
        moveHorizontal(-1);
        break;
      case "ArrowRight":
        moveHorizontal(1);
        break;
      case "ArrowDown":
        softDrop();
        break;
      default:
        break;
    }
  }

  function createBoard(cols, rows) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
  }

  function prepareStage(index) {
    currentStage = levels[index % levels.length];
    chapterEl.textContent = `章节：${currentStage.chapter}`;
    stageEl.textContent = `关卡：${currentStage.stage}`;
    feedbackEl.textContent = "移动到 A–E 列，放下情境方块来做决策。";
    overlay.hidden = true;
    board = createBoard(COLS, ROWS);
    scenarioQueue = [currentStage];
    scenarioPointer = 0;
    stageStats = {
      trust: 0,
      clarity: 0,
      results: 0,
      distribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      correct: 0,
      total: 0,
      records: []
    };
    updateScores();
    updateScenarioCard(getNextScenarioPreview());
    timeRemaining = STAGE_DURATION;
    timerEl.textContent = `${timeRemaining}s`;
    setState("ready");
  }

  function restartStage() {
    cancelAnimationFrame(animationId);
    setState("running");
    board = createBoard(COLS, ROWS);
    scenarioPointer = 0;
    stageStats.trust = 0;
    stageStats.clarity = 0;
    stageStats.results = 0;
    stageStats.distribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    stageStats.correct = 0;
    stageStats.total = 0;
    stageStats.records = [];
    updateScores();
    feedbackEl.textContent = "情境开始，下落方块即代表你的选择。";
    feedbackEl.style.color = "";
    timeRemaining = STAGE_DURATION;
    timerEl.textContent = `${timeRemaining}s`;
    currentPiece = spawnPiece(nextScenario());
    updateScenarioCard(getNextScenarioPreview());
    startTimer();
    lastFrameTime = 0;
    dropCounter = 0;
    runLoop();
  }

  function goToNextStage() {
    stageIndex = (stageIndex + 1) % levels.length;
    prepareStage(stageIndex);
  }

  function setState(nextState) {
    state = nextState;
    if (state === "paused") {
      cancelAnimationFrame(animationId);
    } else if (state === "running") {
      runLoop();
    }
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (state !== "running") return;
      timeRemaining -= 1;
      if (timeRemaining <= 0) {
        timeRemaining = 0;
        timerEl.textContent = `0s`;
        finishStage("time-up");
        return;
      }
      timerEl.textContent = `${timeRemaining}s`;
    }, 1000);
  }

  function runLoop(timestamp = 0) {
    if (state !== "running") return;
    animationId = requestAnimationFrame(runLoop);
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    dropCounter += delta;
    if (dropCounter > DROP_INTERVAL) {
      softDrop();
    }
    draw();
  }

  function softDrop() {
    if (!currentPiece) return;
    if (isValidPosition(currentPiece, 0, 1)) {
      currentPiece.y += 1;
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }

  function moveHorizontal(dir) {
    if (!currentPiece) return;
    if (isValidPosition(currentPiece, dir, 0)) {
      currentPiece.x += dir;
    }
  }

  function isValidPosition(piece, offsetX, offsetY) {
    const cells = getCells(piece);
    for (const cell of cells) {
      const x = cell.x + offsetX;
      const y = cell.y + offsetY;
      if (x < 0 || x >= COLS || y >= ROWS) {
        return false;
      }
      if (y >= 0 && board[y][x]) {
        return false;
      }
    }
    return true;
  }

  function getCells(piece) {
    const rotation = piece.shape.rotations[piece.rotationIndex];
    return rotation.map(({ x, y }) => ({ x: x + piece.x, y: y + piece.y }));
  }

  function spawnPiece(scenario) {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const rotationIndex = Math.floor(Math.random() * shape.rotations.length);
    const spawnX = Math.floor(COLS / 2) - 2;
    const spawnY = -2;
    return {
      shape,
      rotationIndex,
      x: spawnX,
      y: spawnY,
      scenario,
      id: `${scenario.chapter}-${scenario.stage}-${Date.now()}`
    };
  }

  function nextScenario() {
    const scenario = scenarioQueue[scenarioPointer % scenarioQueue.length];
    scenarioPointer += 1;
    return scenario;
  }

  function getNextScenarioPreview() {
    return scenarioQueue[scenarioPointer % scenarioQueue.length];
  }

  function lockPiece() {
    const cells = getCells(currentPiece);
    let overflow = false;
    cells.forEach(({ x, y }) => {
      if (y < 0) {
        overflow = true;
      } else if (board[y][x]) {
        overflow = true;
      } else {
        board[y][x] = {
          color: currentPiece.shape.color,
          scenarioId: currentPiece.id
        };
      }
    });

    evaluateLanding(currentPiece, cells);
    currentPiece = null;

    if (overflow) {
      finishStage("overflow");
      return;
    }

    const newPiece = spawnPiece(nextScenario());
    if (!isValidPosition(newPiece, 0, 0)) {
      finishStage("overflow");
      return;
    }
    currentPiece = newPiece;
    updateScenarioCard(getNextScenarioPreview());
  }

  function evaluateLanding(piece, cells) {
    const columns = cells.map((cell) => cell.x).filter((x) => x >= 0 && x < COLS);
    if (!columns.length) return;
    const min = Math.min(...columns);
    const max = Math.max(...columns);
    const center = (min + max) / 2;
    const selectedOption = mapColumnToOption(center);
    const scenario = piece.scenario;
    const isCorrect = selectedOption === scenario.best;
    const impact = scenario.impact[selectedOption] || { Trust: 0, Clarity: 0, Results: 0 };

    stageStats.distribution[selectedOption] += 1;
    stageStats.total += 1;
    if (isCorrect) stageStats.correct += 1;
    stageStats.trust += impact.Trust || 0;
    stageStats.clarity += impact.Clarity || 0;
    stageStats.results += impact.Results || 0;
    updateScores();

    const feedback = scenario.feedback[selectedOption] || "已记录选择";
    feedbackEl.textContent = `${selectedOption} 列：${feedback}`;
    feedbackEl.style.color = isCorrect ? "var(--success)" : "var(--danger)";

    stageStats.records.push({
      timestamp: new Date().toISOString(),
      chapter: scenario.chapter,
      stage: scenario.stage,
      scenario: scenario.scenario,
      option: selectedOption,
      best: scenario.best,
      correct: isCorrect,
      impact
    });

    if (isCorrect) {
      clearRow(Math.max(...cells.map((c) => c.y)));
    } else {
      addPenaltyRow(mapOptionToColumn(scenario.best));
    }

    checkTopOverflow();
  }

  function mapColumnToOption(column) {
    let closest = OPTION_ORDER[0];
    let minDistance = Infinity;
    OPTION_ORDER.forEach((option, idx) => {
      const target = OPTION_COLUMN_START + idx;
      const distance = Math.abs(column - target);
      if (distance < minDistance) {
        minDistance = distance;
        closest = option;
      }
    });
    return closest;
  }

  function mapOptionToColumn(option) {
    const idx = OPTION_ORDER.indexOf(option);
    if (idx === -1) return OPTION_COLUMN_START + 2;
    return OPTION_COLUMN_START + idx;
  }

  function clearRow(rowIndex) {
    if (rowIndex < 0 || rowIndex >= ROWS) return;
    board.splice(rowIndex, 1);
    board.unshift(Array(COLS).fill(0));
  }

  function addPenaltyRow(gapColumn) {
    const gap = Math.min(Math.max(gapColumn, 0), COLS - 1);
    board.shift();
    const penaltyRow = Array.from({ length: COLS }, (_, col) => {
      if (col === gap) return 0;
      return { color: "#7f1d1d", penalty: true };
    });
    board.push(penaltyRow);
  }

  function checkTopOverflow() {
    const overflow = board[0].some(Boolean);
    if (overflow) {
      finishStage("overflow");
    }
  }

  function updateScores() {
    trustEl.textContent = stageStats.trust;
    clarityEl.textContent = stageStats.clarity;
    resultsEl.textContent = stageStats.results;
  }

  function updateScenarioCard(scenario) {
    if (!scenario) return;
    scenarioTextEl.textContent = scenario.scenario;
    OPTION_ORDER.forEach((key) => {
      optionsEls[key].textContent = scenario.options[key];
    });
  }

  function finishStage(reason) {
    setState("ended");
    clearInterval(timerInterval);
    timerEl.textContent = `${timeRemaining}s`;
    showOverlay(reason);
  }

  function showOverlay(reason) {
    const total = stageStats.total || 1;
    const accuracy = stageStats.correct / total;
    overlayTitle.textContent = reason === "time-up" ? "时间到" : "关卡结果";
    accuracyText.textContent = `正确率：${(accuracy * 100).toFixed(0)}% (${stageStats.correct}/${total})`;
    distributionText.textContent = `选项分布：` +
      OPTION_ORDER.map((o) => `${o}:${stageStats.distribution[o]}`).join(" · ");
    buildReflectionList(currentStage.chapter);
    drawResultsChart();
    overlay.hidden = false;
  }

  function buildReflectionList(chapter) {
    const questions = getReflectionQuestions(chapter);
    reflectionList.innerHTML = "";
    questions.forEach((q) => {
      const li = document.createElement("li");
      li.textContent = q;
      reflectionList.appendChild(li);
    });
  }

  function drawResultsChart() {
    const rctx = resultsCanvas.getContext("2d");
    rctx.clearRect(0, 0, resultsCanvas.width, resultsCanvas.height);
    const labels = ["Trust", "Clarity", "Results"];
    const values = [stageStats.trust, stageStats.clarity, stageStats.results];
    const barWidth = 80;
    const gap = 30;
    const originX = 30;
    const baseY = resultsCanvas.height - 30;
    const maxVal = Math.max(2, ...values.map((v) => Math.abs(v)));
    const scale = (resultsCanvas.height - 80) / (maxVal * 2);
    rctx.font = "14px 'Segoe UI'";
    rctx.fillStyle = "rgba(255,255,255,0.8)";
    rctx.textAlign = "center";

    values.forEach((value, idx) => {
      const x = originX + idx * (barWidth + gap);
      const height = value * scale;
      const y = baseY - height;
      rctx.fillStyle = value >= 0 ? "#34d399" : "#f87171";
      rctx.fillRect(x, Math.min(y, baseY), barWidth, Math.abs(height));
      rctx.fillStyle = "rgba(255,255,255,0.8)";
      rctx.fillText(labels[idx], x + barWidth / 2, baseY + 18);
      rctx.fillText(value.toString(), x + barWidth / 2, y - 6);
    });
  }

  function handleExport() {
    const data = {
      exportedAt: new Date().toISOString(),
      chapter: currentStage.chapter,
      stage: currentStage.stage,
      summary: {
        trust: stageStats.trust,
        clarity: stageStats.clarity,
        results: stageStats.results,
        correct: stageStats.correct,
        total: stageStats.total
      },
      records: stageStats.records
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leadership-blocks-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tileSize = canvas.width / COLS;
    drawBackgroundGuides(tileSize);
    drawBoard(tileSize);
    if (currentPiece) {
      drawPiece(currentPiece, tileSize);
    }
  }

  function drawBackgroundGuides(tileSize) {
    ctx.save();
    OPTION_ORDER.forEach((option, idx) => {
      const col = OPTION_COLUMN_START + idx;
      ctx.fillStyle = "rgba(56,189,248,0.08)";
      ctx.fillRect(col * tileSize, 0, tileSize, canvas.height);
    });
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(148,163,184,0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tileSize, 0);
      ctx.lineTo(x * tileSize, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * tileSize);
      ctx.lineTo(canvas.width, y * tileSize);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(248,250,252,0.7)";
    ctx.font = `${Math.floor(tileSize * 0.7)}px 'Segoe UI'`;
    ctx.textAlign = "center";
    OPTION_ORDER.forEach((option, idx) => {
      const col = OPTION_COLUMN_START + idx;
      ctx.fillText(option, col * tileSize + tileSize / 2, tileSize * 0.8);
    });
    ctx.restore();
  }

  function drawBoard(tileSize) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = board[y][x];
        if (!cell) continue;
        ctx.fillStyle = cell.penalty ? "rgba(248,113,113,0.7)" : cell.color;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        ctx.strokeStyle = "rgba(15,23,42,0.4)";
        ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  }

  function drawPiece(piece, tileSize) {
    const cells = getCells(piece);
    ctx.fillStyle = piece.shape.color;
    ctx.strokeStyle = "rgba(15,23,42,0.5)";
    cells.forEach(({ x, y }) => {
      if (y < 0) return;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
    });
  }

  function loadLevels() {
    return fetch("levels.json")
      .then((res) => {
        if (!res.ok) throw new Error("加载失败");
        return res.json();
      });
  }

  function createShapeSet() {
    return [
      {
        name: "I",
        color: "#38bdf8",
        rotations: [
          [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: 2 },
            { x: 0, y: 3 }
          ],
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 }
          ]
        ]
      },
      {
        name: "L",
        color: "#f472b6",
        rotations: [
          [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: 2 },
            { x: 1, y: 2 }
          ],
          [
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 0, y: 0 }
          ],
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 1, y: 2 }
          ],
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 1 }
          ]
        ]
      },
      {
        name: "O",
        color: "#facc15",
        rotations: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 }
          ]
        ]
      },
      {
        name: "T",
        color: "#a855f7",
        rotations: [
          [
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 2, y: 1 }
          ],
          [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: 2 },
            { x: 1, y: 1 }
          ],
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 1, y: 1 }
          ],
          [
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 1, y: 2 },
            { x: 0, y: 1 }
          ]
        ]
      },
      {
        name: "S",
        color: "#34d399",
        rotations: [
          [
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 }
          ],
          [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 2 }
          ]
        ]
      }
    ];
  }

  function getReflectionQuestions(chapter) {
    switch (chapter) {
      case "组队":
        return [
          "我们是否给团队成员足够的选择空间？",
          "如何让目标与分工更透明？",
          "下一次建队时可以提前准备什么？"
        ];
      case "融合":
        return [
          "团队冲突出现得早吗？谁来发现？",
          "是否建立了共同语言和愿景？",
          "如何让心理安全感成为常态？"
        ];
      case "借力":
        return [
          "资源盘点时我们遗漏了哪些关键伙伴？",
          "利益相关方的诉求是否被听见？",
          "下一步的联合行动里谁负责跟进？"
        ];
      case "挺身":
        return [
          "面对风险我是否主动发声？",
          "我们如何复盘失败并快速调整？",
          "团队士气低迷时有哪些预警信号？"
        ];
      case "共赢":
        return [
          "复盘后有哪些经验值得扩散？",
          "合作伙伴真正关心什么价值？",
          "如何与生态伙伴共创长期目标？"
        ];
      default:
        return [
          "这一关的关键学习点是什么？",
          "不同选项分别会带来怎样的影响？",
          "下一次遇到类似情境我会如何选择？"
        ];
    }
  }

  function getFallbackLevels() {
    return [
      { "chapter": "组队", "stage": "关卡1：谁可信任（易）", "scenario": "林川刚加入新项目，需要在跨部门小组中挑选合作伙伴，面对陌生的同事，他希望快速建立信任基础。", "options": { "A": "找到和自己关系不错的同事合作，因沟通更轻松。", "B": "先摸清专长与目标，选最匹配的伙伴。", "C": "听从领导分配，毕竟事关公司。", "D": "挑选专业过硬的同事合作，能够让自己更快成长。", "E": "拒绝分工，独自完成全部任务。" }, "best": "B", "feedback": { "A": "关系近≠匹配度，易形成思维回音室。", "B": "按目标与专长配对，提高协同效率与质量（最佳）。", "C": "放弃主导权，风险无法预控。", "D": "只看个人强项，忽略团队协同与目标一致性。", "E": "个人英雄主义不可持续。" }, "impact": { "A": { "Trust": -1, "Clarity": 0, "Results": 0 }, "B": { "Trust": 2, "Clarity": 1, "Results": 1 }, "C": { "Trust": -1, "Clarity": -1, "Results": 0 }, "D": { "Trust": 0, "Clarity": 0, "Results": 1 }, "E": { "Trust": -2, "Clarity": -1, "Results": -1 } } },
      { "chapter": "组队", "stage": "关卡2：信息透明（中）", "scenario": "新项目启动会上，林川掌握核心排期，但团队中有新同事担心信息滞后导致资源准备不足。", "options": { "A": "仅在被追问时才公布排期细节。", "B": "在内部 wiki 建立里程碑看板，实时更新。", "C": "每周例会时统一口头播报一次。", "D": "让助理负责通知，自己聚焦技术。", "E": "等排期完全确定后一次性公布。" }, "best": "B", "feedback": { "A": "信息被动透明，信任感下降。", "B": "公开透明+自助查询，形成共享心智（最佳）。", "C": "节奏慢半拍，难以快速响应。", "D": "责任外包，缺少权威与一致性。", "E": "延迟沟通造成准备不足与猜疑。" }, "impact": { "A": { "Trust": -1, "Clarity": -1, "Results": 0 }, "B": { "Trust": 1, "Clarity": 2, "Results": 1 }, "C": { "Trust": 0, "Clarity": -1, "Results": 0 }, "D": { "Trust": -1, "Clarity": -1, "Results": 0 }, "E": { "Trust": -2, "Clarity": -2, "Results": -1 } } },
      { "chapter": "组队", "stage": "关卡3：角色分配（难）", "scenario": "面对紧迫的交付，团队成员技能参差，林川需要快速定下角色分配并确保认同。", "options": { "A": "按资历排座次，让老成员决定职位。", "B": "结合目标拆解任务，让成员根据能力与兴趣选择。", "C": "直接指派每个人的任务，省去讨论。", "D": "开放竞标，表现最好的人拿核心任务。", "E": "把关键任务留给自己，避免失误。" }, "best": "B", "feedback": { "A": "资历≠角色适配，年轻成员被边缘化。", "B": "共创方案增强主人翁意识与执行力（最佳）。", "C": "单向指令引发抵触，执行力打折。", "D": "竞争氛围可能破坏合作。", "E": "关键任务独揽，风险集中。" }, "impact": { "A": { "Trust": -1, "Clarity": 0, "Results": -1 }, "B": { "Trust": 2, "Clarity": 1, "Results": 2 }, "C": { "Trust": -1, "Clarity": 0, "Results": 0 }, "D": { "Trust": -1, "Clarity": 0, "Results": 0 }, "E": { "Trust": -2, "Clarity": -1, "Results": -1 } } },
      { "chapter": "融合", "stage": "关卡1：文化破冰（易）", "scenario": "项目团队由不同地区成员组成，初次线上会议氛围拘谨。林川想让大家快速熟络。", "options": { "A": "直接进入议题，节省时间。", "B": "安排一个轻松的自我介绍+文化小问答。", "C": "请最资深的人先分享经验。", "D": "通过邮件发送团队手册让大家自读。", "E": "等线下见面再做破冰。" }, "best": "B", "feedback": { "A": "冰未破先谈事，互动效果差。", "B": "轻松破冰建立心理安全感（最佳）。", "C": "单向分享缺少参与感。", "D": "邮件缺乏即时互动。", "E": "错失初始关系构建窗口。" }, "impact": { "A": { "Trust": -1, "Clarity": 0, "Results": 0 }, "B": { "Trust": 1, "Clarity": 1, "Results": 1 }, "C": { "Trust": 0, "Clarity": 0, "Results": 0 }, "D": { "Trust": -1, "Clarity": 0, "Results": 0 }, "E": { "Trust": -2, "Clarity": -1, "Results": -1 } } },
      { "chapter": "融合", "stage": "关卡2：冲突对话（中）", "scenario": "两名骨干因任务边界产生争执，项目进度受阻。林川需要主持调解。", "options": { "A": "要求双方冷静后再说，不参与。", "B": "组织结构化对话：澄清事实、感受与需求，再共创方案。", "C": "直接决定由表现好的成员负责。", "D": "建议先完成自己的任务，再处理冲突。", "E": "将争执上报给更高领导处理。" }, "best": "B", "feedback": { "A": "回避冲突导致裂痕扩大。", "B": "结构化对话让冲突转化为合作机会（最佳）。", "C": "强行裁决压制情绪，后续隐患大。", "D": "拖延不治本。", "E": "升级汇报损伤团队自治。" }, "impact": { "A": { "Trust": -1, "Clarity": -1, "Results": -1 }, "B": { "Trust": 2, "Clarity": 2, "Results": 1 }, "C": { "Trust": -1, "Clarity": 0, "Results": 0 }, "D": { "Trust": -1, "Clarity": -1, "Results": 0 }, "E": { "Trust": -2, "Clarity": -1, "Results": -1 } } },
      { "chapter": "融合", "stage": "关卡3：共享愿景（难）", "scenario": "团队对项目成功定义不一，导致执行方向分散。林川想让大家朝同一目标努力。", "options": { "A": "制定 KPI 表格并强制执行。", "B": "组织愿景工作坊，共同描绘成功画面并明确衡量指标。", "C": "让领导给出最终目标，团队照做。", "D": "挑选关键人物单独沟通，再由他们传达。", "E": "保持现状，边做边调。" }, "best": "B", "feedback": { "A": "指标先于认同，动力不足。", "B": "共同构建愿景强化意义感与方向感（最佳）。", "C": "缺少团队共识，执行依旧散乱。", "D": "二手传达易失真。", "E": "没有统一方向，效率低。" }, "impact": { "A": { "Trust": 0, "Clarity": -1, "Results": 0 }, "B": { "Trust": 1, "Clarity": 2, "Results": 2 }, "C": { "Trust": -1, "Clarity": 0, "Results": 0 }, "D": { "Trust": 0, "Clarity": -1, "Results": -1 }, "E": { "Trust": -1, "Clarity": -2, "Results": -1 } } },
      { "chapter": "借力", "stage": "关卡1：资源盘点（易）", "scenario": "项目预算有限，但外部合作资源丰富。林川需要决定如何获取支持。", "options": { "A": "等总部通知资源名单。", "B": "列出目标成果，逐一盘点内部外部资源并约谈。", "C": "只依赖团队现有能力完成。", "D": "向竞争团队借用人手。", "E": "把资源问题交给财务解决。" }, "best": "B", "feedback": { "A": "被动等待错失机会。", "B": "主动盘点并对齐目标，才能借力发力（最佳）。", "C": "闭门造车效率低。", "D": "竞争团队难以稳定支持。", "E": "与目标脱节，责任不清。" }, "impact": { "A": { "Trust": -1, "Clarity": -1, "Results": 0 }, "B": { "Trust": 1, "Clarity": 1, "Results": 2 }, "C": { "Trust": 0, "Clarity": -1, "Results": -1 }, "D": { "Trust": -1, "Clarity": 0, "Results": 0 }, "E": { "Trust": -1, "Clarity": -1, "Results": 0 } } },
      { "chapter": "借力", "stage": "关卡2：影响对齐（中）", "scenario": "外部法务团队对项目合作协议提出修改意见，进度受阻。林川需要争取他们的支持。", "options": { "A": "强调项目紧迫，要求法务尽快通过。", "B": "邀请法务提前参与需求澄清，共同设计风险对策。", "C": "绕开法务，直接签署草案。", "D": "将问题上报给主管，让主管协调。", "E": "暂停合作，等待更好时机。" }, "best": "B", "feedback": { "A": "只谈速度忽略风险。", "B": "共同设计方案让对方成伙伴而非阻力（最佳）。", "C": "违规操作风险极大。", "D": "过度依赖上级，错失关系经营。", "E": "拖延导致机会流失。" }, "impact": { "A": { "Trust": -1, "Clarity": 0, "Results": 0 }, "B": { "Trust": 1, "Clarity": 2, "Results": 1 }, "C": { "Trust": -2, "Clarity": -2, "Results": -2 }, "D": { "Trust": 0, "Clarity": -1, "Results": 0 }, "E": { "Trust": -1, "Clarity": -1, "Results": -1 } } },
      { "chapter": "借力", "stage": "关卡3：跨界协作（难）", "scenario": "项目要引入 AI 能力，但团队缺乏经验。林川需要推动与创新实验室合作。", "options": { "A": "直接提出要人要资源，列需求。", "B": "共创试点：先明确业务痛点，再和实验室设计验证路线。", "C": "将任务全部外包给实验室完成。", "D": "让团队自行摸索，避免沟通成本。", "E": "暂缓合作，等团队准备好。" }, "best": "B", "feedback": { "A": "只提需求缺乏共同愿景。", "B": "以业务价值为核心的共创能调动双方资源（最佳）。", "C": "外包失去学习与掌控。", "D": "缺经验容易踩坑。", "E": "错失创新窗口。" }, "impact": { "A": { "Trust": 0, "Clarity": 0, "Results": 0 }, "B": { "Trust": 1, "Clarity": 1, "Results": 2 }, "C": { "Trust": -1, "Clarity": -1, "Results": -1 }, "D": { "Trust": -1, "Clarity": -2, "Results": -1 }, "E": { "Trust": -1, "Clarity": -1, "Results": -1 } } },
      { "chapter": "挺身", "stage": "关卡1：危机发声（易）", "scenario": "客户突然反馈上线版本出现关键缺陷，团队内有人犹豫是否主动向高层报告。", "options": { "A": "先观察是否会被客户发现更多问题。", "B": "立即告知高层并提供修复计划草案。", "C": "让测试团队自己处理。", "D": "等修复完成再统一汇报。", "E": "责怪客户需求变更多导致问题。" }, "best": "B", "feedback": { "A": "拖延只会放大风险。", "B": "透明沟通+解决方案展现担当（最佳）。", "C": "甩锅失去信任。", "D": "信息延迟影响决策。", "E": "推责破坏合作关系。" }, "impact": { "A": { "Trust": -1, "Clarity": -1, "Results": -1 }, "B": { "Trust": 2, "Clarity": 1, "Results": 1 }, "C": { "Trust": -1, "Clarity": 0, "Results": 0 }, "D": { "Trust": -1, "Clarity": -1, "Results": 0 }, "E": { "Trust": -2, "Clarity": -1, "Results": -1 } } },
      { "chapter": "挺身", "stage": "关卡2：决策背锅（中）", "scenario": "一个尝试性的方案失败，团队担心被追责。林川需要回应领导询问。", "options": { "A": "把责任归咎于执行同事。", "B": "主动承认试错性质，分享数据与后续改进计划。", "C": "淡化失败影响，转移话题。", "D": "请求延后汇报，看看是否能补救。", "E": "上报时只说成功的部分。" }, "best": "B", "feedback": { "A": "甩锅削弱团队凝聚力。", "B": "承担责任+复盘体现领导力（最佳）。", "C": "逃避沟通，问题反复。", "D": "拖延加大不确定性。", "E": "隐瞒信息风险更大。" }, "impact": { "A": { "Trust": -2, "Clarity": -1, "Results": 0 }, "B": { "Trust": 2, "Clarity": 1, "Results": 1 }, "C": { "Trust": -1, "Clarity": -1, "Results": -1 }, "D": { "Trust": -1, "Clarity": -1, "Results": 0 }, "E": { "Trust": -2, "Clarity": -2, "Results": -1 } } },
      { "chapter": "挺身", "stage": "关卡3：士气恢复（难）", "scenario": "连续加班让团队情绪低落。林川希望重建士气并稳定产出。", "options": { "A": "继续压缩工期，完成后再奖励。", "B": "与团队共创恢复计划：调整节奏、明确优先级、安排休整。", "C": "对抱怨的成员进行批评教育。", "D": "外包部分工作，原团队继续高强度。", "E": "暂停项目，等待情绪自然恢复。" }, "best": "B", "feedback": { "A": "透支士气，隐患更大。", "B": "共创恢复方案兼顾成果与人（最佳）。", "C": "压制情绪无助于问题解决。", "D": "治标不治本，士气仍低。", "E": "无措施无法重建信心。" }, "impact": { "A": { "Trust": -1, "Clarity": 0, "Results": -1 }, "B": { "Trust": 1, "Clarity": 1, "Results": 2 }, "C": { "Trust": -2, "Clarity": -1, "Results": -1 }, "D": { "Trust": -1, "Clarity": 0, "Results": 0 }, "E": { "Trust": 0, "Clarity": -1, "Results": -1 } } },
      { "chapter": "共赢", "stage": "关卡1：价值复盘（易）", "scenario": "项目阶段性成果上线，林川准备召开复盘会，总结价值与经验。", "options": { "A": "仅展示亮点，略过问题。", "B": "围绕价值链条复盘，明确成功因素与改进点。", "C": "发送 PPT 给大家，自行阅读。", "D": "请领导发言，团队在台下听。", "E": "复盘改到项目结束再做。" }, "best": "B", "feedback": { "A": "只讲亮点无法学习。", "B": "价值导向复盘沉淀组织学习（最佳）。", "C": "缺少互动，难以共识。", "D": "单向宣讲忽略团队视角。", "E": "错失即时经验。" }, "impact": { "A": { "Trust": -1, "Clarity": -1, "Results": 0 }, "B": { "Trust": 1, "Clarity": 2, "Results": 1 }, "C": { "Trust": 0, "Clarity": -1, "Results": 0 }, "D": { "Trust": 0, "Clarity": -1, "Results": 0 }, "E": { "Trust": -1, "Clarity": -1, "Results": -1 } } },
      { "chapter": "共赢", "stage": "关卡2：伙伴维护（中）", "scenario": "外部合作伙伴贡献巨大但尚未签订下一阶段协议。林川希望延续合作。", "options": { "A": "等对方提出续约再回应。", "B": "主动对齐合作成果与未来机会，探讨双赢方案。", "C": "以压价换续约，降低成本。", "D": "先签内部 KPI，再谈外部合作。", "E": "发送感谢信即可。" }, "best": "B", "feedback": { "A": "被动等待易失去主动权。", "B": "双赢对话能巩固伙伴关系并探索新价值（最佳）。", "C": "压价损伤信任。", "D": "内外割裂难以协同。", "E": "感谢不等于行动。" }, "impact": { "A": { "Trust": -1, "Clarity": -1, "Results": 0 }, "B": { "Trust": 1, "Clarity": 1, "Results": 2 }, "C": { "Trust": -2, "Clarity": 0, "Results": 0 }, "D": { "Trust": 0, "Clarity": -1, "Results": 0 }, "E": { "Trust": 0, "Clarity": 0, "Results": 0 } } },
      { "chapter": "共赢", "stage": "关卡3：战略共创（难）", "scenario": "公司计划与生态伙伴共创新的服务模式，需要团队提出联合战略方案。", "options": { "A": "先拟定公司方案，再请伙伴签字认可。", "B": "搭建联合工作坊，共享数据、共定目标与关键里程碑。", "C": "让市场部独立完成方案。", "D": "聚焦内部利益，防止伙伴分走收益。", "E": "延迟合作，等竞争对手动作再说。" }, "best": "B", "feedback": { "A": "单方面方案难获认同。", "B": "联合设计让双方投入与收益更均衡（最佳）。", "C": "缺少多方视角，方案单薄。", "D": "零和思维限制合作潜力。", "E": "错失先发优势。" }, "impact": { "A": { "Trust": -1, "Clarity": 0, "Results": 0 }, "B": { "Trust": 2, "Clarity": 2, "Results": 2 }, "C": { "Trust": -1, "Clarity": -1, "Results": -1 }, "D": { "Trust": -2, "Clarity": -1, "Results": -1 }, "E": { "Trust": -1, "Clarity": -1, "Results": -1 } } }
    ];
  }

  init();
})();
