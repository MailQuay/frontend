import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import * as React from 'react';

export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

export function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      className="data-[state=closed]:animate-none"
      {...props}
    />
  );
}
