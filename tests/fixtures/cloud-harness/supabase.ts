// Controlled external SDK boundary. Actual workspace, upload and polling code runs.
declare global {
  interface Window {
    cloudUploads: { path: string; bytes: number }[];
  }
}
window.cloudUploads = [];
export function browserSupabase() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "9d617a5e-8818-4abb-a18a-04afbdce3757" } },
        error: null,
      }),
    },
    storage: {
      from: () => ({
        upload: async (path: string, file: File) => {
          window.cloudUploads.push({ path, bytes: file.size });
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
  };
}
