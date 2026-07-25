window.App = (function () {
  var KEY = 'mingri.funeral.v3';
  var LEGACY_KEY = 'mingri.funeral.v2';
  var FLOW = ['story', 'funeral', 'unknowns', 'rewind', 'future'];
  var PRODUCT_VIEWS = ['title', 'archive', 'codex', 'pet'];
  var LABELS = {
    story: '讲述',
    funeral: '讣告',
    unknowns: '盲区',
    rewind: '抉择',
    future: '新未来'
  };

  var state = {
    screen: 'title',
    answers: { problem: '', facts: '', cares: '' },
    intakeIndex: 0,
    result: null,
    revealedUnknowns: [],
    rewindPoint: null,
    future: null,
    sound: false,
    avatarAccent: 'cyan',
    funeralSeen: false,
    history: [],
    coins: 0,
    streak: 0,
    lastRunId: '',
    petTone: 'direct',
    cloudRunId: '',
    cloudAccount: false
  };

  var cloud = {
    checked: false,
    online: false,
    configured: false,
    database: false,
    liveEvidence: false,
    models: null
  };
  var healthPromise = null;
  var pendingSimulation = null;
  var pendingRewrite = null;

  function todayKey() {
    var now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  }

  function serializableState() {
    return {
      screen: state.screen,
      answers: state.answers,
      intakeIndex: state.intakeIndex,
      revealedUnknowns: state.revealedUnknowns,
      rewindPoint: state.rewindPoint,
      sound: state.sound,
      avatarAccent: state.avatarAccent,
      funeralSeen: state.funeralSeen,
      history: state.history,
      coins: state.coins,
      streak: state.streak,
      lastRunId: state.lastRunId,
      petTone: state.petTone,
      cloudRunId: state.cloudRunId,
      result: state.result,
      future: state.future
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(serializableState()));
    } catch (error) {
      return false;
    }
    return true;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var migrated = false;
      if (!raw) {
        raw = localStorage.getItem(LEGACY_KEY);
        migrated = !!raw;
      }
      if (!raw) return;

      var stored = JSON.parse(raw);
      if (stored.answers) state.answers = stored.answers;
      if (typeof stored.intakeIndex === 'number') state.intakeIndex = stored.intakeIndex;
      if (Array.isArray(stored.revealedUnknowns)) state.revealedUnknowns = stored.revealedUnknowns;
      if (stored.rewindPoint) state.rewindPoint = stored.rewindPoint;
      if (typeof stored.sound === 'boolean') state.sound = stored.sound;
      if (stored.avatarAccent) state.avatarAccent = stored.avatarAccent;
      if (typeof stored.funeralSeen === 'boolean') state.funeralSeen = stored.funeralSeen;
      if (Array.isArray(stored.history)) state.history = stored.history.slice(0, 8);
      if (typeof stored.coins === 'number') state.coins = stored.coins;
      if (typeof stored.streak === 'number') state.streak = stored.streak;
      if (stored.lastRunId) state.lastRunId = stored.lastRunId;
      if (stored.petTone) state.petTone = stored.petTone;
      if (stored.cloudRunId) state.cloudRunId = stored.cloudRunId;

      var complete = !!state.answers.problem;
      if (complete) {
        // Prefer the stored run so a reload keeps the DeepSeek output instead of
        // silently downgrading to the offline rules.
        state.result = stored.result && stored.result.hazards && stored.result.hazards.length
          ? stored.result
          : safeSimulate();
        if (state.rewindPoint) {
          state.future = stored.future && stored.future.point
            ? stored.future
            : Engine.rewrite(state.result, state.rewindPoint);
        }
      }

      state.screen = stored.screen && UI.screens[stored.screen] ? stored.screen : 'title';
      if (!complete && FLOW.indexOf(state.screen) > 0) state.screen = 'story';
      if (!state.future && state.screen === 'future') state.screen = 'rewind';
      if (migrated) save();
    } catch (error) {
      state.screen = 'title';
    }
  }

  function safeSimulate() {
    try {
      return Engine.simulate(state);
    } catch (error) {
      toast('推演引擎已切换到离线保底案例');
      return Engine.fallback(state.answers);
    }
  }

  function toast(message) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.classList.add('is-visible');
    clearTimeout(node._timer);
    node._timer = setTimeout(function () {
      node.classList.remove('is-visible');
    }, 2400);
  }

  function announce(message) {
    document.getElementById('announcer').textContent = message;
  }

  function hasApi() {
    return typeof window.SimulationAPI !== 'undefined';
  }

  function cloudReady() {
    return cloud.online && cloud.configured && cloud.database;
  }

  function runtimeLabel() {
    if (!cloud.checked) {
      return { text: '正在检测服务', detail: 'ANONYMOUS · CLOUDFLARE D1', tone: 'pending' };
    }
    if (cloudReady()) {
      var model = cloud.models && cloud.models.fast ? cloud.models.fast : 'deepseek';
      return {
        text: 'DeepSeek 已连接',
        detail: model.toUpperCase() + ' · D1' + (cloud.liveEvidence ? ' · 实时证据' : ''),
        tone: 'live'
      };
    }
    if (cloud.online && !cloud.configured) {
      return { text: '未配置 API 密钥', detail: '在 .dev.vars 填入 DEEPSEEK_API_KEY', tone: 'offline' };
    }
    if (cloud.online && !cloud.database) {
      return { text: '数据库未就绪', detail: '运行 npm run db:migrate:local', tone: 'offline' };
    }
    return { text: '离线规则引擎', detail: 'LOCAL RULES ONLY', tone: 'offline' };
  }

  function renderRuntime() {
    var info = runtimeLabel();
    var rail = document.getElementById('rail-runtime');
    if (rail) {
      rail.innerHTML = '<i></i> ' + UI.esc(info.text);
      rail.dataset.tone = info.tone;
    }
    var detail = document.getElementById('rail-runtime-detail');
    if (detail) detail.textContent = info.detail;
    var badge = document.getElementById('offline-badge');
    if (badge) {
      badge.textContent = info.tone === 'live' ? 'AI 在线'
        : info.tone === 'pending' ? '正在连接'
          : '离线模式';
      badge.dataset.tone = info.tone;
    }
  }

  function applyAccount(account) {
    if (!account) return;
    if (typeof account.coins === 'number') state.coins = account.coins;
    if (typeof account.streak === 'number') state.streak = account.streak;
    if (account.petTone) state.petTone = account.petTone;
    state.cloudAccount = true;
    save();
  }

  function checkHealth() {
    if (!hasApi()) {
      cloud.checked = true;
      renderRuntime();
      return Promise.resolve(cloud);
    }
    healthPromise = SimulationAPI.health().then(function (info) {
      cloud.online = true;
      cloud.configured = !!info.configured;
      cloud.database = !!info.database;
      cloud.liveEvidence = !!info.liveEvidence;
      cloud.models = info.models || null;
      cloud.checked = true;
      renderRuntime();
      return cloud;
    }).catch(function () {
      cloud.online = false;
      cloud.checked = true;
      renderRuntime();
      return cloud;
    });
    return healthPromise;
  }

  function whenChecked() {
    if (cloud.checked) return Promise.resolve(cloud);
    return healthPromise || checkHealth();
  }

  function hydrateCloudState() {
    if (!cloudReady()) return Promise.resolve(false);
    return SimulationAPI.cloudState().then(function (payload) {
      applyAccount(payload.account);
      var history = SimulationAPI.cloudRunsToHistory(payload.runs);
      if (history.length) state.history = history.slice(0, 8);
      save();
      if (UI.screens[state.screen]) UI.screens[state.screen](ctx);
      renderChrome();
      return true;
    }).catch(function () {
      return false;
    });
  }

  function requestCloudSimulation(base) {
    return whenChecked().then(function () {
      if (!cloudReady()) return false;
      return SimulationAPI.simulate(state.answers, 'fast').then(function (response) {
        state.result = SimulationAPI.mergeSimulation(base, response);
        state.cloudRunId = response.runId || '';
        save();
        return true;
      });
    }).catch(function (error) {
      state.cloudRunId = '';
      state.result = base;
      save();
      toast(error && error.message ? error.message : '云端推演失败，已使用离线规则');
      return false;
    });
  }

  function requestCloudRewrite(base) {
    if (!cloudReady() || !state.cloudRunId || !state.result) return Promise.resolve(false);
    var point = base.point;
    return SimulationAPI.rewrite({
      runId: state.cloudRunId,
      answers: state.answers,
      selectedPoint: {
        id: point.id,
        month: point.month,
        title: point.title,
        move: point.move,
        visual: point.visual,
        riskReduction: point.riskReduction
      },
      original: {
        deathMonth: state.result.deathMonth,
        vitals: state.result.vitals,
        obituary: state.result.obituary,
        hazards: state.result.hazards.map(function (item) {
          return { id: item.id, label: item.label, damage: item.damage };
        })
      }
    }).then(function (response) {
      if (state.rewindPoint !== point.id) return false;
      state.future = SimulationAPI.mergeRewrite(base, response);
      applyAccount(response.account);
      save();
      return true;
    }).catch(function (error) {
      toast(error && error.message ? error.message : '云端重写失败，已使用离线规则');
      return false;
    });
  }

  function awaitSimulation() {
    return pendingSimulation || Promise.resolve(false);
  }

  function commitRewind() {
    var pending = pendingRewrite || Promise.resolve(false);
    return pending.then(function () { go('future'); }, function () { go('future'); });
  }

  function setPetTone(tone) {
    state.petTone = tone;
    save();
    if (cloudReady()) {
      SimulationAPI.savePreferences({ petTone: tone }).catch(function () {});
    }
  }

  var lastFocus = null;
  function modal(title, html) {
    var root = document.getElementById('modal');
    lastFocus = document.activeElement;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    root.hidden = false;
    var focusable = root.querySelector('button, a, input, textarea, select');
    if (focusable) focusable.focus();
  }

  function closeModal() {
    var root = document.getElementById('modal');
    if (root.hidden) return;
    root.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function canReach(name) {
    if (name === 'story') return true;
    if (name === 'funeral' || name === 'unknowns' || name === 'rewind') return !!state.result;
    if (name === 'future') return !!state.future;
    return PRODUCT_VIEWS.indexOf(name) >= 0;
  }

  function resumeTarget() {
    if (state.future) return 'future';
    if (state.rewindPoint) return 'rewind';
    if (state.result && state.revealedUnknowns.length >= 3) return 'rewind';
    if (state.result && state.revealedUnknowns.length) return 'unknowns';
    if (state.result) return 'funeral';
    return 'story';
  }

  function renderProgress() {
    var nav = document.getElementById('steps');
    var current = state.screen === 'sim' ? 1 : FLOW.indexOf(state.screen);
    nav.innerHTML = FLOW.map(function (name, index) {
      var reached = canReach(name);
      var active = name === state.screen || (state.screen === 'sim' && name === 'funeral');
      var done = current > index || (name === 'story' && !!state.result);
      return '<button class="level-dot' + (active ? ' is-active' : '') + (done ? ' is-done' : '') +
        '" data-route="' + name + '"' + (reached ? '' : ' disabled') +
        ' aria-current="' + (active ? 'step' : 'false') + '">' +
        '<span>' + String(index + 1).padStart(2, '0') + '</span><b>' + LABELS[name] + '</b></button>';
    }).join('');

    Array.prototype.forEach.call(nav.querySelectorAll('[data-route]'), function (button) {
      button.onclick = function () {
        if (!canReach(button.dataset.route)) return;
        SFX.blip();
        go(button.dataset.route);
      };
    });
  }

  function recordRun() {
    if (!state.result || !state.future) return;
    var result = state.result;
    var next = state.future;
    var signature = [
      result.profile.venture.name,
      result.deathMonth,
      next.point.id,
      next.newHorizon
    ].join('|');
    if (state.lastRunId === signature) return;

    // The worker is authoritative for coins and streak once a run completes in D1,
    // so only fall back to local scoring while running offline.
    if (!state.cloudAccount) {
      var previousDay = state.history.length ? state.history[0].day : '';
      state.streak = previousDay && previousDay !== todayKey() ? state.streak + 1 : Math.max(1, state.streak);
      state.coins += 40 + state.revealedUnknowns.length * 10;
    }
    state.lastRunId = signature;
    state.history.unshift({
      id: String(Date.now()),
      day: todayKey(),
      name: result.profile.venture.name,
      stage: result.profile.venture.stage.label,
      deathMonth: result.deathMonth,
      cause: result.obituary.cause,
      hazardId: result.hazards[0].id,
      hazardIcon: result.hazards[0].icon,
      hazardDamage: result.hazards[0].damage,
      pointId: next.point.id,
      pointTitle: next.point.visual,
      monthsAdded: next.monthsAdded,
      newHorizon: next.newHorizon,
      headline: next.headline,
      nextQuest: next.nextQuest,
      status: next.status
    });
    state.history = state.history.slice(0, 8);
    save();
  }

  function renderChrome() {
    renderProgress();
    if (UI.renderChrome) UI.renderChrome(ctx);
  }

  function go(name) {
    if (!UI.screens[name]) name = 'title';
    if (FLOW.indexOf(name) >= 0 && !canReach(name)) name = 'story';
    state.screen = name;
    if (name === 'future') recordRun();
    save();
    document.getElementById('hud').hidden = false;
    document.body.dataset.screen = name;
    document.body.dataset.productView = PRODUCT_VIEWS.indexOf(name) >= 0 ? 'utility' : 'simulation';
    UI.screens[name](ctx);
    renderChrome();
    window.scrollTo(0, 0);
    var main = document.getElementById('screen');
    main.focus({ preventScroll: true });
  }

  function runSimulation() {
    var allText = state.answers.problem + ' ' + state.answers.facts + ' ' + state.answers.cares;
    var safety = DATA.checkSafety(allText);
    if (!safety.allowed) {
      SFX.warn();
      modal('这次不进入推演', '<p class="modal-message">' + UI.esc(safety.message) + '</p>');
      return false;
    }
    var base = safeSimulate();
    state.result = base;
    state.revealedUnknowns = [];
    state.rewindPoint = null;
    state.future = null;
    state.funeralSeen = false;
    state.lastRunId = '';
    state.cloudRunId = '';
    pendingRewrite = null;
    save();
    pendingSimulation = requestCloudSimulation(base);
    SFX.fork();
    go('sim');
    return true;
  }

  function selectRewind(pointId) {
    state.rewindPoint = pointId;
    var base = Engine.rewrite(state.result, pointId);
    state.future = base;
    save();
    pendingRewrite = requestCloudRewrite(base);
    renderChrome();
  }

  // Closes the loop: the next round starts from where this one ended, so the
  // 7-day contract becomes the input of the following pre-mortem.
  function startNextRound() {
    var next = state.future;
    if (next && next.point) {
      state.answers.facts = '上一轮我选择了「' + next.point.title + '」，7 天任务是：'
        + next.nextQuest + ' 目前进展：';
    }
    state.intakeIndex = 2;
    state.result = null;
    state.revealedUnknowns = [];
    state.rewindPoint = null;
    state.future = null;
    state.funeralSeen = false;
    state.lastRunId = '';
    state.cloudRunId = '';
    pendingSimulation = null;
    pendingRewrite = null;
    save();
    go('story');
  }

  function revealUnknown(id) {
    if (state.revealedUnknowns.indexOf(id) < 0) {
      state.revealedUnknowns.push(id);
      save();
      renderChrome();
    }
  }

  function reset() {
    state.answers = { problem: '', facts: '', cares: '' };
    state.intakeIndex = 0;
    state.result = null;
    state.revealedUnknowns = [];
    state.rewindPoint = null;
    state.future = null;
    state.avatarAccent = 'cyan';
    state.funeralSeen = false;
    state.lastRunId = '';
    closeModal();
    save();
    SFX.back();
    go('title');
  }

  function confirmReset() {
    modal('开始一个新项目？',
      '<p class="modal-message">当前推演会结束，但已经完成的推演仍保留在档案里。</p>' +
      '<div class="modal-actions"><button class="button danger" id="reset-yes">新建推演</button>' +
      '<button class="button ghost" id="reset-no">继续当前项目</button></div>');
    document.getElementById('reset-yes').onclick = reset;
    document.getElementById('reset-no').onclick = closeModal;
  }

  function toggleSound() {
    state.sound = !state.sound;
    SFX.setEnabled(state.sound);
    var button = document.getElementById('btn-sound');
    button.setAttribute('aria-pressed', String(state.sound));
    button.setAttribute('aria-label', state.sound ? '关闭音效' : '开启音效');
    button.classList.toggle('is-on', state.sound);
    save();
    if (state.sound) SFX.select();
    toast(state.sound ? '音效已开启' : '音效已关闭');
  }

  function showHelp() {
    modal('场景就是功能',
      '<div class="legend">' +
      '<div>' + Sprites.svg('hero', 3, state.avatarAccent) + '<span><b>角色</b>你的 Memory Map</span></div>' +
      '<div>' + Sprites.svg('grave', 3) + '<span><b>墓碑</b>第一次结局</span></div>' +
      '<div>' + Sprites.svg('block', 3) + '<span><b>问号砖</b>3 个未知盲区</span></div>' +
      '<div>' + Sprites.svg('coin', 3) + '<span><b>回溯币</b>只能改 1 次决定</span></div>' +
      '</div><p class="modal-note">momo只解释可控的商业风险。所有输入与推演仅保存在当前浏览器，离线规则始终可用。</p>');
  }

  function navigateProductView(view) {
    if (view === 'run') go(resumeTarget());
    else go(view);
  }

  function setupProductNavigation() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-home]'), function (button) {
      button.onclick = function () { go('title'); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (button) {
      button.onclick = function () {
        SFX.blip();
        navigateProductView(button.dataset.view);
      };
    });
  }

  function handleKeys(event) {
    if (event.key === 'Escape') closeModal();
    if ((event.key === 'h' || event.key === 'H') && !/input|textarea|select/i.test(event.target.tagName)) showHelp();
    if ((event.key === 's' || event.key === 'S') && !/input|textarea|select/i.test(event.target.tagName)) toggleSound();
  }

  var ctx = {
    state: state,
    save: save,
    go: go,
    toast: toast,
    announce: announce,
    modal: modal,
    closeModal: closeModal,
    runSimulation: runSimulation,
    revealUnknown: revealUnknown,
    selectRewind: selectRewind,
    resumeTarget: resumeTarget,
    recordRun: recordRun,
    awaitSimulation: awaitSimulation,
    commitRewind: commitRewind,
    startNextRound: startNextRound,
    setPetTone: setPetTone,
    runtime: function () { return cloud; }
  };

  function init() {
    load();
    SFX.setEnabled(state.sound);
    Sprites.draw(document.getElementById('hud-logo'), 'logo', 1.4);
    setupProductNavigation();
    document.getElementById('btn-sound').onclick = toggleSound;
    document.getElementById('btn-help').onclick = showHelp;
    document.getElementById('btn-reset').onclick = confirmReset;
    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (node) {
      node.onclick = closeModal;
    });
    document.addEventListener('keydown', handleKeys);
    go(state.screen);
    renderRuntime();
    checkHealth().then(hydrateCloudState);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    state: state,
    go: go,
    reset: reset,
    ctx: ctx
  };
})();
