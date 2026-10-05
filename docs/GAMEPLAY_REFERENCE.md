# Gameplay content reference

Generated from validated content version 5. Do not edit by hand.

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
| Coastal Trade        |   2 | 60 timber · 120 coin                               | Markets produce 20% more Coin.                         |
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
