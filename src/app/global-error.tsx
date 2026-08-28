"use client";

/**
 * Last-resort error boundary. Renders its own <html> because the root layout
 * itself failed; styling is inline for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#000",
          color: "#f5f5f2",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Something broke.</h1>
          <p style={{ color: "rgba(245,245,242,0.6)", fontSize: 14 }}>
            {error.digest ? `Reference ${error.digest}.` : "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              borderRadius: 999,
              border: "1px solid rgba(245,245,242,0.4)",
              background: "none",
              color: "inherit",
              cursor: "pointer",
              font: "inherit",
              fontSize: 13,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
