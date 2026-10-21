import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { senderFaviconUrl } from '@/lib/mail/favicon';
import { gravatarUrl } from '@/lib/mail/gravatar';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui';

function useGravatarUrl(
  email: string | null | undefined,
  enabled: boolean,
): string | null | undefined {
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);
  const key = `${email ?? ''}\u0000${enabled ? '1' : '0'}`;

  useEffect(() => {
    if (!enabled || !email) return;

    let cancelled = false;
    void gravatarUrl(email).then((next) => {
      if (!cancelled) setResolved({ key, url: next });
    });

    return () => {
      cancelled = true;
    };
  }, [email, enabled, key]);

  return resolved?.key === key ? resolved.url : undefined;
}

export function SenderAvatar({
  email,
  name,
  fallback,
  className,
}: {
  email?: string | null;
  name?: string | null;
  fallback?: string | null;
  className?: string;
}) {
  const networkAvatars = useUiStore((state) => state.networkAvatars);
  const gravatarAvatars = useUiStore((state) => state.gravatarAvatars);
  const [failedGravatar, setFailedGravatar] = useState<string | null>(null);

  const gravatarEnabled = networkAvatars && gravatarAvatars;
  const gravatar = useGravatarUrl(email, gravatarEnabled);
  const favicon = networkAvatars && email ? senderFaviconUrl(email) : null;
  const sourceKey = `${email ?? ''}\u0000${networkAvatars ? '1' : '0'}${gravatarAvatars ? '1' : '0'}`;
  const gravatarActive = gravatarEnabled && failedGravatar !== sourceKey;
  let src: string | null = null;
  if (networkAvatars) {
    if (!gravatarActive) {
      src = favicon;
    } else if (gravatar !== undefined) {
      src = gravatar ?? favicon;
    }
  }

  return (
    <Avatar className={cn('border', className)}>
      {src ? (
        <AvatarImage
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoadingStatusChange={(status) => {
            if (status === 'error' && gravatarActive) setFailedGravatar(sourceKey);
          }}
        />
      ) : null}
      <AvatarFallback>{initials(name || email || fallback || '?')}</AvatarFallback>
    </Avatar>
  );
}
