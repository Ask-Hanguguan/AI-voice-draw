

# AGENTS.md
## 一、核心规则
1. 每次提交需要先开分支，命名规则参考模板
2. 严禁直接推送代码到 `main`/`master` 主分支
3. 仅提交本次会话新增/修改文件，不夹带无关改动
4. 提交完成给出push命令，不要执行，并且给出生成Pull Request的说明，参考模板生成

## 二、分支规范
### 命名模板
- 功能分支：`feature/本次会话新增的功能名`
- 修复分支：`fix/问题描述`

### 操作步骤
```bash
# 1. 切主分支并更新
git checkout main
git pull

# 2. 创建并切换新分支
git checkout -b feature/xxx
```

## 三、Commit 提交规范
### 格式模板
```
<type>: 简短描述
```
### 类型说明
- `feat`：新增功能
- `fix`：修复问题
- `refactor`：代码重构
- `docs`：文档修改

### 操作步骤
```bash
git checkout -b feature/xxx
git add 目标文件
git commit -m "feat: 具体描述"
git push origin 分支名
```

## 四、PR 固定模板
```markdown
### 标题
一句话说明变更内容

### 功能描述
1. 功能作用：
2. 使用方式：

### 实现思路
简述技术方案、核心逻辑、改动文件范围

### 测试方式
1. 拉取当前分支代码
2. 运行命令：
3. 操作步骤：
4. 预期结果：功能正常、无报错
```

