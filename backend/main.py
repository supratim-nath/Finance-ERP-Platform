import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import numpy as np
import io
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from engine import ExpenseValidator
from predictor import FinancePredictor

app = FastAPI()

@app.get('/')
async def root():
    return {'status': 'ok', 'service': 'Finance ERP Platform API', 'version': '2.0'}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://finance-erp-platform.vercel.app",
        "https://finance-erp-platform-.vercel.app"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_STORE = {
    'df': None,
    'raw_df': None,
    'quality_report': None
}

class AIAction(BaseModel):
    tool: str
    params: Dict[str, Any]

class AIChatQuery(BaseModel):
    query: str

# ─────────────────────────────────────────────────────────────────────────────
# UPLOAD / DEMO
# ─────────────────────────────────────────────────────────────────────────────

@app.post('/upload')
async def upload_csv(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding='utf-16')
            except Exception:
                df = pd.read_csv(io.BytesIO(contents), encoding='utf-16le')

        DATA_STORE['raw_df'] = df.copy()
        validator = ExpenseValidator(df)
        report = validator.run()
        DATA_STORE['quality_report'] = report
        DATA_STORE['df'] = validator.get_clean_rows()
        if 'status' not in DATA_STORE['df'].columns:
            DATA_STORE['df']['status'] = 'Normal'

        return {'message': 'Data processed successfully', 'row_count': len(DATA_STORE['df']), 'report': report}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post('/demo-load')
async def demo_load():
    try:
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        sample_path = os.path.join(current_dir, 'sample_ledger.csv')
        if not os.path.exists(sample_path):
            raise FileNotFoundError(f"sample_ledger.csv not found at {sample_path}")

        df = pd.read_csv(sample_path)
        DATA_STORE['raw_df'] = df.copy()
        validator = ExpenseValidator(df)
        report = validator.run()
        DATA_STORE['quality_report'] = report
        DATA_STORE['df'] = validator.get_clean_rows()
        if 'status' not in DATA_STORE['df'].columns:
            DATA_STORE['df']['status'] = 'Normal'

        return {'message': 'Demo data loaded successfully', 'row_count': len(DATA_STORE['df']), 'report': report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/reset')
async def reset_ledger():
    try:
        DATA_STORE['df'] = None
        DATA_STORE['raw_df'] = None
        DATA_STORE['quality_report'] = None
        return {'message': 'Database reset successfully'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# DATA / QUALITY
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/data')
async def get_data():
    if DATA_STORE['df'] is None:
        return {'error': 'No data uploaded'}
    df_json = DATA_STORE['df'].replace({pd.NA: None, float('nan'): None, np.nan: None})
    return df_json.to_dict(orient='records')


@app.get('/quality-issues')
async def get_quality_issues():
    if DATA_STORE['quality_report'] is None:
        return {'error': 'No data uploaded'}
    return DATA_STORE['quality_report']['issues_logged']


# ─────────────────────────────────────────────────────────────────────────────
# CORE METRICS (KPIs)
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/metrics')
async def get_metrics():
    df = DATA_STORE['df']
    raw_df = DATA_STORE['raw_df']
    report = DATA_STORE['quality_report']

    if df is None:
        return {'error': 'No data'}

    total_spend = float(df['amount_inr'].sum())

    flagged_mask = df['status'].str.lower() != 'normal' if 'status' in df.columns else pd.Series([False] * len(df))
    flagged_count = int(flagged_mask.sum())

    personal_mask = df.get('purpose_type', pd.Series(['Business'] * len(df))) == 'Personal'
    personal_count = int(personal_mask.sum())

    duplicates_count = 0
    if report:
        duplicates_count = sum(1 for i in report['issues_logged'] if i['field'] == 'duplicate_check')

    excluded_count = len(raw_df) - len(df) if raw_df is not None else 0

    cat_dist = df.groupby('category')['amount_inr'].sum().to_dict() if 'category' in df.columns else {}
    dept_col = 'department' if 'department' in df.columns else ('category' if 'category' in df.columns else None)
    dept_dist = df.groupby(dept_col)['amount_inr'].sum().to_dict() if dept_col else {}

    severity_dist = {'CRITICAL': 0, 'WARNING': 0, 'INFO': 0}
    if report:
        for issue in report['issues_logged']:
            sev = issue['severity']
            severity_dist[sev] = severity_dist.get(sev, 0) + 1

    currency_dist = df.groupby('currency').size().to_dict() if 'currency' in df.columns else {}

    # ── EBITDA proxy ────────────────────────────────────────────────────────
    # Revenue proxy: assume non-personal, non-flagged transactions as operational expenses
    # EBITDA = Revenue - Operating Expenses (we treat total as OPEX for expense-only ledgers)
    # For a pure expense ledger: EBITDA ≈ −total_spend (negative since it's all outflows)
    # We compute a simple margin based on non-personal vs personal spend
    business_spend = float(df[~personal_mask]['amount_inr'].sum()) if len(df) > 0 else 0
    personal_spend = float(df[personal_mask]['amount_inr'].sum()) if len(df) > 0 else 0

    # Burn Rate = average monthly spend
    try:
        df_dated = df.copy()
        df_dated['txn_date'] = pd.to_datetime(df_dated['txn_date'], errors='coerce')
        df_dated = df_dated.dropna(subset=['txn_date'])
        if len(df_dated) > 0:
            monthly = df_dated.set_index('txn_date').resample('ME')['amount_inr'].sum()
            burn_rate = float(monthly.mean()) if len(monthly) > 0 else total_spend
            # Runway in months: assume cash reserve = 6x avg monthly (approximate)
            # In a real system, the user would provide this — we estimate at 6x
            cash_reserve_estimate = burn_rate * 6
            runway_months = round(cash_reserve_estimate / burn_rate, 1) if burn_rate > 0 else 0
        else:
            burn_rate = total_spend
            runway_months = 0
    except Exception:
        burn_rate = total_spend
        runway_months = 0

    avg_txn = float(df['amount_inr'].mean()) if len(df) > 0 else 0
    max_txn = float(df['amount_inr'].max()) if len(df) > 0 else 0

    return {
        'source_rows': len(raw_df) if raw_df is not None else 0,
        'rows_loaded': len(df),
        'rows_excluded': excluded_count,
        'total_spend': total_spend,
        'business_spend': business_spend,
        'personal_spend': personal_spend,
        'avg_txn': avg_txn,
        'max_txn': max_txn,
        'flagged': flagged_count,
        'personal': personal_count,
        'duplicates': duplicates_count,
        'issues_logged': len(report['issues_logged']) if report else 0,
        'burn_rate': burn_rate,
        'runway_months': runway_months,
        'category_dist': cat_dist,
        'department_dist': dept_dist,
        'issue_severity_dist': severity_dist,
        'currency_dist': currency_dist,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ADVANCED ANALYTICS: CASH FLOW + FORECAST
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/cashflow')
async def get_cashflow():
    df = DATA_STORE['df']
    if df is None:
        return {'error': 'No data'}

    try:
        df2 = df.copy()
        df2['txn_date'] = pd.to_datetime(df2['txn_date'], errors='coerce')
        df2 = df2.dropna(subset=['txn_date', 'amount_inr'])

        if df2.empty:
            return {'historical': [], 'forecast': [], 'running_total': []}

        # Determine appropriate time-scale resampling
        min_dt = df2['txn_date'].min()
        max_dt = df2['txn_date'].max()
        days_span = (max_dt - min_dt).days

        if days_span <= 45:
            resample_rule = 'D'
            date_format = '%b %d'
        elif days_span <= 180:
            resample_rule = 'W'
            date_format = 'Wk %W, %Y'
        else:
            resample_rule = 'M'
            date_format = '%b %Y'

        # Resample
        rule_to_use = 'ME' if resample_rule == 'M' else resample_rule
        agg = df2.set_index('txn_date').resample(rule_to_use)['amount_inr'].sum().reset_index()
        agg.columns = ['date_point', 'expenses']
        agg['month'] = agg['date_point'].dt.strftime(date_format)
        agg['cumulative'] = agg['expenses'].cumsum()

        # ── Time-Series Forecasting ──────────────────────────────────────
        vals = agg['expenses'].values.astype(float)
        x = np.arange(len(vals))
        if len(x) >= 2:
            slope, intercept = np.polyfit(x, vals, 1)
        else:
            slope, intercept = 0.0, float(vals[0]) if len(vals) > 0 else 0.0

        forecast_points = []
        last_date = agg['date_point'].max()

        if resample_rule == 'D':
            forecast_count = 7
        elif resample_rule == 'W':
            forecast_count = 4
        else:
            forecast_count = 3

        for i in range(1, forecast_count + 1):
            if resample_rule == 'D':
                next_dt = last_date + timedelta(days=i)
            elif resample_rule == 'W':
                next_dt = last_date + timedelta(weeks=i)
            else:
                next_dt = last_date + relativedelta(months=i)

            predicted = max(0.0, slope * (len(vals) + i - 1) + intercept)
            forecast_points.append({
                'month': next_dt.strftime(date_format),
                'expenses': round(float(predicted), 2),
                'is_forecast': True
            })

        historical = []
        for _, row in agg.iterrows():
            historical.append({
                'month': row['month'],
                'expenses': round(float(row['expenses']), 2),
                'cumulative': round(float(row['cumulative']), 2),
                'is_forecast': False
            })

        return {
            'historical': historical,
            'forecast': forecast_points,
            'combined': historical + forecast_points,
            'slope': round(float(slope), 2),
            'trend': 'Increasing' if slope > 100 else ('Decreasing' if slope < -100 else 'Stable'),
            'scale': 'daily' if resample_rule == 'D' else ('weekly' if resample_rule == 'W' else 'monthly')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# EXPENSE BREAKDOWN (TREEMAP HIERARCHY)
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/expense-breakdown')
async def get_expense_breakdown():
    df = DATA_STORE['df']
    if df is None:
        return {'error': 'No data'}

    try:
        col_cat = 'category' if 'category' in df.columns else None
        col_dept = 'department' if 'department' in df.columns else None

        if col_cat is None:
            return {'children': []}

        children = []
        for cat, cat_group in df.groupby(col_cat):
            cat_total = float(cat_group['amount_inr'].sum())
            node = {'name': str(cat), 'value': round(cat_total, 2), 'children': []}

            if col_dept:
                for dept, dept_group in cat_group.groupby(col_dept):
                    dept_total = float(dept_group['amount_inr'].sum())
                    node['children'].append({
                        'name': str(dept),
                        'value': round(dept_total, 2),
                        'category': str(cat)
                    })

            children.append(node)

        children.sort(key=lambda x: x['value'], reverse=True)

        total = sum(c['value'] for c in children)
        return {'name': 'Total Expenses', 'value': round(total, 2), 'children': children}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ANOMALY DETECTION (Z-SCORE BASED)
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/anomalies')
async def get_anomalies():
    df = DATA_STORE['df']
    if df is None:
        return {'error': 'No data'}

    try:
        df2 = df.copy()
        df2 = df2.dropna(subset=['amount_inr'])

        if len(df2) < 3:
            return {'anomalies': [], 'threshold': 2.0, 'mean': 0, 'std': 0}

        mean_val = df2['amount_inr'].mean()
        std_val = df2['amount_inr'].std()

        if std_val == 0:
            return {'anomalies': [], 'threshold': 2.0, 'mean': float(mean_val), 'std': 0}

        df2['z_score'] = (df2['amount_inr'] - mean_val) / std_val

        # Flag Z > 2.0 as anomalies (statistical outliers)
        THRESHOLD = 2.0
        anomaly_df = df2[df2['z_score'].abs() > THRESHOLD].copy()

        anomalies = []
        for _, row in anomaly_df.iterrows():
            z = float(row['z_score'])
            severity = 'CRITICAL' if abs(z) > 3.5 else ('WARNING' if abs(z) > 2.5 else 'INFO')
            reason = (
                f"Amount ₹{row['amount_inr']:,.0f} is {abs(z):.1f}σ above mean "
                f"(mean: ₹{mean_val:,.0f}, σ: ₹{std_val:,.0f})"
                if z > 0 else
                f"Amount ₹{row['amount_inr']:,.0f} is unusually low ({abs(z):.1f}σ below mean)"
            )
            anomalies.append({
                'row': int(row.get('raw_row_index', 0)),
                'vendor': str(row.get('vendor', '—')),
                'amount_inr': round(float(row['amount_inr']), 2),
                'txn_date': str(row.get('txn_date', '—')),
                'category': str(row.get('category', '—')),
                'department': str(row.get('department', '—')),
                'z_score': round(z, 2),
                'severity': severity,
                'reason': reason
            })

        anomalies.sort(key=lambda x: abs(x['z_score']), reverse=True)

        return {
            'anomalies': anomalies,
            'count': len(anomalies),
            'threshold': THRESHOLD,
            'mean': round(float(mean_val), 2),
            'std': round(float(std_val), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/insights')
async def get_insights():
    df = DATA_STORE['df']
    raw_df = DATA_STORE['raw_df']
    report = DATA_STORE['quality_report']

    if df is None or len(df) == 0:
        return {'insights': [], 'count': 0}

    insights = []
    total_spend = float(df['amount_inr'].sum())

    # 1. Duplicates Insight
    duplicates_count = 0
    duplicate_spend = 0.0
    if report:
        duplicates_issues = [i for i in report['issues_logged'] if i['field'] == 'duplicate_check']
        duplicates_count = len(duplicates_issues)
        for issue in duplicates_issues:
            val_obj = issue.get('value')
            if val_obj is not None:
                if isinstance(val_obj, (int, float)):
                    duplicate_spend += float(val_obj)
                else:
                    matches = re.findall(r'\d+(?:\.\d+)?', str(val_obj))
                    if matches:
                        duplicate_spend += float(matches[-1])
    
    if duplicates_count > 0:
        insights.append({
            'id': 'duplicates',
            'type': 'danger',
            'title': 'Administrative Duplicates Flagged',
            'metric': f"{duplicates_count} records",
            'desc': f"Exact duplicate invoices detected in ledger. Cleaning them will immediately save ₹{duplicate_spend:,.2f} from double-billings.",
            'actionable': True,
            'actionText': 'Clean duplicates',
            'command': 'Clean duplicate rows'
        })

    # 2. Personal Leakage Insight
    personal_mask = df.get('purpose_type', pd.Series(['Business'] * len(df))) == 'Personal'
    personal_count = int(personal_mask.sum())
    personal_spend = float(df[personal_mask]['amount_inr'].sum()) if personal_count > 0 else 0.0

    if personal_count > 0:
        insights.append({
            'id': 'leakage',
            'type': 'warning',
            'title': 'Non-Business Spend Leakage',
            'metric': f"₹{personal_spend:,.2f}",
            'desc': f"Identified {personal_count} non-business personal expenses (Netflix, Amazon retail, Spotify) billed to corporate card.",
            'actionable': False,
            'actionText': 'Review leakage',
            'command': ''
        })

    # 3. Statistical Anomalies Insight
    if len(df) >= 3:
        mean_val = df['amount_inr'].mean()
        std_val = df['amount_inr'].std()
        if std_val > 0:
            df_temp = df.copy()
            df_temp['z_score'] = (df_temp['amount_inr'] - mean_val) / std_val
            anomalies = df_temp[df_temp['z_score'].abs() > 2.0]
            anomaly_count = len(anomalies)
            anomaly_spend = float(anomalies['amount_inr'].sum()) if anomaly_count > 0 else 0.0
            if anomaly_count > 0:
                insights.append({
                    'id': 'anomalies',
                    'type': 'danger',
                    'title': 'Statistical Outliers Detected',
                    'metric': f"{anomaly_count} outliers",
                    'desc': f"{anomaly_count} transactions exceed 2σ standard deviation (threshold > ₹{int(mean_val + 2*std_val):,}), totaling ₹{anomaly_spend:,.2f}.",
                    'actionable': True,
                    'actionText': 'Audit outliers',
                    'command': 'Flag expenses over ₹50,000 as High Risk'
                })

    # 4. Department Dominance Insight
    col_dept = 'department' if 'department' in df.columns else None
    if col_dept and len(df) > 0:
        dept_group = df.groupby(col_dept)['amount_inr'].sum()
        if not dept_group.empty:
            top_dept = dept_group.idxmax()
            top_dept_spend = float(dept_group.max())
            top_dept_pct = (top_dept_spend / total_spend) * 100 if total_spend > 0 else 0.0
            
            insights.append({
                'id': 'dominance',
                'type': 'info',
                'title': 'Cost-Center Budget Dominance',
                'metric': f"{top_dept_pct:.1f}% share",
                'desc': f"The '{top_dept}' department is our largest spending vertical, consuming ₹{top_dept_spend:,.2f} of aggregate budget.",
                'actionable': False,
                'actionText': 'Cost Center Details',
                'command': ''
            })

    # 5. Peak Spend Outflow Insight
    if 'txn_date' in df.columns and len(df) > 0:
        df_date_group = df.groupby('txn_date')['amount_inr'].sum()
        if not df_date_group.empty:
            peak_date = df_date_group.idxmax()
            # Convert peak_date to string if it is timestamp
            peak_date_str = peak_date.strftime('%Y-%m-%d') if hasattr(peak_date, 'strftime') else str(peak_date)
            peak_amt = float(df_date_group.max())
            insights.append({
                'id': 'peak',
                'type': 'info',
                'title': 'Peak Budget Outflow Registered',
                'metric': f"₹{peak_amt:,.2f}",
                'desc': f"Our highest consolidated single-day burn occurred on {peak_date_str} due to concentrated billing schedules.",
                'actionable': False,
                'actionText': 'View Timeline',
                'command': ''
            })

    return {
        'insights': insights,
        'count': len(insights)
    }


# ─────────────────────────────────────────────────────────────────────────────
# PREDICTIONS & VARIANCE
# ─────────────────────────────────────────────────────────────────────────────

@app.get('/predict')
async def get_predictions():
    df = DATA_STORE['df']
    if df is None:
        return {'error': 'No data'}
    predictor = FinancePredictor(df)
    return predictor.predict_next_quarter_spend()


@app.get('/variance')
async def get_variance():
    df = DATA_STORE['df']
    if df is None:
        return {'error': 'No data'}

    col = 'department' if 'department' in df.columns else 'category'
    unique_depts = df[col].dropna().unique()

    budgets = {
        'Engineering': 15000000.0,
        'Sales': 9000000.0,
        'Product': 7000000.0,
        'Operations': 10000000.0,
        'Finance': 5000000.0,
        'Marketing': 8000000.0,
        'Legal': 4000000.0,
        'Customer Success': 6000000.0,
        'Data Science': 8000000.0,
        'Business Development': 10000000.0
    }

    for dept in unique_depts:
        dept_str = str(dept).strip()
        if dept_str and dept_str not in budgets:
            actual_spend = float(df[df[col] == dept]['amount_inr'].sum())
            buffer_spend = max(100000.0, round(actual_spend * 1.3, -4))
            budgets[dept_str] = buffer_spend

    predictor = FinancePredictor(df)
    return predictor.analyze_variance(budgets)


# ─────────────────────────────────────────────────────────────────────────────
# AI CHAT + ACTIONS
# ─────────────────────────────────────────────────────────────────────────────

@app.post('/ai/action')
async def execute_ai_action(action: AIAction):
    df = DATA_STORE['df']
    if df is None:
        raise HTTPException(status_code=400, detail='No data loaded')

    if action.tool == 'mass_update':
        col = action.params.get('filter_col')
        op = action.params.get('op')
        val = action.params.get('val')
        target = action.params.get('target_col')
        new_val = action.params.get('new_val')

        if not col or not op or val is None or not target:
            raise HTTPException(status_code=400, detail='Invalid parameters')

        if op == '>':   mask = df[col] > float(val)
        elif op == '<': mask = df[col] < float(val)
        else:           mask = df[col] == val

        DATA_STORE['df'].loc[mask, target] = new_val
        df_json = DATA_STORE['df'].replace({pd.NA: None, float('nan'): None, np.nan: None})
        return {
            'message': f'Updated {mask.sum()} rows where {col} {op} {val} → {target} = {new_val}',
            'data': df_json.to_dict(orient='records')
        }

    elif action.tool == 'categorize_vendor':
        vendor = action.params.get('vendor')
        new_category = action.params.get('category')
        if not vendor or not new_category:
            raise HTTPException(status_code=400, detail='Invalid vendor update parameters')
        mask = df['vendor'].str.lower() == vendor.lower()
        DATA_STORE['df'].loc[mask, 'category'] = new_category
        df_json = DATA_STORE['df'].replace({pd.NA: None, float('nan'): None, np.nan: None})
        return {
            'message': f"Re-categorized {mask.sum()} entries for '{vendor}' to '{new_category}'",
            'data': df_json.to_dict(orient='records')
        }

    elif action.tool == 'clean_duplicates':
        original_count = len(df)
        subset = ['txn_date', 'vendor', 'amount_raw']
        existing_subset = [col for col in subset if col in df.columns]
        if existing_subset:
            DATA_STORE['df'] = df.drop_duplicates(subset=existing_subset, keep='first').copy()
            cleaned_count = len(DATA_STORE['df'])
            diff = original_count - cleaned_count
            if DATA_STORE['quality_report']:
                DATA_STORE['quality_report']['issues_logged'] = [
                    i for i in DATA_STORE['quality_report']['issues_logged']
                    if i['field'] != 'duplicate_check'
                ]
            df_json = DATA_STORE['df'].replace({pd.NA: None, float('nan'): None, np.nan: None})
            return {
                'message': f'Removed {diff} duplicate rows. Cleaned count: {cleaned_count}.',
                'data': df_json.to_dict(orient='records')
            }

    elif action.tool == 'reset_ledger':
        if DATA_STORE['raw_df'] is None:
            raise HTTPException(status_code=400, detail='No backup to restore')
        validator = ExpenseValidator(DATA_STORE['raw_df'])
        report = validator.run()
        DATA_STORE['quality_report'] = report
        DATA_STORE['df'] = validator.get_clean_rows()
        if 'status' not in DATA_STORE['df'].columns:
            DATA_STORE['df']['status'] = 'Normal'
        df_json = DATA_STORE['df'].replace({pd.NA: None, float('nan'): None, np.nan: None})
        return {
            'message': 'Database restored to original state. All AI actions cleared.',
            'data': df_json.to_dict(orient='records')
        }

    return {'error': 'Unknown tool'}


@app.post('/ai/chat')
async def chat_copilot(payload: AIChatQuery):
    query = payload.query.strip()
    df = DATA_STORE['df']

    if df is None:
        return {
            'response': 'Please upload a CSV ledger file first so I can analyze it.',
            'action': None
        }

    query_lower = query.lower()

    # 1. Actionable Directives
    if 'reset' in query_lower or 'restore' in query_lower or 'clear all' in query_lower:
        return {
            'response': 'Restoring database to original uploaded state and wiping all manual changes.',
            'action': {'tool': 'reset_ledger', 'params': {}}
        }

    if 'clean duplicate' in query_lower or 'remove duplicate' in query_lower or 'delete duplicate' in query_lower:
        return {
            'response': 'Processing exact duplicate removal scan...',
            'action': {'tool': 'clean_duplicates', 'params': {}}
        }

    flag_match = re.search(r'flag.*(?:over|above|>)\s*₹?\s*(\d+[\d,]*)\s*as\s*([a-zA-Z\s]+)', query_lower)
    if not flag_match:
        flag_match = re.search(r'flag.*(?:over|above|>)\s*(\d+[\d,]*)\s*as\s*([a-zA-Z\s]+)', query_lower)
    if flag_match:
        try:
            amount = float(flag_match.group(1).replace(',', ''))
            label = ' '.join([w.capitalize() for w in flag_match.group(2).strip().split()])
            return {
                'response': f"Flagging all transactions > ₹{amount:,} as '{label}'...",
                'action': {
                    'tool': 'mass_update',
                    'params': {'filter_col': 'amount_inr', 'op': '>', 'val': amount, 'target_col': 'status', 'new_val': label}
                }
            }
        except Exception:
            pass

    cat_match = re.search(r'(?:change|set|mark|categorize)\s+([a-zA-Z0-9\s\.,\-\_]+)\s+(?:category\s+)?to\s+([a-zA-Z0-9\s\&\/]+)', query_lower)
    if cat_match:
        vendor = cat_match.group(1).replace('category of', '').replace('vendor', '').strip()
        new_category = ' '.join([w.capitalize() for w in cat_match.group(2).strip().split()])
        new_category = new_category.replace('And', '&').replace('Saas', 'SaaS')
        return {
            'response': f"Updating category for '{vendor}' to '{new_category}'...",
            'action': {'tool': 'categorize_vendor', 'params': {'vendor': vendor, 'category': new_category}}
        }

    # 2. Pre-calculate General Stats for Heuristic Answering
    total_spend = float(df['amount_inr'].sum())
    avg_spend = float(df['amount_inr'].mean())
    row_count = len(df)
    
    # Peak Spend Date
    df_date_group = df.groupby('txn_date')['amount_inr'].sum()
    peak_date = df_date_group.idxmax() if not df_date_group.empty else 'N/A'
    peak_amt = df_date_group.max() if not df_date_group.empty else 0.0

    # Highest Single Expense
    highest_idx = df['amount_inr'].idxmax() if not df.empty else None
    highest_row = df.loc[highest_idx] if highest_idx is not None else None

    # Categories Breakdown
    cat_spend = df.groupby('category')['amount_inr'].sum().sort_values(ascending=False)
    # Departments Breakdown
    dept_spend = df.groupby('department')['amount_inr'].sum().sort_values(ascending=False)
    # Vendors Breakdown
    vendor_spend = df.groupby('vendor')['amount_inr'].sum().sort_values(ascending=False)

    # Personal Expenses
    personal_df = df[df['purpose_type'] == 'Personal']
    personal_spend = float(personal_df['amount_inr'].sum())
    personal_count = len(personal_df)

    # Statistical Anomalies
    mean_val = df['amount_inr'].mean()
    std_val = df['amount_inr'].std()
    anomalies = df[(df['amount_inr'] - mean_val).abs() > 2 * std_val] if std_val > 0 else df.head(0)
    anomaly_count = len(anomalies)

    # 3. Dynamic Question Answering Heuristics
    
    # WHY (e.g., "why is our burn rate high?", "why did we spend so much?")
    if 'why' in query_lower and ('high' in query_lower or 'spend' in query_lower or 'burn' in query_lower or 'expensive' in query_lower or 'cost' in query_lower):
        top_cats = "\n".join([f"  - **{c}**: ₹{v:,.2f} ({v/total_spend*100:.1f}%)" for c, v in cat_spend.head(3).items()])
        top_depts = "\n".join([f"  - **{d}**: ₹{v:,.2f} ({v/total_spend*100:.1f}%)" for d, v in dept_spend.head(3).items()])
        
        response = (
            f"### Financial Audit: Why Our Spending is Structured This Way\n\n"
            f"Our total expenditure stands at **₹{total_spend:,.2f}** across **{row_count} transactions**.\n\n"
            f"#### 📊 Primary Expense Drivers by Category:\n{top_cats}\n\n"
            f"#### 🏢 Top Consuming Teams & Cost Centers:\n{top_depts}\n\n"
            f"#### 💡 Core Observations:\n"
        )
        if highest_row is not None:
            response += f"- **Peak Outflow**: A massive single expense of **₹{highest_row['amount_inr']:,.2f}** was registered for **{highest_row['vendor']}** on {highest_row['txn_date']}.\n"
        if personal_spend > 0:
            response += f"- **Non-Business Leakage**: We mapped **₹{personal_spend:,.2f}** ({personal_spend/total_spend*100:.1f}% of budget) to personal expenses (e.g. Netflix, Spotify, Amazon retail purchases).\n"
        if anomaly_count > 0:
            response += f"- **Statistical Deviations**: There are **{anomaly_count} anomalous outliers** exceeding a 2σ threshold that skew our total budget averages.\n"
        
        return {'response': response, 'action': None}

    # HOW (e.g., "how can we save money?", "how to reduce expenses?", "how is runway calculated?")
    if 'how' in query_lower and ('save' in query_lower or 'reduce' in query_lower or 'optimize' in query_lower or 'cut' in query_lower or 'budget' in query_lower):
        recommendations = []
        if personal_spend > 0:
            recommendations.append(
                f"1. **Disallow Personal Spend Billing**: We identified **{personal_count} personal items** totaling **₹{personal_spend:,.2f}**. "
                f"Moving these to personal credit cards immediately reduces our burn by **{personal_spend/total_spend*100:.1f}%**."
            )
        if anomaly_count > 0:
            recommendations.append(
                f"2. **Audit Statistical Outliers**: There are **{anomaly_count} high-severity outliers** totaling substantial capital. "
                f"Reviewing terms for **{vendor_spend.index[0]}** or other large merchants could secure enterprise discounts."
            )
        if 'SaaS Subscriptions' in cat_spend:
            saas_val = cat_spend['SaaS Subscriptions']
            recommendations.append(
                f"3. **Prune SaaS Subscriptions**: SaaS license fees total **₹{saas_val:,.2f}** ({saas_val/total_spend*100:.1f}%). "
                f"Eliminating redundant seats and consolidating software accounts (e.g. communication, design platforms) will cut 10-15% of this recurring burn."
            )
        
        if not recommendations:
            recommendations.append(
                "1. **Consolidate Vendor Agreements**: Group transactions by merchant to negotiate volume discounts with your top suppliers.\n"
                "2. **Set Spend Threshold Rules**: Flag all expenses exceeding ₹50,000 for strict CFO approval before fulfillment."
            )
            
        rec_str = "\n\n".join(recommendations)
        return {
            'response': (
                f"### Cost Reduction & Spend Optimization Strategy\n\n"
                f"Based on real-time ledger diagnostics, here is our custom savings roadmap:\n\n{rec_str}\n\n"
                f"*Tip: Use the directive **'Clean duplicate rows'** to instantly wipe out administrative double-billings!*"
            ),
            'action': None
        }

    # WHEN (e.g., "when did we spend the most?", "when did the highest expense occur?")
    if 'when' in query_lower or 'date' in query_lower or 'time' in query_lower:
        response = (
            f"### Temporal Analysis: Peak Expenditure Windows\n\n"
            f"- **Peak Spend Day**: **{peak_date}** recorded the highest daily aggregate spend of **₹{peak_amt:,.2f}**.\n"
        )
        if highest_row is not None:
            response += f"- **Highest Transaction Date**: The single largest charge of **₹{highest_row['amount_inr']:,.2f}** occurred on **{highest_row['txn_date']}** to **{highest_row['vendor']}**.\n"
        
        # Monthly timeline breakdown
        try:
            df2 = df.copy()
            df2['txn_date'] = pd.to_datetime(df2['txn_date'], errors='coerce')
            monthly = df2.set_index('txn_date').resample('ME')['amount_inr'].sum()
            timeline_str = "\n".join([f"  - **{m.strftime('%B %Y')}**: ₹{amt:,.2f}" for m, amt in monthly.items()])
            response += f"\n#### Monthly Budget Outflows:\n{timeline_str}"
        except Exception:
            pass

        return {'response': response, 'action': None}

    # WHO / WHAT VENDORS (e.g., "who are our top vendors?", "which merchant got the most?")
    if 'who' in query_lower or 'vendor' in query_lower or 'merchant' in query_lower:
        top_v = "\n".join([f"{i+1}. **{v}**: ₹{a:,.2f} ({a/total_spend*100:.1f}%)" for i, (v, a) in enumerate(vendor_spend.head(5).items())])
        return {
            'response': (
                f"### Merchant Registry: Top 5 Vendors by Capital Outflow\n\n"
                f"Our primary commercial suppliers represent the majority of our vendor spend:\n\n{top_v}"
            ),
            'action': None
        }

    # WHAT (Specific metric lookups: spend, burn rate, runway, category, anomalies)
    if 'burn rate' in query_lower:
        try:
            df2 = df.copy()
            df2['txn_date'] = pd.to_datetime(df2['txn_date'], errors='coerce')
            monthly = df2.set_index('txn_date').resample('ME')['amount_inr'].sum()
            burn = float(monthly.mean()) if not monthly.empty else total_spend
            return {
                'response': f"### Operational Outflow: Monthly Burn Rate\n\n"
                            f"Average Monthly Burn Rate is calculated as **₹{burn:,.2f}** based on aggregated date resampling.\n"
                            f"This indicates our recurring operational cash drain speed.",
                'action': None
            }
        except Exception:
            pass

    if 'runway' in query_lower:
        try:
            df2 = df.copy()
            df2['txn_date'] = pd.to_datetime(df2['txn_date'], errors='coerce')
            monthly = df2.set_index('txn_date').resample('ME')['amount_inr'].sum()
            burn = float(monthly.mean()) if not monthly.empty else total_spend
            starting_cash = 100000000.0  # ₹100M baseline
            runway = starting_cash / burn if burn > 0 else 12.0
            return {
                'response': f"### Runway Outlook\n\n"
                            f"- **Average Burn**: **₹{burn:,.2f} / month**\n"
                            f"- **Baseline Cash Reserve Pool**: **₹{starting_cash:,.2f}**\n"
                            f"- **Estimated Runway**: **{runway:.1f} months**\n\n"
                            f"Formula: `Runway = Cash Reserves / Average Monthly Burn Rate`.",
                'action': None
            }
        except Exception:
            pass

    if 'anomal' in query_lower or 'outlier' in query_lower:
        return {
            'response': f"### Outlier Scan Results\n\n"
                        f"- Flagged **{anomaly_count} statistical anomalies** exceeding 2σ from the mean.\n"
                        f"- **Ledger Averages**: Mean: *₹{mean_val:,.2f}*, σ: *₹{std_val:,.2f}*.\n"
                        f"- Look at the **Anomalies Table** under the Dashboard tab to review their specific Z-scores.",
            'action': None
        }

    if 'highest expense' in query_lower or 'largest expense' in query_lower or 'most expensive' in query_lower or 'highest spend' in query_lower:
        if highest_row is not None:
            return {
                'response': f"### Premium Transaction Audit: Largest Expense\n\n"
                            f"The largest single invoice in the database is:\n"
                            f"- **Vendor**: **{highest_row['vendor']}**\n"
                            f"- **Amount (INR Equivalent)**: **₹{highest_row['amount_inr']:,.2f}**\n"
                            f"- **Standardized Category**: *{highest_row.get('category', 'N/A')}*\n"
                            f"- **Team cost-center**: *{highest_row.get('department', 'N/A')}*\n"
                            f"- **Date Registered**: {highest_row['txn_date']}",
                'action': None
            }

    if 'total spend' in query_lower or 'how much did we spend' in query_lower or 'total expense' in query_lower:
        return {
            'response': f"### Ledger Pure Audit: Total Spend\n\n"
                        f"The total consolidated expenditure across the cleaned dataset is **₹{total_spend:,.2f}**.",
            'action': None
        }

    # 4. Search Filter Semantic Lookup Fallback (if they ask about a specific department, vendor, or category)
    # Check if query matches any category
    matched_cats = [c for c in cat_spend.index if c.lower() in query_lower]
    if matched_cats:
        c = matched_cats[0]
        v = cat_spend[c]
        v_rows = df[df['category'] == c]
        top_v = v_rows.groupby('vendor')['amount_inr'].sum().sort_values(ascending=False).head(3)
        top_v_str = ", ".join([f"{vend} (₹{amt:,.2f})" for vend, amt in top_v.items()])
        return {
            'response': f"### Category Deep-Dive: **{c}**\n\n"
                        f"- **Total Spend**: **₹{v:,.2f}** ({v/total_spend*100:.1f}% of entire ledger).\n"
                        f"- **Transaction Count**: {len(v_rows)} rows.\n"
                        f"- **Key Vendors**: {top_v_str}.",
            'action': None
        }

    # Check if query matches any department
    matched_depts = [d for d in dept_spend.index if d.lower() in query_lower]
    if matched_depts:
        d = matched_depts[0]
        v = dept_spend[d]
        d_rows = df[df['department'] == d]
        top_c = d_rows.groupby('category')['amount_inr'].sum().sort_values(ascending=False).head(3)
        top_c_str = ", ".join([f"{cat} (₹{amt:,.2f})" for cat, amt in top_c.items()])
        return {
            'response': f"### Cost Center Deep-Dive: Department of **{d}**\n\n"
                        f"- **Total Spend**: **₹{v:,.2f}** ({v/total_spend*100:.1f}% of entire ledger).\n"
                        f"- **Active Staff Spend Rows**: {len(d_rows)} rows.\n"
                        f"- **Spend Composition**: {top_c_str}.",
            'action': None
        }

    # Check if query matches any vendor
    matched_vends = [vd for vd in vendor_spend.index if vd.lower() in query_lower]
    if matched_vends:
        vd = matched_vends[0]
        v = vendor_spend[vd]
        v_rows = df[df['vendor'] == vd]
        return {
            'response': f"### Merchant Deep-Dive: **{vd}**\n\n"
                        f"- **Consolidated Capital Billing**: **₹{v:,.2f}** ({v/total_spend*100:.1f}% of entire ledger).\n"
                        f"- **Purchase Transactions**: {len(v_rows)} billings.\n"
                        f"- **Standardized Category mapping**: *{v_rows.iloc[0].get('category', 'Miscellaneous')}*.",
            'action': None
        }

    # Standard Help Fallback
    return {
        'response': "### AI-Native Financial Analyst Co-Pilot\n\n"
                    "I am capable of analyzing dates, amounts, categories, and vendors dynamically to answer any **Why**, **What**, **When**, **How**, or **Who** questions about your general ledger.\n\n"
                    "#### 💡 Example Questions You Can Ask Me:\n"
                    "- **Why**: *'Why is our burn rate high?'* or *'Why are we spending so much?'*\n"
                    "- **How**: *'How can we reduce expenses?'* or *'How is runway calculated?'*\n"
                    "- **When**: *'When did we spend the most?'* or *'Show budget timeline'* \n"
                    "- **Who**: *'Who are our top vendors?'*\n"
                    "- **What**: *'What is our highest expense?'* or *'Analyse SaaS Subscriptions category'*",
        'action': None
    }
