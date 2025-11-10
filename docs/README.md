# 前端文档索引

本目录包含Ansys SPEOS任务管理前端的所有文档。

## 📁 文档目录结构

### 📦 include-archive/
**Include文件压缩包上传功能相关文档**

- `MERGE_REPORT.md` - Git合并报告（main → feature/hpc-slurm-integration）
- `README_CHANGES.md` - Include压缩包功能修改说明
- `FRONTEND_INCLUDE_ARCHIVE_GUIDE.md` - 完整的适配指南
- `FRONTEND_MIGRATION_COMPLETE.md` - 迁移完成报告
- `FRONTEND_QUICK_GUIDE.md` - 快速适配指南
- `IMPLEMENTATION_SUMMARY.md` - 实施总结
- `QUICK_TEST_GUIDE.md` - 快速测试指南

**核心变更**：Include文件必须上传压缩包格式（.zip, .rar等），不再允许上传文件夹。

---

### 🚀 phase1/
**Phase1升级相关文档**

- `PHASE1_CHECKLIST.md` - Phase1检查清单
- `PHASE1_UPGRADE_SUMMARY.md` - Phase1升级总结
- `FRONTEND_CHECKLIST_PHASE1.md` - 前端检查清单（Phase1）
- `PHASE1_QUICK_REFERENCE.md` - Phase1快速参考
- `PHASE1_UPGRADE_COMPLETE.md` - Phase1升级完成报告
- `README_PHASE1.md` - Phase1说明文档
- `给前端的说明_PHASE1.md` - 给前端的Phase1说明

**核心内容**：第一阶段升级的完整文档和检查清单。

---

### ⏸️ resumable-upload/
**断点续传功能相关文档**

- `【给前端】断点续传接口规范.md` - 断点续传API接口规范
- `如何体验断点续传.md` - 断点续传功能体验指南
- `断点续传功能交付清单.md` - 功能交付清单
- `断点续传实现说明.md` - 实现说明文档
- `断点续传测试指南.md` - 测试指南

**核心功能**：大文件分片上传，支持暂停/恢复，断点续传。

---

### 🐛 bug-fixes/
**问题修复相关文档**

- `任务状态展示优化方案.md` - 任务状态展示优化
- `状态展示快速参考.md` - 状态展示快速参考
- `状态显示问题修复.md` - 状态显示问题修复
- `重复任务问题修复报告.md` - 重复任务问题修复
- `测试重复任务修复.md` - 测试重复任务修复

**包含内容**：各种Bug修复记录和优化方案。

---

### 🚢 deployment/
**部署和启动相关文档**

- `启动说明.md` - 前端项目启动说明

**包含内容**：如何启动开发服务器、构建生产版本等。

---

## 📋 根目录文档

### INDEX.md
文档总索引，提供所有文档的概览和快速导航。

### FRONTEND_CHECKLIST.md
前端开发检查清单，包含所有功能点的验收标准。

---

## 🔍 快速查找

### 我想了解...

#### 如何上传Include文件？
→ 查看 `include-archive/FRONTEND_QUICK_GUIDE.md`

#### 断点续传如何使用？
→ 查看 `resumable-upload/如何体验断点续传.md`

#### Phase1升级了什么？
→ 查看 `phase1/PHASE1_UPGRADE_COMPLETE.md`

#### 遇到Bug如何修复？
→ 查看 `bug-fixes/` 目录下的相关文档

#### 如何启动项目？
→ 查看 `deployment/启动说明.md`

---

## 📚 文档编写规范

所有文档应遵循以下规范：

1. **命名规范**
   - 使用描述性的文件名
   - 英文文档使用大写字母开头（如：`README.md`）
   - 中文文档使用中文命名（如：`断点续传测试指南.md`）

2. **内容结构**
   - 使用清晰的标题层级（H1, H2, H3...）
   - 添加目录（TOC）对于长文档
   - 使用emoji增强可读性 📝
   - 添加代码块示例

3. **更新说明**
   - 文档底部添加最后更新时间
   - 重大修改需要添加版本号
   - 废弃的文档移动到 `archive/` 目录

---

## 🔗 相关链接

- [主项目 README](../README.md)
- [API文档](../lib/api.ts)
- [组件文档](../components/)

---

**最后更新**: 2025-11-07  
**维护人**: 前端开发团队

