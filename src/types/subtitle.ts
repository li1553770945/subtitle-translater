/**
 * 字幕条目接口
 */
export interface SubtitleEntry {
  /** 序号 */
  index: number;
  /** 开始时间 (格式: HH:MM:SS,mmm) */
  startTime: string;
  /** 结束时间 (格式: HH:MM:SS,mmm) */
  endTime: string;
  /** 字幕文本内容 */
  text: string;
}

/**
 * 字幕文件数据
 */
export interface SubtitleData {
  /** 字幕条目列表 */
  entries: SubtitleEntry[];
  /** 原始文件格式 */
  format: 'srt' | 'ass' | 'vtt';
}
