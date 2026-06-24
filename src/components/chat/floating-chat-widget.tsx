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
  Sparkles,
  ArrowRight,
  Paperclip,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import {
  getConversations,
  createConversation,
  updateConversation,
  type Conversation,
  type ConversationMessage,
} from '@/actions/conversations'

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
  navigations?: { label: string; path: string }[]
}

interface Attachment {
  name: string
  media_type: string
  data: string
}

export function FloatingChatWidget() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConversations, setShowConversations] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Charger les conversations à la première ouverture
  useEffect(() => {
    if (open && !loaded) {
      getConversations().then((data) => {
        setConversations(data)
        setLoaded(true)
      })
    }
  }, [open, loaded])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

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
        navigations: data.navigations,
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
    if (action.type === 'create_invoice' || action.type === 'update_invoice_status' || action.type === 'convert_quote_to_invoice') {
      if (action.data?.id) { setOpen(false); router.push(`/invoices/${action.data.id}`) }
    } else if (action.type === 'create_quote' || action.type === 'update_quote_status') {
      if (action.data?.id) { setOpen(false); router.push(`/quotes/${action.data.id}`) }
    } else if (action.type === 'create_client' || action.type === 'update_client') {
      setOpen(false); router.push('/clients')
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

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        aria-label="Ouvrir l'assistant IA"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Panel latéral */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[420px] p-0 flex flex-col gap-0 overflow-hidden">
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <SheetTitle className="text-base font-semibold">Assistant facturation</SheetTitle>
              </div>
              <div className="flex items-center gap-1">
                {/* Sélecteur de conversation */}
                <div className="relative">
                  <button
                    onClick={() => setShowConversations(!showConversations)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors max-w-[140px]"
                  >
                    <MessageSquare className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{currentTitle}</span>
                    <ChevronDown className="h-3 w-3 flex-shrink-0" />
                  </button>

                  {showConversations && (
                    <div className="absolute top-full right-0 mt-1 w-64 bg-background border rounded-lg shadow-lg z-10 overflow-hidden">
                      <div className="p-2 border-b">
                        <button
                          onClick={handleNewConversation}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Nouvelle conversation
                        </button>
                      </div>
                      <ScrollArea className="max-h-48">
                        <div className="p-2 space-y-1">
                          {conversations.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Aucune conversation
                            </p>
                          ) : (
                            conversations.map((conv) => (
                              <button
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left ${
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

              </div>
            </div>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 min-h-0 p-4">
            {messages.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm mb-3">Je peux vous aider à :</p>
                <ul className="text-xs space-y-1 text-muted-foreground/70">
                  <li>&quot;Crée une facture pour ce devis&quot;</li>
                  <li>&quot;Combien j&apos;ai facturé ce mois ?&quot;</li>
                  <li>&quot;Mes factures en retard ?&quot;</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    <div className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {message.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <User className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>

                    {message.executedActions && message.executedActions.length > 0 && (
                      <div className="mt-2 ml-9 space-y-1.5">
                        {message.executedActions.map((action, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleActionClick(action)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
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

                    {message.navigations && message.navigations.length > 0 && (
                      <div className="mt-2 ml-9 flex flex-wrap gap-1.5">
                        {message.navigations.map((nav, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setOpen(false)
                              router.push(nav.path)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                          >
                            <ArrowRight className="h-3 w-3" />
                            {nav.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        En train de réfléchir...
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t p-3 flex-shrink-0">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((att, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[120px] truncate">{att.name}</span>
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
                className="h-10 w-10 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title="Joindre un document (PDF ou image)"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Modifie le prix de l'étape 1..."
                className="min-h-[40px] max-h-28 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
              />
              <Button type="submit" size="icon" className="h-10 w-10 flex-shrink-0" disabled={isLoading || (!input.trim() && attachments.length === 0)}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
