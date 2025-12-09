import { v4 as uuidv4 } from 'uuid'

export interface MCPSession {
  id: string
  userId: string
  createdAt: Date
  lastActivityAt: Date
  capabilities: string[]
}

const SESSION_TIMEOUT_MS = 60 * 60 * 1000 // 1 heure

class MCPSessionManager {
  private sessions: Map<string, MCPSession> = new Map()

  constructor() {
    // Nettoyer les sessions expirées toutes les 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000)
  }

  createSession(userId: string): MCPSession {
    const session: MCPSession = {
      id: uuidv4(),
      userId,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      capabilities: ['tools'],
    }

    this.sessions.set(session.id, session)
    console.log(`[MCP Session] Created session ${session.id} for user ${userId}`)

    return session
  }

  getSession(sessionId: string): MCPSession | null {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return null
    }

    // Vérifier si la session est expirée
    const now = new Date()
    if (now.getTime() - session.lastActivityAt.getTime() > SESSION_TIMEOUT_MS) {
      this.deleteSession(sessionId)
      return null
    }

    return session
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastActivityAt = new Date()
    }
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      console.log(`[MCP Session] Deleted session ${sessionId}`)
      this.sessions.delete(sessionId)
    }
  }

  cleanupExpiredSessions(): void {
    const now = new Date()
    let cleaned = 0

    for (const [sessionId, session] of this.sessions) {
      if (now.getTime() - session.lastActivityAt.getTime() > SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`[MCP Session] Cleaned up ${cleaned} expired sessions`)
    }
  }

  getSessionCount(): number {
    return this.sessions.size
  }

  getUserSessions(userId: string): MCPSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId)
  }
}

// Singleton pour le gestionnaire de sessions
export const sessionManager = new MCPSessionManager()
