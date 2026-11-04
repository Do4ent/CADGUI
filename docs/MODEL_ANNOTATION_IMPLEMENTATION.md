# 3D model annotations — stage A

## Delivered scope

The modeling workspace has a native visual-note layer, separate from Drawing. Create notes from the model/assembly/view Ribbon, command search (`model-note`), viewport context menu or the **Аннотации модели** property panel. Select a label in the scene or panel to edit, duplicate, hide or delete it.

The editor supports literal multiline Unicode text, world anchors or component-relative points, an independent world-space label offset, leader visibility, color, font size and camera-facing or XY/XZ/YZ label planes. OK and Apply validate before committing; Cancel leaves the document unchanged. Apply refreshes the draft baseline. Drafts opened before another scene/annotation change are rejected instead of overwriting newer work.

Coordinates and font sizes use the prototype scene's conditional units. A camera-facing label retains a world-space font size; it is not a fixed-pixel HUD. Component anchors follow the component's translation only: the local anchor point is added to the current component position, without scaling by component size. This release does not provide face/edge picking, geometric measurements, driving dimensions, GD&T authoring or semantic PMI exchange.

## Source and display behavior

Moving a component recomputes its note's position without rewriting the annotation. Hiding the component hides the attached label. Deleting it preserves the annotation and reference, reports **Источник отсутствует** in the panel and omits the misleading scene label. Edit the component reference to repair the link.

Labels use local browser fonts through transformed HTML, not external font downloads. Leaders/markers use ordinary WebGL depth testing; HTML labels use opaque-mesh ray occlusion. Section views omit a note if its anchor or label center is cut away. This endpoint/raycast policy is a visual presentation rule, not exact visibility or topology analysis. Fixed-plane labels can become edge-on or face away when the camera rotates.

## Persistence and history

Document schema v3 adds `modelAnnotations: {version: 1, annotations: [...]}`. Files v1/v2 migrate to an empty note collection without changing drawing content or components. Old clean/dirty workspace fingerprints migrate without discarding unsaved changes. Future annotation/document versions, unknown annotation fields, duplicate IDs, invalid coordinates/styles and resolved-coordinate overflow are rejected before persistence.

Model edits and note edits share a chronological scene history containing both components and annotations. Drawing history remains separate. Undo/Redo and dirty markers belong to each document tab; in-session history is not persisted across browser reload. Save/open and browser recovery retain notes and references. Stale callbacks check the originating tab, component revision and annotation revision.

## Verification

Module tests cover strict schema validation, detached clones, immutable operations, movement/missing/hidden sources, coordinate overflow, migration/dirty markers, interleaved scene-note history, stale writes and independent drawing history. Renderer tests cover literal text, plane normals, clipping and occluder filtering. Browser coverage exercises actual create/edit/cancel/save/reload, document isolation, orientations/themes, component movement/deletion/rebinding and safe note deletion.

The research catalog [MODEL_ANNOTATION_TOOLKIT](MODEL_ANNOTATION_TOOLKIT.md) remains a specification of 133 proposed capabilities. This release implements a bounded first stage; it does not claim all catalog entries or standards compliance.
