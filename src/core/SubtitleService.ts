import { SubtitleParser } from './parsers/SubtitleParser';
import { Translator } from './translators/Translator';
import { SubtitleGenerator } from './generators/SubtitleGenerator';
import { SubtitleData, SubtitleEntry } from '@/types/subtitle';
import { SRTParser } from './parsers/SRTParser';
import { SRTGenerator } from './generators/SRTGenerator';
import { TranslationOptions } from '@/types/settings';

/**
 * 字幕翻译服务
 * 协调解析、翻译和生成流程
 */
export class SubtitleService {
  private parsers: SubtitleParser[] = [];
  private generators: SubtitleGenerator[] = [];
  private translator: Translator | null = null;

  constructor() {
    // 注册默认解析器和生成器
    this.registerParser(new SRTParser());
    this.registerGenerator(new SRTGenerator());
  }

  /**
   * 注册字幕解析器
   */
  registerParser(parser: SubtitleParser): void {
    this.parsers.push(parser);
  }

  /**
   * 注册字幕生成器
   */
  registerGenerator(generator: SubtitleGenerator): void {
    this.generators.push(generator);
  }

  /**
   * 设置翻译器
   */
  setTranslator(translator: Translator): void {
    this.translator = translator;
  }

  /**
   * 根据文件名查找合适的解析器
   */
  private findParser(filename: string): SubtitleParser | null {
    return this.parsers.find(p => p.canParse(filename)) || null;
  }

  /**
   * 根据格式查找合适的生成器
   */
  private findGenerator(format: string): SubtitleGenerator | null {
    return this.generators.find(g => g.getExtension().slice(1) === format) || null;
  }

  /**
   * 解析字幕文件
   */
  async parseSubtitle(content: string, filename: string): Promise<SubtitleData> {
    const parser = this.findParser(filename);
    if (!parser) {
      throw new Error(`不支持的文件格式: ${filename}`);
    }
    return parser.parse(content);
  }

  /**
   * 翻译字幕
   * @param options 翻译选项：单行/多行模式、上下文行数等
   */
  async translateSubtitle(
    data: SubtitleData,
    sourceLang: string,
    targetLang: string,
    options: TranslationOptions = {
      mode: 'single',
      multiLineBatchSize: 3,
      contextLines: 0,
    }
  ): Promise<SubtitleData> {
    if (!this.translator) {
      throw new Error('未设置翻译器');
    }

    const { mode, multiLineBatchSize, contextLines, onProgress, abortSignal } = options;
    const entries = data.entries;
    const texts = entries.map((e) => e.text);

    // 检查是否已取消
    if (abortSignal?.aborted) {
      throw new Error('翻译已取消');
    }

    // 创建包装的进度回调，用于传递已翻译的条目
    const wrappedProgress = onProgress
      ? (progress: {
          percent: number;
          completed: number;
          total: number;
          currentIndex?: number;
          translatedTexts?: string[];
        }) => {
          if (progress.translatedTexts) {
            // 构建已翻译的条目数组
            const translatedEntries: SubtitleEntry[] = entries
              .slice(0, progress.completed)
              .map((entry, index) => ({
                ...entry,
                text: progress.translatedTexts![index]?.trim() || entry.text,
              }));
            onProgress({
              ...progress,
              translatedEntries,
            });
          } else {
            onProgress(progress);
          }
        }
      : undefined;

    let translatedTexts: string[];

    if (mode === 'multi') {
      // 多行模式：按 batchSize 合并翻译
      translatedTexts = await this.translateMultiLine(
        texts,
        sourceLang,
        targetLang,
        multiLineBatchSize,
        wrappedProgress,
        abortSignal
      );
    } else {
      // 单行模式：逐条翻译，可选上下文
      translatedTexts = await this.translateSingleLine(
        texts,
        sourceLang,
        targetLang,
        contextLines,
        wrappedProgress,
        abortSignal
      );
    }

    const translatedEntries: SubtitleEntry[] = entries.map((entry, index) => ({
      ...entry,
      text: translatedTexts[index]?.trim() || entry.text,
    }));

    return {
      entries: translatedEntries,
      format: data.format,
    };
  }

  /**
   * 单行模式：逐条翻译，可选带上下文
   * 有上下文时，将构建的 context 通过 options 传入，由 LLMTranslator 用 contextPrompt 解析后插入主 prompt 的 {context_prompt}
   */
  private async translateSingleLine(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    contextLines: number,
    onProgress?: (progress: { percent: number; completed: number; total: number; currentIndex?: number; translatedTexts?: string[] }) => void,
    abortSignal?: { aborted: boolean }
  ): Promise<string[]> {
    if (!this.translator) throw new Error('未设置翻译器');

    const results: string[] = [];
    const total = texts.length;

    for (let i = 0; i < texts.length; i++) {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('翻译已取消');
      }

      const targetText = texts[i];
      let options: { context?: string } | undefined;

      if (contextLines > 0) {
        const before = texts.slice(Math.max(0, i - contextLines), i);
        const after = texts.slice(i + 1, Math.min(texts.length, i + 1 + contextLines));
        const parts: string[] = [];
        if (before.length > 0) {
          parts.push('上文：\n' + before.join('\n'));
        }
        parts.push('【目标句】\n' + targetText);
        if (after.length > 0) {
          parts.push('下文：\n' + after.join('\n'));
        }
        options = { context: parts.join('\n\n') };
      }

      const translated = await this.translator.translate(
        targetText,
        sourceLang,
        targetLang,
        options
      );
      results.push(translated);

      // 更新进度，包含已翻译的文本数组
      if (onProgress) {
        const completed = i + 1;
        const percent = Math.round((completed / total) * 100);
        onProgress({
          percent,
          completed,
          total,
          currentIndex: i,
          translatedTexts: [...results], // 传递已翻译的文本数组
        });
      }
    }

    return results;
  }

  /** 多行模式中要求模型使用的分隔符 */
  private static readonly MULTI_LINE_SEP = '|||';

  /**
   * 多行模式：按 batchSize 合并成一段翻译，再拆分
   */
  private async translateMultiLine(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    batchSize: number,
    onProgress?: (progress: { percent: number; completed: number; total: number; currentIndex?: number; translatedTexts?: string[] }) => void,
    abortSignal?: { aborted: boolean }
  ): Promise<string[]> {
    if (!this.translator) throw new Error('未设置翻译器');

    const results: string[] = new Array(texts.length);
    const clampedSize = Math.max(2, Math.min(10, batchSize));
    const sep = SubtitleService.MULTI_LINE_SEP;
    const total = texts.length;
    const totalBatches = Math.ceil(total / clampedSize);

    for (let start = 0; start < texts.length; start += clampedSize) {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('翻译已取消');
      }

      const end = Math.min(start + clampedSize, texts.length);
      const batch = texts.slice(start, end);
      const merged = batch.join(`\n${sep}\n`);
      const instruction =
        `请将以下 ${batch.length} 段字幕分别翻译成目标语言。` +
        `严格使用 "${sep}" 分隔每一段的翻译结果，共应输出 ${batch.length} 段，顺序与输入一致。` +
        `仅输出翻译内容，不要编号或说明。`;
      const content = instruction + '\n\n' + merged;

      const translated = await this.translator.translate(content, sourceLang, targetLang);
      const parts = translated.split(sep);

      for (let j = 0; j < batch.length; j++) {
        results[start + j] = parts[j]?.trim() ?? batch[j];
      }

      // 更新进度（基于批次），包含已翻译的文本数组
      if (onProgress) {
        const completed = Math.min(end, total);
        const percent = Math.round((completed / total) * 100);
        // 构建已翻译的文本数组（只包含已完成的，保持顺序）
        const translatedTexts: string[] = [];
        for (let k = 0; k < completed; k++) {
          if (results[k] !== undefined) {
            translatedTexts.push(results[k]);
          }
        }
        onProgress({
          percent,
          completed,
          total,
          currentIndex: end - 1,
          translatedTexts,
        });
      }
    }

    return results;
  }

  /**
   * 生成字幕文件
   */
  generateSubtitle(data: SubtitleData, format?: string): string {
    const targetFormat = format || data.format;
    const generator = this.findGenerator(targetFormat);
    
    if (!generator) {
      throw new Error(`不支持生成格式: ${targetFormat}`);
    }

    return generator.generate(data);
  }

  /**
   * 完整流程：解析 -> 翻译 -> 生成
   */
  async processSubtitle(
    content: string,
    filename: string,
    sourceLang: string,
    targetLang: string,
    outputFormat?: string,
    translationOptions?: TranslationOptions
  ): Promise<string> {
    // 1. 解析
    const parsed = await this.parseSubtitle(content, filename);

    // 2. 翻译
    const translated = await this.translateSubtitle(
      parsed,
      sourceLang,
      targetLang,
      translationOptions ?? {
        mode: 'single',
        multiLineBatchSize: 3,
        contextLines: 0,
      }
    );

    // 3. 生成
    const generated = this.generateSubtitle(translated, outputFormat);

    return generated;
  }
}
