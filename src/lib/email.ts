export function extractEmailAddress(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim();
  }
  const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    return emailMatch[0].trim();
  }
  return raw.trim();
}

export function normalizeReSubject(subject: string): string {
  if (!subject) return 'Re: ';
  let clean = subject.trim();
  if (/^re:\s*/i.test(clean)) {
    return clean;
  }
  return `Re: ${clean}`;
}

export function parsePastedEmailHeaders(text: string): {
  from?: string;
  subject?: string;
  replyTo?: string;
  body: string;
} {
  const lines = text.split('\n');
  let from = '';
  let subject = '';
  let replyTo = '';

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i];
    const fromMatch = line.match(/^from:\s*(.+)$/i);
    if (fromMatch && !from) {
      from = extractEmailAddress(fromMatch[1]);
    }
    const replyToMatch = line.match(/^reply-to:\s*(.+)$/i);
    if (replyToMatch && !replyTo) {
      replyTo = extractEmailAddress(replyToMatch[1]);
    }
    const subjMatch = line.match(/^subject:\s*(.+)$/i);
    if (subjMatch && !subject) {
      subject = subjMatch[1].trim();
    }
  }

  return {
    from,
    replyTo: replyTo || from,
    subject: subject ? normalizeReSubject(subject) : '',
    body: text,
  };
}

export function parseEmlFile(rawText: string): {
  from: string;
  replyTo: string;
  subject: string;
  body: string;
} {
  // Simple RFC 822 parser
  const headerEnd = rawText.search(/\r?\n\r?\n/);
  if (headerEnd === -1) {
    const parsed = parsePastedEmailHeaders(rawText);
    return {
      from: parsed.from || '',
      replyTo: parsed.replyTo || '',
      subject: parsed.subject || '',
      body: rawText,
    };
  }

  const headerBlock = rawText.slice(0, headerEnd);
  let bodyBlock = rawText.slice(headerEnd).trim();

  // Unfold headers
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, ' ');
  const headerLines = unfolded.split(/\r?\n/);

  let from = '';
  let replyTo = '';
  let subject = '';
  let transferEncoding = '';
  let contentType = '';

  for (const line of headerLines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const name = match[1].toLowerCase();
      const val = match[2].trim();
      if (name === 'from' && !from) from = extractEmailAddress(val);
      if (name === 'reply-to' && !replyTo) replyTo = extractEmailAddress(val);
      if (name === 'subject' && !subject) subject = val;
      if (name === 'content-transfer-encoding') transferEncoding = val.toLowerCase();
      if (name === 'content-type') contentType = val.toLowerCase();
    }
  }

  // Handle basic encodings if single part
  try {
    if (transferEncoding.includes('base64')) {
      const cleanB64 = bodyBlock.replace(/\s+/g, '');
      bodyBlock = atob(cleanB64);
    } else if (transferEncoding.includes('quoted-printable')) {
      bodyBlock = bodyBlock
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }
  } catch {
    // Fall back to raw text
  }

  // If html, strip tags
  if (contentType.includes('text/html') || bodyBlock.includes('<html')) {
    bodyBlock = bodyBlock
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+\n/g, '\n');
  }

  return {
    from,
    replyTo: replyTo || from,
    subject: subject ? normalizeReSubject(subject) : '',
    body: bodyBlock.trim(),
  };
}

export function buildGmailComposeUrl(to: string, subject: string, body: string): { url: string; truncated: boolean } {
  const encTo = encodeURIComponent(to);
  const encSubject = encodeURIComponent(subject);
  const encBody = encodeURIComponent(body);

  const fullUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encTo}&su=${encSubject}&body=${encBody}`;

  if (fullUrl.length <= 1800) {
    return { url: fullUrl, truncated: false };
  }

  const shortUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encTo}&su=${encSubject}`;
  return { url: shortUrl, truncated: true };
}
