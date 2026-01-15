# backend/src/nlp/query_processor.py
from .intent_classifier import IntentClassifier
from .entity_extractor import EntityExtractor
from ..database.db_manager import DatabaseManager
from datetime import datetime

class QueryProcessor:
    def __init__(self):
        self.intent_classifier = IntentClassifier()
        self.entity_extractor = EntityExtractor()
        self.db = DatabaseManager()
    
    def process(self, user_input):
        """Main processing pipeline"""
        
        # Step 1: Classify intent
        intent_result = self.intent_classifier.classify(user_input)
        intent = intent_result['intent']
        
        print(f"Classified intent: {intent} (confidence: {intent_result.get('confidence', 0):.2f})")
        
        # Step 2: Extract entities
        entities = self.entity_extractor.extract_all(user_input)
        print(f"Extracted entities: {entities}")
        
        # Step 3: Override intent if we clearly have an expense/income statement
        user_lower = user_input.lower()

        # Check for savings goal related queries
        if any(word in user_lower for word in ['save for', 'saving goal', 'savings goal', 'savings']):
            if entities['amount'] and entities['amount'] > 0:
                if any(word in user_lower for word in ['add', 'contribute', 'put', 'deposit']):
                    intent = 'contribute_savings'
                    print(f"Override: Detected contribute to savings")
                else:
                    intent = 'create_savings_goal'
                    print(f"Override: Detected create savings goal")
            elif any(word in user_lower for word in ['show', 'view', 'my', 'goals']):
                intent = 'view_savings_goals'
                print(f"Override: Detected view savings goals")
            
        # Check for stock related queries
        if any(word in user_lower for word in ['stock', 'shares', 'portfolio']):
            if any(word in user_lower for word in ['buy', 'bought', 'purchase', 'purchased']):
                intent = 'add_stock'
                print(f"Override: Detected add stock")
            elif any(word in user_lower for word in ['show', 'view', 'my', 'portfolio']):
                intent = 'view_stocks'
                print(f"Override: Detected view stocks")

        # Check for expense/income with amount
        if entities['amount'] and entities['amount'] > 0:
            expense_keywords = ['spent', 'paid', 'bought', 'cost', 'purchased', 'expense', 'pay']
            income_keywords = ['earned', 'received', 'got paid', 'income', 'salary', 'made', 'receive']
            delete_keywords = ['delete', 'remove', 'cancel', 'undo']
            
            if any(word in user_lower for word in delete_keywords):
                intent = 'delete_transaction'
                print(f"Override: Detected delete transaction")
            elif any(word in user_lower for word in expense_keywords):
                intent = 'add_expense'
                print(f"Override: Detected expense keywords")
            elif any(word in user_lower for word in income_keywords):
                intent = 'add_income'
                print(f"Override: Detected income keywords")

        # Check for budget-related queries
        if any(word in user_lower for word in ['budget plan', 'create budget', 'recommend budget', 'budget recommendation']):
            intent = 'budget_plan'
            print(f"Override: Detected budget planning")
        
        # Step 4: Route to appropriate handler
        try:
            if intent in ['add_expense', 'categorize_expense']:
                return self.handle_add_expense(entities)
            elif intent == 'add_income':
                return self.handle_add_income(entities)
            elif intent in ['view_spending', 'show_transactions']:
                return self.handle_view_spending(entities)
            elif intent == 'check_balance':
                return self.handle_check_balance()
            elif intent == 'set_budget':
                return self.handle_set_budget(entities)
            elif intent == 'budget_plan':
                return self.handle_budget_plan()
            elif intent == 'predict_spending':
                return self.handle_prediction()
            elif intent in ['get_advice', 'find_savings']:
                return self.handle_financial_advice()
            elif intent == 'delete_transaction':
                return self.handle_delete_transaction(entities, user_input)
            elif intent == 'create_savings_goal':
                return self.handle_create_savings_goal(entities, user_input)
            elif intent == 'contribute_savings':
                return self.handle_contribute_savings(entities, user_input)
            elif intent == 'view_savings_goals':
                return self.handle_view_savings_goals()
            elif intent == 'add_stock':
                return self.handle_add_stock(entities, user_input)
            elif intent == 'view_stocks':
                return self.handle_view_stocks()
            else:
                # Default behavior
                if entities['amount'] and entities['amount'] > 0:
                    return {
                        'type': 'text',
                        'message': f"I see you mentioned ${entities['amount']:.2f}. Did you spend this or receive it as income? Please clarify by saying 'I spent $X' or 'I earned $X'."
                    }
                print(f"Unknown intent '{intent}', defaulting to view_spending")
                return self.handle_view_spending(entities)
        except Exception as e:
            print(f"Query processing error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': f"Sorry, I encountered an error: {str(e)}. Please try again."
            }
    
    def handle_add_expense(self, entities):
        """Add expense to database"""
        print(f"handle_add_expense called with entities: {entities}")
        
        if entities['amount'] is None or entities['amount'] <= 0:
            return {
                'type': 'text',
                'message': "I couldn't find an amount. Please specify how much you spent (e.g., 'I spent $50 on groceries')"
            }
        
        # Prepare transaction
        transaction = {
            'amount': entities['amount'],
            'category': entities['category'] if entities['category'] != 'other' else 'groceries',
            'date': entities['date'] if entities['date'] else datetime.now(),
            'description': entities['description'],
            'type': 'expense'
        }
        
        try:
            # Add to database
            result = self.db.add_transaction(transaction)
            print(f"Transaction added via chat: {result}")
            
            summary = self.db.get_monthly_summary()
            
            return {
                'type': 'text',
                'message': f"✅ Added ${entities['amount']:.2f} expense to {transaction['category']} category.\n\n💰 Your total spending this month is now ${summary['total_expenses']:.2f}"
            }
        except Exception as e:
            print(f"Error adding transaction via chat: {e}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': f"Sorry, I couldn't add that transaction. Error: {str(e)}"
            }
    
    def handle_add_income(self, entities):
        """Add income to database"""
        print(f"handle_add_income called with entities: {entities}")
        
        if entities['amount'] is None or entities['amount'] <= 0:
            return {
                'type': 'text',
                'message': "I couldn't find an amount. Please specify how much you received (e.g., 'I earned $1000 today')"
            }
        
        # Prepare transaction
        transaction = {
            'amount': entities['amount'],
            'category': 'income',
            'date': entities['date'] if entities['date'] else datetime.now(),
            'description': entities['description'],
            'type': 'income'
        }
        
        try:
            # Add to database
            result = self.db.add_transaction(transaction)
            print(f"Income transaction added via chat: {result}")
            
            summary = self.db.get_monthly_summary()
            
            return {
                'type': 'text',
                'message': f"✅ Added ${entities['amount']:.2f} as income.\n\n💵 Your total income this month is now ${summary['total_income']:.2f}"
            }
        except Exception as e:
            print(f"Error adding income via chat: {e}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': f"Sorry, I couldn't add that income. Error: {str(e)}"
            }
    
    def handle_delete_transaction(self, entities, user_input):
        """Delete a transaction"""
        print(f"handle_delete_transaction called")
        
        # Get recent transactions
        transactions = self.db.get_transactions(limit=10)
        
        if not transactions or len(transactions) == 0:
            return {
                'type': 'text',
                'message': "You don't have any transactions to delete."
            }
        
        # If amount is specified, try to find matching transaction
        if entities['amount'] and entities['amount'] > 0:
            matching = [t for t in transactions if abs(t['amount'] - entities['amount']) < 0.01]
            
            if len(matching) == 1:
                # Found exact match
                transaction_id = matching[0]['id']
                self.db.delete_transaction(transaction_id)
                return {
                    'type': 'text',
                    'message': f"✅ Deleted transaction: ${matching[0]['amount']:.2f} - {matching[0]['category']}"
                }
            elif len(matching) > 1:
                # Multiple matches
                message = f"I found {len(matching)} transactions with ${entities['amount']:.2f}:\n\n"
                for t in matching[:5]:
                    date_str = t['date'][:10] if isinstance(t['date'], str) else str(t['date'])[:10]
                    message += f"• ${t['amount']:.2f} - {t['category']} ({date_str})\n"
                message += "\nPlease be more specific (e.g., 'delete $50 groceries transaction' or use the Transactions page to delete)."
                return {
                    'type': 'text',
                    'message': message
                }
        
        # Show last transaction for deletion confirmation
        last = transactions[0]
        date_str = last['date'][:10] if isinstance(last['date'], str) else str(last['date'])[:10]
        
        return {
            'type': 'text',
            'message': f"To delete a transaction, please use the Transactions page, or tell me exactly which one (e.g., 'delete my last $50 groceries transaction').\n\nYour most recent transaction was:\n• ${last['amount']:.2f} - {last['category']} ({date_str})"
        }
    
    def handle_view_spending(self, entities):
        """Show spending information"""
        print(f"handle_view_spending called with entities: {entities}")
        
        # Don't filter by category from entity extraction - it's often wrong
        category = None
        
        # Get all transactions
        transactions = self.db.get_transactions(limit=50, category=category)
        print(f"Found {len(transactions)} transactions")
        
        if not transactions or len(transactions) == 0:
            return {
                'type': 'text',
                'message': "You don't have any transactions yet. Try saying 'I spent $50 on groceries' to add one!"
            }
        
        # Filter by type if needed
        expense_transactions = [t for t in transactions if t['type'] == 'expense']
        
        if len(expense_transactions) == 0:
            return {
                'type': 'text',
                'message': "You haven't recorded any expenses yet."
            }
        
        total = sum(t['amount'] for t in expense_transactions)
        
        message = f"Here are your recent transactions:\n\n"
        
        # Show up to 5 most recent
        for t in expense_transactions[:5]:
            date_str = t['date'][:10] if isinstance(t['date'], str) else str(t['date'])[:10]
            message += f"• ${t['amount']:.2f} - {t['category']} ({date_str})\n"
        
        if len(expense_transactions) > 5:
            message += f"\n...and {len(expense_transactions) - 5} more expenses."
        
        message += f"\n\n💰 Total spent: ${total:.2f}"
        
        # Add monthly summary
        summary = self.db.get_monthly_summary()
        message += f"\n📊 This month: ${summary['total_expenses']:.2f}"
        
        return {
            'type': 'text',
            'message': message
        }
    
    def handle_check_balance(self):
        """Get current balance summary"""
        summary = self.db.get_monthly_summary()
        
        message = f"""💰 Your Financial Summary (This Month):

Income: ${summary['total_income']:.2f}
Expenses: ${summary['total_expenses']:.2f}
Net Savings: ${summary['net_savings']:.2f}
Savings Rate: {summary['savings_rate']:.1f}%"""

        if summary['expense_change'] != 0:
            message += f"\n\n📈 Your expenses are {abs(summary['expense_change']):.1f}% {'higher' if summary['expense_change'] > 0 else 'lower'} than last month."
        
        return {
            'type': 'text',
            'message': message
        }
    
    def handle_set_budget(self, entities):
        """Set budget for a category"""
        if entities['amount'] is None or entities['amount'] <= 0:
            return {
                'type': 'text',
                'message': "Please specify the budget amount (e.g., 'Set my groceries budget to $300')."
            }
        
        if entities['category'] == 'other':
            return {
                'type': 'text',
                'message': "Please specify which category you want to set a budget for (e.g., groceries, food, rent, utilities)."
            }
        
        try:
            self.db.set_budget(entities['category'], entities['amount'])
            
            return {
                'type': 'text',
                'message': f"✅ Set budget of ${entities['amount']:.2f} for {entities['category']}.\n\nI'll help you track your spending in this category!"
            }
        except Exception as e:
            print(f"Error setting budget: {e}")
            return {
                'type': 'text',
                'message': f"Sorry, I couldn't set that budget. Error: {str(e)}"
            }
    
    def handle_budget_plan(self):
        """Generate a budget plan based on recent transactions"""
        try:
            user_data = self.db.get_user_financial_data()
            summary = self.db.get_monthly_summary()
            
            income = user_data.get('income', 0)
            spending = user_data.get('monthly_spending', {})
            
            if income == 0:
                return {
                    'type': 'text',
                    'message': "Please add some income transactions first so I can create a budget plan for you!"
                }
            
            # Calculate recommended budget using 50/30/20 rule
            needs_budget = income * 0.50  # 50% for needs
            wants_budget = income * 0.30  # 30% for wants
            savings_target = income * 0.20  # 20% for savings
            
            message = f"""📊 Recommended Budget Plan (Based on 50/30/20 Rule):

💰 Monthly Income: ${income:.2f}

🏠 Needs (50% = ${needs_budget:.2f}):
- Rent/Housing: ${income * 0.30:.2f}
- Utilities: ${income * 0.10:.2f}
- Groceries: ${income * 0.10:.2f}

🎯 Wants (30% = ${wants_budget:.2f}):
- Entertainment: ${income * 0.10:.2f}
- Dining Out: ${income * 0.10:.2f}
- Shopping: ${income * 0.10:.2f}

💎 Savings (20% = ${savings_target:.2f}):
- Emergency Fund
- Investments
- Long-term Goals

📈 Your Current Spending:"""
            
            total_current = sum(spending.values())
            message += f"\n• Total: ${total_current:.2f}"
            
            for category, amount in sorted(spending.items(), key=lambda x: x[1], reverse=True):
                percentage = (amount / income * 100) if income > 0 else 0
                message += f"\n• {category.capitalize()}: ${amount:.2f} ({percentage:.1f}%)"
            
            # Compare with current
            current_savings = income - total_current
            message += f"\n\n💵 Current Savings: ${current_savings:.2f} ({(current_savings/income*100):.1f}%)"
            
            if current_savings < savings_target:
                message += f"\n\n💡 Tip: You're ${savings_target - current_savings:.2f} short of the 20% savings goal. Try reducing discretionary spending!"
            else:
                message += f"\n\n🎉 Great! You're exceeding the 20% savings goal!"
            
            return {
                'type': 'text',
                'message': message
            }
        except Exception as e:
            print(f"Budget plan error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': "I need more transaction data to create a budget plan. Add some income and expense transactions first!"
            }
    
    def handle_prediction(self):
        """Handle spending prediction requests"""
        try:
            transactions_df = self.db.get_transactions_df()
            
            if len(transactions_df) < 30:
                return {
                    'type': 'text',
                    'message': f"Prediction feature requires more data. You have {len(transactions_df)} transactions. Add at least 30 transactions to see AI-powered predictions!"
                }
            
            return {
                'type': 'text',
                'message': "Prediction feature is available! Check the Analytics page to see your predicted spending for next month."
            }
        except Exception as e:
            print(f"Prediction error: {e}")
            return {
                'type': 'text',
                'message': "Prediction feature requires more transaction history. Add at least 30 transactions!"
            }
    
    def handle_financial_advice(self):
        """Handle advice requests with comprehensive analysis"""
        try:
            user_data = self.db.get_user_financial_data()
            summary = self.db.get_monthly_summary()
            
            advice_list = []
            
            income = user_data.get('income', 0)
            spending = user_data.get('monthly_spending', {})
            total_expenses = sum(spending.values())
            
            if income == 0:
                return {
                    'type': 'text',
                    'message': "Add some income transactions first so I can give you personalized advice!"
                }
            
            savings_rate = user_data.get('savings_rate', 0)
            
            advice_list.append("💡 Personalized Financial Advice:\n")
            
            # Savings rate analysis
            if savings_rate < 0:
                advice_list.append("⚠️ ALERT: You're spending more than you earn! This is unsustainable. You need to:")
                advice_list.append("  1. Identify and cut unnecessary expenses immediately")
                advice_list.append("  2. Look for ways to increase income")
                advice_list.append("  3. Create an emergency fund")
            elif savings_rate < 10:
                advice_list.append("⚠️ Your savings rate is low (< 10%). You should:")
                advice_list.append("  • Aim for at least 20% savings rate")
                advice_list.append("  • Review your expenses to find areas to cut")
                advice_list.append("  • Set up automatic savings")
            elif savings_rate >= 10 and savings_rate < 20:
                advice_list.append("👍 You're saving some money (10-20%). Good start!")
                advice_list.append("  • Try to reach 20% savings rate for financial security")
                advice_list.append("  • Consider investing your savings")
            elif savings_rate >= 20 and savings_rate < 30:
                advice_list.append("🎉 Excellent savings rate (20-30%)! You're on track!")
                advice_list.append("  • Keep up the great work")
                advice_list.append("  • Consider increasing investments")
            else:
                advice_list.append("🏆 Outstanding savings rate (>30%)! You're crushing it!")
                advice_list.append("  • You're financially disciplined")
                advice_list.append("  • Consider diversifying investments")
            
            # Category-specific advice
            advice_list.append("\n📊 Spending Analysis:")
            
            for category, amount in sorted(spending.items(), key=lambda x: x[1], reverse=True):
                percentage = (amount / income * 100) if income > 0 else 0
                
                if category == 'rent' and percentage > 35:
                    advice_list.append(f"🏠 Rent: ${amount:.0f} ({percentage:.0f}% of income)")
                    advice_list.append(f"   ⚠️ Above recommended 30%. Consider:")
                    advice_list.append(f"   • Finding cheaper housing")
                    advice_list.append(f"   • Getting a roommate")
                    advice_list.append(f"   • Negotiating rent")
                elif category == 'rent' and percentage > 25:
                    advice_list.append(f"🏠 Rent: ${amount:.0f} ({percentage:.0f}% - within range)")
                
                if category in ['food', 'groceries'] and percentage > 15:
                    advice_list.append(f"🍔 Food/Groceries: ${amount:.0f} ({percentage:.0f}%)")
                    advice_list.append(f"   💡 Higher than recommended 10-15%. Try:")
                    advice_list.append(f"   • Meal planning and prep")
                    advice_list.append(f"   • Buying generic brands")
                    advice_list.append(f"   • Reducing eating out")
                
                if category == 'entertainment' and percentage > 10:
                    advice_list.append(f"🎮 Entertainment: ${amount:.0f} ({percentage:.0f}%)")
                    advice_list.append(f"   ⚠️ Above 10% recommendation. Consider:")
                    advice_list.append(f"   • Free entertainment options")
                    advice_list.append(f"   • Canceling unused subscriptions")
                    advice_list.append(f"   • Setting entertainment budget")
                
                if category == 'transport' and percentage > 15:
                    advice_list.append(f"🚗 Transportation: ${amount:.0f} ({percentage:.0f}%)")
                    advice_list.append(f"   💡 Consider:")
                    advice_list.append(f"   • Carpooling or public transit")
                    advice_list.append(f"   • Biking for short trips")
                    advice_list.append(f"   • Working from home if possible")
                
                if category == 'utilities' and percentage > 10:
                    advice_list.append(f"💡 Utilities: ${amount:.0f} ({percentage:.0f}%)")
                    advice_list.append(f"   • Use energy-efficient appliances")
                    advice_list.append(f"   • Turn off unused devices")
            
            # Summary
            advice_list.append(f"\n📈 Summary:")
            advice_list.append(f"• Monthly Income: ${income:.2f}")
            advice_list.append(f"• Total Expenses: ${total_expenses:.2f}")
            advice_list.append(f"• Net Savings: ${income - total_expenses:.2f}")
            advice_list.append(f"• Savings Rate: {savings_rate:.1f}%")
            
            # Action items
            if savings_rate < 20:
                advice_list.append(f"\n🎯 Action Items:")
                advice_list.append(f"1. Track every expense for 30 days")
                advice_list.append(f"2. Identify your top 3 spending categories")
                advice_list.append(f"3. Set specific budget limits")
                advice_list.append(f"4. Find one expense to eliminate")
                advice_list.append(f"5. Automate your savings")
            
            return {
                'type': 'text',
                'message': "\n".join(advice_list)
            }
        except Exception as e:
            print(f"Advice error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': "I need more transaction data to give you advice. Add some income and expense transactions first!"
            }
        
    def handle_create_savings_goal(self, entities, user_input):
        """Create a savings goal"""
        try:
            if entities['amount'] is None or entities['amount'] <= 0:
                return {
                    'type': 'text',
                    'message': "Please specify a target amount for your savings goal (e.g., 'I want to save $5000 for a vacation')"
                }
            
            # Extract goal name from the input
            import re
            match = re.search(r'for (a |an |the )?(.+?)(?:\s+by|\s+in|\s*$)', user_input.lower())
            goal_name = match.group(2) if match else "Savings Goal"
            goal_name = goal_name.strip()
            
            result = self.db.create_savings_goal(
                name=goal_name.title(),
                target_amount=entities['amount'],
                description=f"Created via chat: {user_input}"
            )
            
            return {
                'type': 'text',
                'message': f"✅ Created savings goal: '{result['name']}' with target of ${result['target_amount']:.2f}!\n\nYou can add money to this goal anytime by saying 'Add $100 to my {goal_name} goal'"
            }
        except Exception as e:
            print(f"Error creating savings goal: {e}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': f"Sorry, I couldn't create that savings goal. Error: {str(e)}"
            }
    
    def handle_contribute_savings(self, entities, user_input):
        """Contribute to a savings goal"""
        try:
            if entities['amount'] is None or entities['amount'] <= 0:
                return {
                    'type': 'text',
                    'message': "Please specify how much you want to save (e.g., 'Add $100 to my vacation goal')"
                }
            
            # Get all goals
            goals = self.db.get_savings_goals()
            
            if not goals:
                return {
                    'type': 'text',
                    'message': "You don't have any savings goals yet! Create one first by saying 'I want to save $5000 for a vacation'"
                }
            
            # Try to match goal name from input
            user_lower = user_input.lower()
            matched_goal = None
            
            for goal in goals:
                if goal['name'].lower() in user_lower:
                    matched_goal = goal
                    break
            
            # If only one goal, use it
            if not matched_goal and len(goals) == 1:
                matched_goal = goals[0]
            
            if not matched_goal:
                goal_list = "\n".join([f"• {g['name']}: ${g['current_amount']:.2f} / ${g['target_amount']:.2f}" for g in goals])
                return {
                    'type': 'text',
                    'message': f"Which goal do you want to add to? Your goals:\n\n{goal_list}\n\nSay something like 'Add $100 to my vacation goal'"
                }
            
            # Add contribution
            result = self.db.add_to_savings_goal(
                goal_id=matched_goal['id'],
                amount=entities['amount'],
                description=f"Added via chat"
            )
            
            message = f"✅ Added ${entities['amount']:.2f} to '{result['name']}'!\n\n"
            message += f"Progress: ${result['current_amount']:.2f} / ${result['target_amount']:.2f} ({result['progress']:.1f}%)"
            
            if result['completed']:
                message += f"\n\n🎉 Congratulations! You've reached your goal!"
            else:
                message += f"\nRemaining: ${result['remaining']:.2f}"
            
            return {
                'type': 'text',
                'message': message
            }
        except Exception as e:
            print(f"Error contributing to savings: {e}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': f"Sorry, I couldn't add that contribution. Error: {str(e)}"
            }
    
    def handle_view_savings_goals(self):
        """View all savings goals"""
        try:
            goals = self.db.get_savings_goals()
            
            if not goals:
                return {
                    'type': 'text',
                    'message': "You don't have any savings goals yet!\n\nCreate one by saying something like:\n• 'I want to save $5000 for a vacation'\n• 'Help me save $10000 for a car'\n• 'I'm saving $2000 for an emergency fund'"
                }
            
            message = "💰 Your Savings Goals:\n\n"
            
            for goal in goals:
                progress_bar = self._create_progress_bar(goal['progress'])
                message += f"📊 {goal['name']}\n"
                message += f"   Target: ${goal['target_amount']:.2f}\n"
                message += f"   Saved: ${goal['current_amount']:.2f}\n"
                message += f"   {progress_bar} {goal['progress']:.1f}%\n"
                message += f"   Remaining: ${goal['remaining']:.2f}\n\n"
            
            message += "💡 Add money by saying 'Add $100 to my vacation goal'"
            
            return {
                'type': 'text',
                'message': message
            }
        except Exception as e:
            print(f"Error viewing savings goals: {e}")
            return {
                'type': 'text',
                'message': "I couldn't retrieve your savings goals. Please try again."
            }
    
    def handle_add_stock(self, entities, user_input):
        """Add a stock to portfolio"""
        try:
            # Extract stock symbol
            import re
            symbol_match = re.search(r'\b([A-Z]{1,5})\b', user_input)
            
            if not symbol_match:
                return {
                    'type': 'text',
                    'message': "Please specify a stock symbol (e.g., 'I bought 10 shares of AAPL at $150')"
                }
            
            symbol = symbol_match.group(1)
            
            # Extract shares
            shares_match = re.search(r'(\d+(?:\.\d+)?)\s*shares?', user_input.lower())
            if not shares_match:
                return {
                    'type': 'text',
                    'message': f"How many shares of {symbol} did you buy? (e.g., 'I bought 10 shares of {symbol} at $150')"
                }
            
            shares = float(shares_match.group(1))
            
            # Get price from entities or ask
            if entities['amount'] is None or entities['amount'] <= 0:
                return {
                    'type': 'text',
                    'message': f"What price did you buy {symbol} at? (e.g., 'I bought 10 shares of {symbol} at $150')"
                }
            
            price = entities['amount']
            
            # Add stock
            result = self.db.add_stock(
                symbol=symbol,
                shares=shares,
                purchase_price=price,
                notes=f"Added via chat: {user_input}"
            )
            
            total_cost = shares * price
            
            return {
                'type': 'text',
                'message': f"✅ Added {shares} shares of {symbol} at ${price:.2f}/share\n\nTotal Investment: ${total_cost:.2f}\n\nView your portfolio by saying 'Show my stocks'"
            }
        except Exception as e:
            print(f"Error adding stock: {e}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'text',
                'message': f"Sorry, I couldn't add that stock. Error: {str(e)}"
            }
    
    def handle_view_stocks(self):
        """View stock portfolio"""
        try:
            portfolio = self.db.get_portfolio_summary()
            
            if not portfolio['stocks']:
                return {
                    'type': 'text',
                    'message': "You don't have any stocks in your portfolio yet!\n\nAdd stocks by saying something like:\n• 'I bought 10 shares of AAPL at $150'\n• 'I purchased 5 shares of TSLA at $200'"
                }
            
            message = "📈 Your Stock Portfolio:\n\n"
            message += f"Total Invested: ${portfolio['total_invested']:.2f}\n"
            message += f"Holdings: {portfolio['total_holdings']} stocks\n\n"
            
            for stock in portfolio['stocks']:
                message += f"🔹 {stock['symbol']}\n"
                message += f"   Shares: {stock['shares']}\n"
                message += f"   Purchase Price: ${stock['purchase_price']:.2f}\n"
                message += f"   Total Cost: ${stock['total_cost']:.2f}\n\n"
            
            message += "💡 Track real-time prices on the Stocks page!"
            
            return {
                'type': 'text',
                'message': message
            }
        except Exception as e:
            print(f"Error viewing stocks: {e}")
            return {
                'type': 'text',
                'message': "I couldn't retrieve your portfolio. Please try again."
            }
    
    def _create_progress_bar(self, percentage):
        """Create a text progress bar"""
        filled = int(percentage / 10)
        empty = 10 - filled
        return '█' * filled + '░' * empty