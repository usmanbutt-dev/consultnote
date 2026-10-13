export function silentWav(seconds = 1): Uint8Array {
  const dataSize = Math.round(seconds * 8000);
  const bytes = Buffer.alloc(44 + dataSize, 128);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + dataSize, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(8000, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(dataSize, 40);
  return Uint8Array.from(bytes);
}

export function audioRequest(bytes = silentWav(), type = "audio/wav"): Request {
  const body = new FormData();
  body.append(
    "audio",
    new File([Uint8Array.from(bytes)], "recording.wav", { type }),
  );
  return new Request("http://localhost/api/audio/validate", {
    method: "POST",
    body,
  });
}
