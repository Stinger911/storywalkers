const YOUTUBE_PRIMARY_HOST = "youtube.com";
const YOUTUBE_NOCOOKIE_HOST = "youtube-nocookie.com";
const YOUTU_BE_HOST = "youtu.be";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function isOfficialYouTubeHost(hostname: string) {
  return (
    hostname === YOUTUBE_PRIMARY_HOST ||
    hostname.endsWith(`.${YOUTUBE_PRIMARY_HOST}`) ||
    hostname === YOUTUBE_NOCOOKIE_HOST ||
    hostname.endsWith(`.${YOUTUBE_NOCOOKIE_HOST}`) ||
    hostname === YOUTU_BE_HOST
  );
}

function normalizeVideoId(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return VIDEO_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function getYouTubeEmbedUrl(rawUrl?: string | null) {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (!isOfficialYouTubeHost(hostname)) {
    return null;
  }

  let videoId: string | null = null;
  const segments = url.pathname.split("/").filter(Boolean);

  if (hostname === YOUTU_BE_HOST) {
    videoId = normalizeVideoId(segments[0]);
  } else if (segments[0] === "watch") {
    videoId = normalizeVideoId(url.searchParams.get("v"));
  } else if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live" || segments[0] === "v") {
    videoId = normalizeVideoId(segments[1]);
  }

  if (!videoId) {
    return null;
  }

  const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  embedUrl.searchParams.set("rel", "0");
  return embedUrl.toString();
}
