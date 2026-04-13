"""
TDD: Alarm Upload — Screen 2
File attachments for alarm test reports (PDF, Excel, Image).

API Endpoints:
  GET    /v1/alarm/tests/{test_id}/attachments          — List attachments
  POST   /v1/alarm/tests/{test_id}/attachments          — Upload file (multipart)
  DELETE /v1/alarm/tests/{test_id}/attachments/{att_id}  — Delete attachment
"""
import io
import pytest


def _auth(client, email: str) -> str:
    r = client.post("/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_building(client, token: str) -> str:
    r = client.post("/v1/alarm/buildings",
        headers=_headers(token),
        json={"name": "Attachment Test Building", "region": "Midwest"})
    return r.json()["id"]


def _create_test(client, token: str, bid: str, date: str = "2026-05-01") -> str:
    r = client.post("/v1/alarm/tests",
        headers=_headers(token),
        json={"building_id": bid, "test_date": date, "test_month": "2026-05"})
    return r.json()["id"]


def _upload_file(client, token: str, test_id: str, filename: str = "report.pdf", content: bytes = b"%PDF-1.4 test content") -> dict:
    r = client.post(f"/v1/alarm/tests/{test_id}/attachments",
        headers=_headers(token),
        files={"file": (filename, io.BytesIO(content), "application/pdf")},
    )
    assert r.status_code == 201, f"Upload failed: {r.text}"
    return r.json()


# ── Upload Attachment ────────────────────────────────────────────────────────

class TestUploadAttachment:
    """POST /v1/alarm/tests/{test_id}/attachments"""

    def test_upload_pdf(self, client, alarm_tester_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid)

        body = _upload_file(client, alarm_tester_token, tid, "alarm_report.pdf")
        assert body["file_name"] == "alarm_report.pdf"
        assert body["file_type"] == "PDF"
        assert body["alarm_test_id"] == tid
        assert body["file_size"] > 0
        assert "id" in body
        assert "uploaded_at" in body

    def test_upload_excel(self, client, alarm_tester_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid)

        r = client.post(f"/v1/alarm/tests/{tid}/attachments",
            headers=_headers(alarm_tester_token),
            files={"file": ("zones.xlsx", io.BytesIO(b"excel content"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert r.status_code == 201
        assert r.json()["file_type"] == "EXCEL"

    def test_upload_image(self, client, alarm_tester_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid)

        r = client.post(f"/v1/alarm/tests/{tid}/attachments",
            headers=_headers(alarm_tester_token),
            files={"file": ("photo.jpg", io.BytesIO(b"\xff\xd8\xff image"), "image/jpeg")},
        )
        assert r.status_code == 201
        assert r.json()["file_type"] == "IMAGE"

    def test_upload_to_nonexistent_test_fails(self, client, alarm_tester_token):
        r = client.post("/v1/alarm/tests/nonexistent/attachments",
            headers=_headers(alarm_tester_token),
            files={"file": ("report.pdf", io.BytesIO(b"data"), "application/pdf")},
        )
        assert r.status_code == 404

    def test_unauthenticated_cannot_upload(self, client, alarm_admin_token, alarm_tester_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid)

        r = client.post(f"/v1/alarm/tests/{tid}/attachments",
            files={"file": ("report.pdf", io.BytesIO(b"data"), "application/pdf")},
        )
        assert r.status_code in (401, 403)


# ── List Attachments ─────────────────────────────────────────────────────────

class TestListAttachments:
    """GET /v1/alarm/tests/{test_id}/attachments"""

    def test_list_empty(self, client, alarm_tester_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid, "2026-05-02")

        r = client.get(f"/v1/alarm/tests/{tid}/attachments", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        assert r.json() == []

    def test_list_after_upload(self, client, alarm_tester_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid, "2026-05-03")
        _upload_file(client, alarm_tester_token, tid, "report1.pdf")
        _upload_file(client, alarm_tester_token, tid, "report2.xlsx", b"excel")

        r = client.get(f"/v1/alarm/tests/{tid}/attachments", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        assert len(r.json()) == 2
        names = [a["file_name"] for a in r.json()]
        assert "report1.pdf" in names
        assert "report2.xlsx" in names


# ── Delete Attachment ────────────────────────────────────────────────────────

class TestDeleteAttachment:
    """DELETE /v1/alarm/tests/{test_id}/attachments/{att_id}"""

    def test_delete_attachment(self, client, alarm_tester_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid, "2026-05-04")
        att = _upload_file(client, alarm_tester_token, tid, "to_delete.pdf")

        r = client.delete(f"/v1/alarm/tests/{tid}/attachments/{att['id']}",
            headers=_headers(alarm_tester_token))
        assert r.status_code == 200

        # Verify gone
        r = client.get(f"/v1/alarm/tests/{tid}/attachments", headers=_headers(alarm_tester_token))
        assert len(r.json()) == 0

    def test_delete_nonexistent_returns_404(self, client, alarm_tester_token, alarm_admin_token):
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid, "2026-05-05")

        r = client.delete(f"/v1/alarm/tests/{tid}/attachments/nonexistent",
            headers=_headers(alarm_tester_token))
        assert r.status_code == 404

    def test_attachments_in_test_detail(self, client, alarm_tester_token, alarm_admin_token):
        """Verify attachments appear in GET /v1/alarm/tests/{id} detail response."""
        bid = _create_building(client, alarm_admin_token)
        tid = _create_test(client, alarm_tester_token, bid, "2026-05-06")
        _upload_file(client, alarm_tester_token, tid, "detail_test.pdf")

        r = client.get(f"/v1/alarm/tests/{tid}", headers=_headers(alarm_tester_token))
        assert r.status_code == 200
        assert len(r.json()["attachments"]) == 1
        assert r.json()["attachments"][0]["file_name"] == "detail_test.pdf"
