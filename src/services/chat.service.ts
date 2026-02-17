import type { ChatMessageRecord, ChatReplyResponse } from "../models/chat-message.model.js";
import type { CursorPaginatedResult } from "../models/pagination.model.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import type { AIProvider } from "./ai/provider.interface.js";

export interface CursorInput {
  limit: number;
  cursor: number | null;
}

function mapMessage(record: {
  id: number;
  patientId: number;
  ownerUserId: string;
  role: "user" | "assistant";
  message: string;
  provider: string;
  createdAt: Date;
}): ChatMessageRecord {
  return record;
}

export class ChatService {
  public constructor(private readonly aiProvider: AIProvider) {}

  private async getActiveOwnedPatient(ownerUserId: string, patientId: number): Promise<{
    id: number;
    name: string;
    medicalNotes: string;
  }> {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ownerUserId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        medicalNotes: true,
      },
    });

    if (!patient) {
      throw new ApiError(404, "NOT_FOUND", "Patient not found");
    }

    return patient;
  }

  public async createReply(ownerUserId: string, patientId: number, message: string): Promise<ChatReplyResponse> {
    const patient = await this.getActiveOwnedPatient(ownerUserId, patientId);

    await prisma.chatMessage.create({
      data: {
        patientId,
        ownerUserId,
        role: "user",
        message,
      },
    });

    let aiResponse: { message: string; provider: string };
    try {
      aiResponse = await this.aiProvider.generateResponse({
        patientId,
        patientName: patient.name,
        medicalNotes: patient.medicalNotes,
        message,
      });
    } catch (error) {
      throw new ApiError(502, "AI_PROVIDER_ERROR", "AI provider failed to generate a response", {
        reason: error instanceof Error ? error.message : "Unknown AI provider error",
      });
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        patientId,
        ownerUserId,
        role: "assistant",
        message: aiResponse.message,
        provider: aiResponse.provider,
      },
    });

    return {
      patient_id: patientId,
      ai_response: assistantMessage.message,
      provider: assistantMessage.provider,
      message_id: assistantMessage.id,
    };
  }

  public async listByPatient(
    ownerUserId: string,
    patientId: number,
    pagination: CursorInput,
  ): Promise<CursorPaginatedResult<ChatMessageRecord>> {
    await this.getActiveOwnedPatient(ownerUserId, patientId);

    const rows = await prisma.chatMessage.findMany({
      where: {
        ownerUserId,
        patientId,
        ...(pagination.cursor !== null
          ? {
              id: {
                gt: pagination.cursor,
              },
            }
          : {}),
      },
      orderBy: {
        id: "asc",
      },
      take: pagination.limit + 1,
    });

    const hasMore = rows.length > pagination.limit;
    const sliced = hasMore ? rows.slice(0, pagination.limit) : rows;

    return {
      data: sliced.map((row) =>
        mapMessage({
          id: row.id,
          patientId: row.patientId,
          ownerUserId: row.ownerUserId,
          role: row.role,
          message: row.message,
          provider: row.provider,
          createdAt: row.createdAt,
        }),
      ),
      next_cursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    };
  }
}
