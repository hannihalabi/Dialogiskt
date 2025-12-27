#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ATOM_NS = "http://www.w3.org/2005/Atom"
YT_NS = "http://www.youtube.com/xml/schemas/2015"
MEDIA_NS = "http://search.yahoo.com/mrss/"
NS = {
    "atom": ATOM_NS,
    "yt": YT_NS,
    "media": MEDIA_NS,
}


def fetch_feed(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        status = getattr(response, "status", 200)
        if status != 200:
            raise RuntimeError(f"HTTP {status}")
        return response.read()


def parse_feed(xml_bytes: bytes):
    root = ET.fromstring(xml_bytes)
    entries = []
    for entry in root.findall("atom:entry", NS):
        title = (entry.findtext("atom:title", default="", namespaces=NS) or "").strip()
        video_id = (entry.findtext("yt:videoId", default="", namespaces=NS) or "").strip()
        published = (entry.findtext("atom:published", default="", namespaces=NS) or "").strip()
        updated = (entry.findtext("atom:updated", default="", namespaces=NS) or "").strip()

        link = ""
        for link_el in entry.findall("atom:link", NS):
            if link_el.get("rel") == "alternate" and link_el.get("href"):
                link = link_el.get("href")
                break

        thumbnail = ""
        media_group = entry.find("media:group", NS)
        if media_group is not None:
            thumb_el = media_group.find("media:thumbnail", NS)
            if thumb_el is not None and thumb_el.get("url"):
                thumbnail = thumb_el.get("url")

        if not link and video_id:
            link = f"https://www.youtube.com/watch?v={video_id}"
        if not thumbnail and video_id:
            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

        if not link:
            continue

        entries.append(
            {
                "title": title,
                "videoId": video_id,
                "url": link,
                "thumbnail": thumbnail,
                "date": published or updated,
            }
        )

    return entries


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel-id", required=True)
    parser.add_argument("--output", default="latest-videos.json")
    parser.add_argument("--max-results", type=int, default=5)
    args = parser.parse_args()

    feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={args.channel_id}"
    try:
        xml_bytes = fetch_feed(feed_url)
        entries = parse_feed(xml_bytes)
    except Exception as exc:
        print(f"Failed to fetch or parse feed: {exc}", file=sys.stderr)
        sys.exit(1)

    if args.max_results > 0:
        entries = entries[: args.max_results]

    output_path = Path(args.output)
    output_path.write_text(
        json.dumps(entries, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
