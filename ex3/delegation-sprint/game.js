// Delegation Sprint 拖拽小游戏逻辑
(() => {
  const STORAGE_STATE_KEY = 'delegation-sprint-state-v1';
  const STORAGE_RANKING_KEY = 'delegation-sprint-ranking-v1';
  const ROUND_TIME = 60; // 每回合 60 秒

  // 本地回退数据，确保 file:// 打开时也能演练
  const FALLBACK_DATA = {
    members: [
      {
        id: 'memberA',
        name: '技术专家 A',
        skills: ['后端', '架构', '优化'],
        capacity: 5,
        preference: {
          likes: '深度专注型挑战',
          avoid: '频繁打断'
        },
        communication: 1,
        persona: '技术专家A：对复杂技术问题驾轻就熟，但沟通偏慢热。',
        isTechnical: true
      },
      {
        id: 'memberB',
        name: '项目经理 B',
        skills: ['协调', '计划', '沟通'],
        capacity: 4,
        preference: {
          likes: '跨部门协同',
          avoid: '信息不透明'
        },
        communication: 3,
        persona: '项目经理B：喜欢掌控节奏，善于向上管理。',
        isTechnical: false
      },
      {
        id: 'memberC',
        name: '新人成员 C',
        skills: ['文档', '测试', '学习'],
        capacity: 3,
        preference: {
          likes: '导师陪跑',
          avoid: '高压突发'
        },
        communication: 2,
        persona: '新人C：积极但缺乏经验，需要明确指导。',
        isTechnical: false
      },
      {
        id: 'memberD',
        name: '协调伙伴 D',
        skills: ['跨部门', '沟通', '赋能'],
        capacity: 4,
        preference: {
          likes: '建立联系',
          avoid: '重复劳动'
        },
        communication: 3,
        persona: '协调者D：串联资源的高手，乐于打通信息壁垒。',
        isTechnical: false
      }
    ],
    rounds: [
      {
        id: 'round1',
        title: '热身回合',
        tasks: [
          {
            id: 'task_launch',
            title: '客户发布会演练',
            complexity: 2,
            urgency: 2,
            communication: 3,
            requiredSkills: ['演示', '协调'],
            tone: '现场协作',
            preferenceTrigger: '信息不透明',
            critical: true
          },
          {
            id: 'task_bugfix',
            title: '遗留缺陷修复',
            complexity: 1,
            urgency: 1,
            communication: 1,
            requiredSkills: ['后端', '质量'],
            tone: '深度专注',
            preferenceTrigger: '频繁打断',
            critical: false
          },
          {
            id: 'task_brief',
            title: '跨部门需求澄清',
            complexity: 2,
            urgency: 3,
            communication: 3,
            requiredSkills: ['协调', '沟通'],
            tone: '跨部门协同',
            preferenceTrigger: '信息不透明',
            critical: true
          }
        ]
      },
      {
        id: 'round2',
        title: '节奏加速',
        tasks: [
          {
            id: 'task_onboarding',
            title: '新人入职交接',
            complexity: 2,
            urgency: 2,
            communication: 2,
            requiredSkills: ['文档', '沟通'],
            tone: '导师陪跑',
            preferenceTrigger: '重复劳动',
            critical: false
          },
          {
            id: 'task_incident',
            title: '线上故障应急',
            complexity: 3,
            urgency: 3,
            communication: 2,
            requiredSkills: ['后端', '优化'],
            tone: '高压突发',
            preferenceTrigger: '高压突发',
            critical: true
          },
          {
            id: 'task_alignment',
            title: '季度路线图对齐',
            complexity: 2,
            urgency: 2,
            communication: 3,
            requiredSkills: ['计划', '协调'],
            tone: '目标对齐',
            preferenceTrigger: '信息不透明',
            critical: true
          }
        ]
      },
      {
        id: 'round3',
        title: '冲刺决胜',
        tasks: [
          {
            id: 'task_refactor',
            title: '核心模块重构',
            complexity: 3,
            urgency: 2,
            communication: 1,
            requiredSkills: ['架构', '后端'],
            tone: '深度专注',
            preferenceTrigger: '频繁打断',
            critical: true
          },
          {
            id: 'task_partnership',
            title: '战略合作伙伴谈判',
            complexity: 2,
            urgency: 3,
            communication: 3,
            requiredSkills: ['沟通', '协调'],
            tone: '跨部门协同',
            preferenceTrigger: '信息不透明',
            critical: true
          },
          {
            id: 'task_knowledge',
            title: '知识库体系化',
            complexity: 2,
            urgency: 1,
            communication: 2,
            requiredSkills: ['文档', '赋能'],
            tone: '结构沉淀',
            preferenceTrigger: '重复劳动',
            critical: false
          }
        ]
      }
    ]
  };

  const elements = {
    taskPool: document.getElementById('taskPool'),
    memberList: document.getElementById('memberList'),
    roundIndicator: document.getElementById('roundIndicator'),
    timerDisplay: document.getElementById('timerDisplay'),
    undoBtn: document.getElementById('undoBtn'),
    resetRoundBtn: document.getElementById('resetRoundBtn'),
    nextRoundBtn: document.getElementById('nextRoundBtn'),
    trustBar: document.getElementById('trustBar'),
    clarityBar: document.getElementById('clarityBar'),
    resultsBar: document.getElementById('resultsBar'),
    trustValue: document.getElementById('trustValue'),
    clarityValue: document.getElementById('clarityValue'),
    resultsValue: document.getElementById('resultsValue'),
    feedbackModal: document.getElementById('feedbackModal'),
    feedbackList: document.getElementById('feedbackList'),
    feedbackCloseBtn: document.getElementById('feedbackCloseBtn'),
    feedbackTitle: document.getElementById('feedbackTitle'),
    resultModal: document.getElementById('resultModal'),
    resultChart: document.getElementById('resultChart'),
    finalScoreText: document.getElementById('finalScoreText'),
    leaderboard: document.getElementById('leaderboard'),
    exportBtn: document.getElementById('exportBtn'),
    restartBtn: document.getElementById('restartBtn')
  };

  const templates = {
    task: document.getElementById('taskTemplate'),
    member: document.getElementById('memberTemplate')
  };

  let gameData = null;
  let state = null;
  let timerHandle = null;
  let roundLocked = false;
  let dragState = null;

  // 加载 data.json，如失败则使用回退数据
  async function loadGameData() {
    try {
      const response = await fetch('data.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('数据加载失败');
      }
      return await response.json();
    } catch (error) {
      console.warn('使用回退数据：', error.message);
      return FALLBACK_DATA;
    }
  }

  function createInitialState(data) {
    return {
      roundIndex: 0,
      assignments: data.rounds.map(() => ({})),
      history: [],
      scores: { trust: 0, clarity: 0, results: 0 },
      roundSummaries: [],
      remainingTime: ROUND_TIME,
      savedAt: Date.now()
    };
  }

  function loadPersistedState(data) {
    try {
      const raw = localStorage.getItem(STORAGE_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const expectedSignature = data.rounds.map(r => r.id).join('|');
      if (parsed.signature !== expectedSignature) {
        return null;
      }
      return {
        roundIndex: parsed.roundIndex ?? 0,
        assignments: parsed.assignments ?? data.rounds.map(() => ({})),
        history: [],
        scores: parsed.scores ?? { trust: 0, clarity: 0, results: 0 },
        roundSummaries: parsed.roundSummaries ?? [],
        remainingTime: parsed.remainingTime ?? ROUND_TIME,
        savedAt: parsed.savedAt ?? Date.now()
      };
    } catch (error) {
      console.warn('读取存档失败，重新开始：', error);
      return null;
    }
  }

  function persistState() {
    if (!state || !gameData) return;
    const payload = {
      signature: gameData.rounds.map(r => r.id).join('|'),
      roundIndex: state.roundIndex,
      assignments: state.assignments,
      scores: state.scores,
      roundSummaries: state.roundSummaries,
      remainingTime: state.remainingTime,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('存档失败：', error);
    }
  }

  function clearPersistedState() {
    localStorage.removeItem(STORAGE_STATE_KEY);
  }

  function getCurrentRoundData() {
    return gameData.rounds[state.roundIndex];
  }

  function getTaskById(roundIndex, taskId) {
    const round = gameData.rounds[roundIndex];
    return round.tasks.find(task => task.id === taskId);
  }

  function createTaskCard(task) {
    const node = templates.task.content.firstElementChild.cloneNode(true);
    node.dataset.taskId = task.id;
    node.dataset.critical = String(task.critical);
    node.querySelector('.task-title').textContent = task.title;
    node.querySelector('.task-meta').innerHTML = `
      <span>★ ${'★'.repeat(task.complexity)}</span>
      <span>⚡ ${'⚡'.repeat(task.urgency)}</span>
      <span>💬 ${'💬'.repeat(task.communication)}</span>
    `;
    node.querySelector('.task-skills').textContent = `所需：${task.requiredSkills.join('、')}`;
    node.querySelector('.task-tone').textContent = `情境：${task.tone}`;
    node.addEventListener('pointerdown', handleCardPointerDown, { passive: false });
    return node;
  }

  function createMemberCard(member, loadInfo) {
    const node = templates.member.content.firstElementChild.cloneNode(true);
    node.dataset.memberId = member.id;
    node.setAttribute('title', member.persona);
    const header = node.querySelector('header');
    header.querySelector('.member-name').textContent = member.name;
    header.querySelector('.member-capacity').textContent = `剩余带宽：${Math.max(member.capacity - loadInfo.used, 0)}/${member.capacity}`;
    node.querySelector('.member-skills').textContent = `技能：${member.skills.join('、')}`;
    node.querySelector('.member-preference').textContent = `偏好：${member.preference.likes}｜避雷：${member.preference.avoid}`;
    const assigned = node.querySelector('.assigned-tasks');
    assigned.dataset.memberId = member.id;
    loadInfo.tasks.forEach(task => {
      const card = createTaskCard(task);
      card.classList.add('small');
      assigned.appendChild(card);
    });
    return node;
  }

  function renderBoard() {
    const currentRound = getCurrentRoundData();
    const roundAssignments = state.assignments[state.roundIndex];

    elements.taskPool.innerHTML = '';
    elements.memberList.innerHTML = '';

    const loadInfoByMember = {};
    gameData.members.forEach(member => {
      loadInfoByMember[member.id] = { used: 0, tasks: [] };
    });

    currentRound.tasks.forEach(task => {
      const assignedMemberId = roundAssignments[task.id];
      if (assignedMemberId) {
        loadInfoByMember[assignedMemberId].used += task.complexity;
        loadInfoByMember[assignedMemberId].tasks.push(task);
      } else {
        const card = createTaskCard(task);
        elements.taskPool.appendChild(card);
      }
    });

    gameData.members.forEach(member => {
      const card = createMemberCard(member, loadInfoByMember[member.id]);
      elements.memberList.appendChild(card);
    });

    updateProgressIndicator();
    updateScoreDisplay();
  }

  function updateProgressIndicator() {
    const total = gameData.rounds.length;
    elements.roundIndicator.textContent = `第 ${state.roundIndex + 1}/${total} 回合`;
  }

  function updateScoreDisplay() {
    let trustScore = state.scores.trust;
    let clarityScore = state.scores.clarity;
    let resultsScore = state.scores.results;
    const currentSummary = state.roundSummaries[state.roundIndex];
    const shouldPreview = !currentSummary && state.roundIndex < gameData.rounds.length;
    if (shouldPreview) {
      const preview = evaluateRound(state.roundIndex, state.assignments[state.roundIndex], { withNotes: false });
      trustScore += preview.trust;
      clarityScore += preview.clarity;
      resultsScore += preview.results;
    }

    updateBar(elements.trustBar, elements.trustValue, trustScore);
    updateBar(elements.clarityBar, elements.clarityValue, clarityScore);
    updateBar(elements.resultsBar, elements.resultsValue, resultsScore);
  }

  function updateBar(barEl, valueEl, score) {
    const clamped = Math.max(-6, Math.min(9, score));
    const percentage = ((clamped + 6) / 15) * 100;
    barEl.style.width = `${percentage}%`;
    valueEl.textContent = score.toString();
  }

  function updateTimerDisplay() {
    const seconds = Math.max(0, Math.ceil(state.remainingTime));
    elements.timerDisplay.textContent = `${seconds} 秒`;
  }

  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerHandle = setInterval(() => {
      state.remainingTime -= 1;
      if (state.remainingTime <= 0) {
        state.remainingTime = 0;
        updateTimerDisplay();
        persistState();
        finalizeRound(true);
        return;
      }
      updateTimerDisplay();
      persistState();
    }, 1000);
  }

  function stopTimer() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function handleCardPointerDown(event) {
    if (roundLocked) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const card = event.currentTarget;
    const taskId = card.dataset.taskId;
    const rect = card.getBoundingClientRect();

    const ghost = card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);

    dragState = {
      taskId,
      originCard: card,
      ghost,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      activeDropzone: null
    };

    card.classList.add('dragging');
    card.setPointerCapture(event.pointerId);
    card.addEventListener('pointermove', handleCardPointerMove);
    card.addEventListener('pointerup', handleCardPointerUp);
    card.addEventListener('lostpointercapture', cancelDrag);

    moveGhost(event.clientX, event.clientY);
  }

  function handleCardPointerMove(event) {
    if (!dragState) return;
    event.preventDefault();
    moveGhost(event.clientX, event.clientY);
    highlightDropzone(event.clientX, event.clientY);
  }

  function handleCardPointerUp(event) {
    if (!dragState) return;
    event.preventDefault();
    const dropzone = findDropzone(event.clientX, event.clientY);
    finishDrag(dropzone);
  }

  function cancelDrag() {
    if (!dragState) return;
    cleanupDrag();
  }

  function moveGhost(x, y) {
    if (!dragState) return;
    const left = x - dragState.offsetX;
    const top = y - dragState.offsetY;
    dragState.ghost.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  function highlightDropzone(x, y) {
    const dropzone = findDropzone(x, y);
    if (dragState.activeDropzone === dropzone) return;
    if (dragState.activeDropzone) {
      dragState.activeDropzone.classList.remove('dropzone-highlight');
    }
    if (dropzone) {
      dropzone.classList.add('dropzone-highlight');
    }
    dragState.activeDropzone = dropzone;
  }

  function findDropzone(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    return element.closest('[data-drop-target]');
  }

  function finishDrag(target) {
    if (!dragState) return;
    const taskId = dragState.taskId;
    cleanupDrag();

    if (!target) return;

    const dropType = target.dataset.dropTarget;
    if (dropType === 'member') {
      const memberId = target.dataset.memberId || target.closest('[data-member-id]')?.dataset.memberId;
      if (memberId) {
        setAssignment(taskId, memberId, true);
      }
    } else if (dropType === 'task-pool') {
      setAssignment(taskId, null, true);
    }
  }

  function cleanupDrag() {
    if (!dragState) return;
    const { originCard, ghost, activeDropzone } = dragState;
    originCard.classList.remove('dragging');
    originCard.removeEventListener('pointermove', handleCardPointerMove);
    originCard.removeEventListener('pointerup', handleCardPointerUp);
    originCard.removeEventListener('lostpointercapture', cancelDrag);
    if (ghost && ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }
    if (activeDropzone) {
      activeDropzone.classList.remove('dropzone-highlight');
    }
    dragState = null;
  }

  function setAssignment(taskId, memberId, recordHistory) {
    const roundAssignments = state.assignments[state.roundIndex];
    const previous = roundAssignments[taskId] ?? null;
    if (previous === memberId) return;

    if (memberId) {
      roundAssignments[taskId] = memberId;
    } else {
      delete roundAssignments[taskId];
    }

    if (recordHistory) {
      state.history.push({ round: state.roundIndex, taskId, from: previous, to: memberId });
    }

    renderBoard();
    persistState();
  }

  function undoLastAction() {
    for (let i = state.history.length - 1; i >= 0; i -= 1) {
      const action = state.history[i];
      if (action.round === state.roundIndex) {
        state.history.splice(i, 1);
        setAssignment(action.taskId, action.from, false);
        return;
      }
    }
  }

  function resetCurrentRound() {
    state.assignments[state.roundIndex] = {};
    state.history = [];
    state.remainingTime = ROUND_TIME;
    persistState();
    renderBoard();
    startTimer();
  }

  function evaluateRound(roundIndex, assignments, options = {}) {
    const { withNotes = true } = options;
    const round = gameData.rounds[roundIndex];
    const notes = [];
    let trust = 0;
    let clarity = 0;
    let results = 0;

    const memberLoads = {};
    const criticalDistribution = {};

    gameData.members.forEach(member => {
      memberLoads[member.id] = { used: 0, tasks: [] };
      criticalDistribution[member.id] = 0;
    });

    round.tasks.forEach(task => {
      const memberId = assignments[task.id];
      if (!memberId) {
        if (withNotes) {
          notes.push(`任务【${task.title}】尚未分配，可能导致交付风险。`);
        }
        return;
      }

      const member = gameData.members.find(m => m.id === memberId);
      memberLoads[member.id].used += task.complexity;
      memberLoads[member.id].tasks.push(task);
      if (task.critical) {
        criticalDistribution[member.id] += 1;
      }

      const skillMatch = task.requiredSkills.some(skill => member.skills.includes(skill));
      if (skillMatch) {
        results += 1;
      }
      if (!skillMatch && withNotes) {
        notes.push(`【${task.title}】需要 ${task.requiredSkills.join('、')}，${member.name} 可能需要额外支援。`);
      }

      if (task.preferenceTrigger && task.preferenceTrigger === member.preference.avoid) {
        trust -= 1;
        if (withNotes) {
          notes.push(`${member.name} 不喜欢「${task.preferenceTrigger}」情境，信任感下降。`);
        }
      }

      if (task.communication >= 3 && member.communication <= 1 && member.isTechnical) {
        clarity -= 1;
        if (withNotes) {
          notes.push(`高沟通需求的【${task.title}】交给沟通偏弱的 ${member.name}，清晰度受限。`);
        }
      } else if (task.communication >= 2 && member.communication >= 3) {
        clarity += 1;
        if (withNotes) {
          notes.push(`${member.name} 擅长沟通，为【${task.title}】带来额外清晰度。`);
        }
      }
    });

    Object.entries(memberLoads).forEach(([memberId, info]) => {
      const member = gameData.members.find(m => m.id === memberId);
      if (info.used > member.capacity) {
        results -= 1;
        if (withNotes) {
          notes.push(`${member.name} 带宽 ${info.used}/${member.capacity}，已经超载。`);
        }
      }
    });

    const totalCritical = Object.values(criticalDistribution).reduce((sum, value) => sum + value, 0);
    const maxCritical = Math.max(...Object.values(criticalDistribution));
    if (totalCritical > 0 && maxCritical === totalCritical && totalCritical > 1) {
      trust -= 1;
      if (withNotes) {
        notes.push('关键任务集中在单一队员，其他人缺乏参与感，信任受损。');
      }
    }

    if (withNotes && notes.length < 2) {
      notes.push('尝试让队员阐明预期成果或沟通节奏，进一步提升清晰度。');
      notes.push('观察队员负荷与偏好，让授权既有挑战又不过载。');
    }

    return { trust, clarity, results, notes };
  }

  function finalizeRound(autoTriggered = false) {
    if (roundLocked) return;
    roundLocked = true;
    stopTimer();

    const evaluation = evaluateRound(state.roundIndex, state.assignments[state.roundIndex], { withNotes: true });
    if (autoTriggered) {
      evaluation.notes.unshift('时间到：本回合自动结算。');
    }

    state.scores.trust += evaluation.trust;
    state.scores.clarity += evaluation.clarity;
    state.scores.results += evaluation.results;

    state.roundSummaries[state.roundIndex] = {
      round: state.roundIndex + 1,
      scores: { ...evaluation },
      assignments: { ...state.assignments[state.roundIndex] },
      finishedAt: new Date().toISOString(),
      autoTriggered
    };

    state.history = [];
    state.remainingTime = ROUND_TIME;
    persistState();

    showFeedbackModal(evaluation.notes.slice(0, 3), () => {
      advanceRound();
      roundLocked = false;
    });

    updateScoreDisplay();
  }

  function showFeedbackModal(messages, onClose) {
    elements.feedbackList.innerHTML = '';
    messages.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      elements.feedbackList.appendChild(li);
    });
    elements.feedbackModal.classList.remove('hidden');
    elements.feedbackModal.setAttribute('aria-hidden', 'false');

    const handler = () => {
      elements.feedbackModal.classList.add('hidden');
      elements.feedbackModal.setAttribute('aria-hidden', 'true');
      elements.feedbackCloseBtn.removeEventListener('click', handler);
      onClose?.();
    };

    elements.feedbackCloseBtn.addEventListener('click', handler);
  }

  function advanceRound() {
    const isLastRound = state.roundIndex >= gameData.rounds.length - 1;
    if (isLastRound) {
      clearPersistedState();
      showResultSummary();
      return;
    }

    state.roundIndex += 1;
    state.remainingTime = ROUND_TIME;
    persistState();
    renderBoard();
    startTimer();
  }

  function showResultSummary() {
    renderBoard();
    drawResultChart();
    updateFinalSummaryText();
    populateLeaderboard();
    elements.resultModal.classList.remove('hidden');
    elements.resultModal.setAttribute('aria-hidden', 'false');
  }

  function drawResultChart() {
    const ctx = elements.resultChart.getContext('2d');
    const metrics = ['Trust', 'Clarity', 'Results'];
    const scores = [state.scores.trust, state.scores.clarity, state.scores.results];
    const colors = ['#facc15', '#22d3ee', '#34d399'];

    ctx.clearRect(0, 0, elements.resultChart.width, elements.resultChart.height);

    const chartPadding = 40;
    const barWidth = 60;
    const gap = 40;
    const originX = chartPadding;
    const originY = elements.resultChart.height - chartPadding;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + (barWidth + gap) * metrics.length, originY);
    ctx.stroke();

    const maxScore = Math.max(3, ...scores.map(score => Math.abs(score))) + 1;

    metrics.forEach((label, index) => {
      const score = scores[index];
      const barHeight = (score / (maxScore || 1)) * (elements.resultChart.height - chartPadding * 2);
      const x = originX + index * (barWidth + gap);
      const y = barHeight >= 0 ? originY - barHeight : originY;

      ctx.fillStyle = colors[index];
      ctx.fillRect(x, y, barWidth, Math.abs(barHeight));

      ctx.fillStyle = '#1f2937';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barWidth / 2, originY + 20);
      ctx.fillText(score.toString(), x + barWidth / 2, y - 6);
    });
  }

  function updateFinalSummaryText() {
    elements.finalScoreText.textContent = `Trust ${state.scores.trust} ｜ Clarity ${state.scores.clarity} ｜ Results ${state.scores.results}`;
  }

  function loadRanking() {
    try {
      const raw = localStorage.getItem(STORAGE_RANKING_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (error) {
      console.warn('排行榜读取失败：', error);
      return [];
    }
  }

  function saveRanking(ranking) {
    try {
      localStorage.setItem(STORAGE_RANKING_KEY, JSON.stringify(ranking));
    } catch (error) {
      console.warn('排行榜写入失败：', error);
    }
  }

  function populateLeaderboard() {
    const ranking = loadRanking();
    const entry = {
      trust: state.scores.trust,
      clarity: state.scores.clarity,
      results: state.scores.results,
      finishedAt: new Date().toISOString()
    };
    ranking.push(entry);
    ranking.sort((a, b) => b.results - a.results);
    const trimmed = ranking.slice(0, 5);
    saveRanking(trimmed);

    elements.leaderboard.innerHTML = '';
    trimmed.forEach(item => {
      const li = document.createElement('li');
      const date = new Date(item.finishedAt).toLocaleString();
      li.textContent = `${date} ｜ Results ${item.results} ｜ Trust ${item.trust} ｜ Clarity ${item.clarity}`;
      elements.leaderboard.appendChild(li);
    });
  }

  function exportResult() {
    const ranking = loadRanking();
    const payload = {
      exportedAt: new Date().toISOString(),
      totals: state.scores,
      rounds: state.roundSummaries,
      assignments: state.assignments,
      ranking
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `delegation-sprint-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function restartGame() {
    clearPersistedState();
    state = createInitialState(gameData);
    renderBoard();
    elements.resultModal.classList.add('hidden');
    elements.resultModal.setAttribute('aria-hidden', 'true');
    roundLocked = false;
    startTimer();
  }

  function bindEventListeners() {
    elements.undoBtn.addEventListener('click', () => {
      if (!roundLocked) {
        undoLastAction();
      }
    });

    elements.resetRoundBtn.addEventListener('click', () => {
      if (!roundLocked) {
        resetCurrentRound();
      }
    });

    elements.nextRoundBtn.addEventListener('click', () => {
      finalizeRound(false);
    });

    elements.exportBtn.addEventListener('click', exportResult);
    elements.restartBtn.addEventListener('click', restartGame);
  }

  async function init() {
    gameData = await loadGameData();
    state = loadPersistedState(gameData) ?? createInitialState(gameData);

    bindEventListeners();
    renderBoard();
    startTimer();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
