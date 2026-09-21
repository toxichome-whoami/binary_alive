import React from 'react';
import { Badge } from '../ui/Badge';
import type { Role } from '../../types';
import { ShieldCheck, User } from 'lucide-react';

interface RoleBadgeProps {
  role: Role;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  if (role === 'owner') {
    return (
      <Badge variant="gold">
        <ShieldCheck className="w-3.5 h-3.5" />
        Owner
      </Badge>
    );
  }

  return (
    <Badge variant="gray">
      <User className="w-3 h-3" />
      Member
    </Badge>
  );
};
