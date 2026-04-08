import { Translator } from './Translator';
import { TranslationProvider, ProcessMode } from '@/types/settings';

/**
 * LLM翻译器配置
 */
export interface LLMTranslatorConfig {
  provider: TranslationProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  prompt: string;
  /** 上下文 Prompt，使用 {context} 占位符。有上下文时会解析后插入主 prompt 的 {context_prompt} */
  contextPrompt?: string;
  /** 连贯模式主 Prompt（用于连贯模式，不进行翻译）。使用 {content}、{custom_prompt}、{context_prompt} 作为占位符 */
  coherenceModePrompt?: string;
  /** 独立prompt（单次翻译专用），会替换主 prompt 中的 {custom_prompt} 占位符 */
  customPrompt?: string;
}

/**
 * 通用LLM翻译器
 * 支持DeepSeek、OpenAI、Google等供应商
 */
export class LLMTranslator implements Translator {
  private config: LLMTranslatorConfig;

  constructor(config: LLMTranslatorConfig) {
    this.config = config;
  }

  getName(): string {
    return `${this.config.provider} (${this.config.model})`;
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: { context?: string; enableContext?: boolean; processMode?: ProcessMode }
  ): Promise<string> {
    // 处理独立prompt（customPrompt），如果设置了则使用，否则替换为空字符串
    const customPromptResolved = this.config.customPrompt?.trim() || '';

    // 确定使用哪个主Prompt：连贯模式使用coherenceModePrompt，否则使用普通prompt
    const isCoherenceMode = options?.processMode === 'coherence';
    const basePrompt = isCoherenceMode 
      ? (this.config.coherenceModePrompt || this.config.prompt)
      : this.config.prompt;

    // 只有当enableContext为true时才使用contextPrompt
    let contextPromptResolved = '';
    if (options?.enableContext && options?.context && this.config.contextPrompt) {
      contextPromptResolved = this.config.contextPrompt.replace('{context}', options.context);
    }

    let prompt = basePrompt
      .replace(/\{custom_prompt\}/g, customPromptResolved)
      .replace(/\{context_prompt\}/g, contextPromptResolved)
      .replace(/\{content\}/g, text);

    // 如果不是连贯模式，替换语言占位符
    if (!isCoherenceMode) {
      prompt = prompt
        .replace(/\{sourceLang\}/g, sourceLang)
        .replace(/\{targetLang\}/g, targetLang);
    }

    try {
      const response = await this.callAPI(prompt);
      return response;
    } catch (error) {
      console.error('翻译API调用失败:', error);
      throw new Error(`翻译失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  async translateBatch(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
    // 对于批量翻译，可以并行调用或使用批量API
    return Promise.all(texts.map(text => this.translate(text, sourceLang, targetLang)));
  }

  private async callAPI(prompt: string): Promise<string> {
    const { provider, model, apiKey, baseUrl } = this.config;
    
    // 根据不同的供应商调用不同的API
    switch (provider) {
      case 'deepseek':
        return this.callDeepSeekAPI(prompt, model, apiKey, baseUrl);
      case 'openai':
        return this.callOpenAIAPI(prompt, model, apiKey, baseUrl);
      case 'google':
        return this.callGoogleAPI(prompt, model, apiKey, baseUrl);
      default:
        throw new Error(`不支持的供应商: ${provider}`);
    }
  }

  private async callDeepSeekAPI(prompt: string, model: string, apiKey: string, baseUrl?: string): Promise<string> {
    const url = `${baseUrl || 'https://api.deepseek.com'}/v1/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callOpenAIAPI(prompt: string, model: string, apiKey: string, baseUrl?: string): Promise<string> {
    const url = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callGoogleAPI(prompt: string, model: string, apiKey: string, baseUrl?: string): Promise<string> {
    // Google Gemini API
    // 如果提供了baseUrl，使用它；否则使用默认的Gemini API地址
    const apiBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com';
    const url = `${apiBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API错误: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  }
}
