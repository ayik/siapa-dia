import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ref, onValue, update, get, push } from "firebase/database";
import { database } from "../lib/firebase";

const GRID_SIZE = 4;
const GAME_DURATION = 60 * 1000; // 60 detik

export default function GamePage() {
  const router = useRouter();
  const session = router.query.session || "";
  const [player, setPlayer] = useState("");
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [guess, setGuess] = useState("");
  const [winner, setWinner] = useState("");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(GAME_DURATION);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPlayer(localStorage.getItem("playerName") || "");
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    const sessionRef = ref(database, `sessions/${session}`);
    onValue(sessionRef, (snap) => {
      const data = snap.val();
      if (data) {
        setImageUrl(data.imageUrl);
        setWinner(data.winner || "");
        setStartTime(data.startTime || null);
      }
    });

    const gridRef = ref(database, `games/${session}/gridState`);
    onValue(gridRef, (snap) => {
      const data = snap.val();
      if (data) setGrid(data);
    });

    const winnerRef = ref(database, `games/${session}/winner`);
    onValue(winnerRef, (snap) => {
      const data = snap.val();
      if (data) setWinner(data);
    });

    const leaderboardRef = ref(database, `leaderboard/${session}`);
    onValue(leaderboardRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.values(data).sort((a: any, b: any) => a.time - b.time);
        setLeaderboard(list);
      }
    });
  }, [session]);

  useEffect(() => {
    if (!session || winner) return;
    if (grid.length === 0) {
      const initGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
      update(ref(database, `games/${session}`), {
        gridState: initGrid,
        winner: "",
        startTime: Date.now(),
      });
    }
  }, [session, grid, winner]);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const left = Math.max(0, GAME_DURATION - elapsed);
      setRemaining(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const handleReveal = (row: number, col: number) => {
    if (winner || remaining <= 0) return;
    const updated = grid.map((r, i) =>
      r.map((val, j) => (i === row && j === col ? true : val))
    );
    update(ref(database, `games/${session}`), { gridState: updated });
  };

  const handleGuess = async () => {
    if (!guess.trim()) return;
    if (winner || remaining <= 0) return;
    const snap = await get(ref(database, `sessions/${session}`));
    if (!snap.exists()) return alert("Sesi tidak ditemukan");
    const correctAnswer = snap.val().answer.toLowerCase();
    if (guess.toLowerCase().trim() === correctAnswer) {
      const now = Date.now();
      await update(ref(database, `games/${session}`), { winner: player });
      await push(ref(database, `leaderboard/${session}`), { name: player, time: now });
      setWinner(player);
    } else {
      alert("Jawaban salah, coba lagi");
    }
  };

  const handleReset = () => {
    router.push("/setup-session");
  };

  const tileSize = 100;

  return (
    <div className="p-4 text-center max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Tebak Gambar - Sesi: {session}</h1>
      <p className="mb-2">Pemain: <strong>{player}</strong></p>
      <p className="mb-4 font-semibold">⏳ Waktu tersisa: {Math.ceil(remaining / 1000)} detik</p>

      <div
        className="grid mx-auto"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, ${tileSize}px)` }}
      >
        {grid.map((row, i) =>
          row.map((revealed, j) => (
            <div
              key={`${i}-${j}`}
              onClick={() => handleReveal(i, j)}
              className="relative w-[100px] h-[100px] border cursor-pointer select-none"
              title={revealed ? "Terbuka" : "Klik untuk buka"}
            >
              <img
                src={imageUrl}
                alt="game"
                className="absolute top-0 left-0 w-full h-full object-cover"
                style={{
                  clipPath: `inset(${(i * 100) / GRID_SIZE}% ${((GRID_SIZE - j - 1) * 100) / GRID_SIZE}% ${((GRID_SIZE - i - 1) * 100) / GRID_SIZE}% ${(j * 100) / GRID_SIZE}%)`,
                  visibility: revealed || winner ? "visible" : "hidden"
                }}
              />
              {!revealed && !winner && <div className="absolute inset-0 bg-black opacity-80" />}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col md:flex-row gap-4 justify-center items-center">
        <input
          type="text"
          placeholder="Masukkan tebakan..."
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={!!winner || remaining <= 0}
          className="border rounded px-3 py-2 w-64 md:w-auto"
        />
        <button
          onClick={handleGuess}
          disabled={!!winner || remaining <= 0}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Tebak
        </button>
      </div>

      {(winner || remaining <= 0) && (
        <div className="mt-6">
          {winner ? (
            <p className="text-green-700 font-bold text-xl">🎉 {winner} berhasil menebak dengan benar!</p>
          ) : (
            <p className="text-red-700 font-bold text-xl">⏰ Waktu habis! Tidak ada pemenang.</p>
          )}
          <button
            onClick={handleReset}
            className="mt-4 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Buat sesi baru
          </button>
        </div>
      )}

      <div className="mt-8 text-left max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
        <ol className="list-decimal pl-6">
          {leaderboard.length === 0 && <li>Belum ada pemenang</li>}
          {leaderboard.map((p, i) => (
            <li key={i}>{p.name} - {new Date(p.time).toLocaleTimeString()}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
