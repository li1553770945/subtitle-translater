import { SubtitleParser } from './parsers/SubtitleParser';
import { Translator } from './translators/Translator';
import { SubtitleGenerator } from './generators/SubtitleGenerator';
import { SubtitleData, SubtitleEntry } from '@/types/subtitle';
import { SRTParser } from './parsers/SRTParser';
import { SRTGenerator } from './generators/SRTGenerator';

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
   */
  async translateSubtitle(
    data: SubtitleData,
    sourceLang: string,
    targetLang: string
  ): Promise<SubtitleData> {
    if (!this.translator) {
      throw new Error('未设置翻译器');
    }

    // 提取所有需要翻译的文本
    const texts = data.entries.map(entry => entry.text);
    
    // 批量翻译（如果支持）或逐个翻译
    let translatedTexts: string[];
    if (this.translator.translateBatch) {
      translatedTexts = await this.translator.translateBatch(texts, sourceLang, targetLang);
    } else {
      translatedTexts = [];
      for (const text of texts) {
        const translated = await this.translator.translate(text, sourceLang, targetLang);
        translatedTexts.push(translated);
      }
    }

    // 创建翻译后的字幕数据
    const translatedEntries: SubtitleEntry[] = data.entries.map((entry, index) => ({
      ...entry,
      text: translatedTexts[index] || entry.text,
    }));

    return {
      entries: translatedEntries,
      format: data.format,
    };
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
    outputFormat?: string
  ): Promise<string> {
    // 1. 解析
    const parsed = await this.parseSubtitle(content, filename);
    
    // 2. 翻译
    const translated = await this.translateSubtitle(parsed, sourceLang, targetLang);
    
    // 3. 生成
    const generated = this.generateSubtitle(translated, outputFormat);
    
    return generated;
  }
}
