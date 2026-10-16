import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from jose import jwt

from app.config import settings
from app.routers.auth import sso_token_zymo_assets


class FakeUser:
    email = "ana@zymo.com"
    full_name = "Ana Torres"
    role = "empleado"


class SsoTokenZymoAssetsTests(unittest.TestCase):
    def test_token_is_signed_with_jwt_sso_secret_and_carries_identity(self) -> None:
        with patch.object(settings, "jwt_sso_secret", "test-sso-secret"):
            result = sso_token_zymo_assets(current_user=FakeUser())

            payload = jwt.decode(result.sso_token, "test-sso-secret", algorithms=["HS256"])
            self.assertEqual(payload["sub"], "ana@zymo.com")
            self.assertEqual(payload["username"], "ana@zymo.com")
            self.assertEqual(payload["full_name"], "Ana Torres")
            self.assertEqual(payload["role"], "empleado")

            exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
            remaining = (exp - datetime.now(timezone.utc)).total_seconds()
            self.assertTrue(0 < remaining <= 5 * 60)

    def test_raises_503_when_sso_not_configured(self) -> None:
        with patch.object(settings, "jwt_sso_secret", ""):
            with self.assertRaises(Exception) as ctx:
                sso_token_zymo_assets(current_user=FakeUser())
            self.assertEqual(getattr(ctx.exception, "status_code", None), 503)


if __name__ == "__main__":
    unittest.main()
