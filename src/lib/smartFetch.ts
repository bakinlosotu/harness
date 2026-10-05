const hostsNeedingProxy = new Set<string>();

export async function smartFetch(
  url: string,
  init?: RequestInit,
  providerName = 'the provider'
): Promise<Response> {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const isAborted = () => init?.signal?.aborted;

  const fallbackMsg = `Your browser couldn't reach ${providerName}. This happens in some previews; it works after deploying with server.mjs (see README). Also check your internet connection.`;

  // If we already know this host needs proxy for this session, go straight to proxy
  if (hostsNeedingProxy.has(host)) {
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, init);
      if (res.status === 404 || res.status === 502) {
        throw new Error(fallbackMsg);
      }
      return res;
    } catch (e: any) {
      if (isAborted()) throw e;
      throw new Error(fallbackMsg);
    }
  }

  // Otherwise, try direct fetch first
  try {
    return await fetch(url, init);
  } catch (err: any) {
    if (isAborted()) {
      throw err;
    }

    // Network / CORS TypeError
    if (err instanceof TypeError || err.name === 'TypeError') {
      try {
        hostsNeedingProxy.add(host);
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, init);
        if (res.status === 404 || res.status === 502) {
          throw new Error(fallbackMsg);
        }
        return res;
      } catch (proxyErr: any) {
        if (isAborted()) throw proxyErr;
        throw new Error(fallbackMsg);
      }
    }

    throw err;
  }
}
