'use client';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function TaskQueueStatus() {
  const queueStats   = useQuery(api.tasks.getQueueStats);
  const systemHealth = useQuery(api.systemHealth.get);

  const devOnline    = systemHealth?.mcDevOnline    === true;
  const ollamaOnline = systemHealth?.mcOllamaOnline === true;
  return (
    <div className="space-y-4 p-6 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Distributed Task Queue</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded">
          <div className="text-sm text-slate-600 dark:text-slate-400">Status</div>
          <div className="text-2xl font-bold text-green-600">🟢 Running</div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded">
          <div className="text-sm text-slate-600 dark:text-slate-400">Queued</div>
          <div className="text-2xl font-bold text-blue-600">{queueStats?.queuedTasks ?? '—'}</div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded">
          <div className="text-sm text-slate-600 dark:text-slate-400">Completed</div>
          <div className="text-2xl font-bold text-purple-600">{queueStats?.completedTasks ?? '—'}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Workers</h3>
        <div className="space-y-2">
          {[
            { id: 'mc-dev',    online: devOnline    },
            { id: 'mc-ollama', online: ollamaOnline },
          ].map((w) => (
            <div key={w.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
              <div className="flex items-center gap-3">
                <span className={`inline-block w-3 h-3 rounded-full ${w.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{w.id}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{w.online ? 'online' : 'offline'}</div>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">0 tasks</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
