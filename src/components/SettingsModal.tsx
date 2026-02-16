'use client';

import { useState, useEffect } from 'react';
import { AppSettings, TranslationProvider, DEFAULT_SETTINGS } from '@/types/settings';
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

  useEffect(() => {
    if (isOpen) {
      const loaded = loadSettings();
      setSettings(loaded);
      setHasChanges(false);
    }
  }, [isOpen]);

  const handleProviderChange = (provider: TranslationProvider) => {
    setSettings((prev) => ({
      ...prev,
      currentProvider: provider,
    }));
    setHasChanges(true);
  };

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

  const handleSave = () => {
    saveSettings(settings);
    setHasChanges(false);
    onClose();
    // 触发自定义事件，通知其他组件设置已更新
    window.dispatchEvent(new CustomEvent('settingsUpdated'));
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('有未保存的更改，确定要关闭吗？');
      if (!confirmed) return;
    }
    onClose();
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
          {/* 选择当前翻译服务 */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              当前使用的翻译服务
            </label>
            <div className="flex gap-3">
              {(['deepseek', 'openai', 'google'] as TranslationProvider[]).map((provider) => (
                <label
                  key={provider}
                  className={`flex-1 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    settings.currentProvider === provider
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={provider}
                    checked={settings.currentProvider === provider}
                    onChange={() => handleProviderChange(provider)}
                    className="mr-2"
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {PROVIDER_LABELS[provider]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 各服务配置 */}
          <div className="space-y-6">
            {(['deepseek', 'openai', 'google'] as TranslationProvider[]).map((provider) => {
              const config = settings.services[provider];
              const isActive = settings.currentProvider === provider;

              return (
                <div
                  key={provider}
                  className={`border rounded-lg p-5 ${
                    isActive
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
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
                          (使用 {'{content}'}、{'{sourceLang}'}、{'{targetLang}'} 作为占位符)
                        </span>
                      </label>
                      <textarea
                        value={config.prompt}
                        onChange={(e) =>
                          handleServiceConfigChange(provider, 'prompt', e.target.value)
                        }
                        rows={4}
                        placeholder="输入翻译提示词，使用 {content}、{sourceLang}、{targetLang} 作为占位符"
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
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
