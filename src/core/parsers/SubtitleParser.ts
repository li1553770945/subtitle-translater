import { SubtitleData, SubtitleEntry } from '@/types/subtitle';

/**
 * 字幕解析器抽象类
 */
export abstract class SubtitleParser {
  /**
   * 解析字幕文件内容
   * @param content 文件内容字符串
   * @returns 解析后的字幕数据
   */
  abstract parse(content: string): SubtitleData;

  /**
   * 检查文件格式是否支持
   * @param filename 文件名
   * @returns 是否支持
   */
  abstract canParse(filename: string): boolean;
}
