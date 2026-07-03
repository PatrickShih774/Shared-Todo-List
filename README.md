# Shared Todo List

给老板做的多人共享待办清单。Boss + 2 个助理，3人同时使用，跨平台（手机 + PC），实时同步。

## 快速启动

```bash
npm install
node server.js
```

浏览器打开 `http://localhost:3000`，点击名字即可使用。

## 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 运行环境 | Node.js | 前后端统一语言 |
| 服务端 | Express.js | 极简，免构建 |
| 数据库 | better-sqlite3 | 零配置单文件，同步API |
| 实时通信 | Socket.io | WebSocket + 长轮询回退，客户端库服务端自托管（国内无需CDN） |
| 前端 | 原生 HTML/CSS/JS | 无框架免构建，改完刷新即生效 |
| 身份 | Express-session（内存） | 仅用户名，3个可信用户无需密码 |

## 数据表结构

```sql
CREATE TABLE users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority    TEXT NOT NULL DEFAULT 'q4',           -- 'q1'~'q4' 对应四个象限
    due_date    TEXT,                             -- ISO日期，可空
    completed   INTEGER NOT NULL DEFAULT 0,       -- 0或1
    created_by  INTEGER NOT NULL REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),     -- 可空
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

预设 3 个用户：**Boss**、**Assistant1**、**Assistant2**（首次启动自动写入）。

## API 接口

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/login` | 设置 session 用户名 |
| POST | `/api/logout` | 销毁 session |
| GET | `/api/me` | 获取当前用户或 null |
| GET | `/api/todos?filter=` | 列出待办（JOIN 用户信息） |
| POST | `/api/todos` | 创建待办 → 广播 `todo:created` |
| PUT | `/api/todos/:id` | 更新待办 → 广播 `todo:updated` |
| DELETE | `/api/todos/:id` | 删除待办 → 广播 `todo:deleted` |
| GET | `/api/users` | 用户列表 + 在线状态 |

## 实时同步机制

- **服务端推送事件**：`todo:created`、`todo:updated`、`todo:deleted`、`users:online`
- **客户端上报事件**：连接后发送 `user:join` 注册在线
- **在线状态**：服务端维护 `Map<socketId, {userId, username}>`
- **冲突策略**：后写覆盖（3人场景几乎不会同时编辑同一条）

## 前端页面

单页应用，两个"屏幕"：

**登录页** → 3个名字按钮，点谁是谁

**主界面** → 顶部：当前用户 + 在线状态指示 | 中间：新增表单（仅助理可见）+ 筛选栏 + **默认四象限视图** | 弹窗：编辑待办

- 移动端优先响应式（触摸目标 ≥ 44px）
- 客户端筛选，无需重复请求
- Socket.io 事件驱动 DOM 实时更新
- 相对时间显示（"2分钟前"）

## 文件结构

```
Todo_claude/
│
├── package.json                # 依赖：express, better-sqlite3, socket.io, express-session
├── README.md                   # 本文档
├── .gitignore                  # node_modules/, *.db
│
├── server.js                   # 入口：Express + session + 静态文件 + Socket.io 挂载
│
├── db/
│   ├── connection.js           # better-sqlite3 连接初始化 + PRAGMA 配置
│   └── schema.js               # 建表语句 + 预置 3 个用户
│
├── routes/
│   ├── auth.js                 # 认证路由：login / logout / me
│   └── todos.js                # 待办 CRUD 路由 + Socket.io 广播
│
├── socket/
│   └── handler.js              # Socket.io 事件处理：连接、用户加入/离开、在线状态
│
├── public/
│   ├── index.html              # 单页 HTML（登录页 + 主界面 + 编辑弹窗）
│   ├── css/
│   │   └── style.css           # 移动优先响应式样式
│   └── js/
│       ├── utils.js            # 工具函数：相对时间、HTML 转义、Toast 提示
│       ├── api.js              # API 请求封装（fetch）
│       ├── socket-client.js    # Socket.io 客户端事件监听
│       └── app.js              # 主逻辑：状态管理、渲染、表单处理、事件绑定
│
└── todos.db                    # SQLite 数据库文件（自动生成）
```

## 实施步骤（当前进度）

- [x] 1. **项目初始化**：`npm init` + 安装依赖
- [x] 2. **数据库层**：schema.js + connection.js，预置3个用户
- [x] 3. **服务端骨架**：Express + session + 静态服务 + Socket.io
- [x] 4. **认证路由**：login/logout/me
- [x] 5. **待办 CRUD 路由**：含认证中间件 + Socket.io 写后广播
- [x] 6. **Socket.io 处理器**：在线状态追踪 + 广播
- [x] 7. **HTML 结构**：登录页 + 主界面 + 编辑弹窗
- [x] 8. **CSS 样式**：移动优先响应式 + 在线绿点 + Toast 动画
- [x] 9. **JS 工具函数 + API 客户端**
- [x] 10. **JS 主逻辑**：状态管理、渲染、表单处理、Socket 事件响应
- [x] 11. **集成测试**：所有 API 接口已通过 curl 验证
- [x] 12. **README**：本文档
- [x] 13. **Bug 修复**：创建待办重复出现（socket 事件与本地重复添加）
- [x] 14. **四象限视图**：重要-紧急矩阵展示，列表/象限双视图切换
- [x] 15. **优先级改四象限联动**：删除"高/中/低"，改为直接选 Q1~Q4 象限
- [x] 16. **角色权限**：老板只看清单，助理负责添加（表单根据角色显隐）
- [x] 17. **默认四象限视图**：打开应用默认显示象限视图

## 视图切换

默认显示**四象限视图**，可点击"列表视图"切换到传统列表模式。

### 四象限分类规则

用户创建/编辑待办时**直接选择象限**，不再设置"高/中/低"优先级。四个象限：

| 象限 | 选择 | 列表徽章 | 含义 |
|---|---|---|---|
| Q1 重要且紧急 | 🔴 重要且紧急 | 🔴 重要且紧急 (红底) | 立即去做 |
| Q2 重要不紧急 | 🔵 重要不紧急 | 🔵 重要不紧急 (蓝底) | 计划去做 |
| Q3 不重要但紧急 | 🟡 不重要但紧急 | 🟡 不重要但紧急 (黄底) | 委托去做 |
| Q4 不重要不紧急 | 🟢 不重要不紧急 | 🟢 不重要不紧急 (绿底) | 尽量不做 |

**旧数据兼容**：之前保存的 `high`/`medium`/`low` 会在读取时自动映射为 `q1`/`q3`/`q4`。

## 验证清单

1. `node server.js` 正常启动，监听 3000 端口
2. 打开 3 个浏览器标签 → 分别点不同的用户名登录
3. Assistant 创建待办（含截止日期 + 四象限 + 指派）→ 3个标签都立即出现，**且不会重复**
4. Assistant 勾选完成 → 所有标签的复选框同步更新
5. Assistant 编辑内容 → 所有标签实时更新
6. 删除 → 所有标签同步移除
7. 关掉一个标签 → 其余标签的头像灰点更新
8. 手机浏览器（同局域网）→ 响应式布局正常
9. 点击"象限视图" → 看到 2×2 四象限网格，事项按所选象限分布
10. 在象限视图中勾选/编辑/删除 → 操作正常
11. 切换回"列表视图" → 列表显示 🔴🔵🟡🟢 象限徽章
12. 编辑待办 → 可重新选择象限，保存后列表和象限视图同步更新
13. 旧数据（之前创建的 high/medium/low）→ 自动映射为 q1/q3/q4
