export function parseTranslationResponse(text: string, count: number): string[] {
  try {
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, count).map(String);
    }
  } catch {
    // fall through to tolerant parsing
  }

  const embeddedArrayMatch = text.match(/\[[\s\S]*\]/);
  if (embeddedArrayMatch) {
    try {
      const parsed = JSON.parse(embeddedArrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count).map(String);
      }
    } catch {
      // keep falling back
    }
  }

  const lines = text
    .split('\n')
    .map((line) => line.replace(/^\d+[.。、:：]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length >= count) {
    return lines.slice(0, count);
  }

  return Array(count).fill('[翻译失败]');
}
