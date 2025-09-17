"use client";
import { useState } from "react";

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

const handleSend = () => {
  if (!input.trim()) return;

  const userMessage = `You: ${input}`;
  setMessages((prev) => [...prev, userMessage]);

  const reply = getBotReply(input);
  setInput("");

  // Show typing indicator after 0.5s
  setTimeout(() => {
    setMessages((prev) => [...prev, "..."]);
  }, 500);

  // Replace typing indicator with actual reply after 6.5s
  setTimeout(() => {
    setMessages((prev) => {
      const filtered = prev.filter((msg) => msg !== "...");
      return [...filtered, `FinBot: ${reply}`];
    });
  }, 3500);
};



  const getBotReply = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("dashboard")) return "The dashboard gives you a quick overview of your finances, quotes, and insights.";
    if (lower.includes("expenses")) return "You can add and track expenses in the Expenses section.";
    if (lower.includes("budget")) return "Use the Budget Planner to set goals and get AI tips on saving.";
    if (lower.includes("stocks") || lower.includes("investments")) return "Check your portfolio and market trends in the Investments page.";
    if (lower.includes("advisor")) return "You can contact your AI financial advisor through the Get Advice page.";
    if (lower.includes("faq")) return "FAQs are available in the footer or on the Get Advice page.";
    return "I'm here to help! Ask me anything about budgeting, expenses, investments, or navigating the site.";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="bg-white border rounded-lg shadow-lg w-80 h-96 flex flex-col">
          <div className="bg-blue-600 text-white p-3 rounded-t-lg font-semibold flex justify-between items-center">
            <span>FinBot Assistant</span>
            <button onClick={() => setIsOpen(false)} className="text-white text-sm">✖</button>
          </div>
          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-sm text-gray-800">
            {messages.map((msg, i) => {
                const isUser = msg.startsWith("You:");
                const isBot = msg.startsWith("FinBot:");

                const content = msg.replace(/^You: |^FinBot: /, "");

                return (
                    <div key={i}>
                    <span className={isUser ? "font-bold text-blue-600" : "font-bold text-green-600"}>
                        {isUser ? " You:" : " FinBot:"}
                    </span>{" "}
                    <span className="text-gray-800">{content}</span>
                    </div>
                );
        })}

          </div>
          <div className="p-2 border-t flex text-stone-900">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                    }
                }}
                className="flex-1 border rounded px-2 py-1 text-sm"
                placeholder="Ask me anything..."
            />

            <button
              onClick={handleSend}
              className="ml-2 bg-blue-600 text-white px-3 py-1 rounded text-sm"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          💬 Ask FinBot
        </button>
      )}
    </div>
  );
}
