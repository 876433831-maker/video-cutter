import EditorWorkspace from "@/components/EditorWorkspace";
import EditorShell from "@/components/editor/EditorShell";
import TopNav from "@/components/editor/TopNav";

export default function Home() {
  return (
    <>
      <TopNav />
      <EditorShell>
        <EditorWorkspace />
      </EditorShell>
    </>
  );
}
