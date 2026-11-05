import "./globals.css";
import Nav from "../components/Nav.jsx";

export const metadata = {
  title: "Acme SaaS prompt-injection lab",
  description: "A self-paced, fully synthetic lab for learning prompt injection, data exfiltration and the defenses that stop them.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <footer className="site-footer">
          Acme SaaS is a fictional company built for this lab. All tokens,
          documents, customers, and emails are 100% synthetic. Not a real product.
        </footer>
      </body>
    </html>
  );
}
