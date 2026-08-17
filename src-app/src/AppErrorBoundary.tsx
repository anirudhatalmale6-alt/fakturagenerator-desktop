import { Component, type ErrorInfo, type ReactNode } from "react";

// Desktop replacement for the web app's route-level error boundary. There is no
// page reload to fall back on in a packaged app, so a crash must stay visible
// and offer a way back instead of leaving a blank window.
type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Något gick fel / Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dina sparade kunder och fakturor finns kvar. / Your saved customers and invoices
            are safe.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Försök igen / Try again
          </button>
        </div>
      </div>
    );
  }
}
