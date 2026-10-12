import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { AdminCrm } from "../../src/routes/admin/AdminCrm";
import {
  addCrmNote,
  createCrmContact,
  deleteCrmNote,
  getCrmContact,
  listCrmContacts,
  listCrmStatuses,
  updateCrmContact,
} from "../../src/lib/adminApi";
import { showToast } from "../../src/components/ui/toast";

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
}));

vi.mock("../../src/lib/adminApi", () => ({
  listCrmStatuses: vi.fn(),
  listCrmContacts: vi.fn(),
  createCrmContact: vi.fn(),
  getCrmContact: vi.fn(),
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
const listCrmContactsMock = listCrmContacts as unknown as ReturnType<typeof vi.fn>;
const createCrmContactMock = createCrmContact as unknown as ReturnType<typeof vi.fn>;
const getCrmContactMock = getCrmContact as unknown as ReturnType<typeof vi.fn>;
const updateCrmContactMock = updateCrmContact as unknown as ReturnType<typeof vi.fn>;
const addCrmNoteMock = addCrmNote as unknown as ReturnType<typeof vi.fn>;
const deleteCrmNoteMock = deleteCrmNote as unknown as ReturnType<typeof vi.fn>;
const showToastMock = showToast as unknown as ReturnType<typeof vi.fn>;

const statuses = [
  { value: "sale", label: "ПРОДАЖА" },
  { value: "follow_up", label: "ФОЛЛОУ АП" },
  { value: "no_answer", label: "НЕ ОТВЕЧАЕТ" },
];

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    userUid: "u1",
    email: "lead@example.com",
    name: "Lead One",
    telegram: "@lead",
    channelUrl: null,
    status: "follow_up",
    statusLabel: "ФОЛЛОУ АП",
    statusRaw: null,
    nextPingAt: "2026-10-01",
    lastNoteText: "Said to call back",
    lastNoteAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

describe("AdminCrm", () => {
  beforeEach(() => {
    roleRaw.mockReturnValue("admin");
    listCrmStatusesMock.mockReset();
    listCrmContactsMock.mockReset();
    createCrmContactMock.mockReset();
    getCrmContactMock.mockReset();
    updateCrmContactMock.mockReset();
    addCrmNoteMock.mockReset();
    deleteCrmNoteMock.mockReset();
    showToastMock.mockReset();
    listCrmStatusesMock.mockResolvedValue({ items: statuses });
    listCrmContactsMock.mockResolvedValue({
      items: [contact()],
      total: 1,
      nextCursor: null,
    });
  });

  it("lists contacts with their status label and last note", async () => {
    render(() => <AdminCrm />);

    expect(await screen.findByText("Lead One")).toBeInTheDocument();
    expect(screen.getByText("lead@example.com")).toBeInTheDocument();
    expect(screen.getByText("Said to call back")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Account/ })).toHaveAttribute(
      "href",
      "/admin/students/u1",
    );
    expect(listCrmContactsMock).toHaveBeenCalledWith({
      status: undefined,
      ping: undefined,
      q: undefined,
      limit: 50,
    });
    const statusSelect = screen.getByLabelText("Status of Lead One") as HTMLSelectElement;
    expect(statusSelect.value).toBe("follow_up");
  });

  it("reloads with the status, ping and search filters", async () => {
    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "sale" },
    });
    await waitFor(() => {
      expect(listCrmContactsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "sale" }),
      );
    });

    fireEvent.change(screen.getByLabelText("Next ping"), {
      target: { value: "overdue" },
    });
    await waitFor(() => {
      expect(listCrmContactsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "sale", ping: "overdue" }),
      );
    });

    fireEvent.input(screen.getByLabelText("Search"), {
      target: { value: "  lead  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(listCrmContactsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "lead" }),
      );
    });
  });

  it("saves a status change straight from the row", async () => {
    updateCrmContactMock.mockResolvedValue(contact({ status: "sale" }));

    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.change(screen.getByLabelText("Status of Lead One"), {
      target: { value: "sale" },
    });

    await waitFor(() => {
      expect(updateCrmContactMock).toHaveBeenCalledWith("c1", { status: "sale" });
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("clears the ping when the date is emptied", async () => {
    updateCrmContactMock.mockResolvedValue(contact({ nextPingAt: null }));

    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.change(screen.getByLabelText("Next ping for Lead One"), {
      target: { value: "" },
    });

    await waitFor(() => {
      expect(updateCrmContactMock).toHaveBeenCalledWith("c1", { nextPingAt: null });
    });
  });

  it("opens the feedback log, adds and deletes a note", async () => {
    getCrmContactMock.mockResolvedValue({
      contact: contact(),
      notes: [
        {
          id: "n1",
          text: "Imported note",
          authorUid: null,
          authorName: "импорт",
          imported: true,
          createdAt: "2026-09-01T09:00:00Z",
        },
      ],
    });
    addCrmNoteMock.mockResolvedValue({
      id: "n2",
      text: "Called, will decide next week",
      authorUid: "admin-1",
      authorName: "Admin",
      imported: false,
      createdAt: "2026-10-02T09:00:00Z",
    });
    deleteCrmNoteMock.mockResolvedValue(undefined);

    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.click(screen.getByLabelText("Open log for Lead One"));

    expect(await screen.findByText("Imported note")).toBeInTheDocument();
    expect(getCrmContactMock).toHaveBeenCalledWith("c1");

    fireEvent.input(screen.getByLabelText("New note"), {
      target: { value: "Called, will decide next week" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(addCrmNoteMock).toHaveBeenCalledWith(
        "c1",
        "Called, will decide next week",
      );
    });
    // Once in the log, once in the row's "last note" cell.
    await waitFor(async () => {
      expect(
        await screen.findAllByText("Called, will decide next week"),
      ).toHaveLength(2);
    });

    fireEvent.click(screen.getByLabelText("Delete note n1"));
    await waitFor(() => {
      expect(deleteCrmNoteMock).toHaveBeenCalledWith("c1", "n1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Imported note")).not.toBeInTheDocument();
    });
  });

  it("saves contact details from the expanded block", async () => {
    getCrmContactMock.mockResolvedValue({ contact: contact(), notes: [] });
    updateCrmContactMock.mockResolvedValue(contact({ telegram: "@newhandle" }));

    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.click(screen.getByLabelText("Open log for Lead One"));
    await screen.findByText("Contact details");

    fireEvent.input(screen.getByLabelText("Telegram"), {
      target: { value: "@newhandle" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => {
      expect(updateCrmContactMock).toHaveBeenCalledWith("c1", {
        name: "Lead One",
        email: "lead@example.com",
        telegram: "@newhandle",
        channelUrl: null,
      });
    });
  });

  it("creates a lead and keeps it unsubmittable without a way to reach it", async () => {
    createCrmContactMock.mockResolvedValue(
      contact({ id: "c2", name: "New Lead", email: null, telegram: "@new" }),
    );

    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));

    const submit = await screen.findByTestId("crm-create-submit");
    expect(submit).toBeDisabled();

    fireEvent.input(screen.getByLabelText("Name"), {
      target: { value: "New Lead" },
    });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(createCrmContactMock).toHaveBeenCalledWith({
        name: "New Lead",
        email: null,
        telegram: null,
        channelUrl: null,
        status: null,
        nextPingAt: null,
      });
    });
    expect(await screen.findByText("New Lead")).toBeInTheDocument();
  });

  it("surfaces a duplicate email as an error toast", async () => {
    createCrmContactMock.mockRejectedValue(
      new Error("Contact with this email already exists"),
    );

    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.click(screen.getByRole("button", { name: "Add lead" }));
    fireEvent.input(await screen.findByLabelText("Email"), {
      target: { value: "lead@example.com" },
    });
    fireEvent.click(screen.getByTestId("crm-create-submit"));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          description: "Contact with this email already exists",
        }),
      );
    });
  });

  it("loads the next page on demand", async () => {
    listCrmContactsMock.mockResolvedValueOnce({
      items: [contact()],
      total: 2,
      nextCursor: "c1",
    });
    listCrmContactsMock.mockResolvedValueOnce({
      items: [contact({ id: "c2", name: "Lead Two" })],
      total: 2,
      nextCursor: null,
    });

    render(() => <AdminCrm />);
    await screen.findByText("Lead One");

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Lead Two")).toBeInTheDocument();
    expect(listCrmContactsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "c1" }),
    );
  });

  it("hides the pipeline from experts", async () => {
    roleRaw.mockReturnValue("expert");

    render(() => <AdminCrm />);

    expect(
      await screen.findByText(
        "The CRM holds personal data of leads and is limited to admins.",
      ),
    ).toBeInTheDocument();
    expect(listCrmContactsMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add lead" })).not.toBeInTheDocument();
  });
});
