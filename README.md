# 口播智能粗剪工具

当前恢复内容：

- Next.js + Tailwind 项目骨架
- 上传视频
- 生成字幕（当前恢复版默认走可运行回退逻辑）
- 右侧逐字删片、拖选删字、整行恢复
- 左侧粗剪预览
- 导出 `MP4`
- 导出真实任务进度条

## 启动

```bash
cd "/Users/linmoney/Downloads/test jianji/video-cutter"
npm install
npm run dev
```

打开：

```bash
http://localhost:3000
```

## 环境变量

参考：

- `.env.example`
- `.env.local`

当前 `.env.local` 只恢复了占位项，没有写入真实密钥。

## 当前说明

- 这次先把项目结构、页面、导出链路、进度条全部恢复到了可运行状态。
- 转写服务当前是恢复版回退逻辑，便于项目先跑起来。
- 如果需要，我下一步可以继续把豆包转写 / MiniMax 粗剪真实接回去。
