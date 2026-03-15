import { Check, PlusCircle } from 'lucide-react';
import { type UserRole } from '../lib/query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

type Props = {
  value: UserRole[];
  onChange: (roles: UserRole[]) => void;
};

export function UserRoleFilter({ value, onChange }: Props) {
  function toggle(role: UserRole) {
    onChange(
      value.includes(role) ? value.filter((r) => r !== role) : [...value, role],
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="border-dashed" />
        }
      >
        <PlusCircle className="size-4" />
        Role
        {value.length > 0 && (
          <>
            <Separator orientation="vertical" className="mx-0.5 h-4" />
            {value.length > 1 ? (
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {value.length} selected
              </Badge>
            ) : (
              ROLES.filter((r) => value.includes(r.value)).map((r) => (
                <Badge
                  key={r.value}
                  variant="secondary"
                  className="rounded-sm px-1 font-normal"
                >
                  {r.label}
                </Badge>
              ))
            )}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-0">
        <Command>
          <CommandInput placeholder="Search roles..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {ROLES.map(({ value: role, label }) => {
                const selected = value.includes(role);
                return (
                  <CommandItem key={role} onSelect={() => toggle(role)}>
                    <div
                      className={`mr-2 flex size-4 items-center justify-center rounded-sm border ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/50 opacity-50'
                      }`}
                    >
                      {selected && <Check className="size-3" />}
                    </div>
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {value.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
