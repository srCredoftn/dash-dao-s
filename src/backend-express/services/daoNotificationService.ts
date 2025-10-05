import type { Dao, User } from "@shared/dao";
import type {
  NotificationType,
  ServerNotification,
} from "./notificationService";
import { NotificationService } from "./notificationService";
import { AuthService } from "./authService";
import { logger } from "../utils/logger";

interface ResolveRecipientsOptions {
  actorId?: string | null;
  includeAdmin?: boolean;
  adminEmail?: string | null;
  includeAssignments?: boolean;
  extraUserIds?: string[];
}

function normalizeEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

/**
 * Résout les identifiants utilisateur à notifier pour un DAO donné.
 * - Associe les membres d’équipe aux utilisateurs actifs (par id ou email)
 * - Optionnellement ajoute l’acteur, le super admin et les assignés de tâches
 */
export function resolveDaoTeamUserIds(
  dao: Dao | null | undefined,
  users: User[],
  options: ResolveRecipientsOptions = {},
): string[] {
  const recipients = new Set<string>();
  if (!dao) {
    return Array.from(recipients);
  }

  const byId = new Map<string, User>(users.map((u) => [u.id, u]));
  const byEmail = new Map<string, User>();
  for (const user of users) {
    const key = normalizeEmail(user.email);
    if (key && !byEmail.has(key)) {
      byEmail.set(key, user);
    }
  }

  const pushUserId = (userId: string | undefined | null) => {
    if (!userId) return;
    const user = byId.get(userId);
    if (user) recipients.add(user.id);
  };

  const pushEmail = (email: string | undefined | null) => {
    const key = normalizeEmail(email);
    if (!key) return;
    const user = byEmail.get(key);
    if (user) recipients.add(user.id);
  };

  for (const member of dao.equipe || []) {
    pushUserId(member.id);
    pushEmail(member.email);
  }

  if (options.includeAssignments !== false) {
    for (const task of dao.tasks || []) {
      for (const assigned of task.assignedTo || []) {
        pushUserId(assigned);
        if (assigned.includes("@")) {
          pushEmail(assigned);
        }
      }
    }
  }

  if (options.actorId) {
    pushUserId(options.actorId);
  }

  for (const extra of options.extraUserIds || []) {
    pushUserId(extra);
  }

  if (options.includeAdmin !== false) {
    const adminEmail = normalizeEmail(options.adminEmail);
    if (adminEmail) {
      const admin = byEmail.get(adminEmail);
      if (admin) recipients.add(admin.id);
    }
  }

  return Array.from(recipients);
}

interface NotifyDaoTeamOptions {
  actorId?: string | null;
  includeAdmin?: boolean;
  fallbackToAll?: boolean;
  extraUserIds?: string[];
}

type NotificationPayload = Pick<
  ServerNotification,
  "type" | "title" | "message" | "data"
> & { type: NotificationType };

/**
 * Envoie une notification ciblée à l’équipe d’un DAO.
 * - Identifie les utilisateurs actifs correspondants aux membres/assignés
 * - Inclut l’admin (ADMIN_EMAIL) par défaut pour supervision
 * - Retombe sur une diffusion globale si aucun destinataire trouvé
 */
export async function notifyDaoTeam(
  dao: Dao | null | undefined,
  payload: NotificationPayload,
  options: NotifyDaoTeamOptions = {},
) {
  try {
    const users = await AuthService.getAllUsers();
    const recipients = resolveDaoTeamUserIds(dao, users, {
      actorId: options.actorId,
      includeAdmin: options.includeAdmin,
      adminEmail: process.env.ADMIN_EMAIL || null,
      extraUserIds: options.extraUserIds,
    });

    if (recipients.length === 0) {
      if (options.fallbackToAll === false) {
        return NotificationService.broadcast(
          payload.type,
          payload.title,
          payload.message,
          payload.data,
        );
      }
      return NotificationService.broadcast(
        payload.type,
        payload.title,
        payload.message,
        payload.data,
      );
    }

    return NotificationService.add({
      ...payload,
      recipients,
    });
  } catch (error) {
    logger.warn("notifyDaoTeam fallback to broadcast", "NOTIF", {
      message: String((error as Error)?.message),
    });
    return NotificationService.broadcast(
      payload.type,
      payload.title,
      payload.message,
      payload.data,
    );
  }
}
