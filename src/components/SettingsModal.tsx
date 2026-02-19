'use client';

import { useState, useEffect } from 'react';
import {
  AppSettings,
  ApiConfig,
  TranslationProvider,
  API_TYPE_PRESETS,
  DEFAULT_SETTINGS,
  PromptSet,
  DEFAULT_PROMPT_SET,
} from '@/types/settings';
import { loadSettings, saveSettings } from '@/utils/settings';
import { Eye, EyeOff, Copy, Plus, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'api' | 'prompt-sets' | 'custom-prompts';

const TYPE_LABELS: Record<TranslationProvider, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  google: 'Google',
};

function generateId() {
  return `ps-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateApiConfigId() {
  return `api-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('api');
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  /** 名称输入缓冲，避免清空后无法再输入（受控组件 + 空字符串的已知问题） */
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  /** 跟踪每个 API 配置的 API Key 是否可见（key 为 config.id） */
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setEditingNames({});
      loadSettings().then((loaded) => {
        setSettings(loaded);
        setHasChanges(false);
      });
    }
  }, [isOpen]);

  const handleApiConfigChange = (configId: string, updates: Partial<ApiConfig>) => {
    setSettings((prev) => ({
      ...prev,
      apiConfigs: prev.apiConfigs.map((c) =>
        c.id === configId ? { ...c, ...updates } : c
      ),
    }));
    setHasChanges(true);
  };

  /** 选择类型时填入默认 baseUrl 和模型列表 */
  const handleApiConfigTypeChange = (configId: string, newType: TranslationProvider) => {
    const preset = API_TYPE_PRESETS[newType];
    setSettings((prev) => ({
      ...prev,
      apiConfigs: prev.apiConfigs.map((c) =>
        c.id === configId
          ? { ...c, type: newType, baseUrl: preset.baseUrl, models: [...preset.models] }
          : c
      ),
    }));
    setHasChanges(true);
  };

  const handleAddApiConfig = () => {
    const newConfig: ApiConfig = {
      id: generateApiConfigId(),
      name: `新配置 ${(settings.apiConfigs?.length ?? 0) + 1}`,
      type: 'deepseek',
      baseUrl: API_TYPE_PRESETS.deepseek.baseUrl,
      apiKey: '',
      models: [...API_TYPE_PRESETS.deepseek.models],
      enabled: true,
    };
    setSettings((prev) => ({
      ...prev,
      apiConfigs: [...(prev.apiConfigs || []), newConfig],
    }));
    setHasChanges(true);
  };

  const handleDeleteApiConfig = (configId: string) => {
    const list = settings.apiConfigs || [];
    if (list.length <= 1) {
      alert('至少需要保留一项 API 配置');
      return;
    }
    if (!window.confirm('确定要删除此 API 配置吗？')) return;
    setSettings((prev) => ({
      ...prev,
      apiConfigs: prev.apiConfigs.filter((c) => c.id !== configId),
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

  const handleAddPromptSet = () => {
    const newSet: PromptSet = {
      ...DEFAULT_PROMPT_SET,
      id: generateId(),
      name: `新 Prompt 套装 ${(settings.promptSets?.length ?? 0) + 1}`,
    };
    setSettings((prev) => ({
      ...prev,
      promptSets: [...(prev.promptSets || []), newSet],
    }));
    setActiveTab('prompt-sets');
    setHasChanges(true);
  };

  const handleUpdatePromptSet = (id: string, updates: Partial<PromptSet>) => {
    setSettings((prev) => ({
      ...prev,
      promptSets: (prev.promptSets || []).map((ps) =>
        ps.id === id ? { ...ps, ...updates } : ps
      ),
    }));
    setHasChanges(true);
  };

  const handleDeletePromptSet = (id: string) => {
    const sets = settings.promptSets || [];
    if (sets.length <= 1) {
      alert('至少需要保留一套 Prompt');
      return;
    }
    if (!window.confirm('确定要删除此 Prompt 套装吗？')) return;
    setSettings((prev) => ({
      ...prev,
      promptSets: prev.promptSets.filter((ps) => ps.id !== id),
    }));
    setHasChanges(true);
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

  const toggleApiKeyVisibility = (configId: string) => {
    setVisibleApiKeys((prev) => ({
      ...prev,
      [configId]: !prev[configId],
    }));
  };

  const copyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      // 可以添加一个简单的提示，但为了简洁，这里先不添加
    } catch (err) {
      console.error('复制失败:', err);
    }
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

        {/* 选项卡 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'api' as TabId, label: 'API 配置' },
            { id: 'prompt-sets' as TabId, label: '通用 Prompt 管理' },
            { id: 'custom-prompts' as TabId, label: '常用单次 Prompt 管理' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {activeTab === 'api' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  每项包含：名称、类型（选择后自动填入默认 Base URL 和模型列表）、Base URL、API Key、模型列表。翻译时在界面选择一项配置 + 模型 + Prompt 套装。
                </p>
                <button
                  onClick={handleAddApiConfig}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm whitespace-nowrap"
                >
                  <Plus size={18} />
                  添加配置
                </button>
              </div>
              <div className="space-y-6">
                {(settings.apiConfigs || []).map((config) => (
                  <div
                    key={config.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <input
                          type="text"
                          value={config.name}
                          onChange={(e) => handleApiConfigChange(config.id, { name: e.target.value })}
                          placeholder="配置名称"
                          className="text-lg font-semibold text-gray-800 dark:text-gray-200 px-2 py-1 border border-gray-300 rounded
                            dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 min-w-[140px]"
                        />
                        <select
                          value={config.type}
                          onChange={(e) =>
                            handleApiConfigTypeChange(config.id, e.target.value as TranslationProvider)
                          }
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded
                            dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        >
                          {(['deepseek', 'openai', 'google'] as TranslationProvider[]).map((t) => (
                            <option key={t} value={t}>
                              {TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) =>
                              handleApiConfigChange(config.id, { enabled: e.target.checked })
                            }
                            className="w-4 h-4"
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">启用</span>
                        </label>
                      </div>
                      <button
                        onClick={() => handleDeleteApiConfig(config.id)}
                        className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          Base URL
                        </label>
                        <input
                          type="text"
                          value={config.baseUrl}
                          onChange={(e) =>
                            handleApiConfigChange(config.id, { baseUrl: e.target.value })
                          }
                          placeholder="例如 https://api.deepseek.com"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded
                            dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          API Key
                        </label>
                        <div className="relative">
                          <input
                            type={visibleApiKeys[config.id] ? 'text' : 'password'}
                            value={config.apiKey}
                            onChange={(e) =>
                              handleApiConfigChange(config.id, { apiKey: e.target.value })
                            }
                            placeholder="API Key"
                            className={`w-full px-3 py-2 text-sm border border-gray-300 rounded
                              dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                              ${visibleApiKeys[config.id] && config.apiKey ? 'pr-20' : 'pr-10'}`}
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {visibleApiKeys[config.id] && config.apiKey && (
                              <button
                                onClick={() => copyApiKey(config.apiKey)}
                                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                title="复制"
                              >
                                <Copy size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => toggleApiKeyVisibility(config.id)}
                              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              title={visibleApiKeys[config.id] ? '隐藏' : '显示'}
                            >
                              {visibleApiKeys[config.id] ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        模型列表（每行一个，翻译时从此列表中选择模型）
                      </label>
                      <textarea
                        value={config.models.join('\n')}
                        onChange={(e) => {
                          const models = e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          handleApiConfigChange(config.id, { models });
                        }}
                        rows={4}
                        placeholder={'每行一个模型名，例如：\ndeepseek-chat\ndeepseek-coder'}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono
                          dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                      />
                    </div>
                  </div>
                ))}
                {(settings.apiConfigs || []).length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    暂无 API 配置，点击上方「添加配置」创建
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'prompt-sets' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  每套包含：翻译 prompt、上下文 prompt、连贯模式 prompt。翻译时在界面选择使用哪套，与模型独立。
                </p>
                <button
                  onClick={handleAddPromptSet}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm whitespace-nowrap"
                >
                  + 添加套装
                </button>
              </div>
              <div className="space-y-6">
                {(settings.promptSets || []).map((ps) => (
                  <div
                    key={ps.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <input
                        type="text"
                        value={editingNames[ps.id] ?? ps.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditingNames((prev) => ({ ...prev, [ps.id]: v }));
                          handleUpdatePromptSet(ps.id, { name: v });
                        }}
                        onBlur={() => {
                          setEditingNames((prev) => {
                            const next = { ...prev };
                            delete next[ps.id];
                            return next;
                          });
                        }}
                        placeholder="套装名称"
                        className="text-lg font-semibold text-gray-800 dark:text-gray-200 px-2 py-1 -mx-2 border border-transparent rounded hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleDeletePromptSet(ps.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm"
                      >
                        删除
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          翻译 Prompt
                          <span className="ml-1 text-xs text-gray-500 font-normal">({'{content}'}、{'{sourceLang}'}、{'{targetLang}'}、{'{custom_prompt}'}、{'{context_prompt}'})</span>
                        </label>
                        <textarea
                          value={ps.prompt}
                          onChange={(e) => handleUpdatePromptSet(ps.id, { prompt: e.target.value })}
                          rows={5}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono
                            dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          上下文 Prompt <span className="text-xs text-gray-500 font-normal">({'{context}'})</span>
                        </label>
                        <textarea
                          value={ps.contextPrompt ?? ''}
                          onChange={(e) => handleUpdatePromptSet(ps.id, { contextPrompt: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono
                            dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          连贯模式主 Prompt <span className="text-xs text-gray-500 font-normal">(选择「连贯模式」时，{'{content}'}、{'{custom_prompt}'}、{'{context_prompt}'}、{'{coherence_prompt}'})</span>
                        </label>
                        <textarea
                          value={ps.coherenceModePrompt ?? ''}
                          onChange={(e) => handleUpdatePromptSet(ps.id, { coherenceModePrompt: e.target.value })}
                          rows={6}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono
                            dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(settings.promptSets || []).length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    暂无 Prompt 套装，点击上方「添加套装」创建
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'custom-prompts' && (
            <div>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                设置常用的独立 prompt 模板，可在翻译时快速插入到当前文件的独立 prompt（{'{custom_prompt}'}）中。
              </p>
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  添加新的常用 prompt
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">名称</label>
                    <input
                      type="text"
                      value={newPromptName}
                      onChange={(e) => setNewPromptName(e.target.value)}
                      placeholder="例如：技术文档、对话场景、诗歌等"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md
                        dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">内容</label>
                    <textarea
                      value={newPromptContent}
                      onChange={(e) => setNewPromptContent(e.target.value)}
                      rows={3}
                      placeholder="例如：这是一个技术文档，请使用专业术语..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm
                        dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                    />
                  </div>
                  <button
                    onClick={handleAddCustomPrompt}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                  >
                    添加
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {(settings.customPrompts || []).map((prompt, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 dark:text-gray-200 mb-2">{prompt.name}</div>
                        <textarea
                          value={prompt.content}
                          onChange={(e) => handleEditCustomPrompt(prompt.name, e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono
                            dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        />
                      </div>
                      <button
                        onClick={() => handleDeleteCustomPrompt(prompt.name)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm shrink-0"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                {(settings.customPrompts || []).length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    暂无常用 prompt，请添加
                  </div>
                )}
              </div>
            </div>
          )}
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
