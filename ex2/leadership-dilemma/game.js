const progressEl = document.getElementById("progress");
const scenarioTitleEl = document.getElementById("scenario-title");
const scenarioTextEl = document.getElementById("scenario-text");
const optionsEl = document.getElementById("options");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next-btn");
const restartButtons = [
  document.getElementById("restart-btn"),
  document.getElementById("restart-btn-bottom"),
];
const gameScreen = document.getElementById("game-screen");
const resultsScreen = document.getElementById("results-screen");
const finalScoresEl = document.getElementById("final-scores");
const reflectionList = document.getElementById("reflection-list");

const trustBar = document.getElementById("trust-bar");
const clarityBar = document.getElementById("clarity-bar");
const resultsBar = document.getElementById("results-bar");
const trustScoreEl = document.getElementById("trust-score");
const clarityScoreEl = document.getElementById("clarity-score");
const resultsScoreEl = document.getElementById("results-score");

let scenarios = [];
let currentIndex = 0;
let scores = {
  trust: 0,
  clarity: 0,
  results: 0,
};

const REFLECTION_QUESTIONS = [
  "你为何在每一关做出这样的选择？",
  "如果使用非暴力沟通的四要素（观察、感受、需求、请求），你会如何改写回应？",
  "这些回应对团队的信任会产生哪些影响？",
  "为了提升目标清晰度，你还可以补充什么信息或承诺？",
  "要确保执行落地，你下一步准备和谁对齐、如何跟进？",
];

async function loadScenarios() {
  try {
    const response = await fetch(new URL("scenarios.json", window.location.href));
    if (!response.ok) {
      throw new Error(`无法读取情境：${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("scenarios.json 格式应为数组");
    }
    return data;
  } catch (error) {
    console.warn("读取 scenarios.json 失败，使用内置数据。", error);
    return fallbackScenarios();
  }
}

function fallbackScenarios() {
  return [
    {
      id: "communication-crisis",
      title: "沟通危机：周例会上突发误解",
      text: "市场负责人公开质疑你承诺的上线日期，说技术团队从未同步过最新延期计划，现场气氛骤冷。",
      options: [
        {
          text: "马上澄清并把责任推给技术经理，强调自己已经反复提醒。",
          effects: { trust: -2, clarity: 0, results: -1 },
          feedback:
            "短期内甩锅减轻压力，但会削弱团队信任与责任心，冲突难以真正解决。",
        },
        {
          text: "请市场和技术负责人复盘事实，承认信息断层，并提议下午开同步会。",
          effects: { trust: 1, clarity: 2, results: 1 },
          feedback:
            "坦诚承认缺口并安排复盘，有助于重建信任与明确下一步。",
        },
        {
          text: "宣布暂缓讨论，承诺 24 小时内给出书面说明，先结束会议。",
          effects: { trust: 0, clarity: 1, results: 0 },
          feedback:
            "先稳住现场可避免情绪升级，但需要尽快给出透明方案。",
        },
      ],
    },
    {
      id: "delegation-coaching",
      title: "授权与辅导：新人主管独立带项目",
      text: "你把一个跨团队推广项目交给刚晋升的运营主管，但她迟迟没有推进关键里程碑。",
      options: [
        {
          text: "直接重新收回项目并亲自主导，保证节点不再拖延。",
          effects: { trust: -1, clarity: 1, results: 1 },
          feedback: "短期确保交付，但会打击主管信心，也削弱团队授权文化。",
        },
        {
          text: "约她一对一，先听她的困难，再共同拆解优先级与资源需求。",
          effects: { trust: 2, clarity: 1, results: 1 },
          feedback:
            "倾听+共创计划能提升心理安全与目标清晰度，有助于培养独当一面的能力。",
        },
        {
          text: "要求她下周提交详细计划，强调延误将影响奖金，务必自行解决。",
          effects: { trust: -1, clarity: 2, results: 0 },
          feedback:
            "明确期望与压力能推动执行，但缺少支持易让她感到孤立。",
        },
      ],
    },
    {
      id: "cross-functional-conflict",
      title: "跨部门冲突：客户定制需求",
      text: "大客户提出定制功能，销售承诺两周交付，研发却认为至少要一个月。双方已多次争执。",
      options: [
        {
          text: "要求销售无条件按研发评估延后，并向客户致歉。",
          effects: { trust: 0, clarity: 1, results: -1 },
          feedback:
            "支持研发可以守住质量，但若不提供替代方案，客户体验会受损。",
        },
        {
          text: "召集三方快速对齐，拆解必需与可选功能，协商阶段性交付方案。",
          effects: { trust: 2, clarity: 2, results: 2 },
          feedback:
            "促成共创并明确阶段目标，既守住信任也兼顾交付结果。",
        },
        {
          text: "要求销售承担超售责任，研发暂时按原计划执行，后续再讨论。",
          effects: { trust: -1, clarity: 0, results: 0 },
          feedback:
            "先压下争议但缺乏解决方案，冲突可能再次爆发。",
        },
      ],
    },
  ];
}

function resetGame() {
  scores = { trust: 0, clarity: 0, results: 0 };
  currentIndex = 0;
  updateScoreboard();
  feedbackEl.textContent = "";
  feedbackEl.classList.remove("visible");
  nextBtn.disabled = true;
  nextBtn.textContent = "下一关";
  showGameScreen();
  renderScenario();
}

function renderScenario() {
  const scenario = scenarios[currentIndex];
  if (!scenario) {
    return;
  }
  progressEl.textContent = `第 ${currentIndex + 1}/${scenarios.length} 关`;
  scenarioTitleEl.textContent = scenario.title;
  scenarioTextEl.textContent = scenario.text;
  optionsEl.innerHTML = "";
  feedbackEl.classList.remove("visible");
  feedbackEl.textContent = "";
  nextBtn.disabled = true;

  scenario.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.text;
    button.setAttribute("data-index", index);
    button.addEventListener("click", () => handleOptionSelect(option));
    optionsEl.appendChild(button);
  });
}

function handleOptionSelect(option) {
  applyEffects(option.effects);
  feedbackEl.textContent = option.feedback;
  feedbackEl.classList.add("visible");
  disableOptionButtons();
  nextBtn.disabled = false;
  if (currentIndex === scenarios.length - 1) {
    nextBtn.textContent = "查看结果";
  }
}

function disableOptionButtons() {
  optionsEl
    .querySelectorAll("button")
    .forEach((button) => button.setAttribute("disabled", "true"));
}

function enableOptionButtons() {
  optionsEl
    .querySelectorAll("button")
    .forEach((button) => button.removeAttribute("disabled"));
}

function applyEffects(effects) {
  scores.trust += effects.trust || 0;
  scores.clarity += effects.clarity || 0;
  scores.results += effects.results || 0;
  updateScoreboard();
}

function updateScoreboard() {
  trustScoreEl.textContent = scores.trust;
  clarityScoreEl.textContent = scores.clarity;
  resultsScoreEl.textContent = scores.results;

  const maxRange = 6; // 三关内单项最大区间 -6 ~ +6
  trustBar.style.width = convertToPercentage(scores.trust, maxRange);
  clarityBar.style.width = convertToPercentage(scores.clarity, maxRange);
  resultsBar.style.width = convertToPercentage(scores.results, maxRange);
}

function convertToPercentage(value, maxRange) {
  const percent = ((value + maxRange) / (maxRange * 2)) * 100;
  const clamped = Math.min(100, Math.max(0, percent));
  return `${clamped}%`;
}

function handleNext() {
  if (currentIndex >= scenarios.length - 1) {
    showResults();
    return;
  }
  currentIndex += 1;
  renderScenario();
}

function showResults() {
  gameScreen.classList.add("hidden");
  resultsScreen.classList.remove("hidden");
  progressEl.textContent = "全部完成";
  finalScoresEl.innerHTML = "";

  const entries = [
    { label: "Trust", value: scores.trust, meaning: "心理安全 / 授权" },
    { label: "Clarity", value: scores.clarity, meaning: "目标对齐 / 期望管理" },
    { label: "Results", value: scores.results, meaning: "任务完成 / 复盘闭环" },
  ];

  entries.forEach(({ label, value, meaning }) => {
    const item = document.createElement("div");
    item.className = "score-summary";
    item.innerHTML = `
      <strong>${label}</strong>
      <span>${value}</span>
      <small>${meaning}</small>
      <div class="score-bar"><div style="width: ${convertToPercentage(value, 6)}"></div></div>
    `;
    finalScoresEl.appendChild(item);
  });

  reflectionList.innerHTML = "";
  REFLECTION_QUESTIONS.forEach((question) => {
    const li = document.createElement("li");
    li.textContent = question;
    reflectionList.appendChild(li);
  });
}

function showGameScreen() {
  gameScreen.classList.remove("hidden");
  resultsScreen.classList.add("hidden");
}

nextBtn.addEventListener("click", handleNext);
restartButtons.forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => resetGame());
});

loadScenarios().then((data) => {
  scenarios = data;
  resetGame();
});
