import AttackerLog from "../../components/AttackerLog.jsx";

export default function AttackerPage() {
  return (
    <div className="container">
      <h1>Attacker capture log</h1>
      <p className="muted">Everything your collector has received so far, live.</p>
      <AttackerLog />
    </div>
  );
}
