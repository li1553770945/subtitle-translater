# 字幕翻译工具

一个基于 Next.js 的字幕翻译工具，支持多种字幕格式和翻译服务。

## 功能特性

- ✅ 支持 SRT 格式字幕文件（可扩展 ASS、VTT）
- ✅ 模块化设计，易于扩展
- ✅ 翻译接口抽象，可接入多种翻译服务
- ✅ 现代化的 Web UI 界面
- ✅ 支持批量翻译
- ✅ **支持桌面应用（Electron）** - 可打包成 Windows/Mac/Linux 桌面应用

## 项目结构

```
subtitle-translater/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   │   └── translate/     # 翻译接口
│   │   ├── page.tsx           # 主页面
│   │   └── layout.tsx         # 布局
│   ├── core/                  # 核心业务逻辑
│   │   ├── parsers/           # 字幕解析器
│   │   │   ├── SubtitleParser.ts  # 抽象解析器
│   │   │   └── SRTParser.ts       # SRT 解析器
│   │   ├── translators/       # 翻译器
│   │   │   ├── Translator.ts      # 翻译接口
│   │   │   └── MockTranslator.ts  # 模拟翻译器
│   │   ├── generators/        # 字幕生成器
│   │   │   ├── SubtitleGenerator.ts  # 抽象生成器
│   │   │   └── SRTGenerator.ts       # SRT 生成器
│   │   └── SubtitleService.ts # 字幕服务（协调各模块）
│   └── types/                 # TypeScript 类型定义
│       └── subtitle.ts
├── electron/                  # Electron 桌面应用
│   ├── main.js                # Electron 主进程
│   └── preload.js             # Electron 预加载脚本
├── package.json
└── README.md
```

## 快速开始

### 安装依赖

```bash
yarn install
```

### 开发模式

```bash
yarn dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
yarn build
yarn start
```

## 桌面应用（Electron）

### 开发模式

在开发模式下运行 Electron 应用（会自动启动 Next.js 开发服务器）：

```bash
yarn electron:dev
```

或者分别启动：

```bash
# 终端1：启动 Next.js 开发服务器
yarn dev

# 终端2：启动 Electron
yarn electron
```

### 构建桌面应用

#### Windows

```bash
yarn electron:build:win
```

构建完成后，安装包位于 `dist/` 目录。

#### macOS

```bash
yarn electron:build:mac
```

#### Linux

```bash
yarn electron:build:linux
```

#### 通用构建（所有平台）

```bash
yarn electron:build
```

### Electron vs Tauri 说明

本项目使用 **Electron** 作为桌面应用框架。以下是两种方案的对比：

| 特性 | Electron | Tauri |
|------|----------|-------|
| **成熟度** | ⭐⭐⭐⭐⭐ 非常成熟，生态丰富 | ⭐⭐⭐ 相对较新 |
| **体积** | ~100-200MB | ~5-10MB |
| **内存占用** | 较高 | 较低 |
| **性能** | 良好 | 优秀 |
| **开发难度** | 简单，文档完善 | 需要 Rust 知识 |
| **打包速度** | 较快 | 较慢（需要编译 Rust） |
| **推荐场景** | 快速开发，需要丰富生态 | 追求体积和性能 |

**为什么选择 Electron？**
- ✅ 与 Next.js 集成简单
- ✅ 生态丰富，问题解决方案多
- ✅ 开发调试方便
- ✅ 适合快速迭代

**如果追求更小的体积和更好的性能**，可以考虑迁移到 Tauri，但需要：
- 学习 Rust
- 重构部分代码以适配 Tauri 的架构
- 处理 Next.js 与 Tauri 的集成

## 使用说明

1. 选择字幕文件（支持 .srt 格式）
2. 选择源语言和目标语言
3. 选择输出格式
4. 点击"开始翻译"
5. 下载翻译后的字幕文件

## 扩展翻译服务

当前使用 `MockTranslator` 作为示例。要接入真实的翻译服务，需要：

1. 创建新的翻译器类，实现 `Translator` 接口
2. 在 API 路由中替换 `MockTranslator`

示例：

```typescript
// src/core/translators/GoogleTranslator.ts
import { Translator } from './Translator';

export class GoogleTranslator implements Translator {
  getName(): string {
    return 'Google Translate';
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    // 调用 Google Translate API
    // ...
  }
}
```

然后在 `src/app/api/translate/route.ts` 中：

```typescript
import { GoogleTranslator } from '@/core/translators/GoogleTranslator';
// ...
service.setTranslator(new GoogleTranslator());
```

## 扩展字幕格式

### 添加新的解析器

创建新的解析器类，继承 `SubtitleParser`：

```typescript
// src/core/parsers/ASSParser.ts
import { SubtitleParser } from './SubtitleParser';
import { SubtitleData } from '@/types/subtitle';

export class ASSParser extends SubtitleParser {
  canParse(filename: string): boolean {
    return filename.toLowerCase().endsWith('.ass');
  }

  parse(content: string): SubtitleData {
    // 实现 ASS 格式解析逻辑
    // ...
  }
}
```

然后在 `SubtitleService` 构造函数中注册：

```typescript
this.registerParser(new ASSParser());
```

### 添加新的生成器

类似地，创建新的生成器类，继承 `SubtitleGenerator`：

```typescript
// src/core/generators/ASSGenerator.ts
import { SubtitleGenerator } from './SubtitleGenerator';

export class ASSGenerator extends SubtitleGenerator {
  getExtension(): string {
    return '.ass';
  }

  generate(data: SubtitleData): string {
    // 实现 ASS 格式生成逻辑
    // ...
  }
}
```

## CI/CD (GitHub Actions)

项目配置了 GitHub Actions 自动构建和发布流程：

### 工作流说明

- **main 分支**: 
  - ✅ 构建 Windows、macOS、Linux 三个平台的应用
  - ✅ 自动创建 GitHub Release 并上传构建产物
  - ✅ 使用 `package.json` 中的版本号作为 Release 标签

- **dev 分支**:
  - ✅ 构建 Windows、macOS、Linux 三个平台的应用
  - ❌ **不发布** Release（仅构建，不上传）

### 查看构建结果

1. 前往 GitHub 仓库的 **Actions** 标签页
2. 查看最新的工作流运行状态
3. 下载构建产物（Artifacts）或查看 Release（仅 main 分支）

### 手动触发

工作流会在推送到 `main` 或 `dev` 分支时自动触发。你也可以在 GitHub Actions 页面手动触发。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **桌面应用**: Electron
- **CI/CD**: GitHub Actions
- **架构**: 模块化设计，易于扩展

## 许可证

MIT
