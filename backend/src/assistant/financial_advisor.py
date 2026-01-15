# backend/src/assistant/financial_advisor.py
import os
from openai import OpenAI

class FinancialAdvisor:
    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            self.client = OpenAI(api_key=api_key)
            self.has_api = True
        else:
            self.client = None
            self.has_api = False
    
    def get_personalized_advice(self, user_data):
        """Generate AI-powered financial advice"""
        
        if not self.has_api:
            return self._get_rule_based_advice(user_data)
        
        # Prepare context from user's financial data
        context = self._prepare_context(user_data)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful financial advisor. Provide practical, actionable advice."
                    },
                    {
                        "role": "user", 
                        "content": f"""Based on this user's financial data:

{context}

Provide personalized, actionable advice on:
1. Where they can cut spending
2. Budget reallocation suggestions
3. Savings strategies

Be specific and practical. Keep it under 200 words."""
                    }
                ],
                temperature=0.7,
                max_tokens=300
            )
            
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI API error: {e}")
            return self._get_rule_based_advice(user_data)
    
    def _prepare_context(self, user_data):
        """Format user financial data for AI"""
        monthly_spending = user_data.get('monthly_spending', {})
        income = user_data.get('income', 0)
        savings_rate = user_data.get('savings_rate', 0)
        
        context = f"""Monthly Income: ${income:.2f}
Current Savings Rate: {savings_rate:.1f}%

Spending by Category:"""
        
        total_spending = sum(monthly_spending.values())
        for category, amount in sorted(monthly_spending.items(), key=lambda x: x[1], reverse=True):
            percentage = (amount / income * 100) if income > 0 else 0
            context += f"\n- {category}: ${amount:.2f} ({percentage:.1f}%)"
        
        return context
    
    def _get_rule_based_advice(self, user_data):
        """Fallback rule-based advice when API is not available"""
        monthly_spending = user_data.get('monthly_spending', {})
        income = user_data.get('income', 0)
        savings_rate = user_data.get('savings_rate', 0)
        
        advice = []
        
        # Analyze savings rate
        if savings_rate < 10:
            advice.append("💡 Your savings rate is below 10%. Try to save at least 20% of your income.")
        elif savings_rate < 20:
            advice.append("💡 Good start! Try to increase your savings rate to 20% or more.")
        else:
            advice.append("✅ Great job! Your savings rate is healthy.")
        
        # Analyze spending categories
        total_spending = sum(monthly_spending.values())
        for category, amount in monthly_spending.items():
            percentage = (amount / income * 100) if income > 0 else 0
            
            if category == 'food' and percentage > 15:
                advice.append(f"🍔 Food spending ({percentage:.0f}%) is high. Consider meal planning to save.")
            elif category == 'entertainment' and percentage > 10:
                advice.append(f"🎮 Entertainment spending ({percentage:.0f}%) is above recommended 10%.")
            elif category == 'transport' and percentage > 15:
                advice.append(f"🚗 Transportation costs ({percentage:.0f}%) are high. Consider carpooling or public transit.")
        
        # General tips
        if len(advice) == 1:  # Only savings rate comment
            advice.append("📊 Track your daily expenses to identify areas for improvement.")
            advice.append("🎯 Set specific savings goals to stay motivated.")
        
        return "\n\n".join(advice)