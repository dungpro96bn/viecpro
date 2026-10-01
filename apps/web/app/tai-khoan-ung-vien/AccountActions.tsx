'use client';

import { useState } from 'react';
import { IconCheck, IconPlus } from '@/components/ui/Icons';

export default function AccountActions({ task }: { task: { title: string; score: string } }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className={`account-task${done ? ' account-task--done' : ''}`}
      aria-pressed={done}
      onClick={() => setDone((current) => !current)}
    >
      <span className="account-task__icon">{done ? <IconCheck size={14} /> : <IconPlus size={14} />}</span>
      <span className="account-task__title">{task.title}</span>
      <b className="account-task__score">{done ? 'Đã xong' : task.score}</b>
    </button>
  );
}
