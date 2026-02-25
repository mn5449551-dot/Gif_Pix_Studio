# 像素GIF工坊 (Pixel GIF Workshop)

将用户上传的图片转换为像素风格动画 GIF 的在线工具，专为微信表情包制作场景设计。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)

## 关于

像素GIF工坊是一个基于浏览器的 Web 应用，利用 AI 技术将普通图片转换为复古像素风格的动态 GIF。用户只需上传图片，选择动作类型，即可生成 16 帧的像素动画。

主要特点：
- 无需安装，直接在浏览器中使用
- AI 驱动，自动生成精灵图
- 背景透明处理
- 桌面宠物陪伴，实时反馈生成进度
- 本地存储，保护隐私

## 功能特性

- **AI 驱动转换**: 使用 Nano Banana 模型生成 4×4 (16帧) 精灵图
- **多种动作类型**: 跑步、攻击、待机等丰富动画效果
- **背景透明**: 自动识别并移除白色背景，生成透明 GIF
- **桌面宠物**: 伴随式的桌面宠物 Widget，提供生成进度提示
- **本地存储**: 所有数据存储在浏览器本地 (localStorage + IndexedDB)
- **GIF 编辑**: 调整帧率、删除特定帧、预览效果
- **批量导出**: 支持不同尺寸和格式的 GIF 导出

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/your-username/pixel-gif-workshop.git
cd pixel-gif-workshop/web

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 开始使用。

## 使用方法

### 1. 配置 API Key

首次使用需要配置 GrsAI API Key：

1. 访问设置页面 (`/settings`)
2. 在输入框中粘贴你的 API Key
3. 点击保存

### 2. 创建像素 GIF

1. 访问创建页面 (`/create`)
2. 点击上传区域，选择图片文件
3. 选择动作类型（跑步、跳舞、飞行等）
4. 点击「生成精灵图」按钮
5. 等待 AI 处理完成
6. 自动跳转到结果页面查看

### 3. 编辑和导出

在结果页面可以：
- 调整 GIF 帧率 (5-20 FPS)
- 删除不需要的帧
- 预览不同效果
- 下载 GIF 或精灵图
- 复制到剪贴板

## 文档

- [使用文档](./使用文档.md) - 详细用户指南

## 技术栈

- **框架**: Next.js 16 (App Router)
- **前端**: React 19, Tailwind CSS v4
- **GIF 编码**: gif.js.optimized
- **数据存储**: localStorage + IndexedDB
- **AI API**: GrsAI Nano Banana 模型

## 项目结构

```
web/
├── src/
│   ├── app/           # Next.js App Router 页面
│   │   ├── page.tsx           # 首页
│   │   ├── create/            # 创建页面
│   │   ├── result/            # 结果页面
│   │   ├── settings/          # 设置页面
│   │   └── api/               # API 代理
│   ├── components/    # React 组件
│   ├── hooks/         # 自定义 Hooks
│   └── lib/           # 核心工具函数
│       ├── constants.ts           # 常量定义
│       ├── types.ts               # 类型定义
│       ├── prompt.ts              # 提示词构建
│       ├── storage.ts             # localStorage
│       ├── gif-cache.ts           # IndexedDB
│       ├── image-processing.ts    # 图像处理
│       └── pet/                   # 桌面宠物模块
└── public/            # 静态资源
```

## 开发命令

```bash
cd web

npm run dev      # 启动开发服务器 (localhost:3000)
npm run build    # 生产环境构建
npm run lint     # ESLint 检查
```

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。
