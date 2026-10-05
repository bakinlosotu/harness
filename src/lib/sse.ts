export async function readSSE(
  response: Response,
  onEvent: (data: any, eventType?: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Normalize CRLF to LF
      buffer = buffer.replace(/\r\n/g, '\n');

      const parts = buffer.split('\n\n');
      // All parts except the last one are complete blocks
      buffer = parts.pop() || '';

      for (const block of parts) {
        if (!block.trim()) continue;

        const lines = block.split('\n');
        let eventType = '';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith(':')) {
            // Comment, skip
            continue;
          }
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
          }
        }

        if (dataLines.length === 0) continue;

        const combinedData = dataLines.join('\n');
        if (combinedData.trim() === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(combinedData);
          onEvent(parsed, eventType);
        } catch {
          // Skip unparsable payloads per spec
        }
      }
    }

    // Flush any remaining complete events in buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      let eventType = '';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length > 0) {
        const combinedData = dataLines.join('\n');
        if (combinedData.trim() !== '[DONE]') {
          try {
            const parsed = JSON.parse(combinedData);
            onEvent(parsed, eventType);
          } catch {
            // Skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
