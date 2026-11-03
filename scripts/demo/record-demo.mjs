// CMI product demo recorder: records narrated scenes from the live app with Playwright,
// then stitches them into one MP4 with ffmpeg. Run from scratchpad/shot: node ../demo/demo.mjs
import { chromium } from 'playwright';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OUT = path.resolve(process.env.DEMO_OUT || './demo-out');
const FFMPEG = path.resolve('./node_modules/ffmpeg-static/ffmpeg');
const VOICE = process.env.VOICE || 'Samantha';
const RATE = process.env.RATE || '178';
const W = 1600, H = 900;
const API = 'http://localhost:3001/api';
const APP = 'http://localhost:5173';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(email) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) });
  return (await r.json()).token;
}

/* ------------------------------------------------------------------ narration */
function narrate(id, text) {
  const aiff = path.join(OUT, `${id}.aiff`);
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, text]);
  const info = execFileSync('afinfo', [aiff]).toString();
  const dur = Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? 0);
  return { aiff, dur };
}

/* ------------------------------------------------------------------ in-page overlay runtime */
const OVERLAY_JS = `
(() => {
  if (window.__demo) return;
  const style = document.createElement('style');
  style.textContent = \`
    #__cur { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483000; pointer-events: none; transform: translate(-6px,-4px); transition: transform 0s; filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
    #__cur svg { width: 26px; height: 26px; }
    #__ripple { position: fixed; width: 44px; height: 44px; border-radius: 999px; border: 3px solid #6366f1; z-index: 2147482999; pointer-events: none; opacity: 0; transform: translate(-50%,-50%) scale(.4); }
    #__ripple.go { animation: __rip .55s ease-out forwards; }
    @keyframes __rip { 0% { opacity: .9; transform: translate(-50%,-50%) scale(.4);} 100% { opacity: 0; transform: translate(-50%,-50%) scale(1.3);} }
    #__cap { position: fixed; left: 50%; bottom: 36px; transform: translateX(-50%) translateY(12px); max-width: 920px; padding: 14px 22px; border-radius: 16px; background: rgba(12,14,22,.86); color: #fff; font: 500 20px/1.35 Inter, system-ui, sans-serif; letter-spacing: -.01em; box-shadow: 0 16px 40px rgba(0,0,0,.35); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.12); z-index: 2147483001; opacity: 0; transition: opacity .35s ease, transform .35s ease; pointer-events: none; text-align: center; }
    #__cap.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    #__cap b { color: #a5b4fc; font-weight: 600; }
    #__veil { position: fixed; inset: 0; background: #0b0d12; z-index: 2147483002; opacity: 1; transition: opacity .6s ease; pointer-events: none; }
    #__veil.off { opacity: 0; }
    #__badge { position: fixed; bottom: 40px; right: 24px; z-index: 2147483001; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: rgba(12,14,22,.8); color: #e5e7eb; font: 600 12px Inter, system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; border: 1px solid rgba(255,255,255,.12); opacity: 0; transition: opacity .4s; }
    #__badge.show { opacity: 1; }
    #__badge i { width: 8px; height: 8px; border-radius: 999px; background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.25); }
  \`;
  const root = () => document.documentElement || document.body;
  if (root()) root().appendChild(style); else document.addEventListener('DOMContentLoaded', () => root().appendChild(style));
  const cur = document.createElement('div'); cur.id = '__cur';
  cur.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 3l14 8.5-6.2 1.6L9.6 19z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const rip = document.createElement('div'); rip.id = '__ripple';
  const cap = document.createElement('div'); cap.id = '__cap';
  const veil = document.createElement('div'); veil.id = '__veil';
  const badge = document.createElement('div'); badge.id = '__badge'; badge.innerHTML = '<i></i><span>Live demo</span>';
  const mount = () => { const r = root(); if (!r) return; for (const el of [cur, rip, cap, veil, badge]) if (!el.isConnected) r.appendChild(el); };
  mount(); document.addEventListener('DOMContentLoaded', mount);
  let cx = 800, cy = 450;
  window.__demo = {
    pos: () => [cx, cy],
    cursor(x, y) { cx = x; cy = y; cur.style.transform = 'translate(' + (x - 6) + 'px,' + (y - 4) + 'px)'; },
    ripple(x, y) { rip.style.left = x + 'px'; rip.style.top = y + 'px'; rip.classList.remove('go'); void rip.offsetWidth; rip.classList.add('go'); },
    caption(html) { if (!html) { cap.classList.remove('show'); return; } cap.innerHTML = html; cap.classList.add('show'); },
    veil(on) { veil.classList.toggle('off', !on); },
    badge(on) { badge.classList.toggle('show', !!on); },
  };
})();`;

/* ------------------------------------------------------------------ scene runtime */
class Scene {
  constructor(page, id) { this.page = page; this.id = id; this.t0 = Date.now(); }
  get elapsed() { return (Date.now() - this.t0) / 1000; }
  async caption(html) { await this.page.evaluate((h) => window.__demo?.caption(h), html); }
  async veil(on) { await this.page.evaluate((o) => window.__demo?.veil(o), on); }
  async badge(on) { await this.page.evaluate((o) => window.__demo?.badge(o), on); }
  async moveTo(x, y, ms = 700) {
    const [sx, sy] = await this.page.evaluate(() => window.__demo?.pos() ?? [800, 450]);
    const steps = Math.max(8, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps; const e = 1 - Math.pow(1 - t, 3);
      const x1 = sx + (x - sx) * e, y1 = sy + (y - sy) * e;
      await this.page.evaluate(([a, b]) => window.__demo?.cursor(a, b), [x1, y1]);
      await this.page.mouse.move(x1, y1);
      await sleep(16);
    }
  }
  async hover(locator, ms = 700) {
    const box = await locator.first().boundingBox();
    if (!box) return null;
    const x = box.x + Math.min(box.width / 2, 160), y = box.y + box.height / 2;
    await this.moveTo(x, y, ms);
    return [x, y];
  }
  async click(locator, { ms = 700, settle = 500 } = {}) {
    const loc = locator.first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(150);
    const pt = await this.hover(loc, ms);
    if (!pt) throw new Error('click target not found');
    await this.page.evaluate(([x, y]) => window.__demo?.ripple(x, y), pt);
    await sleep(120);
    await loc.click({ timeout: 8000 });
    await sleep(settle);
  }
  async type(locator, text, { delay = 28 } = {}) {
    await this.click(locator, { settle: 200 });
    await locator.first().fill('');
    await locator.first().pressSequentially(text, { delay });
  }
  async scroll(dy, ms = 900) {
    const steps = Math.max(6, Math.round(ms / 40));
    for (let i = 0; i < steps; i++) { await this.page.mouse.wheel(0, dy / steps); await sleep(ms / steps); }
  }
  async wait(ms) { await sleep(ms); }
  /** Hold the scene until the narration has finished (+tail). */
  async finish(narrationSec, tail = 0.8) {
    const remaining = narrationSec + tail - this.elapsed;
    if (remaining > 0) await sleep(remaining * 1000);
  }
}

async function record(id, email, run) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, colorScheme: 'light', reducedMotion: 'no-preference' });
  const token = email ? await login(email) : null;
  await ctx.addInitScript(([t]) => { if (t) localStorage.setItem('cmi.token', t); localStorage.setItem('cmi.theme', 'light'); localStorage.setItem('cmi.sidebar', '0'); }, [token]);
  await ctx.addInitScript(OVERLAY_JS);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const scene = new Scene(page, id);
  try {
    await run(scene, page);
  } catch (e) {
    console.error(`scene ${id} failed:`, e.message);
    await page.screenshot({ path: path.join(OUT, `${id}-error.png`) }).catch(() => {});
    throw e;
  }
  const video = page.video();
  await ctx.close();
  await browser.close();
  const src = await video.path();
  const dst = path.join(OUT, `${id}.webm`);
  fs.renameSync(src, dst);
  if (errors.length) console.warn(`scene ${id} page errors:`, errors);
  return dst;
}

/* ------------------------------------------------------------------ title cards */
const CARD_HTML = (kind) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Sans:wght@600;700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;height:100%;background:#0b0d12;color:#fff;font-family:Inter,system-ui,sans-serif;overflow:hidden}
  .bg{position:absolute;inset:0;background:radial-gradient(900px 500px at 50% -10%, rgba(99,102,241,.35), transparent 70%), radial-gradient(700px 400px at 90% 110%, rgba(20,184,166,.25), transparent 70%)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:32px 32px;mask-image:radial-gradient(ellipse at center,black,transparent 75%)}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 120px}
  .logo{display:flex;align-items:center;gap:14px;margin-bottom:34px;opacity:0;animation:up .8s .2s forwards}
  .mark{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#14b8a6);display:grid;place-items:center}
  .mark svg{width:30px;height:30px}
  .name{font-family:'Instrument Sans',Inter,sans-serif;font-weight:700;font-size:26px;letter-spacing:-.01em}
  .sub{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;margin-top:2px}
  h1{font-family:'Instrument Sans',Inter,sans-serif;font-size:64px;line-height:1.06;letter-spacing:-.03em;margin:0;max-width:1100px;opacity:0;animation:up .9s .5s forwards}
  h1 span{background:linear-gradient(120deg,#a5b4fc,#5eead4);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{font-size:22px;color:#cbd5e1;max-width:860px;line-height:1.5;margin:26px 0 0;opacity:0;animation:up .9s .9s forwards}
  .pills{display:flex;gap:12px;margin-top:40px;opacity:0;animation:up .9s 1.3s forwards}
  .pill{padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);font-size:15px;color:#e5e7eb}
  .url{margin-top:38px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:20px;color:#a5b4fc;opacity:0;animation:up .9s 1.1s forwards}
  .fade{position:absolute;inset:0;background:#0b0d12;animation:fadeout .9s .05s forwards}
  @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  @keyframes fadeout{to{opacity:0}}
</style></head><body><div class="bg"></div><div class="grid"></div><div class="wrap">
  <div class="logo"><div class="mark"><svg viewBox="0 0 32 32"><path d="M9 20.5c0-4.1 3.1-7.5 7-7.5s7 3.4 7 7.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="10" r="2.5" fill="#fff"/></svg></div><div><div class="name">CMI</div><div class="sub">Creator Marketing Infrastructure</div></div></div>
  ${kind === 'intro'
    ? `<h1>Creator marketing that <span>humans and AI agents</span> run together.</h1><p>One shared core. A dashboard for brands, agencies and creators — and a governed MCP server for autonomous marketing agents.</p><div class="pills"><span class="pill">15 governed MCP tools</span><span class="pill">Budget &amp; rate ceilings</span><span class="pill">Human approval checkpoints</span><span class="pill">Hash-chained audit trail</span></div>`
    : `<h1>Let your first agent <span>run a campaign</span> today.</h1><p>Open source under the MIT license. Clone it, seed it, connect Claude Desktop or Cursor to the MCP server, and watch the audit trail fill up.</p><div class="url">github.com/iDhruv03/agentic-creator-marketing</div>`}
</div><div class="fade"></div></body></html>`;

async function recordCard(id, kind, holdSec) {
  return record(id, null, async (s, page) => {
    const file = path.join(OUT, `card-${kind}.html`);
    fs.writeFileSync(file, CARD_HTML(kind));
    await page.goto('file://' + file, { waitUntil: 'load' });
    await page.evaluate(() => window.__demo?.veil(false));
    await sleep(holdSec * 1000);
  });
}

/* ------------------------------------------------------------------ scenes */
const SCENES = [];
const scene = (id, email, text, run) => SCENES.push({ id, email, text, run });

scene('01-intro', null, 'Meet CMI: creator marketing infrastructure built for a world where campaigns are planned, negotiated and executed by AI agents working alongside human marketers.', null);

scene('02-overview', null, 'Brands, agencies and creators share one dashboard. Behind it sits a single data core, so everything an agent does shows up here the moment it happens: budgets, escrow, approvals and the audit trail.', async (s, page) => {
  await page.goto(`${APP}/login`, { waitUntil: 'load' }); await sleep(900);
  await s.veil(false); await s.badge(true);
  await s.caption('One login. <b>Brand</b>, <b>agency</b> and <b>creator</b> personas.');
  await sleep(900);
  await s.click(page.getByRole('button', { name: /Maya Okonkwo/ }), { ms: 900, settle: 1800 });
  await page.waitForURL('**/'); await sleep(300);
  await page.keyboard.press('Escape'); await s.moveTo(700, 500, 400); await sleep(400);
  await s.caption('Budgets, escrow and agent activity — <b>live from one data core</b>.');
  await s.hover(page.getByText('Managed budget').first(), 900); await sleep(500);
  await s.hover(page.getByText('Agent actions').first(), 900); await sleep(500);
  await s.caption('Agent actions above policy wait for <b>your approval</b>.');
  await s.hover(page.getByText(/waiting for your approval/).first(), 800);
  await sleep(700);
  await s.scroll(520, 1400); await sleep(700);
  await s.caption('Every audited action, agent or human, in the same feed.');
  await sleep(900);
});

scene('03-discover', 'maya@techpulse.audio', 'Discovery scores every creator against your brief: niche, audience, performance, budget fit and reliability, with the reasons spelled out. Filter by audience country and you are looking at a global roster, from Austin to Mumbai, with rate benchmarks for every market.', async (s, page) => {
  await page.goto(`${APP}/creators?campaign_id=camp_techpulse_earbuds`, { waitUntil: 'load' }); await sleep(1200);
  await s.veil(false); await s.badge(true);
  await s.caption('Creators <b>scored against the brief</b> — with reasons.');
  const first = page.locator('.card').filter({ hasText: '@' }).first();
  await s.hover(first, 900); await sleep(900);
  await s.caption('Filter by <b>audience country</b>.');
  const trigger = page.getByRole('combobox', { name: /Audience country/i }).first();
  await s.click(trigger, { ms: 800, settle: 500 });
  await s.click(page.getByRole('option', { name: 'India' }), { ms: 600, settle: 1400 });
  await s.caption('A <b>global roster</b> — India, the US, UK and Europe.');
  await s.hover(page.locator('.card').filter({ hasText: '@' }).nth(1), 900); await sleep(600);
  await s.scroll(380, 1000); await sleep(600);
  await s.caption('Open a <b>media kit</b>: audience, platforms, rate card, benchmarks.');
  await s.click(page.getByRole('button', { name: /Ananya Iyer/ }).first(), { ms: 800, settle: 1500 });
  await sleep(1200);
  await s.scroll(300, 800); await sleep(500);
  await page.keyboard.press('Escape'); await sleep(400);
});

scene('04-launch', 'maya@techpulse.audio', 'Now hand the campaign to an agent. Every agent session is authorised by a human with a role scope, a hard budget ceiling and a per-collaboration rate ceiling. Give it a goal, and launch.', async (s, page) => {
  await page.goto(`${APP}/agents`, { waitUntil: 'load' }); await sleep(1100);
  await s.veil(false); await s.badge(true);
  await s.caption('Agent sessions: <b>scope</b>, <b>budget ceiling</b>, <b>rate ceiling</b>.');
  await s.hover(page.getByText('PulseBuds launch operator').first(), 900); await sleep(900);
  await s.caption('Launch a run with a plain-language goal.');
  await s.click(page.getByRole('button', { name: /^Launch run$/ }).first(), { ms: 800, settle: 900 });
  const dlg = page.getByRole('dialog');
  await s.click(dlg.getByRole('button', { name: /Run this campaign end to end/ }).first(), { ms: 700, settle: 700 });
  await sleep(600);
  await s.click(dlg.getByRole('button', { name: /^Launch/ }).last(), { ms: 700, settle: 1200 });
  await page.waitForURL('**/agents/runs/**', { timeout: 15000 });
  await s.caption('The run starts <b>streaming live</b>.');
  await sleep(1500);
});

scene('05-run', 'maya@techpulse.audio', 'Watch it work. It inspects the campaign, searches and shortlists creators, benchmarks rates and sends offers, every call going through the governed MCP server. And when an offer reaches past its rate ceiling, governance parks the action for a human instead of spending the money.', async (s, page) => {
  // Reuse the most recent run (started in the previous scene). Start a fresh one so the stream is live on camera.
  const token = await login('maya@techpulse.audio');
  const r = await fetch(`${API}/agents/runs`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ session_id: 'sess_techpulse_operator', campaign_id: 'camp_techpulse_earbuds', goal: 'Run this campaign end to end: discover and shortlist creators, refine the brief, and send offers within policy.', mode: 'SIMULATED' }) });
  const run = await r.json();
  await page.goto(`${APP}/agents/runs/${run.id}`, { waitUntil: 'load' }); await sleep(900);
  await s.veil(false); await s.badge(true);
  await s.caption('Reasoning, tool calls and results — <b>as they happen</b>.');
  for (let i = 0; i < 7; i++) { await sleep(1300); if (i === 3) await s.scroll(300, 800); }
  await s.caption('Above the rate ceiling? <b>Held for human approval</b>, not executed.');
  await sleep(2600);
  await s.caption('Over budget? <b>Blocked by guardrail</b>. Nothing is written.');
  await sleep(2400);
  await s.scroll(-400, 900);
  await s.caption('Summary, checkpoints raised and the rules that fired.');
  await sleep(1500);
});

scene('06-approvals', 'maya@techpulse.audio', 'High impact actions wait in the approval queue with the agent\'s justification, the creator, and the numbers against policy. Approve, and it executes on your authority. Reject, and nothing changes.', async (s, page) => {
  await page.goto(`${APP}/approvals`, { waitUntil: 'load' }); await sleep(1200);
  await s.veil(false); await s.badge(true);
  await s.caption('The <b>approval queue</b>: what the agent wants to do, and why.');
  const item = page.getByText('Out-of-band rate').first();
  await s.click(item, { ms: 800, settle: 1000 });
  await s.hover(page.getByText(/justification/i).first(), 700); await sleep(900);
  await s.caption('Approve with notes — it executes <b>on your authority</b>.');
  const notes = page.getByRole('textbox').last();
  await s.type(notes, 'Strong fit for the launch; overage is acceptable.', { delay: 22 });
  await sleep(300);
  await s.click(page.getByRole('button', { name: /Approve & execute/ }).first(), { ms: 700, settle: 800 });
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Approve/ }).last();
  await s.click(confirm, { ms: 600, settle: 1800 });
  await s.caption('Executed: the offer is live and <b>escrow is locked</b>.');
  await sleep(1500);
});

scene('07-audit', 'maya@techpulse.audio', 'Every tool call and every human decision lands in a hash-chained, append-only audit trail you can verify in one click. And every dollar moves through a double-entry ledger with escrow, so the books always balance.', async (s, page) => {
  await page.goto(`${APP}/audit`, { waitUntil: 'load' }); await sleep(1200);
  await s.veil(false); await s.badge(true);
  await s.caption('<b>Chain intact</b> — append-only, SHA-256 linked.');
  await s.hover(page.getByText(/Chain intact/).first(), 800); await sleep(900);
  await s.click(page.locator('tbody tr').first(), { ms: 800, settle: 1200 });
  await s.caption('Parameters, guardrail notes and the hash for every entry.');
  await sleep(1600);
  await page.goto(`${APP}/finance`, { waitUntil: 'load' }); await sleep(1100);
  await s.caption('Double-entry ledger: budget → escrow → creator wallet.');
  await s.scroll(500, 1200); await sleep(1200);
  await s.hover(page.getByText(/Balanced/).first(), 800); await sleep(900);
});

scene('08-mcp', 'maya@techpulse.audio', 'It is a real MCP server. Connect Claude Desktop or Cursor over stdio, or any client over HTTP. Each session only sees the tools it is allowed to call, and the same guardrails apply no matter where the call comes from.', async (s, page) => {
  await page.goto(`${APP}/mcp`, { waitUntil: 'load' }); await sleep(1200);
  await s.veil(false); await s.badge(true);
  await s.caption('A standards-compliant <b>MCP server</b> — stdio and Streamable HTTP.');
  await s.scroll(420, 1100); await sleep(1000);
  await s.caption('Drop the config into Claude Desktop or Cursor.');
  await sleep(1400);
  await s.scroll(700, 1200); await sleep(800);
  await s.caption('15 governed tools, scoped per session, with schemas.');
  await sleep(1600);
});

scene('09-creator', 'ananya@creator.cmi', 'Creators get their side too. Offers arrive with the brief and a must-include checklist. Content is submitted with a live compliance check for disclosure, tags and codes. And payouts come straight from escrow into the creator wallet.', async (s, page) => {
  await page.goto(`${APP}/creator/offers/collab_ananya_zestra`, { waitUntil: 'load' }); await sleep(1300);
  await s.veil(false); await s.badge(true);
  await s.caption('The creator view: brief, <b>must-include checklist</b>, conversation.');
  await s.hover(page.getByText(/Must include/i).first(), 900); await sleep(1000);
  await s.caption('Submit content with a <b>live compliance check</b>.');
  await s.click(page.getByRole('button', { name: /Submit content/ }).first(), { ms: 800, settle: 900 });
  const dlg = page.getByRole('dialog');
  await s.type(dlg.getByRole('textbox').first(), 'https://www.youtube.com/watch?v=glowritual-day10', { delay: 14 });
  await s.type(dlg.getByRole('textbox').nth(1), '#ad My honest 14-day Glow Ritual test with @zestranaturals — serum texture, monsoon routine and results. #GlowRitual #ZestraIndia · ZESTRA20 for 20% off', { delay: 16 });
  await sleep(1400);
  await s.caption('Disclosure, platform, tags and code — <b>checked before review</b>.');
  await sleep(1800);
  await page.keyboard.press('Escape'); await sleep(500);
  await page.goto(`${APP}/creator/wallet`, { waitUntil: 'load' }); await sleep(1000);
  await s.caption('Payouts from escrow, straight to the wallet.');
  await sleep(1600);
});

scene('10-outro', null, 'CMI is open source. Clone it, seed it, and let your first agent run a campaign today.', null);

/* ------------------------------------------------------------------ main */
const only = process.argv[2] ? process.argv[2].split(',') : null;
const parts = [];
const failed = [];
for (const sc of SCENES) {
  const mp4Existing = path.join(OUT, `${sc.id}.mp4`);
  if (only && !only.some((o) => sc.id.startsWith(o))) { if (fs.existsSync(mp4Existing)) parts.push(mp4Existing); continue; }
  console.log(`▶ ${sc.id}`);
  try {
  const nar = narrate(sc.id, sc.text);
  let webm;
  if (sc.id.endsWith('intro')) webm = await recordCard(sc.id, 'intro', nar.dur + 1.2);
  else if (sc.id.endsWith('outro')) webm = await recordCard(sc.id, 'outro', nar.dur + 2.5);
  else webm = await record(sc.id, sc.email, async (s, page) => { await sc.run(s, page); await s.finish(nar.dur, 0.9); await s.caption(''); await sleep(400); });
  // mux: video + narration, pad audio with silence to video length
  const mp4 = path.join(OUT, `${sc.id}.mp4`);
  const probe = spawnSync(FFMPEG, ['-i', webm], { stdio: ['ignore', 'ignore', 'pipe'] }).stderr.toString();
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe);
  const vdur = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : nar.dur + 2;
  const res = spawnSync(FFMPEG, ['-y', '-i', webm, '-i', nar.aiff, '-filter_complex', `[0:v]fade=t=in:st=0:d=0.45[v];[1:a]adelay=350|350,apad=whole_dur=${vdur.toFixed(2)}[a]`, '-map', '[v]', '-map', '[a]', '-t', vdur.toFixed(2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', mp4], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 180000 });
  if (res.status !== 0) { console.error(res.stderr.toString().slice(-1500)); process.exit(1); }
  parts.push(mp4);
  console.log(`  ✓ ${sc.id} (narration ${nar.dur.toFixed(1)}s)`);
  } catch (e) { failed.push(sc.id); console.error(`  ✗ ${sc.id}: ${e.message.split('\n')[0]}`); }
}
if (failed.length) { console.error(`\nFAILED scenes: ${failed.join(', ')}`); process.exit(2); }
{
  const list = path.join(OUT, 'concat.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const final = path.join(OUT, 'cmi-demo.mp4');
  const res = spawnSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', final], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (res.status !== 0) { console.error(res.stderr.toString().slice(-1500)); process.exit(1); }
  console.log(`\n✓ final video: ${final}`);
}
