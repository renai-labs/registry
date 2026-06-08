#!/usr/bin/env node

// validate-mcp - check whether a remote MCP server is Ren-compatible. Zero deps (Node 18+).

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "ren-validate-mcp", version: "0.1.0" };

function parseArgs(argv) {
  const opts = { timeout: 25000 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--token") opts.token = argv[++i];
    else if (a === "--auth") opts.auth = argv[++i];
    else if (a === "--expect-name") opts.expectName = argv[++i];
    else if (a === "--expect-tools")
      opts.expectTools = (argv[++i] || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    else if (a === "--timeout") opts.timeout = Number(argv[++i]);
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (a.startsWith("-")) throw new Error(`unknown option: ${a}`);
    else positional.push(a);
  }
  opts.url = positional[0];
  return opts;
}

const HELP = `validate-mcp <mcpServerUrl> [options]

  --token <bearer>      Bearer token for a protected server (optional)
  --auth  <type>        Expected auth: oauth|api_key|basic|none
  --expect-name "<n>"   Compare server's serverInfo.name to a registry entry
  --expect-tools a,b,c  Compare server's tool names to a registry entry
  --json                Machine-readable report
  --timeout <ms>        Per-request timeout (default 25000)`;

function extractPayload(contentType, text) {
  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim());
    for (let i = dataLines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(dataLines[i]);
      } catch {
        continue;
      }
    }
    throw new Error("no parseable JSON in SSE stream");
  }
  return JSON.parse(text);
}

async function rpc(url, body, { token, sessionId, timeout }) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  const newSession = res.headers.get("mcp-session-id") || sessionId;
  return { res, contentType, text, sessionId: newSession };
}

async function getJson(url, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, body: await res.json() };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  } finally {
    clearTimeout(timer);
  }
}

async function discoverOAuth(url, wwwAuth, timeout) {
  const origin = new URL(url).origin;
  let resourceMetaUrl;
  const m = wwwAuth && wwwAuth.match(/resource_metadata="([^"]+)"/i);
  if (m) resourceMetaUrl = m[1];
  else resourceMetaUrl = `${origin}/.well-known/oauth-protected-resource`;

  const out = { resourceMetaUrl, wwwAuthenticate: wwwAuth || null };

  const pr = await getJson(resourceMetaUrl, timeout);
  if (pr.ok) {
    out.protectedResource = pr.body;
    out.authorizationServers = pr.body.authorization_servers || [];
    out.scopes = pr.body.scopes_supported || [];

    const authServer = out.authorizationServers[0];
    if (authServer) {
      const asUrl = `${authServer.replace(/\/$/, "")}/.well-known/oauth-authorization-server`;
      const as = await getJson(asUrl, timeout);
      if (as.ok) {
        out.authorizationServerMeta = {
          url: asUrl,
          token_endpoint: as.body.token_endpoint,
          authorization_endpoint: as.body.authorization_endpoint,
          token_endpoint_auth_methods_supported:
            as.body.token_endpoint_auth_methods_supported,
        };
      }
    }
  }
  return out;
}

function listTools(payload) {
  const tools = (payload && payload.result && payload.result.tools) || [];
  return tools.map((t) => ({ name: t.name, description: t.description }));
}

async function validate(opts) {
  const report = {
    url: opts.url,
    checks: {},
    serverInfo: null,
    transport: null,
    protected: false,
    oauth: null,
    tools: null,
    drift: null,
    expectedAuth: opts.auth || null,
  };

  let parsed;
  try {
    parsed = new URL(opts.url);
  } catch {
    report.checks.https = { ok: false, detail: "not a valid URL" };
    return finish(report);
  }
  report.checks.https = {
    ok: parsed.protocol === "https:",
    detail:
      parsed.protocol === "https:"
        ? "remote HTTPS endpoint"
        : `Ren requires https; got ${parsed.protocol}`,
  };

  let sessionId;
  let initResult;
  try {
    const init = await rpc(
      opts.url,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: CLIENT_INFO,
        },
      },
      { token: opts.token, timeout: opts.timeout },
    );
    sessionId = init.sessionId;

    if (init.res.status === 401 || init.res.status === 403) {
      report.protected = true;
      const wwwAuth = init.res.headers.get("www-authenticate");
      report.oauth = await discoverOAuth(opts.url, wwwAuth, opts.timeout);

      const hasDiscovery =
        !!report.oauth.protectedResource || !!wwwAuth;
      report.checks.speaksMcp = {
        ok: hasDiscovery,
        detail: hasDiscovery
          ? `protected (HTTP ${init.res.status}); advertises OAuth discovery`
          : `protected (HTTP ${init.res.status}) but no WWW-Authenticate / well-known metadata`,
      };
    } else if (!init.res.ok) {
      report.checks.speaksMcp = {
        ok: false,
        detail: `initialize returned HTTP ${init.res.status}`,
      };
      return finish(report);
    } else {
      initResult = extractPayload(init.contentType, init.text);
      const si = initResult.result && initResult.result.serverInfo;
      report.serverInfo = si || null;
      report.transport = init.contentType.includes("text/event-stream")
        ? "streamable-http (SSE)"
        : "streamable-http (json)";
      report.checks.speaksMcp = {
        ok: !!(initResult.result && initResult.result.protocolVersion),
        detail: si
          ? `${si.name}${si.version ? ` v${si.version}` : ""} - protocol ${initResult.result.protocolVersion}`
          : "initialize returned a result",
      };
    }
  } catch (e) {
    report.checks.speaksMcp = {
      ok: false,
      detail: `initialize failed: ${e.message}`,
    };
    return finish(report);
  }

  const needsToken = report.protected && !opts.token;
  if (needsToken) {
    report.checks.tools = {
      ok: null,
      detail:
        "skipped - server is protected; pass --token to list tools (discovery validated above)",
    };
  } else {
    try {
      await rpc(
        opts.url,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { token: opts.token, sessionId, timeout: opts.timeout },
      ).catch(() => {});

      const tl = await rpc(
        opts.url,
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { token: opts.token, sessionId, timeout: opts.timeout },
      );
      if (!tl.res.ok) {
        report.checks.tools = {
          ok: false,
          detail: `tools/list returned HTTP ${tl.res.status}`,
        };
      } else {
        const payload = extractPayload(tl.contentType, tl.text);
        if (payload.error) {
          report.checks.tools = {
            ok: false,
            detail: `tools/list error: ${payload.error.message || JSON.stringify(payload.error)}`,
          };
        } else {
          const tools = listTools(payload);
          report.tools = tools.map((t) => t.name);
          report.checks.tools = {
            ok: tools.length > 0,
            detail:
              tools.length > 0
                ? `${tools.length} tool(s): ${tools.map((t) => t.name).join(", ")}`
                : "server exposes 0 tools",
          };
        }
      }
    } catch (e) {
      report.checks.tools = { ok: false, detail: `tools/list failed: ${e.message}` };
    }
  }

  if (opts.auth) {
    const looksOauth = report.protected && report.oauth;
    let ok = true;
    let detail = `declared auth=${opts.auth}`;
    if (opts.auth === "oauth" && !looksOauth)
      (ok = false), (detail = "declared oauth but server returned no OAuth discovery");
    if (opts.auth === "none" && report.protected)
      (ok = false), (detail = "declared none but server requires auth");
    report.checks.authMatch = { ok, detail };
  }

  if (opts.expectName || opts.expectTools) {
    const drift = {};
    if (opts.expectName) {
      const actual = report.serverInfo && report.serverInfo.name;
      drift.name = {
        expected: opts.expectName,
        actual: actual || null,
        match: !!actual && actual === opts.expectName,
      };
    }
    if (opts.expectTools && report.tools) {
      const served = new Set(report.tools);
      const expected = new Set(opts.expectTools);
      drift.tools = {
        missing: opts.expectTools.filter((t) => !served.has(t)),
        extra: report.tools.filter((t) => !expected.has(t)),
      };
    }
    report.drift = drift;
  }

  return finish(report);
}

function requiredOk(report) {
  const c = report.checks;
  if (!c.https || !c.https.ok) return false;
  if (!c.speaksMcp || !c.speaksMcp.ok) return false;
  if (c.tools && c.tools.ok === false) return false;
  if (c.authMatch && c.authMatch.ok === false) return false;
  return true;
}

function finish(report) {
  report.compatible = requiredOk(report);
  return report;
}

function mark(ok) {
  if (ok === true) return "✓";
  if (ok === false) return "✗";
  return "—";
}

function printHuman(report) {
  const order = ["https", "speaksMcp", "tools", "authMatch"];
  const labels = {
    https: "Remote HTTPS endpoint",
    speaksMcp: "Speaks MCP (initialize)",
    tools: "Exposes tools",
    authMatch: "Auth matches expected",
  };
  console.log(`\nMCP compatibility check: ${report.url}`);
  console.log("=".repeat(56));
  for (const key of order) {
    const c = report.checks[key];
    if (!c) continue;
    console.log(`  ${mark(c.ok)} ${labels[key].padEnd(26)} ${c.detail}`);
  }

  if (report.oauth) {
    console.log("\n  OAuth discovery:");
    console.log(`    resource metadata: ${report.oauth.resourceMetaUrl}`);
    if (report.oauth.authorizationServers)
      console.log(
        `    authorization_servers: ${report.oauth.authorizationServers.join(", ") || "(none)"}`,
      );
    if (report.oauth.scopes)
      console.log(`    scopes: ${report.oauth.scopes.join(", ") || "(none)"}`);
    if (report.oauth.authorizationServerMeta) {
      const a = report.oauth.authorizationServerMeta;
      console.log(`    token_endpoint: ${a.token_endpoint || "(none)"}`);
      console.log(`    authorization_endpoint: ${a.authorization_endpoint || "(none)"}`);
    }
  }

  if (report.drift) {
    console.log("\n  Drift vs registry entry:");
    if (report.drift.name)
      console.log(
        `    ${mark(report.drift.name.match)} name: expected "${report.drift.name.expected}", got "${report.drift.name.actual}"`,
      );
    if (report.drift.tools) {
      const { missing, extra } = report.drift.tools;
      console.log(
        `    ${mark(missing.length === 0)} tools missing on server: ${missing.join(", ") || "(none)"}`,
      );
      console.log(`    — tools not in registry entry: ${extra.join(", ") || "(none)"}`);
    }
  }

  console.log("=".repeat(56));
  console.log(
    report.compatible
      ? "  RESULT: ✓ Ren-compatible"
      : "  RESULT: ✗ NOT Ren-compatible",
  );
  console.log("");
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (opts.help || !opts.url) {
    console.log(HELP);
    process.exit(opts.url ? 0 : 2);
  }

  const report = await validate(opts);
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exit(report.compatible ? 0 : 1);
}

main().catch((e) => {
  console.error(`fatal: ${e && e.stack ? e.stack : e}`);
  process.exit(2);
});
