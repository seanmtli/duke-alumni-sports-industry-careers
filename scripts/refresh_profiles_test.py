#!/usr/bin/env python3
"""Unit tests for refresh_profiles comparison / skip rules. Stdlib only."""
import unittest
from datetime import date, datetime, timezone

from refresh_profiles import (
    RECENT_VERIFY_DAYS,
    is_recently_verified,
    is_stale,
    same_company,
    same_title,
    should_apply_job_change,
    stable_headshot,
)


class SameCompanyTests(unittest.TestCase):
    def test_legal_suffix_is_churn(self):
        self.assertTrue(same_company("DraftKings Inc.", "DraftKings"))
        self.assertTrue(same_company("DraftKings Inc", "DraftKings"))

    def test_case_and_whitespace_is_churn(self):
        self.assertTrue(same_company("  Fanatics  ", "fanatics"))

    def test_fenway_management_vs_group_is_churn(self):
        self.assertTrue(same_company("Fenway Sports Group", "Fenway Sports Management"))
        self.assertTrue(same_company("Fenway Sports Group", "Fenway Sports Management (FSM)"))

    def test_subset_name_is_churn(self):
        self.assertTrue(same_company("Fanatics", "Fanatics Betting & Gaming"))
        self.assertTrue(same_company("CAA", "CAA Sports"))

    def test_real_job_change_is_not_churn(self):
        self.assertFalse(same_company("Minnesota United FC", "Fanatics"))
        self.assertFalse(same_company("New York Yankees", "New York Mets"))
        self.assertFalse(same_company("University of Tennessee", "Minnesota United FC"))

    def test_empty_is_not_same(self):
        self.assertFalse(same_company("", "Fanatics"))
        self.assertFalse(same_company(None, "Fanatics"))
        self.assertFalse(same_company("Fanatics", None))


class SameTitleTests(unittest.TestCase):
    def test_case_and_whitespace(self):
        self.assertTrue(same_title("Product Manager", "product manager"))
        self.assertTrue(same_title("  Sr. Analyst ", "Sr. Analyst"))

    def test_promotion_is_different(self):
        self.assertFalse(same_title("Analyst", "Senior Analyst"))

    def test_empty(self):
        self.assertTrue(same_title(None, None))
        self.assertTrue(same_title("", None))
        self.assertFalse(same_title("Analyst", None))


class RecentlyVerifiedTests(unittest.TestCase):
    def test_within_window(self):
        self.assertTrue(is_recently_verified("2026-08-21", date(2026, 8, 24), 14))
        self.assertTrue(is_recently_verified("2026-08-10", date(2026, 8, 24), 14))

    def test_outside_window(self):
        self.assertFalse(is_recently_verified("2026-08-01", date(2026, 8, 24), 14))
        self.assertFalse(is_recently_verified("2026-07-06", date(2026, 8, 24), 14))

    def test_null_is_not_recent(self):
        self.assertFalse(is_recently_verified(None, date(2026, 8, 24), 14))
        self.assertFalse(is_recently_verified("", date(2026, 8, 24), 14))

    def test_timestamptz(self):
        self.assertTrue(
            is_recently_verified("2026-08-21T04:16:09.327474+00:00", date(2026, 8, 24), 14)
        )


class StaleTests(unittest.TestCase):
    def test_null_is_stale(self):
        now = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)
        self.assertTrue(is_stale(None, now, 50))

    def test_recent_enrich_is_not_stale(self):
        now = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)
        self.assertFalse(is_stale("2026-08-21T04:16:09+00:00", now, 50))

    def test_old_enrich_is_stale(self):
        now = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)
        self.assertTrue(is_stale("2026-06-22T00:00:00+00:00", now, 50))

    def test_zero_stale_days_always_stale(self):
        now = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)
        self.assertTrue(is_stale("2026-08-24T11:00:00+00:00", now, 0))


class ShouldApplyJobChangeTests(unittest.TestCase):
    today = date(2026, 8, 24)

    def test_real_company_change_applies(self):
        apply, reason = should_apply_job_change(
            "Minnesota United FC", "Scout",
            "Fanatics", "Analyst",
            last_verified="2026-06-22", today=self.today,
        )
        self.assertTrue(apply)
        self.assertEqual(reason, "company_change")

    def test_title_only_change_applies(self):
        apply, reason = should_apply_job_change(
            "Fanatics", "Analyst",
            "Fanatics", "Senior Analyst",
            last_verified="2026-06-22", today=self.today,
        )
        self.assertTrue(apply)
        self.assertEqual(reason, "title_change")

    def test_name_churn_does_not_apply(self):
        apply, reason = should_apply_job_change(
            "DraftKings Inc.", "Product Manager",
            "DraftKings", "Product Manager",
            last_verified="2026-06-22", today=self.today,
        )
        self.assertFalse(apply)
        self.assertEqual(reason, "unchanged")

    def test_fenway_churn_does_not_apply(self):
        apply, reason = should_apply_job_change(
            "Fenway Sports Group", "Managing Director",
            "Fenway Sports Management", "Managing Director",
            last_verified="2026-06-22", today=self.today,
        )
        self.assertFalse(apply)
        self.assertEqual(reason, "unchanged")

    def test_recent_verify_skips_real_change(self):
        apply, reason = should_apply_job_change(
            "University of Tennessee", "Associate AD",
            "Minnesota United FC", "Scout",
            last_verified="2026-08-21", today=self.today,
            recent_days=RECENT_VERIFY_DAYS,
        )
        self.assertFalse(apply)
        self.assertEqual(reason, "recently_verified")

    def test_older_verify_allows_change(self):
        apply, reason = should_apply_job_change(
            "University of Tennessee", "Associate AD",
            "Minnesota United FC", "Scout",
            last_verified="2026-07-01", today=self.today,
        )
        self.assertTrue(apply)
        self.assertEqual(reason, "company_change")

    def test_empty_new_company_does_not_apply(self):
        apply, reason = should_apply_job_change(
            "Fanatics", "Analyst",
            None, None,
            last_verified="2026-06-22", today=self.today,
        )
        self.assertFalse(apply)
        self.assertEqual(reason, "no_new_company")


class StableHeadshotTests(unittest.TestCase):
    def test_prefers_permalink(self):
        self.assertEqual(
            stable_headshot({
                "profile_picture_permalink": "https://crustdata-media.s3.us-east-2.amazonaws.com/x.jpg",
                "profile_picture_url": "https://media.licdn.com/dms/image/expiring",
            }),
            "https://crustdata-media.s3.us-east-2.amazonaws.com/x.jpg",
        )

    def test_rejects_linkedin_cdn(self):
        self.assertIsNone(stable_headshot({
            "profile_picture_url": "https://media.licdn.com/dms/image/expiring",
        }))

    def test_none(self):
        self.assertIsNone(stable_headshot({}))


if __name__ == "__main__":
    unittest.main()
