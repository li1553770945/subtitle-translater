import { Translator } from './Translator';

/**
 * 模拟翻译器（用于测试）
 * 实际使用时可以替换为真实的翻译API
 */
export class MockTranslator implements Translator {
  getName(): string {
    return 'Mock Translator';
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 返回模拟翻译结果
    return `[${sourceLang}->${targetLang}] ${text}`;
  }

  async translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
    // 模拟批量翻译
    return Promise.all(texts.map(text => this.translate(text, sourceLang, targetLang)));
  }
}
