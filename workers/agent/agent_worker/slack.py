import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def notify_analysis_complete(client, run: dict, task: dict, result: str, risk: str, detail: str) -> bool:
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url or run.get("slack_notified_at"):
        return False

    dashboard_url = os.getenv("DASHBOARD_URL", "http://localhost:3000").rstrip("/")
    payload = {
        "text": f"AI 分析完成：{task['title']}",
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": "AI 分析完成", "emoji": True}},
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*任務*\n{task['title']}"},
                    {"type": "mrkdwn", "text": f"*結果*\n{result}"},
                    {"type": "mrkdwn", "text": f"*風險*\n{risk}"},
                    {"type": "mrkdwn", "text": f"*Run ID*\n`{run['id'][:8]}`"},
                ],
            },
            {"type": "section", "text": {"type": "mrkdwn", "text": detail[:2000]}},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "查看分析"},
                        "url": f"{dashboard_url}/runs/{run['id']}",
                    }
                ],
            },
        ],
    }
    try:
        request = Request(
            webhook_url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            if response.status >= 300:
                raise RuntimeError(f"Slack returned HTTP {response.status}")
        client.table("agent_runs").update(
            {"slack_notified_at": _now(), "slack_notification_error": None}
        ).eq("id", run["id"]).execute()
        return True
    except (HTTPError, URLError, OSError, RuntimeError) as error:
        client.table("agent_runs").update({"slack_notification_error": str(error)[:1000]}).eq(
            "id", run["id"]
        ).execute()
        return False


def _now() -> str:
    from datetime import UTC, datetime

    return datetime.now(UTC).isoformat()
