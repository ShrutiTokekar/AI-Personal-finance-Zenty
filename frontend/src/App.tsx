// frontend/src/App.tsx
import { useState } from 'react';
import { LayoutDashboard, Receipt, ChartNoAxesCombined, Wallet, Settings,BadgeDollarSign, PiggyBank , BotMessageSquare  } from 'lucide-react';
import Dashboard from './components/Dashboard/Dashbord';
import ChatInterface from './components/Chat/ChatInterface';
import TransactionsList from './components/Transactions/TransactionList';
import Analytics from './components/Analytics/AnalyticsPage';
import Savings from './components/Savings/SavingsPage';
import Stocks from './components/Stocks/StocksPage';
import Budget from './components/Budget/BudgetPage';
import Setting from './components/Settings/SettingsPage';


function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', name: 'AI Assistant', icon: BotMessageSquare },
    { id: 'transactions', name: 'Transactions', icon: Receipt },
    { id: 'analytics', name: 'Analytics', icon: ChartNoAxesCombined },
    { id: 'savings', name: 'Savings', icon: PiggyBank },
    { id: 'budget', name: 'Budget', icon: Wallet },
    { id: 'stocks', name: 'Stocks', icon: BadgeDollarSign },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'chat':
        return <ChatInterface />;
      case 'transactions':
        return <TransactionsList />;
      case 'savings':
        return <Savings />;
      case 'analytics':
        return <Analytics />;
      case 'stocks':
        return <Stocks />;
      case 'budget':
        return <Budget />;
      case 'settings':
        return <Setting />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-orange-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-orange-50 border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center space-x-2 px-6 py-6 border-b border-gray-200">
            <div className="h-8 w-8 flex items-center justify-center rounded-full">
              <img src="/logo.png" alt= "Logo" className="h-8 w-8 object-contain" />
            </div>
            <span className="text-xl text-yellow-950 font-extrabold font-serif;">ZentyAI</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-orange-200 text-amber-950 font-semibold'
                    : 'text-orange-900 hover:bg-orange-100 font-semibold'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
