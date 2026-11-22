# Nested subassemblies

Open **Сборка** and use **Подсборки → Добавить подсборку** in the properties pane. Leave the parent at **Корень сборки** for a top-level subassembly, or choose another subassembly. Enter translation in millimeters and XYZ Euler rotation in degrees, relative to the parent's coordinate system. Build the hierarchy by assigning parent subassemblies to other subassemblies and to detail occurrences.

Each row shows its path and world position. Editing a parent pose moves its free descendants and propagates any movement through their fixed mates. Changing the parent of an existing subassembly or occurrence recomputes its local coordinates to preserve its world placement. A user can then edit the recomputed local coordinates before confirming. The source body's geometry and placements of unrelated occurrences are independent.

Undo and Redo cover subassembly creation, modification, reparenting and removal together with the rest of the model scene. Documents save in schema 22. Older documents open with existing occurrence placement and fixed mates intact. Invalid hierarchies are rejected on import, including missing parents, cycles, duplicate IDs and world positions outside ±1,000,000 mm per axis.

The editor supports up to 100 subassemblies and 100 occurrences per document. Move or remove a subassembly's children before deleting it. Subassemblies are local to the document and represent rigid placements of existing exact-body occurrences.

## Fixed mates across subassemblies

In **Сборка**, open **Фиксированное сопряжение**. Choose a leader and a follower from the same document. The occurrences can be at the root or belong to different subassemblies. The follower list excludes occurrences already driven by a mate and pairs that would form a cycle. Confirming preserves both occurrences’ world poses.

A mated follower takes its world pose from its leader and the stored relative transform. Moving the leader or its parent moves the follower. Moving the follower’s parent alone leaves the follower in place. If both occurrences share the same parent, moving that parent carries both occurrences together.

Detach the mates involving an occurrence before changing that occurrence’s parent individually. Detaching preserves the solved world pose and stores it in the current parent’s local coordinates. Undo restores the mate.

## Distance mates

In **Сборка**, open **Фиксированное сопряжение** and set **Тип сопряжения** to **По расстоянию**. Choose the leading and following occurrences and enter the desired distance in millimeters between their coordinate origins. The follower moves along its captured direction in the leader’s frame and keeps its relative orientation. Coincident origins use the leader’s positive X direction. A distance of zero puts the origins at the same point.

Use **Изменить расстояние** on the follower row to change the target. An edit that would violate the placement limits leaves the assembly unchanged. A distance mate participates in the same dependency graph as a fixed mate, including across subassemblies. Undo restores the previous distance or attachment. Detaching retains the solved pose. This command drives origin-to-origin placement with fixed bearing and orientation. Face and edge references and free degrees of freedom require separate mate types.

## Angular mates

In **Сборка**, open **Фиксированное сопряжение**, choose **Угловое** in **Тип сопряжения**, and select the occurrences. Enter a signed angle from −180° through +180°. The angle runs from the leader’s local +X axis to the projection of the follower’s +X axis onto the leader’s XY plane. Positive angles follow the right-hand rule around the leader’s +Z axis.

The follower keeps its position, tilt and roll relative to the leader while the projected heading changes. If its +X axis is parallel to the leader’s Z axis, rotate the follower to obtain a defined projection before creating the mate. Edit the target through **Изменить угол** on the follower row. The mate travels with the leader, persists in schema 22 and supports Undo and pose-preserving detachment.

## Planar face coincidence

In **Сборка**, open the mate dialog and choose **Совмещение плоских граней**. Select the leader and follower occurrences, then choose their planar faces from the exact OCCT catalog. Each label shows the native face number, body-local outward normal and plane point. Curved faces are excluded from the lists.

The solver aligns the outward normals in opposition with the minimum rotation and translates the follower along the leader normal to close the gap. The follower origin retains its in-plane coordinates in the leader frame. After confirmation the assembly dependency keeps that relative transform. This mate aligns supporting planes even when their trimmed face areas do not overlap.

Native schema 22 records each reference's occurrence ID, source body ID, face index and SHA-256 digest of its exact BRep, alongside the solved relative transform. Opening an explicit native JSON file revalidates both face ordinals and the saved transform with OCCT before opening a tab. Automatic workspace recovery verifies the saved native structure and the exact snapshot digests synchronously. Source geometry changes or a source swap are rejected while they would invalidate a surviving plane mate. Detach it first to edit the source. Deleting an endpoint removes its mates, retaining the solved position of a surviving follower. Undo/Redo restores the entire edit atomically.
