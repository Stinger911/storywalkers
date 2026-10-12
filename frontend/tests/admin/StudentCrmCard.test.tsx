import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentCrmCard } from "../../src/routes/admin/StudentCrmCard";
import {
  addCrmNote,
  createCrmContact,
  deleteCrmNote,
  getCrmContactByUser,
  listCrmStatuses,
  updateCrmContact,
} from "../../src/lib/adminApi";
import { showToast } from "../../src/components/ui/toast";

vi.mock("../../src/lib/adminApi", () => ({
  listCrmStatuses: vi.fn(),
  getCrmContactByUser: vi.fn(),
  createCrmContact: vi.fn(),
  updateCrmContact: vi.fn(),
  addCrmNote: vi.fn(),
  deleteCrmNote: vi.fn(),
}));

vi.mock("../../src/components/ui/toast", () => ({
  showToast: vi.fn(),
}));

const roleRaw = vi.fn(() => "admin");

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => ({ role: "staff", roleRaw: roleRaw() }),
  }),
}));

const listCrmStatusesMock = listCrmStatuses as unknown as ReturnType<typeof vi.fn>;
const getCrmContactByUserMock = getCrmContactByUser as unknown as ReturnType<
  typeof vi.fn
>;
const createCrmContactMock = createCrmContact as unknown as ReturnType<typeof vi.fn>;
const updateCrmContactMock = updateCrmContact as unknown as ReturnType<typeof vi.fn>;
const addCrmNoteMock = addCrmNote as unknown as ReturnType<typeof vi.fn>;
const deleteCrmNoteMock = deleteCrmNote as unknown as ReturnType<typeof vi.fn>;
const showToastMock = showToast as unknown as ReturnType<typeof vi.fn>;

const statuses = [
  { value: "sale", label: "ПРОДАЖА" },
  { value: "follow_up", label: "ФОЛЛОУ АП" },
];

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    userUid: "u1",
    email: "lead@example.com",
    name: "Lead One",
    telegram: "@lead",
    status: "follow_up",
    statusLabel: "ФОЛЛОУ АП",
    statusRaw: null,
    nextPingAt: "2026-10-20",
    ...overrides,
  };
}

function renderCard() {
  return render(() => (
    <StudentCrmCard uid="u1" email="lead@example.com" displayName="Lead One" />
  ));
}

describe("StudentCrmCard", () => {
  beforeEach(() => {
    roleRaw.mockReturnValue("admin");
    listCrmStatusesMock.mockReset();
    getCrmContactByUserMock.mockReset();
    createCrmContactMock.mockReset();
    updateCrmContactMock.mockReset();
    addCrmNoteMock.mockReset();
    deleteCrmNoteMock.mockReset();
    showToastMock.mockReset();
    listCrmStatusesMock.mockResolvedValue({ items: statuses });
  });

  it("shows the pipeline fields and the feedback log", async () => {
    getCrmContactByUserMock.mockResolvedValue({
      contact: contact(),
      notes: [
        {
          id: "n1",
          text: "Imported note",
          authorName: "импорт",
          imported: true,
          createdAt: "2026-09-01T09:00:00Z",
        },
      ],
      linked: true,
    });

    renderCard();

    expect(await screen.findByText("Imported note")).toBeInTheDocument();
    expect(getCrmContactByUserMock).toHaveBeenCalledWith("u1");
    const status = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(status.value).toBe("follow_up");
    const ping = screen.getByLabelText("Next ping") as HTMLInputElement;
    expect(ping.value).toBe("2026-10-20");
    expect(screen.queryByText(/Matched by email only/)).not.toBeInTheDocument();
  });

  it("saves a status change", async () => {
    getCrmContactByUserMock.mockResolvedValue({
      contact: contact(),
      notes: [],
      linked: true,
    });
    updateCrmContactMock.mockResolvedValue(contact({ status: "sale" }));

    renderCard();
    await screen.findByLabelText("Status");

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "sale" },
    });

    await waitFor(() => {
      expect(updateCrmContactMock).toHaveBeenCalledWith("c1", { status: "sale" });
    });
  });

  it("offers to link a contact matched by email only", async () => {
    getCrmContactByUserMock.mockResolvedValue({
      contact: contact({ userUid: null }),
      notes: [],
      linked: false,
    });
    updateCrmContactMock.mockResolvedValue(contact());

    renderCard();

    expect(await screen.findByText(/Matched by email only/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Link to this account" }));

    await waitFor(() => {
      expect(updateCrmContactMock).toHaveBeenCalledWith("c1", { userUid: "u1" });
    });
    await waitFor(() => {
      expect(screen.queryByText(/Matched by email only/)).not.toBeInTheDocument();
    });
  });

  it("creates a contact for an account that is not in the pipeline", async () => {
    getCrmContactByUserMock.mockResolvedValue({
      contact: null,
      notes: [],
      linked: false,
    });
    createCrmContactMock.mockResolvedValue(contact({ status: null }));

    renderCard();

    expect(
      await screen.findByText("This account is not in the pipeline yet."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add to CRM" }));

    await waitFor(() => {
      expect(createCrmContactMock).toHaveBeenCalledWith({
        userUid: "u1",
        email: "lead@example.com",
        name: "Lead One",
      });
    });
    expect(await screen.findByLabelText("Status")).toBeInTheDocument();
  });

  it("adds and deletes a note", async () => {
    getCrmContactByUserMock.mockResolvedValue({
      contact: contact(),
      notes: [
        { id: "n1", text: "Old note", authorName: "Admin", imported: false },
      ],
      linked: true,
    });
    addCrmNoteMock.mockResolvedValue({
      id: "n2",
      text: "Called today",
      authorName: "Admin",
      imported: false,
      createdAt: "2026-10-12T09:00:00Z",
    });
    deleteCrmNoteMock.mockResolvedValue(undefined);

    renderCard();
    await screen.findByText("Old note");

    fireEvent.input(screen.getByLabelText("New CRM note"), {
      target: { value: "Called today" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(addCrmNoteMock).toHaveBeenCalledWith("c1", "Called today");
    });
    expect(await screen.findByText("Called today")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Delete CRM note n1"));
    await waitFor(() => {
      expect(deleteCrmNoteMock).toHaveBeenCalledWith("c1", "n1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Old note")).not.toBeInTheDocument();
    });
  });

  it("renders nothing for experts", async () => {
    roleRaw.mockReturnValue("expert");

    renderCard();

    await waitFor(() => {
      expect(screen.queryByText("CRM")).not.toBeInTheDocument();
    });
    expect(getCrmContactByUserMock).not.toHaveBeenCalled();
  });

  it("surfaces a load failure without hiding the card", async () => {
    getCrmContactByUserMock.mockRejectedValue(new Error("Forbidden"));

    renderCard();

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(showToastMock).not.toHaveBeenCalled();
  });
});
