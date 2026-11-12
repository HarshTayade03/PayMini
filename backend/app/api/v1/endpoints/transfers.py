import hashlib
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.config import settings
from app.core.money import format_paise_to_display
from app.core.dependencies import get_current_user, get_user_wallet
from app.models.models import (
    User,
    Wallet,
    Transfer,
    LedgerEntry,
    LedgerEntryType,
    TransferStatus,
    IdempotencyKey,
)
from app.schemas.schemas import TransferRequest, TransferResponse

router = APIRouter(prefix="/transfers", tags=["Transfers"])


def compute_request_hash(data: dict) -> str:
    """Deterministic SHA-256 hash of JSON request body."""
    normalized_json = json.dumps(data, sort_keys=True)
    return hashlib.sha256(normalized_json.encode("utf-8")).hexdigest()


@router.post(
    "",
    response_model=TransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Transfer test money to another user by email (supports Idempotency-Key)"
)
def create_transfer(
    req: TransferRequest,
    current_user: User = Depends(get_current_user),
    sender_wallet: Wallet = Depends(get_user_wallet),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db)
):
    request_dict = req.model_dump()
    req_hash = compute_request_hash(request_dict)

    # 1. Idempotency Check
    if idempotency_key:
        existing_key = (
            db.query(IdempotencyKey)
            .filter(
                IdempotencyKey.key == idempotency_key,
                IdempotencyKey.user_id == current_user.id
            )
            .first()
        )
        if existing_key:
            # Same key + same body -> Return stored response without moving money again
            if existing_key.request_hash == req_hash:
                parsed_body = json.loads(existing_key.response_body)
                return TransferResponse(**parsed_body)
            else:
                # Same key + different body -> 422 Unprocessable Entity
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "error": "idempotency_conflict",
                        "message": "Idempotency key was previously used with a different request payload"
                    }
                )

    # 2. Validation: Self-transfer prohibited
    if req.recipient_email.lower() == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "self_transfer", "message": "Cannot transfer money to yourself"}
        )

    # 3. Validation: Single transfer cap
    if req.amount_paise > settings.TRANSFER_MAX_PER_TX_PAISE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "exceeds_transfer_cap",
                "message": f"Maximum transfer amount is {format_paise_to_display(settings.TRANSFER_MAX_PER_TX_PAISE)} {settings.DEFAULT_CURRENCY}"
            }
        )

    # 4. Lookup recipient wallet
    recipient_user = db.query(User).filter(User.email == req.recipient_email.lower()).first()
    if not recipient_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "recipient_not_found", "message": "Recipient email not registered in system"}
        )

    recipient_wallet = db.query(Wallet).filter(Wallet.user_id == recipient_user.id).first()
    if not recipient_wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "recipient_wallet_not_found", "message": "Recipient wallet not initialized"}
        )

    # 5. Check sender balance
    if sender_wallet.balance_paise < req.amount_paise:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "insufficient_funds",
                "message": f"Insufficient wallet balance. Available: {format_paise_to_display(sender_wallet.balance_paise)} {settings.DEFAULT_CURRENCY}"
            }
        )

    # -------------------------------------------------------------
    # 6. ATOMIC TRANSACTION: Execute transfer + ledger entries
    # -------------------------------------------------------------
    try:
        # Create transfer record
        transfer = Transfer(
            sender_wallet_id=sender_wallet.id,
            recipient_wallet_id=recipient_wallet.id,
            amount_paise=req.amount_paise,
            currency=settings.DEFAULT_CURRENCY,
            note=req.note,
            status=TransferStatus.COMPLETED
        )
        db.add(transfer)
        db.flush()  # Generates transfer.id

        # Deduct sender balance
        sender_new_balance = sender_wallet.balance_paise - req.amount_paise
        sender_wallet.balance_paise = sender_new_balance

        # Sender Debit Ledger Entry
        sender_debit = LedgerEntry(
            wallet_id=sender_wallet.id,
            transfer_id=transfer.id,
            entry_type=LedgerEntryType.DEBIT,
            amount_paise=req.amount_paise,
            balance_after_paise=sender_new_balance,
            description=f"Sent to {recipient_user.email}" + (f": {req.note}" if req.note else "")
        )
        db.add(sender_debit)

        # Credit recipient balance
        recipient_new_balance = recipient_wallet.balance_paise + req.amount_paise
        recipient_wallet.balance_paise = recipient_new_balance

        # Recipient Credit Ledger Entry
        recipient_credit = LedgerEntry(
            wallet_id=recipient_wallet.id,
            transfer_id=transfer.id,
            entry_type=LedgerEntryType.CREDIT,
            amount_paise=req.amount_paise,
            balance_after_paise=recipient_new_balance,
            description=f"Received from {current_user.email}" + (f": {req.note}" if req.note else "")
        )
        db.add(recipient_credit)

        response_payload = TransferResponse(
            id=transfer.id,
            sender_wallet_id=transfer.sender_wallet_id,
            recipient_wallet_id=transfer.recipient_wallet_id,
            recipient_email=recipient_user.email,
            amount_paise=transfer.amount_paise,
            amount_display=format_paise_to_display(transfer.amount_paise),
            currency=transfer.currency,
            note=transfer.note,
            status=transfer.status.value,
            created_at=transfer.created_at
        )

        # Record idempotency record if key was provided
        if idempotency_key:
            saved_key = IdempotencyKey(
                key=idempotency_key,
                user_id=current_user.id,
                request_hash=req_hash,
                response_code=status.HTTP_201_CREATED,
                response_body=response_payload.model_dump_json()
            )
            db.add(saved_key)

        db.commit()
        return response_payload

    except IntegrityError as e:
        db.rollback()
        # If two identical idempotency keys raced concurrently, the unique constraint catches it
        if idempotency_key and "uq_idempotency_key_user" in str(e):
            existing_key = (
                db.query(IdempotencyKey)
                .filter(
                    IdempotencyKey.key == idempotency_key,
                    IdempotencyKey.user_id == current_user.id
                )
                .first()
            )
            if existing_key and existing_key.request_hash == req_hash:
                return TransferResponse(**json.loads(existing_key.response_body))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "transaction_conflict", "message": "Transaction conflict. Please retry."}
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "transfer_failed", "message": "Failed to complete transfer"}
        )
