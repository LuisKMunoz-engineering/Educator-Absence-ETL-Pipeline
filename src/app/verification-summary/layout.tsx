import AuthGuard from '@/components/auth-guard';

export default function VerificationSummaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
