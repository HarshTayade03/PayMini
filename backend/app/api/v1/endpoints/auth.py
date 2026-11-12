from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.rate_limiter import login_limiter
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.models.models import User, Wallet, LedgerEntry, LedgerEntryType
from app.schemas.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    # Check if email is already registered
    existing_user = db.query(User).filter(User.email == req.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "email_exists", "message": "An account with this email address already exists"}
        )

    # 1. Create User
    new_user = User(
        email=req.email.lower(),
        hashed_password=hash_password(req.password)
    )
    db.add(new_user)
    db.flush()  # Generates new_user.id

    # 2. Automatically create User's Wallet with starter test balance
    starter_balance = settings.STARTING_BALANCE_PAISE
    new_wallet = Wallet(
        user_id=new_user.id,
        balance_paise=starter_balance,
        currency=settings.DEFAULT_CURRENCY
    )
    db.add(new_wallet)
    db.flush()

    # 3. Create initial starter ledger entry for ledger auditability
    if starter_balance > 0:
        initial_ledger = LedgerEntry(
            wallet_id=new_wallet.id,
            transfer_id=None,
            entry_type=LedgerEntryType.CREDIT,
            amount_paise=starter_balance,
            balance_after_paise=starter_balance,
            description="Welcome starter test balance"
        )
        db.add(initial_ledger)

    db.commit()
    db.refresh(new_user)

    # Issue JWT token
    token = create_access_token(subject=new_user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user)
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and return JWT access token"
)
def login(req: UserLoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}:{req.email.lower()}"

    # Check sliding-window rate limit
    login_limiter.check(rate_limit_key)

    user = db.query(User).filter(User.email == req.email.lower()).first()

    # Secure: generic error message avoids leaking whether email exists
    if not user or not verify_password(req.password, user.hashed_password):
        login_limiter.record_attempt(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_credentials", "message": "Invalid email or password"}
        )

    # Successful login: reset rate limit attempts
    login_limiter.reset(rate_limit_key)

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get authenticated user profile"
)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
