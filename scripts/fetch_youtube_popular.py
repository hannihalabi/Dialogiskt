#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path


def fetch_json(url: str):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        status = getattr(response, "status", 200)
        if status != 200:
            raise RuntimeError(f"HTTP {status}")
        return json.loads(response.read().decode("utf-8"))


def pick_thumbnail(thumbnails: dict) -> str:
    for key in ("high", "medium", "default"):
        data = thumbnails.get(key) if isinstance(thumbnails, dict) else None
        if isinstance(data, dict) and data.get("url"):
            return data["url"]
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel-id", required=True)
    parser.add_argument("--output", default="popular-videos.json")
    parser.add_argument("--max-results", type=int, default=5)
    args = parser.parse_args()

    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        print("Missing YOUTUBE_API_KEY env var.", file=sys.stderr)
        sys.exit(1)

    query = urllib.parse.urlencode(
        {
            "key": api_key,
            "channelId": args.channel_id,
            "part": "snippet",
            "order": "viewCount",
            "type": "video",
            "maxResults": args.max_results,
        }
    )
    url = f"https://www.googleapis.com/youtube/v3/search?{query}"

    try:
        payload = fetch_json(url)
    except Exception as exc:
        print(f"Failed to fetch popular videos: {exc}", file=sys.stderr)
        sys.exit(1)

    entries = []
    for item in payload.get("items", []):
        snippet = item.get("snippet") or {}
        video_id = item.get("id", {}).get("videoId", "")
        title = (snippet.get("title") or "").strip()
        published = (snippet.get("publishedAt") or "").strip()
        thumbnail = pick_thumbnail(snippet.get("thumbnails") or {})
        url = f"https://www.youtube.com/watch?v={video_id}" if video_id else ""
        if not url:
            continue
        if not thumbnail and video_id:
            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
        entries.append(
            {
                "title": title,
                "videoId": video_id,
                "url": url,
                "thumbnail": thumbnail,
                "date": published,
            }
        )

    output_path = Path(args.output)
    output_path.write_text(
        json.dumps(entries, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
