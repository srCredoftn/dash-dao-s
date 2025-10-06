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
 * Construit la liste des destinataires pour une notification liée à un DAO.
 * Tous les utilisateurs actifs sont inclus par défaut afin de diffuser à l’ensemble
 * de l’organisation, avec la possibilité d’ajouter des identifiants supplémentaires
 * (acteur, admin, liste manuelle).
 */
export function resolveDaoTeamUserIds(
  _dao: Dao | null | undefined,
  users: User[],
  options: ResolveRecipientsOptions = {},
): string[] {
  const recipients = new Set<string>();
  const byEmail = new Map<string, User>();

  for (const user of users) {
    if (user?.id) {
      recipients.add(user.id);
    }
    const key = normalizeEmail(user.email);
    if (key && !byEmail.has(key)) {
      byEmail.set(key, user);
    }
  }

  const pushUserId = (userId: string | undefined | null) => {
    if (!userId) return;
    recipients.add(userId);
  };

  if (options.actorId) {
    pushUserId(options.actorId);
  }

  for (const extra of options.extraUserIds || []) {
    pushUserId(extra);
  }

  if (options.includeAdmin !== false) {
    const adminEmail =
      normalizeEmail(options.adminEmail) || normalizeEmail(process.env.ADMIN_EMAIL);
    if (adminEmail) {
      const admin = byEmail.get(adminEmail);
      if (admin?.id) {
        recipients.add(admin.id);
      }
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
 * Envoie une notification liée à un DAO à l’ensemble des utilisateurs actifs.
 * - Récupère la liste depuis l’annuaire (AuthService)
 * - Ajoute l’administrateur défini dans la configuration si présent
 * - Retombe sur une diffusion globale si aucun destinataire n’est disponible
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
