import Chatbot from "../../components/Chatbot.jsx";

export default function SupportPage() {
  return (
    <div className="container">
      <h1>① Break the Bot</h1>
      <p className="muted">
        Live challenge: extract the Acme Assistant's secret code. The presenter raises the level as
        each one falls — every level adds one more defense. What worked on Level 1 won't on Level 4.
      </p>
      <Chatbot />
    </div>
  );
}
