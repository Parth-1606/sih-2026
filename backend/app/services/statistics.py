"""
Pure statistics — no models, no I/O, no app config. Kept separate from
anomaly_detection.py so the math itself is trivially testable and easy to
audit independently of thresholds/business rules.
"""

from statistics import mean, pstdev


def compute_baseline(values: list[float]) -> tuple[float, float]:
    """
    Mean and population standard deviation of a set of historical values.

    We use population std dev (pstdev, dividing by N) rather than sample
    std dev (stdev, dividing by N-1) because we're treating the historical
    window itself as the full baseline we're comparing against, not a
    sample used to estimate some larger population's variance.
    """
    return mean(values), pstdev(values)


def z_score(value: float, baseline_mean: float, baseline_std: float) -> float | None:
    """
    How many standard deviations `value` sits from the baseline mean.

    Returns None when baseline_std is 0 (every historical reading was
    identical) — a z-score is undefined there, and guessing severity from a
    divide-by-zero would be worse than admitting we can't compute one.
    """
    if baseline_std == 0:
        return None
    return (value - baseline_mean) / baseline_std
