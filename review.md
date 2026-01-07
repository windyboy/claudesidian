# Claudesidian OpenCode 架构设计完整问题清单与改进方案

---

## 📑 问题总览

| 编号 | 类别 | 问题 | 严重程度 | 优先级 |
|------|------|------|----------|--------|
| P01 | 架构边界 | 职责边界模糊，Obsidian 层仍承担业务逻辑 | 🔴 高 | P0 |
| P02 | 状态管理 | 状态同步机制缺失 | 🔴 高 | P0 |
| P03 | 状态管理 | 状态所有权未定义 | 🔴 高 | P0 |
| P04 | 事件系统 | 事件类型定义不完整 | 🔴 高 | P0 |
| P05 | 错误处理 | 错误处理策略不明确 | 🔴 高 | P0 |
| P06 | 安全性 | 危险命令检测可被绕过 | 🔴 高 | P0 |
| P07 | 安全性 | 路径保护未处理符号链接 | 🔴 高 | P0 |
| P08 | 安全性 | MCP 服务器沙箱边界未定义 | 🔴 高 | P0 |
| P09 | 依赖管理 | Plugin 间依赖未定义 | 🟡 中 | P1 |
| P10 | 性能 | Vault 搜索无索引机制 | 🟡 中 | P1 |
| P11 | 性能 | 事件流无背压控制 | 🟡 中 | P1 |
| P12 | 性能 | 图片处理阻塞 UI 线程 | 🟡 中 | P1 |
| P13 | 性能 | getVaultInfo 每次全量遍历 | 🟡 中 | P1 |
| P14 | 配置管理 | 配置验证缺失 | 🟡 中 | P1 |
| P15 | 可观测性 | 缺少结构化日志和指标 | 🟡 中 | P1 |
| P16 | 迁移方案 | 无渐进式迁移路径 | 🟡 中 | P1 |
| P17 | 迁移方案 | 无回滚策略 | 🟡 中 | P1 |
| P18 | 迁移方案 | 无数据迁移脚本 | 🟡 中 | P1 |
| P19 | API 设计 | 工具返回值结构不一致 | 🟢 低 | P2 |
| P20 | API 设计 | 缺少 API 版本控制 | 🟢 低 | P2 |
| P21 | 文档 | 缺少时序图和交互流程 | 🟢 低 | P2 |
| P22 | 测试 | 无测试策略定义 | 🟢 低 | P2 |
| P23 | 扩展性 | 自定义工具注册机制不清晰 | 🟢 低 | P2 |
| P24 | 国际化 | 错误消息硬编码 | 🟢 低 | P2 |

---

## 🔴 高严重度问题详解

### P01: 职责边界模糊

**问题描述**

文档声称遵循"薄层原则"，Obsidian 插件仅负责 UI，但实际设计中多处违反：

```typescript
// 文档中的设计 - Obsidian 层仍包含业务逻辑
ImageContextManager: "图片编码 → Obsidian 插件处理（转换为 base64）"
FileContextManager: "上下文路径扫描（ContextPathScanner）"
ApprovalManager: "权限规则管理、权限持久化"
ConversationStorage: "对话历史存储 → 保留在 Obsidian（本地缓存）"
```

**影响范围**
- 代码重复：相同逻辑可能在多处实现
- 测试困难：业务逻辑分散难以单元测试
- 维护成本：修改需要同时更新多层

**改进方案**

```typescript
// ============================================
// 1. 重新定义层级职责
// ============================================

/**
 * 层级职责定义
 */
interface LayerResponsibilities {
  obsidianPlugin: {
    // 仅负责
    allowed: [
      'UI 组件渲染',
      '用户事件捕获',
      '事件转发到 OpenCode Client',
      'OpenCode 事件流消费与展示',
      'Obsidian API 调用代理'
    ];
    // 禁止
    forbidden: [
      '业务逻辑处理',
      '状态计算',
      '数据转换',
      '权限判断'
    ];
  };
  
  opencodeClient: {
    allowed: [
      '与 OpenCode Server 通信',
      '事件流管理',
      '本地 UI 状态缓存',
      '请求/响应转换'
    ];
  };
  
  opencodePlugin: {
    allowed: [
      '所有业务逻辑',
      '工具实现',
      '权限管理',
      '状态管理',
      '数据持久化'
    ];
  };
}

// ============================================
// 2. 迁移具体功能
// ============================================

// 图片处理 - 从 Obsidian 迁移到 OpenCode Plugin
// 之前（错误）
class ImageContextManager {
  async processImage(file: TFile): Promise<string> {
    const buffer = await this.vault.readBinary(file);
    return btoa(String.fromCharCode(...new Uint8Array(buffer))); // 业务逻辑
  }
}

// 之后（正确）
// Obsidian 层 - 仅转发
class ImageContextUI {
  async onImageSelected(file: TFile): void {
    // 仅发送文件路径，不处理内容
    await this.opencodeClient.sendEvent({
      type: 'context.image.add',
      payload: { path: file.path }
    });
  }
}

// OpenCode Plugin 层 - 处理逻辑
// plugins/image-processor.ts
export default {
  name: "image-processor",
  hooks: {
    "context.image.add": async (ctx, event) => {
      const content = await ctx.vault.readBinary(event.payload.path);
      const base64 = Buffer.from(content).toString('base64');
      const mimeType = getMimeType(event.payload.path);
      
      ctx.session.addImageContext({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64
        }
      });
    }
  }
};

// ============================================
// 3. 上下文扫描迁移
// ============================================

// 之前（错误）- Obsidian 层
class ContextPathScanner {
  async scan(paths: string[]): Promise<FileContext[]> {
    // 复杂的扫描逻辑在 Obsidian 层
  }
}

// 之后（正确）- OpenCode Plugin 层
// plugins/vault-context.ts
export default {
  name: "vault-context",
  tools: [
    {
      name: "scan_context_paths",
      description: "扫描指定路径获取上下文",
      parameters: {
        type: "object",
        properties: {
          paths: { type: "array", items: { type: "string" } },
          depth: { type: "number", default: 3 },
          includeContent: { type: "boolean", default: false }
        }
      },
      execute: async (ctx, params) => {
        const results: FileContext[] = [];
        for (const path of params.paths) {
          const files = await ctx.vault.list(path, { recursive: true, maxDepth: params.depth });
          for (const file of files) {
            results.push({
              path: file.path,
              type: file.type,
              size: file.size,
              content: params.includeContent ? await ctx.vault.read(file.path) : undefined
            });
          }
        }
        return { success: true, contexts: results };
      }
    }
  ]
};

// Obsidian 层 - 仅展示
class ContextPathUI {
  async refreshContexts(): void {
    // 调用 OpenCode 工具获取数据
    const result = await this.opencodeClient.callTool('scan_context_paths', {
      paths: this.selectedPaths,
      depth: 3
    });
    // 仅负责渲染
    this.renderContextList(result.contexts);
  }
}
```

**验收标准**
- [ ] Obsidian 插件代码中无 `if/else` 业务判断逻辑
- [ ] 所有数据转换在 OpenCode Plugin 层完成
- [ ] Obsidian 层代码行数减少 50% 以上

---

### P02: 状态同步机制缺失

**问题描述**

设计中存在多处状态，但未定义同步机制：

```typescript
// 分散在不同位置的状态
planModeState      // Obsidian 内存
asyncSubagentStates // Obsidian 内存
approvedPlan       // 会话存储
disabledTools      // MCP 配置
currentSession     // OpenCode Server
permissionRules    // opencode.jsonc
```

**影响范围**
- 状态不一致：用户看到的状态与实际状态不符
- 数据丢失：Obsidian 重启后内存状态丢失
- 并发问题：多窗口操作导致状态冲突

**改进方案**

```typescript
// ============================================
// 1. 定义状态分类与同步策略
// ============================================

/**
 * 状态分类
 */
enum StateCategory {
  /** 服务器权威状态 - OpenCode Server 是唯一真相源 */
  ServerAuthoritative = 'server_authoritative',
  
  /** 客户端本地状态 - 仅存在于 Obsidian，可丢失 */
  ClientLocal = 'client_local',
  
  /** 双向同步状态 - 需要在客户端和服务器间同步 */
  Bidirectional = 'bidirectional',
  
  /** 派生状态 - 从其他状态计算得出，不存储 */
  Derived = 'derived'
}

/**
 * 状态注册表
 */
const STATE_REGISTRY: Record<string, {
  category: StateCategory;
  syncStrategy: SyncStrategy;
  conflictResolution: ConflictResolution;
}> = {
  // 服务器权威状态
  'session.messages': {
    category: StateCategory.ServerAuthoritative,
    syncStrategy: { type: 'pull', interval: null, trigger: 'event' },
    conflictResolution: { strategy: 'server_wins' }
  },
  'session.planState': {
    category: StateCategory.ServerAuthoritative,
    syncStrategy: { type: 'pull', interval: null, trigger: 'event' },
    conflictResolution: { strategy: 'server_wins' }
  },
  'permissions.rules': {
    category: StateCategory.ServerAuthoritative,
    syncStrategy: { type: 'pull', interval: 60000, trigger: 'startup' },
    conflictResolution: { strategy: 'server_wins' }
  },
  
  // 客户端本地状态
  'ui.expandedMessages': {
    category: StateCategory.ClientLocal,
    syncStrategy: { type: 'none' },
    conflictResolution: { strategy: 'not_applicable' }
  },
  'ui.scrollPosition': {
    category: StateCategory.ClientLocal,
    syncStrategy: { type: 'none' },
    conflictResolution: { strategy: 'not_applicable' }
  },
  
  // 双向同步状态
  'context.selectedFiles': {
    category: StateCategory.Bidirectional,
    syncStrategy: { type: 'push_pull', interval: null, trigger: 'change' },
    conflictResolution: { strategy: 'last_write_wins', tiebreaker: 'timestamp' }
  },
  'context.currentNote': {
    category: StateCategory.Bidirectional,
    syncStrategy: { type: 'push', interval: null, trigger: 'change' },
    conflictResolution: { strategy: 'client_wins' }
  },
  
  // 派生状态
  'ui.canSubmit': {
    category: StateCategory.Derived,
    syncStrategy: { type: 'none' },
    conflictResolution: { strategy: 'not_applicable' },
    derivedFrom: ['session.isStreaming', 'input.content', 'permissions.current']
  }
};

// ============================================
// 2. 实现状态同步管理器
// ============================================

interface SyncStrategy {
  type: 'none' | 'pull' | 'push' | 'push_pull';
  interval: number | null;  // 毫秒，null 表示不定时同步
  trigger: 'startup' | 'change' | 'event' | 'manual';
}

interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'last_write_wins' | 'merge' | 'not_applicable';
  tiebreaker?: 'timestamp' | 'version';
  mergeFunction?: (server: any, client: any) => any;
}

class StateSyncManager {
  private stateVersions: Map<string, number> = new Map();
  private pendingChanges: Map<string, any> = new Map();
  private syncInProgress: Set<string> = new Set();
  
  constructor(
    private opencodeClient: OpenCodeClient,
    private localStorage: LocalStorage
  ) {
    this.setupEventListeners();
    this.startPeriodicSync();
  }
  
  /**
   * 获取状态（自动处理同步）
   */
  async getState<T>(key: string): Promise<T> {
    const config = STATE_REGISTRY[key];
    if (!config) {
      throw new Error(`Unknown state key: ${key}`);
    }
    
    switch (config.category) {
      case StateCategory.ServerAuthoritative:
        return this.fetchFromServer(key);
        
      case StateCategory.ClientLocal:
        return this.localStorage.get(key);
        
      case StateCategory.Bidirectional:
        return this.getWithSync(key);
        
      case StateCategory.Derived:
        return this.computeDerived(key);
    }
  }
  
  /**
   * 设置状态（自动处理同步）
   */
  async setState<T>(key: string, value: T): Promise<void> {
    const config = STATE_REGISTRY[key];
    if (!config) {
      throw new Error(`Unknown state key: ${key}`);
    }
    
    switch (config.category) {
      case StateCategory.ServerAuthoritative:
        throw new Error(`Cannot directly set server-authoritative state: ${key}`);
        
      case StateCategory.ClientLocal:
        this.localStorage.set(key, value);
        break;
        
      case StateCategory.Bidirectional:
        await this.setWithSync(key, value);
        break;
        
      case StateCategory.Derived:
        throw new Error(`Cannot set derived state: ${key}`);
    }
    
    this.notifyStateChange(key, value);
  }
  
  /**
   * 处理服务器推送的状态更新
   */
  private handleServerStateUpdate(event: StateUpdateEvent): void {
    const { key, value, version } = event;
    const config = STATE_REGISTRY[key];
    
    if (config?.category === StateCategory.ServerAuthoritative) {
      // 服务器权威状态直接接受
      this.localStorage.set(key, value);
      this.stateVersions.set(key, version);
      this.notifyStateChange(key, value);
    } else if (config?.category === StateCategory.Bidirectional) {
      // 双向同步状态需要冲突解决
      this.resolveConflict(key, value, version);
    }
  }
  
  /**
   * 冲突解决
   */
  private async resolveConflict(key: string, serverValue: any, serverVersion: number): Promise<void> {
    const config = STATE_REGISTRY[key];
    const localValue = this.localStorage.get(key);
    const localVersion = this.stateVersions.get(key) || 0;
    
    let resolvedValue: any;
    
    switch (config.conflictResolution.strategy) {
      case 'server_wins':
        resolvedValue = serverValue;
        break;
        
      case 'client_wins':
        resolvedValue = localValue;
        // 需要推送回服务器
        await this.pushToServer(key, localValue);
        return;
        
      case 'last_write_wins':
        resolvedValue = serverVersion > localVersion ? serverValue : localValue;
        if (serverVersion <= localVersion) {
          await this.pushToServer(key, localValue);
          return;
        }
        break;
        
      case 'merge':
        resolvedValue = config.conflictResolution.mergeFunction!(serverValue, localValue);
        await this.pushToServer(key, resolvedValue);
        break;
    }
    
    this.localStorage.set(key, resolvedValue);
    this.stateVersions.set(key, Math.max(serverVersion, localVersion) + 1);
    this.notifyStateChange(key, resolvedValue);
  }
  
  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    this.opencodeClient.on('state.updated', (event) => {
      this.handleServerStateUpdate(event);
    });
    
    this.opencodeClient.on('session.created', () => {
      this.syncAllBidirectionalStates();
    });
    
    this.opencodeClient.on('reconnected', () => {
      this.syncAllBidirectionalStates();
    });
  }
  
  /**
   * 定时同步
   */
  private startPeriodicSync(): void {
    for (const [key, config] of Object.entries(STATE_REGISTRY)) {
      if (config.syncStrategy.interval) {
        setInterval(() => {
          this.syncState(key);
        }, config.syncStrategy.interval);
      }
    }
  }
}

// ============================================
// 3. 状态持久化策略
// ============================================

interface PersistenceConfig {
  /** 存储位置 */
  storage: 'memory' | 'localStorage' | 'indexedDB' | 'file';
  
  /** 是否加密 */
  encrypted: boolean;
  
  /** 过期时间（毫秒） */
  ttl: number | null;
  
  /** 最大存储条目数 */
  maxEntries: number | null;
}

const PERSISTENCE_CONFIG: Record<string, PersistenceConfig> = {
  'session.messages': {
    storage: 'indexedDB',
    encrypted: false,
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 天
    maxEntries: 1000
  },
  'permissions.approvalHistory': {
    storage: 'indexedDB',
    encrypted: true,
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 天
    maxEntries: 10000
  },
  'ui.preferences': {
    storage: 'localStorage',
    encrypted: false,
    ttl: null,
    maxEntries: null
  }
};
```

**验收标准**
- [ ] 所有状态都在 STATE_REGISTRY 中注册
- [ ] 状态同步有明确的冲突解决策略
- [ ] Obsidian 重启后状态正确恢复
- [ ] 多窗口操作不会导致状态冲突

---

### P03: 状态所有权未定义

**问题描述**

文档中多处状态的所有权不明确：

```typescript
// 谁拥有这些状态？谁可以修改？
planModeState: "在 Obsidian 内存中，但影响 OpenCode 行为"
approvedPlan: "在会话存储中，但 OpenCode 需要读取"
disabledTools: "在 MCP 配置中，但运行时可修改"
```

**改进方案**

```typescript
// ============================================
// 1. 定义状态所有权模型
// ============================================

/**
 * 状态所有权定义
 */
interface StateOwnership {
  /** 所有者 - 唯一可以修改状态的实体 */
  owner: 'obsidian' | 'opencode_client' | 'opencode_server' | 'opencode_plugin';
  
  /** 读取者 - 可以读取状态的实体列表 */
  readers: Array<'obsidian' | 'opencode_client' | 'opencode_server' | 'opencode_plugin'>;
  
  /** 修改方式 */
  mutationMethod: 'direct' | 'request' | 'event';
  
  /** 通知方式 */
  notificationMethod: 'push' | 'pull' | 'none';
}

const STATE_OWNERSHIP: Record<string, StateOwnership> = {
  // ========== OpenCode Server 拥有 ==========
  'session.id': {
    owner: 'opencode_server',
    readers: ['obsidian', 'opencode_client', 'opencode_plugin'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  'session.messages': {
    owner: 'opencode_server',
    readers: ['obsidian', 'opencode_client', 'opencode_plugin'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  'session.isStreaming': {
    owner: 'opencode_server',
    readers: ['obsidian', 'opencode_client'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  
  // ========== OpenCode Plugin 拥有 ==========
  'plan.state': {
    owner: 'opencode_plugin',  // plan-mode.ts
    readers: ['obsidian', 'opencode_client', 'opencode_server'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  'plan.currentPlan': {
    owner: 'opencode_plugin',
    readers: ['obsidian', 'opencode_client'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  'permissions.rules': {
    owner: 'opencode_plugin',  // permission-manager.ts
    readers: ['obsidian', 'opencode_client', 'opencode_server'],
    mutationMethod: 'request',  // 通过 API 请求修改
    notificationMethod: 'push'
  },
  'permissions.sessionOverrides': {
    owner: 'opencode_plugin',
    readers: ['obsidian', 'opencode_server'],
    mutationMethod: 'request',
    notificationMethod: 'push'
  },
  
  // ========== Obsidian 拥有 ==========
  'context.currentNote': {
    owner: 'obsidian',
    readers: ['opencode_client', 'opencode_plugin'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  'context.selectedFiles': {
    owner: 'obsidian',
    readers: ['opencode_client', 'opencode_plugin'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  'ui.theme': {
    owner: 'obsidian',
    readers: ['opencode_client'],
    mutationMethod: 'direct',
    notificationMethod: 'none'
  },
  
  // ========== OpenCode Client 拥有 ==========
  'client.connectionState': {
    owner: 'opencode_client',
    readers: ['obsidian'],
    mutationMethod: 'direct',
    notificationMethod: 'push'
  },
  'client.pendingRequests': {
    owner: 'opencode_client',
    readers: ['obsidian'],
    mutationMethod: 'direct',
    notificationMethod: 'none'
  }
};

// ============================================
// 2. 实现所有权强制执行
// ============================================

class StateGuard {
  constructor(private currentEntity: string) {}
  
  /**
   * 检查是否可以修改状态
   */
  canMutate(stateKey: string): boolean {
    const ownership = STATE_OWNERSHIP[stateKey];
    if (!ownership) {
      console.warn(`Unknown state key: ${stateKey}`);
      return false;
    }
    return ownership.owner === this.currentEntity;
  }
  
  /**
   * 检查是否可以读取状态
   */
  canRead(stateKey: string): boolean {
    const ownership = STATE_OWNERSHIP[stateKey];
    if (!ownership) {
      return false;
    }
    return ownership.readers.includes(this.currentEntity as any);
  }
  
  /**
   * 安全地修改状态
   */
  async mutate<T>(stateKey: string, value: T, stateManager: StateManager): Promise<void> {
    if (!this.canMutate(stateKey)) {
      throw new StateOwnershipError(
        `Entity '${this.currentEntity}' cannot mutate state '${stateKey}'. ` +
        `Owner is '${STATE_OWNERSHIP[stateKey]?.owner}'`
      );
    }
    
    const ownership = STATE_OWNERSHIP[stateKey];
    
    switch (ownership.mutationMethod) {
      case 'direct':
        await stateManager.setDirect(stateKey, value);
        break;
      case 'request':
        await stateManager.requestMutation(stateKey, value);
        break;
      case 'event':
        await stateManager.emitMutationEvent(stateKey, value);
        break;
    }
    
    // 通知订阅者
    if (ownership.notificationMethod === 'push') {
      await stateManager.notifyReaders(stateKey, value, ownership.readers);
    }
  }
}

// ============================================
// 3. 跨实体状态请求协议
// ============================================

/**
 * 状态修改请求（当非所有者需要修改状态时）
 */
interface StateMutationRequest {
  requestId: string;
  stateKey: string;
  requestedValue: any;
  requester: string;
  reason: string;
  timestamp: number;
}

/**
 * 状态修改响应
 */
interface StateMutationResponse {
  requestId: string;
  approved: boolean;
  actualValue?: any;
  reason?: string;
}

// Obsidian 请求修改 permissions.rules 的示例
async function requestPermissionChange(
  client: OpenCodeClient,
  toolName: string,
  newPermission: 'allow' | 'deny' | 'ask'
): Promise<boolean> {
  const request: StateMutationRequest = {
    requestId: generateId(),
    stateKey: 'permissions.rules',
    requestedValue: { [toolName]: newPermission },
    requester: 'obsidian',
    reason: 'User changed permission in settings UI',
    timestamp: Date.now()
  };
  
  const response = await client.requestStateMutation(request);
  
  if (!response.approved) {
    console.warn(`Permission change denied: ${response.reason}`);
    return false;
  }
  
  return true;
}
```

**验收标准**
- [ ] 每个状态都有明确的所有者
- [ ] 非所有者无法直接修改状态
- [ ] 跨实体状态修改有明确的请求协议

---

### P04: 事件类型定义不完整

**问题描述**

文档定义的事件类型与实际使用不匹配：

```typescript
// 文档中定义的事件
type Event = 
  | { type: "message.updated" }
  | { type: "tool.use" }
  | { type: "tool.result" }
  // ...

// 实际代码中使用但未定义的事件
"message.before_send"      // slash-commands.ts
"mcp.server.started"       // mcp-router.ts
"mcp.server.stopped"       // mcp-router.ts
"permission.requested"     // permission-manager.ts
"permission.granted"       // permission-manager.ts
"plan.step.completed"      // plan-mode.ts
"session.context.updated"  // vault-context.ts
```

**改进方案**

```typescript
// ============================================
// 1. 完整事件类型定义
// ============================================

/**
 * 事件命名空间
 */
namespace OpenCodeEvents {
  // ========== 会话生命周期事件 ==========
  export namespace Session {
    export interface Created {
      type: 'session.created';
      payload: {
        sessionId: string;
        createdAt: number;
        config: SessionConfig;
      };
    }
    
    export interface Resumed {
      type: 'session.resumed';
      payload: {
        sessionId: string;
        resumedAt: number;
        messageCount: number;
      };
    }
    
    export interface Ended {
      type: 'session.ended';
      payload: {
        sessionId: string;
        endedAt: number;
        reason: 'user' | 'timeout' | 'error';
      };
    }
    
    export interface StateChanged {
      type: 'session.state_changed';
      payload: {
        sessionId: string;
        previousState: SessionState;
        currentState: SessionState;
      };
    }
    
    export interface ContextUpdated {
      type: 'session.context_updated';
      payload: {
        sessionId: string;
        contextType: 'file' | 'image' | 'note' | 'custom';
        action: 'added' | 'removed' | 'updated';
        context: ContextItem;
      };
    }
  }
  
  // ========== 消息事件 ==========
  export namespace Message {
    export interface BeforeSend {
      type: 'message.before_send';
      payload: {
        sessionId: string;
        content: string;
        contexts: ContextItem[];
        /** 允许修改消息内容 */
        mutable: true;
      };
      /** 返回修改后的内容，或 null 取消发送 */
      result?: { content: string } | null;
    }
    
    export interface Sent {
      type: 'message.sent';
      payload: {
        sessionId: string;
        messageId: string;
        content: string;
        sentAt: number;
      };
    }
    
    export interface StreamStarted {
      type: 'message.stream_started';
      payload: {
        sessionId: string;
        messageId: string;
      };
    }
    
    export interface StreamChunk {
      type: 'message.stream_chunk';
      payload: {
        sessionId: string;
        messageId: string;
        chunk: string;
        chunkIndex: number;
      };
    }
    
    export interface StreamEnded {
      type: 'message.stream_ended';
      payload: {
        sessionId: string;
        messageId: string;
        fullContent: string;
        usage: TokenUsage;
      };
    }
    
    export interface Updated {
      type: 'message.updated';
      payload: {
        sessionId: string;
        messageId: string;
        message: Message;
      };
    }
    
    export interface Error {
      type: 'message.error';
      payload: {
        sessionId: string;
        messageId?: string;
        error: ErrorInfo;
      };
    }
  }
  
  // ========== 工具事件 ==========
  export namespace Tool {
    export interface BeforeUse {
      type: 'tool.before_use';
      payload: {
        sessionId: string;
        toolUseId: string;
        toolName: string;
        input: Record<string, any>;
        /** 允许修改或拦截 */
        mutable: true;
      };
      /** 返回修改后的 input，或 { cancel: true } 取消执行 */
      result?: { input: Record<string, any> } | { cancel: true; reason: string };
    }
    
    export interface Use {
      type: 'tool.use';
      payload: {
        sessionId: string;
        toolUseId: string;
        toolName: string;
        input: Record<string, any>;
        startedAt: number;
      };
    }
    
    export interface Progress {
      type: 'tool.progress';
      payload: {
        sessionId: string;
        toolUseId: string;
        progress: number;  // 0-100
        message?: string;
      };
    }
    
    export interface Result {
      type: 'tool.result';
      payload: {
        sessionId: string;
        toolUseId: string;
        toolName: string;
        result: ToolResult;
        duration: number;
      };
    }
    
    export interface Error {
      type: 'tool.error';
      payload: {
        sessionId: string;
        toolUseId: string;
        toolName: string;
        error: ErrorInfo;
      };
    }
  }
  
  // ========== 权限事件 ==========
  export namespace Permission {
    export interface Requested {
      type: 'permission.requested';
      payload: {
        requestId: string;
        sessionId: string;
        toolName: string;
        input: Record<string, any>;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        reason: string;
        timeout: number;
      };
    }
    
    export interface Granted {
      type: 'permission.granted';
      payload: {
        requestId: string;
        sessionId: string;
        toolName: string;
        grantedBy: 'user' | 'rule' | 'session_override';
        remember: boolean;
      };
    }
    
    export interface Denied {
      type: 'permission.denied';
      payload: {
        requestId: string;
        sessionId: string;
        toolName: string;
        deniedBy: 'user' | 'rule' | 'timeout';
        reason?: string;
      };
    }
    
    export interface RuleChanged {
      type: 'permission.rule_changed';
      payload: {
        toolName: string;
        previousRule: PermissionRule;
        newRule: PermissionRule;
        changedBy: string;
      };
    }
  }
  
  // ========== 计划模式事件 ==========
  export namespace Plan {
    export interface Created {
      type: 'plan.created';
      payload: {
        sessionId: string;
        planId: string;
        title: string;
        steps: PlanStep[];
        createdAt: number;
      };
    }
    
    export interface StepStarted {
      type: 'plan.step_started';
      payload: {
        sessionId: string;
        planId: string;
        stepIndex: number;
        step: PlanStep;
      };
    }
    
    export interface StepCompleted {
      type: 'plan.step_completed';
      payload: {
        sessionId: string;
        planId: string;
        stepIndex: number;
        result: StepResult;
        duration: number;
      };
    }
    
    export interface StepFailed {
      type: 'plan.step_failed';
      payload: {
        sessionId: string;
        planId: string;
        stepIndex: number;
        error: ErrorInfo;
      };
    }
    
    export interface Completed {
      type: 'plan.completed';
      payload: {
        sessionId: string;
        planId: string;
        summary: PlanSummary;
        completedAt: number;
      };
    }
    
    export interface Cancelled {
      type: 'plan.cancelled';
      payload: {
        sessionId: string;
        planId: string;
        reason: string;
        cancelledAt: number;
      };
    }
  }
  
  // ========== MCP 事件 ==========
  export namespace MCP {
    export interface ServerStarting {
      type: 'mcp.server_starting';
      payload: {
        serverId: string;
        serverName: string;
        config: MCPServerConfig;
      };
    }
    
    export interface ServerStarted {
      type: 'mcp.server_started';
      payload: {
        serverId: string;
        serverName: string;
        capabilities: MCPCapabilities;
        tools: MCPToolInfo[];
      };
    }
    
    export interface ServerStopped {
      type: 'mcp.server_stopped';
      payload: {
        serverId: string;
        serverName: string;
        reason: 'manual' | 'error' | 'timeout';
        error?: ErrorInfo;
      };
    }
    
    export interface ServerError {
      type: 'mcp.server_error';
      payload: {
        serverId: string;
        serverName: string;
        error: ErrorInfo;
      };
    }
    
    export interface ToolCalled {
      type: 'mcp.tool_called';
      payload: {
        serverId: string;
        toolName: string;
        input: Record<string, any>;
        callId: string;
      };
    }
    
    export interface ToolResult {
      type: 'mcp.tool_result';
      payload: {
        serverId: string;
        toolName: string;
        callId: string;
        result: any;
        duration: number;
      };
    }
  }
  
  // ========== 错误事件 ==========
  export namespace Error {
    export interface Occurred {
      type: 'error.occurred';
      payload: {
        errorId: string;
        category: ErrorCategory;
        severity: 'warning' | 'error' | 'fatal';
        message: string;
        details?: Record<string, any>;
        stack?: string;
        timestamp: number;
      };
    }
    
    export interface Recovered {
      type: 'error.recovered';
      payload: {
        errorId: string;
        recoveryMethod: string;
        timestamp: number;
      };
    }
  }
  
  // ========== 连接事件 ==========
  export namespace Connection {
    export interface Connecting {
      type: 'connection.connecting';
      payload: {
        attempt: number;
        maxAttempts: number;
      };
    }
    
    export interface Connected {
      type: 'connection.connected';
      payload: {
        serverVersion: string;
        capabilities: string[];
      };
    }
    
    export interface Disconnected {
      type: 'connection.disconnected';
      payload: {
        reason: 'manual' | 'error' | 'timeout' | 'server_shutdown';
        willReconnect: boolean;
      };
    }
    
    export interface Reconnecting {
      type: 'connection.reconnecting';
      payload: {
        attempt: number;
        maxAttempts: number;
        nextAttemptIn: number;
      };
    }
  }
}

// ============================================
// 2. 事件类型联合
// ============================================

type SessionEvent = 
  | OpenCodeEvents.Session.Created
  | OpenCodeEvents.Session.Resumed
  | OpenCodeEvents.Session.Ended
  | OpenCodeEvents.Session.StateChanged
  | OpenCodeEvents.Session.ContextUpdated;

type MessageEvent =
  | OpenCodeEvents.Message.BeforeSend
  | OpenCodeEvents.Message.Sent
  | OpenCodeEvents.Message.StreamStarted
  | OpenCodeEvents.Message.StreamChunk
  | OpenCodeEvents.Message.StreamEnded
  | OpenCodeEvents.Message.Updated
  | OpenCodeEvents.Message.Error;

type ToolEvent =
  | OpenCodeEvents.Tool.BeforeUse
  | OpenCodeEvents.Tool.Use
  | OpenCodeEvents.Tool.Progress
  | OpenCodeEvents.Tool.Result
  | OpenCodeEvents.Tool.Error;

type PermissionEvent =
  | OpenCodeEvents.Permission.Requested
  | OpenCodeEvents.Permission.Granted
  | OpenCodeEvents.Permission.Denied
  | OpenCodeEvents.Permission.RuleChanged;

type PlanEvent =
  | OpenCodeEvents.Plan.Created
  | OpenCodeEvents.Plan.StepStarted
  | OpenCodeEvents.Plan.StepCompleted
  | OpenCodeEvents.Plan.StepFailed
  | OpenCodeEvents.Plan.Completed
  | OpenCodeEvents.Plan.Cancelled;

type MCPEvent =
  | OpenCodeEvents.MCP.ServerStarting
  | OpenCodeEvents.MCP.ServerStarted
  | OpenCodeEvents.MCP.ServerStopped
  | OpenCodeEvents.MCP.ServerError
  | OpenCodeEvents.MCP.ToolCalled
  | OpenCodeEvents.MCP.ToolResult;

type ErrorEvent =
  | OpenCodeEvents.Error.Occurred
  | OpenCodeEvents.Error.Recovered;

type ConnectionEvent =
  | OpenCodeEvents.Connection.Connecting
  | OpenCodeEvents.Connection.Connected
  | OpenCodeEvents.Connection.Disconnected
  | OpenCodeEvents.Connection.Reconnecting;

/** 所有事件类型 */
type OpenCodeEvent =
  | SessionEvent
  | MessageEvent
  | ToolEvent
  | PermissionEvent
  | PlanEvent
  | MCPEvent
  | ErrorEvent
  | ConnectionEvent;

// ============================================
// 3. 类型安全的事件处理器
// ============================================

type EventHandler<T extends OpenCodeEvent> = (event: T) => void | Promise<void>;

type EventHandlerMap = {
  [K in OpenCodeEvent['type']]: EventHandler<Extract<OpenCodeEvent, { type: K }>>;
};

class TypedEventEmitter {
  private handlers: Partial<Record<string, Set<Function>>> = {};
  
  on<K extends OpenCodeEvent['type']>(
    eventType: K,
    handler: EventHandler<Extract<OpenCodeEvent, { type: K }>>
  ): () => void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = new Set();
    }
    this.handlers[eventType]!.add(handler);
    
    // 返回取消订阅函数
    return () => {
      this.handlers[eventType]?.delete(handler);
    };
  }
  
  emit<T extends OpenCodeEvent>(event: T): void {
    const handlers = this.handlers[event.type];
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }
}

// 使用示例
const emitter = new TypedEventEmitter();

// 类型安全的事件订阅
emitter.on('permission.requested', (event) => {
  // event 被正确推断为 OpenCodeEvents.Permission.Requested
  console.log(event.payload.toolName);
  console.log(event.payload.riskLevel);
});

emitter.on('message.stream_chunk', (event) => {
  // event 被正确推断为 OpenCodeEvents.Message.StreamChunk
  console.log(event.payload.chunk);
});
```

**验收标准**
- [ ] 所有实际使用的事件都有类型定义
- [ ] 事件类型支持 TypeScript 类型推断
- [ ] 事件命名遵循一致的命名规范

---

### P05: 错误处理策略不明确

**问题描述**

文档中几乎没有错误处理设计：

- 网络错误如何重试？
- 权限审批超时如何处理？
- 工具执行失败如何恢复？
- 服务器不可用时的降级策略？

**改进方案**

```typescript
// ============================================
// 1. 错误分类体系
// ============================================

/**
 * 错误类别
 */
enum ErrorCategory {
  /** 网络错误 - 连接、超时等 */
  Network = 'network',
  
  /** 认证错误 - API Key、权限等 */
  Authentication = 'authentication',
  
  /** 验证错误 - 输入参数、配置等 */
  Validation = 'validation',
  
  /** 资源错误 - 文件不存在、配额超限等 */
  Resource = 'resource',
  
  /** 工具错误 - 工具执行失败 */
  Tool = 'tool',
  
  /** 权限错误 - 用户拒绝、规则阻止等 */
  Permission = 'permission',
  
  /** 服务器错误 - OpenCode Server 内部错误 */
  Server = 'server',
  
  /** 外部服务错误 - MCP、AI API 等 */
  ExternalService = 'external_service',
  
  /** 未知错误 */
  Unknown = 'unknown'
}

/**
 * 错误严重程度
 */
enum ErrorSeverity {
  /** 可忽略 - 不影响主流程 */
  Ignorable = 'ignorable',
  
  /** 警告 - 可能影响结果质量 */
  Warning = 'warning',
  
  /** 错误 - 当前操作失败，可重试 */
  Error = 'error',
  
  /** 致命 - 需要用户干预 */
  Fatal = 'fatal'
}

/**
 * 错误可恢复性
 */
enum ErrorRecoverability {
  /** 自动恢复 - 系统可自动重试 */
  AutoRecoverable = 'auto_recoverable',
  
  /** 用户可恢复 - 需要用户操作 */
  UserRecoverable = 'user_recoverable',
  
  /** 不可恢复 - 需要开发者修复 */
  Unrecoverable = 'unrecoverable'
}

/**
 * 结构化错误
 */
interface StructuredError {
  /** 错误 ID（用于追踪） */
  id: string;
  
  /** 错误代码（机器可读） */
  code: string;
  
  /** 错误类别 */
  category: ErrorCategory;
  
  /** 严重程度 */
  severity: ErrorSeverity;
  
  /** 可恢复性 */
  recoverability: ErrorRecoverability;
  
  /** 用户可读消息 */
  message: string;
  
  /** 详细信息（调试用） */
  details?: Record<string, any>;
  
  /** 原始错误 */
  cause?: Error;
  
  /** 建议的恢复操作 */
  suggestedActions?: SuggestedAction[];
  
  /** 时间戳 */
  timestamp: number;
  
  /** 上下文信息 */
  context?: {
    sessionId?: string;
    toolName?: string;
    operation?: string;
  };
}

interface SuggestedAction {
  type: 'retry' | 'configure' | 'contact_support' | 'ignore' | 'custom';
  label: string;
  action?: () => Promise<void>;
}

// ============================================
// 2. 错误处理策略
// ============================================

/**
 * 重试策略
 */
interface RetryPolicy {
  /** 最大重试次数 */
  maxAttempts: number;
  
  /** 退避策略 */
  backoff: {
    type: 'fixed' | 'linear' | 'exponential';
    initialDelay: number;  // 毫秒
    maxDelay: number;      // 毫秒
    multiplier?: number;   // 用于 exponential
  };
  
  /** 可重试的错误类别 */
  retryableCategories: ErrorCategory[];
  
  /** 可重试的错误代码 */
  retryableCodes?: string[];
  
  /** 重试前的钩子 */
  onBeforeRetry?: (attempt: number, error: StructuredError) => Promise<boolean>;
}

/**
 * 降级策略
 */
interface FallbackPolicy {
  /** 是否启用降级 */
  enabled: boolean;
  
  /** 降级方法 */
  fallbackMethod: 'cache' | 'default' | 'alternative' | 'skip' | 'custom';
  
  /** 缓存 TTL（用于 cache 方法） */
  cacheTTL?: number;
  
  /** 默认值（用于 default 方法） */
  defaultValue?: any;
  
  /** 替代操作（用于 alternative 方法） */
  alternativeAction?: () => Promise<any>;
  
  /** 自定义降级逻辑 */
  customFallback?: (error: StructuredError) => Promise<any>;
}

/**
 * 错误处理配置
 */
interface ErrorHandlingConfig {
  retry: RetryPolicy;
  fallback: FallbackPolicy;
  
  /** 是否向用户显示错误 */
  showToUser: boolean;
  
  /** 是否记录到日志 */
  logError: boolean;
  
  /** 是否上报到监控系统 */
  reportToMonitoring: boolean;
  
  /** 超时时间 */
  timeout?: number;
}

/**
 * 默认错误处理配置
 */
const DEFAULT_ERROR_CONFIGS: Record<ErrorCategory, ErrorHandlingConfig> = {
  [ErrorCategory.Network]: {
    retry: {
      maxAttempts: 3,
      backoff: {
        type: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000,
        multiplier: 2
      },
      retryableCategories: [ErrorCategory.Network]
    },
    fallback: {
      enabled: true,
      fallbackMethod: 'cache',
      cacheTTL: 300000  // 5 分钟
    },
    showToUser: true,
    logError: true,
    reportToMonitoring: true,
    timeout: 30000
  },
  
  [ErrorCategory.Authentication]: {
    retry: {
      maxAttempts: 1,
      backoff: { type: 'fixed', initialDelay: 0, maxDelay: 0 },
      retryableCategories: []
    },
    fallback: {
      enabled: false,
      fallbackMethod: 'skip'
    },
    showToUser: true,
    logError: true,
    reportToMonitoring: true
  },
  
  [ErrorCategory.Permission]: {
    retry: {
      maxAttempts: 0,  // 不自动重试
      backoff: { type: 'fixed', initialDelay: 0, maxDelay: 0 },
      retryableCategories: []
    },
    fallback: {
      enabled: true,
      fallbackMethod: 'skip'
    },
    showToUser: true,
    logError: true,
    reportToMonitoring: false
  },
  
  [ErrorCategory.Tool]: {
    retry: {
      maxAttempts: 2,
      backoff: {
        type: 'linear',
        initialDelay: 500,
        maxDelay: 5000
      },
      retryableCategories: [ErrorCategory.Tool],
      retryableCodes: ['TOOL_TIMEOUT', 'TOOL_TEMPORARY_FAILURE']
    },
    fallback: {
      enabled: true,
      fallbackMethod: 'alternative'
    },
    showToUser: true,
    logError: true,
    reportToMonitoring: true
  },
  
  [ErrorCategory.ExternalService]: {
    retry: {
      maxAttempts: 3,
      backoff: {
        type: 'exponential',
        initialDelay: 2000,
        maxDelay: 60000,
        multiplier: 2
      },
      retryableCategories: [ErrorCategory.ExternalService, ErrorCategory.Network]
    },
    fallback: {
      enabled: true,
      fallbackMethod: 'cache',
      cacheTTL: 600000  // 10 分钟
    },
    showToUser: true,
    logError: true,
    reportToMonitoring: true,
    timeout: 60000
  },
  
  // ... 其他类别的配置
  [ErrorCategory.Validation]: {
    retry: { maxAttempts: 0, backoff: { type: 'fixed', initialDelay: 0, maxDelay: 0 }, retryableCategories: [] },
    fallback: { enabled: false, fallbackMethod: 'skip' },
    showToUser: true,
    logError: true,
    reportToMonitoring: false
  },
  [ErrorCategory.Resource]: {
    retry: { maxAttempts: 1, backoff: { type: 'fixed', initialDelay: 1000, maxDelay: 1000 }, retryableCategories: [ErrorCategory.Resource] },
    fallback: { enabled: true, fallbackMethod: 'default' },
    showToUser: true,
    logError: true,
    reportToMonitoring: true
  },
  [ErrorCategory.Server]: {
    retry: { maxAttempts: 2, backoff: { type: 'exponential', initialDelay: 1000, maxDelay: 10000, multiplier: 2 }, retryableCategories: [ErrorCategory.Server] },
    fallback: { enabled: false, fallbackMethod: 'skip' },
    showToUser: true,
    logError: true,
    reportToMonitoring: true
  },
  [ErrorCategory.Unknown]: {
    retry: { maxAttempts: 1, backoff: { type: 'fixed', initialDelay: 1000, maxDelay: 1000 }, retryableCategories: [] },
    fallback: { enabled: false, fallbackMethod: 'skip' },
    showToUser: true,
    logError: true,
    reportToMonitoring: true
  }
};

// ============================================
// 3. 错误处理器实现
// ============================================

class ErrorHandler {
  private errorCache: Map<string, { result: any; timestamp: number }> = new Map();
  
  constructor(
    private configs: Record<ErrorCategory, ErrorHandlingConfig> = DEFAULT_ERROR_CONFIGS,
    private logger: Logger,
    private monitor: MonitoringService,
    private notifier: UserNotifier
  ) {}
  
  /**
   * 包装异步操作，添加错误处理
   */
  async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      category: ErrorCategory;
      cacheKey?: string;
      customConfig?: Partial<ErrorHandlingConfig>;
    }
  ): Promise<T> {
    const config = {
      ...this.configs[context.category],
      ...context.customConfig
    };
    
    let lastError: StructuredError | null = null;
    let attempt = 0;
    
    while (attempt <= config.retry.maxAttempts) {
      try {
        // 设置超时
        const result = await this.withTimeout(operation, config.timeout);
        
        // 成功时更新缓存
        if (context.cacheKey && config.fallback.fallbackMethod === 'cache') {
          this.errorCache.set(context.cacheKey, {
            result,
            timestamp: Date.now()
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = this.normalizeError(error, context);
        
        // 记录错误
        if (config.logError) {
          this.logger.error(lastError);
        }
        
        // 上报监控
        if (config.reportToMonitoring) {
          this.monitor.reportError(lastError);
        }
        
        // 检查是否可重试
        if (this.shouldRetry(lastError, config.retry, attempt)) {
          attempt++;
          const delay = this.calculateDelay(config.retry.backoff, attempt);
          
          // 重试前钩子
          if (config.retry.onBeforeRetry) {
            const shouldContinue = await config.retry.onBeforeRetry(attempt, lastError);
            if (!shouldContinue) break;
          }
          
          await this.sleep(delay);
          continue;
        }
        
        break;
      }
    }
    
    // 所有重试都失败，尝试降级
    if (config.fallback.enabled && lastError) {
      const fallbackResult = await this.executeFallback(config.fallback, context, lastError);
      if (fallbackResult !== undefined) {
        return fallbackResult;
      }
    }
    
    // 显示错误给用户
    if (config.showToUser && lastError) {
      this.notifier.showError(lastError);
    }
    
    throw lastError;
  }
  
  /**
   * 规范化错误
   */
  private normalizeError(error: unknown, context: { operationName: string; category: ErrorCategory }): StructuredError {
    const id = generateErrorId();
    
    if (error instanceof StructuredError) {
      return { ...error, id };
    }
    
    if (error instanceof Error) {
      return {
        id,
        code: this.inferErrorCode(error),
        category: context.category,
        severity: ErrorSeverity.Error,
        recoverability: this.inferRecoverability(error, context.category),
        message: error.message,
        cause: error,
        timestamp: Date.now(),
        context: { operation: context.operationName }
      };
    }
    
    return {
      id,
      code: 'UNKNOWN_ERROR',
      category: ErrorCategory.Unknown,
      severity: ErrorSeverity.Error,
      recoverability: ErrorRecoverability.Unrecoverable,
      message: String(error),
      timestamp: Date.now(),
      context: { operation: context.operationName }
    };
  }
  
  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: StructuredError, policy: RetryPolicy, attempt: number): boolean {
    if (attempt >= policy.maxAttempts) return false;
    if (!policy.retryableCategories.includes(error.category)) return false;
    if (policy.retryableCodes && !policy.retryableCodes.includes(error.code)) return false;
    if (error.recoverability === ErrorRecoverability.Unrecoverable) return false;
    return true;
  }
  
  /**
   * 计算重试延迟
   */
  private calculateDelay(backoff: Ret