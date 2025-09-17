export default function StockCard() {
  return (
    <div className="bg-green-100 p-4 rounded shadow-md w-full max-w-md">
      <h2 className="text-xl font-semibold mb-2">Investments</h2>
      <p className="text-gray-700">Your portfolio is up <strong>+3.2%</strong> this month.</p>
      <p className="text-sm text-gray-500 mt-1">Top gainer: Tesla (+5.6%)</p>
    </div>
  );
}
