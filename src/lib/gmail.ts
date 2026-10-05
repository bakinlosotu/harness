export interface MailListItem {
  uid: number;
  subject: string;
  from: { name: string; address: string } | null;
  date: string;
  unread: boolean;
}

export interface MailListResponse {
  items: MailListItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface MailMessageResponse {
  uid: number;
  subject: string;
  from: { name: string; address: string } | null;
  replyTo: { name: string; address: string } | null;
  date: string;
  messageId: string;
  references: string[];
  text: string;
  attachments: string[];
}

export interface MailCredentials {
  user: string;
  pass: string;
}

async function callGmailApi<T>(endpoint: string, body: Record<string, any>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.status === 404) {
      throw new Error('Gmail needs the deployed server. Use Paste email in preview.');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.error?.message) {
        const err = new Error(data.error.message) as any;
        err.status = res.status;
        throw err;
      }
      throw new Error(`Gmail error (${res.status})`);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new Error('Gmail took too long to respond.');
    }
    if (err?.message?.includes('Failed to fetch') || err?.name === 'TypeError') {
      throw new Error('Gmail needs the deployed server. Use Paste email in preview.');
    }
    throw err;
  }
}

export async function testGmailConnection(creds: MailCredentials): Promise<boolean> {
  const res = await callGmailApi<{ ok: boolean }>('/api/mail/test', creds);
  return res.ok;
}

export async function fetchMailList(
  creds: MailCredentials,
  page = 0,
  query = ''
): Promise<MailListResponse> {
  return await callGmailApi<MailListResponse>('/api/mail/list', {
    ...creds,
    page,
    query,
  });
}

export async function fetchMailMessage(
  creds: MailCredentials,
  uid: number
): Promise<MailMessageResponse> {
  return await callGmailApi<MailMessageResponse>('/api/mail/message', {
    ...creds,
    uid,
  });
}

export async function saveMailDraft(
  creds: MailCredentials,
  draft: {
    to: string;
    subject: string;
    text: string;
    inReplyTo?: string;
    references?: string[];
  }
): Promise<boolean> {
  const res = await callGmailApi<{ ok: boolean }>('/api/mail/draft', {
    ...creds,
    ...draft,
  });
  return res.ok;
}

export async function sendMail(
  creds: MailCredentials,
  mail: {
    to: string;
    subject: string;
    text: string;
    inReplyTo?: string;
    references?: string[];
  }
): Promise<boolean> {
  const res = await callGmailApi<{ ok: boolean }>('/api/mail/send', {
    ...creds,
    ...mail,
    confirm: true,
  });
  return res.ok;
}
