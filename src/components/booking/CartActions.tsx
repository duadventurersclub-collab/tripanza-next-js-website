"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CartActions() {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    await fetch("/api/cart", { method: "DELETE" });
    router.refresh();
  }

  return <button type="button" onClick={remove} disabled={removing} className="text-sm font-bold text-red-600 hover:text-red-700 disabled:opacity-50">{removing ? "Removing…" : "Remove trip"}</button>;
}
