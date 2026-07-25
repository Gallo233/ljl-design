import { redirect } from "next/navigation";

/** The lab is the site now. Kept so old links still land somewhere sensible. */
export default function JoiSignalLabPage() {
  redirect("/selected-work");
}
