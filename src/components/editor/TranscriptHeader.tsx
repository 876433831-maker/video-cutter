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
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        <div>
          <p className="text-sm text-slate-400">字幕与粗剪</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">右侧逐字删片，实时联动左侧预览</h2>
        </div>
        <HelpPopover
          title="字幕编辑说明"
          items={[
            "点击生成字幕后会调用当前转写接口。",
            "支持逐字删除、拖选批量删除和整行恢复。",
            "不改变业务流程，只重构页面结构。"
          ]}
        />
      </div>

      <button
        type="button"
        disabled={!hasVideo || isGenerating}
        onClick={onGenerate}
        className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {!hasVideo
          ? "请先上传视频"
          : isGenerating
            ? "生成中..."
            : hasResult
              ? "重新生成字幕"
              : "生成字幕"}
      </button>
    </div>
  );
}
