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
        <footer className="site-footer">
          Acme SaaS is a fictional demo for <b>AIBC 2026 — From Attack to Defense</b>. All tokens,
          documents, customers, and emails are 100% synthetic. Not a real product.
        </footer>
      </body>
    </html>
  );
}
