# 前端快速适配指南 - Include文件上传修改

## 🎯 核心变化

**原来**: 允许上传include文件夹  
**现在**: **必须上传压缩包** (.zip, .rar, .7z等)

## ⚡ 快速修改（3步）

### 1. 修改文件选择器

```typescript
// ❌ 删除这个（旧代码）
<input type="file" webkitdirectory directory />

// ✅ 改成这个（新代码）
<input 
  type="file" 
  accept=".zip,.rar,.7z,.tar,.gz"
  onChange={handleIncludeUpload}
/>
```

### 2. 添加前端验证

```typescript
function validateIncludeFile(file: File): boolean {
  const allowedExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tar.gz'];
  const fileName = file.name.toLowerCase();
  
  if (!allowedExts.some(ext => fileName.endsWith(ext))) {
    alert('Include文件必须是压缩包格式！\n支持：.zip, .rar, .7z等\n请先压缩文件夹再上传。');
    return false;
  }
  return true;
}

// 使用
const handleIncludeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file && validateIncludeFile(file)) {
    // 继续上传...
  }
};
```

### 3. 添加用户提示

```tsx
<div className="upload-help">
  <p>⚠️ Include文件必须是压缩包格式（推荐.zip）</p>
  <p>请先将include文件夹压缩为.zip文件后上传</p>
</div>
```

## 📦 用户如何压缩文件

### Windows
右键文件夹 → "发送到" → "压缩(zipped)文件夹"

### Mac
右键文件夹 → "压缩"

### Linux
```bash
zip -r include.zip include/
```

## 🔍 接口变化

### 错误响应示例

如果上传非压缩包文件，后端返回：

```json
{
  "detail": "Include file must be an archive file. Allowed formats: .zip, .rar, .7z, .tar, .gz, .tar.gz. Please compress your include folder into a .zip file before uploading."
}
```

**处理方式**:
```typescript
if (response.status === 400) {
  const error = await response.json();
  alert(error.detail);  // 显示错误提示
}
```

## ✅ 自检清单

- [ ] 已移除 `webkitdirectory` 属性
- [ ] 已添加 `accept=".zip,.rar,.7z,.tar,.gz"` 属性
- [ ] 已添加前端文件格式验证
- [ ] 已添加用户提示说明
- [ ] 已测试上传.zip文件

## 📚 完整文档

详细内容请查看：`docs/FRONTEND_INCLUDE_ARCHIVE_GUIDE.md`

---

**问题联系**: 后端开发团队  
**更新时间**: 2025-11-07

