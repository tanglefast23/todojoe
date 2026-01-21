import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to calendar as the default landing page (no auth required)
  redirect("/calendar");
}
