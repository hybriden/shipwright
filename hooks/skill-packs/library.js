#!/usr/bin/env node
// Shipwright — skill library search (skillselion.com).
//
// Finds catalog skills for a keyword and keeps only those that pass a quality gate, so the agent can
// ask the user whether to install any. It installs nothing: approved picks go through `engine.js add`,
// which fetches them into the out-of-repo cache like a pack.
//
// The catalog has no ratings; the gate uses the signals it does expose — official-vendor flag, installs,
// repo stars, scanner audits, risk level, duplicate marker, and repo freshness. Calls are user-triggered
// and few (one search plus a detail call per surviving candidate), far inside the API's rate limit.
'use strict';

const path = require('path');
const common = require('../lib/common.js');

const API = 'https://skillselion.com';
const STALE_DAYS = 180;
const OFFICIAL_MIN_INSTALLS = 1000;
const COMMUNITY_MIN_INSTALLS = 10000;
const COMMUNITY_MIN_STARS = 1000;
const MAX_DETAIL_CALLS = 12;
const REJECTED_RISK = new Set(['HIGH', 'CRITICAL']);

// Listing ids look like "skill:<owner>/<repo>#<skill>"; any other shape isn't installable from GitHub.
function parseListingId(id) {
  const m = /^skill:([\w.-]+\/[\w.-]+)#(.+)$/.exec(String(id));
  return m && { repo: m[1], skill: m[2] };
}

async function get(pathname) {
  const res = await fetch(API + pathname, {
    headers: { Accept: 'application/json', 'API-Version': '1', 'User-Agent': 'shipwright-skill-library (user-triggered)' },
  });
  if (!res.ok) throw new Error(`${pathname} returned HTTP ${res.status}`);
  return res.json();
}

// Cheap checks on the search row, before spending a detail call.
function screen(row) {
  if (!parseListingId(row.id)) return 'not hosted on GitHub';
  if (row.duplicateOf) return `duplicate of ${row.duplicateOf}`;
  if (REJECTED_RISK.has(row.riskLevel)) return `risk ${row.riskLevel}`;
  const pushed = Date.parse(row.repoPushedAt);
  if (!Number.isFinite(pushed) || Date.now() - pushed > STALE_DAYS * 86400000) return `repo not pushed within ${STALE_DAYS} days`;
  if (row.officialVendor) return row.installs >= OFFICIAL_MIN_INSTALLS ? null : 'official but too few installs';
  return row.installs >= COMMUNITY_MIN_INSTALLS && row.stars >= COMMUNITY_MIN_STARS ? null : 'community skill below the install/star bar';
}

// Scanner results come only with the full listing.
function auditGate(row, detail) {
  const audits = Array.isArray(detail.audit) ? detail.audit : [];
  const failed = audits.filter((a) => a.status === 'fail').map((a) => a.provider);
  if (failed.length) return { reject: `audit fail: ${failed.join(', ')}` };
  if (REJECTED_RISK.has(detail.riskLevel)) return { reject: `risk ${detail.riskLevel}` };
  if (!audits.length) return row.officialVendor ? { audit: 'unaudited' } : { reject: 'community skill with no audit' };
  const passed = audits.filter((a) => a.status === 'pass').length;
  return { audit: `${passed}/${audits.length} scanners pass${detail.riskLevel ? `, risk ${detail.riskLevel}` : ''}` };
}

async function search(query, { limit = 5 } = {}) {
  const rows = await get(`/api/upstream/listings?q=${encodeURIComponent(query)}&type=skill&sort=installs&limit=50`);
  const survivors = rows
    .filter((row) => !screen(row))
    .sort((a, b) => Number(Boolean(b.officialVendor)) - Number(Boolean(a.officialVendor)) || b.installs - a.installs);

  const candidates = [];
  for (const row of survivors.slice(0, MAX_DETAIL_CALLS)) {
    if (candidates.length >= limit) break;
    const detail = await get(`/api/v1/listings/${encodeURIComponent(row.id)}`);
    const verdict = auditGate(row, detail.data || detail);
    if (verdict.reject) continue;
    candidates.push({
      id: row.id,
      name: row.name,
      publisher: row.author,
      official: Boolean(row.officialVendor),
      installs: row.installs,
      stars: row.stars,
      audit: verdict.audit,
      description: row.description || '',
      repo: `https://github.com/${parseListingId(row.id).repo}`,
    });
  }
  return { query, considered: rows.length, candidates };
}

function render({ query, considered, candidates }) {
  if (!candidates.length) {
    return `[skill-library] "${query}": no skill passed the quality gate (${considered} considered) — offer none.\n`;
  }
  const add = `node "${path.join(__dirname, 'engine.js')}" add`;
  const count = (n) => Number(n || 0).toLocaleString('en-US');
  const lines = [`[skill-library] "${query}": ${candidates.length} of ${considered} passed the quality gate. Ask the user before installing any:`];
  for (const c of candidates) {
    lines.push(`- ${c.name} — ${c.publisher} (${c.official ? 'official' : 'community'}) · ${count(c.installs)} installs · ${count(c.stars)} stars · ${c.audit}`);
    lines.push(`  ${common.shortDesc(c.description)} (${c.repo})`);
    lines.push(`  if picked: ${add} "${c.id}" --project "<project root>"`);
  }
  return `${lines.join('\n')}\n`;
}

// Every catalog listing under one GitHub owner — engine.js screens packs' skills against their risk levels.
async function listingsByOwner(owner) {
  const rows = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await get(`/api/upstream/listings?type=skill&owner=${encodeURIComponent(owner)}&sort=installs&limit=100&offset=${offset}`);
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}

module.exports = { parseListingId, search, render, listingsByOwner, REJECTED_RISK };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--limit');
  const limit = i >= 0 ? Number(argv[i + 1]) || 5 : 5;
  const query = argv.filter((a, idx) => idx > 0 && a !== '--json' && (i < 0 || (idx !== i && idx !== i + 1))).join(' ').trim();
  const cfg = common.readConfig(process.cwd(), 'skillPacks', { enabled: true, library: true });
  if (argv[0] !== 'search' || !query) {
    process.stderr.write('usage: library.js search "<keywords>" [--limit N] [--json]\n');
    process.exit(2);
  } else if (!cfg.enabled || !cfg.library || process.env.SHIPWRIGHT_SKILL_PACKS === 'off') {
    process.stdout.write('[skill-library] disabled by configuration — offer none.\n');
  } else {
    search(query, { limit }).then(
      (result) => process.stdout.write(argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : render(result)),
      (e) => process.stdout.write(`[skill-library] search unavailable (${e.message}) — continue without it.\n`),
    );
  }
}
