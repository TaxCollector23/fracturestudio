import { Component } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Catches render/lifecycle errors anywhere below it and shows a recoverable
 * screen instead of unmounting the whole app into a blank page.
 *
 * Errors are logged to the console for developers; users get a clear message
 * and a way back to a working screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[fracture] page crashed:", error, info?.componentStack || "");
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || "Something went wrong rendering this page.";

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-5 py-16">
        <div className="card p-10 max-w-md w-full text-center">
          <AlertTriangle size={28} className="text-red-500 mx-auto mb-4" />
          <h1 className="font-serif text-2xl mb-2">This view hit an error</h1>
          <p className="muted text-sm leading-relaxed mb-6">
            The page could not be displayed. Your draft is not affected — reload to
            continue, or head back to the Studio.
          </p>
          <p className="faint text-xs font-mono mb-6 break-words">{message}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => window.location.reload()} className="btn-solid py-2 px-4 text-sm">
              Reload page
            </button>
            <button onClick={() => window.location.assign("/studio")} className="btn-ghost py-2 px-4 text-sm">
              Back to Studio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
