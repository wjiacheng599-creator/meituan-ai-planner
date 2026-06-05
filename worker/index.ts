export interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        runtime: 'cloudflare-worker',
        hasDbBinding: Boolean(env.DB),
        now: Date.now(),
      });
    }

    if (url.pathname === '/api/schema/version') {
      const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
      return json({
        ok: true,
        tables: tables.results || [],
      });
    }

    return json({
      ok: false,
      message: 'Worker API scaffold ready. Route implementation pending migration from Express server.',
      path: url.pathname,
    }, 404);
  },
};
