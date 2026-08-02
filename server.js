const { exec } = require('node:child_process');
const path = require('node:path');
const express = require('express');

const apiRouter = require('./routes/api');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || 'localhost';

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

app.use((request, response) => {
  response.status(404).json({
    success: false,
    message: '请求的资源不存在。'
  });
});

app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({
    success: false,
    message: error instanceof SyntaxError
      ? '请求数据不是有效的 JSON。'
      : '本地服务发生错误。'
  });
});

function openBrowser(url) {
  if (process.env.NO_OPEN_BROWSER === '1') {
    return;
  }

  const commands = {
    win32: `start "" "${url}"`,
    darwin: `open "${url}"`,
    linux: `xdg-open "${url}"`
  };
  const command = commands[process.platform];

  if (!command) {
    return;
  }

  exec(command, (error) => {
    if (error) {
      console.warn(`无法自动打开浏览器，请手动访问 ${url}`);
    }
  });
}

app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`AI API Tester 已启动：${url}`);
  openBrowser(url);
});
