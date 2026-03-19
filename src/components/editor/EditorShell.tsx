import type { ReactNode } from "react";

type EditorShellProps = {
  children: ReactNode;
};

export default function EditorShell({ children }: EditorShellProps) {
  return (
    <main className="min-h-screen bg-[#fafbfc] px-4 py-4 text-slate-900 md:px-6 md:py-5">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">{children}</div>
    </main>
  );
}
