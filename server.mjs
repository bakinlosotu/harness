import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';

const app = express();
app.disable('x-powered-by');

// ---------- rate limit (per IP, per minute) ----------
const hits = new Map();
const limit = (max) => (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'x';
  const key = ip + ':' + max; const now = Date.now();
  const w = (hits.get(key) || []).filter((t) => now - t < 60000);
  if (w.length >= max) return res.status(429).json({ error: { message: 'Too many requests. Wait a minute and try again.' } });
  w.push(now); hits.set(key, w); next();
};

app.get('/api/health', (_req, res) => res.type('text').send('ok'));

// ---------- provider proxy ----------
const ALLOWED = new Set(['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'api.x.ai', 'api.tavily.com', 'en.wikipedia.org']);
const PASS = ['authorization', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access', 'x-goog-api-key', 'content-type'];

app.all('/api/proxy', limit(120), express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  try {
    const target = new URL(String(req.query.url || ''));
    if (target.protocol !== 'https:' || !ALLOWED.has(target.hostname))
      return res.status(400).json({ error: { message: 'Host not allowed' } });
    const headers = {};
    for (const h of PASS) if (req.headers[h]) headers[h] = req.headers[h];
    const hasBody = !['GET', 'HEAD'].includes(req.method) && Buffer.isBuffer(req.body) && req.body.length > 0;
    const upstream = await fetch(target, { method: req.method, headers, body: hasBody ? req.body : undefined });
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type'); if (ct) res.setHeader('content-type', ct);
    res.setHeader('cache-control', 'no-store');
    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).on('error', () => res.end()).pipe(res);
  } catch {
    if (!res.headersSent) res.status(502).json({ error: { message: 'Proxy could not reach the provider' } });
    else res.end();
  }
});

// ---------- Gmail over IMAP/SMTP with an app password (stateless) ----------
const mailJson = express.json({ limit: '2mb' });

function creds(body) {
  const user = String(body?.user || '').trim();
  const pass = String(body?.pass || '').replace(/\s+/g, '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user) || pass.length !== 16) {
    const e = new Error('Enter your Gmail address and the 16-character app password.'); e.status = 400; throw e;
  }
  return { user, pass };
}

async function withImap(body, fn) {
  const { user, pass } = creds(body);
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass },
    logger: false, connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 60000,
  });
  client.on('error', () => {}); // never crash the process on socket errors
  await client.connect();
  try { return await fn(client, user); } finally { await client.logout().catch(() => client.close()); }
}

function mailError(res, e) {
  const text = `${e?.message || ''} ${e?.responseText || ''} ${e?.response || ''}`;
  let status = e?.status || 502;
  let message = 'Could not reach Gmail. Try again in a moment.';
  if (status === 400) message = e.message;
  else if (e?.authenticationFailed || e?.code === 'EAUTH' || /AUTHENTICATIONFAILED|Invalid credentials|Username and Password not accepted|535/i.test(text)) {
    status = 401;
    message = 'Gmail rejected the login. Use your full Gmail address and a 16-character app password (not your normal password), with 2-Step Verification turned on.';
  } else if (/IMAP access is disabled|Web login required|ALERT/i.test(text)) {
    status = 403; message = 'Gmail blocked IMAP for this account. Check IMAP is enabled in Gmail settings, or ask your admin if this is a work account.';
  } else if (/ETIMEDOUT|ECONNRESET|ENOTFOUND|timeout/i.test(text)) {
    status = 504; message = 'Gmail took too long to respond. Try again.';
  } else if (e?.status === 404) { status = 404; message = e.message; }
  if (!res.headersSent) res.status(status).json({ error: { message } });
}

const addr = (a) => (a ? { name: a.name || '', address: a.address || '' } : null);

app.post('/api/mail/test', limit(20), mailJson, async (req, res) => {
  try { await withImap(req.body, async () => true); res.json({ ok: true }); } catch (e) { mailError(res, e); }
});

app.post('/api/mail/list', limit(30), mailJson, async (req, res) => {
  try {
    const page = Math.max(0, Math.floor(Number(req.body?.page) || 0));
    const query = String(req.body?.query || '').trim().slice(0, 200);
    const out = await withImap(req.body, async (c) => {
      const lock = await c.getMailboxLock('INBOX');
      try {
        let range; let total;
        if (query) {
          const uids = ((await c.search({ gmraw: query }, { uid: true })) || []).sort((a, b) => b - a);
          total = uids.length; range = uids.slice(page * 25, page * 25 + 25);
        } else {
          const all = ((await c.search({ all: true }, { uid: true })) || []).sort((a, b) => b - a);
          total = all.length; range = all.slice(page * 25, page * 25 + 25);
        }
        const items = [];
        if (range.length) {
          for await (const m of c.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true })) {
            items.push({
              uid: m.uid, subject: m.envelope?.subject || '(no subject)', from: addr(m.envelope?.from?.[0]),
              date: m.internalDate, unread: !m.flags?.has('\\Seen'),
            });
          }
        }
        items.sort((a, b) => b.uid - a.uid);
        return { items, total, page, hasMore: (page + 1) * 25 < total };
      } finally { lock.release(); }
    });
    res.json(out);
  } catch (e) { mailError(res, e); }
});

app.post('/api/mail/message', limit(60), mailJson, async (req, res) => {
  try {
    const uid = Number(req.body?.uid);
    if (!Number.isInteger(uid) || uid <= 0) { const e = new Error('Missing message id.'); e.status = 400; throw e; }
    const out = await withImap(req.body, async (c) => {
      const lock = await c.getMailboxLock('INBOX');
      try {
        const msg = await c.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg?.source) { const e = new Error('That email no longer exists.'); e.status = 404; throw e; }
        const p = await simpleParser(msg.source);
        let text = p.text || '';
        if (!text.trim() && p.html) text = String(p.html).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+\n/g, '\n');
        const refs = Array.isArray(p.references) ? p.references : p.references ? [p.references] : [];
        return {
          uid, subject: p.subject || '(no subject)', from: addr(p.from?.value?.[0]), replyTo: addr(p.replyTo?.value?.[0]),
          date: p.date, messageId: p.messageId || '', references: refs, text: text.slice(0, 50000),
          attachments: (p.attachments || []).map((a) => a.filename).filter(Boolean),
        };
      } finally { lock.release(); }
    });
    res.json(out);
  } catch (e) { mailError(res, e); }
});

function buildMail(user, b) {
  const to = String(b?.to || '').trim();
  const subject = String(b?.subject || '').slice(0, 500);
  const text = String(b?.text || '');
  if (!to || !text.trim()) { const e = new Error('Recipient and message text are required.'); e.status = 400; throw e; }
  const refs = Array.isArray(b?.references) ? b.references.map(String) : [];
  const inReplyTo = b?.inReplyTo ? String(b.inReplyTo) : undefined;
  return { from: user, to, subject, text, inReplyTo, references: inReplyTo ? [...refs, inReplyTo] : refs };
}

app.post('/api/mail/draft', limit(20), mailJson, async (req, res) => {
  try {
    await withImap(req.body, async (c, user) => {
      const mail = buildMail(user, req.body);
      const raw = await new MailComposer(mail).compile().build();
      const boxes = await c.list();
      const drafts = boxes.find((b) => b.specialUse === '\\Drafts')?.path || '[Gmail]/Drafts';
      await c.append(drafts, raw, ['\\Draft']);
    });
    res.json({ ok: true });
  } catch (e) { mailError(res, e); }
});

app.post('/api/mail/send', limit(10), mailJson, async (req, res) => {
  try {
    if (req.body?.confirm !== true) { const e = new Error('Sending needs confirmation.'); e.status = 400; throw e; }
    const { user, pass } = creds(req.body);
    const mail = buildMail(user, req.body);
    const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass }, connectionTimeout: 20000 });
    await t.sendMail(mail);
    res.json({ ok: true });
  } catch (e) { mailError(res, e); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: { message: 'Not found' } }));

// ---------- static SPA ----------
const distPath = path.resolve('dist');
const distIndex = path.join(distPath, 'index.html');

// Fallback: If dist/index.html is missing at runtime, build it automatically
if (!fs.existsSync(distIndex)) {
  console.log('[Server] dist/index.html not found. Running vite build...');
  try {
    const { execSync } = await import('node:child_process');
    execSync('npx vite build', { stdio: 'inherit' });
  } catch (err) {
    console.error('[Server] Automatic build error:', err);
  }
}

const root = fs.existsSync(distIndex) ? distPath : path.resolve('.');
app.use(express.static(root, { index: 'index.html' }));
app.use((_req, res) => {
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.sendFile(path.resolve(root, 'index.html'));
});

process.on('unhandledRejection', () => {});
app.listen(process.env.PORT || 3000);
