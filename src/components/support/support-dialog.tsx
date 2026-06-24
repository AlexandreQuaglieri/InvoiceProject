'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Headset, Loader2, Send } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { sendSupportMessage } from '@/actions/support'

// Popup « Assistance » : on écrit un message, une vraie personne répond. Le
// message est persisté (support_messages) ; le hub de notification alertera
// l'équipe plus tard.
export function SupportDialog() {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (message.trim().length < 2) return
    setLoading(true)
    try {
      const result = await sendSupportMessage({ subject, message })
      if (result.success) {
        toast.success('Message envoyé — on vous répond au plus vite.')
        setOpen(false)
        setSubject('')
        setMessage('')
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      console.error('Envoi du message d’assistance échoué', error)
      toast.error('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Headset className="h-3.5 w-3.5" aria-hidden="true" />
          Assistance
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Une question ? On est là.</DialogTitle>
          <DialogDescription>Écrivez-nous, une vraie personne vous répond.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="support-subject">Sujet (optionnel)</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Ex. : problème d'envoi de facture"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-message">Votre message</Label>
            <Textarea
              id="support-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Décrivez votre besoin…"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={submit} disabled={loading || message.trim().length < 2}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Envoyer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
