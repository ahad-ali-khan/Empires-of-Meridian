# Gameplay content reference

Generated from validated content version 8. Do not edit by hand.

## Units

| ID           | Name              | Age |
| ------------ | ----------------- | --: |
| worker       | Frontier Worker   |   1 |
| explorer     | Frontier Explorer |   1 |
| militia      | Militia           |   1 |
| spearman     | Levy Spearman     |   1 |
| archer       | Bow Archer        |   1 |
| swordsman    | Swordsman         |   2 |
| shieldBearer | Shield Bearer     |   2 |
| lightRider   | Light Rider       |   2 |
| mountedScout | Mounted Scout     |   2 |
| ramWagon     | Ram Wagon         |   2 |
| pikeman      | Long Pike         |   3 |
| crossbow     | Crossbow Guard    |   3 |
| cavalry      | League Lancer     |   3 |
| cannon       | Field Cannon      |   3 |
| veteranRifle | Veteran Rifle     |   4 |
| grenadier    | Grenadier         |   4 |
| marksman     | Marksman          |   4 |
| skirmisher   | Skirmisher        |   4 |
| dragoon      | Dragoon           |   4 |
| cuirassRider | Cuirass Rider     |   4 |
| howitzer     | Howitzer          |   4 |
| mortar       | Mortar            |   4 |
| rocketCart   | Rocket Cart       |   4 |
| medic        | Field Medic       |   3 |
| engineer     | Engineer          |   4 |
| commander    | Field Commander   |   4 |

## Buildings

| ID            | Name             | Age |
| ------------- | ---------------- | --: |
| hall          | Charter Hall     |   1 |
| house         | Harbor Residence |   1 |
| lumberPost    | Lumber Post      |   1 |
| miningPost    | Mining Post      |   2 |
| silo          | Grain Silo       |   2 |
| barracks      | Barracks         |   1 |
| stable        | Stable           |   2 |
| workshop      | Artillery Works  |   3 |
| market        | Exchange House   |   2 |
| tradePost     | Trade Post       |   2 |
| tower         | Coastal Watch    |   2 |
| wall          | Wall             |   2 |
| gate          | Gate             |   2 |
| fort          | Aurelian Fort    |   3 |
| farm          | Farm             |   2 |
| archery       | Archery Range    |   2 |
| dock          | Harbor Dock      |   2 |
| arsenal       | Arsenal          |   3 |
| academy       | Academy          |   3 |
| temple        | Civic Sanctuary  |   2 |
| embassy       | Alliance Embassy |   3 |
| mercenaryHall | Contract Hall    |   3 |
| factory       | Engine Factory   |   4 |
| estate        | Orchard Estate   |   3 |
| fishery       | Shore Fishery    |   1 |
| landmark      | Meridian Beacon  |   3 |

## Council advancement

| Council              | Age | Immediate delivery                                 | Permanent effect                                       |
| -------------------- | --: | -------------------------------------------------- | ------------------------------------------------------ |
| Harvest Council      |   2 | 120 provisions · 80 timber                         | Workers gather 25% faster.                             |
| Charter Guard        |   2 | 50 provisions · 50 coin · 50 metal                 | Military units deal 10% more damage.                   |
| Coastal Trade        |   2 | 60 timber · 120 coin                               | Market Coin and trade-site income increase by 20%.     |
| Guild Council        |   3 | 90 provisions · 90 timber · 90 coin                | Unit training progresses 25% faster.                   |
| Bastion Council      |   3 | 80 timber · 140 metal                              | Buildings take 15% less damage.                        |
| Field Command        |   3 | 80 provisions · 80 coin · 80 metal                 | Military units deal 10% more damage.                   |
| Industrial Guilds    |   4 | 100 provisions · 120 timber · 140 coin · 100 metal | Unit training and construction progress twice as fast. |
| Industrial Logistics |   4 | 180 provisions · 100 timber · 80 coin · 80 metal   | Workers carry 50% more resources.                      |
| Artillery Board      |   4 | 60 provisions · 60 timber · 120 coin · 180 metal   | Artillery deals 20% more damage.                       |

Advancement requires a completed central hall and pauses without one. Only one council can be chosen for each advancement. Repeated identical modifiers are not stacked. Different modifiers add within their rate group; military and artillery groups apply in order, then building damage resistance, with integer rounding at each damage stage.

- Age 2: 30s; 500 provisions · 300 timber.
- Age 3: 30s; 700 provisions · 400 timber · 250 coin · 150 metal.
- Age 4: 30s; 900 provisions · 600 timber · 500 coin · 400 metal.

## Contextual and queued orders

Right-click selects a contextual order. Hold Shift to append rather than replace; each unit has at most 32 pending orders. Stop clears queued orders and active directives. Active harvesting runs until the local resource work finishes; a queued move does not interrupt each carry/deposit trip. Permanent patrol and guard orders require Stop or a replacement order before later queued orders can run. Missing or newly hidden targets are skipped with feedback at activation. Failed movement releases the active order after ten failed recovery intervals, permitting the next queued order. Queued commands remain private to their owner.

- Attack-move (T): engage visible enemies along the route, then resume toward the destination. Pursuit is bounded; fleeing enemies are temporarily ignored after exceeding the pursuit limit.
- Patrol (P): travel between the starting point and destination, engaging nearby enemies and resuming the current leg afterwards.
- Guard (G): follow and defend a friendly unit or building; stop guarding if that target dies or enters a garrison.
- Heal (H): medics approach injured friendly living units and treat them on fixed simulation ticks. Idle medics seek nearby injured friendlies. Machines cannot be healed; worker repairs handle buildings separately.
- Escape cancels targeting; WASD continues to control the camera. Selection shows the active order and pending order list.

- Field Medic: Restore 5 health per second to a nearby friendly living unit. Cannot heal machines or revive the dead. Range 3 world units; interval 1s.

## Trade and frontier objectives

- Completed markets buy 100 Provisions, Timber or Metal for 130 Coin; selling the same lot returns 80 Coin. Invalid exchanges never spend resources.
- Markets improve nearby gathering by 20% within 20 world units. Fractional work is retained rather than rounded away each tick.
- Right-click a neutral or opposing trade site with units to claim it at its boundary. One unit takes 10s; up to three contributors accelerate capture. Opposing nearby units contest capture and pause payouts.
- Captured sites pay 20 of the selected resource every 10s. Nearby completed markets, player-built trade depots and commerce council/research bonuses add to this rate; identical structures do not stack. The selection panel shows the actual current payout.
- Right-click treasures with an explorer. Living linked guards must be defeated before the 3s collection completes. Rewards are delivered once.
- Explorers become incapacitated at zero health and retain their population reservation. A living ally can approach and rescue them in 5s. Unthreatened territory near a completed hall or fort permits 30s recovery. Paid return costs 100 Coin and requires a completed hall and a clear spawn position. All recoveries restore half health.

| Treasure          | Guards | Resources                 | Renown |
| ----------------- | -----: | ------------------------- | -----: |
| Pioneer Cache     |      0 | 80 provisions · 60 timber |      1 |
| Frontier Paychest |      2 | 100 coin · 30 metal       |      2 |
| Survey Folio      |      1 | 50 provisions             |      5 |

Neutral sites and caches are generated with footprint and reachability checks. Static fog memory retains last-observed sites and treasures; hidden changes are revealed only when revisited. Site ownership, selected income, disputes, recovery and partial interaction work persist in saves. Moving trade convoys, neutral alliance contracts and trade-dominance victory are future work.

## Research and production

Research and unit training share a first-in, first-out building queue. Costs are reserved at ordering. Cancel a job before it starts for a full refund; after work starts, half its cost is refunded. Cancellation releases reserved population. Destroying a building loses its queue without refunds. Research is once per player; prerequisites must be completed before ordering. Training bonuses do not accelerate research. Council and research rate bonuses add within each modifier group.

| Technology         | Building | Age | Time | Cost                            | Effect                                                                            | Prerequisites  |
| ------------------ | -------- | --: | ---: | ------------------------------- | --------------------------------------------------------------------------------- | -------------- |
| Forged Blades      | barracks |   2 |  25s | 100 provisions · 50 metal       | Existing and future Militia become Swordsmen, preserving their health percentage. | None           |
| Improved Tools     | hall     |   1 |  20s | 50 provisions · 50 timber       | Workers gather 25% faster.                                                        | None           |
| Carrying Packs     | hall     |   2 |  20s | 75 provisions · 50 timber       | Workers carry 50% more resources.                                                 | improved-tools |
| Formation Drills   | barracks |   2 |  25s | 100 provisions · 50 coin        | Unit training progresses 25% faster.                                              | None           |
| Tempered Arms      | barracks |   2 |  25s | 50 timber · 50 coin · 50 metal  | Military units deal 10% more damage.                                              | None           |
| Reinforced Masonry | hall     |   3 |  30s | 100 timber · 50 coin · 50 metal | Buildings take 15% less damage.                                                   | None           |
| Trade Ledgers      | market   |   2 |  25s | 75 timber · 75 coin             | Market Coin and trade-site income increase by 20%.                                | None           |

## Dispatches

All starter cards are once per match. Cancellation before departure refunds the reserved tokens. Departures occur after 5 seconds. Deliveries wait for a completed owned central hall or fort, population capacity, and clear spawn positions.

| ID         | Name                   | Age | Tokens | Arrival | Delivery                             |
| ---------- | ---------------------- | --: | -----: | ------: | ------------------------------------ |
| charter-1  | Provision Convoy       |   1 |      1 |     25s | 150 provisions                       |
| charter-2  | Timber Charter         |   1 |      1 |     25s | 150 timber                           |
| charter-3  | Coin Credit            |   1 |      1 |     25s | 120 coin                             |
| charter-4  | Metalwrights           |   1 |      1 |     25s | 100 metal                            |
| charter-5  | Worker Party           |   1 |      1 |     25s | 2 Frontier Worker                    |
| charter-6  | Militia Detail         |   1 |      1 |     25s | 3 Militia                            |
| charter-7  | Frontier Supplies      |   1 |      1 |     25s | 80 provisions · 80 timber            |
| charter-8  | Spear Escort           |   1 |      1 |     25s | 3 Levy Spearman                      |
| charter-9  | Bow Detachment         |   1 |      1 |     25s | 3 Bow Archer                         |
| charter-10 | Surveyor Supplies      |   1 |      1 |     25s | 40 provisions · 50 timber · 40 coin  |
| charter-11 | Settlement Stores      |   2 |      1 |     30s | 200 provisions · 120 timber          |
| charter-12 | Sword Company          |   2 |      1 |     30s | 3 Swordsman                          |
| charter-13 | Shield Escort          |   2 |      1 |     30s | 3 Shield Bearer                      |
| charter-14 | Light Riders           |   2 |      1 |     30s | 2 Light Rider                        |
| charter-15 | Mounted Reconnaissance |   2 |      1 |     30s | 2 Mounted Scout                      |
| charter-16 | Ram Reinforcement      |   2 |      1 |     30s | 1 Ram Wagon                          |
| charter-17 | Guild Materials        |   2 |      1 |     30s | 160 timber · 80 coin · 80 metal      |
| charter-18 | Settler Expedition     |   2 |      1 |     30s | 60 provisions · 3 Frontier Worker    |
| charter-19 | Pike Reserve           |   3 |      2 |     35s | 5 Long Pike                          |
| charter-20 | Crossbow Reserve       |   3 |      2 |     35s | 5 Crossbow Guard                     |
| charter-21 | Lancer Squadron        |   3 |      2 |     35s | 3 League Lancer                      |
| charter-22 | Field Battery          |   3 |      2 |     35s | 1 Field Cannon                       |
| charter-23 | Fortification Stores   |   3 |      2 |     35s | 220 timber · 180 metal               |
| charter-24 | League Treasury        |   3 |      2 |     35s | 100 provisions · 220 coin · 80 metal |
