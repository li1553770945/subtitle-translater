import { SubtitleParser } from './SubtitleParser';
import { SubtitleData, SubtitleEntry } from '@/types/subtitle';

/**
 * SRT格式字幕解析器
 */
export class SRTParser extends SubtitleParser {
  canParse(filename: string): boolean {
    return filename.toLowerCase().endsWith('.srt');
  }

  parse(content: string): SubtitleData {
    const entries: SubtitleEntry[] = [];
    
    // 清理内容，移除BOM标记
    const cleanContent = content.replace(/^\uFEFF/, '');
    
    // 按双换行符分割字幕块
    const blocks = cleanContent.split(/\n\s*\n/).filter(block => block.trim());
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      
      if (lines.length < 2) continue;
      
      // 第一行是序号
      const index = parseInt(lines[0].trim(), 10);
      if (isNaN(index)) continue;
      
      // 第二行是时间轴 (格式: HH:MM:SS,mmm --> HH:MM:SS,mmm)
      const timeLine = lines[1].trim();
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
      
      if (!timeMatch) continue;
      
      // 标准化时间格式（统一使用逗号）
      let startTime = timeMatch[1].replace('.', ',');
      let endTime = timeMatch[2].replace('.', ',');
      
      // 确保时间格式正确 (HH:MM:SS,mmm)
      if (!startTime.match(/^\d{2}:\d{2}:\d{2},\d{3}$/)) {
        // 尝试修复格式
        startTime = this.normalizeTime(startTime);
      }
      if (!endTime.match(/^\d{2}:\d{2}:\d{2},\d{3}$/)) {
        endTime = this.normalizeTime(endTime);
      }
      
      // 剩余行是字幕文本
      const text = lines.slice(2).join('\n').trim();
      
      if (text) {
        entries.push({
          index,
          startTime,
          endTime,
          text,
        });
      }
    }
    
    return {
      entries,
      format: 'srt',
    };
  }

  /**
   * 标准化时间格式
   */
  private normalizeTime(time: string): string {
    // 将各种时间格式转换为 HH:MM:SS,mmm
    const parts = time.split(/[:,.]/);
    if (parts.length >= 4) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')},${parts[3].padStart(3, '0')}`;
    }
    return time;
  }
}
