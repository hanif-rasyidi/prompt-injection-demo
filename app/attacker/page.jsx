import AttackerLog from "../../components/AttackerLog.jsx";

export default function AttackerPage() {
  return (
    <div className="container">
      <h1>Attacker capture log</h1>
      <p className="muted">Everything the attacker’s collector has received, live.</p>
      <AttackerLog />
    </div>
  );
}
