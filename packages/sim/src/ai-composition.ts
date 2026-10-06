import {buildingById, unitById, type UnitDefinition} from '../../content/src/index';
import type {Entity, PlayerState} from './index';

export type AiCompositionEntity = Pick<Entity, 'kind' | 'category' | 'owner' | 'hp'> & {
  queue?: readonly {kind: string}[];
};
export type AiProductionBuilding = AiCompositionEntity & Pick<Entity, 'progress'>;
type ProductionPlayer = Pick<PlayerState, 'id' | 'age' | 'resources' | 'population' | 'populationCap'>;
type CombatRole = 'melee' | 'antiCavalry' | 'ranged' | 'cavalry' | 'siege';

function combatRole(unit: UnitDefinition): CombatRole | undefined {
  const tags = unit.tags;
  if (tags.some((tag) => ['worker', 'explorer', 'support'].includes(tag))) return;
  if (tags.includes('artillery') || tags.includes('siege')) return 'siege';
  if (tags.includes('cavalry')) return 'cavalry';
  if (tags.includes('anti-cavalry')) return 'antiCavalry';
  return tags.includes('ranged') ? 'ranged' : 'melee';
}

/** Integer composition priorities over owned state and caller-supplied observations only. */
export function chooseAiProductionUnit(
  player: ProductionPlayer,
  building: AiProductionBuilding,
  ownEntities: readonly AiCompositionEntity[],
  observedEnemies: readonly AiCompositionEntity[],
): string | undefined {
  if (building.owner !== player.id || building.category !== 'building' || building.hp <= 0 || building.progress < 10000)
    return;
  const production = buildingById.get(building.kind)?.production;
  if (!production?.length) return;

  const counts = new Map<string, number>();
  const population: Record<CombatRole, number> = {melee: 0, antiCavalry: 0, ranged: 0, cavalry: 0, siege: 0};
  let combatCount = 0,
    combatPopulation = 0,
    supportCount = 0,
    siegeCount = 0;
  function count(kind: string) {
    const unit = unitById.get(kind);
    if (!unit) return;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    if (unit.tags.includes('support')) supportCount++;
    const role = combatRole(unit);
    if (!role) return;
    population[role] += unit.population;
    combatPopulation += unit.population;
    combatCount++;
    if (role === 'siege') siegeCount++;
  }
  for (const entity of ownEntities) {
    if (entity.owner !== player.id || entity.hp <= 0) continue;
    if (entity.category === 'unit') count(entity.kind);
    if (entity.category === 'building') for (const item of entity.queue ?? []) count(item.kind);
  }

  let enemies = 0,
    enemyCavalry = 0,
    enemyInfantry = 0,
    enemyRanged = 0,
    enemyPikes = 0,
    enemyBuildings = 0;
  for (const enemy of observedEnemies) {
    if (enemy.owner === player.id || enemy.owner === 0 || enemy.hp <= 0) continue;
    if (enemy.category === 'building') enemyBuildings++;
    const unit = enemy.category === 'unit' ? unitById.get(enemy.kind) : undefined;
    if (!unit || !combatRole(unit)) continue;
    enemies++;
    if (unit.tags.includes('cavalry')) enemyCavalry++;
    if (unit.tags.includes('infantry')) enemyInfantry++;
    if (unit.tags.includes('ranged') || unit.tags.includes('artillery')) enemyRanged++;
    if (unit.tags.includes('anti-cavalry')) enemyPikes++;
  }
  const enemyShare = (count: number, weight: number) => Math.trunc((count * weight) / Math.max(1, enemies));
  const demand: Record<CombatRole, number> = {
    melee: 18,
    antiCavalry: 12 + enemyShare(enemyCavalry, 45),
    ranged: 35 + enemyShare(enemyInfantry, 15),
    cavalry: Math.max(5, 20 + enemyShare(enemyRanged, 25) - enemyShare(enemyPikes, 30)),
    siege: 15 + Math.min(20, enemyBuildings * 4),
  };
  const totalDemand = Object.values(demand).reduce((sum, weight) => sum + weight, 0);
  const supportLimit = Math.min(4, Math.trunc(combatCount / 6));
  let choice: string | undefined,
    bestScore = -Infinity;
  // Content order is not a tie breaker: saves and shuffled observations choose the same ID.
  const legal = [...production]
    .sort()
    .map((id) => unitById.get(id))
    .filter(
      (unit): unit is UnitDefinition =>
        !!unit &&
        unit.age <= player.age &&
        player.population + unit.population <= player.populationCap &&
        Object.entries(unit.cost).every(
          ([resource, amount]) => player.resources[resource as keyof typeof unit.cost] >= amount,
        ),
    );
  for (const unit of legal) {
    const id = unit.id,
      role = combatRole(unit);
    // Retain older counter roles, but replace bows with rifles when they are affordable.
    if (role && legal.some((other) => other.age > unit.age && combatRole(other) === role)) continue;
    const existing = counts.get(id) ?? 0;
    let score = unit.age * 60 - existing * 24;
    if (unit.tags.includes('support')) {
      const limit =
        id === 'commander'
          ? Number(combatCount >= 12)
          : id === 'engineer'
            ? Math.min(2, siegeCount)
            : Math.min(3, 1 + Math.trunc(combatCount / 18));
      if (supportCount >= supportLimit || existing >= limit) continue;
      score =
        (id === 'medic' ? 140 + combatCount * 2 : id === 'engineer' ? 100 + population.siege * 3 : 120) -
        existing * 100;
    } else {
      if (role) score += demand[role] * (combatPopulation + 10) - population[role] * totalDemand;
      if (unit.tags.includes('siege')) score += Math.min(300, enemyBuildings * 50);
      if (unit.tags.includes('blast')) score += enemyShare(enemyInfantry, 50);
    }
    if (score > bestScore) {
      choice = id;
      bestScore = score;
    }
  }
  return choice;
}
