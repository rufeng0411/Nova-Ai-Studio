import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

// Keep visual variants centralized so all button usages stay consistent.
const buttonVariants = cva(
 'inline-flex touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
 {
 variants: {
 variant: {
 default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/80',
 destructive:
 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80',
 outline:
 'border border-border bg-card shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
 secondary:
 'border border-border bg-card text-foreground shadow-xs hover:bg-accent active:bg-accent/80',
 ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
 link: 'text-primary underline-offset-4 hover:underline',
 },
 size: {
 default: 'h-10 px-4 py-2',
 sm: 'h-9 rounded-lg px-3 text-sm',
 lg: 'h-11 rounded-lg px-8',
 icon: 'h-10 w-10',
 },
 },
 defaultVariants: {
 variant: 'default',
 size: 'default',
 },
 }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
 VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
 ({ className, variant, size, ...props }, ref) => {
 return (
 <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
 );
 }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
