import { fireEvent, render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { StartGoal } from "../../src/routes/start/StartGoal";
import { clearDraft, readDraft, writeDraft } from "../../src/routes/start/startDraft";

const navigateMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => navigateMock,
}));

function seedChannelDraft(subscriberCount: number) {
  writeDraft({
    hasChannel: true,
    channel: {
      channelId: "UC123",
      title: "StoryWalkers",
      url: "https://youtube.com/@storywalkers",
      subscriberCount,
      hiddenSubscriberCount: false,
      videoCount: 42,
      viewCount: 120000,
    },
    topic: "tech_ai",
    format: "talking_head",
  });
}

function renderPage() {
  return render(() => (
    <I18nProvider>
      <StartGoal />
    </I18nProvider>
  ));
}

describe("StartGoal", () => {
  beforeEach(() => {
    clearDraft();
    navigateMock.mockReset();
  });

  it("asks about monetization above 1000 subscribers and keeps watch hours as the goal", () => {
    seedChannelDraft(1500);
    renderPage();

    expect(
      screen.getByText("Is monetization enabled on the channel?"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));

    expect(readDraft().monetizationEnabled).toBe(false);
    expect(readDraft().targetMilestone).toBe("hours_4k");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(navigateMock).toHaveBeenCalledWith("/start/plan");
  });

  it("offers subscriber milestones once the channel is monetized", () => {
    seedChannelDraft(1500);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Yes, the channel is monetized" }));

    expect(readDraft().targetMilestone).toBe("subs_2k");
    expect(screen.getByText("5000 subscribers")).toBeInTheDocument();

    fireEvent.click(screen.getByText("5000 subscribers"));
    expect(readDraft().targetMilestone).toBe("subs_5k");
  });

  it("skips the monetization question below the threshold", () => {
    seedChannelDraft(300);
    renderPage();

    expect(
      screen.queryByText("Is monetization enabled on the channel?"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Your next goal is the monetization threshold: 1000 subscribers and 4000 watch hours.",
      ),
    ).toBeInTheDocument();
  });

  it("turns the purpose into a goal for students without a channel", () => {
    writeDraft({
      hasChannel: false,
      channel: null,
      topic: "games",
      format: "voiceover",
    });
    renderPage();

    fireEvent.click(screen.getByText("I want to earn as a YouTuber"));

    expect(readDraft().purpose).toBe("earn");
    expect(readDraft().targetMilestone).toBe("subs_1k_hours_4k");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(navigateMock).toHaveBeenCalledWith("/start/plan");
  });
});
