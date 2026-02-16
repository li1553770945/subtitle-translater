import { NextRequest, NextResponse } from 'next/server';
import { SubtitleService } from '@/core/SubtitleService';
import { LLMTranslator } from '@/core/translators/LLMTranslator';
import { TranslationProvider, TranslationOptions, TranslationMode, DEFAULT_PROMPT } from '@/types/settings';
import { SubtitleEntry } from '@/types/subtitle';

/**
 * POST /api/translate
 * 翻译字幕文件（支持流式进度更新）
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

    // 获取请求的取消信号
    const abortSignal = request.signal;

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // 发送进度更新的辅助函数
        const sendProgress = (progress: {
          percent: number;
          completed: number;
          total: number;
          currentIndex?: number;
          translatedEntries?: SubtitleEntry[];
        }) => {
          // 检查是否已取消
          if (abortSignal.aborted) {
            return;
          }
          const data = JSON.stringify({ type: 'progress', ...progress }) + '\n';
          try {
            controller.enqueue(encoder.encode(data));
          } catch (e) {
            // 如果流已关闭，忽略错误
          }
        };

        try {
          // 检查是否已取消
          if (abortSignal.aborted) {
            controller.close();
            return;
          }

          // 解析字幕文件
          const parsed = await service.parseSubtitle(content, filename);
          const total = parsed.entries.length;

          // 发送初始进度
          sendProgress({ percent: 0, completed: 0, total });

          // 创建带进度回调和取消信号的翻译选项
          // 使用一个对象来实时检查取消状态
          const abortSignalWrapper = {
            get aborted() {
              return abortSignal.aborted;
            }
          };
          
          const translationOptions: TranslationOptions = {
            mode: translationMode,
            multiLineBatchSize,
            contextLines,
            onProgress: sendProgress,
            abortSignal: abortSignalWrapper,
          };

          // 监听取消信号
          abortSignal.addEventListener('abort', () => {
            // 请求被取消，关闭流
            try {
              controller.close();
            } catch (e) {
              // 流可能已经关闭
            }
          });

          // 翻译字幕
          const translated = await service.translateSubtitle(
            parsed,
            sourceLang,
            targetLang,
            translationOptions
          );

          // 检查是否已取消
          if (abortSignal.aborted) {
            controller.close();
            return;
          }

          // 生成字幕文件
          const translatedContent = service.generateSubtitle(translated, outputFormat);

          // 生成输出文件名
          const outputFilename = filename.replace(/\.[^.]+$/, `_translated.${outputFormat}`);

          // 发送最终结果
          const result = JSON.stringify({
            type: 'result',
            success: true,
            content: translatedContent,
            filename: outputFilename,
          }) + '\n';
          controller.enqueue(encoder.encode(result));
          controller.close();
        } catch (error) {
          // 如果是取消错误，不发送错误消息，直接关闭流
          if (error instanceof Error && error.message === '翻译已取消') {
            try {
              controller.close();
            } catch (e) {
              // 流可能已经关闭
            }
            return;
          }
          
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : '翻译失败',
            details: error instanceof Error ? error.stack : undefined,
          }) + '\n';
          try {
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          } catch (e) {
            // 流可能已经关闭
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
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
