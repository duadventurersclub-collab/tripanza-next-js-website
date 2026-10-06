import { redirect } from "next/navigation";
import { getSiteSettings } from "@/lib/site-settings";

export default async function HostRegisterPage() {
  if (!(await getSiteSettings()).host_enabled) redirect("/?tripanza_view=all#trips");
  redirect("/host?register=1");
}
