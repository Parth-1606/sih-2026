from app.services.statistics import compute_baseline, z_score


def test_compute_baseline_returns_mean_and_std():
    baseline_mean, baseline_std = compute_baseline([10, 12, 11, 13, 9])
    assert round(baseline_mean, 2) == 11.0
    assert baseline_std > 0


def test_z_score_zero_when_value_equals_mean():
    assert z_score(10, baseline_mean=10, baseline_std=2) == 0


def test_z_score_positive_above_mean_negative_below():
    assert z_score(14, baseline_mean=10, baseline_std=2) == 2.0
    assert z_score(6, baseline_mean=10, baseline_std=2) == -2.0


def test_z_score_none_when_baseline_has_zero_variance():
    assert z_score(15, baseline_mean=10, baseline_std=0) is None
