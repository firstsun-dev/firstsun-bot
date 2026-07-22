# firstsun-bot — 测试书

> 状态：草案 v1 · 最后更新 2026-07-22
>
> 本文定义**怎么验证做对了**。需求编号引用 [`REQUIREMENTS.md`](./REQUIREMENTS.md)，实现细节引用 [`SPEC.md`](./SPEC.md)。
> 覆盖范围：首版垂直切片 Ready → Plan Written（feat-001~007）。

---

## 1. 测试分层

| 层 | 范围 | 进 `pnpm test`？ | 依赖 |
|----|------|-----------------|------|
| **单元** | orchestrator 状态机、marker、backoff、config、state store、provider 内的纯函数 | 是 | 无网络、无子进程（state store 用临时目录）|
| **契约** | 任何 provider 实现都必须通过的共享套件 | 是 | 无 |
| **架构** | §5 边界断言 | 是 | 读源码文本 |
| **集成** | GitHub provider 打真实 API | 否，`FIRSTSUN_INTEGRATION=1` 才跑 | 真实 token + 一次性仓库 |
| **端到端** | §7 手动流程，真实看板 + 真实 agent | 否 | 真实凭证 |

**硬规定**：`pnpm test` 全程零网络、零 `claude` 子进程。任何需要凭证的测试放 `test/integration/`，默认从 vitest 运行中排除。

---

## 2. 测试替身规格

### 2.1 `FakeTrackerProvider`（`test/fakes/fake-tracker.ts`）

完整内存态 `TrackerProvider`：

- 用 issue / 评论 / 看板状态种子数据初始化
- 每次调用（读与写）追加到公开的 `calls: Array<{ method: string; args: unknown[] }>`——**断言的主要依据是调用序列，不只是最终状态**
- 可编程失败：`failNext('postComment', new TrackerRateLimitError({ retryAfterMs: 1000 }))`
- `postComment` 真的往内存追加评论，所以幂等测试反映真实行为，不是断言的自我实现

### 2.2 `FakeAgentProvider`（`test/fakes/fake-agent.ts`）

- 按预设队列返回 `AgentRunResult`
- 记录收到的每个 `AgentRunRequest`，供断言 `purpose` / `writeMode` / prompt 内容
- 可模拟 timeout、失败、`invalid_output`
- 可在 `run()` 中途 throw，模拟进程崩溃

### 2.3 防漂移

架构测试断言：两个接口的**每个方法名都出现在对应 fake 中**。接口加了方法而 fake 没跟进 → 测试失败。避免「fake 过了但真实实现根本不满足接口」的假绿。

---

## 3. 单元测试用例

> 每条标注覆盖的需求编号。无编号即需求书缺条目，须补齐。

### 3.1 计划步骤（`test/orchestrator/plan-step.test.ts`）

| # | 用例 | Given / When / Then | 覆盖 |
|---|------|---------------------|------|
| U-01 | 正常路径 | Given `ready` 且无 marker；When 跑一 tick；Then agent 调用**恰好一次**且 `purpose:'plan'`、`writeMode:'read-only'`；`postComment` 一次且含 marker；`setStatus('plan_written')` 一次；**顺序为 agent → comment → status** | FR-05,06,07,08 |
| U-02 | 计划已存在 | Given `ready` + 已有 plan marker；Then **零** agent 调用、**零** `postComment`、一次 `setStatus` | FR-03 |
| U-03 | 已完成 | Given `plan_written` + marker；Then 写操作次数全为 0 | FR-03 |
| U-04 | agent 前崩溃 | Given fake agent throw；Then tracker 写入为 0；When 重跑一 tick；Then 计划恰好发布一次 | FR-03, NFR-04 |
| U-05 | 回帖后崩溃 | Given `postComment` 成功后 `setStatus` throw；When 重跑；Then `postComment` 累计**仍为 1** | FR-03, NFR-04 |
| U-06 | 缓存清空 | 同 U-05 但两 tick 间重置 `InMemoryStateStore`；Then 写入序列与 U-05 完全一致 | NFR-06 |
| U-07 | 人工拖卡 | Given `plan_written` 但**无** marker；Then 记 warning，写操作为 0（绝不静默重发）| FR-03 |
| U-08 | 上下文完整性 | Given issue 有 3 条已有评论；Then prompt 含标题、正文与全部 3 条评论 | FR-05 |
| U-09 | dry run | Given `dryRun: true`；Then 变更类调用为 0，agent 仍调用，日志出现 `would postComment` | — |

### 3.2 幂等与并发（`test/orchestrator/reconciler.test.ts`）

| # | 用例 | Then | 覆盖 |
|---|------|------|------|
| U-10 | Lease 生效 | 同一 issue 并发两次 `runOnce()` → agent 只调一次 | FR-03, FR-04 |
| U-11 | Lease 过期 | inflight 年龄 > `timeout + 60s` → step 重跑且 `attempts += 1` | SPEC §6.4 |
| U-12 | 单 tick 单转换 | 一个 issue 一 tick 内至多推进一个状态 | FR-04 |
| U-13 | 并发上限 | 5 个待处理 issue、`maxConcurrentIssues: 2` → 在飞 agent 调用 ≤ 2 | NFR-01 |

### 3.3 状态派生（`test/orchestrator/derive-state.test.ts`）

| # | 用例 | 覆盖 |
|---|------|------|
| U-14 | 表驱动覆盖 (看板状态 × marker 有无) 完整矩阵，逐格断言 `effective` 与应采取动作，与 SPEC §6.2 表一一对应 | FR-02 |
| U-15 | `DerivedState` 任何字段都不读 StateStore（传 throw-on-access 桩，断言不被触碰）| FR-02 |

### 3.4 Marker（`test/orchestrator/markers.test.ts`）

| # | 用例 | 覆盖 |
|---|------|------|
| U-16 | `renderMarker` / `parseMarker` 往返一致 | FR-07 |
| U-17 | **反例**：正文含围栏代码块，块内是长得像 marker 的字符串 → 不得误匹配 | FR-07 |
| U-18 | 多条 bot 评论时 `findBotArtifact` 返回时间上最后一条 | FR-07 |
| U-19 | marker 为 HTML 注释形态（渲染后不可见）| FR-07 |

### 3.5 失败与退避

| # | 用例 | Then | 覆盖 |
|---|------|------|------|
| U-20 | agent 失败 | 看板状态不变，`attempts = 1`，`nextEligibleAt` 被设置 | FR-09, NFR-05 |
| U-21 | 退避窗口内 | 下一 tick 早于 `nextEligibleAt` → 完全无动作 | NFR-05 |
| U-22 | 达到上限 | 连续 3 次失败 → **一条** `plan-failed` 评论；第 4 tick 什么都不发（marker 保护）| FR-09, FR-20 |
| U-23 | 限流不消耗 attempt | `TrackerRateLimitError` → 本 tick 中止，`attempts` **不变** | NFR-01, NFR-05 |
| U-24 | 认证错误不重试 | `TrackerAuthError` → 立即失败，不进退避循环 | NFR-05 |
| U-25 | 退避序列 | attempts 1/2/3 → 5min / 10min / 20min，上限 1h | NFR-05 |

### 3.6 批准信号（`test/orchestrator/approval.test.ts`）

| # | 用例 | 覆盖 |
|---|------|------|
| U-26 | `board-status` detector：匹配 → `approved: true` 且带 `by`/`at`/`via`；不匹配 → false | FR-10 |
| U-27 | **无 write 权限者的批准被忽略，状态不变** | **FR-11** |
| U-28 | **批准时间早于最新计划评论 → 不生效** | **FR-12** |
| U-29 | `ignoreAuthors` 中的 login 给出的信号被忽略 | FR-11 |
| U-30 | 配置 `comment-keyword` 或 `label` → **注册时**抛 `NotImplementedError`（不是 detect 时静默返回 false）| FR-10 |
| U-31 | `mode: 'all'` 且含未实现 kind → 启动即失败 | FR-10 |
| U-32 | 配置校验接受全部三种 kind（配置面完整性）| FR-10 |

> **U-27 / U-28 是本文最容易被跳过、后果最严重的两条**：它们是「人类批准」这道安全阀的实际实现。缺了它们，任何人的一条评论都能让 bot 开始改代码。

### 3.7 配置（`test/config/load.test.ts`）

| # | 用例 | 覆盖 |
|---|------|------|
| U-33 | 缺 `GITHUB_TOKEN` → 错误信息含该键名 | NFR-03 |
| U-34 | 状态映射含未知 `WorkflowStatus` 取值 → 报错 | — |
| U-35 | 多键同时非法 → **一次性**全部列出，不是逐个失败 | — |
| U-36 | 优先级：默认值 ← JSON 文件 ← 环境变量，逐层覆盖正确 | — |
| U-37 | `agents.plan` 与 `agents.implement` 可配成不同 provider 且校验通过 | **AC-04** |

### 3.8 状态存储（`test/state/json-file-store.test.ts`）

| # | 用例 | 覆盖 |
|---|------|------|
| U-38 | 原子写：中断不产生半截文件（断言 temp + rename 路径）| NFR-06 |
| U-39 | schema 版本不匹配 → 删除重建，不抛错 | NFR-06 |
| U-40 | 文件不存在 → 返回空状态，不抛错 | NFR-06 |

### 3.9 Provider 纯函数

| # | 用例 | 文件 | 覆盖 |
|---|------|------|------|
| U-41 | `status-map` 双向映射；未知看板取值 → `'unknown'` 而非抛错 | `github/status-map.test.ts` | — |
| U-42 | `mappers` 对录制的 fixture payload 产出正确领域对象 | `github/mappers.test.ts` | — |
| U-43 | `argv`：`read-only` → `--permission-mode plan` + 受限 `--allowed-tools`；`workspace` → `--permission-mode acceptEdits` | `claude-code/argv.test.ts` | SPEC §5.1 |
| U-44 | **`argv` 构造的环境变量中不含 `GITHUB_TOKEN`** | `claude-code/argv.test.ts` | NFR-03 |
| U-45 | `result-parser` 对真实 `claude -p --output-format json` 信封解析正确；畸形输入 → `failure.reason='invalid_output'` 而非 throw | `claude-code/result-parser.test.ts` | SPEC §5 |

### 3.10 只读状态界面（feat-013，垂直切片后实施）

| # | 用例 | 覆盖 |
|---|------|------|
| U-51 | `getSnapshot()` 是同步且不做 I/O（传 throw-on-async 的 store 桩，断言不触发异步路径）| FR-27 |
| U-52 | 快照的 `counts` / `inflight` / `failures` 与 fake tracker 的种子数据一致 | FR-22 |
| U-53 | **注入假 token 后取快照，断言 JSON 序列化结果不含该字符串** | FR-26, NFR-03 |
| U-54 | 快照**不含** issue 标题、issue 正文、计划正文、评论内容 | FR-26 |
| U-55 | 非 GET 方法（POST/PUT/DELETE）→ `405`；未知路径 → `404` | **FR-24** |
| U-56 | 默认配置下监听地址为 `127.0.0.1`；配成非回环地址时启动日志出现 `warn` | FR-25 |
| U-57 | 渲染的 HTML 对快照字符串做了转义（构造含 `<script>` 的 issue 标识，断言输出被转义）| §9.5.4 |
| U-58 | HTML 中不含任何外部 URL（`http://` / `https://` 形态的资源引用）| FR-23 |
| U-59 | HTTP 服务启动失败（端口占用）→ 记 error 日志，poller 仍正常运行 | **FR-28** |
| U-60 | `FIRSTSUN_HTTP_ENABLED=false` → 不监听任何端口 | FR-25 |
| U-61 | `/healthz` 在 tracker 不可达时**仍返回 200**（存活 ≠ 依赖可达）；`/readyz` 在 `verifyAccess` 未通过时返回 503 | §9.5.3 |

> **U-55 与 U-61 容易被忽略但很重要**：前者是「只读」这条约束的实际实现；后者防止一次 GitHub 抖动触发容器重启循环。

### 3.11 可观测性与密钥安全

| # | 用例 | 覆盖 |
|---|------|------|
| U-46 | 每次状态转换产生结构化日志，含 issue 标识、源状态、目标状态、耗时、结果 | FR-19 |
| U-47 | **注入假 token（`ghp_` / `sk-ant-` 形态）跑完整 tick，断言全部日志输出不含该字符串** | **NFR-03** |
| U-48 | 同上，断言发往 issue 的失败评论正文不含该字符串 | **NFR-03, FR-20** |
| U-49 | 失败评论对人类可操作：含失败步骤名与建议动作 | FR-20 |

---

## 4. 契约测试

`test/contract/` 导出两个可复用套件，新 provider 只需传入工厂即可复用。这是 **AC-05（新增 provider 不需改 orchestrator）** 的机械保证。

### 4.1 `trackerContract(factory)`

- `capabilities` 声明 true 的能力，对应方法不得抛 `TrackerUnsupportedError`；声明 false 的**必须**抛
- `listComments` 返回必须按时间升序
- `postComment` 返回的 `IssueComment` 必须能在随后的 `listComments` 中找到
- `setStatus` 幂等：连续两次同一状态不报错
- 所有错误必须是 `errors.ts` 中定义的类型，不得泄漏 provider 原生错误

### 4.2 `agentContract(factory)`

- `writeMode: 'read-only'` 的运行，`changedFiles` 必须为空数组
- agent 层失败必须以 `success: false` 返回，**不得 throw**
- `capabilities.writeModes` 未声明的模式，调用时以 `failure` 返回而非 throw

---

## 5. 架构约束的自动化测试

`test/arch/boundaries.test.ts`：

| # | 断言 | 覆盖 |
|---|------|------|
| A-01 | `src/providers/agent/claude-code/` 之外，无文件在 `spawn\|exec\|execFile\|execa` 调用位置出现 `'claude'` 字面量 | AC-02 |
| A-02 | `src/providers/tracker/github/` 之外，无文件出现 `api.github.com`、`graphql(`、`Octokit` | AC-01 |
| A-03 | `src/orchestrator/**` 只从 `src/domain`、`src/providers/*/types.js`、`src/config`、`src/state`、`src/util` 导入 | AC-03 |
| A-04 | 两个接口的每个方法名都出现在对应 fake 中 | §2.3 |
| A-05 | `TrackerProvider` 每个方法要么已实现，要么抛 `TrackerUnsupportedError` | SPEC §12 |
| A-06 | `src/http/**` 只从 `src/orchestrator/snapshot.js`、`src/config`、`src/util` 导入；不含 `fetch` / `undici` / provider 目录（feat-013）| AC-06 |

### 5.1 门禁本身的测试（必做，不可省）

> 规则写错而无人察觉，等同于没有约束。以下为手动负例验证，纳入每次发布前检查清单。

**边界规则**

1. 临时在 `src/orchestrator/reconciler.ts` 加 `import { Octokit } from '@octokit/rest'` → `pnpm run lint` **必须失败**
2. 同一文件加 `execFile('claude', [])` → `pnpm test`（A-01）**必须失败**
3. 全部还原，确认 `./init.sh` 恢复绿

**pnpm 严格解析**（SPEC §2.3.2）

4. 在 `src/orchestrator/` 某文件 import 一个未在 `package.json` 声明的传递依赖 → `pnpm run build` **必须失败**（`hoist=false` 生效证明）

**Git hooks**（SPEC §2.3）

5. 提交一个含 lint 错误的暂存文件 → pre-commit **必须拒绝**
6. 提交 message 写 `update stuff`（无 type）→ commit-msg **必须拒绝**
7. 提交 message 写 `feat(github): x`（scope 不在白名单）→ **必须拒绝**
8. 提交 message 写 `feat(tracker): add status field resolution` → **必须通过**
9. 在暂存文件中放入 `ghp_` 形态的假字符串 → pre-commit 密钥扫描**必须拒绝**

**依赖时效性**（NFR-08/09）

10. `pnpm outdated` 的输出与 SPEC §2.1 表一致；任何偏离要么升级，要么在 §2.2 记录理由
11. `pnpm install --frozen-lockfile` 后 `git status --porcelain` 为空——锁文件未被静默改动（NFR-09）

---

## 6. 覆盖率与门禁

| 目标 | 门槛 |
|------|------|
| `src/orchestrator/**` 行覆盖率 | ≥ 85% |
| `src/config/**` 行覆盖率 | ≥ 85% |
| `src/providers/**` 纯函数文件（`argv`、`result-parser`、`status-map`、`mappers`）| ≥ 90% |
| `src/providers/**` 其余（真实 I/O）| 不设门槛，由集成测试与手动冒烟覆盖 |

覆盖率 provider：`v8`（`@vitest/coverage-v8`，版本必须与 vitest 精确一致）。门槛写进 `vitest.config.ts`，未达标即 `pnpm test` 失败。

**闸门层次**：

| 闸门 | 时机 | 内容 | 可绕过？ |
|------|------|------|---------|
| `.husky/pre-commit` | 每次 commit | 密钥扫描 + 暂存文件 eslint/prettier | 可（`--no-verify`）|
| `.husky/commit-msg` | 每次 commit | commitlint | 可 |
| `./init.sh` | 人主动跑 / session 结束前 | install + lint + build + test | — |
| GitHub push protection | push | 服务端密钥扫描 | **否** |

hooks 是提速反馈，`./init.sh` 是权威本地闸门，push protection 是唯一不可绕过的安全保证（NFR-11）。

---

## 7. 手动端到端验证流程

按顺序执行，全部通过才算首版垂直切片交付。

### A. 静态门禁
```bash
corepack enable
pnpm install --frozen-lockfile
./init.sh
```
必须全绿，且 `git status --porcelain` 为空。

### B. 门禁负例证明
执行 §5.1 的 11 步。**不提交任何临时改动。**

### C. 密钥卫生
```bash
git grep -nE 'ghp_|github_pat_|sk-ant-' -- . ':!.env.example'   # 必须无输出
```
再以 `FIRSTSUN_LOG_LEVEL=trace` 跑一个 tick，确认输出不含任何 token 子串。确认 `firstsun-dev/firstsun-bot` 已启用 push protection 与 `ANTHROPIC_API_KEY` 自定义模式。

### D. Dry run 打真实看板
填好 `.env`，设 `FIRSTSUN_DRY_RUN=true`，`pnpm run dev`。

预期日志：仓库解析成功 → project 与状态字段 id 解析成功 → 列出 N 个 Ready issue → 每个 issue 一行派生状态 + `[dry-run] would postComment(...)` / `would setStatus(...)`。

**到 GitHub 上确认：什么都没变。**

### E. 单 issue 实跑
建一个一次性 issue 拖到 Ready。设 `FIRSTSUN_DRY_RUN=false`、`FIRSTSUN_POLL_INTERVAL_MS=15000`，运行。

两个 tick 内预期：
1. issue 上出现**恰好一条**计划评论，markdown 可读，marker 在渲染视图不可见（用 `gh issue view --json body` 确认原始正文含 marker）
2. 看板状态变为 Plan Written
3. 目标仓库工作树未被改动（`git status --porcelain` 为空）——验证 `read-only` 模式确实生效

→ REQUIREMENTS §1.3 成功判据第 1 条。

### F. 幂等性证明
让进程继续跑 3 个 tick → 无第二条评论，日志无进一步变更操作。

然后 `Ctrl-C`，`rm -rf .firstsun-bot`，重启 → **仍然**没有第二条评论。

> 这一步证明起作用的是 marker，不是本地缓存（NFR-06）。

### G. 崩溃恢复证明
手动把看板状态改回 Ready，**保留**那条计划评论。重启进程。

预期：日志出现「计划已存在，仅收敛状态」；**零** agent 调用（确认无 `claude` 子进程、日志无 agent 运行记录）；状态回到 Plan Written。

→ REQUIREMENTS §1.3 成功判据第 2 条。

### H. 失败路径
对一个新的 Ready issue 设 `FIRSTSUN_AGENT_TIMEOUT_MS=1000`。

预期：3 次尝试且退避递增；看板状态始终不变；**恰好一条** `plan-failed` 评论；`state.json` 中 `attempts: 3`。

### I. Provider 可替换性证明
测试中把两个 provider 换成 fake，orchestrator 源码**零改动**跑通全流程。

→ REQUIREMENTS §1.3 成功判据第 3 条 / AC-05。

---

## 8. 需求覆盖对照表

> 每条需求至少被一个用例覆盖。空白即测试缺口。

| 需求 | 覆盖 |
|------|------|
| FR-01 | D、E（手动）|
| FR-02 | U-14, U-15 |
| FR-03 | U-02~U-07, U-10, F, G |
| FR-04 | U-10, U-12 |
| FR-05 | U-01, U-08 |
| FR-06 | U-01、A-02 |
| FR-07 | U-01, U-16~U-19 |
| FR-08 | U-01 |
| FR-09 | U-20, U-22, H |
| FR-10 | U-26, U-30, U-31, U-32 |
| FR-11 | **U-27, U-29** |
| FR-12 | **U-28** |
| FR-13 | ⚠️ **缺口** —— 见 §9 |
| FR-14~18 | 后续里程碑，本文不覆盖 |
| FR-19 | U-46 |
| FR-20 | U-22, U-48, U-49 |
| FR-21 | U-61 |
| FR-22 | U-52 |
| FR-23 | U-58 |
| FR-24 | **U-55** |
| FR-25 | U-56, U-60 |
| FR-26 | U-53, U-54 |
| FR-27 | U-51 |
| FR-28 | **U-59** |
| NFR-01 | U-13, U-23 |
| NFR-02 | H |
| NFR-03 | **U-44, U-47, U-48, C** |
| NFR-04 | U-04, U-05, G |
| NFR-05 | U-20, U-21, U-23, U-24, U-25 |
| NFR-06 | U-06, U-38~U-40, F |
| NFR-07 | A（CI 矩阵留待 feat-011）|
| NFR-08 | §5.1 步骤 10 |
| NFR-09 | §5.1 步骤 11、A |
| NFR-10 | §5.1 步骤 6/7/8 |
| NFR-11 | §5.1 步骤 5/9、§6 闸门层次表 |
| AC-01 | A-02 + eslint zone 1 + §5.1 步骤 1 + 步骤 4 |
| AC-02 | A-01 + eslint zone 2 + §5.1 步骤 2 |
| AC-03 | A-03 + eslint zone 3 |
| AC-04 | U-37 |
| AC-05 | §4 契约测试, I |
| AC-06 | A-06 + eslint zone 4 |

---

## 9. 已知缺口

| 缺口 | 影响 | 处理 |
|------|------|------|
| **FR-13**（Plan Review 改回 Ready → 作废旧 marker 并重新生成计划）尚无对应用例 | 中。该路径若实现错误，会导致「人要求重做计划但 bot 认为已完成」的静默卡死 | 实施 feat-007 时补 U-50；或在需求书中把 FR-13 降级到后续里程碑。**二选一，不得默认忽略** |
| 集成测试套件（`test/integration/`）本文只定义了边界，未列用例 | 低。首版靠 §7 手动流程覆盖 | 属于 feat-011 范围 |
| CI 工作流（GitHub Actions）尚未定义 | 中。目前所有门禁都依赖人主动跑 `./init.sh` | 建议在 feat-001 之后、feat-003 之前补一个最小 workflow（`pnpm install --frozen-lockfile` + `./init.sh`）|
