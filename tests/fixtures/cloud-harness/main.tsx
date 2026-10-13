import { createRoot } from "react-dom/client";
import { ConsultationWorkspace } from "@/components/consultation-workspace";
import "@/app/globals.css";
createRoot(document.getElementById("root")!).render(
  <ConsultationWorkspace
    configuration={{
      cloud: true,
      provider: "assemblyai",
      transcriptionConfigured: true,
      notesConfigured: true,
      notesModel: "controlled-groq",
    }}
  />,
);
