"use client";
import { useEffect, useState } from "react";

export default function QuoteBox() {
  const [quote, setQuote] = useState("");

  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch("https://zenquotes.io/api/today");
        const data = await res.json();
        setQuote(`${data[0].q} — ${data[0].a}`);
      } catch (error) {
        setQuote("Stay focused and keep pushing forward.");
      }
    }
    fetchQuote();
  }, []);

  return (
    <div className="bg-blue-100 p-4 rounded shadow-md">
      <p className="italic text-lg">{quote || "Loading quote..."}</p>
    </div>
  );
}
