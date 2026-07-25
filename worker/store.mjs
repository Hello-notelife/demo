const SESSION_HEADER = 'X-Mingri-Session';

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function sessionCredentials(request) {
  const id = request.headers.get(SESSION_HEADER) || '';
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return { id, token };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function previousUtcDay(day) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function createAnonymousSession(db) {
  const id = crypto.randomUUID();
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = base64Url(tokenBytes);
  const tokenHash = await sha256(token);
  await db.prepare(
    `INSERT INTO anonymous_sessions (id, token_hash)
     VALUES (?, ?)`
  ).bind(id, tokenHash).run();
  return {
    id,
    token,
    account: {
      coins: 0,
      streak: 0,
      petTone: 'direct'
    }
  };
}

export async function requireSession(request, db) {
  const credentials = sessionCredentials(request);
  if (!credentials.id || !credentials.token) {
    const error = new Error('Anonymous session credentials are required');
    error.status = 401;
    error.code = 'session_required';
    throw error;
  }
  const tokenHash = await sha256(credentials.token);
  const session = await db.prepare(
    `SELECT id, coins, streak, pet_tone, last_completed_day
     FROM anonymous_sessions
     WHERE id = ? AND token_hash = ?`
  ).bind(credentials.id, tokenHash).first();
  if (!session) {
    const error = new Error('Anonymous session credentials are invalid');
    error.status = 401;
    error.code = 'invalid_session';
    throw error;
  }
  await db.prepare(
    `UPDATE anonymous_sessions
     SET last_seen_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(session.id).run();
  return session;
}

export async function enforceRateLimit(db, sessionId, maxRequests, windowMs) {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  await db.prepare(
    `INSERT INTO api_usage (session_id, window_start, request_count)
     VALUES (?, ?, 1)
     ON CONFLICT(session_id, window_start)
     DO UPDATE SET request_count = request_count + 1`
  ).bind(sessionId, windowStart).run();
  const row = await db.prepare(
    `SELECT request_count
     FROM api_usage
     WHERE session_id = ? AND window_start = ?`
  ).bind(sessionId, windowStart).first();
  if (Number(row?.request_count || 0) > maxRequests) {
    const error = new Error('Too many simulations. Please try again later.');
    error.status = 429;
    error.code = 'rate_limited';
    throw error;
  }
}

export async function createSimulation(db, sessionId, input, output) {
  const id = crypto.randomUUID();
  const result = output.result;
  await db.prepare(
    `INSERT INTO simulations (
       id, session_id, project_name, stage_label, mode, provider, model,
       answers_json, result_json, evidence_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    sessionId,
    result.profile.ventureName,
    result.profile.stageLabel,
    input.mode,
    output.provider,
    output.model || null,
    JSON.stringify(input.answers),
    JSON.stringify(result),
    JSON.stringify(output.evidence || [])
  ).run();
  return id;
}

export async function completeSimulation(db, session, runId, future) {
  const run = await db.prepare(
    `SELECT id
     FROM simulations
     WHERE id = ? AND session_id = ?`
  ).bind(runId, session.id).first();
  if (!run) {
    const error = new Error('Simulation run was not found');
    error.status = 404;
    error.code = 'run_not_found';
    throw error;
  }

  const day = todayUtc();
  const currentStreak = Number(session.streak || 0);
  let nextStreak = currentStreak;
  if (session.last_completed_day !== day) {
    nextStreak = session.last_completed_day === previousUtcDay(day)
      ? Math.max(1, currentStreak + 1)
      : 1;
  }
  const nextCoins = Number(session.coins || 0) + 70;

  await db.batch([
    db.prepare(
      `UPDATE simulations
       SET future_json = ?, completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND session_id = ?`
    ).bind(JSON.stringify(future), runId, session.id),
    db.prepare(
      `UPDATE anonymous_sessions
       SET coins = ?, streak = ?, last_completed_day = ?,
           last_seen_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(nextCoins, nextStreak, day, session.id)
  ]);

  return {
    coins: nextCoins,
    streak: nextStreak,
    petTone: session.pet_tone
  };
}

export async function readCloudState(db, session) {
  const response = await db.prepare(
    `SELECT id, project_name, stage_label, mode, provider, model,
            result_json, future_json, evidence_json, created_at, completed_at
     FROM simulations
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT 20`
  ).bind(session.id).all();
  return {
    account: {
      coins: Number(session.coins || 0),
      streak: Number(session.streak || 0),
      petTone: session.pet_tone
    },
    runs: (response.results || []).map((row) => ({
      id: row.id,
      projectName: row.project_name,
      stageLabel: row.stage_label,
      mode: row.mode,
      provider: row.provider,
      model: row.model,
      result: parseJson(row.result_json, null),
      future: parseJson(row.future_json, null),
      evidence: parseJson(row.evidence_json, []),
      createdAt: row.created_at,
      completedAt: row.completed_at
    }))
  };
}

export async function updatePreferences(db, sessionId, value) {
  const tone = ['gentle', 'direct', 'cold'].includes(value.petTone)
    ? value.petTone
    : null;
  if (!tone) {
    const error = new Error('Invalid pet tone');
    error.status = 400;
    error.code = 'invalid_pet_tone';
    throw error;
  }
  await db.prepare(
    `UPDATE anonymous_sessions
     SET pet_tone = ?, last_seen_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(tone, sessionId).run();
  return { petTone: tone };
}

export { SESSION_HEADER };
