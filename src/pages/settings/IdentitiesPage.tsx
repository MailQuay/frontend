import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Loader2, Pencil, Plus, Star, Trash2, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { toast } from '@/components/ui/toast';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { fetchAccounts } from '@/features/accounts/api';
import {
  createIdentity,
  deleteIdentity,
  fetchIdentities,
  identityKeys,
  setDefaultIdentity,
  updateIdentity,
  type Identity,
  type IdentityInput,
} from '@/features/identities/api';
import { parseRecipientInput } from '@/lib/mail/address';
import { sanitizeMailHtml, textToHtml } from '@/lib/mail/sanitize';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IdentityFormState {
  email: string;
  name: string;
  organization: string;
  replyTo: string;
  bcc: string;
  signatureHtml: string;
  signatureText: string;
  signatureMode: NonNullable<IdentityInput['signatureMode']>;
  isDefault: boolean;
}

function emptyIdentity(): IdentityFormState {
  return {
    email: '',
    name: '',
    organization: '',
    replyTo: '',
    bcc: '',
    signatureHtml: '',
    signatureText: '',
    signatureMode: 'all',
    isDefault: false,
  };
}

function formFromIdentity(identity: Identity): IdentityFormState {
  return {
    email: identity.email,
    name: identity.name,
    organization: identity.organization ?? '',
    replyTo: identity.replyTo ?? '',
    bcc: (identity.bcc ?? []).join(', '),
    signatureHtml: identity.signatureHtml ?? '',
    signatureText: identity.signatureText ?? '',
    signatureMode: identity.signatureMode,
    isDefault: identity.isDefault,
  };
}

function IdentityDialog({
  open,
  onOpenChange,
  accountId,
  identity,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  identity: Identity | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const message = useErrorMessage();
  const [form, setForm] = useState<IdentityFormState>(() =>
    identity ? formFromIdentity(identity) : emptyIdentity(),
  );

  useEffect(() => {
    if (!open) return;
    setForm(identity ? formFromIdentity(identity) : emptyIdentity());
  }, [identity, open]);

  const mutation = useMutation({
    mutationFn: (input: IdentityInput) =>
      identity
        ? updateIdentity(accountId, identity.email, input)
        : createIdentity(accountId, input),
    onSuccess: () => {
      toast(identity ? t('identity.updated') : t('identity.created'));
      onSaved();
      onOpenChange(false);
    },
    onError: (errorValue) =>
      toast(t('common.saveFailed'), {
        description: message(errorValue),
        variant: 'destructive',
      }),
  });

  const update = <K extends keyof IdentityFormState>(key: K, value: IdentityFormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const previewSource = form.signatureHtml
    ? sanitizeMailHtml(form.signatureHtml).html
    : form.signatureText
      ? textToHtml(form.signatureText)
      : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{identity ? t('identity.editTitle') : t('identity.createTitle')}</DialogTitle>
          <DialogDescription>{t('identity.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="identity-email">{t('identity.email')}</Label>
              <Input
                id="identity-email"
                type="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
                disabled={Boolean(identity)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="identity-name">{t('identity.name')}</Label>
              <Input
                id="identity-name"
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="identity-organization">{t('identity.organization')}</Label>
              <Input
                id="identity-organization"
                value={form.organization}
                onChange={(event) => update('organization', event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="identity-reply-to">{t('identity.replyTo')}</Label>
              <Input
                id="identity-reply-to"
                type="email"
                value={form.replyTo}
                onChange={(event) => update('replyTo', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identity-bcc">{t('identity.bcc')}</Label>
            <Input
              id="identity-bcc"
              value={form.bcc}
              onChange={(event) => update('bcc', event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{t('identity.bccHint')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="identity-signature-mode">{t('identity.signatureMode')}</Label>
              <Select
                value={form.signatureMode}
                onValueChange={(value) =>
                  update(
                    'signatureMode',
                    value === 'new' ||
                      value === 'reply' ||
                      value === 'forward' ||
                      value === 'none'
                      ? value
                      : 'all',
                  )
                }
              >
                <SelectTrigger id="identity-signature-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['all', 'new', 'reply', 'forward', 'none'] as const).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {t(`identity.signatureModes.${mode}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{t('identity.signatureModeHint')}</p>
            </div>
            <label className="flex items-center justify-between gap-3 self-start rounded-md border px-3 py-2 text-sm">
              <span>{t('identity.defaultBadge')}</span>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(value) => update('isDefault', value)}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identity-signature-html">{t('identity.signatureHtml')}</Label>
            <Textarea
              id="identity-signature-html"
              value={form.signatureHtml}
              onChange={(event) => update('signatureHtml', event.target.value)}
              className="min-h-24 font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="identity-signature-text">{t('identity.signatureText')}</Label>
            <Textarea
              id="identity-signature-text"
              value={form.signatureText}
              onChange={(event) => update('signatureText', event.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('identity.signaturePreview')}</p>
            <div
              className="min-h-12 rounded-md border bg-muted/20 p-3 text-sm"
              // Preview is sanitized with the same allow-list used for message bodies.
              dangerouslySetInnerHTML={{ __html: previewSource }}
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (!EMAIL_PATTERN.test(form.email.trim())) {
                toast(t('common.saveFailed'), {
                  description: t('identity.formErrors.email'),
                  variant: 'destructive',
                });
                return;
              }
              if (form.name.trim() === '') {
                toast(t('common.saveFailed'), {
                  description: t('identity.formErrors.name'),
                  variant: 'destructive',
                });
                return;
              }
              const input: IdentityInput = {
                email: form.email.trim(),
                name: form.name.trim(),
                organization: form.organization.trim() || undefined,
                replyTo: form.replyTo.trim() || undefined,
                bcc: parseRecipientInput(form.bcc),
                signatureHtml: form.signatureHtml,
                signatureText: form.signatureText,
                signatureMode: form.signatureMode,
                isDefault: form.isDefault,
              };
              mutation.mutate(input);
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {identity ? t('common.save') : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IdentitiesSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const message = useErrorMessage();
  const accountsQuery = useQuery({ queryKey: ['accounts', 'list'], queryFn: fetchAccounts });
  const [accountId, setAccountId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Identity | null>(null);
  const [deleting, setDeleting] = useState<Identity | null>(null);

  useEffect(() => {
    if (!accountId && accountsQuery.data && accountsQuery.data.length > 0) {
      setAccountId(accountsQuery.data[0].id);
    }
  }, [accountId, accountsQuery.data]);

  const identitiesQuery = useQuery({
    queryKey: identityKeys.list(accountId),
    queryFn: () => fetchIdentities(accountId),
    enabled: accountId !== '',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['identities'] });
    void queryClient.invalidateQueries({ queryKey: ['accounts'] });
  };

  const setDefault = useMutation({
    mutationFn: (identity: Identity) => setDefaultIdentity(identity.accountId, identity.email),
    onSuccess: () => {
      toast(t('identity.defaultSet'));
      invalidate();
    },
    onError: (error) =>
      toast(t('common.updateFailed'), { description: message(error), variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (identity: Identity) => deleteIdentity(identity.accountId, identity.email),
    onSuccess: () => {
      toast(t('identity.deleted'));
      setDeleting(null);
      invalidate();
    },
    onError: (error) =>
      toast(t('common.deleteFailed'), { description: message(error), variant: 'destructive' }),
  });

  if (accountsQuery.isPending) return <LoadingState />;
  if (accountsQuery.isError) {
    return <ErrorState error={accountsQuery.error} onRetry={() => void accountsQuery.refetch()} />;
  }

  const accounts = accountsQuery.data ?? [];
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<UsersRound className="size-5" aria-hidden="true" />}
        title={t('identity.emptyTitle')}
        description={t('identity.emptyBody')}
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/settings/accounts">{t('account.add')}</Link>
          </Button>
        }
      />
    );
  }

  const identities = identitiesQuery.data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">{t('identity.accountDescription')}</p>
        </div>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-64" aria-label={t('identity.chooseAccount')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          disabled={!accountId}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('identity.add')}
        </Button>
      </div>

      {identitiesQuery.isPending ? (
        <LoadingState />
      ) : identitiesQuery.isError ? (
        <ErrorState
          error={identitiesQuery.error}
          onRetry={() => void identitiesQuery.refetch()}
        />
      ) : identities.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-5" aria-hidden="true" />}
          title={t('identity.emptyTitle')}
          description={t('identity.emptyBody')}
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              {t('identity.add')}
            </Button>
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {identities.map((identity) => (
            <li key={identity.email} className="flex flex-wrap items-start gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium">{identity.name || identity.email}</p>
                  <span className="text-[11px] text-muted-foreground">{identity.email}</span>
                  {identity.isDefault ? (
                    <Badge variant="secondary">
                      <Star className="size-3" aria-hidden="true" />
                      {t('identity.defaultBadge')}
                    </Badge>
                  ) : null}
                  <Badge variant="muted">
                    {t(`identity.signatureModes.${identity.signatureMode}`)}
                  </Badge>
                </div>
                {identity.organization ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">{identity.organization}</p>
                ) : null}
                {identity.replyTo ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t('identity.replyTo')}: {identity.replyTo}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {!identity.isDefault ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefault.mutate(identity)}
                    disabled={setDefault.isPending}
                  >
                    {t('identity.setDefault')}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('identity.edit')}
                  onClick={() => {
                    setEditing(identity);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('identity.deleteTitle')}
                  onClick={() => setDeleting(identity)}
                  disabled={identity.isDefault}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {accountId ? (
        <IdentityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          accountId={accountId}
          identity={editing}
          onSaved={invalidate}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('identity.deleteTitle')}
        description={t('identity.deleteDescription')}
        confirmLabel={t('common.delete')}
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
      />
    </div>
  );
}
