import type { GameplayEvent, RuntimeState, Scene } from "./core";

export function stepGameplay(scene: Scene, state: RuntimeState, events: GameplayEvent[], hooks: { playSound: (id: string) => void; restart: () => void }) {
  for (const event of events) for (const rule of scene.gameplay?.rules ?? []) {
    if (rule.event !== event.type || (rule.event === "ui_event" && rule.eventName !== event.name) || (rule.targetId && rule.targetId !== event.entityId) || (rule.once && state.firedRules[rule.id])) continue;
    for (const command of rule.commands) {
      if (command.type === "add_score") state.score += command.amount;
      else if (command.type === "set_variable") state.variables[command.key] = command.value;
      else if (command.type === "add_variable") state.variables[command.key] = (typeof state.variables[command.key] === "number" ? state.variables[command.key] as number : 0) + command.amount;
      else if (command.type === "set_ui_text") { const el = scene.ui?.find(item => item.id === command.targetId); if (el) el.text = command.text; }
      else if (command.type === "set_ui_visible") { const el = scene.ui?.find(item => item.id === command.targetId); if (el) el.visible = command.visible; }
      else if (command.type === "set_entity_visible") { const entity = scene.entities.find(item => item.id === command.targetId); if (entity) entity.visible = command.visible; }
      else if (command.type === "play_sound") hooks.playSound(command.audioId);
      else if (command.type === "restart") hooks.restart();
      else if (command.type === "win") state.win = true;
    }
    if (rule.once) state.firedRules[rule.id] = true;
  }
}
