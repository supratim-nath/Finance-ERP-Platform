from typing import List, Dict, Any, Optional
import pandas as pd
import re
from datetime import datetime
import numpy as np

class ExpenseValidator:
    def __init__(self, df: pd.DataFrame):
        # Create a deep copy to keep original data safe
        self.df = df.copy()
        
        # Add index column to preserve raw file reference rows
        if 'raw_row_index' not in self.df.columns:
            self.df['raw_row_index'] = self.df.index + 1
            
        # Standard expected columns mapping rules
        mapping_rules = {
            'txn_date': ['txn_date', 'tx_date', 'transaction_date', 'date', 'time', 'timestamp', 'created_at', 'day', 'month', 'year'],
            'vendor': ['vendor', 'vendor_name', 'merchant', 'payee', 'description', 'name', 'details', 'particulars', 'company', 'client', 'supplier', 'store'],
            'amount_raw': ['amount_raw', 'amount', 'value', 'total', 'sum', 'price', 'cost', 'charge', 'amount_inr', 'usd', 'eur', 'inr', 'cash', 'spend'],
            'category': ['category', 'type', 'expense_type', 'group', 'class', 'purpose', 'label'],
            'department': ['department', 'dept', 'cost_center', 'team', 'division']
        }
        
        actual_cols = list(self.df.columns)
        mapped_cols = {}
        used_actuals = set()
        
        # Helper to normalize strings for comparison
        def normalize_str(s):
            return re.sub(r'[^a-z0-9]', '', str(s).lower())
            
        # Match each expected field by precedence of rules
        for std_key, synonyms in mapping_rules.items():
            matched_col = None
            
            # Match 1: Exact normalized matches (ignoring casing, spaces, underscores, symbols)
            for col in actual_cols:
                if col in used_actuals or col == 'raw_row_index':
                    continue
                norm_col = normalize_str(col)
                for syn in synonyms:
                    if norm_col == normalize_str(syn):
                        matched_col = col
                        break
                if matched_col:
                    break
                    
            # Match 2: Substring matching
            if not matched_col:
                for col in actual_cols:
                    if col in used_actuals or col == 'raw_row_index':
                        continue
                    norm_col = normalize_str(col)
                    for syn in synonyms:
                        norm_syn = normalize_str(syn)
                        if norm_syn in norm_col or norm_col in norm_syn:
                            matched_col = col
                            break
                    if matched_col:
                        break
            
            if matched_col:
                mapped_cols[std_key] = matched_col
                used_actuals.add(matched_col)

        # Fallback scanners for missing critical fields
        # Fallback for amount_raw: find any numerical-like column
        if 'amount_raw' not in mapped_cols:
            for col in actual_cols:
                if col in used_actuals or col == 'raw_row_index':
                    continue
                non_null = self.df[col].dropna()
                if len(non_null) > 0:
                    castable = 0
                    for val in non_null.head(10):
                        clean_val = re.sub(r'[^\d\.\-\+eE]', '', str(val))
                        try:
                            float(clean_val)
                            castable += 1
                        except ValueError:
                            pass
                    if castable >= len(non_null.head(10)) * 0.7:
                        mapped_cols['amount_raw'] = col
                        used_actuals.add(col)
                        break

        # Fallback for txn_date: find any date-like format
        if 'txn_date' not in mapped_cols:
            for col in actual_cols:
                if col in used_actuals or col == 'raw_row_index':
                    continue
                non_null = self.df[col].dropna()
                if len(non_null) > 0:
                    date_matches = 0
                    for val in non_null.head(10):
                        val_str = str(val)
                        if '/' in val_str or '-' in val_str or (val_str.isdigit() and len(val_str) >= 10):
                            date_matches += 1
                    if date_matches >= len(non_null.head(10)) * 0.7:
                        mapped_cols['txn_date'] = col
                        used_actuals.add(col)
                        break

        # Apply fuzzy mapping to DataFrame, keeping original names in mapping log
        for std_key, actual_col in mapped_cols.items():
            self.df[std_key] = self.df[actual_col]
            
        # Synthesize standard fallbacks for any missing parameters
        if 'txn_date' not in mapped_cols:
            self.df['txn_date'] = datetime.now().strftime('%Y-%m-%d')
            
        if 'vendor' not in mapped_cols:
            # First unmapped text column if exists, otherwise 'Unknown Vendor'
            unmapped_text = None
            for col in actual_cols:
                if col not in used_actuals and col != 'raw_row_index':
                    unmapped_text = col
                    break
            if unmapped_text:
                self.df['vendor'] = self.df[unmapped_text]
                used_actuals.add(unmapped_text)
            else:
                self.df['vendor'] = 'Unknown Vendor'
                
        if 'amount_raw' not in mapped_cols:
            self.df['amount_raw'] = 'INR 0.0'
            
        if 'category' not in mapped_cols:
            # Fallback to 'Miscellaneous'
            self.df['category'] = 'Miscellaneous'
            
        if 'department' not in mapped_cols:
            # Fallback to 'General'
            self.df['department'] = 'General'
        
        self.quality_report = {
            'source_rows': len(df),
            'critical': [],
            'warnings': [],
            'info': [],
            'issues_logged': []  # Structured audit issues
        }

    def clean_dates(self):
        def parse_date(val):
            if pd.isna(val) or str(val).strip() == '':
                return None, "Empty transaction date"
            
            str_val = str(val).strip()
            try:
                # Handle Unix Epoch (10 digits or more)
                if str_val.isdigit() and len(str_val) >= 10:
                    dt = datetime.fromtimestamp(int(str_val[:10]))
                    return dt.strftime('%Y-%m-%d'), None
                
                # Try standard parsing
                dt = pd.to_datetime(str_val)
                if pd.isna(dt):
                    return None, f"Could not parse date string '{str_val}'"
                return dt.strftime('%Y-%m-%d'), None
            except Exception as e:
                return None, f"Date format error: {str(e)}"
        
        parsed_dates = self.df['txn_date'].apply(parse_date)
        
        # Unpack values and issues
        self.df['txn_date'] = parsed_dates.apply(lambda x: x[0])
        date_errors = parsed_dates.apply(lambda x: x[1])
        
        # Log critical date issues
        for idx, err in date_errors.items():
            if err is not None:
                row_ref = int(self.df.loc[idx, 'raw_row_index'])
                self.quality_report['critical'].append(idx)
                self.quality_report['issues_logged'].append({
                    'row': row_ref,
                    'severity': 'CRITICAL',
                    'field': 'txn_date',
                    'value': str(self.df.loc[idx, 'txn_date'] if 'txn_date' in self.df.columns else ''),
                    'issue': err
                })
        return self

    def clean_amounts(self, exchange_rates: Dict[str, float]):
        def parse_amount(val):
            if pd.isna(val) or str(val).strip() == '':
                return None, "INR Equivalent", "Empty transaction amount"
            
            str_val = str(val).strip()
            # Extract currency if present (e.g. 'USD 500', '$ 250')
            currency = 'INR'
            
            # Check for standard currency codes
            code_match = re.search(r'([A-Z]{3})\s*(-?\d+)', str_val)
            if code_match:
                currency = code_match.group(1)
                str_val = code_match.group(2)
            else:
                # Deduce from common symbols
                if '$' in str_val:
                    currency = 'USD'
                elif '€' in str_val or 'EUR' in str_val:
                    currency = 'EUR'
                elif '£' in str_val or 'GBP' in str_val:
                    currency = 'GBP'
                elif '¥' in str_val:
                    currency = 'JPY'
                elif '₹' in str_val:
                    currency = 'INR'
                
                # Strip all non-numeric chars except decimals and negative signs
                str_val = re.sub(r'[^\d\.\-]', '', str_val)
            
            try:
                amount = float(str_val)
                if amount < 0:
                    return amount, currency, f"Negative amount detected: {amount} ({currency})"
                
                rate = exchange_rates.get(currency, 1.0)
                converted = amount * rate
                return converted, currency, None
            except Exception as e:
                return None, currency, f"Invalid numeric format: {str_val} ({currency})"

        parsed_amounts = self.df['amount_raw'].apply(parse_amount)
        
        self.df['amount_inr'] = parsed_amounts.apply(lambda x: x[0])
        self.df['currency'] = parsed_amounts.apply(lambda x: x[1])
        amount_errors = parsed_amounts.apply(lambda x: x[2])
        
        # Log critical amount issues
        for idx, err in amount_errors.items():
            row_ref = int(self.df.loc[idx, 'raw_row_index'])
            if err is not None:
                if self.df.loc[idx, 'amount_inr'] is None:
                    # Non-parseable amount is Critical
                    self.quality_report['critical'].append(idx)
                    self.quality_report['issues_logged'].append({
                        'row': row_ref,
                        'severity': 'CRITICAL',
                        'field': 'amount_raw',
                        'value': str(self.df.loc[idx, 'amount_raw']),
                        'issue': err
                    })
                else:
                    # Negative parsed amount is a warning
                    self.quality_report['warnings'].append(idx)
                    self.quality_report['issues_logged'].append({
                        'row': row_ref,
                        'severity': 'WARNING',
                        'field': 'amount_raw',
                        'value': str(self.df.loc[idx, 'amount_raw']),
                        'issue': err
                    })
        return self

    def find_duplicates(self):
        # Preserving original duplicate finder logic, check if fields are identical
        # To avoid index alignment, we use duplicate flags based on subsets of txn_date, vendor, amount_raw
        subset = ['txn_date', 'vendor', 'amount_raw']
        # Filter columns to only include existing ones
        existing_subset = [col for col in subset if col in self.df.columns]
        
        if len(existing_subset) > 0:
            duplicates = self.df.duplicated(subset=existing_subset, keep='first')
            dup_indices = self.df[duplicates].index.tolist()
            
            for idx in dup_indices:
                row_ref = int(self.df.loc[idx, 'raw_row_index'])
                self.quality_report['warnings'].append(idx)
                self.quality_report['issues_logged'].append({
                    'row': row_ref,
                    'severity': 'WARNING',
                    'field': 'duplicate_check',
                    'value': f"{self.df.loc[idx, 'vendor']} - {self.df.loc[idx, 'amount_raw']}",
                    'issue': "Duplicate entry detected (identical vendor, date, and amount)"
                })
        return self

    def clean_categories(self):
        standard_categories = [
            'Cloud Infrastructure', 'SaaS Subscriptions', 'Hardware & Equipment',
            'Meals & Catering', 'Travel & Transport', 'Finance & Banking',
            'Personal Expense', 'Consulting & Legal', 'Marketing & Advertising',
            'Office Supplies', 'Rent & Utilities', 'HR & Recruiting',
            'Telecommunications', 'Insurance & Benefits', 'Taxes & Compliance',
            'Salaries & Wages', 'Professional Development'
        ]
        
        personal_keywords = ['personal', 'netflix', 'spotify', 'amazon retail', 'grocery', 'uber personal', 'starbucks personal']
        
        for idx, row in self.df.iterrows():
            vendor = str(row.get('vendor', '')).strip()
            cat = str(row.get('category', '')).strip()
            
            inferred = cat
            if pd.isna(cat) or cat in ['', 'Miscellaneous', 'General', 'unknown', 'None', 'NaN', 'other']:
                v_lower = vendor.lower()
                
                if any(k in v_lower for k in ['aws', 'cloud', 'gcp', 'azure', 'server', 'hosting', 'vercel', 'heroku', 'digitalocean', 'compute', 'linode', 'cloudflare']):
                    inferred = 'Cloud Infrastructure'
                elif any(k in v_lower for k in ['slack', 'figma', 'github', 'jira', 'confluence', 'adobe', 'microsoft', 'google workspace', 'salesforce', 'zendesk', 'hubspot', 'datadog', 'new relic', 'mailchimp', 'calendly', 'notion', 'canva', 'openai', 'subscription', 'software', 'license']):
                    inferred = 'SaaS Subscriptions'
                elif any(k in v_lower for k in ['dell', 'hp', 'lenovo', 'apple', 'macbook', 'laptop', 'monitor', 'keyboard', 'hardware', 'equipment', 'router', 'switch', 'printer', 'device']):
                    inferred = 'Hardware & Equipment'
                elif any(k in v_lower for k in ['uber', 'lyft', 'taxi', 'cab', 'flight', 'airline', 'hotel', 'airbnb', 'travel', 'rail', 'train', 'metro', 'airlines', 'stay', 'transit']):
                    inferred = 'Travel & Transport'
                elif any(k in v_lower for k in ['starbucks', 'meals', 'catering', 'swiggy', 'zomato', 'restaurant', 'dinner', 'lunch', 'breakfast', 'buffet', 'food', 'cafe', 'eats']):
                    inferred = 'Meals & Catering'
                elif any(k in v_lower for k in ['bank', 'hdfc', 'icici', 'sbi', 'hsbc', 'card', 'finance', 'interest', 'fee', 'charge', 'refund', 'banking', 'transaction fee']):
                    inferred = 'Finance & Banking'
                elif any(k in v_lower for k in ['law', 'legal', 'consultant', 'consulting', 'attorney', 'counsel', 'solicitor', 'advocate', 'advisory', 'firm']):
                    inferred = 'Consulting & Legal'
                elif any(k in v_lower for k in ['marketing', 'advertisement', 'ads', 'facebook ads', 'google ads', 'event', 'sponsorship', 'promotional', 'banner', 'campaign', 'pr agency']):
                    inferred = 'Marketing & Advertising'
                elif any(k in v_lower for k in ['office', 'paper', 'supply', 'supplies', 'stationary', 'staples', 'retail', 'purchase', 'depot']):
                    inferred = 'Office Supplies'
                elif any(k in v_lower for k in ['rent', 'utility', 'utilities', 'power', 'electricity', 'water', 'gas', 'landlord', 'broadband', 'lease']):
                    inferred = 'Rent & Utilities'
                elif any(k in v_lower for k in ['recruiting', 'hiring', 'hr', 'talent', 'peopledoc', 'recruiter']):
                    inferred = 'HR & Recruiting'
                elif any(k in v_lower for k in ['comcast', 'verizon', 'telecom', 'internet', 'at&t', 'phone', 'mobile', 'skype']):
                    inferred = 'Telecommunications'
                elif any(k in v_lower for k in ['insurance', 'premium', 'benefit', 'health', 'life', 'dental', 'vision', 'aetna', 'cigna']):
                    inferred = 'Insurance & Benefits'
                elif any(k in v_lower for k in ['tax', 'irs', 'gst', 'customs', 'duty', 'filing', 'compliance']):
                    inferred = 'Taxes & Compliance'
                elif any(k in v_lower for k in ['salary', 'payroll', 'wages', 'bonus', 'direct deposit', 'reimbursement', 'compensation']):
                    inferred = 'Salaries & Wages'
                elif any(k in v_lower for k in ['udemy', 'coursera', 'training', 'tutorial', 'pluralsight', 'coaching', 'conference', 'certification', 'education']):
                    inferred = 'Professional Development'
                elif any(k in v_lower for k in personal_keywords):
                    inferred = 'Personal Expense'
                else:
                    inferred = 'Miscellaneous'
            
            if inferred not in standard_categories:
                inferred = ' '.join([w.capitalize() for w in inferred.split()])
                if inferred == 'Saas Subscriptions':
                    inferred = 'SaaS Subscriptions'
            
            self.df.at[idx, 'category'] = inferred

    def find_personal_expenses(self):
        # Personal expenses check
        # Flag transactions containing keywords like 'personal', 'hotel', 'dinner', 'flight', 'cab', etc., under specific departments or categorizations
        personal_keywords = ['personal', 'netflix', 'spotify', 'amazon retail', 'grocery', 'uber personal', 'starbucks personal']
        
        for idx, row in self.df.iterrows():
            vendor_lower = str(row.get('vendor', '')).lower()
            category_lower = str(row.get('category', '')).lower()
            
            is_personal = False
            reason = ""
            for kw in personal_keywords:
                if kw in vendor_lower or kw in category_lower:
                    is_personal = True
                    reason = f"Personal expense keyword match: '{kw}'"
                    break
            
            if is_personal:
                row_ref = int(self.df.loc[idx, 'raw_row_index'])
                self.quality_report['info'].append(idx)
                self.quality_report['issues_logged'].append({
                    'row': row_ref,
                    'severity': 'INFO',
                    'field': 'business_purpose',
                    'value': str(row.get('vendor')),
                    'issue': reason
                })
                # Add status tag dynamically
                self.df.at[idx, 'purpose_type'] = 'Personal'
            else:
                self.df.at[idx, 'purpose_type'] = 'Business'
                
        return self

    def run(self):
        self.clean_dates()
        rates = {'USD': 83.5, 'EUR': 91.2, 'GBP': 106.4, 'SGD': 62.3, 'AED': 22.73, 'INR': 1.0}
        self.clean_amounts(rates)
        self.clean_categories()
        self.find_duplicates()
        self.find_personal_expenses()
        
        # Make lists of critical & warning unique
        self.quality_report['critical'] = list(set(self.quality_report['critical']))
        self.quality_report['warnings'] = list(set(self.quality_report['warnings']))
        self.quality_report['info'] = list(set(self.quality_report['info']))
        
        return self.quality_report

    def get_clean_rows(self):
        # Clean rows are those with valid parsed amounts AND valid parsed dates
        return self.df[self.df['amount_inr'].notna() & self.df['txn_date'].notna()].copy()

    def get_critical_issues(self):
        return self.df[self.df['amount_inr'].isna() | self.df['txn_date'].isna()].copy()
