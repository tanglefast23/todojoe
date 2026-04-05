import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to entry as the default landing page (no auth required)
  redirect("/entry");
}
