const FAILURE_PLACEHOLDER = '[翻译失败]';
const ARRAY_CONTAINER_KEYS = ['translations', 'results', 'data', 'items'];
const TEXT_VALUE_KEYS = [
  'translatedText',
  'translation',
  'text',
  'content',
  'result',
  'output',
  'response',
  'message',
  '中文文本',
  '译文',
  '翻译',
  'targetText',
  'target',
  'dst',
];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stripResponseArtifacts(text) {
  const stopPatterns = ['<|endoftext|>', '<|im_start|>', '<|im_end|>'];
  let cleaned = text;
  for (const pat of stopPatterns) {
    const idx = cleaned.indexOf(pat);
    if (idx !== -1) cleaned = cleaned.substring(0, idx);
  }

  return cleaned
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^```(?:json)?\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .trim();
}

function extractTextValue(value, depth = 0) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (!isObject(value) || depth > 2) {
    return null;
  }

  for (const key of TEXT_VALUE_KEYS) {
    const candidate = extractTextValue(value[key], depth + 1);
    if (candidate) {
      return candidate;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const candidate = extractTextValue(nestedValue, depth + 1);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function splitStructuredTranslationBlock(text, count) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const numberedLines = lines
    .map((line) => line.match(/^\d+[.。、:：]\s*(.+)$/)?.[1]?.trim() ?? null)
    .filter(Boolean);

  if (numberedLines.length >= count) {
    return numberedLines.slice(0, count);
  }

  const contentLines = lines.filter((line) => !/^【.*】$/.test(line));
  if (contentLines.length >= count) {
    return contentLines.slice(0, count);
  }

  return null;
}

export function normalizeTranslationItems(values, count) {
  if (!Array.isArray(values)) {
    return Array(count).fill(FAILURE_PLACEHOLDER);
  }

  if (values.length === 1 && count > 1) {
    const extracted = extractTextValue(values[0]);
    if (extracted) {
      const expanded = splitStructuredTranslationBlock(extracted, count);
      if (expanded) {
        return expanded;
      }
    }
  }

  return Array.from({ length: count }, (_, index) => {
    const candidate = values[index];
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      return trimmed === '' ? FAILURE_PLACEHOLDER : trimmed;
    }

    if (typeof candidate === 'number' || typeof candidate === 'boolean') {
      return String(candidate);
    }

    const extracted = extractTextValue(candidate);
    return extracted ?? FAILURE_PLACEHOLDER;
  });
}

function extractTranslationsPayload(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (isObject(parsed)) {
    for (const key of ARRAY_CONTAINER_KEYS) {
      if (Array.isArray(parsed[key])) {
        return parsed[key];
      }
    }

    const singleValue = extractTextValue(parsed);
    if (singleValue) {
      return [singleValue];
    }
  }

  return null;
}

export function parseTranslationResponse(text, count) {
  const cleaned = stripResponseArtifacts(text);

  try {
    const normalized = normalizeTranslationItems(extractTranslationsPayload(JSON.parse(cleaned)), count);
    if (normalized.some((item) => item !== FAILURE_PLACEHOLDER)) {
      return normalized;
    }
  } catch {
    // fall through to tolerant parsing
  }

  const embeddedArrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (embeddedArrayMatch) {
    try {
      const normalized = normalizeTranslationItems(extractTranslationsPayload(JSON.parse(embeddedArrayMatch[0])), count);
      if (normalized.some((item) => item !== FAILURE_PLACEHOLDER)) {
        return normalized;
      }
    } catch {
      // keep falling back
    }
  }

  const lines = cleaned
    .split('\n')
    .map((line) => line.replace(/^\d+[.。、:：]\s*/, '').trim())
    .filter(Boolean);

  if (lines.length >= count) {
    return lines.slice(0, count);
  }

  return Array(count).fill(FAILURE_PLACEHOLDER);
}

export function isFailureTranslation(text) {
  return !text || text === FAILURE_PLACEHOLDER;
}
