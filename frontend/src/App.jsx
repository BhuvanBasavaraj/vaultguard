import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/review";

const SAMPLE_DRAFT =
  "Introducing the VaultGuard Growth Fund: guaranteed 12% annual returns with zero risk. " +
  "Double your money in 18 months, and join thousands of investors who can't lose. " +
  "Only 48 hours left to lock in this risk-free opportunity.";

/* ---------- Icons ---------- */
function Svg({ children, size = 18, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const ShieldCheck = (p) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
const Alert = (p) => (
  <Svg {...p}>
    <path d="M10.3 3.9L2.4 17.5a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);
const Check = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
const Copy = (p) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 012-2h9" />
  </Svg>
);
const Pen = (p) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" />
  </Svg>
);
const Retry = (p) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </Svg>
);
const ScanIcon = (p) => (
  <Svg {...p}>
    <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" />
    <path d="M4 12h16" />
  </Svg>
);

/* ---------- Helpers ---------- */
const toList = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];

const STATUS_LABEL = {
  idle: "Ready to scan",
  loading: "Scanning",
  success: "Review complete",
  error: "Connection issue",
};

/* ---------- App ---------- */
export default function App() {
  const [draftText, setDraftText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [result, setResult] = useState({ violations: [], suggestions: [] });
  const [error, setError] = useState("");
  const [scanMs, setScanMs] = useState(null);
  const [scanId, setScanId] = useState(0);
  const [copiedKey, setCopiedKey] = useState(null);

  const abortRef = useRef(null);
  const textareaRef = useRef(null);

  const isLoading = status === "loading";
  const trimmed = draftText.trim();
  const canScan = trimmed.length > 0 && !isLoading;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleScan() {
    if (!canScan) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError("");
    const startedAt = performance.now();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          detail = body?.error || body?.message || "";
        } catch {
          /* response had no JSON body */
        }
        const err = new Error(
          detail || `The review service responded with status ${response.status}.`
        );
        err.kind = "http";
        throw err;
      }

      const data = await response.json();
      setResult({
        violations: toList(data?.violations),
        suggestions: toList(data?.suggestions),
      });
      setScanMs(performance.now() - startedAt);
      setScanId((id) => id + 1);
      setStatus("success");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(
        err.kind === "http"
          ? err.message
          : "Can't reach the review service at localhost:5000. Make sure the backend is running and allows requests from this origin, then try again."
      );
      setStatus("error");
    }
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleScan();
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    setDraftText("");
    setResult({ violations: [], suggestions: [] });
    setError("");
    setStatus("idle");
    textareaRef.current?.focus();
  }

  async function handleCopy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  function handleUse(text) {
    setDraftText(text);
    textareaRef.current?.focus();
  }

  const { violations, suggestions } = result;
  const hasViolations = violations.length > 0;

  return (
    <div className="app">
      <div className="app__grid" aria-hidden="true" />

      <div className="shell">
        {/* Header */}
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark">
              <ShieldCheck size={20} />
            </span>
            <span className="brand__name">VaultGuard</span>
          </div>
          <div className={`status status--${status}`} role="status">
            <span className="status__dot" />
            {STATUS_LABEL[status]}
          </div>
        </header>

        <section className="intro">
          <h1>Review a draft before it goes live.</h1>
          <p>
            Paste your marketing copy. VaultGuard flags illegal financial claims
            and off-brand messaging, then writes compliant alternatives.
          </p>
        </section>

        <main className="workspace">
          {/* ---------- Left: editor ---------- */}
          <section className="panel panel--editor" aria-labelledby="draft-title">
            <div className="panel__head">
              <h2 id="draft-title">Marketing draft</h2>
              <span className="panel__meta">Ctrl / ⌘ + Enter to scan</span>
            </div>

            <div className={`editor ${isLoading ? "editor--scanning" : ""}`}>
              <textarea
                ref={textareaRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste an email, ad, landing page section, or social post…"
                spellCheck="true"
                readOnly={isLoading}
                aria-label="Marketing draft"
              />
              {isLoading && <div className="editor__beam" aria-hidden="true" />}

              <div className="editor__foot">
                <span className="counts">
                  {wordCount} {wordCount === 1 ? "word" : "words"}
                  <i aria-hidden="true" />
                  {draftText.length} characters
                </span>
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => setDraftText(SAMPLE_DRAFT)}
                  disabled={isLoading}
                >
                  Insert sample
                </button>
              </div>
            </div>

            <div className="actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleScan}
                disabled={!canScan}
              >
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Scanning draft…
                  </>
                ) : (
                  <>
                    <ScanIcon size={18} />
                    Scan draft
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleClear}
                disabled={isLoading || (!draftText && status === "idle")}
              >
                Clear
              </button>
            </div>
          </section>

          {/* ---------- Right: analysis ---------- */}
          <section
            className="panel panel--results"
            aria-labelledby="analysis-title"
            aria-live="polite"
            aria-busy={isLoading}
          >
            <div className="panel__head">
              <h2 id="analysis-title">Compliance analysis</h2>
              {status === "success" && scanMs !== null && (
                <span className="panel__meta">
                  Scanned in {(scanMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            {status === "idle" && (
              <div className="empty">
                <div className="empty__rings" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <ShieldCheck size={28} />
                </div>
                <h3>Nothing scanned yet</h3>
                <p>
                  Add a draft on the left and select Scan draft. Violations and
                  compliant rewrites will appear here.
                </p>
              </div>
            )}

            {status === "loading" && (
              <div className="loading" aria-label="Scanning draft">
                <p className="loading__text">
                  <span className="pulse-dot" aria-hidden="true" />
                  Reviewing your draft for illegal claims and off-brand language
                </p>
                {[0, 1, 2].map((i) => (
                  <div className="skeleton" key={i} style={{ "--i": i }}>
                    <span className="skeleton__icon" />
                    <div className="skeleton__lines">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {status === "error" && (
              <div className="failure" role="alert">
                <span className="failure__icon">
                  <Alert size={22} />
                </span>
                <div>
                  <h3>Scan failed</h3>
                  <p>{error}</p>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={handleScan}
                    disabled={!canScan}
                  >
                    <Retry size={16} />
                    Try again
                  </button>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="results" key={scanId}>
                <div
                  className={`verdict ${
                    hasViolations ? "verdict--blocked" : "verdict--clear"
                  }`}
                >
                  <span className="verdict__icon">
                    {hasViolations ? <Alert size={24} /> : <ShieldCheck size={24} />}
                  </span>
                  <div className="verdict__body">
                    <h3>
                      {hasViolations ? "Not ready to publish" : "Cleared for publishing"}
                    </h3>
                    <p>
                      {hasViolations
                        ? `${violations.length} compliance ${
                            violations.length === 1 ? "issue" : "issues"
                          } found. Review the rewrites below.`
                        : "No violations were found in this draft."}
                    </p>
                  </div>
                  <div className="verdict__stats">
                    <span>
                      <b>{violations.length}</b> violations
                    </span>
                    <span>
                      <b>{suggestions.length}</b> rewrites
                    </span>
                  </div>
                </div>

                {hasViolations && (
                  <div className="group">
                    <h4 className="group__title">
                      Violations
                      <span className="count count--rose">{violations.length}</span>
                    </h4>
                    <ul className="cards">
                      {violations.map((text, i) => (
                        <li
                          className="card card--violation"
                          key={`v-${i}`}
                          style={{ "--i": i + 1 }}
                        >
                          <span className="card__icon">
                            <Alert size={16} />
                          </span>
                          <p>{text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="group">
                    <h4 className="group__title">
                      Compliant rewrites
                      <span className="count count--emerald">{suggestions.length}</span>
                    </h4>
                    <ul className="cards">
                      {suggestions.map((text, i) => {
                        const key = `s-${i}`;
                        const copied = copiedKey === key;
                        return (
                          <li
                            className="card card--suggestion"
                            key={key}
                            style={{ "--i": violations.length + i + 1 }}
                          >
                            <span className="card__icon">
                              <Check size={16} />
                            </span>
                            <div className="card__content">
                              <p>{text}</p>
                              <div className="card__actions">
                                <button
                                  type="button"
                                  className="chip"
                                  onClick={() => handleCopy(text, key)}
                                >
                                  {copied ? <Check size={14} /> : <Copy size={14} />}
                                  {copied ? "Copied" : "Copy"}
                                </button>
                                <button
                                  type="button"
                                  className="chip"
                                  onClick={() => handleUse(text)}
                                >
                                  <Pen size={14} />
                                  Use as draft
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}