import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { Login } from "../../src/routes/Login";

const {
  authMock,
  createUserWithEmailAndPasswordMock,
  fetchSignInMethodsForEmailMock,
  sendPasswordResetEmailMock,
  sendSignInLinkToEmailMock,
  isSignInWithEmailLinkMock,
  signInWithEmailLinkMock,
  updatePasswordMock,
  signInWithEmailAndPasswordMock,
  signInWithPopupMock,
} = vi.hoisted(() => {
  const auth = { currentUser: null as unknown };
  return {
    authMock: auth,
    createUserWithEmailAndPasswordMock: vi.fn(),
    fetchSignInMethodsForEmailMock: vi.fn(),
    sendPasswordResetEmailMock: vi.fn(),
    sendSignInLinkToEmailMock: vi.fn(),
    isSignInWithEmailLinkMock: vi.fn(),
    signInWithEmailLinkMock: vi.fn(),
    updatePasswordMock: vi.fn(),
    signInWithEmailAndPasswordMock: vi.fn(),
    signInWithPopupMock: vi.fn(),
  };
});

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => authMock,
  setPersistence: () => Promise.resolve(),
  browserLocalPersistence: {},
  GoogleAuthProvider: vi.fn(() => ({})),
  signInWithPopup: signInWithPopupMock,
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  sendSignInLinkToEmail: sendSignInLinkToEmailMock,
  isSignInWithEmailLink: isSignInWithEmailLinkMock,
  signInWithEmailLink: signInWithEmailLinkMock,
  fetchSignInMethodsForEmail: fetchSignInMethodsForEmailMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  updatePassword: updatePasswordMock,
}));

vi.mock("../../src/lib/api", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("../../src/components/ui/select", () => ({
  Select: (props: {
    value?: { value: string; label: string } | null;
    onChange?: (value: { value: string; label: string } | null) => void;
    options?: { value: string; label: string }[];
    children?: unknown;
  }) => (
    <select
      value={props.value?.value ?? ""}
      onChange={(e) => {
        const next = (props.options || []).find(
          (option) => option.value === e.currentTarget.value,
        );
        props.onChange?.(next ?? null);
      }}
    >
      {(props.options || []).map((option) => (
        <option value={option.value}>{option.label}</option>
      ))}
      {props.children as never}
    </select>
  ),
  SelectContent: (props: { children?: unknown }) => <>{props.children}</>,
  SelectHiddenSelect: (props: { children?: unknown }) => <>{props.children}</>,
  SelectItem: (props: { children?: unknown }) => <>{props.children}</>,
  SelectLabel: (props: { children?: unknown }) => <>{props.children}</>,
  SelectTrigger: (props: { children?: unknown }) => <>{props.children}</>,
  SelectValue: (props: { children?: unknown }) => <>{props.children}</>,
}));

function mockApiUnauthorized() {
  apiFetchMock.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({}),
  });
}

describe("Login linking", () => {
  beforeEach(() => {
    authMock.currentUser = null;
    createUserWithEmailAndPasswordMock.mockReset();
    fetchSignInMethodsForEmailMock.mockReset();
    sendPasswordResetEmailMock.mockReset();
    sendSignInLinkToEmailMock.mockReset();
    isSignInWithEmailLinkMock.mockReset();
    signInWithEmailLinkMock.mockReset();
    updatePasswordMock.mockReset();
    signInWithEmailAndPasswordMock.mockReset();
    signInWithPopupMock.mockReset();
    apiFetchMock.mockReset();
    localStorage.clear();
    mockApiUnauthorized();
  });

  it("sends email-link + stores pending password when email exists with emailLink method", async () => {
    isSignInWithEmailLinkMock.mockReturnValue(false);
    createUserWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/email-already-in-use",
    });
    fetchSignInMethodsForEmailMock.mockResolvedValue(["emailLink"]);
    sendSignInLinkToEmailMock.mockResolvedValue(undefined);

    render(() => (
      <I18nProvider>
        <Login />
      </I18nProvider>
    ));

    fireEvent.input(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.input(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByText("Create account (email/password)"));

    await waitFor(() => {
      expect(fetchSignInMethodsForEmailMock).toHaveBeenCalledWith(
        authMock,
        "user@example.com",
      );
      expect(sendSignInLinkToEmailMock).toHaveBeenCalled();
    });

    expect(localStorage.getItem("emailForSignIn")).toBe("user@example.com");
    expect(localStorage.getItem("pendingPasswordForSignIn")).toBe("secret123");

    expect(
      await screen.findByText(
        "This email already exists. We sent a sign-in link. Open it to sign in and enable password login.",
      ),
    ).toBeInTheDocument();
  });

  it("sets password after email-link sign-in when pending password exists", async () => {
    localStorage.setItem("emailForSignIn", "user@example.com");
    localStorage.setItem("pendingPasswordForSignIn", "secret123");

    isSignInWithEmailLinkMock.mockReturnValue(true);
    signInWithEmailLinkMock.mockImplementation(async () => {
      authMock.currentUser = { uid: "u1" };
    });
    updatePasswordMock.mockResolvedValue(undefined);

    render(() => (
      <I18nProvider>
        <Login />
      </I18nProvider>
    ));

    await waitFor(() => {
      expect(signInWithEmailLinkMock).toHaveBeenCalledWith(
        authMock,
        "user@example.com",
        expect.any(String),
      );
      expect(updatePasswordMock).toHaveBeenCalledWith(
        authMock.currentUser,
        "secret123",
      );
    });

    expect(localStorage.getItem("emailForSignIn")).toBeNull();
    expect(localStorage.getItem("pendingPasswordForSignIn")).toBeNull();
  });

  it("starts password recovery from login screen", async () => {
    isSignInWithEmailLinkMock.mockReturnValue(false);
    sendPasswordResetEmailMock.mockResolvedValue(undefined);

    render(() => (
      <I18nProvider>
        <Login />
      </I18nProvider>
    ));

    fireEvent.input(screen.getByLabelText("Email"), {
      target: { value: "reset@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    await waitFor(() => {
      expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
        authMock,
        "reset@example.com",
      );
    });
    expect(
      await screen.findByText(
        "Password reset email sent. Check your inbox for next steps.",
      ),
    ).toBeInTheDocument();
  });
});
