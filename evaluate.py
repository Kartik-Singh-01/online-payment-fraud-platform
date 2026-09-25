"""
Model evaluation utilities. Reads the cached metrics produced by
`ml/train.py` and exposes them to the `/models/performance` API route.

If the metrics file is missing (e.g., training was never run), this
module raises a clear error so the route can return 503.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Final

ROOT: Final[Path] = Path(__file__).resolve().parent.parent
METRICS_PATH: Final[Path] = ROOT / "ml" / "saved_models" / "metrics.json"


def load_metrics() -> dict[str, Any]:
    """
    Load and return the persisted training metrics.

    Returns a dict keyed by model name with precision/recall/f1/roc_auc and
    a confusion matrix; the random_forest entry also includes
    `feature_importances`.
    """
    if not METRICS_PATH.exists():
        raise FileNotFoundError(
            f"{METRICS_PATH} not found. Run `python ml/train.py` first."
        )
    with METRICS_PATH.open("r") as f:
        return json.load(f)
