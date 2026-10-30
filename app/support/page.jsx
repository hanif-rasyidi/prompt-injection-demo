import Chatbot from "../../components/Chatbot.jsx";

export default function SupportPage() {
  return (
    <div className="container">
      <h1>① Break the Bot</h1>
      <p className="muted">
        Self-paced challenge: get the Acme Assistant to reveal its <b>session reference code</b> (it
        starts with <code>ACME-</code>). Pick a level; each one adds a stronger defense, so what worked
        on Level 1 won't work on Level 4. Stuck? Use 💡 Hint, then 🔑 Show answer.
      </p>
      <Chatbot />
    </div>
  );
}
