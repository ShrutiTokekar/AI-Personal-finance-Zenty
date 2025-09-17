import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-6">
      {/* Welcome Section */}
      <section className="text-center py-40 ">
        <h1 className="text-6xl font-bold mb-4 text-amber-100">Welcome to Zenty</h1>
        <p className="text-lg text-gray-700 mb-6">Your AI-powered financial companion</p>
        <Link href="/dashboard">
          <button className="bg-emerald-700 text-white px-6 py-2 rounded hover:bg-green-800 transition">
            Go to Dashboard
          </button>
        </Link>
      </section>

      {/* Testimonials */}
      <section className="py-25 bg-green-800  rounded-lg">
        <h2 className="text-3xl text-orange-200  font-bold text-center mb-8">What Our Users Say</h2>
        <div className="overflow-x-auto whitespace-nowrap px-4">
          <div className="inline-flex space-x-4">
            {[
              { quote: "FinWise helped me save $500 in just two months!", name: "— Alex R." },
              { quote: "The AI advisor gave me insights my bank never did.", name: "— Priya S." },
              { quote: "Managing my budget has never been this easy.", name: "— Jordan M." },
              { quote: "I finally understand where my money goes each week.", name: "— Samira T." },
              { quote: "The stock tracker is better than my brokerage app.", name: "— Leo M." },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-gray-100 p-4 rounded shadow w-72 shrink-0"
              >
                <p className="text-gray-800">"{testimonial.quote}"</p>
                <span className="block mt-2 text-sm text-gray-500">{testimonial.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>



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
