"use client";

import { useEffect } from "react";

// Last-resort boundary for errors in the root layout. It replaces the whole
// document, so it can't use the app's stylesheet or components: minimal inline
// styles only. Plain messaging, no stack trace.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: "#fafcfc",
          color: "#223335",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div role="alert" style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#5b6b6d", margin: "0.5rem 0 1.25rem" }}>
            The app hit an unexpected problem. Your data is safe. Try again, and if it keeps happening, let the team know.
          </p>
          {error.digest && <p style={{ fontSize: "0.6875rem", color: "#7a8789" }}>Reference: {error.digest}</p>}
          <button
            onClick={() => retry()}
            style={{
              background: "#3f6b73",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
