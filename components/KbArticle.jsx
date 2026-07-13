"use client";

import { useState } from "react";
import { stripComments } from "../lib/docs.js";

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const highlightPayload = (e) => e.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="payload">$1</span>');

function SourceBadge({ d }) {
  if (d.confidential) return <span className="tag" style={{ background: "#3a2d00", color: "#ffcc66", whiteSpace: "nowrap" }}>🔒 {d.source}</span>;
  if (d.poisoned) return <span className="tag danger" style={{ whiteSpace: "nowrap" }}>⚠ user-submitted</span>;
  return <span className="tag ok" style={{ whiteSpace: "nowrap" }}>{d.source}</span>;
}

// One KB article, viewable as a human sees it on the wiki (Reader — HTML comment
// hidden) or as the assistant ingests it (Raw — hidden comment highlighted).
// Shared by the guided demo KB browser and the "Your turn" vault.
export default function KbArticle({ d }) {
  const [view, setView] = useState("reader");
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 14 }}>{d.title}</b>
        <SourceBadge d={d} />
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
        <button onClick={() => setView("reader")} style={{ background: view === "reader" ? "" : "#2a2f3d", fontSize: 12, padding: "3px 10px" }}>📄 Reader</button>
        <button onClick={() => setView("raw")} style={{ background: view === "raw" ? "" : "#2a2f3d", fontSize: 12, padding: "3px 10px" }}>{"</>"} Raw source</button>
      </div>
      {view === "reader" ? (
        <div className="email" style={{ whiteSpace: "pre-wrap", background: "#0c0e14", color: "var(--text)", fontSize: 13 }}>
          {stripComments(d.body)}
        </div>
      ) : (
        <div className="raw" dangerouslySetInnerHTML={{ __html: highlightPayload(escapeHtml(d.body)) }} />
      )}
      {view === "raw" && d.poisoned && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          ↑ The red block is an HTML comment — invisible in Reader view, but the assistant reads it as text and (unhardened) obeys it.
        </div>
      )}
      {view === "reader" && d.poisoned && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Looks harmless, right? Switch to <b>Raw source</b> to see the instruction hidden inside.
        </div>
      )}
    </div>
  );
}

export { SourceBadge };
