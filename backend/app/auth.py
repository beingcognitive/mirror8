"""Supabase JWT verification using JWKS (asymmetric RS256)."""

import logging

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, WebSocket

from app.config import SUPABASE_URL

logger = logging.getLogger(__name__)

# JWKS client — fetches public keys from Supabase's well-known endpoint
_jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def verify_token(token: str) -> str:
    """Decode Supabase user JWT using JWKS public key. Returns user_id (sub)."""
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="authenticated",
        )
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_current_user(authorization: str = Header(...)) -> str:
    """FastAPI dependency: extract and verify JWT from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization[7:]
    return verify_token(token)


def verify_ws_token(websocket: WebSocket) -> str:
    """Extract and verify token from WebSocket query param."""
    token = websocket.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    return verify_token(token)
