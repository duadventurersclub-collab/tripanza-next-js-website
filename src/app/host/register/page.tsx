import { redirect } from "next/navigation";

export default function HostRegisterPage() {
  redirect("/host?register=1");
}
