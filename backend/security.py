import os
import base64
import logging
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)

# Base encryption secret (managed in environment or fallback default key)
SECRET_SALT = b"rocky_vault_security_salt_2026"
BASE_KEY = os.getenv("VAULT_SECRET_KEY", "rocky_super_secret_master_vault_key_2026").encode()

def _get_fernet_engine() -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=SECRET_SALT,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(BASE_KEY))
    return Fernet(key)

def encrypt_vault_data(plain_text: str) -> str:
    """Encrypt plain text sensitive string into AES-256 Fernet token."""
    if not plain_text:
        return ""
    try:
        engine = _get_fernet_engine()
        token = engine.encrypt(plain_text.encode('utf-8'))
        return token.decode('utf-8')
    except Exception as e:
        logger.error(f"Encryption error: {e}")
        raise RuntimeError("Failed to encrypt vault data")

def decrypt_vault_data(cipher_text: str) -> str:
    """Decrypt AES-256 Fernet token back to plain text."""
    if not cipher_text:
        return ""
    try:
        engine = _get_fernet_engine()
        plain_bytes = engine.decrypt(cipher_text.encode('utf-8'))
        return plain_bytes.decode('utf-8')
    except Exception as e:
        logger.error(f"Decryption error: {e}")
        return "[Decryption Failed / Key Mismatch]"

def mask_api_key(api_key: str | None) -> str:
    """
    Mask an API key for safe UI display (e.g., 'sk-ant-••••••••W41k').
    Leaves leading and trailing characters visible if long enough, else generic mask.
    """
    if not api_key:
        return ""
    key = api_key.strip()
    if len(key) <= 8:
        return "••••••••"
    prefix = key[:6]
    suffix = key[-4:]
    return f"{prefix}••••••••{suffix}"

