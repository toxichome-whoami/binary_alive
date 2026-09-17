import React from 'react';
import { Badge } from '../ui/Badge';
import type { Role } from '../../types';
import { ShieldCheck, Shield, Eye, FileText } from 'lucide-react';

interface RoleBadgeProps {
  role: Role;
  isMaster?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, isMaster = false }) => {
  if (isMaster) {
    return (
      <Badge variant="gold">
        <ShieldCheck className="w-3.5 h-3.5" />
        Master Admin
      </Badge>
    );
  }

  switch (role) {
    case 'admin':
      return (
        <Badge variant="red">
          <Shield className="w-3 h-3" />
          Admin
        </Badge>
      );
    case 'operator':
      return (
        <Badge variant="orange">
          <Shield className="w-3 h-3" />
          Operator
        </Badge>
      );
    case 'auditor':
      return (
        <Badge variant="blue">
          <FileText className="w-3 h-3" />
          Auditor
        </Badge>
      );
    case 'viewer':
    default:
      return (
        <Badge variant="gray">
          <Eye className="w-3 h-3" />
          Viewer
        </Badge>
      );
  }
};
