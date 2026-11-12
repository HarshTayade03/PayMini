from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Standard Uniform Error Response Schema
class ErrorDetail(BaseModel):
    error: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ---------------- Auth Schemas ----------------
class UserRegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password must be at least 8 characters")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(char.isdigit() for char in v):
            raise ValueError("Password must contain at least one digit")
        if not any(char.isalpha() for char in v):
            raise ValueError("Password must contain at least one letter")
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=128)


class UserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------- Wallet Schemas ----------------
class WalletResponse(BaseModel):
    id: str
    user_id: str
    balance_paise: int = Field(..., description="Balance in minor units (100 paise = 1 INR)")
    balance_display: str = Field(..., description="Formatted display string (e.g. '500.00')")
    currency: str = "INR"
    updated_at: datetime

    class Config:
        from_attributes = True


class TopUpRequest(BaseModel):
    # Top up amount in minor units (paise)
    amount_paise: int = Field(..., gt=0, le=100000, description="Amount in paise to add (max ₹1,000 / 100,000 paise)")


# ---------------- Transfer Schemas ----------------
class TransferRequest(BaseModel):
    recipient_email: EmailStr = Field(..., description="Email address of the recipient")
    amount_paise: int = Field(..., gt=0, le=200000, description="Amount in paise (max ₹2,000 / 200,000 paise)")
    note: Optional[str] = Field(None, max_length=140, description="Optional note (max 140 characters)")


class TransferResponse(BaseModel):
    id: str
    sender_wallet_id: str
    recipient_wallet_id: str
    recipient_email: str
    amount_paise: int
    amount_display: str
    currency: str
    note: Optional[str]
    status: str
    created_at: datetime


# ---------------- Transaction History Schemas ----------------
class TransactionDirection(str, Enum):
    ALL = "all"
    SENT = "sent"
    RECEIVED = "received"


class TransactionItem(BaseModel):
    id: str
    entry_type: str       # CREDIT or DEBIT
    amount_paise: int
    amount_display: str
    balance_after_paise: int
    balance_after_display: str
    description: str
    counterparty_email: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionHistoryResponse(BaseModel):
    items: List[TransactionItem]
    next_cursor: Optional[str] = None
    has_more: bool = False
