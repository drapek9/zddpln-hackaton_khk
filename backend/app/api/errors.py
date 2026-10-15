"""Errors the frontend can show as-is: a Czech sentence plus a stable code."""

from __future__ import annotations


class ApiError(Exception):
    def __init__(self, status_code: int, detail: str, code: str) -> None:
        self.status_code = status_code
        self.detail = detail
        self.code = code
