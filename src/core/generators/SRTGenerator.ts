import { SubtitleGenerator } from './SubtitleGenerator';
import { SubtitleData } from '@/types/subtitle';

/**
 * SRT格式字幕生成器
 */
export class SRTGenerator extends SubtitleGenerator {
  getExtension(): string {
    return '.srt';
  }

  generate(data: SubtitleData): string {
    const lines: string[] = [];
    
    // 按序号排序
    const sortedEntries = [...data.entries].sort((a, b) => a.index - b.index);
    
    for (const entry of sortedEntries) {
      // 序号
      lines.push(entry.index.toString());
      
      // 时间轴
      lines.push(`${entry.startTime} --> ${entry.endTime}`);
      
      // 文本内容（支持多行）
      lines.push(entry.text);
      
      // 空行分隔
      lines.push('');
    }
    
    return lines.join('\n');
  }
}
