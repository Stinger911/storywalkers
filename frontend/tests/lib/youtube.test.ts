import { describe, expect, it } from "vitest";

import { getYouTubeEmbedUrl } from "../../src/lib/youtube";

describe("getYouTubeEmbedUrl", () => {
  it("supports watch urls on youtube.com", () => {
    expect(getYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("supports short links and official subdomains", () => {
    expect(getYouTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
    expect(getYouTubeEmbedUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
    expect(getYouTubeEmbedUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("supports already embedded official urls", () => {
    expect(getYouTubeEmbedUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("rejects non-video or non-official urls", () => {
    expect(getYouTubeEmbedUrl("https://www.youtube.com/playlist?list=PL123")).toBeNull();
    expect(getYouTubeEmbedUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(getYouTubeEmbedUrl("not-a-url")).toBeNull();
  });
});
