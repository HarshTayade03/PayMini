import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    BigInteger,
    ForeignKey,
    DateTime,
    Enum,
    UniqueConstraint,
    Index,
    Text,
    Integer,
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class LedgerEntryType(str, enum.Enum):
    CREDIT = "CREDIT"  # Money added to wallet (+balance)
    DEBIT = "DEBIT"    # Money deducted from wallet (-balance)


class TransferStatus(str, enum.Enum):
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    wallet = relationship("Wallet", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    # Stored in integer minor units (paise: 100 paise = ₹1.00)
    balance_paise = Column(BigInteger, default=0, nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="wallet")
    ledger_entries = relationship("LedgerEntry", back_populates="wallet")


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_wallet_id = Column(String(36), ForeignKey("wallets.id"), nullable=False, index=True)
    recipient_wallet_id = Column(String(36), ForeignKey("wallets.id"), nullable=False, index=True)
    amount_paise = Column(BigInteger, nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    note = Column(String(255), nullable=True)
    status = Column(Enum(TransferStatus), default=TransferStatus.COMPLETED, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    sender_wallet = relationship("Wallet", foreign_keys=[sender_wallet_id])
    recipient_wallet = relationship("Wallet", foreign_keys=[recipient_wallet_id])
    ledger_entries = relationship("LedgerEntry", back_populates="transfer")


class LedgerEntry(Base):
    """
    Append-only double-entry ledger.
    Every financial movement creates an immutable row.
    Rows in this table are NEVER updated or deleted.
    """
    __tablename__ = "ledger_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id = Column(String(36), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False, index=True)
    transfer_id = Column(String(36), ForeignKey("transfers.id", ondelete="SET NULL"), nullable=True, index=True)
    entry_type = Column(Enum(LedgerEntryType), nullable=False)
    amount_paise = Column(BigInteger, nullable=False)
    balance_after_paise = Column(BigInteger, nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    wallet = relationship("Wallet", back_populates="ledger_entries")
    transfer = relationship("Transfer", back_populates="ledger_entries")

    __table_args__ = (
        Index("idx_ledger_wallet_created", "wallet_id", "created_at"),
    )


class IdempotencyKey(Base):
    """
    Prevents duplicate operations on network retries or rapid double-clicks.
    """
    __tablename__ = "idempotency_keys"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key = Column(String(255), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    request_hash = Column(String(64), nullable=False)  # SHA-256 of request body
    response_code = Column(Integer, nullable=False)
    response_body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("key", "user_id", name="uq_idempotency_key_user"),
    )
