import React, { useState } from "react";
import { useRouter } from "next/router";
import { ref, set } from "firebase/database";
import { storage, database } from "../lib/firebase";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

export default function SetupSession() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [answer, setAnswer] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sessionCode, setSessionCode] = useState("");

  const generateSessionCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || !answer || !imageFile) return alert("Lengkapi semua form");

    setUploading(true);

    try {
      const imageId = uuidv4();
      const imgRef = storageRef(storage, `images/${imageId}`);
      await uploadBytes(imgRef, imageFile);
      const imageUrl = await getDownloadURL(imgRef);

      const newSessionCode = generateSessionCode();
      setSessionCode(newSessionCode);

      await set(ref(database, `sessions/${newSessionCode}`), {
        imageUrl,
        answer,
        createdBy: playerName,
        createdAt: Date.now(),
        winner: "",
      });

      localStorage.setItem("playerName", playerName);

      router.push(`/game?session=${newSessionCode}`);
    } catch (err: any) {
      alert("Gagal upload gambar atau buat sesi: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">Buat Sesi Tebak Gambar</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Nama kamu"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          required
          className="border px-3 py-2 rounded"
        />
        <input
          type="text"
          placeholder="Jawaban gambar (siapa ini?)"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          required
          className="border px-3 py-2 rounded"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
          required
          className="border px-3 py-2 rounded"
        />
        <button
          type="submit"
          disabled={uploading}
          className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Buat Sesi"}
        </button>
      </form>
      {sessionCode && (
        <p className="mt-4 text-center text-green-700">
          Sesi dibuat! Kode sesi: <strong>{sessionCode}</strong>
        </p>
      )}
    </div>
  );
}
