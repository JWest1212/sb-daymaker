import "../(console)/review/cockpit.css";

// D6, the ungated half of /admin: a sibling route group to (console) so this
// tree never inherits (console)/layout.tsx's getAdminUser() redirect (the
// exact loop that gate would otherwise create for the sign-in page itself).
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="sbd-cockpit">{children}</div>;
}
