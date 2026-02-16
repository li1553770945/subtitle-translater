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
      enableContext: false,
      enableCoherence: false,
    }
  ): Promise<SubtitleData> {
    if (!this.translator) {
      throw new Error('未设置翻译器');
    }

    const { mode, multiLineBatchSize, contextLines, enableContext, enableCoherence, parallelCount, onProgress, abortSignal } = options;
    const entries = data.entries;
    const texts = entries.map((e) => e.text);

    // 检查是否已取消
    if (abortSignal?.aborted) {
      throw new Error('翻译已取消');
    }

    // 创建包装的进度回调，用于传递已翻译的条目（包括占位符）
    const wrappedProgress = onProgress
      ? (progress: {
          percent: number;
          completed: number;
          total: number;
          currentIndex?: number;
          translatedTexts?: string[];
        }) => {
          if (progress.translatedTexts) {
            // 构建已翻译的条目数组，按索引顺序，未翻译的用占位符
            const translatedEntries: SubtitleEntry[] = entries.map((entry, index) => {
              const translatedText = progress.translatedTexts![index];
              // 如果该索引有翻译结果，使用翻译结果；否则使用占位符
              const text = translatedText !== undefined && translatedText !== null && translatedText.trim() !== ''
                ? translatedText.trim()
                : '[翻译中...]'; // 占位符
              return {
                ...entry,
                text,
              };
            });
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
      // 单行模式：逐条翻译，可选上下文和连贯模式，支持并行
      translatedTexts = await this.translateSingleLine(
        texts,
        sourceLang,
        targetLang,
        contextLines,
        enableContext,
        enableCoherence,
        parallelCount,
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
   * 单行模式：逐条翻译，可选带上下文和连贯模式，支持并行翻译
   * enableContext: 是否使用翻译上下文（通过contextPrompt插入）
   * enableCoherence: 是否使用连贯模式（通过coherencePrompt插入）
   * 两者可以独立控制，但都会使用相同的上下文数据（如果contextLines > 0）
   * parallelCount: 并行翻译数量（2-10），如果未指定或为1，则串行翻译
   */
  private async translateSingleLine(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    contextLines: number,
    enableContext: boolean = false,
    enableCoherence: boolean = false,
    parallelCount?: number,
    onProgress?: (progress: { percent: number; completed: number; total: number; currentIndex?: number; translatedTexts?: string[] }) => void,
    abortSignal?: { aborted: boolean }
  ): Promise<string[]> {
    if (!this.translator) throw new Error('未设置翻译器');

    const total = texts.length;
    const effectiveParallelCount = parallelCount && parallelCount > 1 ? Math.min(10, Math.max(2, parallelCount)) : 1;

    // 如果并行数量为1或未指定，使用串行翻译（保持原有逻辑）
    if (effectiveParallelCount === 1) {
      return this.translateSingleLineSerial(
        texts,
        sourceLang,
        targetLang,
        contextLines,
        enableContext,
        enableCoherence,
        onProgress,
        abortSignal
      );
    }

    // 并行翻译逻辑
    const results: (string | undefined)[] = new Array(total);
    const completedSet = new Set<number>();
    let completedCount = 0;
    let nextIndex = 0;

    // 创建一个函数来翻译单个条目
    const translateOne = async (index: number): Promise<void> => {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('翻译已取消');
      }

      const targetText = texts[index];
      let options: { context?: string; enableContext?: boolean; enableCoherence?: boolean } | undefined;

      // 连贯模式需要上下文，如果未设置上下文行数，自动使用至少1行上下文
      const effectiveContextLines = enableCoherence ? Math.max(contextLines, 1) : contextLines;

      if (effectiveContextLines > 0) {
        const before = texts.slice(Math.max(0, index - effectiveContextLines), index);
        const after = texts.slice(index + 1, Math.min(texts.length, index + 1 + effectiveContextLines));
        const parts: string[] = [];
        if (before.length > 0) {
          parts.push('上文：\n' + before.join('\n'));
        }
        parts.push('【目标句】\n' + targetText);
        if (after.length > 0) {
          parts.push('下文：\n' + after.join('\n'));
        }
        options = { 
          context: parts.join('\n\n'),
          enableContext: enableContext || undefined,
          enableCoherence: enableCoherence || undefined
        };
      } else if (enableCoherence) {
        // 即使没有上下文，也传递连贯模式标志（虽然效果可能有限）
        options = { enableCoherence: true };
      } else if (enableContext) {
        // 如果启用了上下文但没有上下文行数，不传递context
        options = { enableContext: true };
      }

      try {
        const translated = await this.translator.translate(
          targetText,
          sourceLang,
          targetLang,
          options
        );
        
        // 检查是否已取消（翻译完成后）
        if (abortSignal?.aborted) {
          throw new Error('翻译已取消');
        }

        results[index] = translated;
        completedSet.add(index);
        completedCount++;

        // 更新进度，传递所有已完成的翻译（包括占位符）
        if (onProgress) {
          const percent = Math.round((completedCount / total) * 100);
          // 构建已翻译的文本数组，按索引顺序，未完成的为undefined（前端会用占位符）
          // 注意：数组必须包含所有索引，即使未完成的也要有undefined占位
          const translatedTexts: (string | undefined)[] = new Array(total);
          for (let i = 0; i < total; i++) {
            translatedTexts[i] = results[i]; // 已完成的会有值，未完成的为undefined
          }
          onProgress({
            percent,
            completed: completedCount,
            total,
            currentIndex: index,
            translatedTexts: translatedTexts as string[], // 类型转换，实际可能包含undefined
          });
        }
      } catch (error) {
        // 如果是因为取消导致的错误，重新抛出
        if (abortSignal?.aborted || (error instanceof Error && error.message === '翻译已取消')) {
          throw error;
        }
        // 其他错误，使用原文作为结果
        results[index] = targetText;
        completedSet.add(index);
        completedCount++;
        
        if (onProgress) {
          const percent = Math.round((completedCount / total) * 100);
          // 构建已翻译的文本数组，按索引顺序，未完成的为undefined（前端会用占位符）
          // 注意：数组必须包含所有索引，即使未完成的也要有undefined占位
          const translatedTexts: (string | undefined)[] = new Array(total);
          for (let i = 0; i < total; i++) {
            translatedTexts[i] = results[i]; // 已完成的会有值，未完成的为undefined
          }
          onProgress({
            percent,
            completed: completedCount,
            total,
            currentIndex: index,
            translatedTexts: translatedTexts as string[], // 类型转换，实际可能包含undefined
          });
        }
      }
    };

    // 启动并行翻译任务
    const activePromises: Map<number, Promise<void>> = new Map();

    // 启动初始批次
    while (activePromises.size < effectiveParallelCount && nextIndex < total) {
      const index = nextIndex++;
      activePromises.set(index, translateOne(index));
    }

    // 处理完成的任务并启动新任务
    while (activePromises.size > 0) {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        // 取消所有正在进行的任务
        activePromises.forEach(p => {
          p.catch(() => {
            // 忽略取消错误
          });
        });
        throw new Error('翻译已取消');
      }

      try {
        // 等待任意一个任务完成
        const racePromises = Array.from(activePromises.entries()).map(async ([index, promise]) => {
          await promise;
          return index;
        });
        
        const completedIndex = await Promise.race(racePromises);
        
        // 移除已完成的任务
        activePromises.delete(completedIndex);

        // 如果有更多任务，启动新的
        if (nextIndex < total && !abortSignal?.aborted) {
          const newIndex = nextIndex++;
          activePromises.set(newIndex, translateOne(newIndex));
        }
      } catch (error) {
        // 如果是取消错误，重新抛出
        if (error instanceof Error && error.message === '翻译已取消') {
          throw error;
        }
        // 其他错误，找到失败的任务并移除
        // 由于Promise.race会抛出第一个错误，我们需要找到是哪个任务失败了
        // 简化处理：移除第一个任务（实际应该更精确地追踪）
        const firstEntry = activePromises.entries().next().value;
        if (firstEntry) {
          activePromises.delete(firstEntry[0]);
        }
        // 如果有更多任务，启动新的
        if (nextIndex < total && !abortSignal?.aborted) {
          const newIndex = nextIndex++;
          activePromises.set(newIndex, translateOne(newIndex));
        }
      }
    }

    // 检查是否已取消
    if (abortSignal?.aborted) {
      throw new Error('翻译已取消');
    }

    // 返回结果数组，确保所有位置都有值
    return results.map((r, i) => r || texts[i]);
  }

  /**
   * 串行翻译（原有逻辑）
   */
  private async translateSingleLineSerial(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    contextLines: number,
    enableContext: boolean = false,
    enableCoherence: boolean = false,
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
      let options: { context?: string; enableContext?: boolean; enableCoherence?: boolean } | undefined;

      // 连贯模式需要上下文，如果未设置上下文行数，自动使用至少1行上下文
      const effectiveContextLines = enableCoherence ? Math.max(contextLines, 1) : contextLines;

      if (effectiveContextLines > 0) {
        const before = texts.slice(Math.max(0, i - effectiveContextLines), i);
        const after = texts.slice(i + 1, Math.min(texts.length, i + 1 + effectiveContextLines));
        const parts: string[] = [];
        if (before.length > 0) {
          parts.push('上文：\n' + before.join('\n'));
        }
        parts.push('【目标句】\n' + targetText);
        if (after.length > 0) {
          parts.push('下文：\n' + after.join('\n'));
        }
        options = { 
          context: parts.join('\n\n'),
          enableContext: enableContext || undefined,
          enableCoherence: enableCoherence || undefined
        };
      } else if (enableCoherence) {
        // 即使没有上下文，也传递连贯模式标志（虽然效果可能有限）
        options = { enableCoherence: true };
      } else if (enableContext) {
        // 如果启用了上下文但没有上下文行数，不传递context
        options = { enableContext: true };
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
        enableContext: false,
        enableCoherence: false,
      }
    );

    // 3. 生成
    const generated = this.generateSubtitle(translated, outputFormat);

    return generated;
  }
}
