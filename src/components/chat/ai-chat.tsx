'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Send, Loader2, Bot, User, Sparkles, Plus, Trash2, MessageSquare, CheckCircle, XCircle, FileText, ClipboardList, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

import {
  createConversation,
  updateConversation,
  deleteConversation,
  type Conversation,
  type ConversationMessage,
} from '@/actions/conversations'
import type { Client } from '@/types/database'

interface ExecutedAction {
  type: string
  success: boolean
  data?: {
    id?: string
    name?: string
    number?: string
    client?: string
    total?: string
    message?: string
  }
  error?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  executedActions?: ExecutedAction[]
}

interface AIChatProps {
  clients: Client[]
  conversations: Conversation[]
  initialConversationId?: string
}

export function AIChat({ conversations: initialConversations, initialConversationId }: AIChatProps) {
  const t = useTranslations('chat')
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId || null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Charger les messages de la conversation sélectionnée
  useEffect(() => {
    if (currentConversationId) {
      const conversation = conversations.find((c) => c.id === currentConversationId)
      if (conversation) {
        setMessages(conversation.messages as Message[])
      }
    } else {
      setMessages([])
    }
  }, [currentConversationId, conversations])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
    inputRef.current?.focus()
  }

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id)
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const result = await deleteConversation(id)
    if (result.success) {
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (currentConversationId === id) {
        setCurrentConversationId(null)
        setMessages([])
      }
      toast.success('Conversation supprimée')
    } else {
      toast.error(result.error || 'Erreur lors de la suppression')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        executedActions: data.executedActions,
      }

      const updatedMessages = [...newMessages, assistantMessage]
      setMessages(updatedMessages)

      // Afficher des toasts pour les actions exécutées
      if (data.executedActions) {
        for (const action of data.executedActions) {
          if (action.success) {
            if (action.type === 'create_client') {
              toast.success(`Client "${action.data?.name}" créé !`)
            } else if (action.type === 'create_invoice') {
              toast.success(`Facture ${action.data?.number} créée !`)
            } else if (action.type === 'create_quote') {
              toast.success(`Devis ${action.data?.number} créé !`)
            }
          }
        }
      }

      // Rafraîchir la page pour mettre à jour les listes
      if (data.executedActions?.some((a: ExecutedAction) => a.success)) {
        router.refresh()
      }

      // Sauvegarder la conversation
      if (currentConversationId) {
        await updateConversation(currentConversationId, updatedMessages as ConversationMessage[])
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? { ...c, messages: updatedMessages as ConversationMessage[], updated_at: new Date().toISOString() }
              : c
          )
        )
      } else {
        const result = await createConversation(updatedMessages as ConversationMessage[])
        if (result.success && result.conversation) {
          setCurrentConversationId(result.conversation.id)
          setConversations((prev) => [result.conversation!, ...prev])
        }
      }
    } catch {
      toast.error('Erreur de communication avec l\'assistant')
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_client':
      case 'update_client':
      case 'delete_client':
        return <UserPlus className="h-4 w-4" />
      case 'create_invoice':
      case 'update_invoice_status':
      case 'delete_invoice':
        return <FileText className="h-4 w-4" />
      case 'create_quote':
      case 'update_quote_status':
      case 'delete_quote':
      case 'convert_quote_to_invoice':
        return <ClipboardList className="h-4 w-4" />
      default:
        return null
    }
  }

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'create_client':
        return 'Client créé'
      case 'update_client':
        return 'Client modifié'
      case 'delete_client':
        return 'Client supprimé'
      case 'create_invoice':
        return 'Facture créée'
      case 'update_invoice_status':
        return 'Facture mise à jour'
      case 'delete_invoice':
        return 'Facture supprimée'
      case 'create_quote':
        return 'Devis créé'
      case 'update_quote_status':
        return 'Devis mis à jour'
      case 'delete_quote':
        return 'Devis supprimé'
      case 'convert_quote_to_invoice':
        return 'Devis converti en facture'
      default:
        return 'Action'
    }
  }

  const handleActionClick = (action: ExecutedAction) => {
    if (!action.success) return

    if (action.type === 'create_invoice' || action.type === 'update_invoice_status' || action.type === 'convert_quote_to_invoice') {
      if (action.data?.id) router.push(`/invoices/${action.data.id}`)
    } else if (action.type === 'create_quote' || action.type === 'update_quote_status') {
      if (action.data?.id) router.push(`/quotes/${action.data.id}`)
    } else if (action.type === 'create_client' || action.type === 'update_client') {
      router.push('/clients')
    }
  }

  return (
    <div className="flex gap-4 flex-1 min-h-0">
      {/* Liste des conversations */}
      <Card className="w-64 flex-shrink-0 flex flex-col">
        <CardHeader className="border-b py-3 px-4">
          <Button onClick={handleNewConversation} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Nouvelle conversation
          </Button>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune conversation
              </p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                    currentConversationId === conv.id ? 'bg-muted' : ''
                  }`}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate flex-1">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Zone de chat */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">Bonjour ! Je peux vous aider à :</p>
                <ul className="text-sm space-y-1">
                  <li>"Crée une facture de 500€ pour Client X"</li>
                  <li>"Fais un devis pour une prestation de conseil"</li>
                  <li>"Combien j'ai facturé ce mois ?"</li>
                  <li>"Quelles sont mes factures en retard ?"</li>
                </ul>
                <p className="text-xs mt-4 text-muted-foreground/70">
                  Je crée vos clients, factures et devis, et je réponds à vos questions sur votre activité.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    <div
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Actions exécutées */}
                    {message.executedActions && message.executedActions.length > 0 && (
                      <div className="mt-2 ml-11 space-y-2">
                        {message.executedActions.map((action, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleActionClick(action)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                              action.success
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 cursor-pointer hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {action.success ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {getActionIcon(action.type)}
                            <span>
                              {action.success ? (
                                <>
                                  {getActionLabel(action.type)}
                                  {action.data?.name && `: ${action.data.name}`}
                                  {action.data?.number && `: ${action.data.number}`}
                                  {action.data?.total && ` (${action.data.total}€)`}
                                  {action.data?.message && !action.data?.name && !action.data?.number && `: ${action.data.message}`}
                                </>
                              ) : (
                                action.error
                              )}
                            </span>
                            {action.success && action.data?.id && (
                              <Badge variant="outline" className="text-xs ml-1">
                                Voir
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('thinking')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <form onSubmit={handleSubmit} className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('placeholder')}
                className="min-h-[44px] max-h-32 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
