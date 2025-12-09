'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, Pencil } from 'lucide-react'

import { ClientForm } from './client-form'
import { createClientAction, updateClientAction } from '@/actions/clients'
import type { ClientFormData } from '@/lib/validations/client'
import type { Client } from '@/types/database'

interface ClientDialogProps {
  client?: Client
  trigger?: React.ReactNode
}

export function ClientDialog({ client, trigger }: ClientDialogProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: ClientFormData) => {
    setIsLoading(true)
    try {
      const result = client
        ? await updateClientAction(client.id, data)
        : await createClientAction(data)

      if (result.success) {
        toast.success(client ? 'Client mis à jour' : 'Client créé')
        setOpen(false)
      } else {
        toast.error(result.error || 'Une erreur est survenue')
      }
    } catch (error) {
      toast.error('Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            {client ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t('clients.new')}
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? t('common.edit') : t('clients.new')}</DialogTitle>
          <DialogDescription>
            {client
              ? 'Modifiez les informations du client.'
              : 'Ajoutez un nouveau client à votre liste.'}
          </DialogDescription>
        </DialogHeader>
        <ClientForm client={client} onSubmit={handleSubmit} isLoading={isLoading} />
      </DialogContent>
    </Dialog>
  )
}
