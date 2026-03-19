import HelpPopover from "@/components/HelpPopover";

type TranscriptHeaderProps = {
  hasVideo: boolean;
  hasResult: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
};

export default function TranscriptHeader({
  hasVideo,
  hasResult,
  isGenerating,
  onGenerate
}: TranscriptHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-slate-400">字幕与粗剪</p>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-950">逐字删片</h2>
          <p className="mt-0.5 text-xs text-slate-400">右侧编辑，左侧实时预览</p>
        </div>
        <HelpPopover
          title="字幕编辑说明"
          items={[
            "上传视频后会自动调用当前转写接口。",
            "支持逐字删除、拖选批量删除和整行恢复。",
            "需要时仍可手动重新生成字幕。"
          ]}
        />
      </div>

      <button
        type="button"
        disabled={!hasVideo || isGenerating}
        onClick={onGenerate}
        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
      >
        {!hasVideo
          ? "请先上传视频"
          : isGenerating
            ? "生成中..."
            : hasResult
              ? "重新生成字幕"
              : "等待自动生成"}
      </button>
    </div>
  );
}
