export default function ExpenseCard() {
  return (
    <div className="bg-red-100 p-4 rounded shadow-md w-full max-w-md">
      <h2 className="text-xl font-semibold mb-2">Weekly Expenses</h2>
      <p className="text-gray-700">You've spent <strong>$342.50</strong> this week.</p>
      <p className="text-sm text-gray-500 mt-1">Tip: Consider cutting back on dining out.</p>
    </div>
  );
}
