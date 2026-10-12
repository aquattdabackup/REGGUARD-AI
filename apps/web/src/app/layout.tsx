import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "RegGuard AI / Verifiable Compliance Intelligence",
    template: "%s | RegGuard AI",
  },
  description:
    "Evidence-grounded issuer onboarding, deterministic policy checks, and independently verifiable audit reports.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
