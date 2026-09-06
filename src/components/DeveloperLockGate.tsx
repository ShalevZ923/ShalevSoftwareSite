import { useState, type FormEvent } from "react";
import { Icon } from "./ui";

export function DeveloperLockGate({
  onUnlock,
  onBack,
}: {
  onUnlock: (token: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanToken = tokenInput.trim();
    if (!cleanToken) return;

    setIsVerifying(true);
    setError("");
    try {
      const ok = await onUnlock(cleanToken);
      if (!ok) {
        setError(
          "Invalid or expired token. Check your server console / PowerShell window.",
        );
      }
    } catch {
      setError("Failed to communicate with server verification endpoint.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section
      className="dev-lock-screen"
      aria-label="Developer Authentication Gate"
    >
      <div className="dev-lock-card">
        <div className="dev-lock-icon" aria-hidden="true">
          <Icon name="bookmark" size={28} />
        </div>
        <h2 id="page-title" tabIndex={-1}>
          Developer Studio
        </h2>
        <p>
          Enter the access token from your local server to edit software and
          documentation.
        </p>
        <form onSubmit={handleSubmit} className="dev-lock-form">
          <label htmlFor="token-input">Access token</label>
          <input
            id="token-input"
            type="password"
            className="dev-token-input"
            placeholder="Paste 64-character token..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <div className="dev-lock-error" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="dev-unlock-btn"
            disabled={isVerifying || !tokenInput.trim()}
          >
            {isVerifying ? "Verifying..." : "Unlock Developer Studio"}
          </button>
        </form>
        <button type="button" className="dev-lock-back" onClick={onBack}>
          &larr; Return to Public Software Catalog
        </button>
      </div>
    </section>
  );
}
