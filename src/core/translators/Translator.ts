/**
 * 翻译器抽象接口
 */
export interface Translator {
  /**
   * 翻译文本
   * @param text 要翻译的文本
   * @param sourceLang 源语言代码（如：en, zh, ja）
   * @param targetLang 目标语言代码（如：zh, en, ja）
   * @param options 可选。context: 上下文内容，用于上下文翻译模式
   * @returns 翻译后的文本
   */
  translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: { context?: string }
  ): Promise<string>;

  /**
   * 批量翻译文本
   * @param texts 要翻译的文本数组
   * @param sourceLang 源语言代码
   * @param targetLang 目标语言代码
   * @returns 翻译后的文本数组
   */
  translateBatch?(texts: string[], sourceLang: string, targetLang: string): Promise<string[]>;

  /**
   * 获取翻译器名称
   */
  getName(): string;
}
