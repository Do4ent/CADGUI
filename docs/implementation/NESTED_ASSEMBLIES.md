# Nested subassemblies

Open **Сборка** and use **Подсборки → Добавить подсборку** in the properties pane. Leave the parent at **Корень сборки** for a top-level subassembly, or choose another subassembly. Enter translation in millimeters and XYZ Euler rotation in degrees, relative to the parent's coordinate system. Build the hierarchy by assigning parent subassemblies to other subassemblies and to detail occurrences.

Each row shows its path and world position. Editing a parent pose moves its descendants as a rigid assembly. Changing the parent of an existing subassembly or occurrence recomputes its local coordinates to preserve its world placement. A user can then edit the recomputed local coordinates before confirming. The source body's geometry and placements of unrelated occurrences are independent.

Undo and Redo cover subassembly creation, modification, reparenting and removal together with the rest of the model scene. Documents save in schema 17. Older schemas open with existing occurrence placement and fixed mates intact. Invalid hierarchies are rejected on import, including missing parents, cycles, duplicate IDs and world positions outside ±1,000,000 mm per axis.

The editor supports up to 100 subassemblies and 100 occurrences per document. Move or remove a subassembly's children before deleting it. Fixed mates apply to root occurrences. Detach existing mates before moving either endpoint into a subassembly. Subassemblies are local to the document and represent rigid placements of existing exact-body occurrences.
