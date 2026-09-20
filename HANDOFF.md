# 项目交接说明

## 项目位置与启动

- 项目目录：`G:\codex\api text\AI-API-Tester`
- 环境要求：Node.js 18+、npm
- 安装依赖：`npm install`
- 启动服务：`npm start`
- 默认地址：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`

## 当前版本

当前版本为 `0.4.20`，对应 `package.json`、页面版本信息和健康检查版本。

## 功能交接重点

1. 站点配置和模型选择保存在浏览器 `localStorage`，不会写入项目文件。
2. “选择测试站点”是多模型对比的站点来源；未勾选站点不会出现在多模型对比列表。
3. 多模型对比允许每个勾选站点选择一个模型，并行发送同一段测试内容；结果以独立卡片呈现。
4. 对话测试保留多轮上下文，可停止请求或清空会话。
5. 对话测试和多模型对比的请求超时为 300000 毫秒（5 分钟）。普通测试仍使用普通请求超时。
6. 端点眼睛按钮只控制显示，不改变站点配置或请求目标。

## 主要文件

- `public/index.html`：页面结构及四种测试模式入口
- `public/multiSiteApp.js`：站点、模型、测试模式和结果展示逻辑
- `public/styles.css`：页面和结果卡片样式
- `routes/api.js`：健康检查、模型获取、普通测试和对话接口
- `server.js`：Express 服务入口

## 验证命令

```powershell
node --check public/multiSiteApp.js
node --check routes/api.js
npm test
```

