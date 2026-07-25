window.Engine = (function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hash(text) {
    var h = 2166136261;
    var source = String(text || '');
    for (var i = 0; i < source.length; i++) {
      h ^= source.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Math.abs(h >>> 0);
  }

  function short(text, length) {
    var source = String(text || '').replace(/\s+/g, '');
    return source.length > length ? source.slice(0, length) + '…' : source;
  }

  function splitSentences(text) {
    return String(text || '')
      .split(/[。！？!?\n；;]/)
      .map(function (item) { return item.trim(); })
      .filter(function (item) { return item.length > 3; });
  }

  function amountToYuan(number, unit) {
    var value = Number(number) || 0;
    if (unit === '万') value *= 10000;
    if (unit === '千') value *= 1000;
    return Math.round(value);
  }

  function findMoney(text, leadWords) {
    var source = String(text || '');
    var lead = new RegExp('(?:' + leadWords + ')[^\\d]{0,10}(\\d+(?:\\.\\d+)?)\\s*(万|千|元)');
    var match = source.match(lead);
    return match ? amountToYuan(match[1], match[2]) : 0;
  }

  function formatMoney(value) {
    if (value >= 10000) {
      var tenThousands = Math.round(value / 1000) / 10;
      return tenThousands + ' 万';
    }
    if (value >= 1000) return Math.round(value / 100) / 10 + ' 千';
    return value + ' 元';
  }

  function extractName(text) {
    var quoted = String(text || '').match(/[「“"']([^」”"']{2,16})[」”"']/);
    if (quoted) return quoted[1];
    var named = String(text || '').match(/(?:项目|产品|品牌)?\s*(?:叫|名为)\s*([\u4e00-\u9fa5A-Za-z0-9·_-]{2,16})/);
    return named ? named[1] : '未命名项目';
  }

  function extractStage(text) {
    var source = String(text || '');
    if (/收入|营收|正式付费|付费客户/.test(source) && !/没有人.{0,4}付费|还没.{0,4}付费/.test(source)) {
      return { id: 'revenue', label: '早期收入', code: 'LIVE' };
    }
    if (/试用|测试|订单|内测|验证/.test(source)) return { id: 'pilot', label: '市场验证', code: 'PILOT' };
    if (/原型|demo|Demo|MVP|能跑/.test(source)) return { id: 'prototype', label: '可用原型', code: 'MVP' };
    return { id: 'idea', label: '想法阶段', code: 'IDEA' };
  }

  function extractCount(text, nouns) {
    var match = String(text || '').match(new RegExp('(\\d+)\\s*(?:个|位|家|笔)?(?:' + nouns + ')'));
    return match ? Number(match[1]) : 0;
  }

  function buildMemoryNodes(memoryText) {
    var definitions = [
      { pattern: /小学|小时候|从小/, label: '童年', icon: 'seed' },
      { pattern: /初中|高中|中学/, label: '学生期', icon: 'book' },
      { pattern: /大学|研究生|校园/, label: '校园', icon: 'book' },
      { pattern: /毕业|工作|公司|职场/, label: '职场', icon: 'tower' },
      { pattern: /创业|项目|产品|第一次卖/, label: '项目', icon: 'shop' }
    ];
    var sentences = splitSentences(memoryText);
    var nodes = [];
    definitions.forEach(function (definition) {
      var sentence = sentences.filter(function (item) { return definition.pattern.test(item); })[0];
      if (!sentence) return;
      nodes.push({
        label: definition.label,
        short: short(sentence, 18),
        icon: definition.icon
      });
    });
    if (!nodes.length) {
      sentences.slice(0, 4).forEach(function (sentence, index) {
        nodes.push({
          label: '经历 ' + (index + 1),
          short: short(sentence, 18),
          icon: index % 2 ? 'book' : 'seed'
        });
      });
    }
    return nodes.slice(0, 5);
  }

  function extractStrengths(text) {
    var source = String(text || '');
    var definitions = [
      [/访谈|客户|用户/, '理解用户'],
      [/设计|品牌|视觉/, '表达与设计'],
      [/开发|代码|工程|产品/, '产品执行'],
      [/销售|卖|订单|增长/, '商业推进'],
      [/餐饮|门店|供应链|进货/, '场景经验'],
      [/组织|社团|负责|带领/, '组织协作']
    ];
    var out = [];
    definitions.forEach(function (item) {
      if (item[0].test(source) && out.indexOf(item[1]) < 0) out.push(item[1]);
    });
    if (!out.length) out.push('持续行动');
    return out.slice(0, 3);
  }

  function buildProfile(answers) {
    var reality = answers.reality || '';
    var venture = answers.venture || '';
    var stage = extractStage(reality);
    var cash = findMoney(reality, '手里|资金|预算|现金|投入|有');
    var burn = findMoney(reality, '每月|月均|月烧|固定成本|成本约|花');
    if (!cash) cash = stage.id === 'idea' ? 30000 : 80000;
    if (!burn) burn = stage.id === 'idea' ? 8000 : 15000;

    var users = extractCount(reality, '团队|用户|试用者|客户|订单');
    var paid = 0;
    if (!/没有人.{0,4}付费|还没.{0,4}付费|尚未.{0,4}付费/.test(reality)) {
      paid = extractCount(reality, '付费客户|付费用户|正式客户');
      if (!paid && /收入|营收|正式付费/.test(reality)) paid = 1;
    }

    return {
      memory: {
        nodes: buildMemoryNodes(answers.memory),
        strengths: extractStrengths(answers.memory),
        raw: answers.memory
      },
      venture: {
        name: extractName(venture),
        stage: stage,
        cash: cash,
        burn: burn,
        runway: clamp(Math.round(cash / Math.max(1, burn) * 10) / 10, 0.5, 36),
        users: users,
        paid: paid,
        model: /订阅/.test(venture) ? '订阅' : /佣金/.test(venture) ? '佣金' : /服务|咨询/.test(venture) ? '服务费' : /广告/.test(venture) ? '广告' : '待验证',
        customer: short(splitSentences(venture)[0] || venture, 26),
        raw: venture
      },
      realityRaw: reality
    };
  }

  function buildHazards(profile) {
    var venture = profile.venture;
    var source = venture.raw + ' ' + profile.realityRaw;
    var demand = 46;
    if (venture.users === 0) demand += 22;
    if (venture.paid === 0) demand += 18;
    if (/复购|持续使用|正式付费/.test(source)) demand -= 18;

    var channel = 58;
    if (/渠道|社群|销售|园区|企业|微信|小红书|抖音|转介绍/.test(source)) channel -= 16;
    if (/大部分|一次|单一/.test(source)) channel += 10;

    var cash = 72 - venture.runway * 8;
    if (/兼职|副业/.test(source)) cash -= 8;

    var founder = 42;
    if (/一个人|我自己|1个人/.test(source)) founder += 25;
    if (/2个人|两个人|兼职/.test(source)) founder += 12;
    if (profile.memory.strengths.indexOf('场景经验') >= 0) founder -= 8;

    return [
      {
        id: 'demand',
        label: '伪需求沼泽',
        short: '有人试，不等于有人买',
        damage: clamp(Math.round(demand), 18, 94),
        icon: 'swamp',
        color: 'lime'
      },
      {
        id: 'channel',
        label: '获客断桥',
        short: '产品做完，路却没修通',
        damage: clamp(Math.round(channel), 18, 94),
        icon: 'bridge',
        color: 'cyan'
      },
      {
        id: 'cash',
        label: '现金深坑',
        short: '验证速度跑不过消耗',
        damage: clamp(Math.round(cash), 18, 94),
        icon: 'pit',
        color: 'amber'
      },
      {
        id: 'founder',
        label: '创始人火山',
        short: '所有关键动作都压在一个人身上',
        damage: clamp(Math.round(founder), 18, 94),
        icon: 'fire',
        color: 'red'
      }
    ].sort(function (a, b) { return b.damage - a.damage; });
  }

  function buildUnknowns(profile, hazards) {
    var primary = hazards[0];
    var secondary = hazards[1];
    var venture = profile.venture;
    return [
      {
        id: 'payer',
        title: '谁会真的掏钱？',
        short: venture.paid ? '付款者与使用者可能不是同一个人' : '试用者还没有证明付款意愿',
        why: '这会直接改变需求风险。',
        action: '约 5 位目标客户，现场提出付费方案。',
        proof: '至少 1 次真实付款或明确拒绝理由。',
        hazard: 'demand',
        icon: 'coin'
      },
      {
        id: 'repeat',
        title: '渠道能重复吗？',
        short: '第一批用户可能来自人情或偶然事件',
        why: '不可重复的渠道无法形成增长。',
        action: '用同一话术触达 30 个陌生客户。',
        proof: '记录触达、回复、演示、成交四个数字。',
        hazard: 'channel',
        icon: 'bridge'
      },
      {
        id: 'speed',
        title: '你的验证速度够快吗？',
        short: '剩余 ' + venture.runway + ' 个月，但关键假设还没被证伪',
        why: '现金耗尽前能完成几轮验证，决定生死。',
        action: '把下一个版本缩成 7 天可以交付的实验。',
        proof: '明确一个指标和一个停止条件。',
        hazard: primary.id === 'cash' ? primary.id : secondary.id,
        icon: 'clock'
      }
    ];
  }

  function buildTurningPoints(profile, hazards, deathMonth) {
    var biggest = hazards[0];
    return [
      {
        id: 'sell-first',
        month: 1,
        title: '先卖，再继续做',
        move: '暂停新增功能，先拿到 3 次真实付款。',
        visual: '填平伪需求沼泽',
        icon: 'coin',
        riskReduction: biggest.id === 'demand' ? 28 : 20
      },
      {
        id: 'narrow-channel',
        month: Math.max(2, Math.round(deathMonth * 0.4)),
        title: '只守一条获客路',
        move: '砍掉泛人群，只服务一个最痛的细分场景。',
        visual: '修复获客断桥',
        icon: 'bridge',
        riskReduction: biggest.id === 'channel' ? 28 : 18
      },
      {
        id: 'cap-burn',
        month: Math.max(3, Math.round(deathMonth * 0.65)),
        title: '给消耗设上限',
        move: '把每月消耗压低 35%，用 7 天实验替代完整版本。',
        visual: '缩小现金深坑',
        icon: 'shield',
        riskReduction: biggest.id === 'cash' ? 30 : 16
      }
    ];
  }

  function buildTimeline(profile, hazards, deathMonth) {
    var h1 = hazards[0];
    var h2 = hazards[1];
    return [
      { month: 0, label: '开局', short: profile.venture.stage.label, icon: 'shop', kind: 'start', damage: 0 },
      { month: 1, label: '第一个信号', short: profile.venture.users ? profile.venture.users + ' 个早期样本' : '反馈主要来自熟人', icon: 'flag', kind: 'signal', damage: 8 },
      { month: Math.max(2, Math.round(deathMonth * 0.35)), label: h2.label, short: h2.short, icon: h2.icon, kind: h2.id, damage: h2.damage },
      { month: Math.max(3, Math.round(deathMonth * 0.65)), label: h1.label, short: h1.short, icon: h1.icon, kind: h1.id, damage: h1.damage, turning: true },
      { month: deathMonth, label: '停止运营', short: '现金、信心或时间先归零', icon: 'grave', kind: 'death', damage: 100 }
    ];
  }

  function simulate(state) {
    var answers = state.answers || {};
    var profile = buildProfile(answers);
    var hazards = buildHazards(profile);
    var averageRisk = hazards.reduce(function (sum, item) { return sum + item.damage; }, 0) / hazards.length;
    var evidenceBonus = profile.venture.users > 0 ? 1.5 : 0;
    if (profile.venture.paid > 0) evidenceBonus += 3;
    var jitter = (hash(answers.memory + answers.venture + answers.reality) % 3) - 1;
    var deathMonth = clamp(
      Math.round(3 + profile.venture.runway * 0.72 + evidenceBonus - averageRisk / 23 + jitter),
      3,
      18
    );
    var top = hazards[0];
    var vitals = {
      life: clamp(Math.round(100 - averageRisk * 0.72), 18, 78),
      evidence: clamp(18 + profile.venture.users * 2 + profile.venture.paid * 12, 12, 88),
      runway: clamp(Math.round(profile.venture.runway / 12 * 100), 8, 100),
      distribution: clamp(100 - hazards.filter(function (item) { return item.id === 'channel'; })[0].damage, 8, 88)
    };

    return {
      id: 'run-' + hash(JSON.stringify(answers)),
      profile: profile,
      hazards: hazards,
      vitals: vitals,
      deathMonth: deathMonth,
      timeline: buildTimeline(profile, hazards, deathMonth),
      unknowns: buildUnknowns(profile, hazards),
      turningPoints: buildTurningPoints(profile, hazards, deathMonth),
      obituary: {
        headline: '「' + profile.venture.name + '」于第 ' + deathMonth + ' 个月停止运营',
        cause: top.label,
        subhead: top.short,
        body: [
          '它不是突然死亡，而是在一次次“再做一点”中失去选择。',
          '最早的信号出现过，只是当时看起来不够致命。',
          '最终耗尽的不是想法，是继续验证的空间。'
        ],
        epitaph: '这里埋着一个做得太早、验证得太晚的好想法。'
      },
      meta: {
        mode: 'offline',
        confidence: profile.venture.users || profile.venture.paid ? '有早期证据' : '证据不足',
        source: '你的叙述 + 离线商业风险规则'
      }
    };
  }

  function rewrite(result, pointId) {
    var point = result.turningPoints.filter(function (item) { return item.id === pointId; })[0] || result.turningPoints[0];
    var monthsAdded = clamp(Math.round(point.riskReduction / 2 + result.profile.venture.runway * 0.35), 5, 16);
    var newHorizon = result.deathMonth + monthsAdded;
    var survives = newHorizon >= 18;
    var newVitals = {
      life: clamp(result.vitals.life + point.riskReduction, 0, 94),
      evidence: clamp(result.vitals.evidence + (point.id === 'sell-first' ? 28 : 14), 0, 96),
      runway: clamp(result.vitals.runway + (point.id === 'cap-burn' ? 30 : 10), 0, 100),
      distribution: clamp(result.vitals.distribution + (point.id === 'narrow-channel' ? 32 : 12), 0, 96)
    };
    return {
      point: point,
      monthsAdded: monthsAdded,
      newHorizon: newHorizon,
      status: survives ? 'surviving' : 'delayed',
      vitals: newVitals,
      headline: survives
        ? '第 18 个月，项目仍在运行'
        : '讣告被推迟到第 ' + newHorizon + ' 个月',
      subhead: survives
        ? '它还没有赢，但重新获得了选择。'
        : '它还会遇到危险，但不再死于同一个错误。',
      changed: [
        point.visual,
        '获得 ' + monthsAdded + ' 个月验证窗口',
        point.id === 'sell-first' ? '付款证据上升' : point.id === 'narrow-channel' ? '获客路径变清晰' : '现金跑道变长'
      ],
      nextQuest: point.move
    };
  }

  function fallback() {
    return simulate({ answers: DATA.PRESETS[0].answers });
  }

  return {
    buildProfile: buildProfile,
    simulate: simulate,
    rewrite: rewrite,
    fallback: fallback,
    formatMoney: formatMoney,
    clamp: clamp
  };
})();
