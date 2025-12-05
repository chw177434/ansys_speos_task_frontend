# 前端 Structure (Mechanical) 模块调整清单

## 🎯 快速总结

**好消息**: 前端需要的调整很小！大部分参数已经支持，只需要添加 UI 选项和条件渲染。

---

## ✅ 需要调整的地方（共3处）

### 1. 添加求解器类型选择 (1分钟)

在求解器类型下拉框中添加 `mechanical` 选项：

```typescript
// 在 solver_type 选择器中添加
<Select value={solverType} onChange={setSolverType}>
  <Option value="speos">SPEOS (光学)</Option>
  <Option value="fluent">FLUENT (流体)</Option>
  <Option value="maxwell">Maxwell (电磁)</Option>
  <Option value="mechanical">Mechanical (结构)</Option>  // ⬅️ 新增这一行
</Select>
```

### 2. 条件显示参数表单 (5分钟)

根据选择的 `solver_type` 显示不同的参数：

```typescript
{/* SPEOS 参数（仅当 solver_type === 'speos' 时显示） */}
{solverType === 'speos' && (
  <>
    <FormItem label="Profile">
      <Input value={profileName} onChange={setProfileName} />
    </FormItem>
    <FormItem label="版本">
      <Input value={version} onChange={setVersion} />
    </FormItem>
    <FormItem label="使用 GPU">
      <Checkbox checked={useGpu} onChange={setUseGpu} />
    </FormItem>
  </>
)}

{/* Mechanical 参数（仅当 solver_type === 'mechanical' 时显示） */}
{solverType === 'mechanical' && (
  <>
    <FormItem label="核心数" required>
      <Input 
        type="number"
        value={threadCount}  // ⬅️ 复用现有字段
        onChange={setThreadCount}
        placeholder="8"
      />
    </FormItem>
    <FormItem label="任务标识">
      <Input 
        value={jobKey}
        onChange={setJobKey}
        placeholder="wing_001"
      />
    </FormItem>
  </>
)}

{/* 通用参数（所有求解器都显示） */}
<FormItem label="任务名称" required>
  <Input value={jobName} onChange={setJobName} />
</FormItem>
<FormItem label="提交者" required>
  <Input value={submitter} onChange={setSubmitter} />
</FormItem>
```

### 3. 确认提交时传递 solver_type (1行代码)

```typescript
const confirmUpload = async () => {
  await fetch('/api/tasks/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      master_object_key: masterObjectKey,
      solver_type: solverType,  // ⬅️ 确保传递这个字段
      job_name: jobName,
      job_key: jobKey,
      submitter: submitter,
      thread_count: threadCount,
      // SPEOS 特有参数只在 solver_type === 'speos' 时传递
      ...(solverType === 'speos' && {
        profile_name: profileName,
        version: version,
        use_gpu: useGpu,
      }),
    }),
  });
};
```

---

## 📝 Mechanical 需要的参数

### 必需参数

| 参数名 | 类型 | 说明 | 是否已有 |
|-------|------|------|---------|
| `solver_type` | string | 值必须为 `"mechanical"` | ✅ 已有字段 |
| `job_name` | string | 任务名称 | ✅ 已有字段 |
| `submitter` | string | 提交者 | ✅ 已有字段 |
| `thread_count` | string/number | 并行核心数 | ✅ 已有字段 |

### 可选参数（推荐）

| 参数名 | 类型 | 说明 | 默认值 |
|-------|------|------|--------|
| `job_key` | string | 任务标识（用于文件命名） | 自动生成 |

**结论**: 所有必需参数前端已经有了！只需要添加条件渲染和 UI 选项。

---

## ❌ 不需要的参数（Mechanical 不使用）

以下是 SPEOS 特有的参数，**Mechanical 不需要**，请条件隐藏：

- ❌ `profile_name` - SPEOS 专用
- ❌ `version` - SPEOS 专用
- ❌ `use_gpu` - SPEOS 专用
- ❌ `simulation_index` - SPEOS 专用
- ❌ `ray_count` - SPEOS 专用
- ❌ `dimension` - FLUENT 专用
- ❌ `precision` - FLUENT 专用
- ❌ `iterations` - FLUENT 专用

---

## 🎨 UI 建议

### 表单布局建议

```
┌─────────────────────────────────────┐
│ 求解器类型 *                         │
│ [下拉框: Mechanical (结构)]          │
├─────────────────────────────────────┤
│ 任务名称 *                           │
│ [输入框: 机翼应力分析]               │
├─────────────────────────────────────┤
│ 提交者 *                             │
│ [输入框: 张三]                       │
├─────────────────────────────────────┤
│ 核心数 * (建议值：8, 16, 32)         │
│ [数字输入框: 8]                      │
├─────────────────────────────────────┤
│ 任务标识 (用于文件命名)              │
│ [输入框: wing_001]                   │
├─────────────────────────────────────┤
│         [提交任务按钮]                │
└─────────────────────────────────────┘
```

### 字段提示文字

| 字段 | 提示文字 (placeholder) | 帮助文字 (help) |
|------|----------------------|----------------|
| 核心数 | `8` | 建议值：8, 16, 32。根据服务器负载设置 |
| 任务标识 | `wing_001` | 用于文件命名，建议使用简短的英文标识 |

---

## 🧪 测试用例

### 测试场景 1: 提交 Mechanical 任务

```
1. 选择求解器类型 → "Mechanical (结构)"
2. 上传文件 → job.dat
3. 填写表单:
   - 任务名称: "机翼应力分析"
   - 提交者: "张三"
   - 核心数: 8
   - 任务标识: "wing_001"
4. 点击提交
5. 验证: 任务成功提交，返回 task_id
```

**预期 API 请求**:
```json
{
  "solver_type": "mechanical",
  "job_name": "机翼应力分析",
  "job_key": "wing_001",
  "submitter": "张三",
  "thread_count": "8"
}
```

### 测试场景 2: 切换求解器类型

```
1. 选择 "SPEOS (光学)" → 显示 Profile、GPU 等字段
2. 选择 "Mechanical (结构)" → 隐藏 Profile、GPU，显示核心数
3. 验证: 字段正确切换
```

### 测试场景 3: 向后兼容

```
1. 不选择求解器类型（使用默认值）
2. 按原有方式提交 SPEOS 任务
3. 验证: 功能正常，不受影响
```

---

## 📋 完整的代码差异

### 变更前（只支持 SPEOS）

```typescript
// 表单字段
const [profileName, setProfileName] = useState('Standard');
const [version, setVersion] = useState('v252');
const [threadCount, setThreadCount] = useState('8');
const [useGpu, setUseGpu] = useState(false);

// 提交
await fetch('/api/tasks/upload/confirm', {
  body: JSON.stringify({
    task_id,
    master_object_key,
    job_name,
    submitter,
    profile_name: profileName,  // SPEOS 特有
    version: version,           // SPEOS 特有
    thread_count: threadCount,
    use_gpu: useGpu,            // SPEOS 特有
  }),
});
```

### 变更后（支持多种求解器）

```typescript
// 新增字段
const [solverType, setSolverType] = useState('speos');  // ⬅️ 新增
const [jobKey, setJobKey] = useState('');               // ⬅️ 新增

// 保留的字段
const [profileName, setProfileName] = useState('Standard');
const [version, setVersion] = useState('v252');
const [threadCount, setThreadCount] = useState('8');
const [useGpu, setUseGpu] = useState(false);

// 提交（支持多种求解器）
await fetch('/api/tasks/upload/confirm', {
  body: JSON.stringify({
    task_id,
    master_object_key,
    solver_type: solverType,  // ⬅️ 新增：必须传递
    job_name,
    job_key: jobKey,          // ⬅️ 新增：推荐传递
    submitter,
    thread_count: threadCount,
    // 条件传递 SPEOS 特有参数
    ...(solverType === 'speos' && {
      profile_name: profileName,
      version: version,
      use_gpu: useGpu,
    }),
  }),
});
```

---

## ✅ 验收标准

### 功能验收

- [ ] 可以选择 "Mechanical (结构)" 求解器
- [ ] 选择 Mechanical 后，不显示 SPEOS 特有字段
- [ ] 可以输入核心数（必填）
- [ ] 可以输入任务标识（选填）
- [ ] 提交成功并返回 task_id
- [ ] 不影响现有的 SPEOS 任务提交

### UI 验收

- [ ] 求解器选择器正常显示
- [ ] 字段切换流畅无闪烁
- [ ] 表单验证提示清晰
- [ ] 移动端显示正常

---

## 🚀 实施步骤

1. **立即可做**（5分钟）
   - 添加 solver_type 选择器
   - 添加条件渲染逻辑

2. **可选优化**（30分钟）
   - 创建配置化的参数表单
   - 添加完善的表单验证
   - 优化 UI/UX

3. **测试**（15分钟）
   - 测试 Mechanical 任务提交
   - 测试 SPEOS 任务（确保不受影响）
   - 测试求解器切换

---

## 📞 遇到问题？

- 📖 查看完整文档：[FRONTEND_MECHANICAL_GUIDE.md](docs/FRONTEND_MECHANICAL_GUIDE.md)
- 🔍 查看后端更新：[MECHANICAL_UPDATE_SUMMARY.md](docs/MECHANICAL_UPDATE_SUMMARY.md)
- 💬 技术讨论：创建 Issue

---

**总结**: 前端调整非常简单，核心就是3点：
1. ✅ 添加 `mechanical` 选项
2. ✅ 根据 `solver_type` 条件渲染字段
3. ✅ 提交时传递 `solver_type`

所有必需的参数字段前端已经有了，只需要做 UI 层面的调整！

