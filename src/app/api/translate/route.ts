import { NextRequest, NextResponse } from 'next/server';
import { SubtitleService } from '@/core/SubtitleService';
import { MockTranslator } from '@/core/translators/MockTranslator';

/**
 * POST /api/translate
 * 翻译字幕文件
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceLang = formData.get('sourceLang') as string || 'en';
    const targetLang = formData.get('targetLang') as string || 'zh';
    const outputFormat = formData.get('outputFormat') as string || 'srt';

    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const content = await file.text();
    const filename = file.name;

    // 创建服务实例
    const service = new SubtitleService();
    service.setTranslator(new MockTranslator());

    // 处理字幕翻译
    const translatedContent = await service.processSubtitle(
      content,
      filename,
      sourceLang,
      targetLang,
      outputFormat
    );

    // 生成输出文件名
    const outputFilename = filename.replace(/\.[^.]+$/, `_translated.${outputFormat}`);

    return NextResponse.json({
      success: true,
      content: translatedContent,
      filename: outputFilename,
    });
  } catch (error) {
    console.error('翻译错误:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : '翻译失败',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
