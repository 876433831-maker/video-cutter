"use client";

import HelpPopover from "@/components/HelpPopover";

export default function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-950 px-4 text-sm font-medium text-white">
            AI 口播剪辑台
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-500 lg:flex">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              3:4 竖屏
            </span>
            <span>上传 → 字幕 → 粗剪 → 导出</span>
          </div>
        </div>

        <HelpPopover
          title="使用方式"
          items={[
            "左侧上传并实时预览视频，右侧按字删片。",
            "下半区统一调倍速、音量、字幕样式和导出参数。",
            "最终导出会保留硬字幕压制，预览导出只做快速检查。"
          ]}
        />
      </div>
    </header>
  );
}
