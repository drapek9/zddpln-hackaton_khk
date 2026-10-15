"""Print a VAPID key pair for .env. Does not write the keys anywhere else.

    cd backend && uv run python -m app.notify.vapid

Put the two lines into .env. The public key is what the browser needs for
pushManager.subscribe. The private key stays on the server.
"""

from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def main() -> None:
    vapid = Vapid()
    vapid.generate_keys()
    public = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    private = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
    print("VAPID_PUBLIC_KEY=" + _b64url(public))
    print("VAPID_PRIVATE_KEY=" + _b64url(private))
    print("VAPID_SUBJECT=mailto:admin@cesty-khk.test")


if __name__ == "__main__":
    main()
