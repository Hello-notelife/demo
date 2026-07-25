import { normalizeAnswers, normalizeMode } from '../server/contracts.mjs';
import { createDeepSeekService } from '../server/deepseek.mjs';
import {
  completeSimulation,
  createAnonymousSession,
  createSimulation,
  enforceRateLimit,
  readCloudState,
  requireSession,
  updatePreferences
} from './store.mjs';

function integer(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function runtimeConfig(env) {
  return {
    deepseekApiKey: env.DEEPSEEK_API_KEY || '',
    deepseekBaseUrl: (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    fastModel: env.DEEPSEEK_FAST_MODEL || 'deepseek-v4-flash',
    deepModel: env.DEEPSEEK_DEEP_MODEL || 'deepseek-v4-pro',
    tavilyApiKey: env.TAVILY_API_KEY || '',
    tavilyBaseUrl: (env.TAVILY_BASE_URL || 'https://api.tavily.com').replace(/\/$/, ''),
    requestTimeoutMs: integer(env.REQUEST_TIMEOUT_MS, 55000),
    rateLimitMax: integer(env.RATE_LIMIT_MAX, 12),
    rateLimitWindowMs: integer(env.RATE_LIMIT_WINDOW_MS, 600000)
  };
}

function responseHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders()
  });
}

function apiError(error) {
  const status = Number(error.status) || 500;
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  return json({
    error: {
      code: error.code || (safeStatus === 500 ? 'internal_error' : 'request_failed'),
      message: safeStatus === 500
        ? 'The simulation service failed safely.'
        : error.message
    }
  }, safeStatus);
}

async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 65536) {
    const error = new Error('Request body is too large');
    error.status = 413;
    error.code = 'request_too_large';
    throw error;
  }
  const text = await request.text();
  if (text.length > 65536) {
    const error = new Error('Request body is too large');
    error.status = 413;
    error.code = 'request_too_large';
    throw error;
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.status = 400;
    error.code = 'invalid_json';
    throw error;
  }
}

function rewritePayload(body) {
  if (!body.selectedPoint || typeof body.selectedPoint !== 'object') {
    const error = new Error('A selected turning point is required');
    error.status = 400;
    error.code = 'invalid_turning_point';
    throw error;
  }
  if (!body.runId || typeof body.runId !== 'string') {
    const error = new Error('A simulation run ID is required');
    error.status = 400;
    error.code = 'run_required';
    throw error;
  }
  return {
    runId: body.runId.slice(0, 80),
    answers: normalizeAnswers(body.answers),
    selectedPoint: body.selectedPoint,
    original: body.original && typeof body.original === 'object' ? body.original : {}
  };
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const config = runtimeConfig(env);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    let database = false;
    try {
      const row = await env.DB.prepare('SELECT 1 AS ready').first();
      database = row?.ready === 1;
    } catch {
      database = false;
    }
    return json({
      status: database ? 'ok' : 'degraded',
      provider: 'deepseek',
      configured: Boolean(config.deepseekApiKey),
      database,
      liveEvidence: Boolean(config.tavilyApiKey),
      models: {
        fast: config.fastModel,
        deep: config.deepModel
      }
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/session') {
    return json(await createAnonymousSession(env.DB), 201);
  }

  const session = await requireSession(request, env.DB);

  if (request.method === 'GET' && url.pathname === '/api/state') {
    return json(await readCloudState(env.DB, session));
  }

  if (request.method === 'PATCH' && url.pathname === '/api/state') {
    return json(await updatePreferences(env.DB, session.id, await readJson(request)));
  }

  if (request.method === 'POST' && url.pathname === '/api/simulate') {
    await enforceRateLimit(
      env.DB,
      session.id,
      config.rateLimitMax,
      config.rateLimitWindowMs
    );
    const body = await readJson(request);
    const mode = normalizeMode(body.mode);
    const answers = normalizeAnswers(body.answers);
    const complete = createDeepSeekService(config);
    const output = await complete({
      kind: 'simulate',
      mode,
      payload: { answers }
    });
    const runId = await createSimulation(
      env.DB,
      session.id,
      { answers, mode },
      output
    );
    return json({ ...output, runId });
  }

  if (request.method === 'POST' && url.pathname === '/api/rewrite') {
    await enforceRateLimit(
      env.DB,
      session.id,
      config.rateLimitMax,
      config.rateLimitWindowMs
    );
    const payload = rewritePayload(await readJson(request));
    const complete = createDeepSeekService(config);
    const output = await complete({
      kind: 'rewrite',
      mode: 'deep',
      payload
    });
    const account = await completeSimulation(
      env.DB,
      session,
      payload.runId,
      output.result
    );
    return json({ ...output, account, runId: payload.runId });
  }

  return json({
    error: {
      code: 'not_found',
      message: 'Not found'
    }
  }, 404);
}

export function createWorker() {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        try {
          return await handleApi(request, env);
        } catch (error) {
          return apiError(error);
        }
      }
      return env.ASSETS.fetch(request);
    }
  };
}

export default createWorker();
