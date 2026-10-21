/** Omera dark glass — matches #050505 site; complements globals `.omera-clerk` rules. */
export const omeraClerkAppearance = {
  localization: {
    signUp: {
      emailCode: {
        title: "Confirm your email",
        subtitle:
          "Open the link we sent you. When you are done, sign in on Omera with the same email address.",
      },
    },
    signIn: {
      start: {
        title: "Sign in to Omera",
        subtitle: "Use the email you registered with after confirming your inbox.",
      },
    },
  },
  layout: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    shimmer: false,
  },
  variables: {
    colorBackground: "#0a0a0a",
    colorPrimary: "#ffffff",
    colorText: "#f5f5f5",
    colorTextSecondary: "rgba(245,245,245,0.55)",
    colorInputBackground: "rgba(255,255,255,0.08)",
    colorInputText: "#f5f5f5",
    colorNeutral: "rgba(255,255,255,0.5)",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "mx-auto w-full max-w-md",
    cardBox: "w-full",
    card: "w-full gap-4 border-0 bg-transparent p-0 shadow-none",
    headerTitle: "text-lg font-medium text-white sm:text-xl",
    headerSubtitle: "text-sm text-white/55",
    socialButtonsBlockButton:
      "h-11 border border-white/20 bg-white/[0.07] text-white hover:bg-white/12",
    socialButtonsBlockButtonText: "!text-white font-normal",
    socialButtonsProviderIcon: "brightness-200",
    dividerLine: "bg-white/12",
    dividerText: "text-xs text-white/45",
    formFieldLabel: "text-sm text-white/65",
    formFieldInput:
      "min-h-11 rounded-xl border border-white/20 bg-white/[0.08] text-white shadow-none placeholder:text-white/35",
    formButtonPrimary:
      "min-h-11 rounded-full !bg-white !text-black font-medium shadow-none hover:!bg-white/90",
    formButtonReset:
      "min-h-11 rounded-full border border-white/20 bg-transparent text-white hover:bg-white/10",
    footerActionText: "!text-white/50",
    footerActionLink: "!text-white font-medium hover:!text-white",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-white/75",
    footer: "bg-transparent",
    footerPages: "bg-transparent",
    navbar: "hidden",
    logoBox: "hidden",
    alertText: "text-sm text-white/80",
    formFieldInputShowPasswordButton: "text-white/60",
    otpCodeFieldInput:
      "border border-white/20 bg-white/[0.08] text-white",
  },
};
