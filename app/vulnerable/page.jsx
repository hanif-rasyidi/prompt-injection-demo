import Console from "../../components/Console.jsx";
import AttackerLog from "../../components/AttackerLog.jsx";

export default function VulnerablePage() {
  return (
    <div className="container">
      <h1>
        Vulnerable HelpDeskAI <span className="tag danger">no defenses</span>
      </h1>
      <p className="muted">
        Click “Load poisoned ticket”, then “Summarize”. You never ask for anything
        sensitive — watch the attacker log on the right.
      </p>
      <div className="grid2" style={{ marginTop: 16 }}>
        <Console mode="vulnerable" />
        <AttackerLog />
      </div>
    </div>
  );
}
