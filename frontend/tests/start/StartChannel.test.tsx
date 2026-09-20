import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { lookupYoutubeChannel } from "../../src/lib/publicOnboardingApi";
import { StartChannel } from "../../src/routes/start/StartChannel";
import { clearDraft, readDraft } from "../../src/routes/start/startDraft";

const navigateMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../src/lib/publicOnboardingApi", async () => {
  class PublicApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    lookupYoutubeChannel: vi.fn(),
    PublicApiError,
  };
});

function renderPage() {
  return render(() => (
    <I18nProvider>
      <StartChannel />
    </I18nProvider>
  ));
}

describe("StartChannel", () => {
  beforeEach(() => {
    clearDraft();
    navigateMock.mockReset();
    vi.mocked(lookupYoutubeChannel).mockReset();
  });

  it("stores the no-channel answer and moves on", async () => {
    renderPage();

    fireEvent.click(screen.getByText("No"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(readDraft().hasChannel).toBe(false);
    expect(navigateMock).toHaveBeenCalledWith("/start/topic");
  });

  it("fills the panel from the channel lookup", async () => {
    vi.mocked(lookupYoutubeChannel).mockResolvedValue({
      cached: false,
      channel: {
        channelId: "UC123",
        title: "StoryWalkers",
        url: "https://youtube.com/@storywalkers",
        subscriberCount: 1500,
        hiddenSubscriberCount: false,
        videoCount: 42,
        viewCount: 120000,
      },
    });

    renderPage();
    fireEvent.click(screen.getByText("Yes, I have one"));
    fireEvent.input(screen.getByLabelText("Channel link"), {
      target: { value: "youtube.com/@storywalkers" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check channel" }));

    await waitFor(() => {
      expect(readDraft().channel?.subscriberCount).toBe(1500);
    });
    expect(screen.getAllByText("StoryWalkers").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(navigateMock).toHaveBeenCalledWith("/start/topic");
  });

  it("asks for the subscriber count when the channel hides it", async () => {
    vi.mocked(lookupYoutubeChannel).mockResolvedValue({
      cached: false,
      channel: {
        channelId: "UC123",
        title: "Hidden channel",
        url: "https://youtube.com/@hidden",
        subscriberCount: null,
        hiddenSubscriberCount: true,
        videoCount: 10,
        viewCount: 100,
      },
    });

    renderPage();
    fireEvent.click(screen.getByText("Yes, I have one"));
    fireEvent.input(screen.getByLabelText("Channel link"), {
      target: { value: "youtube.com/@hidden" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check channel" }));

    const manualInput = await screen.findByLabelText("Subscribers");
    fireEvent.input(manualInput, { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save number" }));

    await waitFor(() => {
      expect(readDraft().channel?.subscriberCount).toBe(2500);
    });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(navigateMock).toHaveBeenCalledWith("/start/topic");
  });

  it("explains an unsupported link and stays on the page", async () => {
    const { PublicApiError } = await import("../../src/lib/publicOnboardingApi");
    vi.mocked(lookupYoutubeChannel).mockRejectedValue(
      new PublicApiError("youtube_link_unsupported", "nope"),
    );

    renderPage();
    fireEvent.click(screen.getByText("Yes, I have one"));
    fireEvent.input(screen.getByLabelText("Channel link"), {
      target: { value: "youtube.com/c/custom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check channel" }));

    expect(
      await screen.findByText(
        "Send a link like youtube.com/@handle or youtube.com/channel/UC…",
      ),
    ).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
