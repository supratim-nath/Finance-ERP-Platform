from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class FinancePredictor:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        # Ensure dates are datetime objects for time-series analysis
        self.df['txn_date'] = pd.to_datetime(self.df['txn_date'])

    def predict_next_quarter_spend(self) -> Dict[str, Any]:
        if self.df.empty: return {'error': 'No data'}
        
        # Group by month to see trends
        monthly_spend = self.df.set_index('txn_date').resample('ME')['amount_inr'].sum()
        
        slope = 0
        if len(monthly_spend) < 2:
            # Not enough data for trend, use simple average
            avg_monthly = self.df['amount_inr'].sum() / 1.0 # Assume 1 month if only 1 exists
            predicted_q = avg_monthly * 3
        else:
            # Simple Linear Trend (Slope)
            x = np.arange(len(monthly_spend))
            y = monthly_spend.values
            slope, intercept = np.polyfit(x, y, 1)
            
            # Predict next 3 months
            next_3_months = sum([slope * (len(monthly_spend) + i) + intercept for i in range(3)])
            predicted_q = max(0, next_3_months)

        # Convert pandas Timestamps to string keys for standard JSON compliance
        history_dict = {}
        for k, v in monthly_spend.items():
            if hasattr(k, 'strftime'):
                key_str = k.strftime('%Y-%m-%d')
            else:
                key_str = str(k)
            history_dict[key_str] = float(v) if pd.notna(v) else 0.0

        return {
            'predicted_quarterly_spend': float(predicted_q),
            'trend': 'Increasing' if slope > 0 else ('Decreasing' if slope < 0 else 'Stable'),
            'confidence': 'Medium' if len(monthly_spend) >= 3 else 'Low',
            'monthly_history': history_dict
        }

    def analyze_variance(self, budget_map: Dict[str, float]) -> List[Dict]:
        # budget_map example: {'Engineering': 12000000, 'Sales': 8000000}
        results = []
        # Use the 'department' or 'category' column
        col = 'department' if 'department' in self.df.columns else 'category'
        
        if col not in self.df.columns: return []

        summary = self.df.groupby(col)['amount_inr'].sum()
        
        for dept, budget in budget_map.items():
            actual = summary.get(dept, 0)
            variance = budget - actual
            results.append({
                'department': dept,
                'budget': budget,
                'actual': float(actual),
                'variance': float(variance),
                'status': 'Under Budget' if variance >= 0 else 'Over Budget',
                'pct_used': (actual / budget * 100) if budget != 0 else 0
            })
        return results

