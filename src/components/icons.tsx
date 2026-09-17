import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function EllipsisIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function CalendarPlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
      <path d="M3.5 9.8h17M8 3.2v3.4M16 3.2v3.4M12 12.6v5M9.5 15.1h5" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />
    </Icon>
  )
}

export function XIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="M7 7l10 10M17 7 7 17" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
      <path d="m6.3 6.5.9 12.2c.1 1 .9 1.8 1.9 1.8h5.8c1 0 1.8-.8 1.9-1.8l.9-12.2M10.2 10.5v6M13.8 10.5v6" />
    </Icon>
  )
}

export function ArrowDownDocIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3.5H8A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h8a2.5 2.5 0 0 0 2.5-2.5V8Z" />
      <path d="M14 3.5V8h4.5M12 10.5v6.2M9.4 14.2 12 16.8l2.6-2.6" />
    </Icon>
  )
}

export function ArrowUpDocIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3.5H8A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h8a2.5 2.5 0 0 0 2.5-2.5V8Z" />
      <path d="M14 3.5V8h4.5M12 16.8v-6.2M9.4 13.2 12 10.6l2.6 2.6" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...props}>
      <path d="m7 9.5 5 5 5-5" />
    </Icon>
  )
}

export function StackIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.6} {...props}>
      <rect x="4" y="9" width="16" height="11" rx="3" />
      <path d="M6.5 6h11M9 3h6" />
      <circle cx="8.2" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M11.5 14.5h5" />
    </Icon>
  )
}

export function SearchOffIcon(props: IconProps) {
  return (
    <Icon strokeWidth={1.6} {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5M8.2 8.2l4.6 4.6M12.8 8.2l-4.6 4.6" />
    </Icon>
  )
}
