"use client";

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  return (
    <main
      id="main-content"
      className="flex-1"
      tabIndex={-1}
    >
      {children}
    </main>
  );
}
