"""
core/logging_config.py

Minimal structured (JSON-line) logging. One configured root handler; call
get_logger(__name__) anywhere. Extra fields passed via logging's `extra=`
are merged into the JSON so logs are greppable/queryable in HF Spaces logs.
"""

import json
import logging
import os
import sys

_RESERVED = set(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
) | {"message", "asctime"}

_configured = False


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def _configure() -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    _configured = True


def get_logger(name: str) -> logging.Logger:
    _configure()
    return logging.getLogger(name)
