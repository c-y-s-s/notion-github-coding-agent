from agent_worker.policy import validate_changed_files


def test_accepts_small_source_patch():
    assert validate_changed_files(["src/a.ts", "src/a.test.ts"]) == []


def test_rejects_too_many_files():
    assert "maximum is 3" in validate_changed_files(["a.ts", "b.ts", "c.ts", "d.ts"])[0]


def test_rejects_sensitive_paths():
    assert validate_changed_files([".env"])
    assert validate_changed_files(["supabase/migrations/x.sql"])


def test_rejects_path_escape():
    assert validate_changed_files(["../secret.txt"])
