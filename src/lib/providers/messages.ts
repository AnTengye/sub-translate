export function buildTranslationMessages(texts: string[], contextTexts: string[]) {
  const system = `你是专业的日语字幕翻译员，将日语字幕精准翻译成简体中文。
规则：保持自然流畅的中文表达；字幕简洁不冗长；人名、专有名词前后一致。
必须严格返回JSON数组格式，如：["翻译1","翻译2"]，不含任何说明或代码块。`;

  const contextBlock =
    contextTexts.length > 0
      ? `\n【前文参考（勿重复翻译，仅用于保持人名、剧情连贯）】\n${contextTexts
          .map((text, index) => `${index + 1}. ${text}`)
          .join('\n')}\n`
      : '';

  return {
    system,
    user: `${contextBlock}\n【待翻译字幕】\n${texts
      .map((text, index) => `${index + 1}. ${text}`)
      .join('\n')}\n\n以JSON数组返回翻译结果：`,
  };
}
