export default function App() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 grid place-items-center bg-muted">
          <p className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            shell ready - map mounts next
          </p>
        </div>
      </main>
    </div>
  );
}
