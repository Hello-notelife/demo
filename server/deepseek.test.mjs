import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeepSeekService } from './deepseek.mjs';

const CONFIG = {
  deepseekApiKey: 'test-key',
  deepseekBaseUrl: 'https://api.deepseek.com',
  fastModel: 'deepseek-v4-flash',
  deepModel: 'deepseek-v4-pro',
  tavilyApiKey: '',
  tavilyBaseUrl: 'https://api.tavily.com',
  requestTimeoutMs: 5000
};

const ANSWERS = {
  memory: '我在大学做过校园跑腿，后来在餐饮店打工两年。',
  venture: '想做一个面向园区白领的健康简餐订阅，叫「轻食号」。',
  reality: '手里有 8 万，每月成本 1.5 万，团队 2 个人，还没有人付费。'
};

const SIMULATION = {
  profile: {
    ventureName: '轻食号',
    stageLabel: '想法阶段',
    customer: '园区白领',
    strengths: ['场景经验', '产品执行']
  },
  hazards: [
    { id: 'demand', label: '伪需求沼泽', short: '有人试不等于有人买', damage: 82, reason: '零付费样本', evidence: '还没有人付费' },
    { id: 'channel', label: '罗列利弊', short: '进园区的路没修通', damage: 68, reason: '缺少可重复渠道', evidence: '' },
    { id: 'cash', label: '现金深坑', short: '5.3 个月跑道', damage: 61, reason: '8 万 / 1.5 万每月', evidence: '' },
    { id: 'founder', label: '创始人火山', short: '两个人扛全部动作', damage: 44, reason: '', evidence: '' }
  ],
  vitals: { life: 38, evidence: 20, runway: 44, distribution: 32 },
  deathMonth: 9,
  scenarios: [
    { id: 'worst', label: '最坏', deathMonth: 5, cause: '伪需求沼泽', trigger: '如果前两个月还是零付费', short: '最致命的假设最先塌。', probability: 40 },
    { id: 'base', label: '基准', deathMonth: 9, cause: '伪需求沼泽', trigger: '如果按现在的节奏继续', short: '风险逐个兑现，现金见底。', probability: 45 },
    { id: 'best', label: '最好', deathMonth: 17, cause: '创始人火山', trigger: '如果 5 个月内拿到可重复付费证据', short: '主要死因被推后。', probability: 15 }
  ],
  timeline: [
    { month: 0, label: '开局', short: '想法阶段起步', kind: 'start', damage: 0 },
    { month: 1, label: '第一个信号', short: '反馈来自熟人', kind: 'signal', damage: 10 },
    { month: 3, label: '罗列利弊', short: '进不了第二个园区', kind: 'channel', damage: 68 },
    { month: 6, label: '伪需求沼泽', short: '试吃的人不续订', kind: 'demand', damage: 82 },
    { month: 9, label: '停止运营', short: '现金先归零', kind: 'death', damage: 100 }
  ],
  unknowns: [
    { id: 'payer', title: '谁会真的掏钱？', short: '公司买单还是个人买单未知', why: '决定定价与渠道', action: '约 5 位行政负责人报价', proof: '1 次真实付款或明确拒绝', hazard: 'demand' },
    { id: 'repeat', title: '渠道能重复吗？', short: '第一个园区可能靠人情', why: '不可重复无法增长', action: '用同一话术触达 30 家企业', proof: '记录触达到成交四个数字', hazard: 'channel' },
    { id: 'speed', title: '验证速度够快吗？', short: '跑道只剩 5 个月', why: '现金耗尽前能做几轮验证', action: '把下一版缩成 7 天实验', proof: '一个指标和一个停止条件', hazard: 'cash' }
  ],
  turningPoints: [
    { id: 'sell-first', month: 1, title: '先卖，再继续做', move: '暂停出餐优化，先拿 3 次真实付款', visual: '填平伪需求沼泽', riskReduction: 28 },
    { id: 'narrow-channel', month: 4, title: '只守一条获客路', move: '只服务一个园区的一栋楼', visual: '修复罗列利弊', riskReduction: 22 },
    { id: 'cap-burn', month: 6, title: '给消耗设上限', move: '把每月成本压到 9 千', visual: '缩小现金深坑', riskReduction: 20 }
  ],
  obituary: {
    headline: '「轻食号」于第 9 个月停止运营',
    cause: '伪需求沼泽',
    subhead: '有人试吃，但没有人续订',
    body: ['它不是突然死亡，而是在一次次加菜单中失去选择。', '最早的信号出现过，只是当时看起来不够致命。', '最终耗尽的不是想法，是继续验证的空间。'],
    epitaph: '这里埋着一个做得太早、验证得太晚的好想法。'
  },
  meta: { confidence: '证据不足', assumptions: ['按每月成本 1.5 万推算跑道'] }
};

const REWRITE = {
  monthsAdded: 8,
  newHorizon: 17,
  status: 'delayed',
  vitals: { life: 62, evidence: 52, runway: 54, distribution: 44 },
  headline: '讣告被推迟到第 17 个月',
  subhead: '它还会遇到危险，但不再死于同一个错误。',
  changed: ['填平伪需求沼泽', '获得 8 个月验证窗口', '付款证据上升'],
  nextQuest: '7 天内向 5 位行政负责人报价，拿到 1 次真实付款或明确拒绝理由。'
};

function stubFetch(payload) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          model: JSON.parse(options.body).model,
          choices: [{ message: { content: JSON.stringify(payload) } }],
          usage: { total_tokens: 1234 }
        };
      }
    };
  };
  return { impl, calls };
}

test('simulate maps a DeepSeek response onto the simulation contract', async () => {
  const { impl, calls } = stubFetch(SIMULATION);
  const complete = createDeepSeekService(CONFIG, impl);

  const output = await complete({ kind: 'simulate', mode: 'fast', payload: { answers: ANSWERS } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(calls[0].body.model, 'deepseek-v4-flash');
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });

  assert.equal(output.provider, 'deepseek');
  assert.equal(output.result.profile.ventureName, '轻食号');
  assert.equal(output.result.deathMonth, 9);
  assert.equal(output.result.hazards.length, 4);
  // Hazards must arrive sorted by damage so the UI can trust hazards[0].
  assert.equal(output.result.hazards[0].id, 'demand');
  assert.equal(output.result.timeline.length, 5);
  assert.equal(output.result.unknowns.length, 3);
  assert.equal(output.result.turningPoints.length, 3);
  assert.equal(output.result.obituary.cause, '伪需求沼泽');
});

test('scenarios come back ordered worst/base/best with probabilities summing to 100', async () => {
  const { impl } = stubFetch(SIMULATION);
  const complete = createDeepSeekService(CONFIG, impl);

  const output = await complete({ kind: 'simulate', mode: 'fast', payload: { answers: ANSWERS } });
  const scenarios = output.result.scenarios;

  assert.deepEqual(scenarios.map((item) => item.id), ['worst', 'base', 'best']);
  assert.equal(scenarios.reduce((sum, item) => sum + item.probability, 0), 100);
  // The comparison is meaningless unless the three horizons stay monotonic.
  assert.ok(scenarios[0].deathMonth <= scenarios[1].deathMonth);
  assert.ok(scenarios[1].deathMonth <= scenarios[2].deathMonth);
  assert.equal(scenarios[2].trigger, '如果 5 个月内拿到可重复付费证据');
});

test('a worst case that outlives the base case is clamped back into order', async () => {
  const scrambled = {
    ...SIMULATION,
    scenarios: [
      { id: 'worst', label: '最坏', deathMonth: 30, cause: '伪需求沼泽', trigger: 'x 条件成立', short: '最坏线。', probability: 10 },
      { id: 'base', label: '基准', deathMonth: 9, cause: '伪需求沼泽', trigger: 'y 条件成立', short: '基准线。', probability: 10 },
      { id: 'best', label: '最好', deathMonth: 12, cause: '创始人火山', trigger: 'z 条件成立', short: '最好线。', probability: 10 }
    ]
  };
  const { impl } = stubFetch(scrambled);
  const complete = createDeepSeekService(CONFIG, impl);

  const scenarios = (await complete({
    kind: 'simulate', mode: 'fast', payload: { answers: ANSWERS }
  })).result.scenarios;

  assert.ok(scenarios[0].deathMonth <= scenarios[1].deathMonth);
  assert.ok(scenarios[1].deathMonth <= scenarios[2].deathMonth);
  assert.equal(scenarios.reduce((sum, item) => sum + item.probability, 0), 100);
});

test('a missing scenario block is rejected', async () => {
  const { scenarios, ...withoutScenarios } = SIMULATION;
  const { impl } = stubFetch(withoutScenarios);
  const complete = createDeepSeekService(CONFIG, impl);

  await assert.rejects(() => complete({
    kind: 'simulate', mode: 'fast', payload: { answers: ANSWERS }
  }));
});

test('deep mode selects the pro model', async () => {
  const { impl, calls } = stubFetch(SIMULATION);
  const complete = createDeepSeekService(CONFIG, impl);

  await complete({ kind: 'simulate', mode: 'deep', payload: { answers: ANSWERS } });

  assert.equal(calls[0].body.model, 'deepseek-v4-pro');
});

test('simulate tolerates a fenced JSON code block', async () => {
  const impl = async (url, options) => ({
    ok: true,
    status: 200,
    async json() {
      return {
        model: JSON.parse(options.body).model,
        choices: [{ message: { content: '```json\n' + JSON.stringify(SIMULATION) + '\n```' } }]
      };
    }
  });
  const complete = createDeepSeekService(CONFIG, impl);

  const output = await complete({ kind: 'simulate', mode: 'fast', payload: { answers: ANSWERS } });

  assert.equal(output.result.profile.ventureName, '轻食号');
});

test('rewrite maps a DeepSeek response onto the rewrite contract', async () => {
  const { impl, calls } = stubFetch(REWRITE);
  const complete = createDeepSeekService(CONFIG, impl);

  const output = await complete({
    kind: 'rewrite',
    mode: 'deep',
    payload: { runId: 'run-1', answers: ANSWERS, selectedPoint: SIMULATION.turningPoints[0], original: {} }
  });

  assert.equal(calls[0].body.model, 'deepseek-v4-pro');
  assert.equal(output.result.monthsAdded, 8);
  assert.equal(output.result.newHorizon, 17);
  assert.equal(output.result.status, 'delayed');
  assert.equal(output.result.changed.length, 3);
});

test('a missing API key fails as a 503 instead of calling DeepSeek', async () => {
  let called = false;
  const complete = createDeepSeekService({ ...CONFIG, deepseekApiKey: '' }, async () => {
    called = true;
  });

  await assert.rejects(
    () => complete({ kind: 'simulate', mode: 'fast', payload: { answers: ANSWERS } }),
    (error) => error.status === 503 && error.code === 'provider_not_configured'
  );
  assert.equal(called, false);
});

test('a malformed model response is retried once before failing', async () => {
  let attempts = 0;
  const impl = async (url, options) => {
    attempts += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          model: JSON.parse(options.body).model,
          choices: [{ message: { content: attempts === 1 ? 'not json at all' : JSON.stringify(SIMULATION) } }]
        };
      }
    };
  };
  const complete = createDeepSeekService(CONFIG, impl);

  const output = await complete({ kind: 'simulate', mode: 'fast', payload: { answers: ANSWERS } });

  assert.equal(attempts, 2);
  assert.equal(output.result.profile.ventureName, '轻食号');
});
