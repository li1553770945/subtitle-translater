import { SubtitleData, SubtitleEntry } from '@/types/subtitle';

/**
 * 字幕生成器抽象类
 */
export abstract class SubtitleGenerator {
  /**
   * 生成字幕文件内容
   * @param data 字幕数据
   * @returns 生成的文件内容字符串
   */
  abstract generate(data: SubtitleData): string;

  /**
   * 获取支持的文件扩展名
   */
  abstract getExtension(): string;
}
