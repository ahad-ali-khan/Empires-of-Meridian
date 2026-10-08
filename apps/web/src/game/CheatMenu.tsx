import React, {useEffect, useState} from 'react';
import type {OfflineCheat} from '../../../../packages/protocol/src/index';

const actions: {id: OfflineCheat; name: string; detail: string}[] = [
  {id: 'resources', name: 'Supply cache', detail: '+1,000 of every resource'},
  {id: 'tokens', name: 'Dispatch reserve', detail: '+5 Dispatch tokens'},
  {id: 'heal', name: 'Restore health', detail: 'Heal living units and completed buildings'},
  {id: 'construction', name: 'Finish construction', detail: 'Complete existing building blueprints'},
  {id: 'production', name: 'Fast production', detail: 'Finish paid queues; population limits still apply'},
  {id: 'reveal', name: 'Reveal the battlefield', detail: 'Disable fog for this match'},
];

export function CheatMenu({
  enabled,
  used,
  selected,
  onCheat,
}: {
  enabled: boolean;
  used: number;
  selected: number;
  onCheat: (cheat: OfflineCheat) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);
  if (!enabled) return null;
  return (
    <>
      <button className="cheat-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Cheats
      </button>
      {open && (
        <section className="cheat-menu" role="dialog" aria-label="Offline cheats">
          <header>
            <h2>Offline cheats</h2>
            <button aria-label="Close cheats" onClick={() => setOpen(false)}>
              Close
            </button>
          </header>
          <p>Available against AI only. Cheat use is recorded in your save and match summary.</p>
          <small>
            {selected ? `Target: ${selected} selected entities` : 'Target: all your entities'} · {used} cheats used
          </small>
          <div>
            {actions.map((action) => (
              <button key={action.id} onClick={() => onCheat(action.id)}>
                {action.name}
                <small>{action.detail}</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
