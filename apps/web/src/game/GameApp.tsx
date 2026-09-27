import React, {useEffect, useRef, useState} from 'react';
import './match.css';
import type {Command, Difficulty, MatchConfig, PlayerId, WorkerResponse} from '../../../../packages/protocol/src/index';
import {placementReason, type MatchSnapshot} from '../../../../packages/sim/src/index';
import {wallSpans, wallPlacementReason} from '../../../../packages/sim/src/walls';
import {
  buildings,
  buildingById,
  unitById,
  dispatches,
  units,
  sightFor,
  garrisonCapacity,
} from '../../../../packages/content/src/index';
import {Showcase} from './renderer/showcase';
import {Minimap} from './Minimap';
import {MatchRenderer} from './renderer/match';
import {getSave, putSave} from './sim/save-store';
import {audioForSimulationEvent, playAudio, playVoice, voiceForSimulationEvent} from './audio';

type Screen = 'menu' | 'setup' | 'game' | 'credits';
type ClientCommand = Command extends infer C
  ? C extends Command
    ? Omit<C, 'v' | 'tick' | 'playerId' | 'sequence'>
    : never
  : never;
const ages = ['Stone', 'Classical', 'Medieval', 'Industrial'];
const format = (n: number) => Math.floor(n / 100).toLocaleString();
function CoastBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const world = new Showcase(
      host.current,
      () => {},
      () => {},
      () => {},
    );
    world.controls.enabled = false;
    world.setLight('golden');
    return () => world.dispose();
  }, []);
  return <div ref={host} className="coast-backdrop" aria-hidden="true" />;
}
export function GameApp() {
  const [screen, setScreen] = useState<Screen>('menu'),
    [config, setConfig] = useState<MatchConfig>({
      v: 1,
      seed: 90210,
      difficulty: 'standard',
      mode: 'skirmish',
      populationCap: 200,
      gameSpeed: 1,
      mapSize: 'medium',
      fogOfWar: true,
    }),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    getSave()
      .then(Boolean)
      .then(setSaved)
      .catch(() => setSaved(false));
  }, [screen]);
  if (screen === 'game') return <Match config={config} onExit={() => setScreen('menu')} />;
  return (
    <main className="game-shell menu-shell">
      <CoastBackdrop />
      <div className="menu-backdrop" />
      <section className="main-menu">
        <img src="/crest.svg" alt="Empires of Meridian crest" />
        <p className="eyebrow">AURELIAN LEAGUE · OFFLINE COMMAND</p>
        <h1>Empires of Meridian</h1>
        <p>From a quiet shore, a new civilization rises. Gather, build and command the Aurelian League.</p>
        {screen === 'menu' && (
          <nav>
            <button
              onClick={() => {
                sessionStorage.removeItem('load-meridian');
                setConfig((c) => ({...c, mode: 'tutorial', difficulty: 'relaxed', aiCount: 1}));
                playVoice('commander_ready', 0.62);
                setScreen('game');
              }}
            >
              Guided tutorial
            </button>
            <button onClick={() => setScreen('setup')}>Skirmish</button>
            <button
              disabled={!saved}
              onClick={async () => {
                const save = await getSave();
                if (save) {
                  setConfig(JSON.parse(save.state).config);
                  sessionStorage.setItem('load-meridian', '1');
                  playVoice('commander_ready', 0.62);
                  setScreen('game');
                }
              }}
            >
              Continue autosave
            </button>
            <button onClick={() => setScreen('credits')}>Credits</button>
            <a href="/dev/forge">
              Temperate Coast & Asset Forge <small>explore</small>
            </a>
          </nav>
        )}
        {screen === 'setup' && (
          <div className="setup-card">
            <label>
              Map seed
              <input
                type="number"
                value={config.seed}
                onChange={(e) => setConfig({...config, seed: Number(e.target.value) || 1})}
              />
            </label>
            <label>
              AI opponents
              <select
                value={config.aiCount ?? 1}
                onChange={(e) => setConfig({...config, aiCount: Number(e.target.value) as MatchConfig['aiCount']})}
              >
                <option value="0">None · sandbox</option>
                <option value="1">1 opponent</option>
                <option value="2">2 opponents · free for all</option>
                <option value="3">3 opponents · free for all</option>
              </select>
            </label>
            <label>
              Map size
              <select
                value={config.mapSize ?? 'medium'}
                onChange={(e) => setConfig({...config, mapSize: e.target.value as MatchConfig['mapSize']})}
              >
                <option value="small">Small · 192 × 192</option>
                <option value="medium">Medium · 256 × 256</option>
                <option value="large">Large · 320 × 320</option>
              </select>
            </label>
            <label>
              Visibility
              <select
                value={config.fogOfWar === false ? 'off' : 'on'}
                onChange={(e) => setConfig({...config, fogOfWar: e.target.value === 'on'})}
              >
                <option value="on">Fog of war · explore and remember</option>
                <option value="off">Revealed map · no fog</option>
              </select>
            </label>
            <label>
              Opponent
              <select
                value={config.difficulty}
                onChange={(e) => setConfig({...config, difficulty: e.target.value as Difficulty})}
              >
                <option value="relaxed">Relaxed · patient opponent</option>
                <option value="standard">Standard · balanced opponent</option>
                <option value="ruthless">Ruthless · early pressure</option>
              </select>
            </label>
            <label>
              Population cap
              <select
                value={config.populationCap}
                onChange={(e) => setConfig({...config, populationCap: Number(e.target.value)})}
              >
                {[100, 150, 200, 250, 300].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <div>
              <button onClick={() => setScreen('menu')}>Back</button>
              <button
                className="primary"
                onClick={() => {
                  sessionStorage.removeItem('load-meridian');
                  setConfig({...config, mode: 'skirmish'});
                  playVoice('commander_ready', 0.62);
                  setScreen('game');
                }}
              >
                Launch match
              </button>
            </div>
          </div>
        )}
        {screen === 'credits' && (
          <div className="setup-card">
            <p>
              Original procedural models, game rules and interface created for Empires of Meridian. No third-party art
              or audio is shipped.
            </p>
            <button onClick={() => setScreen('menu')}>Back</button>
          </div>
        )}
      </section>
    </main>
  );
}

function Match({config, onExit}: {config: MatchConfig; onExit: () => void}) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<MatchRenderer | undefined>(undefined),
    worker = useRef<Worker | undefined>(undefined),
    sequence = useRef(1),
    groups = useRef(new Map<string, number[]>()),
    selectedRef = useRef(new Set<number>()),
    buildMode = useRef<string | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | undefined>(undefined),
    [selected, setSelected] = useState(new Set<number>()),
    [paused, setPaused] = useState(false),
    [message, setMessage] = useState('Scout the coast and establish your economy.'),
    [tutorial, setTutorial] = useState(0),
    [debug, setDebug] = useState(false);
  const send = (command: ClientCommand) => {
    if (!snapshot || paused) return;
    const full = {
      v: 1,
      tick: snapshot.tick + 1,
      playerId: 1 as PlayerId,
      sequence: sequence.current++,
      ...command,
    } as Command;
    worker.current?.postMessage({type: 'commands', commands: [full]});
    const commandCue =
      command.type === 'move' || command.type === 'rally'
        ? 'ui.command.move'
        : command.type === 'gather'
          ? 'ui.command.gather'
          : command.type === 'attack'
            ? 'ui.command.attack'
            : command.type === 'build' || command.type === 'resume-build'
              ? 'ui.command.build'
              : command.type === 'garrison' || command.type === 'ungarrison'
                ? 'ui.command.garrison'
                : 'ui.command.accepted';
    playAudio(commandCue);
    if (command.type === 'gather') playVoice('worker_gather', 0.58);
    else if (command.type === 'move' || command.type === 'rally') playVoice('commander_move', 0.5);
    else if (command.type === 'attack') playVoice('commander_attack', 0.52);
    else if (command.type === 'build' || command.type === 'resume-build') playVoice('commander_build', 0.5);
  };
  useEffect(() => {
    const w = new Worker(new URL('./sim/match.worker.ts', import.meta.url), {type: 'module'});
    worker.current = w;
    let pending: MatchSnapshot | undefined,
      previous: MatchSnapshot | undefined,
      frame = 0;
    const consume = () => {
      frame = 0;
      if (!pending) return;
      const snap = pending;
      pending = undefined;
      snapshotRef.current = snap;
      setSnapshot(snap);
      engine.current?.update(snap);
      const seen = new Set(previous?.events.map((e) => `${e.tick}:${e.kind}:${e.text}`));
      for (const e of snap.events) {
        if (seen.has(`${e.tick}:${e.kind}:${e.text}`)) continue;
        const cue = audioForSimulationEvent(e.kind, e.text);
        if (cue) playAudio(cue);
        const voice = voiceForSimulationEvent(e.kind, e.text);
        if (voice) playVoice(voice, 0.62);
      }
      const oldShots = new Set(previous?.projectiles.map((p) => p.id));
      const newShots = new Set(snap.projectiles.map((p) => p.id));
      for (const shot of snap.projectiles) if (!oldShots.has(shot.id)) playAudio('combat.projectile.launch');
      if (previous) for (const id of oldShots) if (!newShots.has(id)) playAudio('combat.projectile.impact');
      if (previous?.map.weather !== snap.map.weather)
        playAudio(snap.map.weather === 'rain' ? 'weather.rain' : 'weather.thunder');
      previous = snap;
    };
    w.onmessage = async (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'snapshot') {
        pending = e.data.snapshot as MatchSnapshot;
        if (!frame) frame = requestAnimationFrame(consume);
      } else if (e.data.type === 'saved' && e.data.save) {
        await putSave(e.data.save);
        setMessage('Match saved.');
      } else if (e.data.type === 'error') setMessage(e.data.message ?? 'Simulation error');
    };
    if (sessionStorage.getItem('load-meridian'))
      getSave().then((save) => (save ? w.postMessage({type: 'load', save}) : w.postMessage({type: 'create', config})));
    else w.postMessage({type: 'create', config});
    const autosave = setInterval(() => w.postMessage({type: 'save'}), 60000);
    return () => {
      clearInterval(autosave);
      cancelAnimationFrame(frame);
      w.terminate();
    };
  }, []);
  const orderAt = (x: number, z: number, targetId?: number) => {
    const snap = snapshotRef.current;
    if (!snap) return;
    const selected = snap.entities.filter((e) => selectedRef.current.has(e.id) && e.owner === 1 && e.hp > 0),
      target = snap.entities.find((e) => e.id === targetId),
      buildings = selected.filter((e) => e.category === 'building'),
      mobile = selected.filter((e) => e.category === 'unit' || e.kind === 'sheep'),
      workers = mobile.filter((e) => e.kind === 'worker');
    if (buildings.length && !mobile.length) {
      sendRef.current({
        type: 'rally',
        buildingIds: buildings.map((e) => e.id),
        x: Math.round(x * 256),
        z: Math.round(z * 256),
        targetId,
      });
      engine.current?.mark(x, z, true);
      setMessage('Rally point set. New units will move here.');
      return;
    }
    if (!mobile.length) return;
    if (target?.owner === 1 && target.category === 'building') {
      if (target.progress < 10000 || (target.hp < target.maxHp && workers.length)) {
        sendRef.current({type: 'resume-build', entityIds: workers.map((e) => e.id), targetId: target.id});
        setMessage(target.progress < 10000 ? 'Construction resumed.' : 'Repairs ordered.');
      } else if (workers.length && target.kind === 'farm') {
        sendRef.current({type: 'gather', entityIds: workers.map((e) => e.id), targetId: target.id});
        setMessage('Farm work ordered. Each farm has two worker positions.');
      } else if (workers.length && garrisonCapacity(target.kind, snap.players[0].age) > 0) {
        sendRef.current({type: 'garrison', entityIds: workers.map((e) => e.id), targetId: target.id});
        setMessage('Villagers taking shelter.');
      } else setMessage('This building cannot shelter the selected units.');
      return;
    }
    if (target && !target.remembered && (target.category === 'resource' || target.category === 'animal')) {
      if (workers.length) {
        sendRef.current({type: 'gather', entityIds: workers.map((e) => e.id), targetId: target.id});
        setMessage(target.category === 'animal' ? 'Hunt and gather food.' : 'Gather order issued.');
      }
      if (target.category === 'animal') {
        const soldiers = mobile.filter((e) => e.kind !== 'worker' && e.kind !== 'sheep');
        if (soldiers.length)
          sendRef.current({type: 'attack', entityIds: soldiers.map((e) => e.id), targetId: target.id});
      }
      return;
    }
    if (target && target.owner > 1 && !target.remembered) {
      sendRef.current({type: 'attack', entityIds: mobile.map((e) => e.id), targetId: target.id});
      setMessage('Attack order issued.');
      return;
    }
    sendRef.current({
      type: 'move',
      entityIds: mobile.map((e) => e.id),
      x: Math.round(x * 256),
      z: Math.round(z * 256),
      formation: 'line',
    });
    engine.current?.mark(x, z);
    setMessage('Move order issued.');
  };
  useEffect(() => {
    if (!host.current) return;
    const r = new MatchRenderer(
      host.current,
      (id, add, button) => {
        const entity = snapshotRef.current?.entities.find((e) => e.id === id);
        if (button === 2) {
          if (entity) orderAt(entity.x / 256, entity.z / 256, id);
          return;
        }
        const next = add ? new Set(selectedRef.current) : new Set<number>();
        if (entity) {
          add && next.has(id) ? next.delete(id) : next.add(id);
          playAudio('ui.selection');
        }
        selectedRef.current = next;
        setSelected(next);
        r.setSelected(next);
      },
      (x, z, button) => {
        if (buildMode.current) {
          if (button === 2) {
            buildMode.current = undefined;
            r.setPlacement();
            setMessage('Placement cancelled.');
            return;
          }
          if (buildMode.current === 'wall') {
            for (const e of snapshotRef.current?.entities ?? []) {
              if (e.owner !== 1 || !e.wallAxis) continue;
              for (const sign of [-1, 1]) {
                const sx = (e.x + (sign * e.wallAxis[0]) / 2) / 256,
                  sz = (e.z + (sign * e.wallAxis[1]) / 2) / 256;
                if (Math.hypot(x - sx, z - sz) < 1.5) {
                  x = sx;
                  z = sz;
                }
              }
            }
            if (!r.wallAnchor) {
              r.wallAnchor = {x, z};
              setMessage('Click a corner to build a wall line. Keep clicking to bend it; right-click finishes.');
              return;
            }
            const spans = wallSpans(
              Math.round(r.wallAnchor.x * 256),
              Math.round(r.wallAnchor.z * 256),
              Math.round(x * 256),
              Math.round(z * 256),
            );
            const reason = snapshotRef.current && wallPlacementReason(snapshotRef.current, spans, 1);
            if (reason) {
              setMessage(reason);
              return;
            }
            sendRef.current?.({
              type: 'build',
              workerIds: [...selectedRef.current],
              buildingId: 'wall',
              x: Math.round(r.wallAnchor.x * 256),
              z: Math.round(r.wallAnchor.z * 256),
              endX: Math.round(x * 256),
              endZ: Math.round(z * 256),
            } as never);
            r.wallAnchor = {x, z};
            return;
          }
          const reason =
            snapshotRef.current &&
            placementReason(
              snapshotRef.current,
              buildMode.current,
              Math.round(x * 256),
              Math.round(z * 256),
              r.getPlacementRotation(),
            );
          if (reason) {
            setMessage(reason);
            return;
          }
          sendRef.current?.({
            type: 'build',
            workerIds: [...selectedRef.current],
            buildingId: buildMode.current,
            x: Math.round(x * 256),
            z: Math.round(z * 256),
            rotation: r.getPlacementRotation(),
          } as never);
          playAudio('ui.build.placed');
          buildMode.current = undefined;
          r.setPlacement();
          setMessage('Construction order issued.');
          return;
        }
        if (button === 2 && selectedRef.current.size) orderAt(x, z);
        else {
          selectedRef.current = new Set();
          setSelected(new Set());
          r.setSelected(new Set());
        }
      },
      (ids, add) => {
        const next = add ? new Set([...selectedRef.current, ...ids]) : new Set(ids);
        selectedRef.current = next;
        setSelected(next);
        r.setSelected(next);
        playAudio('ui.selection', Math.min(1.25, 0.8 + next.size / 20));
      },
    );
    engine.current = r;
    return () => r.dispose();
  }, []);
  const snapshotRef = useRef<MatchSnapshot | undefined>(undefined);
  snapshotRef.current = snapshot;
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => engine.current?.setSelected(selected), [selected]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as Element)?.tagName ?? '')) return;
      if (e.code === 'Escape') {
        buildMode.current = undefined;
        engine.current?.setPlacement();
        setMessage('Order cancelled.');
      }
      if (e.code === 'KeyX') sendRef.current({type: 'stop', entityIds: [...selectedRef.current]});
      if (/^Digit[1-9]$/.test(e.code)) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          groups.current.set(e.code, [...selectedRef.current]);
          setMessage('Control group ' + e.code.slice(-1) + ' assigned.');
        } else {
          const ids = groups.current.get(e.code);
          if (ids) {
            const next = new Set(ids.filter((id) => snapshotRef.current?.entities.some((e) => e.id === id)));
            selectedRef.current = next;
            setSelected(next);
            engine.current?.setSelected(next);
          }
        }
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);
  const entities = snapshot?.entities ?? [],
    chosen = entities.filter((e) => selected.has(e.id)),
    one = chosen[0],
    p = snapshot?.players[0];
  useEffect(() => {
    if (import.meta.env.DEV) {
      const inspect = {
        snapshot: () => structuredClone(snapshotRef.current),
        project: (id: number) => engine.current?.projectEntity(id),
        projectWorld: (x: number, z: number) => engine.current?.projectWorld(x, z),
        metrics: () => engine.current?.metrics(),
        camera: () =>
          engine.current
            ? {position: engine.current.camera.position.toArray(), target: engine.current.controls.target.toArray()}
            : undefined,
      };
      Object.defineProperty(window, 'meridianInspect', {value: inspect, configurable: true});
      return () => {
        delete (window as unknown as Record<string, unknown>).meridianInspect;
      };
    }
  }, []);
  const trainable =
    one?.owner === 1 && one?.category === 'building'
      ? units.filter((u) => buildingById.get(one.kind)?.production.includes(u.id) && u.age <= (p?.age ?? 1))
      : [];
  const buildable = buildings.filter((b) => b.age <= (p?.age ?? 1) && !['hall'].includes(b.id));
  const tutorialSteps = [
    'Select a worker beside your Charter Hall. Left-drag a box to select a group; Shift adds to selection. Alt-left-drag orbits, middle-drag pans, and scrolling zooms.',
    'Right-click the berry bushes or a tree. Workers gather, carry and return resources to the hall.',
    'With a worker selected, choose Harbor Residence. Place its green footprint on clear ground and wait for completion.',
    'Select the barracks and train Militia, a Spearman or an Archer. Costs appear on each command.',
    'Keep gathering provisions and timber. Advance with 500 provisions and 300 timber.',
    'Scout with your Explorer. Reinforce your army, then conquer the rival settlement.',
  ];
  useEffect(() => {
    if (config.mode !== 'tutorial') return;
    const tutorialVoice = ['tutorial_camera', 'tutorial_gather', 'tutorial_build', 'tutorial_train', 'tutorial_fight', 'tutorial_dispatch'][tutorial];
    if (tutorialVoice) playVoice(tutorialVoice, 0.65);
  }, [config.mode, tutorial]);
  useEffect(() => {
    if (config.mode !== 'tutorial' || !snapshot) return;
    const done = [
      chosen.some((e) => e.kind === 'worker'),
      Object.values(snapshot.players[0].stats.gathered).some((n) => n > 0),
      entities.some((e) => e.owner === 1 && e.kind === 'house' && e.id > 30 && e.progress === 10000),
      entities.some((e) => e.owner === 1 && ['militia', 'spearman', 'archer'].includes(e.kind)),
      snapshot.players[0].age > 1,
      snapshot.winner === 1,
    ];
    if (done[tutorial]) setTutorial(Math.min(tutorial + 1, tutorialSteps.length - 1));
  }, [snapshot, selected]);
  return (
    <main className="match-shell">
      <div ref={host} className="match-canvas" />
      <header className="top-hud">
        <button
          className="crest-button"
          onClick={() => {
            worker.current?.postMessage({type: 'pause'});
            setPaused(true);
          }}
          aria-label="Pause"
        >
          <img src="/crest.svg" />
        </button>
        {p &&
          (['provisions', 'timber', 'coin', 'metal'] as const).map((k) => (
            <div key={k}>
              <small>{k}</small>
              <strong>{format(p.resources[k])}</strong>
            </div>
          ))}
        <div>
          <small>population</small>
          <strong>
            {p?.population}/{p?.populationCap}
          </strong>
        </div>
        <div>
          <small>age</small>
          <strong>{ages[(p?.age ?? 1) - 1]}</strong>
        </div>
        <div>
          <small>renown</small>
          <strong>
            {Math.floor((p?.renown ?? 0) / 1000)}/10 · {p?.tokens} tokens
          </strong>
        </div>
        <time>
          {snapshot
            ? `${Math.floor(snapshot.tick / 1200)}:${String(Math.floor(snapshot.tick / 20) % 60).padStart(2, '0')}`
            : '0:00'}
        </time>
      </header>
      <aside className="event-feed" aria-live="polite">
        {snapshot?.events
          .slice(-5)
          .reverse()
          .map((e, i) => (
            <p key={`${e.tick}-${i}`}>{e.text}</p>
          ))}
      </aside>
      <Minimap
        snapshot={snapshot}
        selected={selected}
        onCamera={(x, z) => engine.current?.focus(x, z)}
        onOrder={(x, z) => orderAt(x, z)}
        viewport={() => engine.current?.cameraFootprint() ?? []}
      />
      <section className="command-panel">
        <div className="selection-info">
          <span>
            {chosen.length > 1
              ? `${chosen.length} selected`
              : one
                ? (unitById.get(one.kind)?.name ?? buildingById.get(one.kind)?.name ?? one.kind)
                : 'Select your settlement'}
          </span>
          {one && (
            <>
              <small>
                {one.owner === 1 ? 'YOUR SETTLEMENT' : one.owner > 1 ? 'RIVAL SETTLEMENT' : 'RESOURCE'} · {one.task}
              </small>
              <strong>
                {Math.ceil(one.hp)} / {one.maxHp}
              </strong>
              <small>
                Sight {sightFor(one.kind, p?.age ?? 1)} ·{' '}
                {one.damage > 0
                  ? `Attack ${one.damage}`
                  : one.category === 'resource'
                    ? `${Math.ceil(one.amount / 100)} remaining`
                    : ''}
              </small>
              {one.progress < 10000 && (
                <small>Construction {Math.floor(one.progress / 100)}% · right-click with a worker to resume</small>
              )}
              <progress value={one.hp} max={one.maxHp} />
              {one.kind === 'worker' && (
                <small>
                  {(
                    {
                      timber: 'Lumberjack',
                      coin: 'Gold miner',
                      metal: 'Stone miner',
                      farm: 'Farmer',
                      fish: 'Fisher',
                      deer: 'Hunter',
                      sheep: 'Shepherd',
                      provisions: 'Forager',
                    } as Record<string, string>
                  )[one.resourceKind ?? ''] ?? 'Worker'}{' '}
                  · capacity 10 per resource
                </small>
              )}
              {Object.entries(one.carry)
                .filter(([, n]) => n > 0)
                .map(([kind, n]) => (
                  <small key={kind}>
                    Carrying {Math.ceil(n / 100)} {kind}
                  </small>
                ))}
              {one.queue.length > 0 && (
                <div className="production-list">
                  {one.queue.map((q, i) => (
                    <div key={i}>
                      {unitById.get(q.kind)?.name}
                      <progress value={q.total - q.remaining} max={q.total} />
                      <small>{Math.ceil(q.remaining / 20)}s remaining</small>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="command-grid">
          {one?.owner === 1 && one.category === 'building' && (
            <>
              {one.kind === 'wall' && one.progress === 10000 && (
                <button onClick={() => send({type: 'convert-gate', buildingId: one.id})}>
                  Convert to gate<small>20 timber · 10 metal</small>
                </button>
              )}
              <div className="rally-hint">
                Right-click terrain or a resource to set a rally point.{one.rally && <small>Rally point set</small>}
              </div>
              {garrisonCapacity(one.kind, p?.age ?? 1) > 0 && (
                <button disabled={!one.garrisonCount} onClick={() => send({type: 'ungarrison', buildingId: one.id})}>
                  Release garrison
                  <small>
                    {one.garrisonCount ?? 0} / {garrisonCapacity(one.kind, p?.age ?? 1)} sheltered
                  </small>
                </button>
              )}
              {one.garrisonCount ? (
                <button onClick={() => send({type: 'ungarrison', buildingId: one.id, returnToWork: true})}>
                  Back to work<small>Resume sheltered workers’ previous jobs</small>
                </button>
              ) : null}
            </>
          )}
          {trainable.map((u) => (
            <button
              key={u.id}
              onClick={() => send({type: 'train', buildingId: one.id, unitId: u.id})}
              disabled={
                !p ||
                one.progress < 10000 ||
                p.population + u.population > p.populationCap ||
                Object.entries(u.cost).some(([k, n]) => p.resources[k as keyof typeof p.resources] < n)
              }
              title={Object.entries(u.cost)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => `${n / 100} ${k}`)
                .join(' · ')}
            >
              {u.name}
              <small>
                {Object.entries(u.cost)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => `${n / 100} ${k}`)
                  .join(' · ')}{' '}
                · {Math.ceil(u.trainTicks / 20)}s
              </small>
            </button>
          ))}
          {one?.owner === 1 &&
            one?.kind === 'worker' &&
            buildable.map((b) => (
              <button
                key={b.id}
                disabled={!p || Object.entries(b.cost).some(([k, n]) => p.resources[k as keyof typeof p.resources] < n)}
                onClick={() => {
                  buildMode.current = b.id;
                  engine.current?.setPlacement(b.id);
                  setMessage(`Place ${b.name} on clear ground. Q / E rotates the preview.`);
                }}
              >
                {b.name}
                <small>
                  {Object.entries(b.cost)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n / 100} ${k}`)
                    .join(' · ')}
                </small>
              </button>
            ))}
          {chosen.some((e) => e.owner === 1 && e.category === 'unit') && (
            <>
              <button onClick={() => send({type: 'stop', entityIds: [...selected]})}>Stop [X]</button>
              <button onClick={() => send({type: 'stance', entityIds: [...selected], stance: 'aggressive'})}>
                Aggressive
              </button>
              <button onClick={() => send({type: 'stance', entityIds: [...selected], stance: 'stand-ground'})}>
                Hold
              </button>
            </>
          )}
        </div>
      </section>
      <aside className="side-actions">
        <button onClick={() => setDebug(!debug)}>Debug</button>
        {p?.advancing && (
          <div className="advancement">
            Advancing · {Math.ceil(p.advancing.remaining / 20)}s
            <progress max={p.advancing.total} value={p.advancing.total - p.advancing.remaining} />
          </div>
        )}
        {p?.age === 1 && !p.advancing && (
          <button
            disabled={p.resources.provisions < 50000 || p.resources.timber < 30000}
            onClick={() => send({type: 'advance', councilId: 'harvest-council'})}
          >
            Classical Age<small>500 provisions · 300 timber</small>
          </button>
        )}
        {p?.age === 2 && !p.advancing && (
          <button
            disabled={
              p.resources.provisions < 70000 ||
              p.resources.timber < 40000 ||
              p.resources.coin < 25000 ||
              p.resources.metal < 15000
            }
            onClick={() => send({type: 'advance', councilId: 'field-command'})}
          >
            Medieval Age<small>700 provisions · 400 timber · 250 coin · 150 metal</small>
          </button>
        )}
        {p?.age === 3 && !p.advancing && (
          <button
            disabled={
              p.resources.provisions < 90000 ||
              p.resources.timber < 60000 ||
              p.resources.coin < 50000 ||
              p.resources.metal < 40000
            }
            onClick={() => send({type: 'advance', councilId: 'industrial-guilds'})}
          >
            Industrial Age<small>900 provisions · 600 timber · 500 coin · 400 metal</small>
          </button>
        )}
        {dispatches
          .filter((d) => d.age <= (p?.age ?? 1))
          .slice(0, 4)
          .map((d) => (
            <button key={d.id} disabled={!p?.tokens} onClick={() => send({type: 'dispatch', dispatchId: d.id})}>
              {d.name} · {d.tokenCost}
            </button>
          ))}
      </aside>
      {config.mode === 'tutorial' && (
        <aside className="tutorial-card">
          <small>
            FIELD INSTRUCTION {tutorial + 1}/{tutorialSteps.length}
          </small>
          <strong>{tutorialSteps[tutorial]}</strong>
          <button
            className="tutorial-focus"
            onClick={() => {
              const target = entities.find(
                (e) => e.owner === 1 && e.kind === (tutorial === 3 ? 'barracks' : tutorial === 4 ? 'hall' : 'worker'),
              );
              if (target) {
                const ids = new Set([target.id]);
                selectedRef.current = ids;
                setSelected(ids);
                engine.current?.setSelected(ids);
                engine.current?.focus(target.x / 256, target.z / 256);
              }
            }}
          >
            Show me
          </button>
        </aside>
      )}
      {debug && (
        <aside className="debug-panel">
          <b>SIMULATION</b>
          <span>tick {snapshot?.tick}</span>
          <span>checksum {snapshot?.checksum}</span>
          <span>entities {entities.length}</span>
          <span>weather {snapshot?.map.weather}</span>
          <b>AI REASONING</b>
          {snapshot?.aiTrace.slice(-3).map((x) => (
            <span key={x.tick}>
              {x.tick}: {x.goal} · utility {x.utility} · army {x.army}
            </span>
          ))}
        </aside>
      )}
      <div className="match-controls">
        LEFT DRAG SELECT · SHIFT ADD · ALT LEFT DRAG ORBIT · RIGHT CLICK ORDER · MIDDLE DRAG / WASD PAN · SCROLL ZOOM
      </div>
      <div className="toast" aria-live="polite">
        {message}
      </div>
      {paused && (
        <div className="pause-overlay">
          <section>
            <h2>Match paused</h2>
            <button
              onClick={() => {
                worker.current?.postMessage({type: 'resume'});
                setPaused(false);
              }}
            >
              Resume
            </button>
            <button onClick={() => worker.current?.postMessage({type: 'save'})}>Save match</button>
            <button
              onClick={() => {
                worker.current?.postMessage({type: 'resume'});
                onExit();
              }}
            >
              Exit to menu
            </button>
          </section>
        </div>
      )}
      {snapshot?.winner && (
        <div className="pause-overlay">
          <section>
            <h2>{snapshot.winner === 1 ? 'Victory' : 'Defeat'}</h2>
            <p>
              {snapshot.winner === 1
                ? 'The rival charter has fallen.'
                : 'Your settlement can no longer sustain resistance.'}
            </p>
            <dl>
              <dt>Resources gathered</dt>
              <dd>{format(Object.values(p!.stats.gathered).reduce((a, b) => a + b, 0))}</dd>
              <dt>Enemy units defeated</dt>
              <dd>{p?.stats.unitsKilled}</dd>
              <dt>Idle worker minutes</dt>
              <dd>{((p?.stats.idleWorkerTicks ?? 0) / 1200).toFixed(1)}</dd>
            </dl>
            <button onClick={onExit}>Post-game menu</button>
          </section>
        </div>
      )}
    </main>
  );
}
