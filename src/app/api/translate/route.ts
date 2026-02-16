import { NextRequest, NextResponse } from 'next/server';
import { SubtitleService } from '@/core/SubtitleService';
import { LLMTranslator } from '@/core/translators/LLMTranslator';
import { TranslationProvider, TranslationOptions, TranslationMode, DEFAULT_PROMPT } from '@/types/settings';

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
    const provider = formData.get('provider') as TranslationProvider;
    const model = formData.get('model') as string;

    // 翻译选项
    const modeRaw = formData.get('translationMode') as string;
    const translationMode: TranslationMode = modeRaw === 'multi' ? 'multi' : 'single';
    const multiLineBatchSize = Math.min(10, Math.max(2, parseInt(String(formData.get('multiLineBatchSize') || '3'), 10) || 3));
    const contextLines = Math.min(3, Math.max(0, parseInt(String(formData.get('contextLines') || '0'), 10) || 0));

    const translationOptions: TranslationOptions = {
      mode: translationMode,
      multiLineBatchSize,
      contextLines,
    };
    
    // 从请求中获取服务配置（前端会传递这些信息）
    const apiKey = formData.get('apiKey') as string;
    const baseUrl = formData.get('baseUrl') as string || undefined;
    const prompt = formData.get('prompt') as string;
    const contextPrompt = (formData.get('contextPrompt') as string) || undefined;

    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      );
    }

    if (!provider || !model) {
      return NextResponse.json(
        { error: '未指定翻译供应商或模型' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: '未提供API Key' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const content = await file.text();
    const filename = file.name;

    // 创建翻译器
    const translator = new LLMTranslator({
      provider,
      model,
      apiKey,
      baseUrl,
      prompt: prompt || DEFAULT_PROMPT,
      contextPrompt,
    });

    // 创建服务实例
    const service = new SubtitleService();
    service.setTranslator(translator);

    // 处理字幕翻译
    const translatedContent = await service.processSubtitle(
      content,
      filename,
      sourceLang,
      targetLang,
      outputFormat,
      translationOptions
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
