import "./globals.css";
import Nav from "../components/Nav.jsx";

export const metadata = {
  title: "Acme SaaS — Prompt Injection Demo (AIBC 2026)",
  description: "From Attack to Defense: indirect prompt injection & data exfiltration demo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
