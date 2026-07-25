const HAZARD_IDS = new Set(['demand', 'channel', 'cash', 'founder']);
const UNKNOWN_IDS = new Set(['payer', 'repeat', 'speed']);
const POINT_IDS = new Set(['sell-first', 'narrow-channel', 'cap-burn']);
const SCENARIO_IDS = ['worst', 'base', 'best'];
const SCENARIO_LABELS = { worst: '最坏', base: '基准', best: '最好' };

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

function normalizeVitals(value) {
  if (!isObject(value)) throw new Error('Missing required field: vitals');
  return {
    life: cleanNumber(value.life, 0, 100, 40),
    evidence: cleanNumber(value.evidence, 0, 100, 30),
    runway: cleanNumber(value.runway, 0, 100, 30),
    distribution: cleanNumber(value.distribution, 0, 100, 30)
  };
}

function normalizeHazards(value) {
  if (!Array.isArray(value)) throw new Error('Missing required field: hazards');
  const found = new Set();
  const hazards = value.map((item) => {
    if (!isObject(item) || !HAZARD_IDS.has(item.id) || found.has(item.id)) return null;
    found.add(item.id);
    return {
      id: item.id,
      label: requireText(item.label, `hazards.${item.id}.label`, 18),
      short: requireText(item.short, `hazards.${item.id}.short`, 48),
      damage: cleanNumber(item.damage, 0, 100, 50),
      reason: cleanText(item.reason, 160),
      evidence: cleanText(item.evidence, 160)
    };
  }).filter(Boolean);
  if (hazards.length < 3) throw new Error('At least three unique hazards are required');
  return hazards.sort((a, b) => b.damage - a.damage);
}

function normalizeTimeline(value) {
  if (!Array.isArray(value) || value.length < 5) {
    throw new Error('Five timeline events are required');
  }
  return value.slice(0, 5).map((item, index) => {
    if (!isObject(item)) throw new Error(`Invalid timeline event: ${index}`);
    return {
      month: cleanNumber(item.month, 0, 36, index),
      label: requireText(item.label, `timeline.${index}.label`, 22),
      short: requireText(item.short, `timeline.${index}.short`, 64),
      kind: cleanText(item.kind, 20) || (index === 0 ? 'start' : index === 4 ? 'death' : 'signal'),
      damage: cleanNumber(item.damage, 0, 100, index * 20)
    };
  });
}

function normalizeUnknowns(value) {
  if (!Array.isArray(value)) throw new Error('Missing required field: unknowns');
  const found = new Set();
  const unknowns = value.map((item) => {
    if (!isObject(item) || !UNKNOWN_IDS.has(item.id) || found.has(item.id)) return null;
    found.add(item.id);
    return {
      id: item.id,
      title: requireText(item.title, `unknowns.${item.id}.title`, 24),
      short: requireText(item.short, `unknowns.${item.id}.short`, 72),
      why: requireText(item.why, `unknowns.${item.id}.why`, 100),
      action: requireText(item.action, `unknowns.${item.id}.action`, 100),
      proof: requireText(item.proof, `unknowns.${item.id}.proof`, 100),
      hazard: HAZARD_IDS.has(item.hazard) ? item.hazard : 'demand'
    };
  }).filter(Boolean);
  if (unknowns.length !== 3) throw new Error('Three unique unknowns are required');
  return unknowns;
}

function normalizeTurningPoints(value) {
  if (!Array.isArray(value)) throw new Error('Missing required field: turningPoints');
  const found = new Set();
  const points = value.map((item) => {
    if (!isObject(item) || !POINT_IDS.has(item.id) || found.has(item.id)) return null;
    found.add(item.id);
    return {
      id: item.id,
      month: cleanNumber(item.month, 1, 30, 1),
      title: requireText(item.title, `turningPoints.${item.id}.title`, 28),
      move: requireText(item.move, `turningPoints.${item.id}.move`, 100),
      visual: requireText(item.visual, `turningPoints.${item.id}.visual`, 28),
      riskReduction: cleanNumber(item.riskReduction, 8, 40, 18)
    };
  }).filter(Boolean);
  if (points.length !== 3) throw new Error('Three unique turning points are required');
  return points;
}

function normalizeScenarios(value, deathMonth) {
  const found = new Map();
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (!isObject(item) || !SCENARIO_IDS.includes(item.id) || found.has(item.id)) return;
      found.set(item.id, item);
    });
  }
  if (found.size !== 3) throw new Error('Three scenarios (worst, base, best) are required');

  const scenarios = SCENARIO_IDS.map((id) => {
    const item = found.get(id);
    return {
      id,
      label: cleanText(item.label, 8) || SCENARIO_LABELS[id],
      deathMonth: cleanNumber(item.deathMonth, 1, 60, deathMonth),
      cause: requireText(item.cause, `scenarios.${id}.cause`, 28),
      trigger: requireText(item.trigger, `scenarios.${id}.trigger`, 80),
      short: requireText(item.short, `scenarios.${id}.short`, 72),
      probability: cleanNumber(item.probability, 0, 100, 33)
    };
  });

  // The three lines must stay monotonic or the comparison reads as noise:
  // the worst case can never outlive the base case.
  scenarios[1].deathMonth = Math.max(scenarios[1].deathMonth, scenarios[0].deathMonth);
  scenarios[2].deathMonth = Math.max(scenarios[2].deathMonth, scenarios[1].deathMonth);

  const total = scenarios.reduce((sum, item) => sum + item.probability, 0);
  if (total <= 0) {
    scenarios.forEach((item, index) => { item.probability = index === 1 ? 34 : 33; });
  } else {
    scenarios.forEach((item) => {
      item.probability = Math.round((item.probability / total) * 100);
    });
    const drift = 100 - scenarios.reduce((sum, item) => sum + item.probability, 0);
    scenarios[1].probability = Math.max(0, scenarios[1].probability + drift);
  }
  return scenarios;
}

export function parseJsonContent(content) {
  if (isObject(content)) return content;
  const text = cleanText(content, 100000)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  if (!text) throw new Error('The model returned empty content');
  const parsed = JSON.parse(text);
  if (!isObject(parsed)) throw new Error('The model response must be a JSON object');
  return parsed;
}

export function normalizeSimulation(value) {
  if (!isObject(value)) throw new Error('Simulation output must be an object');
  const obituary = value.obituary;
  if (!isObject(obituary) || !Array.isArray(obituary.body)) {
    throw new Error('Missing required field: obituary');
  }
  const profile = isObject(value.profile) ? value.profile : {};
  const meta = isObject(value.meta) ? value.meta : {};
  return {
    profile: {
      ventureName: requireText(profile.ventureName, 'profile.ventureName', 32),
      stageLabel: requireText(profile.stageLabel, 'profile.stageLabel', 24),
      customer: requireText(profile.customer, 'profile.customer', 80),
      strengths: Array.isArray(profile.strengths)
        ? profile.strengths.map((item) => cleanText(item, 20)).filter(Boolean).slice(0, 3)
        : []
    },
    hazards: normalizeHazards(value.hazards),
    vitals: normalizeVitals(value.vitals),
    deathMonth: cleanNumber(value.deathMonth, 3, 36, 9),
    scenarios: normalizeScenarios(value.scenarios, cleanNumber(value.deathMonth, 3, 36, 9)),
    timeline: normalizeTimeline(value.timeline),
    unknowns: normalizeUnknowns(value.unknowns),
    turningPoints: normalizeTurningPoints(value.turningPoints),
    obituary: {
      headline: requireText(obituary.headline, 'obituary.headline', 72),
      cause: requireText(obituary.cause, 'obituary.cause', 28),
      subhead: requireText(obituary.subhead, 'obituary.subhead', 72),
      body: obituary.body.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 3),
      epitaph: requireText(obituary.epitaph, 'obituary.epitaph', 100)
    },
    meta: {
      confidence: cleanText(meta.confidence, 40) || '模型推演',
      assumptions: Array.isArray(meta.assumptions)
        ? meta.assumptions.map((item) => cleanText(item, 100)).filter(Boolean).slice(0, 4)
        : []
    }
  };
}

export function normalizeRewrite(value) {
  if (!isObject(value)) throw new Error('Rewrite output must be an object');
  if (!Array.isArray(value.changed)) throw new Error('Missing required field: changed');
  return {
    monthsAdded: cleanNumber(value.monthsAdded, 1, 36, 8),
    newHorizon: cleanNumber(value.newHorizon, 4, 60, 18),
    status: value.status === 'surviving' ? 'surviving' : 'delayed',
    vitals: normalizeVitals(value.vitals),
    headline: requireText(value.headline, 'headline', 72),
    subhead: requireText(value.subhead, 'subhead', 100),
    changed: value.changed.map((item) => cleanText(item, 70)).filter(Boolean).slice(0, 3),
    nextQuest: requireText(value.nextQuest, 'nextQuest', 110)
  };
}

export function normalizeAnswers(value) {
  if (!isObject(value)) throw new Error('Answers must be an object');
  const answers = {
    memory: requireText(value.memory, 'answers.memory', 4000),
    venture: requireText(value.venture, 'answers.venture', 4000),
    reality: requireText(value.reality, 'answers.reality', 4000)
  };
  if (Object.values(answers).some((item) => item.length < 12)) {
    throw new Error('Each answer must contain at least 12 characters');
  }
  return answers;
}

export function normalizeMode(value) {
  return value === 'deep' ? 'deep' : 'fast';
}
