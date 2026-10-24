"""Attach reviewed animations without putting their binaries in notebook sources."""
from __future__ import annotations

import json
import math
import os
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse


class VideoError(ValueError):
    pass


def clock(seconds):
    n = int(seconds)
    return f"{n // 60}:{n % 60:02d}"


class VideoLibrary:
    def __init__(self, root: Path, dist: Path):
        self.root = root
        self.dist = dist
        self.placed = set()
        path = root / "media/videos.json"
        self.catalog = json.loads(path.read_text()) if path.exists() else {"videos": []}
        self.mode = os.environ.get("DLP_MEDIA_MODE", "auto")
        if self.mode not in ["auto", "local", "remote"]:
            raise VideoError("DLP_MEDIA_MODE must be auto, local or remote")
        ids = [v["id"] for v in self.catalog["videos"]]
        if len(ids) != len(set(ids)):
            raise VideoError("Duplicate video ID")
        for video in self.catalog["videos"]:
            self._validate(video)

    def _companions(self, video):
        return self.root / "static/media/videos" / video["id"]

    def _validate(self, video):
        identifier = video["id"]
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identifier):
            raise VideoError("Invalid video ID")
        if not video.get("reviewed"):
            raise VideoError("Video content must be reviewed before publication: " + identifier)
        duration = video["duration_seconds"]
        if not math.isfinite(duration) or duration <= 0:
            raise VideoError("Invalid duration")
        if not re.fullmatch(r"\d+\.\d+", str(video.get("lesson", ""))):
            raise VideoError("Invalid lesson ID")
        if not isinstance(video.get("section"), int) or video["section"] < 1:
            raise VideoError("Video requires a numbered section")
        for name in ["poster.jpg", "captions.en.vtt", "transcript.json"]:
            if not (self._companions(video) / name).is_file():
                raise VideoError(f"Missing video companion: {identifier}/{name}")
        transcript = json.loads((self._companions(video) / "transcript.json").read_text())
        if not transcript.get("reviewed") or not transcript.get("segments"):
            raise VideoError("Unreviewed or empty transcript")
        previous = -1
        for segment in transcript["segments"]:
            start, end = segment["start"], segment["end"]
            if not (math.isfinite(start) and math.isfinite(end)
                    and 0 <= start < end <= duration and start >= previous):
                raise VideoError("Invalid transcript timing: " + identifier)
            if not segment["text"].strip():
                raise VideoError("Empty transcript segment")
            previous = end
        if (video.get("text_kind") not in ["speech", "visual-guide"]
                or transcript.get("kind") != video["text_kind"]):
            raise VideoError("Transcript kind mismatch")
        parts = urlparse(video["url"])
        if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
            raise VideoError("Published video needs an HTTPS URL")
        previous = -1
        for chapter in video.get("chapters", []):
            if not math.isfinite(chapter["start"]) or not previous < chapter["start"] < duration:
                raise VideoError("Chapters must be ordered and within video duration")
            previous = chapter["start"]

    def _url(self, video):
        local = self.root / ".local-media/encoded" / f"{video['id']}.mp4"
        if self.mode == "local" and not local.is_file():
            raise VideoError("Missing local video: " + str(local))
        if self.mode == "remote" or not local.is_file():
            return video["url"]
        folder = self.dist / "assets/videos"
        folder.mkdir(parents=True, exist_ok=True)
        destination = folder / local.name
        if (not destination.exists() or destination.stat().st_size != local.stat().st_size
                or destination.stat().st_mtime_ns != local.stat().st_mtime_ns):
            shutil.copy2(local, destination)
        return "../assets/videos/" + local.name

    def attach(self, lesson, enricher):
        rows = [video for video in self.catalog["videos"] if video["lesson"] == lesson.id]
        for video in rows:
            sections = [section for section in lesson.sections if section.num == video["section"]]
            if len(sections) != 1:
                raise VideoError(f"{video['id']}: lesson {lesson.id} has no unique section {video['section']}")
            section = sections[0]
            for key in ["before", "after"]:
                if video.get(key):
                    needle = " ".join(video[key].split()).lower()
                    if not any(needle in " ".join((block.get("src", "") + " " + block.get("title", "")).split()).lower()
                               and not block.get("_ins") for block in section.blocks):
                        raise VideoError(f"{video['id']}: {key} anchor no longer matches the lesson")
            base = "../static/media/videos/" + video["id"] + "/"
            transcript = json.loads((self._companions(video) / "transcript.json").read_text())
            item = {
                **video, "type": "video", "url": self._url(video),
                "poster": base + "poster.jpg", "captions": base + "captions.en.vtt",
                "duration": clock(video["duration_seconds"]),
                "transcript": [dict(start=s["start"], time=clock(s["start"]), text=s["text"])
                               for s in transcript["segments"]],
                "chapters": [dict(start=c["start"], time=clock(c["start"]), title=c["title"])
                             for c in video.get("chapters", [])],
            }
            enricher._insert(lesson, item, {})
            self.placed.add(video["id"])
        return rows

    def verify_placements(self):
        missing = {video["id"] for video in self.catalog["videos"]} - self.placed
        if missing:
            raise VideoError("Video lessons not found: " + ", ".join(sorted(missing)))
