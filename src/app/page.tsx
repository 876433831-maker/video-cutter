import EditorWorkspace from "@/components/EditorWorkspace";
import HelpPopover from "@/components/HelpPopover";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 text-slate-900 md:px-6 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white/88 px-7 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:px-10 md:py-10">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                Video Cutter MVP
              </span>
              <HelpPopover
                title="页面使用方式"
                items={[
                  "先上传视频，再生成字幕。",
                  "右侧按字删除，左侧实时预览粗剪。",
                  "最后选择快速导出或成片导出。"
                ]}
              />
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl">
                口播智能粗剪工具
              </h1>
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                {["上传视频", "生成字幕", "AI 粗剪", "字幕微调", "导出成片"].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5"
                    >
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        <EditorWorkspace />
      </div>
    </main>
  );
}
