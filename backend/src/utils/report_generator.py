# src/utils/report_generator.py
from fpdf import FPDF
import matplotlib.pyplot as plt

class ReportGenerator:
    def generate_monthly_report(self, month, year, data):
        """Generate PDF report with insights"""
        pdf = FPDF()
        pdf.add_page()
        
        # Title
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 10, f"Financial Report - {month}/{year}", ln=True)
        
        # Summary stats
        pdf.set_font("Arial", '', 12)
        pdf.cell(0, 10, f"Total Spent: ${data['total_spent']}", ln=True)
        pdf.cell(0, 10, f"Savings: ${data['savings']}", ln=True)
        
        # Add charts
        self._add_spending_chart(pdf, data)
        
        # AI insights
        pdf.add_page()
        pdf.multi_cell(0, 10, data['ai_insights'])
        
        pdf.output(f"report_{month}_{year}.pdf")
