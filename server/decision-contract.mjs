// Domain contract for the six-step decision loop:
// 提问 → 拆解 → 比较 → 试验 → 选择 → 回访
//
// The model is untrusted output. Everything below either normalizes into the
// shape the UI can render, or throws — the UI never receives a partial decision.

const ARCHETYPES = {
  opportunity: { label: '机会—风险型', core: '机会值不值得承担风险？' },
  relation: { label: '关系—价值型', core: '谁的价值与责任被忽略？' },
  commitment: { label: '承诺—锁定型', core: '承诺的退出成本是什么？' }
};
const ARCHETYPE_IDS = Object.keys(ARCHETYPES);
const PATH_IDS = ['keep', 'shift', 'leave'];
const ROUTES = ['fact', 'value', 'high_risk'];
const CONFIDENCE = ['high', 'medium', 'low'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, maxLength = 240) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function requireText(value, field, maxLength) {
  const text = cleanText(value, maxLength);
  if (!text) throw new Error(`Missing required field: ${field}`);
  return text;
}

function list(value, mapper, field, min, max) {
  if (!Array.isArray(value)) throw new Error(`Missing required field: ${field}`);
  const items = value.map(mapper).filter(Boolean).slice(0, max);
  if (items.length < min) {
    throw new Error(`${field} needs at least ${min} usable entries`);
  }
  return items;
}

function normalizeFrame(value) {
  if (!isObject(value)) throw new Error('Missing required field: frame');
  const archetype = ARCHETYPE_IDS.includes(value.archetype) ? value.archetype : 'opportunity';
  return {
    archetype,
    archetypeLabel: ARCHETYPES[archetype].label,
    coreQuestion: cleanText(value.coreQuestion, 60) || ARCHETYPES[archetype].core,
    // The restated question is the product's core promise: turn a vague worry
    // into something that can actually be tested.
    original: requireText(value.original, 'frame.original', 120),
    restated: requireText(value.restated, 'frame.restated', 120),
    stake: requireText(value.stake, 'frame.stake', 100),
    reversibility: cleanNumber(value.reversibility, 0, 100, 50),
    horizon: requireText(value.horizon, 'frame.horizon', 40)
  };
}

function normalizeBreakdown(value) {
  if (!isObject(value)) throw new Error('Missing required field: breakdown');
  return {
    facts: list(value.facts, (item) => {
      if (!isObject(item)) return null;
      const text = cleanText(item.text, 120);
      if (!text) return null;
      return {
        text,
        basis: cleanText(item.basis, 100),
        confidence: CONFIDENCE.includes(item.confidence) ? item.confidence : 'medium'
      };
    }, 'breakdown.facts', 2, 5),
    assumptions: list(value.assumptions, (item) => {
      if (!isObject(item)) return null;
      const text = cleanText(item.text, 120);
      if (!text) return null;
      return {
        text,
        testable: cleanText(item.testable, 120),
        risk: cleanNumber(item.risk, 0, 100, 50)
      };
    }, 'breakdown.assumptions', 2, 5),
    values: list(value.values, (item) => {
      if (!isObject(item)) return null;
      const text = cleanText(item.text, 120);
      if (!text) return null;
      return {
        text,
        tension: cleanText(item.tension, 120),
        // Whose stake this is — the deck's "谁的价值与责任被忽略".
        holder: cleanText(item.holder, 40) || '你自己'
      };
    }, 'breakdown.values', 2, 5)
  };
}

function normalizePaths(value) {
  if (!Array.isArray(value)) throw new Error('Missing required field: paths');
  const found = new Set();
  const paths = value.map((item) => {
    if (!isObject(item) || !PATH_IDS.includes(item.id) || found.has(item.id)) return null;
    found.add(item.id);
    return {
      id: item.id,
      label: requireText(item.label, `paths.${item.id}.label`, 20),
      summary: requireText(item.summary, `paths.${item.id}.summary`, 100),
      gains: list(item.gains, (line) => cleanText(line, 60) || null, `paths.${item.id}.gains`, 1, 3),
      costs: list(item.costs, (line) => cleanText(line, 60) || null, `paths.${item.id}.costs`, 1, 3),
      reversibility: cleanNumber(item.reversibility, 0, 100, 50),
      worst: requireText(item.worst, `paths.${item.id}.worst`, 100),
      fitsValue: cleanText(item.fitsValue, 80)
    };
  }).filter(Boolean);
  if (paths.length !== 3) throw new Error('Three distinct paths are required');
  // Keep a stable order so the comparison table reads the same every run.
  return PATH_IDS.map((id) => paths.find((item) => item.id === id));
}

function normalizeExperiments(value) {
  return list(value, (item) => {
    if (!isObject(item)) return null;
    const action = cleanText(item.action, 100);
    if (!action) return null;
    return {
      action,
      days: cleanNumber(item.days, 1, 30, 7),
      cost: cleanText(item.cost, 40) || '低',
      signal: cleanText(item.signal, 100),
      targets: cleanText(item.targets, 100)
    };
  }, 'experiments', 2, 4);
}

function normalizeCommitment(value) {
  if (!isObject(value)) throw new Error('Missing required field: commitment');
  return {
    expectation: requireText(value.expectation, 'commitment.expectation', 120),
    stopConditions: list(
      value.stopConditions,
      (line) => cleanText(line, 90) || null,
      'commitment.stopConditions',
      2,
      3
    ),
    reviewInDays: cleanNumber(value.reviewInDays, 7, 90, 30),
    reviewQuestion: requireText(value.reviewQuestion, 'commitment.reviewQuestion', 100)
  };
}

function normalizeSafety(value) {
  if (!isObject(value)) return { route: 'fact', notice: '', referral: '' };
  const route = ROUTES.includes(value.route) ? value.route : 'fact';
  return {
    route,
    notice: cleanText(value.notice, 200),
    referral: cleanText(value.referral, 120)
  };
}

export function normalizeDecision(value) {
  if (!isObject(value)) throw new Error('Decision output must be an object');
  const meta = isObject(value.meta) ? value.meta : {};
  return {
    frame: normalizeFrame(value.frame),
    breakdown: normalizeBreakdown(value.breakdown),
    paths: normalizePaths(value.paths),
    experiments: normalizeExperiments(value.experiments),
    commitment: normalizeCommitment(value.commitment),
    safety: normalizeSafety(value.safety),
    meta: {
      confidence: cleanText(meta.confidence, 40) || '基于你提供的信息',
      unknowns: Array.isArray(meta.unknowns)
        ? meta.unknowns.map((item) => cleanText(item, 100)).filter(Boolean).slice(0, 4)
        : []
    }
  };
}

// 06 回访: the loop only closes if the outcome can be written back.
export function normalizeReview(value) {
  if (!isObject(value)) throw new Error('Review output must be an object');
  return {
    verdict: ['confirmed', 'revised', 'inconclusive'].includes(value.verdict)
      ? value.verdict
      : 'inconclusive',
    headline: requireText(value.headline, 'headline', 72),
    learned: list(value.learned, (line) => cleanText(line, 90) || null, 'learned', 1, 3),
    updatedAssumption: cleanText(value.updatedAssumption, 120),
    nextStep: requireText(value.nextStep, 'nextStep', 110)
  };
}

export function normalizeDecisionInput(value) {
  if (!isObject(value)) throw new Error('Input must be an object');
  const problem = requireText(value.problem, 'input.problem', 4000);
  if (problem.length < 12) {
    throw new Error('Describe the decision in at least 12 characters');
  }
  return {
    problem,
    // Both optional: the deck's step 01 asks only for the problem itself.
    facts: cleanText(value.facts, 4000),
    cares: cleanText(value.cares, 4000)
  };
}

export { ARCHETYPES, ARCHETYPE_IDS, PATH_IDS };
