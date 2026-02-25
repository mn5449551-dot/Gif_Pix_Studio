# 桌面宠物模块设计文档

## 概述

桌面宠物「小灵」是像素GIF工坊的伴随式交互功能，提供实时生成进度反馈、AI 辅助提示词优化、闲聊互动等能力。

**核心价值：**
- 降低工具感，增加情感化体验
- 在生成过程中提供实时状态反馈
- 通过对话方式辅助用户优化提示词

---

## 系统架构

### 模块结构

```
src/lib/pet/
├── pet-events.tsx      # React Context + usePetEvent Hook（核心）
├── pet-controller.ts   # 心情状态机
├── pet-scripts.ts      # 对话脚本模板
├── pet-llm.ts         # LLM 对话集成
└── pet-templates.ts   # Fallback 模板
```

### 层级关系

```
┌─────────────────────────────────────────────────────┐
│                    页面组件                          │
│  (create/page.tsx, result/[id]/page.tsx)           │
└─────────────────────┬───────────────────────────────┘
                      │ emitPetEvent()
                      ▼
┌─────────────────────────────────────────────────────┐
│              pet-events.tsx (PetProvider)           │
│  - 状态管理 (mood, script, chat, animation)         │
│  - 事件处理 (emitPetEvent)                          │
│  - UI 渲染 (宠物组件)                               │
└─────────────────────┬───────────────────────────────┘
                      │ reducePetEvent()
                      ▼
┌─────────────────────────────────────────────────────┐
│              pet-controller.ts                      │
│  - 状态机: mood 转换逻辑                            │
│  - createContext: 创建上下文                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              pet-llm.ts                            │
│  - routePetConversation() 对意图分类               │
│  - 提示词优化 / 闲聊 / 追问                         │
└─────────────────────────────────────────────────────┘
```

---

## 心情状态机

### Mood 状态定义

| 状态 | 触发条件 | 动画 | 脚本示例 |
|------|----------|------|----------|
| `idle` | 有图片，未生成 | 巡逻 | "小灵在，随时可以帮你打磨动作描述。" |
| `guide` | 无图片 | 引导 | "先上传一张角色图，我来帮你安排动作细节。" |
| `thinking` | 生成中 | 思考 | "正在处理中，我会盯着每一步进度。" |
| `happy` | 生成成功 | 欢呼 | "这次效果不错，我们可以继续调细节。" |
| `celebrate` | 首次成功 | 庆祝 | "成功！这版节奏很顺。" |
| `error` | 生成失败 | 沮丧 | "这次没成功，先检查 Key 和接口地址。" |

### 状态转换图

```
                    ┌─────────────────┐
                    │  page:create   │
                    │    :entered    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
      hasImage=true                   hasImage=false
              │                              │
              ▼                              ▼
         ┌───────┐                    ┌───────┐
         │ idle  │                    │ guide │
         └───┬───┘                    └───┬───┘
             │                            │
             │ image:uploaded            │ image:cleared
             │                            │
             ▼                            ▼
         ┌───────┐                    ┌───────┐
         │ idle  │                    │ guide │
         └───┬───┘                    └───┬───┘
             │
             │ task:generate:start
             │
             ▼
         ┌──────────┐
         │ thinking │
         └───┬──────┘
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
success  failed cancelled
    │        │        │
    ▼        ▼        ▼
celebrate error  idle/guide
 (if 1st)  │
    │        │
    └────┬───┘
         │
         ▼
       happy
         │
         │ (2s / 4s)
         │
         ▼
       idle
```

### 成功计数器

- `successStreak`: 记录连续成功次数
- 首次成功触发 `celebrate` 状态
- 后续成功触发 `happy` 状态
- 失败重置计数器

---

## 事件系统

### 事件列表

| 事件名 | 触发场景 | 携带数据 |
|--------|----------|----------|
| `page:create:entered` | 进入创建页 | createContext |
| `image:uploaded` | 图片上传成功 | createContext |
| `image:cleared` | 图片清除 | - |
| `image:audit` | 图片审核完成 | grade, summary |
| `task:generate:start` | 开始生成 | createContext |
| `task:generate:progress` | 生成进度更新 | progress |
| `task:generate:success` | 生成成功 | milestone |
| `task:generate:failed` | 生成失败 | reason |
| `task:generate:cancelled` | 生成取消 | - |
| `action:preview` | 预览动作 | actionId |
| `prompt:input:blur` | 提示词失焦 | hasContent |

### 事件处理流程

```
emitPetEvent(event, payload)
         │
         ▼
    ┌────────────┐
    │ 特殊处理?  │──yes──► 直接响应 (action:preview, prompt:input:blur)
    └─────┬──────┘
          │no
          ▼
    ┌────────────┐
    │ 状态机更新 │──────► reducePetEvent()
    │ mood切换   │       - 更新 mood
    │ 脚本切换   │       - 更新 successStreak
    └─────┬──────┘       - 更新 createContext
          │
          ▼
    ┌────────────┐
    │ 副作用处理  │──────►
    │ - 进度显示  │       - thinkingProgress
    │ - 动画触发  │       - demoAction (jump, fall)
    │ - 状态计时  │       - 定时回归 idle/guide
    └────────────┘
```

---

## 用户交互流程

### 主流程：生成 GIF

```
用户上传图片
      │
      ▼
emitPetEvent("image:uploaded")
      │
      ▼
pet-controller: mood → idle
      │
      ▼
宠物显示: "小灵在，随时可以帮你打磨动作描述。"
      │
      ▼
用户选择动作类型 → 点击预览
      │
      ▼
emitPetEvent("action:preview", { actionId })
      │
      ▼
宠物演示动作动画 (2.5s)
      │
      ▼
用户点击 "开始生成"
      │
      ▼
emitPetEvent("task:generate:start")
      │
      ▼
pet-controller: mood → thinking
      │
      ▼
宠物显示: "正在处理中，我会盯着每一步进度。"
      │
      ├─────────────────────┐
      │                     │
      ▼                     ▼
进度更新              完成/失败
emitPetEvent        emitPetEvent
("progress", x%)    ("success"/"failed")
      │                     │
      ▼                     ▼
宠物显示进度           mood → celebrate/happy/error
```

### 副流程：AI 对话优化提示词

```
用户点击宠物 / 打开聊天
      │
      ▼
打开聊天窗口 chatOpen=true
      │
      ▼
用户输入: "想要一个更快的奔跑"
      │
      ▼
sendChatMessage()
      │
      ▼
routePetConversation() - LLM 意图分类
      │
      ├─────────────────────────┐
      │                         │
      ▼                         ▼
intent = "optimize"      intent = "smalltalk"
      │                         │
      ▼                         ▼
LLM 返回优化后的          闲聊回复
actionDescriptionEn
      │
      ▼
显示优化建议 + 确认按钮
      │
      ▼
用户确认 → confirmPromptSuggestion()
      │
      ▼
提示词填入创建页 + 自动切换到该动作
```

### 副流程：用户点击宠物

```
用户点击宠物
      │
      ▼
clickCount++ → 判断阈值
      │
      ├──────────┬──────────┬──────────┐
      │          │          │          │
      ▼          ▼          ▼          ▼
   count<3   count=3    count=5    count=7+
   (ignored)  angry     (过渡)     attack
      │
      ▼
overlayMood = "happy" / "angry" / "attack"
      │
      ▼
显示对应脚本 + 3秒后恢复
```

---

## LLM 集成

### 支持的 LLM 提供商

| 提供商 | 配置字段 | 端点示例 |
|--------|----------|----------|
| 豆包 Ark | llmProvider="doubao_ark" | ark.cn-beijing.volces.com |
| OpenAI 兼容 | llmProvider="openai" | api.openai.com |

### 意图分类

```
用户消息
    │
    ▼
本地规则预判 (isLikelyOptimize / isLikelyClarify)
    │
    ├─ 明确关键词 → 直接路由
    │
    ▼
LLM 路由 (createConversationRoutePrompt)
    │
    ▼
┌─────────┬─────────┬─────────┐
│smalltalk│optimize │clarify │
└─────────┴─────────┴─────────┘
```

- **smalltalk**: 闲聊对话，返回趣味回复
- **optimize**: 优化提示词，返回英文动作描述
- **clarify**: 信息不足，生成追问问题

### Fallback 机制

当 LLM 调用失败时：

1. **本地意图分类**: `classifyIntentLocally()` - 基于关键词判断
2. **闲聊回复**: `pickSmalltalkFallbackReply()` - 内置回复池
3. **动作描述**: `getFallbackActionDescription()` - 模板填充

---

## 数据存储

### localStorage 键

| 键名 | 内容 | 用途 |
|------|------|------|
| `gifwechat_pet_preferences` | PetPreferences | 宠物设置（启用/收起/上次心情） |
| `gifwechat.pet.profile.v1` | PetPersonaProfile | 宠物人设（会话轮次计数） |
| `gifwechat.pet.chat.history.v1` | PetChatHistoryItem[] | 聊天历史（最近20条） |

### 数据结构

```typescript
interface PetPreferences {
  enabled: boolean;    // 是否启用
  collapsed: boolean;  // 是否收起
  lastMood: PetMood;   // 上次心情
}

interface PetChatHistoryItem {
  id: string;
  title: string;       // 会话标题
  createdAt: string;
  updatedAt: string;
  messages: PetChatMessage[];
}

interface PetChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}
```

---

## UI 组件

### 宠物组件结构

```
PetWidget (通过 usePetEvent 获取状态)
  │
  ├── PetSprite         # 像素动画 Sprite
  │     ├── mood           # 心情状态
  │     ├── overlayMood    # 覆盖心情（点击反馈）
  │     ├── demoAction     # 演示动作
  │     └── autoAnim      # 自主巡逻
  │
  ├── PetBubble         # 对话气泡
  │     ├── script        # 当前脚本
  │     ├── open          # 是否显示
  │     └── thinking      # 思考进度环
  │
  └── PetChat (可选)    # 聊天面板
        ├── messages      # 消息列表
        ├── input         # 输入框
        └── history       # 历史会话
```

### 动画系统

| 动画名 | 触发场景 | 时长 |
|--------|----------|------|
| patrol_left | 空闲巡逻 - 左 | 2s |
| patrol_right | 空闲巡逻 - 右 | 2s |
| auto_jump | 空闲巡逻 - 跳跃 | 1.5s |
| jump | 图片审核优秀 | 1.5s |
| fall | 取消生成 | 1.5s |
| walk_right | 聊天响应 | 1s |

---

## 配置项

### 常量定义 (constants.ts)

```typescript
// LLM 配置
LLM_TIMEOUT_MS = 20_000           // 请求超时
LLM_RATE_LIMIT_PER_MIN = 6        // 速率限制
LLM_MAX_RETRY = 1                 // 重试次数

// 动画时长
ACTION_DEMO_DURATION_MS = 2_500   // 动作演示
BRIEF_ANIM_DURATION_MS = 1_500    // 短暂动画
CHAT_RESPOND_ANIM_MS = 1_000      // 聊天响应

// 心情回归
HAPPY_RETURN_MS = 2_000           // happy → idle
CELEBRATE_RETURN_MS = 4_000       // celebrate → idle

// 点击阈值
ANGRY_CLICK_THRESHOLD = 3          // 变生气
ATTACK_CLICK_THRESHOLD = 7         // 攻击
CLICK_RESET_DELAY_MS = 3_000       // 重置点击计数
```

---

## 扩展指南

### 添加新的心情状态

1. **types.ts**: 添加 `PetMood` 类型
2. **pet-controller.ts**: 添加状态转换逻辑
3. **pet-scripts.ts**: 添加对应脚本池
4. **pet-events.tsx**: 添加动画处理（可选）

### 添加新的意图类型

1. **types.ts**: 添加 `PetIntent` 类型
2. **pet-llm.ts**:
   - 修改 `createConversationRoutePrompt()` 路由规则
   - 添加对应处理逻辑
3. **pet-scripts.ts**: 添加对应回复（可选）

### 添加新的 LLM 提供商

1. **constants.ts**: 添加默认配置
2. **pet-llm.ts**:
   - 修改 `buildLlmEndpoint()` 适配端点
   - 修改请求头构建逻辑
   - 修改 `supportsJsonResponseFormat()` 兼容性处理

---

## 提示词策略

### 1. 提示词优化 (Optimize)

当用户输入动作相关描述时，调用 LLM 将其中文化为英文 prompt。

#### System Prompt

```
你是一个像素动画提示词助手，专为 16 帧角色精灵动画提炼动作描述。
产品背景：你的输出将注入英文 prompt，用于 AI 生成 4×4 精灵表（16 帧无缝循环）。

当前动作：{actionId}（{actionLabel}）
用户已填描述：{customPrompt || "无"}

[模板动作模式]
这是「{actionLabel}」模板动作：你的输出作为补充约束追加到已有模板，
请聚焦风格细节（节奏感、力度、姿态特征），勿重复帧数或格式说明（30-60 词）。

[自定义动作模式]
这是「自定义」动作：你的输出将直接作为完整动作描述，
请包含动作名称、主要节奏和关键姿态细节（40-80 词）。

优质描述要素（按需选用）：
- 节奏感：快速爆发 / 缓慢流畅 / 明显停顿 / 弹性回弹
- 姿态特征：重心前倾、摆臂幅度、步幅大小、头部动势
- 个性细节：夸张风格 / 道具 / 尾巴 / 服饰飘动 / 粒子效果
- 循环衔接：第 16 帧自然衔接回第 1 帧

规则：
1. 信息不足 → need_clarify=true，question_zh 给出中文追问（30 字内）。
2. 信息足够 → need_clarify=false，action_description_en 给出英文描述。
3. 仅输出 JSON。
```

#### 输出格式

```json
{
  "need_clarify": false,
  "question_zh": "",
  "action_description_en": "A fast 16-frame run cycle with stronger stride..."
}
```

#### 参数配置

| 参数 | 值 | 说明 |
|------|-----|------|
| temperature | 0.4 | 适度创意，避免过于随机 |
| max_tokens | 300 | 足够生成 30-120 词英文描述 |
| response_format | json_object | 强制 JSON 输出（部分模型） |

---

### 2. 对话路由 (Route Conversation)

判断用户意图：闲聊 / 优化提示词 / 追问细节。

#### System Prompt

```
你是"小灵"，像素动图创作搭档，语气俏皮简短（1-3句）。
你要先判断用户输入意图，再输出统一 JSON。

当前动作模板：{actionId}（{actionLabel}）
当前自定义描述：{customPrompt || "无"}

intent 仅可为：smalltalk | optimize | clarify

路由规则：
1. 用户明确要求生成/优化/动作细节 -> optimize
2. 与创作相关但关键信息不足 -> clarify
3. 其他聊天 -> smalltalk

返回 JSON（不要额外文本）：
{"intent":"smalltalk","reply_zh":"","need_clarify":false,"question_zh":"","action_description_en":"","should_offer_fill":false}

字段规则：
- smalltalk: reply_zh 给闲聊回复；action_description_en 置空。
- optimize: reply_zh 先确认理解；action_description_en 给英文动作描述（30-90词）。
- clarify: need_clarify=true，question_zh 只问一个关键问题，reply_zh 简短追问。
- should_offer_fill 仅在建议"可帮你整理描述/可填入"时为 true。
```

#### 输出格式

```json
{
  "intent": "optimize",
  "reply_zh": "明白你想让动作更快！我来帮你整理~",
  "need_clarify": false,
  "question_zh": "",
  "action_description_en": "A fast-paced 16-frame run with explosive speed...",
  "should_offer_fill": true
}
```

---

### 3. 本地意图分类 (Fallback)

当 LLM 调用失败时的本地兜底策略。

#### 关键词匹配规则

**Optimize 关键词**:
```
优化, 整理, 润色, 改写, 生成, 动作, prompt, 提示词, 细节, 描述,
奔跑, 行走, 跳跃, 攻击, 待机, 倒地,
run, walk, jump, attack, idle, fall
```

**Clarify 关键词**:
```
不知道, 不确定, 怎么写, 帮我想, 没想好, 不太会, 给我建议
```

#### Fallback 响应

| 场景 | 返回值 |
|------|--------|
| 闲聊 | 固定回复池随机选择 |
| 优化 | 模板填充 `ACTION_FALLBACK_MAP[actionId]` + 用户输入 |
| 追问 | `getDefaultClarifyQuestion(actionId)` |

---

### 4. 追问问题模板

每个动作类型对应的默认追问问题：

| 动作 | 追问问题 |
|------|----------|
| walk | 你希望是轻松步态、正常步态，还是夸张步态？ |
| run | 你希望跑步节奏偏快还是偏稳，角色重心要前倾多少？ |
| idle | 待机时你更希望表现呼吸感、头部转动，还是衣摆轻摆？ |
| jump | 跳跃动作你希望突出起跳力度，还是落地缓冲感？ |
| attack | 攻击动作你希望偏重挥击速度还是打击停顿感？ |
| fall | 倒地动作你希望偏夸张还是偏自然？ |
| custom | 请补充动作节奏、幅度和道具细节，我再帮你优化。 |

---

### 5. Fallback 动作描述模板

当 LLM 不可用时的本地模板：

```typescript
const ACTION_FALLBACK_MAP = {
  walk: "A smooth 16-frame walk loop with alternating leg steps and gentle opposite arm swing.",
  run: "A fast 16-frame run cycle with stronger stride and slight forward lean. Keep one fixed facing direction across all 16 frames; never mirror, flip, or turn to the opposite side.",
  idle: "A subtle 16-frame idle loop with breathing motion and tiny shoulder sway.",
  jump: "A 16-frame jump action covering crouch, takeoff, airborne arc, landing impact, and recovery.",
  attack: "A 16-frame attack sequence with wind-up, strike impact, brief hold, and clean recovery.",
  fall: "A 16-frame fall action showing imbalance, descent, impact contact, and settle motion.",
  custom: "A clean 16-frame custom action loop with clear anticipation, main motion, and recovery.",
};
```

---

### 6. 速率限制与容错

| 策略 | 配置 |
|------|------|
| 速率限制 | 每分钟 6 次请求 |
| 超时 | 20 秒 |
| 重试 | 1 次（网络错误/超时） |
| 失败处理 | 本地 Fallback 兜底 |

---

### 7. 完整对话流程

```
用户: "帮我做一个更有力量感的攻击动作"

Step 1: 路由判断 (LLM)
  → intent: "optimize"

Step 2: 生成描述 (LLM)
  → action_description_en: "A powerful 16-frame attack with strong wind-up..."

Step 3: 返回结果
  → 显示优化后的英文描述
  → 提供"确认填入"按钮

用户点击确认:
  → promptCommand 发送到创建页
  → 自动填入自定义提示词
  → 切换到对应动作类型
```
