import base64
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.money import format_paise_to_display
from app.core.dependencies import get_current_user, get_user_wallet
from app.models.models import (
    User,
    Wallet,
    Transfer,
    LedgerEntry,
    LedgerEntryType,
)
from app.schemas.schemas import (
    TransactionDirection,
    TransactionHistoryResponse,
    TransactionItem,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def encode_cursor(dt: datetime, entry_id: str) -> str:
    """Encodes created_at timestamp and entry id into base64 cursor string."""
    raw = f"{dt.isoformat()}|{entry_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def decode_cursor(cursor_str: str) -> tuple[datetime, str]:
    """Decodes cursor string into datetime and entry id."""
    try:
        raw = base64.urlsafe_b64decode(cursor_str.encode("utf-8")).decode("utf-8")
        dt_str, entry_id = raw.split("|", 1)
        return datetime.fromisoformat(dt_str), entry_id
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_cursor", "message": "Provided pagination cursor is invalid"}
        )


@router.get(
    "",
    response_model=TransactionHistoryResponse,
    summary="Get user's ledger transaction history with cursor pagination"
)
def get_transactions(
    direction: TransactionDirection = Query(TransactionDirection.ALL, description="Filter direction (all, sent, received)"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
    limit: int = Query(10, ge=1, le=50, description="Items per page (max 50)"),
    wallet: Wallet = Depends(get_user_wallet),
    db: Session = Depends(get_db)
):
    # Query only the authenticated user's ledger entries (IDOR-safe)
    query = db.query(LedgerEntry).filter(LedgerEntry.wallet_id == wallet.id)

    # Filter direction
    if direction == TransactionDirection.SENT:
        query = query.filter(LedgerEntry.entry_type == LedgerEntryType.DEBIT)
    elif direction == TransactionDirection.RECEIVED:
        query = query.filter(LedgerEntry.entry_type == LedgerEntryType.CREDIT)

    # Apply cursor pagination if present: (created_at, id) < (cursor_created_at, cursor_id)
    if cursor:
        cursor_dt, cursor_id = decode_cursor(cursor)
        query = query.filter(
            (LedgerEntry.created_at < cursor_dt) |
            ((LedgerEntry.created_at == cursor_dt) & (LedgerEntry.id < cursor_id))
        )

    # Order newest first using composite index (wallet_id, created_at)
    query = query.order_by(desc(LedgerEntry.created_at), desc(LedgerEntry.id))

    # Fetch limit + 1 to check if there is a next page
    entries = query.limit(limit + 1).all()

    has_more = len(entries) > limit
    results = entries[:limit]

    next_cursor = None
    if has_more and results:
        last_item = results[-1]
        next_cursor = encode_cursor(last_item.created_at, last_item.id)

    # Resolve counterparty email and notes from associated transfers
    items = []
    for entry in results:
        counterparty_email = None
        note = None
        if entry.transfer_id:
            transfer = db.query(Transfer).filter(Transfer.id == entry.transfer_id).first()
            if transfer:
                note = transfer.note
                if entry.entry_type == LedgerEntryType.DEBIT:
                    recipient_wallet = db.query(Wallet).filter(Wallet.id == transfer.recipient_wallet_id).first()
                    if recipient_wallet:
                        recipient_user = db.query(User).filter(User.id == recipient_wallet.user_id).first()
                        counterparty_email = recipient_user.email if recipient_user else None
                else:
                    sender_wallet = db.query(Wallet).filter(Wallet.id == transfer.sender_wallet_id).first()
                    if sender_wallet:
                        sender_user = db.query(User).filter(User.id == sender_wallet.user_id).first()
                        counterparty_email = sender_user.email if sender_user else None

        items.append(
            TransactionItem(
                id=entry.id,
                entry_type=entry.entry_type.value,
                amount_paise=entry.amount_paise,
                amount_display=format_paise_to_display(entry.amount_paise),
                balance_after_paise=entry.balance_after_paise,
                balance_after_display=format_paise_to_display(entry.balance_after_paise),
                description=entry.description,
                counterparty_email=counterparty_email,
                note=note,
                created_at=entry.created_at
            )
        )

    return TransactionHistoryResponse(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more
    )
