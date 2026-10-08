def test_create_meeting_from_pasted_transcript(meeting):
    assert meeting["platform"] == "paste"
    assert meeting["segment_count"] == 7
    names = {p["name"] for p in meeting["participants"]}
    assert names == {"Sarah Chen", "Marcus Johnson", "Priya Patel"}
    host = next(p for p in meeting["participants"] if p["role"] == "host")
    assert host["name"] == "Sarah Chen"
    assert meeting["summary"]["generated_by"] == "heuristic"
    assert meeting["action_items"] and meeting["chapters"]
    assert meeting["duration_ms"] > 40_000


def test_list_search_filter_sort(client, meeting):
    client.post("/api/meetings", json={"title": "Hiring sync", "started_at": "2020-01-01T10:00:00", "tags": ["Hiring"]})
    assert client.get("/api/meetings").json()["total"] == 2
    assert [m["title"] for m in client.get("/api/meetings?sort=oldest").json()["items"]] == ["Hiring sync", "Pricing Sync"]
    assert client.get("/api/meetings?q=marcus").json()["total"] == 1  # by participant
    assert client.get("/api/meetings?q=hiring").json()["total"] == 1  # by title
    assert client.get("/api/meetings?date_from=2021-01-01").json()["total"] == 1
    tags = client.get("/api/tags").json()
    hiring = next(t for t in tags if t["name"] == "Hiring")
    assert [m["title"] for m in client.get(f"/api/meetings?tag_id={hiring['id']}").json()["items"]] == ["Hiring sync"]
    pid = next(p["id"] for p in meeting["participants"] if p["name"] == "Priya Patel")
    assert client.get(f"/api/meetings?participant_id={pid}").json()["total"] == 1
    item = client.get("/api/meetings").json()["items"][0]
    assert item["action_items_open"] == item["action_items_total"] > 0


def test_update_and_delete_meeting(client, meeting):
    mid = meeting["id"]
    res = client.patch(f"/api/meetings/{mid}", json={
        "title": "Renamed", "participants": [{"name": "Sarah Chen"}, {"name": "New Person"}], "tags": ["Design"],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Renamed"
    assert {p["name"] for p in body["participants"]} == {"Sarah Chen", "New Person"}
    assert next(p for p in body["participants"] if p["name"] == "Sarah Chen")["role"] == "host"
    assert [t["name"] for t in body["tags"]] == ["Design"]

    assert client.delete(f"/api/meetings/{mid}").status_code == 204
    assert client.get(f"/api/meetings/{mid}").status_code == 404
    assert client.get("/api/search?q=pricing").json()["total"] == 0  # FTS rows removed via cascade + trigger


def test_action_item_crud(client, meeting):
    mid = meeting["id"]
    created = client.post(f"/api/meetings/{mid}/action-items", json={"text": "Book the venue"}).json()
    assert created["source"] == "user" and not created["is_completed"]
    done = client.patch(f"/api/action-items/{created['id']}", json={"is_completed": True}).json()
    assert done["is_completed"] and done["completed_at"]
    edited = client.patch(f"/api/action-items/{created['id']}", json={"text": "Book the bigger venue"}).json()
    assert edited["text"] == "Book the bigger venue" and edited["is_completed"]
    assert len(client.get("/api/action-items?status_filter=completed").json()) == 1

    # Regenerating the summary keeps user-created and completed items.
    regen = client.post(f"/api/meetings/{mid}/summary/regenerate").json()
    assert any(a["id"] == created["id"] for a in regen["action_items"])

    assert client.delete(f"/api/action-items/{created['id']}").status_code == 204
    assert client.patch(f"/api/action-items/{created['id']}", json={"text": "x"}).status_code == 404


def test_transcript_search_and_segment_edit(client, meeting):
    mid = meeting["id"]
    segs = client.get(f"/api/meetings/{mid}/transcript").json()
    assert segs[0]["speaker"]["name"] == "Sarah Chen" and segs[0]["start_ms"] == 0

    hits = client.get("/api/search?q=mockup").json()["hits"]  # prefix + stemming
    assert hits and hits[0]["kind"] == "transcript" and "<mark>" in hits[0]["snippet"]

    client.patch(f"/api/segments/{segs[0]['id']}", json={"text": "Welcome to the zebra meeting.", "speaker_name": "Elena"})
    assert client.get("/api/search?q=zebra").json()["total"] == 1  # FTS update trigger
    seg0 = client.get(f"/api/meetings/{mid}/transcript").json()[0]
    assert seg0["speaker"]["name"] == "Elena"


def test_comments_soundbites_chat_analytics_export(client, meeting):
    mid = meeting["id"]
    seg = client.get(f"/api/meetings/{mid}/transcript").json()[2]
    c = client.post(f"/api/meetings/{mid}/comments", json={"segment_id": seg["id"], "body": "Nice"})
    assert c.status_code == 201
    sb = client.post(f"/api/meetings/{mid}/soundbites", json={"title": "Ask", "start_ms": seg["start_ms"], "end_ms": seg["end_ms"]})
    assert sb.status_code == 201

    q, a = client.post(f"/api/meetings/{mid}/chat", json={"question": "What are the action items?"}).json()
    assert q["role"] == "user" and a["role"] == "assistant" and "action items" in a["content"].lower()
    assert len(client.get(f"/api/meetings/{mid}/chat").json()) == 2

    analytics = client.get(f"/api/meetings/{mid}/analytics").json()
    assert round(sum(s["talk_percent"] for s in analytics["speakers"])) == 100
    assert analytics["filters"]["questions"] and analytics["filters"]["metrics"]

    md = client.get(f"/api/meetings/{mid}/export?format=md")
    assert md.status_code == 200 and md.text.startswith("# Pricing Sync")
    assert "attachment" in md.headers["content-disposition"]


def test_upload_and_validation(client):
    files = {"file": ("standup_notes.vtt", b"WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Ann>Hello\n", "text/vtt")}
    res = client.post("/api/meetings/upload", files=files)
    assert res.status_code == 201 and res.json()["title"] == "standup notes"
    bad = client.post("/api/meetings/upload", files={"file": ("x.txt", b"   ", "text/plain")})
    assert bad.status_code == 422
    assert client.post("/api/meetings", json={"title": ""}).status_code == 422
    assert client.get("/api/meetings/999").status_code == 404
