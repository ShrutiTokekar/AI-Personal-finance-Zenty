import QuoteBox from "@/components/QuoteBox";

export default function DashboardPage() {
  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold mb-4">Your Financial Dashboard</h1>
      <QuoteBox />
      {/* More dashboard widgets will go here */}
    </main>
  );
}
