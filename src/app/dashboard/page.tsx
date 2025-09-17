import QuoteBox from "@/components/QuoteBox";
import ExpenseCard from "@/components/ExpenseCard";
import StockCard from "@/components/StockCard";
import Link from "next/link";

export default async function DashboardPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Your Financial Dashboard</h1>
      <QuoteBox />
      <div className="flex flex-wrap gap-6">
        <ExpenseCard />
        <StockCard />
      </div>

      {/* Footer */}
      <footer className="bg-yellow-100 text-emerald-900 py-10 mt-20">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-6 text-center ">
          <div>
            <h3 className="font-semibold mb-2">FAQs</h3>
            <Link href="/advisor" className="text-emerald-600 hover:underline">Visit FAQ</Link>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Get Advice</h3>
            <Link href="/advisor" className="text-emerald-600 hover:underline">Contact AI Advisor</Link>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Dashboard</h3>
            <Link href="/dashboard" className="text-emerald-600 hover:underline">Go to Dashboard</Link>
          </div>
        </div>
        <p className="text-center text-sm mt-6 text-gray-400">© 2025 ZENTY. All rights reserved.</p>
      </footer>
    </main>
  );
}
