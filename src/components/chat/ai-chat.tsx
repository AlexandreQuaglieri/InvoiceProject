'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Send, Loader2, Bot, User, Sparkles, Plus, Trash2, MessageSquare, CheckCircle, XCircle, FileText, ClipboardList, UserPlus, ArrowRight, Paperclip, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

import {
  createConversation,
  updateConversation,
  deleteConversation,
  type ConversationMessage,
} from '@/actions/conversations'
import { useLiveConversations, useLiveStoreActions } from '@/lib/realtime'

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

interface NavigationSuggestion {
  label: string
  path: string
}

interface Attachment {
  name: string
  media_type: string
  data: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  executedActions?: ExecutedAction[]
  navigations?: NavigationSuggestion[]
}

interface AIChatProps {
  initialConversationId?: string
}

export function AIChat({ initialConversationId }: AIChatProps) {
  const t = useTranslations('chat')
  const router = useRouter()
  // Conversations lues depuis le store live (Realtime + optimistic) ; les
  // écritures font du write-through via upsertConversation/removeConversation.
  const conversations = useLiveConversations()
  const { upsertConversation, removeConversation } = useLiveStoreActions()
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId || null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Charger les messages de la conversation sélectionnée. Pas de reset quand
  // aucune conversation n'est sélectionnée : un event Realtime sur la liste ne
  // doit pas effacer une conversation en cours de rédaction (le vidage est fait
  // explicitement par handleNewConversation / handleDeleteConversation).
  useEffect(() => {
    if (!currentConversationId) return
    const conversation = conversations.find((c) => c.id === currentConversationId)
    if (conversation) {
      setMessages(conversation.messages as Message[])
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
    // Optimistic : retrait immédiat du store, rollback si le serveur refuse.
    const previous = conversations.find((c) => c.id === id)
    removeConversation(id)
    if (currentConversationId === id) {
      setCurrentConversationId(null)
      setMessages([])
    }
    const result = await deleteConversation(id)
    if (result.success) {
      toast.success('Conversation supprimée')
    } else {
      if (previous) upsertConversation(previous)
      toast.error(result.error || 'Erreur lors de la suppression')
    }
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
        navigations: data.navigations,
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

      // Les écritures de l'IA sont reflétées par Realtime : aucun refresh.

      // Sauvegarder la conversation (write-through dans le store live)
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
                  <li>&quot;Crée une facture de 500€ pour Client X&quot;</li>
                  <li>&quot;Fais un devis pour une prestation de conseil&quot;</li>
                  <li>&quot;Combien j&apos;ai facturé ce mois ?&quot;</li>
                  <li>&quot;Quelles sont mes factures en retard ?&quot;</li>
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

                    {/* Suggestions de navigation */}
                    {message.navigations && message.navigations.length > 0 && (
                      <div className="mt-2 ml-11 flex flex-wrap gap-2">
                        {message.navigations.map((nav, idx) => (
                          <button
                            key={idx}
                            onClick={() => router.push(nav.path)}
                            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            {nav.label}
                          </button>
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
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[160px] truncate">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="hover:text-destructive"
                      aria-label="Retirer la pièce jointe"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Joindre un document (PDF ou image)"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
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
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
              >
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
