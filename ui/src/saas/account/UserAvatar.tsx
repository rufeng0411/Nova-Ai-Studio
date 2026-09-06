/**
 * PD-SAAS-FORK: User avatar with initials fallback.
 */
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { userInitials } from '../auth/roles';
import { buildUserAvatarUrl } from './avatarHelpers';

type UserAvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<UserAvatarSize, string> = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-[12px]',
  lg: 'h-16 w-16 text-[15px]',
};

type UserAvatarProps = {
  username: string;
  avatarUpdatedAt?: string | null;
  size?: UserAvatarSize;
  className?: string;
  title?: string;
};

export default function UserAvatar({
  username,
  avatarUpdatedAt,
  size = 'sm',
  className,
  title,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = !imageFailed ? buildUserAvatarUrl(avatarUpdatedAt) : null;
  const sizeClass = SIZE_CLASS[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        title={title ?? username}
        className={cn(
          'shrink-0 rounded-full object-cover ring-1 ring-border/60',
          sizeClass,
          className,
        )}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      title={title ?? username}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground',
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {userInitials(username)}
    </div>
  );
}
