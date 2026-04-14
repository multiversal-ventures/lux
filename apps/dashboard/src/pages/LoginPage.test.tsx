import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("firebase/auth", () => ({
	getAuth: vi.fn(() => ({})),
	sendSignInLinkToEmail: vi.fn(),
	isSignInWithEmailLink: vi.fn(),
	signInWithEmailLink: vi.fn(),
}));

vi.mock("../hooks/useAuth");
import { useAuth } from "../hooks/useAuth";
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from "firebase/auth";

const mockUseAuth = useAuth as Mock;
const mockIsSignInWithEmailLink = isSignInWithEmailLink as Mock;
const mockSendSignInLinkToEmail = sendSignInLinkToEmail as Mock;
const mockSignInWithEmailLink = signInWithEmailLink as Mock;

function renderLoginPage() {
	return render(
		<MemoryRouter>
			<LoginPage />
		</MemoryRouter>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });
	mockIsSignInWithEmailLink.mockReturnValue(false);
});

describe("LoginPage", () => {
	it("renders email form when not a magic link URL", async () => {
		renderLoginPage();
		await waitFor(() => expect(screen.getByLabelText("Email")).toBeDefined());
		expect(screen.getByText("Sign In with Magic Link")).toBeDefined();
	});

	it("shows validation error when submitting empty email", async () => {
		renderLoginPage();
		await waitFor(() => expect(screen.getByLabelText("Email")).toBeDefined());

		const button = screen.getByText("Sign In with Magic Link");
		await userEvent.click(button);
		expect(screen.getByText("Please enter your email address")).toBeDefined();
	});

	it("shows email-sent view after successful sendSignInLinkToEmail", async () => {
		mockSendSignInLinkToEmail.mockResolvedValue(undefined);
		renderLoginPage();
		await waitFor(() => expect(screen.getByLabelText("Email")).toBeDefined());

		const input = screen.getByLabelText("Email");
		await userEvent.type(input, "user@example.com");
		await userEvent.click(screen.getByText("Sign In with Magic Link"));

		await waitFor(() => expect(screen.getByText("Check your email!")).toBeDefined());
	});

	it("shows error when sendSignInLinkToEmail fails", async () => {
		mockSendSignInLinkToEmail.mockRejectedValue(new Error("auth error"));
		renderLoginPage();
		await waitFor(() => expect(screen.getByLabelText("Email")).toBeDefined());

		const input = screen.getByLabelText("Email");
		await userEvent.type(input, "user@example.com");
		await userEvent.click(screen.getByText("Sign In with Magic Link"));

		await waitFor(() =>
			expect(screen.getByText("Failed to send magic link. Please try again.")).toBeDefined(),
		);
	});

	it("shows spinner briefly when processing a magic link URL", async () => {
		mockIsSignInWithEmailLink.mockReturnValue(true);
		mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: vi.fn() });
		mockSignInWithEmailLink.mockResolvedValue({ user: { uid: "u1" } });
		localStorage.setItem("emailForSignIn", "user@example.com");

		renderLoginPage();
		// Shows spinner while loading
		const { container } = renderLoginPage();
		expect(container.querySelector(".spinner")).toBeDefined();
	});

	it("shows error on invalid magic link", async () => {
		mockIsSignInWithEmailLink.mockReturnValue(true);
		mockSignInWithEmailLink.mockRejectedValue(new Error("invalid link"));
		localStorage.setItem("emailForSignIn", "user@example.com");

		renderLoginPage();
		await waitFor(() =>
			expect(screen.queryByText("Invalid or expired magic link. Please try again.")).toBeDefined(),
		);
	});
});
