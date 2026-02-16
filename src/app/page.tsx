'use client';

import { useState, useEffect, useRef } from 'react';
import SettingsModal from '@/components/SettingsModal';
import {
  TranslationProvider,
  PROVIDER_MODELS,
  AppSettings,
  DEFAULT_SETTINGS,
  TranslationMode,
} from '@/types/settings';
import { loadSettings } from '@/utils/settings';
import { SubtitleEntry } from '@/types/subtitle';

const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  google: 'Google',
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('zh');
  const [outputFormat, setOutputFormat] = useState('srt');
  const [translationMode, setTranslationMode] = useState<TranslationMode>('single');
  const [multiLineBatchSize, setMultiLineBatchSize] = useState(3);
  const [contextLines, setContextLines] = useState(0);
  const [enableContext, setEnableContext] = useState(false);
  const [enableCoherence, setEnableCoherence] = useState(false);
  const [parallelCount, setParallelCount] = useState<number | undefined>(undefined);
  const [provider, setProvider] = useState<TranslationProvider>('deepseek');
  const [model, setModel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ content: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    percent: number;
    completed: number;
    total: number;
    currentIndex?: number;
  } | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [previewEntries, setPreviewEntries] = useState<SubtitleEntry[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isCancelled, setIsCancelled] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // 加载设置
  useEffect(() => {
    loadSettings().then((settings) => {
      setAppSettings(settings);
    });

    // 监听设置更新事件
    const handleSettingsUpdated = () => {
      loadSettings().then((settings) => {
        setAppSettings(settings);
      });
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdated);
    };
  }, []);

  // 初始化：选择第一个已配置的供应商和模型
  useEffect(() => {
    const enabledServices = (['deepseek', 'openai', 'google'] as TranslationProvider[]).filter(
      (p) => appSettings.services[p].enabled && appSettings.services[p].apiKey
    );
    
    if (enabledServices.length > 0) {
      const firstEnabled = enabledServices[0];
      setProvider(firstEnabled);
      setModel(PROVIDER_MODELS[firstEnabled][0] || '');
    } else {
      // 如果没有已配置的服务，使用默认值
      setModel(PROVIDER_MODELS[provider][0] || '');
    }
  }, [appSettings]);

  // 当供应商改变时，更新模型选择
  useEffect(() => {
    const availableModels = PROVIDER_MODELS[provider];
    if (availableModels.length > 0) {
      // 总是设置为第一个可用模型（供应商改变时）
      setModel(availableModels[0]);
    }
  }, [provider]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (readerRef.current) {
        readerRef.current.cancel();
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
      // 切换文件时不清空独立prompt，允许用户保留设置
    }
  };

  const handleInsertCustomPrompt = (content: string) => {
    setCustomPrompt((prev) => {
      if (prev.trim()) {
        return prev + '\n\n' + content;
      }
      return content;
    });
  };

  const handleTranslate = async () => {
    if (!file) {
      setError('请先选择文件');
      return;
    }

    if (!model) {
      setError('请选择翻译模型');
      return;
    }

    // 检查选中的供应商是否已配置
    const serviceConfig = appSettings.services[provider];
    if (!serviceConfig.enabled || !serviceConfig.apiKey) {
      setError(`请先在设置中配置 ${PROVIDER_LABELS[provider]} 的 API Key`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setEstimatedTimeRemaining(null);
    setPreviewEntries([]);
    setIsCancelled(false);

    // 创建 AbortController 用于取消请求
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 用于计算剩余时间
    const startTime = Date.now();
    const progressHistory: { time: number; completed: number }[] = [];

    try {
      const serviceConfig = appSettings.services[provider];
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceLang', sourceLang);
      formData.append('targetLang', targetLang);
      formData.append('outputFormat', outputFormat);
      formData.append('translationMode', translationMode);
      formData.append('multiLineBatchSize', String(multiLineBatchSize));
      formData.append('contextLines', String(contextLines));
      formData.append('enableContext', String(enableContext));
      formData.append('enableCoherence', String(enableCoherence));
      if (parallelCount !== undefined) {
        formData.append('parallelCount', String(parallelCount));
      }
      formData.append('provider', provider);
      formData.append('model', model);
      formData.append('apiKey', serviceConfig.apiKey);
      if (serviceConfig.baseUrl) {
        formData.append('baseUrl', serviceConfig.baseUrl);
      }
      formData.append('prompt', serviceConfig.prompt);
      formData.append('contextPrompt', serviceConfig.contextPrompt ?? '');
      formData.append('coherencePrompt', serviceConfig.coherencePrompt ?? '');
      formData.append('customPrompt', customPrompt.trim());

      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '翻译失败');
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          // 检查是否已取消
          if (abortController.signal.aborted) {
            try {
              await reader.cancel();
            } catch (e) {
              // 忽略取消时的错误
            }
            break;
          }

          let readResult;
          try {
            readResult = await reader.read();
          } catch (readError) {
            // 如果是取消错误，正常退出
            if (readError instanceof Error && readError.name === 'AbortError') {
              break;
            }
            throw readError;
          }

          const { done, value } = readResult;
          if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.type === 'progress') {
              const { percent, completed, total, currentIndex, translatedEntries } = data;
              setProgress({ percent, completed, total, currentIndex });
              
              // 更新预览数据
              if (translatedEntries && Array.isArray(translatedEntries)) {
                setPreviewEntries(translatedEntries);
              }

              // 计算剩余时间
              const now = Date.now();
              progressHistory.push({ time: now, completed });
              
              // 只保留最近10个进度点用于计算
              if (progressHistory.length > 10) {
                progressHistory.shift();
              }

              if (completed > 0 && progressHistory.length >= 2) {
                // 计算平均速度（每秒完成的数量）
                const recentHistory = progressHistory.slice(-5); // 使用最近5个点
                const timeDiff = recentHistory[recentHistory.length - 1].time - recentHistory[0].time;
                const completedDiff = recentHistory[recentHistory.length - 1].completed - recentHistory[0].completed;
                
                if (timeDiff > 0 && completedDiff > 0) {
                  const speed = completedDiff / (timeDiff / 1000); // 每秒完成的数量
                  const remaining = total - completed;
                  const estimatedSeconds = remaining / speed;
                  setEstimatedTimeRemaining(Math.max(0, Math.round(estimatedSeconds)));
                }
              }
            } else if (data.type === 'result') {
              setResult({
                content: data.content,
                filename: data.filename,
              });
              setProgress(null);
              setEstimatedTimeRemaining(null);
              setPreviewEntries([]);
            } else if (data.type === 'error') {
              throw new Error(data.error || '翻译失败');
            }
          } catch (parseError) {
            console.error('解析进度数据失败:', parseError, line);
          }
        }
        }
      } catch (streamError) {
        // 流读取错误，如果是取消则忽略
        if (!(streamError instanceof Error && streamError.name === 'AbortError')) {
          throw streamError;
        }
      }
    } catch (err) {
      // 如果是用户主动取消，保留预览结果
      if (err instanceof Error && (err.name === 'AbortError' || abortController.signal.aborted)) {
        setIsCancelled(true);
        setError(null); // 不显示错误信息，使用取消提示
        // 保留预览结果和进度信息
        // previewEntries 和 progress 保持不变
      } else {
        setError(err instanceof Error ? err.message : '翻译失败');
        setProgress(null);
        setEstimatedTimeRemaining(null);
        setPreviewEntries([]);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      readerRef.current = null;
    }
  };

  // 终止翻译
  const handleCancel = async () => {
    try {
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
        } catch (e) {
          // 忽略取消时的错误
        }
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } catch (e) {
      // 忽略所有取消相关的错误
    } finally {
      setIsCancelled(true);
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;

    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 格式化剩余时间（秒 -> 分:秒）
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 生成字幕文件内容（客户端生成）
  const generateSubtitleContent = (entries: SubtitleEntry[], format: string): string => {
    if (format === 'srt') {
      const lines: string[] = [];
      const sortedEntries = [...entries].sort((a, b) => a.index - b.index);
      
      for (const entry of sortedEntries) {
        lines.push(entry.index.toString());
        lines.push(`${entry.startTime} --> ${entry.endTime}`);
        lines.push(entry.text);
        lines.push('');
      }
      
      return lines.join('\n');
    }
    // 其他格式可以后续扩展
    return entries.map(e => `${e.index}\n${e.startTime} --> ${e.endTime}\n${e.text}`).join('\n\n');
  };

  // 保存部分结果
  const handleSavePartial = () => {
    if (previewEntries.length === 0) {
      setError('没有可保存的翻译结果');
      return;
    }

    const content = generateSubtitleContent(previewEntries, outputFormat);
    const filename = file
      ? file.name.replace(/\.[^.]+$/, `_partial_${previewEntries.length}.${outputFormat}`)
      : `partial_translated.${outputFormat}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* 头部区域 */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
            字幕翻译工具
          </h1>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200
              hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="设置"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
          {/* 文件上传 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              选择字幕文件
            </label>
            <input
              type="file"
              accept=".srt,.ass,.vtt"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900 dark:file:text-blue-300
                dark:hover:file:bg-blue-800"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                已选择: {file.name}
              </p>
            )}
          </div>

          {/* 翻译服务选择 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                翻译供应商
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value as TranslationProvider;
                  setProvider(newProvider);
                  // 更新模型为第一个可用模型
                  const availableModels = PROVIDER_MODELS[newProvider];
                  if (availableModels.length > 0) {
                    setModel(availableModels[0]);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-blue-500 focus:border-blue-500
                  dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                {(['deepseek', 'openai', 'google'] as TranslationProvider[]).map((p) => {
                  const serviceConfig = appSettings.services[p];
                  const isConfigured = serviceConfig.enabled && serviceConfig.apiKey;
                  return (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]} {isConfigured ? '' : '(未配置)'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                模型
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-blue-500 focus:border-blue-500
                  dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                disabled={!PROVIDER_MODELS[provider] || PROVIDER_MODELS[provider].length === 0}
              >
                {PROVIDER_MODELS[provider]?.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 语言选择 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                源语言
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-blue-500 focus:border-blue-500
                  dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                <option value="en">英语</option>
                <option value="zh">中文</option>
                <option value="ja">日语</option>
                <option value="ko">韩语</option>
                <option value="fr">法语</option>
                <option value="de">德语</option>
                <option value="es">西班牙语</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                目标语言
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-blue-500 focus:border-blue-500
                  dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
              >
                <option value="en">英语</option>
                <option value="zh">中文</option>
                <option value="ja">日语</option>
                <option value="ko">韩语</option>
                <option value="fr">法语</option>
                <option value="de">德语</option>
                <option value="es">西班牙语</option>
              </select>
            </div>
          </div>

          {/* 翻译模式：单行/多行 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                翻译模式
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="translationMode"
                    value="single"
                    checked={translationMode === 'single'}
                    onChange={() => setTranslationMode('single')}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-700 dark:text-gray-300">单行</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">逐句翻译</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="translationMode"
                    value="multi"
                    checked={translationMode === 'multi'}
                    onChange={() => setTranslationMode('multi')}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-700 dark:text-gray-300">多行</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">合并翻译</span>
                </label>
              </div>
            </div>

            {translationMode === 'multi' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  每次合并条数
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    (2–10 条)
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={multiLineBatchSize}
                    onChange={(e) => setMultiLineBatchSize(parseInt(e.target.value, 10))}
                    className="flex-1 h-2 rounded-lg appearance-none cursor-pointer
                      bg-gray-200 dark:bg-gray-600 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8">
                    {multiLineBatchSize}
                  </span>
                </div>
              </div>
            )}

            {translationMode === 'single' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    并行翻译数量
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      (2–10，留空则串行翻译)
                    </span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={parallelCount || 1}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        setParallelCount(value >= 2 ? value : undefined);
                      }}
                      className="flex-1 h-2 rounded-lg appearance-none cursor-pointer
                        bg-gray-200 dark:bg-gray-600 accent-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12">
                      {parallelCount || '串行'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    并行翻译可加快速度，但结果可能乱序到达。前端会自动按时间顺序排列。
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    翻译上下文
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      (前后各 N 句作参考)
                    </span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={3}
                      value={contextLines}
                      onChange={(e) => setContextLines(parseInt(e.target.value, 10))}
                      className="flex-1 h-2 rounded-lg appearance-none cursor-pointer
                        bg-gray-200 dark:bg-gray-600 accent-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8">
                      {contextLines}
                    </span>
                  </div>
                </div>

                {/* 翻译上下文开关 */}
                {contextLines > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableContext}
                        onChange={(e) => {
                          setEnableContext(e.target.checked);
                        }}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            使用翻译上下文
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          将上下文通过 contextPrompt 插入，帮助AI理解语境。
                          {enableCoherence && (
                            <span className="block mt-1 text-blue-600 dark:text-blue-400 font-medium">
                              ℹ️ 当前已启用连贯模式，上下文会同时用于修正。如需仅用于理解，可取消连贯模式。
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                  </div>
                )}
                
                {/* 连贯优先模式（实验性功能） */}
                <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableCoherence}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setEnableCoherence(newValue);
                        // 启用连贯模式时，如果上下文为0，自动设置为1
                        if (newValue && contextLines === 0) {
                          setContextLines(1);
                        }
                        // 启用连贯模式时，自动取消翻译上下文（避免重复）
                        if (newValue) {
                          setEnableContext(false);
                        }
                      }}
                      className="mt-1 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          连贯优先模式
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                          实验性
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        允许AI根据上下文修正字幕，使翻译更连贯自然。适用于语音识别字幕，可修正识别错误和不连贯的内容。
                        {enableCoherence && contextLines === 0 && (
                          <span className="block mt-1 text-yellow-700 dark:text-yellow-300 font-medium">
                            ⚠️ 已自动启用上下文（1行）以支持连贯模式
                          </span>
                        )}
                        {enableCoherence && (
                          <span className="block mt-1 text-yellow-700 dark:text-yellow-300 font-medium">
                            💡 已自动取消"使用翻译上下文"，避免重复。如需同时使用，可手动勾选。
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* 输出格式 */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              输出格式
            </label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                focus:outline-none focus:ring-blue-500 focus:border-blue-500
                dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <option value="srt">SRT</option>
              <option value="ass">ASS</option>
              <option value="vtt">VTT</option>
            </select>
          </div>

          {/* 独立prompt设置 */}
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              独立prompt（单次翻译专用）
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                (可选，用于为当前字幕文件设置特殊的翻译背景或要求)
              </span>
            </label>
            <div className="mb-2">
              {(appSettings.customPrompts || []).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">快速插入：</span>
                  {(appSettings.customPrompts || []).map((prompt) => (
                    <button
                      key={prompt.name}
                      onClick={() => handleInsertCustomPrompt(prompt.content)}
                      className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800
                        text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200
                        dark:hover:bg-blue-700 transition-colors"
                      title={prompt.content}
                    >
                      {prompt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              placeholder="例如：这是一个技术文档，请使用专业术语...&#10;或者：这是对话场景，请保持口语化..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                focus:outline-none focus:ring-blue-500 focus:border-blue-500
                dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                font-mono text-sm"
            />
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <p>提示：</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>此prompt仅对当前翻译任务有效，不会保存到全局设置</li>
                <li>如果主prompt中包含 {'{custom_prompt}'} 占位符，此内容会替换该占位符</li>
                <li>如果未设置独立prompt，{'{custom_prompt}'} 占位符会被替换为空字符串</li>
                <li>点击上方按钮可快速插入常用prompt模板</li>
              </ul>
            </div>
          </div>

          {/* 进度条 */}
          {(loading || isCancelled) && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>
                  翻译进度: {progress.completed} / {progress.total} ({progress.percent}%)
                </span>
                {estimatedTimeRemaining !== null && (
                  <span>
                    预计剩余时间: {formatTime(estimatedTimeRemaining)}
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex gap-2">
                {previewEntries.length > 0 && (
                  <button
                    onClick={handleSavePartial}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700
                      text-white font-semibold py-2 px-4 rounded-lg
                      transition-colors duration-200 text-sm"
                  >
                    保存当前进度 ({previewEntries.length} 条)
                  </button>
                )}
                {loading && (
                  <button
                    onClick={handleCancel}
                    className="bg-red-600 hover:bg-red-700
                      text-white font-semibold py-2 px-4 rounded-lg
                      transition-colors duration-200 text-sm"
                  >
                    终止翻译
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 翻译预览 */}
          {previewEntries.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  翻译预览 ({previewEntries.length} 条)
                  {isCancelled && <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">(已终止)</span>}
                </h3>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {[...previewEntries]
                  .sort((a, b) => a.index - b.index) // 按索引排序，确保顺序正确
                  .slice(0, 20) // 显示前20条，而不是最后10条，这样可以看到翻译进度
                  .map((entry, idx) => {
                    const isPlaceholder = entry.text === '[翻译中...]';
                    return (
                      <div
                        key={`${entry.index}-${idx}`}
                        className={`text-xs bg-white dark:bg-gray-800 p-2 rounded border ${
                          isPlaceholder 
                            ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20' 
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="text-gray-500 dark:text-gray-400 mb-1">
                          #{entry.index} {entry.startTime} → {entry.endTime}
                          {isPlaceholder && (
                            <span className="ml-2 text-yellow-600 dark:text-yellow-400 text-xs">
                              [翻译中...]
                            </span>
                          )}
                        </div>
                        <div className={`whitespace-pre-wrap ${
                          isPlaceholder 
                            ? 'text-yellow-700 dark:text-yellow-300 italic' 
                            : 'text-gray-800 dark:text-gray-200'
                        }`}>
                          {entry.text}
                        </div>
                      </div>
                    );
                  })}
                {previewEntries.length > 20 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                    显示前 20 条，共 {previewEntries.length} 条
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 翻译按钮 */}
          <button
            onClick={handleTranslate}
            disabled={!file || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
              text-white font-semibold py-3 px-6 rounded-lg
              transition-colors duration-200
              disabled:cursor-not-allowed"
          >
            {loading ? '翻译中...' : '开始翻译'}
          </button>

          {/* 错误信息或取消提示 */}
          {(error || isCancelled) && (
            <div className={`${
              isCancelled 
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            } border px-4 py-3 rounded-md`}>
              {isCancelled ? (
                <div>
                  <div className="font-semibold mb-1">翻译已终止</div>
                  {previewEntries.length > 0 ? (
                    <div className="text-sm">
                      已翻译 {previewEntries.length} 条，您可以保存部分结果或重新开始翻译。
                    </div>
                  ) : (
                    <div className="text-sm">
                      翻译已终止，没有可保存的结果。
                    </div>
                  )}
                </div>
              ) : (
                error
              )}
            </div>
          )}

          {/* 终止后显示保存按钮 */}
          {isCancelled && previewEntries.length > 0 && !loading && (
            <button
              onClick={handleSavePartial}
              className="w-full bg-yellow-600 hover:bg-yellow-700
                text-white font-semibold py-3 px-6 rounded-lg
                transition-colors duration-200"
            >
              保存已翻译的部分 ({previewEntries.length} 条)
            </button>
          )}

          {/* 结果 */}
          {result && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800
                text-green-700 dark:text-green-400 px-4 py-3 rounded-md">
                翻译完成！
              </div>
              <button
                onClick={handleDownload}
                className="w-full bg-green-600 hover:bg-green-700
                  text-white font-semibold py-3 px-6 rounded-lg
                  transition-colors duration-200"
              >
                下载翻译后的字幕文件
              </button>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4 max-h-64 overflow-auto">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {result.content.substring(0, 1000)}
                  {result.content.length > 1000 && '...'}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* 说明 */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>支持 SRT、ASS、VTT 格式的字幕文件</p>
          <p className="mt-2">点击右上角设置图标配置翻译服务</p>
        </div>
      </div>

      {/* 设置弹窗 */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </main>
  );
}
