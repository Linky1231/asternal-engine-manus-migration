import { createHash, randomUUID } from "node:crypto";
import { isModeratorForUser } from "./manus-admin";
import { createManusRecord, deleteOwnManusRecord, getOwnManusRecord, getVisibleManusRecord, listOwnManusRecords, listPublicManusRecords, updateOwnManusRecord } from "./manus-records";

type EventStatus = "upcoming" | "active" | "completed";
type EventData = Record<string, unknown>;

function cleanId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new Error(`${label} no es válido.`);
  return value;
}

function cleanText(value: unknown, label: string, max: number, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${label} es obligatorio.`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${label} no es válido.`);
  const text = value.trim().slice(0, max);
  if (required && !text) throw new Error(`${label} es obligatorio.`);
  return text || null;
}

function cleanDate(value: unknown, label: string) {
  if (typeof value !== "string" || !Number.isFinite(new Date(value).getTime())) throw new Error(`${label} no es válida.`);
  return new Date(value).toISOString();
}

function asObject(value: unknown): EventData {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value as EventData } : {};
}

function recordId(prefix: string, ...parts: string[]) {
  return `${prefix}_${createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 60)}`;
}

async function assertStaff(openId: string) {
  if (!(await isModeratorForUser(openId))) throw new Error("Solo la moderación puede administrar eventos.");
}

async function findPublicEvent(rawId: unknown) {
  const id = cleanId(rawId, "El evento");
  const record = await getVisibleManusRecord(null, id);
  if (!record || record.collection !== "events") throw new Error("El evento no existe.");
  return record;
}

function eventStatus(data: EventData): EventStatus {
  const status = data.status;
  return status === "upcoming" || status === "active" || status === "completed" ? status : "upcoming";
}

function toEvent(record: Awaited<ReturnType<typeof findPublicEvent>>, input: { submissionCount: number; participantCount: number; mine?: { registered: boolean; submission: { id: string; post_id: string; status: string } | null } }): EventData {
  const data = asObject(record.data);
  return {
    id: record.id,
    title: data.title ?? "Evento",
    description: data.description ?? "",
    banner_url: data.banner_url ?? null,
    starts_at: data.starts_at ?? record.createdAt.toISOString(),
    ends_at: data.ends_at ?? record.createdAt.toISOString(),
    prize_pool: data.prize_pool ?? null,
    prize_description: data.prize_description ?? null,
    rules: data.rules ?? null,
    status: eventStatus(data),
    created_by: record.ownerOpenId,
    created_at: record.createdAt.toISOString(),
    submission_count: input.submissionCount,
    participant_count: input.participantCount,
    my_registered: input.mine?.registered ?? false,
    my_submission: input.mine?.submission ?? null,
  };
}

export async function listEventsForUser(openId: string | null) {
  const [events, submissions, participants, mineSubs, mineParticipants] = await Promise.all([
    listPublicManusRecords("events"),
    listPublicManusRecords("event_submissions"),
    listPublicManusRecords("event_participants"),
    openId ? listOwnManusRecords(openId, "event_submissions") : Promise.resolve([]),
    openId ? listOwnManusRecords(openId, "event_participants") : Promise.resolve([]),
  ]);
  return events.map(event => {
    const submissionsForEvent = submissions.filter(row => row.data.event_id === event.id);
    const participantsForEvent = participants.filter(row => row.data.event_id === event.id);
    const mySubmission = mineSubs.find(row => row.data.event_id === event.id);
    const myRegistered = mineParticipants.some(row => row.data.event_id === event.id);
    return toEvent(event as Awaited<ReturnType<typeof findPublicEvent>>, {
      submissionCount: submissionsForEvent.length,
      participantCount: participantsForEvent.length,
      mine: {
        registered: myRegistered,
        submission: mySubmission ? { id: mySubmission.id, post_id: String(mySubmission.data.post_id ?? ""), status: String(mySubmission.data.status ?? "submitted") } : null,
      },
    });
  }).sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)));
}

export async function createEventForUser(openId: string, input: EventData) {
  await assertStaff(openId);
  const startsAt = cleanDate(input.starts_at, "La fecha de inicio");
  const endsAt = cleanDate(input.ends_at, "La fecha de cierre");
  if (new Date(endsAt) <= new Date(startsAt)) throw new Error("La fecha de cierre debe ser posterior al inicio.");
  const now = new Date();
  const data: EventData = {
    title: cleanText(input.title, "El título", 160, true),
    description: cleanText(input.description, "La descripción", 4_000, true),
    banner_url: cleanText(input.banner_url, "La imagen", 2_000),
    starts_at: startsAt,
    ends_at: endsAt,
    prize_pool: typeof input.prize_pool === "number" && Number.isSafeInteger(input.prize_pool) && input.prize_pool >= 0 ? input.prize_pool : null,
    prize_description: cleanText(input.prize_description, "El premio", 1_000),
    rules: cleanText(input.rules, "Las reglas", 6_000),
    status: new Date(startsAt) > now ? "upcoming" : "active",
    created_by: openId,
  };
  const record = await createManusRecord({ id: randomUUID(), collection: "events", ownerOpenId: openId, visibility: "public", data });
  if (!record) throw new Error("No se pudo crear el evento.");
  return toEvent(record as Awaited<ReturnType<typeof findPublicEvent>>, { submissionCount: 0, participantCount: 0 });
}

export async function updateEventStatusForUser(openId: string, rawEventId: unknown, rawStatus: unknown) {
  await assertStaff(openId);
  const status = rawStatus === "upcoming" || rawStatus === "active" || rawStatus === "completed" ? rawStatus : null;
  if (!status) throw new Error("El estado no es válido.");
  const event = await findPublicEvent(rawEventId);
  const data = asObject(event.data);
  data.status = status;
  await updateOwnManusRecord({ id: event.id, ownerOpenId: event.ownerOpenId, data, visibility: "public" });
  return { ok: true, status };
}

export async function deleteEventForUser(openId: string, rawEventId: unknown) {
  await assertStaff(openId);
  const event = await findPublicEvent(rawEventId);
  await deleteOwnManusRecord(event.ownerOpenId, event.id);
  return { ok: true };
}

export async function submitToEventForUser(openId: string, rawEventId: unknown, rawPostId: unknown) {
  const event = await findPublicEvent(rawEventId);
  if (eventStatus(asObject(event.data)) === "completed" || new Date(String(asObject(event.data).ends_at)).getTime() < Date.now()) throw new Error("El evento ya finalizó.");
  const postId = cleanId(rawPostId, "La publicación");
  const post = await getOwnManusRecord(openId, postId);
  if (!post || post.collection !== "posts" || post.data.category !== "game") throw new Error("Solo puedes enviar uno de tus juegos publicados.");
  const id = recordId("submit", event.id, openId);
  const existing = await getOwnManusRecord(openId, id);
  const data = { event_id: event.id, post_id: postId, author_id: openId, status: "submitted" };
  if (existing) await updateOwnManusRecord({ id, ownerOpenId: openId, data, visibility: "public" });
  else await createManusRecord({ id, collection: "event_submissions", ownerOpenId: openId, visibility: "public", data });
  return { ok: true, id };
}

export async function joinEventForUser(openId: string, rawEventId: unknown) {
  const event = await findPublicEvent(rawEventId);
  if (eventStatus(asObject(event.data)) === "completed" || new Date(String(asObject(event.data).ends_at)).getTime() < Date.now()) throw new Error("El evento ya finalizó.");
  const id = recordId("join", event.id, openId);
  if (await getOwnManusRecord(openId, id)) return { ok: true, already_registered: true };
  await createManusRecord({ id, collection: "event_participants", ownerOpenId: openId, visibility: "public", data: { event_id: event.id, user_id: openId, joined_at: new Date().toISOString() } });
  return { ok: true, already_registered: false };
}

export async function leaveEventForUser(openId: string, rawEventId: unknown) {
  const event = await findPublicEvent(rawEventId);
  await deleteOwnManusRecord(openId, recordId("join", event.id, openId));
  return { ok: true };
}

export async function listEventParticipantsForUser(openId: string, rawEventId: unknown) {
  await assertStaff(openId);
  const event = await findPublicEvent(rawEventId);
  const [participants, profiles] = await Promise.all([listPublicManusRecords("event_participants"), listPublicManusRecords("profiles")]);
  const profileById = new Map(profiles.map(row => [row.id, asObject(row.data)]));
  return participants.filter(row => row.data.event_id === event.id).map(row => {
    const profile = profileById.get(row.ownerOpenId) ?? {};
    return {
      user_id: row.ownerOpenId,
      display_name: typeof profile.display_name === "string" ? profile.display_name : null,
      username: typeof profile.username === "string" ? profile.username : `user_${row.ownerOpenId.slice(-8)}`,
      avatar_url: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
      joined_at: typeof row.data.joined_at === "string" ? row.data.joined_at : row.createdAt.toISOString(),
    };
  });
}
