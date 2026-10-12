import { db } from "@/lib/db";

// Rooms where staff bring a patient for the doctor ("ready in room", SPEC §4e). The
// doctor's office itself is not one of them: it is the single "Γραφείο γιατρού" card.
// Rooms set up as resources of kind ROOM replace this list (editing in Settings later).
export const DEFAULT_ROOMS = ["Θεραπευτήριο 1", "Θεραπευτήριο 2", "Θεραπευτήριο 3", "Αίθουσα συσκέψεων"];

export async function roomsOf(companyId: string) {
  const rooms = await db.resource.findMany({ where: { companyId, isActive: true, kind: "ROOM" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { label: true } });
  return rooms.length ? rooms.map((r) => r.label) : DEFAULT_ROOMS;
}
