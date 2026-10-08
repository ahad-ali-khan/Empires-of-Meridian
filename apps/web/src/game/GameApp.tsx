import React, {useEffect, useRef, useState} from 'react';
import './match.css';
import type {
  Command,
  Difficulty,
  MatchConfig,
  PlayerId,
  WorkerRequest,
  WorkerResponse,
} from '../../../../packages/protocol/src/index';
import {
  placementReason,
  evaluatedAttackDamage,
  sitePayout,
  type MatchSnapshot,
} from '../../../../packages/sim/src/index';
import {
  wallSpans,
  wallPlacementReason,
  snapWallEndpoint,
  gateWallAt,
  gateConversionReason,
} from '../../../../packages/sim/src/walls';
import {
  frontierRules,
  treasureById,
  technologies,
  productionName,
  buildings,
  buildingById,
  unitById,
  dispatches,
  dispatchDescription,
  councilChoices,
  councilModifiers,
  advancements,
  councilRate,
  units,
  sightFor,
  garrisonCapacity,
} from '../../../../packages/content/src/index';
import {Showcase} from './renderer/showcase';
import {Minimap} from './Minimap';
import {CheatMenu} from './CheatMenu';
import {MatchRenderer} from './renderer/match';
import {ambientScene} from './ambient-scene';
import {getSave, putSave} from './sim/save-store';
import {
  audioForSimulationEvent,
  playAudio,
  playVoice,
  voiceForSimulationEvent,
  setWeatherAudio,
  stopWeatherAudio,
  setAmbientSources,
  audioDebugState,
} from './audio';

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
                <option value="small">Small · 256 × 256</option>
                <option value="medium">Medium · 320 × 320</option>
                <option value="large">Large · 448 × 448</option>
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
    buildMode = useRef<string | undefined>(undefined),
    orderMode = useRef<'attack-move' | 'patrol' | 'guard' | 'heal' | undefined>(undefined),
    winnerAnnounced = useRef(false),
    renderReady = useRef(false),
    failureRef = useRef('');
  const [snapshot, setSnapshot] = useState<MatchSnapshot | undefined>(undefined),
    [selected, setSelected] = useState(new Set<number>()),
    [paused, setPaused] = useState(false),
    [message, setMessage] = useState('Scout the coast and establish your economy.'),
    [tutorial, setTutorial] = useState(0),
    [debug, setDebug] = useState(false),
    [startup, setStartup] = useState<'loading' | 'ready' | 'error'>('loading'),
    [failure, setFailure] = useState('');
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const failMatch = (reason: string) => {
    if (failureRef.current) return;
    failureRef.current = reason;
    worker.current?.postMessage({type: 'pause'});
    stopWeatherAudio();
    setFailure(reason);
    setPaused(true);
    setStartup('error');
  };
  useEffect(() => {
    if (snapshot && !failureRef.current)
      setWeatherAudio(snapshot.map.weather, snapshot.tick, paused, engine.current?.weatherAudioTransition());
  }, [paused]);
  const send = (command: ClientCommand) => {
    if (!snapshot || paused || !renderReady.current || failureRef.current) return;
    if (command.type === 'stop') {
      orderMode.current = undefined;
      engine.current?.setOrderMode(false);
    }
    const full = {
      v: 1,
      tick: snapshot.tick + 1,
      playerId: 1 as PlayerId,
      sequence: sequence.current++,
      ...command,
    } as Command;
    worker.current?.postMessage({type: 'commands', commands: [full]});
    const commandCue =
      command.type === 'move' || command.type === 'rally' || command.type === 'patrol' || command.type === 'guard'
        ? 'ui.command.move'
        : command.type === 'gather'
          ? 'ui.command.gather'
          : command.type === 'attack' || command.type === 'attack-move'
            ? 'ui.command.attack'
            : command.type === 'build' || command.type === 'resume-build'
              ? 'ui.command.build'
              : command.type === 'garrison' || command.type === 'ungarrison'
                ? 'ui.command.garrison'
                : 'ui.command.accepted';
    playAudio(commandCue);
    if (command.type === 'gather') playVoice('worker_gather', 0.58);
    else if (
      command.type === 'move' ||
      command.type === 'rally' ||
      command.type === 'patrol' ||
      command.type === 'guard'
    )
      playVoice('commander_move', 0.5);
    else if (command.type === 'attack' || command.type === 'attack-move') playVoice('commander_attack', 0.52);
    else if (command.type === 'build' || command.type === 'resume-build') playVoice('commander_build', 0.5);
    else if (command.type === 'advance') playVoice('commander_research', 0.58);
    else if (command.type === 'dispatch') playVoice('commander_dispatch', 0.58);
  };
  useEffect(() => {
    const w = new Worker(new URL('./sim/match.worker.ts', import.meta.url), {type: 'module'});
    worker.current = w;
    let pending: MatchSnapshot | undefined,
      previous: MatchSnapshot | undefined,
      frame = 0,
      readyFrame = 0,
      ambientTick = -20;
    const startupTimeout = setTimeout(() => {
      if (!renderReady.current)
        failMatch('The battlefield took too long to prepare. Return to the menu and try again.');
    }, 40000);
    const consume = () => {
      frame = 0;
      if (!pending || failureRef.current) return;
      const snap = pending;
      pending = undefined;
      try {
        if (!engine.current) throw new Error('The battlefield renderer could not be started.');
        engine.current.update(snap);
      } catch (error) {
        failMatch(error instanceof Error ? error.message : 'The battlefield could not be prepared.');
        return;
      }
      if (!renderReady.current && !readyFrame)
        readyFrame = requestAnimationFrame(() => {
          readyFrame = 0;
          if (failureRef.current) return;
          // The renderer's already scheduled frame runs first. Shader or
          // frame failures can stop startup before the worker is resumed.
          renderReady.current = true;
          clearTimeout(startupTimeout);
          setStartup('ready');
          if (!pausedRef.current) w.postMessage({type: 'resume'});
        });
      snapshotRef.current = snap;
      setSnapshot(snap);
      const seen = new Set(previous?.events.map((e) => `${e.tick}:${e.kind}:${e.text}`));
      for (const e of snap.events) {
        if (seen.has(`${e.tick}:${e.kind}:${e.text}`)) continue;
        if (e.kind === 'order' || e.kind === 'rejected') setMessage(e.text);
        const cue = audioForSimulationEvent(e.kind, e.text);
        if (cue) playAudio(cue);
        const voice = voiceForSimulationEvent(e.kind, e.text);
        if (voice) playVoice(voice, 0.62);
      }
      const oldShots = new Set(previous?.projectiles.map((p) => p.id));
      const newShots = new Set(snap.projectiles.map((p) => p.id));
      for (const shot of snap.projectiles)
        if (!oldShots.has(shot.id)) playAudio('combat.projectile.launch', 1, {x: shot.x / 256, z: shot.z / 256});
      if (previous)
        for (const shot of previous.projectiles)
          if (!newShots.has(shot.id))
            playAudio('combat.projectile.impact', 1, {
              x: (shot.targetX ?? shot.x) / 256,
              z: (shot.targetZ ?? shot.z) / 256,
            });
      if (snap.tick - ambientTick >= 20) {
        setAmbientSources(ambientScene(snap, engine.current?.camera.position));
        ambientTick = snap.tick;
      }
      setWeatherAudio(snap.map.weather, snap.tick, pausedRef.current, engine.current?.weatherAudioTransition());
      previous = snap;
    };
    w.onmessage = async (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'snapshot') {
        pending = e.data.snapshot as MatchSnapshot;
        if (!frame) frame = requestAnimationFrame(consume);
      } else if (e.data.type === 'saved' && e.data.save) {
        await putSave(e.data.save);
        setMessage('Match saved.');
      } else if (e.data.type === 'error') failMatch(e.data.message ?? 'The match simulation could not continue.');
    };
    w.onerror = (event) => {
      event.preventDefault();
      failMatch(event.message || 'The match simulation could not be started.');
    };
    w.onmessageerror = () => failMatch('Match data could not be read. Return to the menu and try again.');
    const prepare = (request: WorkerRequest) => {
      w.postMessage(request);
      // Both messages are queued together. The first snapshot is tick zero;
      // authoritative time stays frozen until its scene has been prepared.
      w.postMessage({type: 'pause'});
    };
    if (sessionStorage.getItem('load-meridian'))
      getSave()
        .then((save) => prepare(save ? {type: 'load', save} : {type: 'create', config}))
        .catch(() => failMatch('The saved match could not be loaded. Return to the menu to start a new match.'));
    else prepare({type: 'create', config});
    const autosave = setInterval(() => w.postMessage({type: 'save'}), 60000);
    return () => {
      clearInterval(autosave);
      clearTimeout(startupTimeout);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(readyFrame);
      w.terminate();
      stopWeatherAudio();
    };
  }, []);
  const orderAt = (x: number, z: number, targetId?: number, queued = false) => {
    const snap = snapshotRef.current;
    if (!snap) return;
    const selected = snap.entities.filter((e) => selectedRef.current.has(e.id) && e.owner === 1 && e.hp > 0),
      target = snap.entities.find((e) => e.id === targetId),
      buildings = selected.filter((e) => e.category === 'building'),
      mobile = selected.filter((e) => e.category === 'unit' || e.kind === 'sheep'),
      workers = mobile.filter((e) => e.kind === 'worker');
    const feedback = () => (target ? engine.current?.feedback(target.id) : engine.current?.mark(x, z));
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
    const mode = orderMode.current;
    if (mode) {
      if (mode === 'guard' || mode === 'heal') {
        if (!target || target.owner !== 1) {
          setMessage('Choose a friendly target for this order.');
          return;
        }
        sendRef.current({type: mode, entityIds: mobile.map((e) => e.id), targetId: target.id, queued});
      } else
        sendRef.current({
          type: mode,
          entityIds: mobile.map((e) => e.id),
          x: Math.round(x * 256),
          z: Math.round(z * 256),
          queued,
        });
      orderMode.current = undefined;
      engine.current?.setOrderMode(false);
      feedback();
      setMessage(`${queued ? 'Queued ' : ''}${mode} order sent.`);
      return;
    }
    if (
      target?.owner === 1 &&
      target.category === 'unit' &&
      target.hp < target.maxHp &&
      mobile.some((e) => e.kind === 'medic')
    ) {
      sendRef.current({
        type: 'heal',
        entityIds: mobile.filter((e) => e.kind === 'medic').map((e) => e.id),
        targetId: target.id,
        queued,
      });
      feedback();
      setMessage('Healing ordered.');
      return;
    }
    if (target?.incapacitatedAt !== undefined && target.owner === 1) {
      sendRef.current({
        type: 'revive',
        entityIds: mobile.filter((e) => e.category === 'unit').map((e) => e.id),
        targetId: target.id,
        queued,
      });
      feedback();
      setMessage('Explorer recovery ordered.');
      return;
    }
    if (target?.category === 'treasure' && !target.remembered) {
      const explorers = mobile.filter((e) => e.kind === 'explorer');
      if (!explorers.length) {
        setMessage('Select an explorer to recover this treasure.');
        return;
      }
      sendRef.current({type: 'collect-treasure', entityIds: explorers.map((e) => e.id), targetId: target.id, queued});
      feedback();
      return;
    }
    if (target?.tradeSite && target.owner !== 1 && !target.remembered) {
      sendRef.current({
        type: 'claim-site',
        entityIds: mobile.filter((e) => e.category === 'unit').map((e) => e.id),
        targetId: target.id,
        queued,
      });
      feedback();
      return;
    }
    if (target?.owner === 1 && target.category === 'building' && workers.length) {
      if (target.progress < 10000 || target.hp < target.maxHp) {
        sendRef.current({type: 'resume-build', entityIds: workers.map((e) => e.id), targetId: target.id, queued});
        feedback();
        setMessage(target.progress < 10000 ? 'Construction resumed.' : 'Repairs ordered.');
        return;
      }
      if (target.kind === 'farm') {
        sendRef.current({type: 'gather', entityIds: workers.map((e) => e.id), targetId: target.id, queued});
        feedback();
        setMessage('Farm work ordered. Each farm has two worker positions.');
        return;
      }
      if (garrisonCapacity(target.kind, snap.players[0].age) > 0) {
        sendRef.current({type: 'garrison', entityIds: workers.map((e) => e.id), targetId: target.id, queued});
        feedback();
        setMessage('Villagers taking shelter.');
        return;
      }
    }
    if (target && !target.remembered && (target.category === 'resource' || target.category === 'animal')) {
      const hunters =
        target.category === 'animal' && target.hp > 0 ? mobile.filter((e) => e.kind !== 'worker' && e.damage > 0) : [];
      if (workers.length || hunters.length) {
        if (workers.length)
          sendRef.current({type: 'gather', entityIds: workers.map((e) => e.id), targetId: target.id, queued});
        if (hunters.length)
          sendRef.current({type: 'attack', entityIds: hunters.map((e) => e.id), targetId: target.id, queued});
        feedback();
        setMessage(
          target.category === 'animal'
            ? target.hp > 0
              ? 'Hunt and gather food.'
              : 'Collecting food.'
            : 'Gather order issued.',
        );
        return;
      }
      // Non-workers still receive a useful move order when scenery is under the cursor.
    }
    if (target && (target.owner > 1 || target.guardOf !== undefined) && !target.remembered) {
      const attackers = mobile.filter((e) => e.damage > 0);
      if (attackers.length) {
        sendRef.current({type: 'attack', entityIds: attackers.map((e) => e.id), targetId: target.id, queued});
        feedback();
        playVoice('enemy_sighted', 0.58);
        setMessage('Attack order issued.');
        return;
      }
    }
    sendRef.current({
      type: 'move',
      queued,
      entityIds: mobile.map((e) => e.id),
      x: Math.round(x * 256),
      z: Math.round(z * 256),
      formation: 'line',
    });
    feedback();
    setMessage(queued ? 'Move order queued.' : 'Move order issued.');
  };
  useEffect(() => {
    if (!host.current) return;
    let r: MatchRenderer;
    try {
      r = new MatchRenderer(
        host.current,
        (id, add, button) => {
          const entity = snapshotRef.current?.entities.find((e) => e.id === id);
          if (button === 2) {
            if (entity) orderAt(entity.x / 256, entity.z / 256, id, add);
            return;
          }
          if (orderMode.current && entity) {
            orderAt(entity.x / 256, entity.z / 256, id, add);
            return;
          }
          const next = add ? new Set(selectedRef.current) : new Set<number>();
          if (entity) {
            if (add && next.has(id)) next.delete(id);
            else next.add(id);
            playAudio('ui.selection');
          }
          selectedRef.current = next;
          setSelected(next);
          r.setSelected(next);
        },
        (x, z, button, queued) => {
          if (buildMode.current) {
            if (button === 2) {
              buildMode.current = undefined;
              r.setPlacement();
              setMessage('Placement finished. Reserved blueprints remain available for construction.');
              return;
            }
            if (buildMode.current === 'wall') {
              const snapped = snapWallEndpoint(snapshotRef.current!, Math.round(x * 256), Math.round(z * 256), 1);
              x = snapped.x / 256;
              z = snapped.z / 256;
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
                queued,
              } as never);
              r.wallAnchor = {x, z};
              return;
            }
            if (buildMode.current === 'gate' && snapshotRef.current) {
              const wall = gateWallAt(snapshotRef.current, Math.round(x * 256), Math.round(z * 256), 1);
              if (wall) {
                const reason = gateConversionReason(wall, 1, snapshotRef.current.players[0].age, snapshotRef.current);
                if (reason) {
                  setMessage(reason);
                  return;
                }
                sendRef.current({type: 'convert-gate', buildingId: wall.id});
                if (!queued) {
                  buildMode.current = undefined;
                  r.setPlacement();
                }
                return;
              }
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
              queued,
            } as never);
            playAudio('ui.build.placed');
            if (!queued) {
              buildMode.current = undefined;
              r.setPlacement();
            }
            setMessage(
              queued
                ? 'Blueprint reserved and queued. Shift-place another; right-click finishes.'
                : 'Construction order issued.',
            );
            return;
          }
          if ((button === 2 || orderMode.current) && selectedRef.current.size) orderAt(x, z, undefined, queued);
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
          if (next.size) playAudio('ui.selection', Math.min(1.25, 0.8 + next.size / 20));
        },
        failMatch,
      );
    } catch (error) {
      failMatch(error instanceof Error ? error.message : 'The battlefield renderer could not be started.');
      return;
    }
    engine.current = r;
    return () => r.dispose();
  }, []);
  const snapshotRef = useRef<MatchSnapshot | undefined>(undefined);
  snapshotRef.current = snapshot;
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!snapshot?.winner || winnerAnnounced.current) return;
    winnerAnnounced.current = true;
    if (snapshot.winner === 1) {
      playAudio('match.victory', 1.15);
      playVoice('victory', 0.72);
    } else playVoice('defeat', 0.72);
  }, [snapshot?.winner]);
  useEffect(() => engine.current?.setSelected(selected), [selected]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as Element)?.tagName ?? '')) return;
      if (e.code === 'Escape') {
        orderMode.current = undefined;
        engine.current?.setOrderMode(false);
        buildMode.current = undefined;
        engine.current?.setPlacement();
        setMessage('Order cancelled.');
      }
      if (e.code === 'KeyT' || e.code === 'KeyP' || e.code === 'KeyG' || e.code === 'KeyH') {
        orderMode.current =
          e.code === 'KeyT' ? 'attack-move' : e.code === 'KeyP' ? 'patrol' : e.code === 'KeyG' ? 'guard' : 'heal';
        engine.current?.setOrderMode(true);
        setMessage(`Choose a target for ${orderMode.current}. Escape cancels; Shift queues.`);
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
        audio: () => audioDebugState(),
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
  const buildable = buildings.filter((b) => b.age <= (p?.age ?? 1));
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
    const tutorialVoice = [
      'tutorial_camera',
      'tutorial_gather',
      'tutorial_build',
      'tutorial_train',
      'tutorial_fight',
      'tutorial_dispatch',
    ][tutorial];
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
        <CheatMenu
          enabled={!!snapshot?.offlineCheats && !paused && startup === 'ready' && snapshot.winner === null}
          used={p?.cheatsUsed ?? 0}
          selected={chosen.filter((e) => e.owner === 1 && e.hp > 0).length}
          onCheat={(cheat) =>
            send({
              type: 'offline-cheat',
              cheat,
              entityIds: chosen.filter((e) => e.owner === 1 && e.hp > 0).map((e) => e.id),
            })
          }
        />
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
                  ? `Attack ${snapshot ? evaluatedAttackDamage(snapshot, one, one.damage) : one.damage}`
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
                  · capacity{' '}
                  {Math.trunc(
                    (10 * councilRate(snapshot?.players[(one.owner || 1) - 1]?.modifiers ?? [], 'carry')) / 10000,
                  )}{' '}
                  per resource
                </small>
              )}
              {Object.entries(one.carry)
                .filter(([, n]) => n > 0)
                .map(([kind, n]) => (
                  <small key={kind}>
                    Carrying {Math.ceil(n / 100)} {kind}
                  </small>
                ))}
              {one.incapacitatedAt !== undefined && (
                <small>
                  Incapacitated · safe recovery{' '}
                  {Math.floor(((one.recoveryProgress ?? 0) * 100) / frontierRules.safeRecoveryTicks)}% · send a living
                  ally or return for Coin.
                </small>
              )}
              {one.treasureId && (
                <small>
                  {treasureById.get(one.treasureId)?.name} · {treasureById.get(one.treasureId)?.guards} guards ·{' '}
                  {Object.entries(treasureById.get(one.treasureId)?.reward ?? {})
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n / 100} ${k}`)
                    .join(' · ')}{' '}
                  · {(treasureById.get(one.treasureId)?.renown ?? 0) / 1000} Renown. Right-click with an explorer.
                </small>
              )}
              {one.kind === 'market' && (
                <small>
                  Completed markets improve gathering and captured trade income by{' '}
                  {(frontierRules.marketRate - 10000) / 100}% within {frontierRules.marketRadius / 256} world units.
                  Nearby markets do not stack. Buy and sell resources below.
                </small>
              )}
              {one.kind === 'tradePost' && !one.tradeSite && (
                <small>
                  A completed trade depot adds {(frontierRules.depotRate - 10000) / 100}% to captured-site income within{' '}
                  {frontierRules.marketRadius / 256} world units. Nearby depots do not stack.
                </small>
              )}
              {one.tradeSite && (
                <small>
                  Trade route site ·{' '}
                  {one.captureContested ? 'Contested' : one.owner ? `Player ${one.owner} controls` : 'Neutral'} ·
                  capture {Math.floor(((one.captureProgress ?? 0) * 100) / frontierRules.siteCaptureTicks)}% ·{' '}
                  {(one.owner === 1 ? sitePayout(snapshot!, one) : frontierRules.siteIncome) / 100}{' '}
                  {one.siteIncome ?? 'coin'} every {frontierRules.siteIncomeTicks / 20}s
                  {one.owner === 1 ? ' including active bonuses.' : ' before bonuses.'}
                  Right-click with units to claim.
                </small>
              )}
              {one.category === 'unit' && (
                <small>
                  Order: {one.directive?.kind ?? one.task} · {one.orders?.length ?? 0} queued · Shift-right-click to
                  queue
                </small>
              )}
              {one.orders?.map((order, i) => (
                <small key={i}>
                  {i + 1}. {order.type}
                </small>
              ))}
              {one.queue.length > 0 && (
                <div className="production-list">
                  {one.queue.map((q, i) => (
                    <div key={i}>
                      {productionName(q.kind)}
                      <progress value={q.total - q.remaining} max={q.total} />
                      <small>{Math.ceil(q.remaining / 20)}s remaining</small>
                      {one.owner === 1 && q.id !== undefined && (
                        <button onClick={() => send({type: 'cancel-production', buildingId: one.id, queueId: q.id!})}>
                          Cancel · {q.remaining === q.total && !q.progressRemainder ? '100' : '50'}% refund
                        </button>
                      )}
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
          {one?.owner === 1 &&
            one.category === 'building' &&
            technologies
              .filter((t) => t.building === one.kind)
              .map((t) => {
                const completed = p?.researched.includes(t.id);
                const queued = snapshot?.entities.some(
                  (e) => e.owner === 1 && e.queue.some((q) => q.kind === `research:${t.id}`),
                );
                const reason = completed
                  ? 'Completed'
                  : queued
                    ? 'Queued'
                    : one.progress < 10000
                      ? 'Finish construction first'
                      : !p || t.age > p.age
                        ? `Requires ${ages[t.age - 1]} age`
                        : t.prerequisites.some((id) => !p.researched.includes(id))
                          ? 'Requires prerequisite research'
                          : Object.entries(t.cost).some(([k, n]) => p.resources[k as keyof typeof p.resources] < n)
                            ? 'Not enough resources'
                            : '';
                return (
                  <button
                    key={t.id}
                    disabled={!!reason}
                    title={councilModifiers[t.modifier].description}
                    onClick={() => send({type: 'research', buildingId: one.id, technologyId: t.id})}
                  >
                    Research {t.name}
                    <small>{councilModifiers[t.modifier].description}</small>
                    <small>
                      {reason ||
                        `${t.ticks / 20}s · ${Object.entries(t.cost)
                          .filter(([, n]) => n > 0)
                          .map(([k, n]) => `${n / 100} ${k}`)
                          .join(' · ')}`}
                    </small>
                  </button>
                );
              })}
          {one?.owner === 1 && one.category === 'building' && one.progress < 10000 && (
            <button onClick={() => send({type: 'cancel-construction', buildingId: one.id})}>
              Cancel construction · {one.progress === 0 ? '100%' : '50%'} refund
              <small>Remove this blueprint and release its footprint</small>
            </button>
          )}
          {one?.owner === 1 && one.incapacitatedAt !== undefined && (
            <button
              disabled={
                !p ||
                p.resources.coin < frontierRules.recallCoin ||
                !entities.some((e) => e.owner === 1 && e.kind === 'hall' && e.hp > 0 && e.progress === 10000)
              }
              onClick={() => send({type: 'recall-explorer', entityId: one.id})}
            >
              Return explorer<small>{frontierRules.recallCoin / 100} Coin · requires completed hall</small>
            </button>
          )}
          {one?.owner === 1 &&
            one.tradeSite &&
            (['provisions', 'timber', 'coin', 'metal'] as const).map((resource) => (
              <button
                key={resource}
                disabled={one.siteIncome === resource}
                onClick={() => send({type: 'site-income', siteId: one.id, resource})}
              >
                Route income: {resource}
                <small>{one.siteIncome === resource ? 'Selected' : 'Switch next payout'}</small>
              </button>
            ))}
          {one?.owner === 1 &&
            one.kind === 'market' &&
            (['provisions', 'timber', 'metal'] as const).flatMap((resource) =>
              (['buy', 'sell'] as const).map((direction) => (
                <button
                  key={`${resource}-${direction}`}
                  disabled={
                    one.progress < 10000 ||
                    !p ||
                    (direction === 'buy'
                      ? p.resources.coin < frontierRules.buyCoin
                      : p.resources[resource] < frontierRules.exchangeLot)
                  }
                  onClick={() => send({type: 'exchange', buildingId: one.id, resource, direction})}
                >
                  {direction === 'buy' ? 'Buy' : 'Sell'} {frontierRules.exchangeLot / 100} {resource}
                  <small>
                    {direction === 'buy'
                      ? `Pay ${frontierRules.buyCoin / 100} Coin`
                      : `Receive ${frontierRules.sellCoin / 100} Coin`}
                  </small>
                </button>
              )),
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
                  orderMode.current = undefined;
                  engine.current?.setOrderMode(false);
                  buildMode.current = b.id;
                  engine.current?.setPlacement(b.id);
                  setMessage(
                    `Place ${b.name} on clear ground. Q / E rotates; Shift-click queues and repeats; right-click finishes.`,
                  );
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
              {(['attack-move', 'patrol', 'guard', 'heal'] as const)
                .filter((mode) => mode !== 'heal' || chosen.some((e) => e.kind === 'medic'))
                .map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      orderMode.current = mode;
                      engine.current?.setOrderMode(true);
                      setMessage(`Choose a target for ${mode}. Escape cancels; Shift queues.`);
                    }}
                  >
                    {mode === 'attack-move'
                      ? 'Attack-move [T]'
                      : mode === 'patrol'
                        ? 'Patrol [P]'
                        : mode === 'guard'
                          ? 'Guard [G]'
                          : 'Heal [H]'}
                  </button>
                ))}
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
        <details className="dispatch-panel">
          <summary>Frontier economy</summary>
          <p>
            Trade sites discovered: {entities.filter((e) => e.tradeSite).length} · yours:{' '}
            {entities.filter((e) => e.tradeSite && e.owner === 1).length}
          </p>
          <p>
            Route income received:{' '}
            {p
              ? Object.entries(p.stats.tradeIncome)
                  .map(([k, n]) => `${format(n)} ${k}`)
                  .join(' · ')
              : '0'}
          </p>
          <p>
            Treasures recovered: {p?.stats.treasures ?? 0} · market exchanges: {p?.stats.exchanges ?? 0}
          </p>
          <p>Enemy structures retain their last observed state through fog. Contesting a route pauses its income.</p>
        </details>
        {p?.advancing && (
          <div className="advancement">
            {p.advancing.waiting ??
              `${councilChoices.find((c) => c.id === p.advancing!.councilId)?.name} · ${Math.ceil(p.advancing.remaining / 20)}s`}
            <progress max={p.advancing.total} value={p.advancing.total - p.advancing.remaining} />
          </div>
        )}
        {p && p.age < 4 && !p.advancing && (
          <details className="dispatch-panel council-panel">
            <summary>Advance to {ages[p.age]} Age</summary>
            {councilChoices
              .filter((c) => c.age === p.age + 1)
              .map((choice) => {
                const advancement = advancements.find((a) => a.age === choice.age)!;
                const hall = entities.find(
                  (e) => e.owner === 1 && e.kind === 'hall' && e.hp > 0 && e.progress === 10000,
                );
                const affordable = Object.entries(advancement.cost).every(
                  ([kind, amount]) => p.resources[kind as keyof typeof p.resources] >= amount,
                );
                const costText = Object.entries(advancement.cost)
                  .filter(([, n]) => n > 0)
                  .map(([kind, n]) => `${n / 100} ${kind}`)
                  .join(' · ');
                const deliveryText = Object.entries(choice.delivery)
                  .filter(([, n]) => n > 0)
                  .map(([kind, n]) => `${n / 100} ${kind}`)
                  .join(' · ');
                return (
                  <button
                    key={choice.id}
                    disabled={!hall || !affordable}
                    title={
                      !hall
                        ? 'A completed central hall is required.'
                        : !affordable
                          ? 'Not enough resources.'
                          : councilModifiers[choice.modifier].description
                    }
                    onClick={() => send({type: 'advance', councilId: choice.id})}
                  >
                    {choice.name}
                    <small>
                      {costText} · {advancement.ticks / 20}s
                    </small>
                    <small>Immediate delivery: {deliveryText}</small>
                    <small>Permanent: {councilModifiers[choice.modifier].description}</small>
                  </button>
                );
              })}
          </details>
        )}
        {p && p.modifiers.length > 0 && (
          <details className="dispatch-panel">
            <summary>Settlement bonuses</summary>
            {p.modifiers.map((id) => (
              <p key={id}>{councilModifiers[id]?.description ?? id}</p>
            ))}
          </details>
        )}
        <details className="dispatch-panel">
          <summary>Dispatch charter · {p?.tokens ?? 0} tokens</summary>
          <p>One use per card. Cancel within 5s of ordering. Deliveries wait for a hall/fort and population space.</p>
          {p?.pendingDispatches.map((pending) => {
            const card = dispatches.find((d) => d.id === pending.id)!;
            const departing = (snapshot?.tick ?? 0) < pending.departureTick;
            return (
              <div className="dispatch-transit" key={pending.id}>
                <strong>{card.name}</strong>
                <small>
                  {pending.waiting ??
                    `${departing ? 'Departs' : 'Arrives'} in ${Math.max(0, Math.ceil(((departing ? pending.departureTick : pending.arrivalTick) - (snapshot?.tick ?? 0)) / 20))}s`}
                </small>
                {departing && (
                  <button onClick={() => send({type: 'cancel-dispatch', dispatchId: pending.id})}>
                    Cancel · refund {card.tokenCost} tokens
                  </button>
                )}
              </div>
            );
          })}
          {dispatches.map((d) => {
            const sent = p?.usedDispatches.includes(d.id);
            const pending = p?.pendingDispatches.some((q) => q.id === d.id);
            const reason = sent
              ? 'Delivered · once per match'
              : pending
                ? 'In transit'
                : d.age > (p?.age ?? 1)
                  ? `Requires ${ages[d.age - 1]} Age`
                  : (p?.tokens ?? 0) < d.tokenCost
                    ? 'Not enough Dispatch tokens'
                    : '';
            return (
              <button
                key={d.id}
                disabled={Boolean(reason)}
                title={reason || dispatchDescription(d)}
                onClick={() => send({type: 'dispatch', dispatchId: d.id})}
              >
                {d.name} · {d.tokenCost} tokens
                <small>{dispatchDescription(d)}</small>
                <small>{reason || `Arrival ${d.arrivalTicks / 20}s · cancel before departure`}</small>
              </button>
            );
          })}
        </details>
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
      {startup !== 'ready' && (
        <div className="pause-overlay" role={startup === 'error' ? 'alert' : 'status'}>
          <section>
            <h2>{startup === 'error' ? 'Match stopped' : 'Preparing battlefield'}</h2>
            <p>
              {startup === 'error' ? failure : 'Generating the world and preparing its units, buildings and terrain.'}
            </p>
            {startup === 'error' && <p>Your match clock has been paused.</p>}
            <button onClick={onExit}>Return to menu</button>
          </section>
        </div>
      )}
      {paused && startup === 'ready' && (
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
              {!!p?.cheatsUsed && (
                <>
                  <dt>Offline cheats used</dt>
                  <dd>{p.cheatsUsed}</dd>
                </>
              )}
              <dt>Resources gathered</dt>
              <dd>{format(Object.values(p!.stats.gathered).reduce((a, b) => a + b, 0))}</dd>
              <dt>Enemy units defeated</dt>
              <dd>{p?.stats.unitsKilled}</dd>
              <dt>Treasures recovered / sites captured</dt>
              <dd>
                {p?.stats.treasures} / {p?.stats.sitesCaptured}
              </dd>
              <dt>Trade income</dt>
              <dd>{p ? format(Object.values(p.stats.tradeIncome).reduce((a, b) => a + b, 0)) : 0}</dd>
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
