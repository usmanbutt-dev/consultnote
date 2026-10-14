import { createRoot } from "react-dom/client";
import { ProfileEditor } from "@/components/profile-editor";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <ProfileEditor
    initialProfile={{
      id: "9d617a5e-8818-4abb-a18a-04afbdce3757",
      email: "doctor@example.test",
      fullName: "Ayesha Khan",
      specialty: "",
      clinic: "",
      avatarPath: null,
      deleting: false,
    }}
  />,
);
