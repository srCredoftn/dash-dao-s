import { describe, it, expect } from "vitest";
import type { Dao, User } from "@shared/dao";
import { resolveDaoTeamUserIds } from "../services/daoNotificationService";

const baseUsers: User[] = [
  {
    id: "user-chef",
    name: "Chef Test",
    email: "chef@test.com",
    role: "user",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: "user-admin",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    createdAt: new Date().toISOString(),
    isActive: true,
    isSuperAdmin: true,
  },
  {
    id: "user-assigned",
    name: "Assigned Member",
    email: "assigned@test.com",
    role: "user",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: "user-manual",
    name: "Manual Match",
    email: "manual@test.com",
    role: "user",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
  {
    id: "user-extra",
    name: "Actor",
    email: "actor@test.com",
    role: "user",
    createdAt: new Date().toISOString(),
    isActive: true,
  },
];

const sampleDao: Dao = {
  id: "dao-1",
  numeroListe: "DAO-2025-001",
  objetDossier: "Projet Test",
  reference: "REF-001",
  autoriteContractante: "Organisation",
  dateDepot: new Date().toISOString(),
  equipe: [
    {
      id: "user-chef",
      name: "Chef Test",
      role: "chef_equipe",
      email: "chef@test.com",
    },
    {
      id: "membre-temp",
      name: "Manual Match",
      role: "membre_equipe",
      email: "manual@test.com",
    },
  ],
  tasks: [
    {
      id: 1,
      name: "Tâche 1",
      progress: 0,
      isApplicable: true,
      assignedTo: ["user-assigned"],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("resolveDaoTeamUserIds", () => {
  it("collects recipients from team, assignments, actor and admin", () => {
    const recipients = resolveDaoTeamUserIds(sampleDao, baseUsers, {
      actorId: "user-extra",
      adminEmail: "admin@example.com",
      extraUserIds: ["user-assigned"],
    });

    expect(new Set(recipients)).toEqual(
      new Set(baseUsers.map((u) => u.id)),
    );
  });

  it("returns all users when dao is missing", () => {
    const recipients = resolveDaoTeamUserIds(null, baseUsers);
    expect(new Set(recipients)).toEqual(new Set(baseUsers.map((u) => u.id)));
  });
});
