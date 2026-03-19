import type { ReactNode } from "react";

type EditorShellProps = {
  children: ReactNode;
};

export default function EditorShell({ children }: EditorShellProps) {
  return (
    <main className="min-h-screen bg-[#fafbfc] px-5 py-6 text-slate-900 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">{children}</div>
    </main>
  );
}
