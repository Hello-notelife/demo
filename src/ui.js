window.UI = (function () {
  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };
  var screen = function () { return document.getElementById('screen'); };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function sceneBackdrop(theme) {
    return '<div class="scene-backdrop ' + theme + '" aria-hidden="true">' +
      '<div class="scene-sun"></div>' +
      '<i class="cloud cloud-a"></i><i class="cloud cloud-b"></i><i class="cloud cloud-c"></i>' +
      '<div class="far-hills"></div><div class="near-hills"></div>' +
      '<div class="pixel-ground"></div>' +
      '<i class="grass grass-a"></i><i class="grass grass-b"></i><i class="grass grass-c"></i>' +
      '</div>';
  }

  function projectVitals(result, override) {
    var values = override || result.vitals;
    var items = [
      { key: 'life', label: '生命', icon: 'heart', value: values.life, tone: 'coral' },
      { key: 'evidence', label: '证据', icon: 'coin', value: values.evidence, tone: 'amber' },
      { key: 'runway', label: '跑道', icon: 'clock', value: values.runway, tone: 'lime' },
      { key: 'distribution', label: '获客', icon: 'bridge', value: values.distribution, tone: 'cyan' }
    ];
    return '<div class="vitals" aria-label="项目生命指标">' + items.map(function (item) {
      return '<div class="vital" title="' + item.label + ' ' + item.value + '">' +
        Sprites.svg(item.icon, 2, item.tone) +
        '<span><i class="tone-' + item.tone + '" style="width:' + item.value + '%"></i></span>' +
        '<b>' + item.value + '</b></div>';
    }).join('') + '</div>';
  }

  function scenarioBoard(result) {
    var scenarios = result.scenarios || [];
    if (scenarios.length !== 3) return '';
    var horizon = scenarios.reduce(function (max, item) {
      return Math.max(max, item.deathMonth);
    }, 1);
    return '<div class="scenario-board">' +
      '<div class="scenario-head"><b>三条未来线</b>' +
        '<small>同一个项目，取决于哪个条件先成立</small></div>' +
      scenarios.map(function (item) {
        return '<div class="scenario-row is-' + item.id + '">' +
          '<div class="scenario-tag"><b>' + esc(item.label) + '</b>' +
            '<i>' + item.probability + '%</i></div>' +
          '<div class="scenario-body">' +
            '<div class="scenario-bar">' +
              '<i style="width:' + Math.round(item.deathMonth / horizon * 100) + '%"></i>' +
              '<span>M' + item.deathMonth + '</span></div>' +
            '<b class="scenario-cause">' + esc(item.cause) + '</b>' +
            '<p>' + esc(item.short) + '</p>' +
            '<small>' + esc(item.trigger) + '</small>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function actionContract(result, next) {
    var deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    var topHazard = result.hazards && result.hazards[0] ? result.hazards[0].id : '';
    var linked = (result.unknowns || []).filter(function (item) {
      return item.hazard === topHazard;
    })[0] || (result.unknowns || [])[0] || {};
    return '<div class="action-contract">' +
      '<div class="contract-head"><b>行动契约</b><small>ACTION CONTRACT · 7 DAYS</small></div>' +
      '<div class="contract-grid">' +
        '<div><span>要做的事</span><b>' + esc(next.nextQuest) + '</b></div>' +
        '<div><span>截止</span><b>' +
          (deadline.getMonth() + 1) + ' 月 ' + deadline.getDate() + ' 日</b></div>' +
        '<div><span>成功判据</span><b>' +
          esc(linked.proof || '拿到一次真实付款，或一个明确的拒绝理由') + '</b></div>' +
        '<div><span>停止条件</span><b>到期仍是零证据，就回到抉择页换一条线，不要延长</b></div>' +
      '</div>' +
      '<p class="contract-note">没有正确的选择，只有把选择变成正确！</p>' +
    '</div>';
  }

  function title(ctx) {
    var history = ctx.state.history || [];
    var latest = history[0];
    var completed = ctx.state.future ? 5
      : ctx.state.rewindPoint ? 4
      : ctx.state.revealedUnknowns.length ? 3
      : ctx.state.result ? 2
      : (ctx.state.answers.memory ? 1 : 0);
    var progress = completed / 5 * 100;
    var runLabel = completed ? '继续当前推演' : '开始第一次预演';

    screen().innerHTML =
      '<section class="product-home">' +
        '<header class="home-greeting">' +
          '<div><span class="home-spark">✦</span><h1>今天，先看坏结局。</h1>' +
          '<p>让momo陪你把风险变成下一步。</p></div>' +
          '<div class="streak-chip"><span>🔥</span><b>' + Math.max(1, ctx.state.streak || 0) + '</b><small>次连续推演</small></div>' +
        '</header>' +

        '<section class="focus-stage">' +
          '<div class="focus-copy">' +
            '<span class="focus-kicker">TODAY’S FOCUS · 商业未来沙盘</span>' +
            '<h2>没有正确的选择，<br>只有把选择变成正确！</h2>' +
            '<p>讲述项目，预演死亡，揭开三个盲区，只改一次决定。</p>' +
            '<div class="focus-actions">' +
              '<button class="button primary jumbo" data-action="start">' + runLabel + ' <span>→</span></button>' +
              '<button class="button paper" data-action="demo">试玩真实案例</button>' +
            '</div>' +
            '<div class="trust-strip" aria-label="产品特点">' +
              '<span>约 3 分钟</span><i></i><span>无需登录</span><i></i><span>DeepSeek 推演</span>' +
            '</div>' +
          '</div>' +
          '<div class="focus-visual" aria-label="项目生存与失败两种未来的像素场景">' +
            '<img src="assets/media/future-island-v2.png" alt="一座同时通向生存和失败的商业浮岛">' +
            '<span class="focus-risk risk-one">' + Sprites.svg('bridge', 3) + '罗列利弊</span>' +
            '<span class="focus-risk risk-two">' + Sprites.svg('grave', 3) + '可能结局</span>' +
          '</div>' +
        '</section>' +

        '<section class="home-progress">' +
          '<div class="progress-heading"><div><span>当前推演</span><h2>' +
            (ctx.state.result ? esc(ctx.state.result.profile.venture.name) : '还没有命名') +
          '</h2></div><button class="text-button" data-action="resume">查看路径 →</button></div>' +
          '<div class="progress-track"><i style="width:' + progress + '%"></i></div>' +
          '<div class="progress-steps">' +
            ['讲述', '讣告', '盲区', '抉择', '新未来'].map(function (label, index) {
              return '<span class="' + (index < completed ? 'is-done' : index === completed ? 'is-current' : '') +
                '"><b>' + String(index + 1).padStart(2, '0') + '</b>' + label + '</span>';
            }).join('') +
          '</div>' +
        '</section>' +

        '<section class="home-bottom">' +
          '<div class="buddy-callout">' +
            '<img src="assets/media/xiaopu-guide-v2.png" alt="momo像素向导">' +
            '<div><span>momo建议</span><h2>' +
              (ctx.state.future ? '别庆祝太久，去完成 7 天任务。'
                : ctx.state.result ? '讣告已经写好，下一步是找证据。'
                : '先说真话，不需要写一份漂亮商业计划。') +
            '</h2><p>' +
              (ctx.state.future ? esc(ctx.state.future.nextQuest)
                : '我不会替你保证成功，只会更早暴露项目会怎么死。') +
            '</p></div>' +
          '</div>' +
          '<div class="latest-run">' +
            '<div class="latest-head"><span>最近档案</span><button data-action="archive">全部 →</button></div>' +
            (latest
              ? '<div class="latest-row"><span>' + Sprites.svg(latest.hazardIcon || 'grave', 4) + '</span>' +
                '<div><b>' + esc(latest.name) + '</b><small>原结局 M' + latest.deathMonth + ' · ' +
                esc(latest.cause) + '</small></div><strong>+' + latest.monthsAdded + ' 月</strong></div>'
              : '<div class="latest-empty"><span>' + Sprites.svg('grave', 4) + '</span>' +
                '<p>完成第一次推演后，结局会留在这里。</p></div>') +
          '</div>' +
        '</section>' +
      '</section>';

    $('[data-action=start]').onclick = function () {
      SFX.select();
      if (!completed) ctx.state.intakeIndex = 0;
      ctx.save();
      ctx.go(completed ? ctx.resumeTarget() : 'story');
    };
    $('[data-action=demo]').onclick = function () {
      SFX.select();
      presetPicker(ctx);
    };
    $('[data-action=resume]').onclick = function () {
      ctx.go(ctx.resumeTarget());
    };
    $('[data-action=archive]').onclick = function () {
      ctx.go('archive');
    };
  }

  function presetPicker(ctx) {
    ctx.modal('选择一个可玩的项目', '<div class="preset-list">' +
      DATA.PRESETS.map(function (preset, index) {
        return '<button class="preset-choice" data-preset="' + index + '">' +
          '<span class="preset-avatar">' + Sprites.svg('hero', 4, preset.color) + '</span>' +
          '<span><b>' + esc(preset.name) + '</b><small>' + esc(preset.label) + '</small></span>' +
          '<i>PLAY →</i></button>';
      }).join('') + '</div>');
    $$('[data-preset]').forEach(function (button) {
      button.onclick = function () {
        ctx.closeModal();
        ctx.loadPreset(Number(button.dataset.preset));
      };
    });
  }

  function memoryPath(profile, activeIndex, accent) {
    var nodes = profile.memory.nodes;
    var content = nodes.length ? nodes.map(function (node, index) {
      return '<div class="memory-node node-' + index + '">' +
        '<span>' + Sprites.svg(node.icon, 3, accent) + '</span>' +
        '<b>' + esc(node.label) + '</b><small>' + esc(node.short) + '</small></div>';
    }).join('') : '<div class="empty-path"><i></i><i></i><i></i><span>你的过去会在这里长成地图</span></div>';

    return '<div class="memory-path stage-' + activeIndex + '">' +
      '<div class="path-line"></div>' + content +
      '<div class="path-hero">' + Sprites.svg('hero', 5, accent) + '</div>' +
      (activeIndex >= 1 ? '<div class="venture-gate">' + Sprites.svg('shop', 5) + '<b>项目入口</b></div>' : '') +
      (activeIndex >= 2 ? '<div class="reality-pit">' + Sprites.svg('pit', 5) + '<b>现实</b></div>' : '') +
      '</div>';
  }

  function story(ctx) {
    var index = Math.max(0, Math.min(2, ctx.state.intakeIndex || 0));
    var prompt = DATA.PROMPTS[index];
    var answer = ctx.state.answers[prompt.key] || '';
    var profile = Engine.buildProfile(ctx.state.answers);

    screen().innerHTML =
      '<section class="game-screen intake">' +
        '<div class="intake-visual">' +
          sceneBackdrop(index === 2 ? 'sunset' : 'day') +
          '<div class="intake-level">' +
            '<span>' + prompt.level + '</span>' +
            '<div class="level-meter"><i style="width:' + ((index + 1) / 3 * 100) + '%"></i></div>' +
          '</div>' +
          memoryPath(profile, index, ctx.state.avatarAccent) +
          '<button class="avatar-shuffle" data-action="avatar" aria-label="更换角色颜色">' +
            Sprites.svg('spark', 2) + '换个角色</button>' +
        '</div>' +
        '<div class="dialog-panel">' +
          '<div class="speaker"><span><img src="assets/media/xiaopu-guide-v2.png" alt=""></span>' +
            '<b>momo · 只问一件事</b></div>' +
          '<h1>' + esc(prompt.title) + '</h1>' +
          '<p class="dialog-question">' + esc(prompt.question) + '</p>' +
          '<div class="answer-field">' +
            '<textarea id="story-answer" rows="6" placeholder="' + esc(prompt.placeholder) + '">' + esc(answer) + '</textarea>' +
            '<button class="voice-button" id="voice-input" type="button" aria-label="使用语音输入">● <span>说给我听</span></button>' +
          '</div>' +
          '<div class="answer-starters">' + prompt.suggestions.map(function (suggestion) {
            return '<button data-starter="' + esc(suggestion) + '">' + esc(suggestion) + '</button>';
          }).join('') + '</div>' +
          '<p class="input-helper">' + esc(prompt.helper) + '</p>' +
          '<div class="dialog-actions">' +
            '<button class="button ghost" data-action="back">←</button>' +
            '<span>' + (index + 1) + ' / 3</span>' +
            '<button class="button primary" data-action="next">' + (index === 2 ? '让未来发生 →' : '继续 →') + '</button>' +
          '</div>' +
        '</div>' +
      '</section>';

    var textarea = $('#story-answer');
    textarea.oninput = function () {
      ctx.state.answers[prompt.key] = textarea.value;
      ctx.save();
    };
    $$('[data-starter]').forEach(function (button) {
      button.onclick = function () {
        if (textarea.value && !/\s$/.test(textarea.value)) textarea.value += ' ';
        textarea.value += button.dataset.starter;
        textarea.focus();
        textarea.dispatchEvent(new Event('input'));
        SFX.blip();
      };
    });
    $('[data-action=avatar]').onclick = function () {
      var accents = ['cyan', 'amber', 'pink', 'lime'];
      var current = accents.indexOf(ctx.state.avatarAccent);
      ctx.state.avatarAccent = accents[(current + 1) % accents.length];
      ctx.save();
      SFX.blip();
      story(ctx);
    };
    $('[data-action=back]').onclick = function () {
      if (index === 0) ctx.go('title');
      else {
        ctx.state.intakeIndex = index - 1;
        ctx.save();
        SFX.back();
        story(ctx);
      }
    };
    $('[data-action=next]').onclick = function () {
      var value = textarea.value.trim();
      if (value.length < 12) {
        ctx.toast('再多说一点，让地图有东西可画');
        textarea.focus();
        SFX.warn();
        return;
      }
      ctx.state.answers[prompt.key] = value;
      if (index < 2) {
        ctx.state.intakeIndex = index + 1;
        ctx.save();
        SFX.select();
        story(ctx);
      } else {
        ctx.save();
        ctx.runSimulation();
      }
    };
    setupVoiceInput(ctx, textarea);
  }

  function setupVoiceInput(ctx, textarea) {
    var button = $('#voice-input');
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      button.onclick = function () {
        ctx.toast('当前浏览器不支持语音识别，可以直接输入或粘贴');
      };
      return;
    }
    button.onclick = function () {
      var recognition = new Recognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      button.classList.add('is-listening');
      button.querySelector('span').textContent = '正在听…';
      recognition.onresult = function (event) {
        var transcript = event.results[0][0].transcript;
        textarea.value += (textarea.value ? ' ' : '') + transcript;
        textarea.dispatchEvent(new Event('input'));
      };
      recognition.onerror = function () {
        ctx.toast('没有听清，可以继续打字');
      };
      recognition.onend = function () {
        button.classList.remove('is-listening');
        button.querySelector('span').textContent = '说给我听';
      };
      recognition.start();
    };
  }

  function sim(ctx) {
    var result = ctx.state.result;
    if (!result) return ctx.go('story');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hazards = result.hazards.slice(0, 3);
    screen().innerHTML =
      '<section class="game-screen death-run">' +
        sceneBackdrop('storm') +
        '<div class="run-hud">' +
          '<span>FUTURE RUN</span>' +
          projectVitals(result) +
          '<button class="skip-run" data-action="skip">跳过动画 →</button>' +
        '</div>' +
        '<div class="run-track" aria-label="项目未来正在展开">' +
          '<div class="run-hero">' + Sprites.svg('hero', 6, ctx.state.avatarAccent) + '</div>' +
          '<div class="run-start">' + Sprites.svg('shop', 5) + '<b>今天</b></div>' +
          hazards.map(function (hazard, index) {
            return '<div class="run-obstacle obstacle-' + index + '" data-hazard-run="' + hazard.id + '">' +
              Sprites.svg(hazard.icon, 6) + '<b>' + esc(hazard.label) + '</b>' +
              '<span>−' + hazard.damage + '</span></div>';
          }).join('') +
          '<div class="run-finish">' + Sprites.svg('grave', 7) + '<b>第 ' + result.deathMonth + ' 月</b></div>' +
          '<div class="run-floor"></div>' +
        '</div>' +
        '<div class="run-caption" id="run-caption">正在把你的叙述变成一条未来路径…</div>' +
      '</section>';

    var captions = hazards.map(function (hazard) { return hazard.short; });
    var caption = $('#run-caption');
    var delay = reduceMotion ? 80 : 850;
    hazards.forEach(function (hazard, index) {
      setTimeout(function () {
        if (ctx.state.screen !== 'sim') return;
        var obstacle = $('[data-hazard-run="' + hazard.id + '"]');
        if (obstacle) obstacle.classList.add('is-hit');
        caption.textContent = captions[index];
        SFX.warn();
      }, delay * (index + 1));
    });
    var finish = function () {
      if (ctx.state.screen !== 'sim') return;
      var proceed = function () {
        if (ctx.state.screen !== 'sim') return;
        ctx.state.funeralSeen = true;
        ctx.save();
        SFX.fail();
        ctx.go('funeral');
      };
      // Hold the run screen until the cloud simulation settles, so the obituary
      // renders the DeepSeek result rather than the offline placeholder.
      var pending = ctx.awaitSimulation ? ctx.awaitSimulation() : null;
      if (pending && typeof pending.then === 'function') {
        caption.textContent = 'DeepSeek 正在完成推演…';
        pending.then(proceed, proceed);
      } else {
        proceed();
      }
    };
    var timer = setTimeout(finish, reduceMotion ? 500 : delay * 4.3);
    $('[data-action=skip]').onclick = function () {
      clearTimeout(timer);
      finish();
    };
  }

  function timelineMap(result, activeIndex) {
    return '<div class="timeline-map" role="list" aria-label="死亡时间线">' +
      '<div class="timeline-rail"></div>' +
      result.timeline.map(function (event, index) {
        return '<button class="timeline-stop stop-' + index + (activeIndex === index ? ' is-active' : '') +
          '" data-event="' + index + '" role="listitem">' +
          '<span>' + Sprites.svg(event.icon, index === 4 ? 4 : 3) + '</span>' +
          '<b>' + (event.month ? 'M' + event.month : 'NOW') + '</b>' +
          '<small>' + esc(event.label) + '</small></button>';
      }).join('') + '</div>';
  }

  function funeral(ctx, activeIndex) {
    var result = ctx.state.result;
    if (!result) return ctx.go('story');
    var selectedIndex = typeof activeIndex === 'number' ? activeIndex : 4;
    var event = result.timeline[selectedIndex];

    screen().innerHTML =
      '<section class="game-screen funeral">' +
        '<div class="funeral-world">' +
          sceneBackdrop('night') +
          '<div class="funeral-top">' +
            '<span class="world-label">WORLD 03 · THE FUNERAL</span>' +
            projectVitals(result) +
          '</div>' +
          '<div class="moon"></div>' +
          '<div class="grave-stage">' +
            '<div class="ghost-hero">' + Sprites.svg('hero', 6, ctx.state.avatarAccent) + '</div>' +
            '<div class="main-grave">' + Sprites.svg('grave', 10) + '<span>' + esc(result.profile.venture.name) + '</span></div>' +
            '<div class="hazard-shadow one">' + Sprites.svg(result.hazards[0].icon, 6) + '</div>' +
            '<div class="hazard-shadow two">' + Sprites.svg(result.hazards[1].icon, 5) + '</div>' +
          '</div>' +
          timelineMap(result, selectedIndex) +
          '<div class="event-dialog"><span>' + Sprites.svg(event.icon, 3) + '</span>' +
            '<div><b>' + esc(event.label) + '</b><p>' + esc(event.short) + '</p></div></div>' +
        '</div>' +
        '<article class="obituary-sheet">' +
          '<div class="obituary-mark">' + Sprites.svg('skull', 4) + '</div>' +
          '<span class="obituary-kicker">未来商业讣告 · ' +
            (result.meta && result.meta.mode === 'ai' ? 'DEEPSEEK SIMULATION' : 'OFFLINE SIMULATION') + '</span>' +
          '<h1>' + esc(result.obituary.headline) + '</h1>' +
          '<div class="death-cause">' +
            '<small>首要死因</small><b>' + esc(result.obituary.cause) + '</b><span>' + esc(result.obituary.subhead) + '</span>' +
          '</div>' +
          '<div class="obituary-lines">' +
            result.obituary.body.map(function (line) { return '<p>' + esc(line) + '</p>'; }).join('') +
          '</div>' +
          scenarioBoard(result) +
          '<blockquote>“' + esc(result.obituary.epitaph) + '”</blockquote>' +
          '<div class="obituary-facts">' +
            '<span><b>' + result.deathMonth + '</b>个月寿命</span>' +
            '<span><b>' + result.hazards[0].damage + '</b>最高风险</span>' +
            '<span><b>3</b>个未知盲区</span>' +
          '</div>' +
          '<button class="button primary wide" data-action="unknowns">敲开 3 个隐藏盲区 →</button>' +
          '<button class="text-button" data-action="edit">输入不对？回去重说</button>' +
        '</article>' +
      '</section>';

    $$('[data-event]').forEach(function (button) {
      button.onclick = function () {
        SFX.blip();
        funeral(ctx, Number(button.dataset.event));
      };
    });
    $('[data-action=unknowns]').onclick = function () {
      SFX.select();
      ctx.go('unknowns');
    };
    $('[data-action=edit]').onclick = function () {
      ctx.state.intakeIndex = 2;
      ctx.save();
      ctx.go('story');
    };
  }

  function unknowns(ctx, selectedId) {
    var result = ctx.state.result;
    if (!result) return ctx.go('story');
    var revealed = ctx.state.revealedUnknowns || [];
    var selected = result.unknowns.filter(function (item) {
      return item.id === selectedId;
    })[0] || result.unknowns.filter(function (item) {
      return revealed.indexOf(item.id) >= 0;
    })[0];
    var allDone = revealed.length >= result.unknowns.length;

    screen().innerHTML =
      '<section class="game-screen unknown-world">' +
        sceneBackdrop('cave') +
        '<div class="unknown-head">' +
          '<span class="world-label">WORLD 04 · UNKNOWN UNKNOWN</span>' +
          '<h1>地图上有 3 块你没看见的砖。</h1>' +
          '<button class="button scan" data-action="scan">' + (allDone ? '已扫描 3 / 3' : '一键扫描 3 个盲区') + '</button>' +
        '</div>' +
        '<div class="block-field">' +
          result.unknowns.map(function (item, index) {
            var isRevealed = revealed.indexOf(item.id) >= 0;
            return '<button class="mystery-block block-' + index + (isRevealed ? ' is-open' : '') +
              '" data-unknown="' + item.id + '" aria-label="' + (isRevealed ? esc(item.title) : '未发现的盲区') + '">' +
              (isRevealed ? Sprites.svg(item.icon, 6) : Sprites.svg('block', 7)) +
              '<b>' + (isRevealed ? esc(item.title) : '?') + '</b></button>';
          }).join('') +
          '<div class="unknown-hero">' + Sprites.svg('hero', 6, ctx.state.avatarAccent) + '</div>' +
          '<div class="cave-floor"></div>' +
        '</div>' +
        '<div class="unknown-dialog ' + (selected ? 'has-content' : '') + '">' +
          (selected
            ? '<span class="unknown-icon">' + Sprites.svg(selected.icon, 4) + '</span>' +
              '<div><h2>' + esc(selected.title) + '</h2><p>' + esc(selected.short) + '</p>' +
              '<div class="mini-quest"><b>7 天验证</b><span>' + esc(selected.action) + '</span></div></div>'
            : '<span class="unknown-icon">' + Sprites.svg('block', 4) + '</span><div><h2>敲一下问号砖</h2><p>每块砖后面，都是一条会改变结局的事实。</p></div>') +
          '<button class="button primary" data-action="rewind"' + (allDone ? '' : ' disabled') + '>拿到回溯币 →</button>' +
        '</div>' +
      '</section>';

    $$('[data-unknown]').forEach(function (button) {
      button.onclick = function () {
        var id = button.dataset.unknown;
        ctx.revealUnknown(id);
        SFX.coin();
        unknowns(ctx, id);
      };
    });
    $('[data-action=scan]').onclick = function () {
      result.unknowns.forEach(function (item) { ctx.revealUnknown(item.id); });
      SFX.coin();
      unknowns(ctx, result.unknowns[0].id);
    };
    $('[data-action=rewind]').onclick = function () {
      SFX.select();
      ctx.go('rewind');
    };
  }

  function rewind(ctx) {
    var result = ctx.state.result;
    if (!result) return ctx.go('story');
    var active = ctx.state.rewindPoint;
    var chosen = result.turningPoints.filter(function (item) { return item.id === active; })[0];

    screen().innerHTML =
      '<section class="game-screen rewind-world">' +
        sceneBackdrop(active ? 'rewind-active' : 'sunset') +
        '<div class="rewind-head">' +
          '<div class="rewind-coin">' + Sprites.svg('coin', 5) + '<span>× 1</span></div>' +
          '<div><span class="world-label">WORLD 05 · ONE CHANCE</span><h1>只能改一个决定。</h1></div>' +
        '</div>' +
        '<div class="rewind-track">' +
          '<div class="rewind-rail"></div>' +
          result.turningPoints.map(function (point, index) {
            return '<button class="checkpoint checkpoint-' + index + (active === point.id ? ' is-selected' : '') +
              '" data-point="' + point.id + '">' +
              '<span class="checkpoint-flag">' + Sprites.svg(point.icon, 6) + '</span>' +
              '<small>M' + point.month + '</small><b>' + esc(point.title) + '</b>' +
              '<i>+' + point.riskReduction + '</i></button>';
          }).join('') +
          '<div class="rewind-hero">' + Sprites.svg('hero', 6, ctx.state.avatarAccent) + '</div>' +
          '<div class="future-grave ' + (active ? 'is-fading' : '') + '">' + Sprites.svg('grave', 7) + '</div>' +
        '</div>' +
        '<div class="rewind-dialog">' +
          (chosen
            ? '<span>' + Sprites.svg(chosen.icon, 4) + '</span><div><h2>' + esc(chosen.visual) + '</h2><p>' + esc(chosen.move) + '</p></div>'
            : '<span>' + Sprites.svg('coin', 4) + '</span><div><h2>把回溯币投向一个检查点</h2><p>选择后，系统立即重写未来。</p></div>') +
          '<button class="button primary" data-action="rewrite"' + (chosen ? '' : ' disabled') + '>重写结局 →</button>' +
        '</div>' +
      '</section>';

    $$('[data-point]').forEach(function (button) {
      button.onclick = function () {
        ctx.selectRewind(button.dataset.point);
        SFX.shift();
        rewind(ctx);
      };
    });
    $('[data-action=rewrite]').onclick = function () {
      var button = $('[data-action=rewrite]');
      SFX.success();
      if (!ctx.commitRewind) return ctx.go('future');
      button.disabled = true;
      button.textContent = '正在重写…';
      ctx.commitRewind();
    };
  }

  function future(ctx) {
    var result = ctx.state.result;
    var next = ctx.state.future;
    if (!result || !next) return ctx.go('rewind');
    var repairSprite = next.point.id === 'sell-first' ? 'coin' : next.point.id === 'narrow-channel' ? 'bridge' : 'shield';

    screen().innerHTML =
      '<section class="game-screen future-world">' +
        '<div class="future-scene">' +
          sceneBackdrop('dawn') +
          '<div class="future-top">' +
            '<span class="world-label">NEW FUTURE · PATH REWRITTEN</span>' +
            projectVitals(result, next.vitals) +
          '</div>' +
          '<div class="new-road">' +
            '<div class="alive-shop">' + Sprites.svg('shop', 8) + '<b>' + esc(result.profile.venture.name) + '</b></div>' +
            '<div class="repair">' + Sprites.svg(repairSprite, 7) + '<span>' + esc(next.point.visual) + '</span></div>' +
            '<div class="future-hero">' + Sprites.svg('hero', 7, ctx.state.avatarAccent) + '</div>' +
            '<div class="sunrise-flag">' + Sprites.svg('flag', 7) + '<b>M' + next.newHorizon + '</b></div>' +
          '</div>' +
          '<div class="life-gain">+' + next.monthsAdded + ' 个月 <span>新验证窗口</span></div>' +
        '</div>' +
        '<article class="future-result">' +
          '<div class="result-stamp">' + (next.status === 'surviving' ? '讣告撤回' : '讣告延期') + '</div>' +
          '<span class="result-kicker">未来已重写，但没有被保证</span>' +
          '<h1>' + esc(next.headline) + '</h1>' +
          '<p class="future-subhead">' + esc(next.subhead) + '</p>' +
          '<div class="change-visual">' +
            next.changed.map(function (item, index) {
              return '<span><i>' + ['✓', '+', '↑'][index] + '</i>' + esc(item) + '</span>';
            }).join('') +
          '</div>' +
          actionContract(result, next) +
          '<div class="result-actions">' +
            '<button class="button primary" data-action="share">生成结局卡</button>' +
            '<button class="button ghost" data-action="again">带着这个起点再推演 →</button>' +
          '</div>' +
          '<button class="text-button" data-action="rewind">换一个回溯点</button>' +
        '</article>' +
      '</section>';

    $('[data-action=share]').onclick = function () { shareCard(ctx); };
    $('[data-action=again]').onclick = function () {
      SFX.select();
      if (ctx.startNextRound) ctx.startNextRound();
      else {
        ctx.state.intakeIndex = 1;
        ctx.save();
        ctx.go('story');
      }
    };
    $('[data-action=rewind]').onclick = function () {
      ctx.go('rewind');
    };
  }

  var RISK_CATALOG = [
    {
      id: 'demand',
      label: '伪需求沼泽',
      icon: 'swamp',
      tone: 'green',
      signal: '用户说喜欢，却迟迟不付款。',
      test: '向 5 位目标客户现场提出真实付费方案。'
    },
    {
      id: 'channel',
      label: '罗列利弊',
      icon: 'bridge',
      tone: 'blue',
      signal: '一直在纸上比较利弊，迟迟没有把选择变成行动。',
      test: '选定一条路，用同一话术触达 30 位陌生目标客户。'
    },
    {
      id: 'cash',
      label: '现金深坑',
      icon: 'pit',
      tone: 'yellow',
      signal: '验证速度比现金消耗速度更慢。',
      test: '把未来 12 周的必要支出和验证里程碑放在一张表。'
    },
    {
      id: 'founder',
      label: '创始人火山',
      icon: 'fire',
      tone: 'coral',
      signal: '产品、销售和交付都只依赖一个人。',
      test: '找出一件必须从创始人身上移走的重复动作。'
    }
  ];

  function archive(ctx) {
    var history = ctx.state.history || [];
    screen().innerHTML =
      '<section class="utility-page archive-page">' +
        '<header class="utility-head"><div><span>SIMULATION ARCHIVE</span><h1>推演档案</h1>' +
        '<p>这里保存的不是预测，是你曾经提前看见的风险。</p></div>' +
        '<button class="button primary" data-action="new-run">＋ 新建推演</button></header>' +
        (history.length
          ? '<div class="archive-path"><div class="archive-line"></div>' +
            history.map(function (run, index) {
              return '<button class="archive-entry" data-archive="' + esc(run.id) + '">' +
                '<span class="archive-number">' + String(index + 1).padStart(2, '0') + '</span>' +
                '<span class="archive-icon tone-' + esc(run.hazardId) + '">' +
                  Sprites.svg(run.hazardIcon || 'grave', 5) + '</span>' +
                '<span class="archive-copy"><small>' + esc(run.day) + ' · ' + esc(run.stage) + '</small>' +
                  '<b>' + esc(run.name) + '</b><em>原结局 M' + run.deathMonth + ' · ' + esc(run.cause) + '</em></span>' +
                '<span class="archive-outcome"><small>改写后</small><b>+' + run.monthsAdded + ' 月</b>' +
                  '<em>M' + run.newHorizon + ' 仍在运行</em></span>' +
                '<span class="archive-arrow">→</span></button>';
            }).join('') + '</div>'
          : '<div class="utility-empty"><div>' + Sprites.svg('grave', 8) + '</div>' +
            '<h2>档案还是空的。</h2><p>完成一次“死亡—盲区—回溯”的完整推演，结局会自动保存在这里。</p>' +
            '<button class="button primary" data-action="new-run">开始第一次推演 →</button></div>') +
      '</section>';

    $$('[data-action=new-run]').forEach(function (button) {
      button.onclick = function () {
        ctx.state.answers = { memory: '', venture: '', reality: '' };
        ctx.state.intakeIndex = 0;
        ctx.state.result = null;
        ctx.state.future = null;
        ctx.state.rewindPoint = null;
        ctx.state.revealedUnknowns = [];
        ctx.save();
        ctx.go('story');
      };
    });

    $$('[data-archive]').forEach(function (button) {
      button.onclick = function () {
        var run = history.filter(function (item) { return item.id === button.dataset.archive; })[0];
        if (!run) return;
        ctx.modal(run.name + ' · 推演摘要',
          '<div class="archive-modal">' +
            '<div class="archive-modal-icon">' + Sprites.svg(run.hazardIcon || 'grave', 7) + '</div>' +
            '<div><span>ORIGINAL ENDING</span><h3>第 ' + run.deathMonth + ' 个月停止运营</h3>' +
              '<p>首要死因：' + esc(run.cause) + '</p></div>' +
            '<div class="archive-modal-new"><span>REWRITTEN FUTURE</span><h3>+' + run.monthsAdded + ' 个月</h3>' +
              '<p>' + esc(run.pointTitle) + '</p></div>' +
            '<div class="next-quest"><small>NEXT QUEST</small><b>' + esc(run.nextQuest) + '</b></div>' +
          '</div>');
      };
    });
  }

  function codex(ctx) {
    var unlocked = {};
    (ctx.state.history || []).forEach(function (run) { unlocked[run.hazardId] = true; });
    if (ctx.state.result) {
      ctx.state.result.hazards.forEach(function (hazard) { unlocked[hazard.id] = true; });
    }
    var unlockedCount = Object.keys(unlocked).length;

    screen().innerHTML =
      '<section class="utility-page codex-page">' +
        '<header class="utility-head"><div><span>RISK FIELD GUIDE</span><h1>风险图鉴</h1>' +
        '<p>见过一种风险，才更容易在现实里认出它。</p></div>' +
        '<div class="codex-score"><b>' + unlockedCount + ' / 4</b><small>已发现</small></div></header>' +
        '<div class="codex-map">' +
          RISK_CATALOG.map(function (risk, index) {
            var isOpen = !!unlocked[risk.id];
            return '<button class="codex-risk risk-' + index + (isOpen ? ' is-unlocked' : ' is-locked') +
              '" data-risk="' + risk.id + '">' +
              '<span class="risk-sprite">' + (isOpen ? Sprites.svg(risk.icon, 8) : Sprites.svg('block', 8)) + '</span>' +
              '<small>' + (isOpen ? 'DISCOVERED' : 'LOCKED') + '</small>' +
              '<b>' + (isOpen ? esc(risk.label) : '未知风险') + '</b>' +
              '<p>' + (isOpen ? esc(risk.signal) : '完成推演后解锁') + '</p>' +
            '</button>';
          }).join('') +
          '<div class="codex-guide"><img src="assets/media/xiaopu-guide-v2.png" alt="momo像素向导">' +
            '<div><span>图鉴不是知识库</span><b>它只记录你真正遇见过的风险。</b></div></div>' +
        '</div>' +
      '</section>';

    $$('[data-risk]').forEach(function (button) {
      button.onclick = function () {
        var risk = RISK_CATALOG.filter(function (item) { return item.id === button.dataset.risk; })[0];
        if (!unlocked[risk.id]) {
          ctx.toast('先完成一次包含该风险的推演');
          SFX.warn();
          return;
        }
        ctx.modal(risk.label,
          '<div class="risk-modal">' +
            '<div class="risk-modal-scene">' + Sprites.svg(risk.icon, 10) + '</div>' +
            '<span>最早信号</span><h3>' + esc(risk.signal) + '</h3>' +
            '<div class="mini-quest"><b>现实测试</b><span>' + esc(risk.test) + '</span></div>' +
          '</div>');
      };
    });
  }

  function pet(ctx) {
    var history = ctx.state.history || [];
    var level = 1 + history.length * 2;
    var riskCount = {};
    history.forEach(function (run) { riskCount[run.hazardId] = true; });
    var currentQuest = ctx.state.future
      ? ctx.state.future.nextQuest
      : '完成一次推演，我会根据你的真实输入给出第一个任务。';

    screen().innerHTML =
      '<section class="utility-page pet-page">' +
        '<div class="pet-stage">' +
          '<div class="pet-sky"><i></i><i></i><i></i></div>' +
          '<img src="assets/media/xiaopu-guide-v2.png" alt="momo像素向导">' +
          '<span class="pet-level">LV.' + level + '</span>' +
          '<div class="pet-shadow"></div>' +
        '</div>' +
        '<div class="pet-console">' +
          '<span class="pet-kicker">YOUR PRE-MORTEM COMPANION</span>' +
          '<h1>momo</h1><p>它不负责安慰你成功，只负责让你更早看见坏消息。</p>' +
          '<div class="pet-stats">' +
            '<span>' + Sprites.svg('coin', 3) + '<b>' + ctx.state.coins + '</b><small>证据币</small></span>' +
            '<span>' + Sprites.svg('fire', 3) + '<b>' + Math.max(1, ctx.state.streak || 0) + '</b><small>连续推演</small></span>' +
            '<span>' + Sprites.svg('block', 3) + '<b>' + Object.keys(riskCount).length + '</b><small>风险发现</small></span>' +
          '</div>' +
          '<div class="pet-tone"><small>说话方式</small>' +
            '<div><button data-tone="gentle" class="' + (ctx.state.petTone === 'gentle' ? 'is-active' : '') + '">温和</button>' +
            '<button data-tone="direct" class="' + (ctx.state.petTone === 'direct' ? 'is-active' : '') + '">直接</button>' +
            '<button data-tone="cold" class="' + (ctx.state.petTone === 'cold' ? 'is-active' : '') + '">冷酷</button></div></div>' +
          '<div class="pet-mission"><span>NEXT QUEST · 7 DAYS</span><b>' + esc(currentQuest) + '</b>' +
            '<button class="button primary" data-action="pet-run">回到推演 →</button></div>' +
        '</div>' +
      '</section>';

    $$('[data-tone]').forEach(function (button) {
      button.onclick = function () {
        if (ctx.setPetTone) ctx.setPetTone(button.dataset.tone);
        else ctx.state.petTone = button.dataset.tone;
        ctx.save();
        SFX.blip();
        pet(ctx);
        if (window.App && window.App.ctx && UI.renderChrome) UI.renderChrome(window.App.ctx);
      };
    });
    $('[data-action=pet-run]').onclick = function () {
      ctx.go(ctx.resumeTarget());
    };
  }

  function renderChrome(ctx) {
    var runActive = ['story', 'sim', 'funeral', 'unknowns', 'rewind', 'future'].indexOf(ctx.state.screen) >= 0;
    $$('[data-view]').forEach(function (button) {
      var active = button.dataset.view === ctx.state.screen || (button.dataset.view === 'run' && runActive);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });

    var copy = '我负责先把坏结局找出来。';
    if (ctx.state.screen === 'funeral') copy = '讣告不是判决，是一张风险地图。';
    if (ctx.state.screen === 'unknowns') copy = '还剩 ' + Math.max(0, 3 - ctx.state.revealedUnknowns.length) + ' 个盲区没打开。';
    if (ctx.state.screen === 'rewind') copy = '回溯币只有一枚，投给证据。';
    if (ctx.state.screen === 'future') copy = '新未来不是保证，下一步才是。';
    var railCopy = document.getElementById('rail-buddy-copy');
    if (railCopy) railCopy.textContent = copy;

    var root = document.getElementById('buddy-rail');
    if (!root) return;
    var completed = ctx.state.future ? 5
      : ctx.state.rewindPoint ? 4
      : ctx.state.revealedUnknowns.length ? 3
      : ctx.state.result ? 2
      : (ctx.state.answers.memory ? 1 : 0);
    var advice = ctx.state.future
      ? ctx.state.future.nextQuest
      : ctx.state.result
        ? ctx.state.result.hazards[0].short
        : '说出真实经历，不用准备商业计划书。';
    var toneLabel = ctx.state.petTone === 'gentle' ? '温和模式' : ctx.state.petTone === 'cold' ? '冷酷模式' : '直接模式';

    root.innerHTML =
      '<div class="buddy-profile">' +
        '<div class="buddy-avatar"><img src="assets/media/xiaopu-guide-v2.png" alt="momo"></div>' +
        '<div><small>PRE-MORTEM GUIDE</small><b>momo</b><span>' + toneLabel + '</span></div>' +
      '</div>' +
      '<div class="buddy-level"><div><span>推演进度</span><b>' + completed + ' / 5</b></div>' +
        '<div class="buddy-meter"><i style="width:' + (completed / 5 * 100) + '%"></i></div></div>' +
      '<div class="buddy-numbers">' +
        '<span>' + Sprites.svg('coin', 3) + '<b>' + ctx.state.coins + '</b><small>证据币</small></span>' +
        '<span>' + Sprites.svg('fire', 3) + '<b>' + Math.max(1, ctx.state.streak || 0) + '</b><small>连续推演</small></span>' +
      '</div>' +
      '<div class="buddy-advice"><span>momo现在看到</span><p>' + esc(advice) + '</p></div>' +
      '<button class="button primary wide" id="buddy-resume">' + (completed ? '继续推演 →' : '开始推演 →') + '</button>' +
      '<div class="buddy-privacy"><i></i><span>输入只保存在当前浏览器</span></div>';

    var resume = document.getElementById('buddy-resume');
    if (resume) resume.onclick = function () { ctx.go(ctx.resumeTarget()); };
  }

  function shareCard(ctx) {
    var result = ctx.state.result;
    var next = ctx.state.future;
    var canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    var context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#fffaf0';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (var x = 0; x < canvas.width; x += 18) {
      for (var y = 0; y < canvas.height; y += 18) {
        if ((x / 18 + y / 18) % 2 === 0) {
          context.fillStyle = '#f7f0e2';
          context.fillRect(x, y, 18, 18);
        }
      }
    }
    context.fillStyle = '#ffd43b';
    context.fillRect(0, 0, canvas.width, 24);
    context.fillStyle = '#191622';
    context.fillRect(54, 58, 12, 12);
    context.fillRect(72, 58, 12, 12);
    context.fillRect(54, 76, 30, 12);
    context.font = '900 30px ui-monospace, "PingFang SC", monospace';
    context.fillText('明日讣告', 104, 86);
    context.fillStyle = '#766f69';
    context.font = '600 18px ui-monospace, "PingFang SC", monospace';
    context.fillText('PROJECT PRE-MORTEM · #' + String(Date.now()).slice(-6), 104, 119);

    context.fillStyle = '#191622';
    context.fillRect(720, 52, 108, 108);
    context.fillStyle = '#fffaf0';
    context.fillRect(732, 64, 84, 84);
    context.fillStyle = '#ffd43b';
    context.fillRect(750, 82, 48, 48);
    context.fillStyle = '#191622';
    context.fillRect(756, 94, 9, 12);
    context.fillRect(783, 94, 9, 12);
    context.fillRect(765, 115, 18, 7);

    context.fillStyle = '#191622';
    context.fillRect(48, 174, 804, 464);
    context.fillStyle = '#fff1ed';
    context.fillRect(56, 182, 788, 448);
    context.strokeStyle = '#ff745f';
    context.lineWidth = 4;
    context.strokeRect(68, 194, 764, 424);

    context.fillStyle = '#ff745f';
    context.fillRect(88, 218, 206, 44);
    context.fillStyle = '#191622';
    context.font = '900 19px ui-monospace, "PingFang SC", monospace';
    context.fillText('ORIGINAL ENDING', 106, 247);
    context.font = '900 44px ui-monospace, "PingFang SC", monospace';
    wrapCanvasText(context, result.obituary.headline, 90, 332, 680, 57);
    context.fillStyle = '#625b58';
    context.font = '700 21px ui-monospace, "PingFang SC", monospace';
    wrapCanvasText(context, '首要死因：' + result.obituary.cause, 90, 508, 680, 30);

    context.fillStyle = '#191622';
    context.fillRect(48, 668, 804, 326);
    context.fillStyle = '#dff4d8';
    context.fillRect(56, 676, 788, 310);
    context.fillStyle = '#58b368';
    context.fillRect(88, 704, 284, 44);
    context.fillStyle = '#191622';
    context.font = '900 19px ui-monospace, "PingFang SC", monospace';
    context.fillText(next.status === 'surviving' ? 'OBITUARY WITHDRAWN' : 'OBITUARY DELAYED', 106, 733);
    context.font = '900 43px ui-monospace, "PingFang SC", monospace';
    wrapCanvasText(context, next.headline, 88, 815, 680, 56);
    context.fillStyle = '#237844';
    context.font = '900 26px ui-monospace, "PingFang SC", monospace';
    context.fillText('+' + next.monthsAdded + ' 个月验证窗口', 88, 947);

    context.fillStyle = '#7b57d1';
    context.fillRect(48, 1024, 804, 128);
    context.fillStyle = '#fffaf0';
    context.font = '900 18px ui-monospace, "PingFang SC", monospace';
    context.fillText('NEXT QUEST · 7 DAYS', 78, 1064);
    context.font = '700 20px ui-monospace, "PingFang SC", monospace';
    wrapCanvasText(context, next.nextQuest, 78, 1104, 720, 28);

    var url = canvas.toDataURL('image/png');
    ctx.modal('你的新未来', '<img class="share-image" src="' + url + '" alt="明日讣告新未来分享卡">' +
      '<div class="modal-actions"><a class="button primary" download="mingri-new-future.png" href="' + url + '">下载 PNG</a>' +
      '<button class="button ghost" id="share-close">留在这里</button></div>');
    $('#share-close').onclick = ctx.closeModal;
    SFX.success();
  }

  function wrapCanvasText(context, text, x, y, maxWidth, lineHeight) {
    var line = '';
    var cursorY = y;
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (context.measureText(test).width > maxWidth && line) {
        context.fillText(line, x, cursorY);
        line = text[i];
        cursorY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) context.fillText(line, x, cursorY);
  }

  return {
    esc: esc,
    renderChrome: renderChrome,
    screens: {
      title: title,
      story: story,
      sim: sim,
      funeral: funeral,
      unknowns: unknowns,
      rewind: rewind,
      future: future,
      archive: archive,
      codex: codex,
      pet: pet
    }
  };
})();
