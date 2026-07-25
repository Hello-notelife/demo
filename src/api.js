window.SimulationAPI = (function () {
  var SESSION_KEY = 'mingri.cloud.session.v1';
  var session = null;

  function loadSession() {
    if (session) return session;
    try {
      var stored = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (stored && stored.id && stored.token) session = stored;
    } catch (error) {
      session = null;
    }
    return session;
  }

  function saveSession(value) {
    session = value;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function clearSession() {
    session = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      return false;
    }
    return true;
  }

  function request(path, options, allowRetry) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 60000);
    var current = loadSession();
    var headers = Object.assign({
      'Content-Type': 'application/json'
    }, options && options.headers ? options.headers : {});
    if (current) {
      headers.Authorization = 'Bearer ' + current.token;
      headers['X-Mingri-Session'] = current.id;
    }

    return fetch(path, Object.assign({}, options || {}, {
      headers: headers,
      signal: controller.signal
    })).then(function (response) {
      clearTimeout(timer);
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (response.status === 401 && allowRetry !== false) {
          clearSession();
          return ensureSession().then(function () {
            return request(path, options, false);
          });
        }
        if (!response.ok) {
          var error = new Error(body && body.error && body.error.message
            ? body.error.message
            : '云端推演暂时不可用');
          error.status = response.status;
          error.code = body && body.error ? body.error.code : 'request_failed';
          throw error;
        }
        return body;
      });
    }).catch(function (error) {
      clearTimeout(timer);
      if (error && error.name === 'AbortError') {
        var timeoutError = new Error('推演超时，已切换到本地规则引擎');
        timeoutError.code = 'timeout';
        throw timeoutError;
      }
      throw error;
    });
  }

  function ensureSession() {
    var current = loadSession();
    if (current) return Promise.resolve(current);
    return request('/api/session', {
      method: 'POST',
      body: '{}'
    }, false).then(function (created) {
      saveSession({
        id: created.id,
        token: created.token
      });
      return session;
    });
  }

  function health() {
    return request('/api/health', { method: 'GET' }, false);
  }

  function cloudState() {
    return ensureSession().then(function () {
      return request('/api/state', { method: 'GET' });
    });
  }

  function simulate(answers, mode) {
    return ensureSession().then(function () {
      return request('/api/simulate', {
        method: 'POST',
        body: JSON.stringify({
          answers: answers,
          mode: mode
        })
      });
    });
  }

  function rewrite(payload) {
    return ensureSession().then(function () {
      return request('/api/rewrite', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    });
  }

  function savePreferences(value) {
    return ensureSession().then(function () {
      return request('/api/state', {
        method: 'PATCH',
        body: JSON.stringify(value)
      });
    });
  }

  function byId(items) {
    var map = {};
    (items || []).forEach(function (item) {
      if (item && item.id) map[item.id] = item;
    });
    return map;
  }

  function mergeSimulation(base, response) {
    var ai = response.result || {};
    var aiHazards = byId(ai.hazards);
    var aiUnknowns = byId(ai.unknowns);
    var aiPoints = byId(ai.turningPoints);
    var merged = JSON.parse(JSON.stringify(base));

    if (ai.profile) {
      merged.profile.venture.name = ai.profile.ventureName || merged.profile.venture.name;
      merged.profile.venture.stage.label = ai.profile.stageLabel || merged.profile.venture.stage.label;
      merged.profile.venture.customer = ai.profile.customer || merged.profile.venture.customer;
      if (Array.isArray(ai.profile.strengths) && ai.profile.strengths.length) {
        merged.profile.memory.strengths = ai.profile.strengths.slice(0, 3);
      }
    }

    merged.hazards = merged.hazards.map(function (item) {
      return Object.assign({}, item, aiHazards[item.id] || {});
    }).sort(function (a, b) { return b.damage - a.damage; });

    if (ai.vitals) merged.vitals = Object.assign({}, merged.vitals, ai.vitals);
    if (ai.deathMonth) merged.deathMonth = ai.deathMonth;
    if (Array.isArray(ai.scenarios) && ai.scenarios.length === 3) {
      var aiScenarios = byId(ai.scenarios);
      merged.scenarios = merged.scenarios.map(function (item) {
        return Object.assign({}, item, aiScenarios[item.id] || {});
      });
    }
    if (Array.isArray(ai.timeline) && ai.timeline.length === merged.timeline.length) {
      merged.timeline = merged.timeline.map(function (item, index) {
        return Object.assign({}, item, ai.timeline[index], {
          icon: index === 0 ? 'shop'
            : index === merged.timeline.length - 1 ? 'grave'
              : (ai.timeline[index].kind && aiHazards[ai.timeline[index].kind]
                ? aiHazards[ai.timeline[index].kind].icon || item.icon
                : item.icon)
        });
      });
    }
    merged.unknowns = merged.unknowns.map(function (item) {
      return Object.assign({}, item, aiUnknowns[item.id] || {});
    });
    merged.turningPoints = merged.turningPoints.map(function (item) {
      return Object.assign({}, item, aiPoints[item.id] || {});
    });
    if (ai.obituary) merged.obituary = Object.assign({}, merged.obituary, ai.obituary);
    merged.meta = {
      mode: 'ai',
      provider: response.provider || 'deepseek',
      model: response.model || '',
      runId: response.runId || '',
      confidence: ai.meta && ai.meta.confidence ? ai.meta.confidence : '模型推演',
      assumptions: ai.meta && Array.isArray(ai.meta.assumptions) ? ai.meta.assumptions : [],
      evidence: Array.isArray(response.evidence) ? response.evidence : [],
      source: response.evidence && response.evidence.length
        ? '你的叙述 + DeepSeek + 实时行业证据'
        : '你的叙述 + DeepSeek'
    };
    return merged;
  }

  function mergeRewrite(base, response) {
    var ai = response.result || {};
    var merged = Object.assign({}, base, ai);
    merged.point = base.point;
    merged.vitals = Object.assign({}, base.vitals, ai.vitals || {});
    merged.changed = Array.isArray(ai.changed) && ai.changed.length
      ? ai.changed.slice(0, 3)
      : base.changed;
    merged.meta = {
      mode: 'ai',
      provider: response.provider || 'deepseek',
      model: response.model || '',
      runId: response.runId || '',
      account: response.account || null
    };
    return merged;
  }

  function cloudRunsToHistory(runs) {
    return (runs || []).filter(function (run) {
      return run && run.result && run.future;
    }).map(function (run) {
      var result = run.result;
      var future = run.future;
      var topHazard = result.hazards && result.hazards[0] ? result.hazards[0] : {};
      var point = future.point || {};
      return {
        id: run.id,
        day: String(run.createdAt || '').slice(0, 10),
        name: run.projectName || (result.profile && result.profile.ventureName) || '未命名项目',
        stage: run.stageLabel || '未知阶段',
        deathMonth: result.deathMonth || 0,
        cause: result.obituary ? result.obituary.cause : topHazard.label,
        hazardId: topHazard.id || 'demand',
        hazardIcon: topHazard.icon || 'grave',
        hazardDamage: topHazard.damage || 0,
        pointId: point.id || '',
        pointTitle: point.visual || '',
        monthsAdded: future.monthsAdded || 0,
        newHorizon: future.newHorizon || 0,
        headline: future.headline || '',
        nextQuest: future.nextQuest || '',
        status: future.status || 'delayed',
        provider: run.provider,
        model: run.model
      };
    });
  }

  return {
    health: health,
    cloudState: cloudState,
    simulate: simulate,
    rewrite: rewrite,
    savePreferences: savePreferences,
    mergeSimulation: mergeSimulation,
    mergeRewrite: mergeRewrite,
    cloudRunsToHistory: cloudRunsToHistory
  };
})();
