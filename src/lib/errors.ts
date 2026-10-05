export function extractErrorMessage(bodyText: string): string {
  if (!bodyText) return '';
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed.error) {
      if (typeof parsed.error === 'string') return parsed.error;
      if (parsed.error.message) return String(parsed.error.message);
      if (parsed.error.status) return String(parsed.error.status);
    }
    if (parsed.message) return String(parsed.message);
  } catch {
    // Not JSON, return text slice
  }
  return bodyText.slice(0, 300);
}

export function friendlyError(
  provider: string,
  status?: number,
  bodyText = '',
  err?: unknown,
  modelId?: string
): string {
  // Check for AbortError
  if (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err as any)?.name === 'AbortError'
  ) {
    return '';
  }

  const rawMsg = extractErrorMessage(bodyText);
  const combined = `${rawMsg} ${(err as any)?.message || ''}`.toLowerCase();

  // Network / TypeError
  if (
    err instanceof TypeError ||
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('could not reach')
  ) {
    return `Your browser couldn't reach ${provider}. This happens in some previews; it works after deploying with server.mjs (see README). Also check your internet connection.`;
  }

  // 401 or 403 with key/permission/API_KEY_INVALID
  if (
    status === 401 ||
    (status === 403 &&
      (combined.includes('key') ||
        combined.includes('permission') ||
        combined.includes('api_key_invalid') ||
        combined.includes('unauthorized') ||
        combined.includes('authentication')))
  ) {
    return `${provider} rejected the key. Check it in Keys.`;
  }

  // 403 other
  if (status === 403) {
    return `${provider} refused access to this model. Your account may not have access to it.`;
  }

  // 404 or model not found
  if (
    status === 404 ||
    (combined.includes('model') &&
      (combined.includes('not found') || combined.includes('does not exist')))
  ) {
    const id = modelId ? `'${modelId}'` : 'chosen';
    return `Model ${id} isn't available for your key. Choose another model.`;
  }

  // 429 quota/billing/credit/insufficient
  if (
    status === 429 &&
    (combined.includes('quota') ||
      combined.includes('billing') ||
      combined.includes('credit') ||
      combined.includes('insufficient'))
  ) {
    return `Your ${provider} account is out of credits or over quota.`;
  }

  // 402 or credit balance
  if (status === 402 || combined.includes('credit balance')) {
    return `Your ${provider} account is out of credits.`;
  }

  // 429 other
  if (status === 429) {
    return `${provider} is rate limiting. Wait a moment and retry.`;
  }

  // 400 context/too long/token limit/maximum
  if (
    status === 400 &&
    (combined.includes('context') ||
      combined.includes('too long') ||
      (combined.includes('token') &&
        (combined.includes('limit') || combined.includes('maximum'))))
  ) {
    return `This conversation is too long for this model. Start a new chat or choose a model with a larger context.`;
  }

  // 413
  if (status === 413) {
    return `The request is too large. Remove some images or documents.`;
  }

  // 400 other
  if (status === 400) {
    const detail = rawMsg ? rawMsg.slice(0, 200) : 'Invalid request';
    return `${provider} rejected the request: ${detail}`;
  }

  // 500-599 or Anthropic overloaded_error
  if (
    (status && status >= 500 && status <= 599) ||
    combined.includes('overloaded_error')
  ) {
    return `${provider} is having problems right now. Retry in a moment.`;
  }

  // Empty response with no error
  if (combined.includes('empty response') || combined.includes('empty_response')) {
    return `The model returned an empty response. Try again or choose another model.`;
  }

  if (rawMsg) {
    return `${provider} error: ${rawMsg.slice(0, 200)}`;
  }

  if ((err as any)?.message) {
    return (err as any).message;
  }

  return `${provider} failed to respond. Check your connection or retry in a moment.`;
}
