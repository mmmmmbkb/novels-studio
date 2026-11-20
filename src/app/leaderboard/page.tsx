'use client';
import { useEffect, useState } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import { getDB } from '@/lib/db';
import { LEVELS } from '@/lib/points';

function Board() {
  const [rows, setRows] = useState<{ name: string; points: number; novels: number; chapters: number }[]>([]);
  useEffect(() => { getDB().leaderboard().then(setRows).catch(() => setRows([])); }, []);
  return (
    <main className="container">
      <h1>🏆 لوحة المتصدرين</h1>
      <p>النقاط: نشر فصل +50 · فصل جديد +10 · +5 لكل 500 كلمة · +2 لكل تفاعل · +5 لكل تعليق.</p>
      <p className="muted">المستويات: {LEVELS.map((l) => `${l.level} ${l.title} (${l.min}+)`).join(' · ')}</p>
      {rows.length === 0 ? <div className="card"><p>لا كتّاب بعد — كن أول من ينشر فصلًا!</p></div> : (
        <div className="card"><table><thead><tr><th>#</th><th>الكاتب</th><th>النقاط</th><th>الروايات</th><th>الفصول</th></tr></thead><tbody>
          {rows.map((r, i) => <tr key={i}><td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td><td><strong>{r.name}</strong></td><td>⭐ {r.points}</td><td>{r.novels}</td><td>{r.chapters}</td></tr>)}
        </tbody></table></div>
      )}
    </main>
  );
}
export default function LeaderboardPage() {
  return <AuthProvider><TopBar /><Board /></AuthProvider>;
}
