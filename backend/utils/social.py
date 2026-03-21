import yt_dlp
import tempfile
import os

def download_social_media(url: str) -> bytes:
    """
    Uses yt-dlp to download media from social platforms (youtube, instagram, etc.)
    Returns the raw bytes of the video and cleans up the temporary file.
    """
    with tempfile.TemporaryDirectory(prefix="truth_shield_ydl_") as tmpdir:
        # Important: do NOT pre-create the output file. yt-dlp may skip/leave a 0-byte file.
        outtmpl = os.path.join(tmpdir, "%(id)s.%(ext)s")

        ydl_opts = {
            # Prefer a single-file MP4 when possible (doesn't require ffmpeg merging)
            "format": "best[ext=mp4]/best",
            "outtmpl": outtmpl,
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "retries": 3,
            "fragment_retries": 3,
            "concurrent_fragment_downloads": 1,
            "max_filesize": 50 * 1024 * 1024,  # 50MB limit
        }

        # Optional: some environments (corporate proxy / custom CA) break TLS verification.
        if os.getenv("YTDLP_NO_CHECK_CERT", "").strip().lower() in {"1", "true", "yes", "y", "on"}:
            ydl_opts["nocheckcertificate"] = True

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Find the downloaded file (ignore temp/partial files)
        candidates = []
        for name in os.listdir(tmpdir):
            if name.endswith(".part") or name.endswith(".ytdl"):
                continue
            path = os.path.join(tmpdir, name)
            if os.path.isfile(path):
                size = os.path.getsize(path)
                if size > 0:
                    candidates.append((size, path))

        if not candidates:
            raise Exception(
                "Download failed or file is empty. Some platforms require login/cookies or block downloads."
            )

        # Read the largest file (most likely the video)
        candidates.sort(reverse=True)
        _, best_path = candidates[0]
        with open(best_path, "rb") as f:
            return f.read()
