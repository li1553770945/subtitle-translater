'use client';

import { useState, useEffect } from 'react';
import { AppSettings, TranslationProvider, DEFAULT_SETTINGS, CustomPromptItem } from '@/types/settings';
import { loadSettings, saveSettings } from '@/utils/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<TranslationProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  google: 'Google Translate',
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings().then((loaded) => {
        setSettings(loaded);
        setHasChanges(false);
      });
    }
  }, [isOpen]);

  const handleServiceConfigChange = (
    provider: TranslationProvider,
    field: keyof AppSettings['services'][TranslationProvider],
    value: string | boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [provider]: {
          ...prev.services[provider],
          [field]: value,
        },
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      setHasChanges(false);
      onClose();
      // 触发自定义事件，通知其他组件设置已更新
      window.dispatchEvent(new CustomEvent('settingsUpdated'));
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存设置失败，请重试');
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('有未保存的更改，确定要关闭吗？');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleAddCustomPrompt = () => {
    if (!newPromptName.trim() || !newPromptContent.trim()) {
      alert('请输入名称和内容');
      return;
    }
    const customPrompts = settings.customPrompts || [];
    if (customPrompts.some(p => p.name === newPromptName.trim())) {
      alert('该名称已存在');
      return;
    }
    setSettings((prev) => ({
      ...prev,
      customPrompts: [...customPrompts, { name: newPromptName.trim(), content: newPromptContent.trim() }],
    }));
    setNewPromptName('');
    setNewPromptContent('');
    setHasChanges(true);
  };

  const handleDeleteCustomPrompt = (name: string) => {
    const customPrompts = settings.customPrompts || [];
    setSettings((prev) => ({
      ...prev,
      customPrompts: customPrompts.filter(p => p.name !== name),
    }));
    setHasChanges(true);
  };

  const handleEditCustomPrompt = (name: string, newContent: string) => {
    const customPrompts = settings.customPrompts || [];
    setSettings((prev) => ({
      ...prev,
      customPrompts: customPrompts.map(p => p.name === name ? { ...p, content: newContent } : p),
    }));
    setHasChanges(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            设置
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            <p>在此配置各翻译服务的 API Key 和 Base URL。翻译时可在翻译界面选择使用的供应商和模型。</p>
          </div>

          {/* 各服务配置 */}
          <div className="space-y-6">
            {(['deepseek', 'openai', 'google'] as TranslationProvider[]).map((provider) => {
              const config = settings.services[provider];

              return (
                <div
                  key={provider}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {PROVIDER_LABELS[provider]} 配置
                    </h3>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) =>
                          handleServiceConfigChange(provider, 'enabled', e.target.checked)
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">启用</span>
                    </label>
                  </div>

                  <div className="space-y-4">
                    {/* API Key */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={config.apiKey}
                        onChange={(e) =>
                          handleServiceConfigChange(provider, 'apiKey', e.target.value)
                        }
                        placeholder={`输入 ${PROVIDER_LABELS[provider]} API Key`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                          focus:outline-none focus:ring-blue-500 focus:border-blue-500
                          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                      />
                    </div>

                    {/* Base URL */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Base URL（可选）
                      </label>
                      <input
                        type="text"
                        value={config.baseUrl || ''}
                        onChange={(e) =>
                          handleServiceConfigChange(provider, 'baseUrl', e.target.value)
                        }
                        placeholder="留空使用默认 URL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                          focus:outline-none focus:ring-blue-500 focus:border-blue-500
                          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                      />
                    </div>

                    {/* Prompt */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        翻译 Prompt
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (使用 {'{content}'}、{'{sourceLang}'}、{'{targetLang}'}、{'{custom_prompt}'}、{'{context_prompt}'}、{'{coherence_prompt}'} 作为占位符)
                        </span>
                      </label>
                      <textarea
                        value={config.prompt}
                        onChange={(e) =>
                          handleServiceConfigChange(provider, 'prompt', e.target.value)
                        }
                        rows={4}
                        placeholder="输入翻译提示词，使用 {content}、{sourceLang}、{targetLang}、{custom_prompt}、{context_prompt}、{coherence_prompt} 作为占位符"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                          focus:outline-none focus:ring-blue-500 focus:border-blue-500
                          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                          font-mono text-sm"
                      />
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <p>提示：在 Prompt 中可以使用以下占位符：</p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>{'{content}'} - 会被替换为实际要翻译的内容</li>
                          <li>{'{sourceLang}'} - 会被替换为源语言代码（如：en, zh）</li>
                          <li>{'{targetLang}'} - 会被替换为目标语言代码（如：zh, en）</li>
                          <li>{'{custom_prompt}'} - 会被替换为当前文件的独立prompt（如果设置了的话），否则为空字符串</li>
                          <li>{'{context_prompt}'} - 启用翻译上下文时，插入下方「上下文 Prompt」解析后的内容；无上下文时为空</li>
                          <li>
                            <strong>{'{coherence_prompt}'}</strong> - 启用连贯优先模式时，插入下方「连贯性 Prompt」解析后的内容；未启用时为空
                            <span className="text-yellow-600 dark:text-yellow-400 font-medium ml-1">
                              （如需使用连贯模式，请在此 Prompt 中添加此占位符）
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Context Prompt */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        上下文 Prompt
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (单行模式 + 翻译上下文 &gt; 0 时生效，使用 {'{context}'} 占位符)
                        </span>
                      </label>
                      <textarea
                        value={config.contextPrompt ?? ''}
                        onChange={(e) =>
                          handleServiceConfigChange(provider, 'contextPrompt', e.target.value)
                        }
                        rows={4}
                        placeholder="输入上下文提示词，使用 {context} 作为占位符"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                          focus:outline-none focus:ring-blue-500 focus:border-blue-500
                          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                          font-mono text-sm"
                      />
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <p>上下文会包含：上文、【目标句】、下文。{'{context}'} 会被替换为该内容，解析结果插入主 Prompt 的 {'{context_prompt}'} 位置。</p>
                      </div>
                    </div>

                    {/* Coherence Prompt */}
                    <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        连贯性 Prompt
                        <span className="ml-2 text-xs px-2 py-0.5 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                          实验性
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (启用连贯优先模式时生效，使用 {'{context}'} 占位符)
                        </span>
                      </label>
                      <textarea
                        value={config.coherencePrompt ?? ''}
                        onChange={(e) =>
                          handleServiceConfigChange(provider, 'coherencePrompt', e.target.value)
                        }
                        rows={5}
                        placeholder="输入连贯性提示词，使用 {context} 作为占位符"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                          focus:outline-none focus:ring-blue-500 focus:border-blue-500
                          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                          font-mono text-sm"
                      />
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <p>此 Prompt 会在启用"连贯优先模式"时插入主 Prompt 的 {'{coherence_prompt}'} 位置。</p>
                        <p>用于指导AI根据上下文修正字幕，使其更连贯自然。{'{context}'} 会被替换为上下文内容（包含上文、【目标句】、下文）。</p>
                        <p className="text-yellow-700 dark:text-yellow-300 font-medium mt-2">
                          💡 提示：此功能允许AI主动修正语音识别错误和不连贯的内容，适合处理识别准确率不高的字幕。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })};
          </div>

          {/* 常用独立prompt管理 */}
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              常用独立prompt管理
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              设置常用的独立prompt模板，可在翻译时快速插入到当前文件的独立prompt中。
            </p>

            {/* 添加新的常用prompt */}
            <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                添加新的常用prompt
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    名称
                  </label>
                  <input
                    type="text"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                    placeholder="例如：技术文档、对话场景、诗歌等"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-blue-500 focus:border-blue-500
                      dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    内容
                  </label>
                  <textarea
                    value={newPromptContent}
                    onChange={(e) => setNewPromptContent(e.target.value)}
                    rows={3}
                    placeholder="例如：这是一个技术文档，请使用专业术语..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                      focus:outline-none focus:ring-blue-500 focus:border-blue-500
                      dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                      font-mono text-sm"
                  />
                </div>
                <button
                  onClick={handleAddCustomPrompt}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700
                    text-white rounded-md transition-colors text-sm"
                >
                  添加
                </button>
              </div>
            </div>

            {/* 常用prompt列表 */}
            <div className="space-y-3">
              {(settings.customPrompts || []).map((prompt, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                        {prompt.name}
                      </div>
                      <textarea
                        value={prompt.content}
                        onChange={(e) => handleEditCustomPrompt(prompt.name, e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm
                          focus:outline-none focus:ring-blue-500 focus:border-blue-500
                          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                          font-mono"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteCustomPrompt(prompt.name)}
                      className="ml-3 px-3 py-1 text-red-600 hover:text-red-700
                        hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors text-sm"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {(settings.customPrompts || []).length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  暂无常用prompt，请添加
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700
              hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
              text-white rounded-md transition-colors disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
