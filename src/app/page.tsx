'use client';

import { useState } from 'react';
import SettingsModal from '@/components/SettingsModal';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('zh');
  const [outputFormat, setOutputFormat] = useState('srt');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ content: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleTranslate = async () => {
    if (!file) {
      setError('请先选择文件');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceLang', sourceLang);
      formData.append('targetLang', targetLang);
      formData.append('outputFormat', outputFormat);

      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '翻译失败');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '翻译失败');
    } finally {
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

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
              text-red-700 dark:text-red-400 px-4 py-3 rounded-md">
              {error}
            </div>
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
