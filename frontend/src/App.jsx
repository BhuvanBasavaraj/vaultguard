import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "https://vaultguard-nv7z.onrender.com//api/review";
const VAULT_API_URL = "https://vaultguard-nv7z.onrender.com//api/vault";

const SAMPLE_DRAFT =
  "Introducing the VaultGuard Growth Fund: guaranteed 12% annual returns with zero risk. " +
  "Double your money in 18 months, and join thousands of investors who can't lose. " +
  "Only 48 hours left to lock in this risk-free opportunity.";

/* ---------- Icons ---------- */
function Svg({ children, size = 18, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

const ShieldCheck = (p) => <Svg {...p}><path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3z" /><path d="M9 12l2 2 4-4" /></Svg>;
const Alert = (p) => <Svg {...p}><path d="M10.3 3.9L2.4 17.5a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Svg>;
const Check = (p) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
const Copy = (p) => <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></Svg>;
const Pen = (p) => <Svg {...p}><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" /></Svg>;
const Retry = (p) => <Svg {...p}><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></Svg>;
const ScanIcon = (p) => <Svg {...p}><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" /><path d="M4 12h16" /></Svg>;
const HistoryIcon = (p) => <Svg {...p}><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" /></Svg>;
const ImageIcon = (p) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></Svg>;
const XIcon = (p) => <Svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
const DatabaseIcon = (p) => <Svg {...p}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></Svg>;

/* ---------- Helpers ---------- */
const toList = (value) => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

const STATUS_LABEL = {
  idle: "Ready to scan",
  loading: "Scanning",
  success: "Review complete",
  error: "Connection issue",
};

const getStatusColor = (status) => {
  switch(status) {
    case 'Approved': return '#10b981';
    case 'Rejected': return '#ef4444';
    case 'Pending': return '#f59e0b';
    default: return '#64748b';
  }
};

/* ---------- App ---------- */
export default function App() {
  const [draftText, setDraftText] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [status, setStatus] = useState("idle"); 
  const [result, setResult] = useState({ violations: [], suggestions: [] });
  const [error, setError] = useState("");
  const [scanMs, setScanMs] = useState(null);
  const [scanId, setScanId] = useState(0);
  const [copiedKey, setCopiedKey] = useState(null);

  const [healthScore, setHealthScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentDbId, setCurrentDbId] = useState(null);
  const [currentWorkflowStatus, setCurrentWorkflowStatus] = useState("Draft"); // ⚠️ ADDED FOR UI FEEDBACK

  // Vault State
  const [showVault, setShowVault] = useState(false);
  const [newRule, setNewRule] = useState("");
  const [vaultStatus, setVaultStatus] = useState("");

  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const isLoading = status === "loading";
  const trimmed = draftText.trim();
  const canScan = (trimmed.length > 0 || imageBase64) && !isLoading;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  const fetchHistory = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load audit history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
    return () => abortRef.current?.abort();
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result);
      if (status === "error" || status === "success") setStatus("idle");
    };
    reader.readAsDataURL(file);
  };

  const updateWorkflowStatus = async (id, newStatus) => {
    try {
      await fetch(`http://localhost:5000/api/history/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchHistory();
      
      // ⚠️ FIX: Update the main UI instantly if this is the active document
      if (id === currentDbId) {
        setCurrentWorkflowStatus(newStatus);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Upload Rule to Pinecone
  const handleAddRule = async () => {
    if (!newRule.trim()) return;
    setVaultStatus("Embedding rule...");
    try {
      const response = await fetch(VAULT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleText: newRule })
      });
      if (response.ok) {
        setVaultStatus("✅ Rule added to Pinecone Database!");
        setNewRule("");
        setTimeout(() => setVaultStatus(""), 3000);
      } else {
        setVaultStatus("❌ Failed to add rule.");
      }
    } catch (err) {
      setVaultStatus("❌ Connection error.");
    }
  };

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
        body: JSON.stringify({ draftText, imageBase64 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "";
        try { const body = await response.json(); detail = body?.error || body?.message || ""; } catch { }
        const err = new Error(detail || `The review service responded with status ${response.status}.`);
        err.kind = "http";
        throw err;
      }

      const data = await response.json();
      
      setHealthScore(data.healthScore);
      setCurrentDbId(data.id);
      setCurrentWorkflowStatus(data.status || "Draft"); // ⚠️ Reset to draft for new scan
      
      setResult({
        violations: toList(data?.violations),
        suggestions: toList(data?.suggestions),
      });
      setScanMs(performance.now() - startedAt);
      setScanId((id) => id + 1);
      setStatus("success");
      fetchHistory();
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(
        err.kind === "http"
          ? err.message
          : "Can't reach the review service at localhost:5000."
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
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setResult({ violations: [], suggestions: [] });
    setHealthScore(null);
    setCurrentDbId(null);
    setCurrentWorkflowStatus("Draft");
    setError("");
    setStatus("idle");
    textareaRef.current?.focus();
  }

  async function handleCopy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch {}
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
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark"><ShieldCheck size={20} /></span>
            <span className="brand__name">VaultGuard</span>
          </div>
          <div className={`status status--${status}`} role="status">
            <span className="status__dot" />
            {STATUS_LABEL[status]}
          </div>
        </header>

        <section className="intro">
          <h1>Multimodal Compliance Firewall.</h1>
          <p>
            Paste your marketing copy or upload a flyer. VaultGuard flags illegal financial claims, 
            missing disclaimers in imagery, and off-brand messaging.
          </p>
        </section>

        <main className="workspace">
          {/* ---------- Left: editor ---------- */}
          <section className="panel panel--editor" aria-labelledby="draft-title">
            <div className="panel__head">
              <h2 id="draft-title">Marketing asset</h2>
              <span className="panel__meta">Ctrl / ⌘ + Enter to scan</span>
            </div>

            <div className={`editor ${isLoading ? "editor--scanning" : ""}`}>
              {imageBase64 && (
                <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img 
                      src={imageBase64} 
                      alt="Uploaded flyer" 
                      style={{ maxHeight: '160px', borderRadius: '8px', border: '1px solid #334155', objectFit: 'contain' }} 
                    />
                    <button 
                      onClick={() => {
                        setImageBase64(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      style={{
                        position: 'absolute', top: '-10px', right: '-10px',
                        background: '#ef4444', color: 'white', border: 'none',
                        borderRadius: '50%', width: '24px', height: '24px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                      title="Remove image"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste an email, ad, or social post… (or upload an image below)"
                spellCheck="true"
                readOnly={isLoading}
                aria-label="Marketing draft"
              />
              {isLoading && <div className="editor__beam" aria-hidden="true" />}

              <div className="editor__foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="counts">
                  {wordCount} {wordCount === 1 ? "word" : "words"}
                  <i aria-hidden="true" />
                  {draftText.length} characters
                </span>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
                  <button type="button" className="btn btn--text" onClick={() => fileInputRef.current?.click()} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ImageIcon size={16} /> Upload Image
                  </button>
                  <button type="button" className="btn btn--text" onClick={() => setDraftText(SAMPLE_DRAFT)} disabled={isLoading}>
                    Insert sample
                  </button>
                </div>
              </div>
            </div>

            <div className="actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button type="button" className="btn btn--primary" onClick={handleScan} disabled={!canScan}>
                {isLoading ? <><span className="spinner" aria-hidden="true" /> Scanning asset…</> : <><ScanIcon size={18} /> Scan asset</>}
              </button>
              <button type="button" className="btn btn--ghost" onClick={handleClear} disabled={isLoading || (!draftText && !imageBase64 && status === "idle")}>
                Clear
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn--ghost" onClick={() => { setShowVault(!showVault); setShowHistory(false); }}>
                  <DatabaseIcon size={16} /> Manage Vault
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => { setShowHistory(!showHistory); setShowVault(false); }}>
                  <HistoryIcon size={16} /> Audit Log
                </button>
              </div>
            </div>

            {/* ---------- Dynamic Asset Vault Drawer ---------- */}
            {showVault && (
              <div style={{
                marginTop: '16px', padding: '16px', background: '#0f172a',
                borderRadius: '8px', border: '1px solid #3b82f6', animation: 'fadeIn 0.2s ease-out'
              }}>
                <h3 style={{ color: '#e2e8f0', marginBottom: '8px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DatabaseIcon size={16} /> Inject Brand Guidelines (Pinecone Vector DB)
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '12px' }}>
                  Enter a new compliance rule or brand guideline. VaultGuard will embed it and instantly apply it to all future scans.
                </p>
                <textarea
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  placeholder="e.g., 'Never use the phrase zero fees. Always use no hidden fees.'"
                  style={{
                    width: '100%', height: '60px', padding: '8px', borderRadius: '6px',
                    background: '#1e293b', color: '#f8fafc', border: '1px solid #334155',
                    fontSize: '0.85rem', resize: 'none', marginBottom: '8px'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 600 }}>{vaultStatus}</span>
                  <button 
                    onClick={handleAddRule}
                    disabled={!newRule.trim()}
                    style={{
                      padding: '6px 12px', background: newRule.trim() ? '#3b82f6' : '#1e293b', 
                      color: newRule.trim() ? 'white' : '#64748b', border: 'none', borderRadius: '4px', cursor: newRule.trim() ? 'pointer' : 'not-allowed', fontSize: '0.85rem'
                    }}
                  >
                    Add to Vector Database
                  </button>
                </div>
              </div>
            )}

            {/* ---------- Role-Based Audit History Drawer ---------- */}
            {showHistory && (
              <div style={{
                marginTop: '16px', padding: '16px', background: '#0f172a',
                borderRadius: '8px', border: '1px solid #1e293b', animation: 'fadeIn 0.2s ease-out'
              }}>
                <h3 style={{ color: '#e2e8f0', marginBottom: '12px', fontSize: '0.95rem' }}>Manager Approval Dashboard</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {history.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>No scans recorded yet.</p>
                  ) : (
                    history.map((item) => (
                      <div key={item._id} style={{
                        padding: '12px', background: '#1e293b', borderRadius: '6px',
                        display: 'flex', flexDirection: 'column', gap: '8px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ overflow: 'hidden' }}>
                            <p style={{ 
                              margin: '0 0 4px 0', color: '#cbd5e1', fontSize: '0.85rem', 
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
                            }}>
                              {item.draftText}
                            </p>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {new Date(item.scannedAt).toLocaleTimeString()} · {item.violations?.length || 0} issues
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: item.healthScore > 70 ? '#34d399' : '#f87171' }}>
                              {item.healthScore} / 100
                            </span>
                            <span style={{ 
                              fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', 
                              backgroundColor: `${getStatusColor(item.status || 'Draft')}20`,
                              color: getStatusColor(item.status || 'Draft'), border: `1px solid ${getStatusColor(item.status || 'Draft')}40` 
                            }}>
                              {item.status || 'Draft'}
                            </span>
                          </div>
                        </div>
                        
                        {(item.status === 'Pending') && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button 
                              onClick={() => updateWorkflowStatus(item._id, 'Approved')}
                              style={{ flex: 1, padding: '4px', fontSize: '0.75rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => updateWorkflowStatus(item._id, 'Rejected')}
                              style={{ flex: 1, padding: '4px', fontSize: '0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ---------- Right: analysis ---------- */}
          <section className="panel panel--results" aria-labelledby="analysis-title" aria-live="polite" aria-busy={isLoading}>
            <div className="panel__head">
              <h2 id="analysis-title">Compliance analysis</h2>
              {status === "success" && scanMs !== null && (
                <span className="panel__meta">Scanned in {(scanMs / 1000).toFixed(1)}s</span>
              )}
            </div>

            {status === "idle" && (
              <div className="empty">
                <div className="empty__rings" aria-hidden="true"><span /><span /><span /><ShieldCheck size={28} /></div>
                <h3>Nothing scanned yet</h3>
                <p>Add a draft on the left and select Scan asset. Violations and compliant rewrites will appear here.</p>
              </div>
            )}

            {status === "loading" && (
              <div className="loading" aria-label="Scanning draft">
                <p className="loading__text"><span className="pulse-dot" aria-hidden="true" />Reviewing text and imagery...</p>
                {[0, 1, 2].map((i) => (
                  <div className="skeleton" key={i} style={{ "--i": i }}>
                    <span className="skeleton__icon" />
                    <div className="skeleton__lines"><span /><span /><span /></div>
                  </div>
                ))}
              </div>
            )}

            {status === "success" && (
              <div className="results" key={scanId}>
                {healthScore !== null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                    backgroundColor: healthScore > 70 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${healthScore > 70 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>Compliance Health Score</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: healthScore > 70 ? '#34d399' : '#f87171' }}>
                      {healthScore} / 100
                    </span>
                  </div>
                )}

                {/* ⚠️ DYNAMIC BUTTON STATES */}
                {currentDbId && currentWorkflowStatus === 'Draft' && (
                  <button 
                    onClick={() => updateWorkflowStatus(currentDbId, 'Pending')}
                    style={{
                      width: '100%', padding: '10px', marginBottom: '20px',
                      background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <ShieldCheck size={16} /> Submit to Manager for Approval
                  </button>
                )}

                {currentDbId && currentWorkflowStatus === 'Pending' && (
                  <button 
                    disabled
                    style={{
                      width: '100%', padding: '10px', marginBottom: '20px',
                      background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 600, cursor: 'not-allowed', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: 0.9
                    }}
                  >
                    <HistoryIcon size={16} /> Pending Manager Approval
                  </button>
                )}

                {currentDbId && currentWorkflowStatus === 'Approved' && (
                  <button 
                    disabled
                    style={{
                      width: '100%', padding: '10px', marginBottom: '20px',
                      background: '#10b981', color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 600, cursor: 'default', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <Check size={16} /> Approved by Manager
                  </button>
                )}

                {currentDbId && currentWorkflowStatus === 'Rejected' && (
                  <button 
                    disabled
                    style={{
                      width: '100%', padding: '10px', marginBottom: '20px',
                      background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px',
                      fontWeight: 600, cursor: 'default', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <Alert size={16} /> Rejected by Manager
                  </button>
                )}

                <div className={`verdict ${hasViolations ? "verdict--blocked" : "verdict--clear"}`}>
                  <span className="verdict__icon">{hasViolations ? <Alert size={24} /> : <ShieldCheck size={24} />}</span>
                  <div className="verdict__body">
                    <h3>{hasViolations ? "Not ready to publish" : "Cleared for publishing"}</h3>
                    <p>{hasViolations ? `${violations.length} compliance issues found. Review rewrites below.` : "No violations found."}</p>
                  </div>
                </div>

                {hasViolations && (
                  <div className="group">
                    <h4 className="group__title">Violations<span className="count count--rose">{violations.length}</span></h4>
                    <ul className="cards">
                      {violations.map((text, i) => (
                        <li className="card card--violation" key={`v-${i}`} style={{ "--i": i + 1 }}>
                          <span className="card__icon"><Alert size={16} /></span><p>{text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="group">
                    <h4 className="group__title">Compliant rewrites<span className="count count--emerald">{suggestions.length}</span></h4>
                    <ul className="cards">
                      {suggestions.map((text, i) => {
                        const key = `s-${i}`;
                        const copied = copiedKey === key;
                        return (
                          <li className="card card--suggestion" key={key} style={{ "--i": violations.length + i + 1 }}>
                            <span className="card__icon"><Check size={16} /></span>
                            <div className="card__content">
                              <p>{text}</p>
                              <div className="card__actions">
                                <button type="button" className="chip" onClick={() => handleCopy(text, key)}>
                                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                                </button>
                                <button type="button" className="chip" onClick={() => handleUse(text)}>
                                  <Pen size={14} /> Use as draft
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