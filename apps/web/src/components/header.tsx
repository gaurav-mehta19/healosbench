"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/runs", label: "Runs" },
    { to: "/compare", label: "Compare" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => (
            <Link key={to} href={to}>
              {label}
            </Link>
          ))}
        </nav>
        <ModeToggle />
      </div>
      <hr />
    </div>
  );
}
