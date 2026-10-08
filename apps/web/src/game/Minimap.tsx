import React, {useEffect, useRef, useState} from 'react';
import type {MatchSnapshot} from '../../../../packages/sim/src/index';
import {coastAt, inlandWater, cliffAt} from '../../../../packages/sim/src/terrain';

export function Minimap({
  snapshot,
  selected,
  onCamera,
  onOrder,
  viewport,
}: {
  snapshot?: MatchSnapshot;
  selected: Set<number>;
  onCamera: (x: number, z: number) => void;
  onOrder: (x: number, z: number) => void;
  viewport: () => {x: number; z: number}[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [filter, setFilter] = useState<'all' | 'economy' | 'military'>('all'),
    [expanded, setExpanded] = useState(false),
    dragging = useRef(false),
    terrain = useRef<{key: string; canvas: HTMLCanvasElement; image: ImageData; cells: Uint8Array} | undefined>(
      undefined,
    );
  useEffect(() => {
    if (!snapshot || !canvas.current) return;
    const node = canvas.current,
      ctx = node.getContext('2d')!,
      n = 256,
      size = snapshot.map.size;
    const fw = snapshot.fogWidth,
      key = `${snapshot.map.seed}:${size}:${fw}`;
    if (terrain.current?.key !== key) {
      const backdrop = document.createElement('canvas');
      backdrop.width = backdrop.height = fw;
      const cells = new Uint8Array(fw * fw);
      for (let z = 0; z < fw; z++)
        for (let x = 0; x < fw; x++) {
          const wx = ((x + 0.5) * size) / fw,
            wz = ((z + 0.5) * size) / fw;
          cells[z * fw + x] = cliffAt(wx, wz, size, snapshot.map.seed)
            ? 2
            : wx < coastAt(wz, size, snapshot.map.seed) && !inlandWater(wx, wz, size, snapshot.map.seed)
              ? 1
              : 0;
        }
      terrain.current = {key, canvas: backdrop, image: backdrop.getContext('2d')!.createImageData(fw, fw), cells};
    }
    const backdrop = terrain.current!,
      palette = [
        [
          [16, 32, 31],
          [41, 63, 73],
          [95, 158, 170],
        ],
        [
          [16, 32, 31],
          [66, 79, 60],
          [141, 155, 107],
        ],
        [
          [16, 32, 31],
          [92, 85, 72],
          [178, 163, 138],
        ],
      ];
    let frame = 0,
      last = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 100) return;
      last = time;
      ctx.clearRect(0, 0, n, n);
      for (let i = 0; i < backdrop.cells.length; i++) {
        const rgb = palette[backdrop.cells[i]][snapshot.fog[i] ?? 0],
          p = i * 4;
        backdrop.image.data[p] = rgb[0];
        backdrop.image.data[p + 1] = rgb[1];
        backdrop.image.data[p + 2] = rgb[2];
        backdrop.image.data[p + 3] = 255;
      }
      backdrop.canvas.getContext('2d')!.putImageData(backdrop.image, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(backdrop.canvas, 0, 0, n, n);
      for (const e of snapshot.entities) {
        if (e.hp <= 0 && e.incapacitatedAt === undefined) continue;
        if (filter === 'military' && (e.category === 'resource' || e.category === 'animal' || e.kind === 'worker'))
          continue;
        if (filter === 'economy' && e.category === 'unit' && e.kind !== 'worker') continue;
        const x = (e.x / size) * n,
          z = (e.z / size) * n;
        ctx.fillStyle = selected.has(e.id)
          ? '#fff7ce'
          : e.owner === 1
            ? '#4fe2c4'
            : e.owner > 1
              ? '#e87b67'
              : e.kind === 'timber'
                ? '#335c35'
                : e.kind === 'coin'
                  ? '#e4be54'
                  : e.kind === 'metal'
                    ? '#b3b6af'
                    : '#e2c798';
        ctx.globalAlpha = e.remembered ? 0.6 : 1;
        const r = e.category === 'building' ? 4 : e.category === 'unit' ? 2.5 : 1.8;
        if (e.tradeSite) {
          ctx.beginPath();
          ctx.moveTo(x, z - 4);
          ctx.lineTo(x + 4, z);
          ctx.lineTo(x, z + 4);
          ctx.lineTo(x - 4, z);
          ctx.closePath();
          ctx.fill();
        } else if (e.incapacitatedAt !== undefined) {
          ctx.fillRect(x - 3, z - 1, 6, 2);
          ctx.fillRect(x - 1, z - 3, 2, 6);
        } else {
          const marker = e.category === 'treasure' ? 4 : r;
          ctx.fillRect(x - marker / 2, z - marker / 2, marker, marker);
        }
      }
      ctx.globalAlpha = 1;
      const points = viewport();
      if (points.length) {
        ctx.strokeStyle = '#fff2bd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        points.forEach((p, i) => {
          const x = ((p.x * 256) / size) * n,
            z = ((p.z * 256) / size) * n;
          if (i) ctx.lineTo(x, z);
          else ctx.moveTo(x, z);
        });
        ctx.closePath();
        ctx.stroke();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [snapshot, selected, filter, viewport]);
  const coordinate = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      w = (snapshot?.map.size ?? 65536) / 256;
    return {
      x: Math.max(0, Math.min(w, ((e.clientX - r.left) / r.width) * w)),
      z: Math.max(0, Math.min(w, ((e.clientY - r.top) / r.height) * w)),
    };
  };
  return (
    <section className={'minimap tactical-map' + (expanded ? ' expanded' : '')} aria-label="Minimap">
      <div className="minimap-toolbar">
        <button
          title="Map filter"
          onClick={() => setFilter(filter === 'all' ? 'economy' : filter === 'economy' ? 'military' : 'all')}
        >
          {filter}
        </button>
        <button title="Expand minimap" onClick={() => setExpanded(!expanded)}>
          {expanded ? '−' : '+'}
        </button>
      </div>
      <canvas
        ref={canvas}
        width={256}
        height={256}
        aria-label="Tactical map: drag to move camera, right-click to issue orders"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          const p = coordinate(e);
          if (e.button === 2) onOrder(p.x, p.z);
          else {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            onCamera(p.x, p.z);
          }
        }}
        onPointerMove={(e) => {
          if (dragging.current) {
            const p = coordinate(e);
            onCamera(p.x, p.z);
          }
        }}
        onPointerUp={() => (dragging.current = false)}
      />
      <small>N · drag to navigate · right-click to order</small>
    </section>
  );
}
