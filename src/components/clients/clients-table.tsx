'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Trash2, Building2, User } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { ClientDialog } from './client-dialog'
import { deleteClientAction } from '@/actions/clients'
import { useLiveClients, useLiveStoreActions } from '@/lib/realtime'

export function ClientsTable() {
  const t = useTranslations()
  const clients = useLiveClients()
  const { upsertClient, removeClient } = useLiveStoreActions()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    // Optimistic : retrait immédiat du store, rollback si le serveur refuse.
    const previous = clients.find((c) => c.id === deleteId)
    setIsDeleting(true)
    removeClient(deleteId)
    try {
      const result = await deleteClientAction(deleteId)
      if (result.success) {
        toast.success('Client supprimé')
      } else {
        if (previous) upsertClient(previous)
        toast.error(result.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Suppression du client échouée', error)
      if (previous) upsertClient(previous)
      toast.error('Erreur lors de la suppression')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucun client pour le moment.</p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('clients.name')}</TableHead>
            <TableHead>{t('clients.type')}</TableHead>
            <TableHead>{t('clients.email')}</TableHead>
            <TableHead>{t('clients.city')}</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1">
                  {client.type === 'professional' ? (
                    <>
                      <Building2 className="h-3 w-3" />
                      {t('clients.professional')}
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3" />
                      {t('clients.individual')}
                    </>
                  )}
                </Badge>
              </TableCell>
              <TableCell>{client.email || '-'}</TableCell>
              <TableCell>{client.city}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <ClientDialog
                      client={client}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('common.edit')}
                        </DropdownMenuItem>
                      }
                    />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(client.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le client sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
