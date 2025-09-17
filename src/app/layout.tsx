import "../styles/globals.css";
import Navbar from "@/components/Navbar";
import ChatBot from "@/components/Chatbot";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
          <div className="pt-20">{children}</div>
          <ChatBot />
      </body>
    </html>
  );
}
