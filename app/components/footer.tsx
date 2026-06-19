export function Footer() {
  return (
    <footer className="mt-10 border-t border-border py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 text-center sm:px-6">
        <p className="text-xs text-muted">
          To raise issues or suggestions, please write to{" "}
          <a
            href="mailto:ankit.mishra@scaler.com"
            className="font-semibold text-accent hover:underline"
          >
            Ankit
          </a>
          .
        </p>
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          This is a beta version
        </p>
      </div>
    </footer>
  );
}
