import AuthGuard from '@/components/auth-guard';

export default function DownloadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
