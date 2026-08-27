import { KIND_PRESETS, uid, type Entity, type EntityKind, type Scene } from "./core";

export type AuthoringEntityPatch = {
  name?: string; tags?: string[]; x?: number; y?: number; w?: number; h?: number; color?: string;
  solid?: boolean; gravity?: boolean; controllable?: boolean; collectible?: boolean; hazard?: boolean; goal?: boolean;
  visible?: boolean; opacity?: number; value?: number; z?: number; rotation?: number; scaleX?: number; scaleY?: number;
  bodyType?: "static" | "dynamic" | "kinematic"; mass?: number; friction?: number; restitution?: number;
  collisionShape?: "rectangle" | "circle"; collisionLayer?: number; collisionMask?: number; isTrigger?: boolean;
};

export type AuthoringOperation =
  | { type: "create_entity"; entity: { kind: EntityKind; name: string; x: number; y: number; w: number; h: number; color: string; tags: string[]; groupId: string | null }; patch?: AuthoringEntityPatch }
  | { type: "update_entity"; targetId: string; patch: AuthoringEntityPatch }
  | { type: "configure_behavior"; targetId: string; behavior: "moving" | "crumble" | "spring" | "patrol" | "powerup" | "switch" | "door"; enabled: boolean; config: { axis?: "x" | "y"; range?: number; speed?: number; delay?: number; respawn?: number; force?: number; ledgeSafe?: boolean; powerup?: "speed" | "djump" | "invuln"; switchId?: string; doorId?: string } }
  | { type: "delete_entity"; targetId: string }
  | { type: "move_entity"; targetId: string; groupId: string | null }
  | { type: "create_group"; name: string; parentId: string | null }
  | { type: "update_group"; targetId: string; name: string; parentId: string | null }
  | { type: "delete_group"; targetId: string }
  | { type: "update_scene"; patch: { name?: string; bg?: string; gravity?: number; width?: number; height?: number; cameraMode?: "follow-player" | "fixed"; cameraX?: number; cameraY?: number; cameraDeadZone?: number } };

export type AuthoringPlan = { summary: string; assumptions: string[]; operations: AuthoringOperation[]; model?: string };

export type AuthoringContext = {
  scene: { id: string; name: string; width: number; height: number; gravity: number; background: string; camera: Scene["camera"] };
  groups: Array<{ id: string; name: string; parentId: string | null }>;
  entities: Array<{ id: string; name: string; kind: EntityKind; x: number; y: number; w: number; h: number; tags: string[]; groupId: string | null; flags: string[] }>;
};

export function makeAuthoringContext(scene: Scene): AuthoringContext {
  return {
    scene: { id: scene.id, name: scene.name, width: scene.width, height: scene.height, gravity: scene.gravity, background: scene.bg, camera: scene.camera },
    groups: (scene.hierarchy?.groups ?? []).map(group => ({ id: group.id, name: group.name, parentId: group.parentId ?? null })),
    entities: scene.entities.map(entity => ({
      id: entity.id, name: entity.name?.trim() || entity.kind, kind: entity.kind, x: entity.x, y: entity.y, w: entity.w, h: entity.h,
      tags: entity.tags ?? [], groupId: entity.parentGroupId ?? null,
      flags: [entity.solid && "solid", entity.gravity && "gravity", entity.controllable && "controllable", entity.collectible && "collectible", entity.hazard && "hazard", entity.goal && "goal"].filter(Boolean) as string[],
    })),
  };
}

const finite = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const text = (value: unknown, fallback: string, max = 80) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
const booleanKeys = ["solid", "gravity", "controllable", "collectible", "hazard", "goal", "visible", "isTrigger"] as const;

function applyEntityPatch(entity: Entity, patch: AuthoringEntityPatch, scene: Scene): Entity {
  const next: Entity = { ...entity };
  next.name = text(patch.name, entity.name?.trim() || entity.kind);
  if (Array.isArray(patch.tags)) next.tags = [...new Set(patch.tags.map(tag => text(tag, "", 32)).filter(Boolean))].slice(0, 12);
  next.x = finite(patch.x, entity.x, -scene.width, scene.width * 2);
  next.y = finite(patch.y, entity.y, -scene.height, scene.height * 2);
  next.w = finite(patch.w, entity.w, 4, scene.width * 2);
  next.h = finite(patch.h, entity.h, 4, scene.height * 2);
  next.color = /^#[0-9a-f]{6}$/i.test(patch.color ?? "") ? patch.color! : entity.color;
  next.value = finite(patch.value, entity.value ?? 0, -100000, 100000);
  next.opacity = finite(patch.opacity, entity.opacity ?? 1, 0, 1);
  next.z = finite(patch.z, entity.z ?? 0, -1000, 1000);
  next.rotation = finite(patch.rotation, entity.rotation ?? 0, -3600, 3600);
  next.scaleX = finite(patch.scaleX, entity.scaleX ?? 1, 0.05, 10);
  next.scaleY = finite(patch.scaleY, entity.scaleY ?? 1, 0.05, 10);
  next.mass = finite(patch.mass, entity.mass ?? 1, 0.1, 10);
  next.friction = finite(patch.friction, entity.friction ?? 0.8, 0, 1);
  next.restitution = finite(patch.restitution, entity.restitution ?? 0, 0, 1);
  next.collisionLayer = finite(patch.collisionLayer, entity.collisionLayer ?? 1, 0, 15);
  next.collisionMask = finite(patch.collisionMask, entity.collisionMask ?? 15, 0, 15);
  if (patch.bodyType === "static" || patch.bodyType === "dynamic" || patch.bodyType === "kinematic") next.bodyType = patch.bodyType;
  if (patch.collisionShape === "rectangle" || patch.collisionShape === "circle") next.collisionShape = patch.collisionShape;
  for (const key of booleanKeys) if (typeof patch[key] === "boolean") next[key] = patch[key] as never;
  return next;
}

export function applyAuthoringPlan(scene: Scene, plan: AuthoringPlan): { scene: Scene; applied: number; skipped: number } {
  let next: Scene = JSON.parse(JSON.stringify(scene));
  let applied = 0;
  let skipped = 0;
  const hasGroup = (id: string | null) => id === null || (next.hierarchy?.groups ?? []).some(group => group.id === id);
  for (const operation of plan.operations ?? []) {
    if (operation.type === "create_entity") {
      const spec = operation.entity;
      if (!KIND_PRESETS[spec?.kind] || !hasGroup(spec.groupId ?? null)) { skipped++; continue; }
      const base = KIND_PRESETS[spec.kind];
      const entity = applyEntityPatch({ ...base, id: uid(), name: text(spec.name, spec.kind), x: finite(spec.x, 0, -next.width, next.width * 2), y: finite(spec.y, 0, -next.height, next.height * 2), w: finite(spec.w, base.w, 4, next.width * 2), h: finite(spec.h, base.h, 4, next.height * 2), color: /^#[0-9a-f]{6}$/i.test(spec.color) ? spec.color : base.color, tags: Array.isArray(spec.tags) ? spec.tags : [], parentGroupId: spec.groupId ?? null, hierarchyOrder: next.entities.length }, operation.patch ?? {}, next);
      next.entities.push(entity); applied++; continue;
    }
    if (operation.type === "update_entity") {
      const entity = next.entities.find(item => item.id === operation.targetId);
      if (!entity) { skipped++; continue; }
      next.entities = next.entities.map(item => item.id === operation.targetId ? applyEntityPatch(item, operation.patch ?? {}, next) : item); applied++; continue;
    }
    if (operation.type === "configure_behavior") {
      const entity = next.entities.find(item => item.id === operation.targetId);
      if (!entity) { skipped++; continue; }
      const config = operation.config ?? {};
      next.entities = next.entities.map(item => {
        if (item.id !== operation.targetId) return item;
        if (operation.behavior === "moving") return { ...item, moving: operation.enabled ? { axis: config.axis === "y" ? "y" : "x", range: finite(config.range, 120, 0, 2000), speed: finite(config.speed, 80, 0, 1500) } : null };
        if (operation.behavior === "crumble") return { ...item, crumble: operation.enabled ? { delay: finite(config.delay, 400, 0, 10000), respawn: finite(config.respawn, 1500, 0, 20000) } : null };
        if (operation.behavior === "spring") return { ...item, spring: operation.enabled ? { force: finite(config.force, 520, 10, 2500) } : null };
        if (operation.behavior === "patrol") return { ...item, patrol: operation.enabled ? { range: finite(config.range, 160, 0, 2000), ledgeSafe: Boolean(config.ledgeSafe) } : null };
        if (operation.behavior === "powerup") return { ...item, powerup: operation.enabled ? (config.powerup === "djump" || config.powerup === "invuln" ? config.powerup : "speed") : null };
        if (operation.behavior === "switch") return { ...item, switchId: operation.enabled ? text(config.switchId, "switch", 48) : undefined };
        return { ...item, doorId: operation.enabled ? text(config.doorId, "door", 48) : undefined };
      }); applied++; continue;
    }
    if (operation.type === "delete_entity") {
      const before = next.entities.length; next.entities = next.entities.filter(item => item.id !== operation.targetId);
      before === next.entities.length ? skipped++ : applied++; continue;
    }
    if (operation.type === "move_entity") {
      if (!hasGroup(operation.groupId ?? null) || !next.entities.some(item => item.id === operation.targetId)) { skipped++; continue; }
      next.entities = next.entities.map(item => item.id === operation.targetId ? { ...item, parentGroupId: operation.groupId ?? null } : item); applied++; continue;
    }
    if (operation.type === "create_group") {
      if (!hasGroup(operation.parentId ?? null)) { skipped++; continue; }
      const groups = next.hierarchy?.groups ?? [];
      next.hierarchy = { groups: [...groups, { id: uid(), name: text(operation.name, `Grupo ${groups.length + 1}`), parentId: operation.parentId ?? null, order: groups.length, collapsed: false }] }; applied++; continue;
    }
    if (operation.type === "update_group") {
      const groups = next.hierarchy?.groups ?? [];
      const found = groups.some(group => group.id === operation.targetId);
      const validParent = operation.parentId === null || (operation.parentId !== operation.targetId && groups.some(group => group.id === operation.parentId));
      if (!found || !validParent) { skipped++; continue; }
      next.hierarchy = { groups: groups.map(group => group.id === operation.targetId ? { ...group, name: text(operation.name, group.name), parentId: operation.parentId } : group) }; applied++; continue;
    }
    if (operation.type === "delete_group") {
      const groups = next.hierarchy?.groups ?? [];
      const group = groups.find(item => item.id === operation.targetId);
      if (!group) { skipped++; continue; }
      next.hierarchy = { groups: groups.filter(item => item.id !== group.id).map(item => item.parentId === group.id ? { ...item, parentId: group.parentId ?? null } : item) };
      next.entities = next.entities.map(entity => entity.parentGroupId === group.id ? { ...entity, parentGroupId: group.parentId ?? null } : entity); applied++; continue;
    }
    if (operation.type === "update_scene") {
      const patch = operation.patch ?? {};
      next = { ...next, name: text(patch.name, next.name), bg: /^#[0-9a-f]{6}$/i.test(patch.bg ?? "") ? patch.bg! : next.bg, gravity: finite(patch.gravity, next.gravity, 0, 4000), width: finite(patch.width, next.width, 200, 5000), height: finite(patch.height, next.height, 200, 5000), camera: { ...next.camera, mode: patch.cameraMode === "fixed" || patch.cameraMode === "follow-player" ? patch.cameraMode : next.camera?.mode, x: finite(patch.cameraX, next.camera?.x ?? 0, 0, next.width), y: finite(patch.cameraY, next.camera?.y ?? 0, 0, next.height), deadZone: finite(patch.cameraDeadZone, next.camera?.deadZone ?? 0, 0, 1000) } }; applied++; continue;
    }
    skipped++;
  }
  return { scene: next, applied, skipped };
}
