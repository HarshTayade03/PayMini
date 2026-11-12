from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.config import settings
from app.core.money import format_paise_to_display
from app.core.dependencies import get_current_user, get_user_wallet
from app.models.models import User, Wallet, LedgerEntry, LedgerEntryType
from app.schemas.schemas import WalletResponse, TopUpRequest

router = APIRouter(prefix="/wallet", tags=["Wallet"])


@router.get(
    "",
    response_model=WalletResponse,
    summary="Get authenticated user's wallet balance"
)
def get_wallet(wallet: Wallet = Depends(get_user_wallet)):
    return WalletResponse(
        id=wallet.id,
        user_id=wallet.user_id,
        balance_paise=wallet.balance_paise,
        balance_display=format_paise_to_display(wallet.balance_paise),
        currency=wallet.currency,
        updated_at=wallet.updated_at
    )


@router.post(
    "/top-up",
    response_model=WalletResponse,
    summary="Add fake test money to user's wallet (subject to safety caps)"
)
def top_up_wallet(
    req: TopUpRequest,
    wallet: Wallet = Depends(get_user_wallet),
    db: Session = Depends(get_db)
):
    # Rule 1: Request cap
    if req.amount_paise > settings.TOPUP_MAX_PER_REQUEST_PAISE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "exceeds_request_cap",
                "message": f"Maximum top-up per request is {format_paise_to_display(settings.TOPUP_MAX_PER_REQUEST_PAISE)} {settings.DEFAULT_CURRENCY}"
            }
        )

    # Rule 2: Daily cumulative cap check
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_topups_paise = (
        db.query(func.coalesce(func.sum(LedgerEntry.amount_paise), 0))
        .filter(
            LedgerEntry.wallet_id == wallet.id,
            LedgerEntry.entry_type == LedgerEntryType.CREDIT,
            LedgerEntry.transfer_id.is_(None),  # Top-ups have no transfer_id
            LedgerEntry.created_at >= today_start
        )
        .scalar()
    )

    if (daily_topups_paise + req.amount_paise) > settings.TOPUP_MAX_DAILY_PAISE:
        remaining_paise = max(0, settings.TOPUP_MAX_DAILY_PAISE - daily_topups_paise)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "daily_topup_cap_exceeded",
                "message": f"Daily top-up limit reached. Remaining today: {format_paise_to_display(remaining_paise)} {settings.DEFAULT_CURRENCY}"
            }
        )

    # Perform top-up in atomic database transaction
    new_balance = wallet.balance_paise + req.amount_paise
    wallet.balance_paise = new_balance

    ledger_entry = LedgerEntry(
        wallet_id=wallet.id,
        transfer_id=None,
        entry_type=LedgerEntryType.CREDIT,
        amount_paise=req.amount_paise,
        balance_after_paise=new_balance,
        description="Demo wallet test money top-up"
    )
    db.add(ledger_entry)
    db.commit()
    db.refresh(wallet)

    return WalletResponse(
        id=wallet.id,
        user_id=wallet.user_id,
        balance_paise=wallet.balance_paise,
        balance_display=format_paise_to_display(wallet.balance_paise),
        currency=wallet.currency,
        updated_at=wallet.updated_at
    )
