export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance_paise: number;
  balance_display: string;
  currency: string;
  updated_at: string;
}

export interface TransactionItem {
  id: string;
  entry_type: "CREDIT" | "DEBIT";
  amount_paise: number;
  amount_display: string;
  balance_after_paise: number;
  balance_after_display: string;
  description: string;
  counterparty_email?: string | null;
  note?: string | null;
  created_at: string;
}

export interface TransactionHistoryResponse {
  items: TransactionItem[];
  next_cursor?: string | null;
  has_more: boolean;
}

export interface ApiError {
  error: {
    error: string;
    message: string;
    details?: any;
  };
}
