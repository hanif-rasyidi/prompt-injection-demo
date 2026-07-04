import Console from "../../components/Console.jsx";
import AttackerLog from "../../components/AttackerLog.jsx";

export default function HardenedPage() {
  return (
    <div className="container">
      <h1>
        Hardened HelpDeskAI <span className="tag ok">4 layers</span>
      </h1>
      <p className="muted">
        Same poisoned ticket. Toggle the layers: turn L3 (allowlist) off and it
        still leaks; turn it back on and the exfiltration is neutralised.
      </p>
      <div className="grid2" style={{ marginTop: 16 }}>
        <Console mode="hardened" />
        <AttackerLog />
      </div>
    </div>
  );
}
