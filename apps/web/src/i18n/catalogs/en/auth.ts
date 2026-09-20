/**
 * @file i18n/catalogs/en/auth
 * @description Login, register, author application copy.
 */
import type { MessageCatalog } from "../types.js";

export const auth = {
  loginTitle: "Log in to {name}",
  loginSubtitle: "Log in to track your learning progress and apply to become an author",
  registerTitle: "Sign up for {name}",
  registerSubtitle: "Sign up to track your learning progress and apply to become an author",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  emailInvalid: "Invalid email address",
  passwordLabel: "Password",
  passwordPlaceholder: "At least 8 characters",
  passwordTooShort: "Password must be at least 8 characters",
  nicknameLabel: "Nickname",
  nicknamePlaceholder: "Enter a nickname",
  nicknameRequired: "Please enter a nickname",
  submitLogin: "Log in",
  submitRegister: "Sign up",
  switchToRegister: "No account yet? Sign up",
  switchToLogin: "Already have an account? Log in",
  applyAuthor: {
    title: "Apply to become an author",
    description: "Authors can publish articles, animations, and short courses. Applications are reviewed by an admin.",
    needLogin: "Please log in before applying",
    submitted: "Your author application has been submitted and is awaiting admin review.",
    submitFailed: "Failed to submit the application. Please try again later.",
    reasonPlaceholder: "Briefly describe your background and your plans as an author",
    reasonRequired: "Please provide a reason for your application",
    submit: "Submit application",
  },
} as const satisfies MessageCatalog["auth"];
