'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Bot,
  Send,
  Loader2,
  Plus,
  MessageSquare,
  User,
  ChevronDown,
  CheckCircle,
  XCircle,
  FileText,
  ClipboardList,
  UserPlus,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

import {
  createConversation,
  updateConversation,
  type Conversation,
  type ConversationMessage,
} from '@/actions/conversations'
import { useLiveConversations, useLiveStoreActions } from '@/lib/realtime'

interface ExecutedAction {
  type: string
  success: boolean
  data?: { id?: string; name?: string; number?: string; total?: string; message?: string }
  error?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  executedActions?: ExecutedAction[]
}

// Pièce jointe envoyée à /api/chat (même contrat que le chat plein écran :
// l'IA lit PDF et images — Kbis, devis, factures…).
interface Attachment {
  name: string
  media_type: string
  data: string
}

export function AICopilotPanel() {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  // Conversations lues depuis le store live (Realtime + optimistic) ; les
  // écritures font du write-through via upsertConversation.
  const conversations = useLiveConversations()
  const { upsertConversation } = useLiveStoreActions()
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showConversations, setShowConversations] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
    setShowConversations(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSelectConversation = (conv: Conversation) => {
    setCurrentConversationId(conv.id)
    setMessages(conv.messages as Message[])
    setShowConversations(false)
  }

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(((reader.result as string) || '').split(',')[1] || '')
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const accepted = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const next: Attachment[] = []
    for (const file of Array.from(files)) {
      if (!accepted.includes(file.type)) {
        toast.error(`Format non supporté : ${file.name} (PDF ou image)`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 10 Mo`)
        continue
      }
      next.push({ name: file.name, media_type: file.type, data: await fileToBase64(file) })
    }
    if (next.length) setAttachments((prev) => [...prev, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && attachments.length === 0) || isLoading) return

    const currentAttachments = attachments
    const attachmentNote = currentAttachments.map((a) => `📎 ${a.name}`).join('\n')
    const userContent = [input.trim(), attachmentNote].filter(Boolean).join('\n')

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setAttachments([])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          attachments: currentAttachments.length ? currentAttachments : undefined,
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

      if (data.executedActions) {
        for (const action of data.executedActions) {
          if (action.success) {
            if (action.type === 'create_client') toast.success(`Client "${action.data?.name}" créé !`)
            else if (action.type === 'create_invoice') toast.success(`Facture ${action.data?.number} créée !`)
            else if (action.type === 'create_quote') toast.success(`Devis ${action.data?.number} créé !`)
          }
        }
      }

      // Les écritures de l'IA sont reflétées par Realtime : aucun refresh.

      if (currentConversationId) {
        const conv = conversations.find((c) => c.id === currentConversationId)
        if (conv) {
          // Optimistic : updated_at inchangé, Realtime réconciliera la valeur DB.
          upsertConversation({ ...conv, messages: updatedMessages as ConversationMessage[] })
        }
        await updateConversation(currentConversationId, updatedMessages as ConversationMessage[])
      } else {
        const result = await createConversation(updatedMessages as ConversationMessage[])
        if (result.success && result.conversation) {
          setCurrentConversationId(result.conversation.id)
          upsertConversation(result.conversation)
        }
      }
    } catch (error) {
      console.error('Requête au chat IA échouée', error)
      toast.error("Erreur de communication avec l'assistant")
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleActionClick = (action: ExecutedAction) => {
    if (!action.success) return
    if (['create_invoice', 'update_invoice_status', 'convert_quote_to_invoice'].includes(action.type)) {
      if (action.data?.id) router.push(`/invoices/${action.data.id}`)
    } else if (['create_quote', 'update_quote_status'].includes(action.type)) {
      if (action.data?.id) router.push(`/quotes/${action.data.id}`)
    } else if (['create_client', 'update_client'].includes(action.type)) {
      router.push('/clients')
    }
  }

  const getActionIcon = (type: string) => {
    if (['create_client', 'update_client'].includes(type)) return <UserPlus className="h-3 w-3" />
    if (['create_invoice', 'update_invoice_status'].includes(type)) return <FileText className="h-3 w-3" />
    if (['create_quote', 'update_quote_status', 'convert_quote_to_invoice'].includes(type)) return <ClipboardList className="h-3 w-3" />
    return null
  }

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      create_client: 'Client créé',
      update_client: 'Client modifié',
      create_invoice: 'Facture créée',
      update_invoice_status: 'Facture mise à jour',
      create_quote: 'Devis créé',
      update_quote_status: 'Devis mis à jour',
      convert_quote_to_invoice: 'Converti en facture',
    }
    return labels[type] || 'Action'
  }

  const currentTitle = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)?.title || 'Conversation'
    : 'Nouvelle conversation'

  // Collapsed : juste une barre fine avec le bouton pour réouvrir
  if (collapsed) {
    return (
      <div className="flex-shrink-0 w-10 border-l flex flex-col items-center py-4 gap-3 bg-background">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Ouvrir l'assistant"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <div className="flex-1 flex items-center">
          <span className="text-xs text-muted-foreground [writing-mode:vertical-rl] rotate-180 select-none">
            Assistant facturation
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 w-[340px] border-l flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Assistant facturation</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Sélecteur de conversation */}
          <div className="relative">
            <button
              onClick={() => setShowConversations(!showConversations)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors max-w-[120px]"
            >
              <span className="truncate">{currentTitle}</span>
              <ChevronDown className="h-3 w-3 flex-shrink-0" />
            </button>

            {showConversations && (
              <div className="absolute top-full right-0 mt-1 w-60 bg-background border rounded-lg shadow-lg z-10 overflow-hidden">
                <div className="p-2 border-b">
                  <button
                    onClick={handleNewConversation}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nouvelle conversation
                  </button>
                </div>
                <ScrollArea className="max-h-48">
                  <div className="p-2 space-y-0.5">
                    {conversations.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Aucune conversation
                      </p>
                    ) : (
                      conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted transition-colors text-left ${
                            currentConversationId === conv.id ? 'bg-muted' : ''
                          }`}
                        >
                          <MessageSquare className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{conv.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Réduire"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="p-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-xs font-medium mb-3">Je peux tout faire, demandez-moi.</p>
              <ul className="text-xs space-y-1.5 text-muted-foreground/70 text-left bg-muted/50 rounded-lg p-3">
                <li>• Modifier les lignes et les prix</li>
                <li>• Changer le client ou les dates</li>
                <li>• Ajouter / supprimer des lignes</li>
                <li>• Convertir en facture</li>
                <li>• Créer un nouveau devis</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id}>
                  <div className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>

                  {message.executedActions && message.executedActions.length > 0 && (
                    <div className="mt-1.5 ml-8 space-y-1">
                      {message.executedActions.map((action, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleActionClick(action)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                            action.success
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 cursor-pointer hover:bg-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {action.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {getActionIcon(action.type)}
                          <span>
                            {action.success ? (
                              <>
                                {getActionLabel(action.type)}
                                {action.data?.name && `: ${action.data.name}`}
                                {action.data?.number && `: ${action.data.number}`}
                                {action.data?.total && ` (${action.data.total}€)`}
                              </>
                            ) : (
                              action.error
                            )}
                          </span>
                          {action.success && action.data?.id && (
                            <Badge variant="outline" className="text-xs ml-0.5 h-4">Voir</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Réflexion...
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t p-2.5 flex-shrink-0"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void handleFiles(e.dataTransfer.files)
        }}
      >
        {attachments.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {attachments.map((att, idx) => (
              <span
                key={`${att.name}-${idx}`}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]"
              >
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                <span className="max-w-[140px] truncate">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Retirer ${att.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => void handleFiles(e.target.files)}
            className="hidden"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Joindre un document (PDF ou image)"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Modifie ce document..."
            className="min-h-[36px] max-h-24 resize-none text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            disabled={isLoading || (!input.trim() && attachments.length === 0)}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </form>
    </div>
  )
}
