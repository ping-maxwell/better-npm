import { Hono } from "hono";
import type { Env } from "../types.js";
import { fetchUpstreamTarball } from "./upstream.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/:scope/:name/-/:filename", handleTarball);
app.get("/:name/-/:filename", handleTarball);

async function handleTarball(c: any) {
  const scope = c.req.param("scope");
  const name = c.req.param("name");
  const filename = c.req.param("filename");
  const packageName = scope?.startsWith("@")
    ? `${scope}/${name}`
    : scope || name;

  const r2Key = `${packageName}/${filename}`;

  const customerId: string | undefined = c.get("customerId");

  const cached = await c.env.TARBALLS.get(r2Key);
  if (cached) {
    c.executionCtx.waitUntil(recordInstall(c.env.DB, packageName, filename, customerId, true));
    return new Response(cached.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Cache": "HIT",
      },
    });
  }

  const upstreamUrl = `${c.env.UPSTREAM_REGISTRY}/${packageName}/-/${filename}`;
  const res = await fetchUpstreamTarball(c.env, upstreamUrl);

  if (!res || !res.body) {
    return c.json({ error: "tarball not found" }, 404);
  }

  const arrayBuffer = await res.arrayBuffer();

  const expectedSha = await lookupExpectedSha(c.env.DB, packageName, filename);
  if (expectedSha) {
    const hashBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer);
    const actualSha = [...new Uint8Array(hashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (actualSha !== expectedSha) {
      console.error(
        `[tarball] SHA-1 mismatch for ${packageName}/${filename}: expected=${expectedSha} actual=${actualSha}`,
      );
      return c.json({ error: "tarball integrity check failed" }, 502);
    }
  }

  c.executionCtx.waitUntil(recordInstall(c.env.DB, packageName, filename, customerId, false));

  const bufferCopy = arrayBuffer.slice(0);
  c.executionCtx.waitUntil(
    c.env.TARBALLS.put(r2Key, bufferCopy, {
      httpMetadata: { contentType: "application/octet-stream" },
    }),
  );

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Cache": "MISS",
    },
  });
}

async function recordInstall(
  db: D1Database,
  packageName: string,
  filename: string,
  customerId: string | undefined,
  cacheHit: boolean,
) {
  try {
    const versionStatus = await lookupVersionStatus(db, packageName, filename);
    const id = crypto.randomUUID();
    const ts = Date.now();
    const cid = customerId || null;
    const ch = cacheHit ? 1 : 0;
    try {
      await db
        .prepare(
          "INSERT INTO install (id, package_name, filename, customer_id, cache_hit, created_at, version_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id, packageName, filename, cid, ch, ts, versionStatus)
        .run();
    } catch {
      await db
        .prepare(
          "INSERT INTO install (id, package_name, filename, customer_id, cache_hit, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(id, packageName, filename, cid, ch, ts)
        .run();
    }
  } catch (err) {
    console.error(`[tarball] Failed to record install for ${packageName}/${filename}:`, err);
  }
}

async function lookupExpectedSha(
  db: D1Database,
  packageName: string,
  filename: string,
): Promise<string | null> {
  try {
    const match = filename.match(/-(\d+\.\d+\.\d+[^.]*)\.tgz$/);
    if (!match) return null;
    const version = match[1];
    const row = await db
      .prepare(
        `SELECT pv.tarball_sha FROM package_version pv
         JOIN package p ON p.id = pv.package_id
         WHERE p.name = ? AND pv.version = ?`,
      )
      .bind(packageName, version)
      .first<{ tarball_sha: string }>();
    return row?.tarball_sha || null;
  } catch (err) {
    console.error(`[tarball] SHA lookup failed for ${packageName}/${filename}:`, err);
    return null;
  }
}

async function lookupVersionStatus(
  db: D1Database,
  packageName: string,
  filename: string,
): Promise<string> {
  try {
    const blockRule = await db
      .prepare("SELECT 1 FROM block_rule WHERE package_name = ? LIMIT 1")
      .bind(packageName)
      .first();
    if (blockRule) return "blocked";

    const match = filename.match(/-(\d+\.\d+\.\d+[^.]*)\.tgz$/);
    if (!match) return "unreviewed";

    const version = match[1];
    const row = await db
      .prepare(
        `SELECT pv.status FROM package_version pv
         JOIN package p ON p.id = pv.package_id
         WHERE p.name = ? AND pv.version = ?`,
      )
      .bind(packageName, version)
      .first<{ status: string }>();

    if (row?.status === "rejected") return "blocked";
    return row?.status ?? "unreviewed";
  } catch (err) {
    console.error(`[tarball] Version status lookup failed for ${packageName}/${filename}:`, err);
    return "unreviewed";
  }
}

export { app as tarballRouter };
